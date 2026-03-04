import type { AgentCV, AgentSkill, CompletedTask, Task, AgentStats } from './types';
import { SKILL_KEYWORDS } from './types';

const TASKMARKET_API = 'https://api-market.daydreams.systems';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  cv: AgentCV;
  timestamp: number;
}

const cvCache = new Map<string, CacheEntry>();

export function getCacheStatus() {
  return {
    entries: cvCache.size,
    ttlMs: CACHE_TTL_MS,
  };
}

export function clearCache(agentId?: string) {
  if (agentId) {
    cvCache.delete(agentId.toLowerCase());
  } else {
    cvCache.clear();
  }
}

async function fetchAgentStats(address: string): Promise<AgentStats | null> {
  try {
    const res = await fetch(`${TASKMARKET_API}/api/agents/${address}/stats`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || data;
  } catch {
    return null;
  }
}

async function fetchCompletedTasks(address: string): Promise<Task[]> {
  try {
    const res = await fetch(`${TASKMARKET_API}/api/tasks?status=accepted&limit=100`);
    if (!res.ok) return [];
    const data = await res.json();
    const tasks = data.data?.tasks || data.tasks || [];
    // Filter tasks where this agent is the worker
    return tasks.filter((t: Task) => 
      t.worker?.toLowerCase() === address.toLowerCase()
    );
  } catch {
    return [];
  }
}

function extractSkills(tasks: Task[]): AgentSkill[] {
  const skillCounts = new Map<string, { count: number; source: 'tag' | 'description' }>();

  for (const task of tasks) {
    // Extract from tags
    for (const tag of task.tags) {
      const tagLower = tag.toLowerCase();
      const existing = skillCounts.get(tagLower);
      if (existing) {
        existing.count++;
      } else {
        skillCounts.set(tagLower, { count: 1, source: 'tag' });
      }
    }

    // Extract from description
    const descLower = task.description.toLowerCase();
    for (const keyword of SKILL_KEYWORDS) {
      if (descLower.includes(keyword.toLowerCase())) {
        const existing = skillCounts.get(keyword);
        if (existing) {
          existing.count++;
        } else {
          skillCounts.set(keyword, { count: 1, source: 'description' });
        }
      }
    }
  }

  // Sort by frequency and return top skills
  return Array.from(skillCounts.entries())
    .map(([name, data]) => ({ name, frequency: data.count, source: data.source }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15);
}

function generateSummary(stats: AgentStats | null, tasks: Task[], skills: AgentSkill[]): string {
  const completedCount = tasks.length;
  const totalEarned = stats ? parseFloat(stats.totalEarnings) / 1_000_000 : 0;
  const avgRating = stats?.averageRating || 0;
  
  const topSkills = skills.slice(0, 5).map(s => s.name);
  const skillsText = topSkills.length > 0 
    ? `Specializes in ${topSkills.join(', ')}.` 
    : '';

  if (completedCount === 0) {
    return `New agent on TaskMarket. No completed tasks yet.`;
  }

  const ratingText = avgRating > 0 
    ? ` with an average rating of ${avgRating.toFixed(0)}/100` 
    : '';

  return `Experienced TaskMarket agent with ${completedCount} completed task${completedCount === 1 ? '' : 's'}${ratingText}. Total earnings: $${totalEarned.toFixed(2)} USDC. ${skillsText}`;
}

function selectTopWork(tasks: Task[]): CompletedTask[] {
  // Sort by rating (desc), then by reward (desc)
  const sorted = [...tasks].sort((a, b) => {
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    if (ratingB !== ratingA) return ratingB - ratingA;
    return parseFloat(b.reward) - parseFloat(a.reward);
  });

  return sorted.slice(0, 5).map(t => ({
    id: t.id,
    description: t.description.slice(0, 200) + (t.description.length > 200 ? '...' : ''),
    reward: parseFloat(t.reward) / 1_000_000,
    rating: t.rating,
    completedAt: t.createdAt,
    tags: t.tags,
  }));
}

function calculateStats(stats: AgentStats | null, tasks: Task[]) {
  const completedTasks = tasks.length;
  const totalEarned = stats ? parseFloat(stats.totalEarnings) / 1_000_000 : 0;
  const averageRating = stats?.averageRating || 0;
  
  const rewards = tasks.map(t => parseFloat(t.reward) / 1_000_000);
  const averageReward = rewards.length > 0 
    ? rewards.reduce((a, b) => a + b, 0) / rewards.length 
    : 0;

  // Success rate = completed / (completed + expired assigned to this worker)
  // For now, assume 100% since we only have completed tasks
  const successRate = completedTasks > 0 ? 100 : 0;

  return {
    completedTasks,
    successRate,
    totalEarned,
    averageRating,
    averageReward,
  };
}

export async function generateCV(agentId: string): Promise<AgentCV> {
  const cacheKey = agentId.toLowerCase();
  
  // Check cache
  const cached = cvCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.cv;
  }

  // Fetch data
  const [stats, tasks] = await Promise.all([
    fetchAgentStats(agentId),
    fetchCompletedTasks(agentId),
  ]);

  // Find earliest task date for "member since"
  const memberSince = tasks.length > 0
    ? tasks.reduce((earliest, t) => {
        const date = new Date(t.createdAt);
        return date < earliest ? date : earliest;
      }, new Date()).toISOString()
    : new Date().toISOString();

  const skills = extractSkills(tasks);
  const summary = generateSummary(stats, tasks, skills);
  const selectedWork = selectTopWork(tasks);
  const statsData = calculateStats(stats, tasks);

  const cv: AgentCV = {
    agent: {
      address: agentId,
      memberSince,
      reputationScore: stats?.averageRating || 0,
    },
    summary,
    skills,
    selectedWork,
    stats: statsData,
    generatedAt: new Date().toISOString(),
  };

  // Cache result
  cvCache.set(cacheKey, { cv, timestamp: Date.now() });

  return cv;
}
