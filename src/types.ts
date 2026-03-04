import { z } from 'zod';

// TaskMarket API response types
export const TaskSchema = z.object({
  id: z.string(),
  requester: z.string(),
  description: z.string(),
  reward: z.string(),
  status: z.string(),
  tags: z.array(z.string()),
  worker: z.string().nullable(),
  rating: z.number().nullable(),
  mode: z.string(),
  createdAt: z.string(),
  expiryTime: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

export const AgentStatsSchema = z.object({
  address: z.string(),
  balanceUsdc: z.string(),
  completedTasks: z.number(),
  averageRating: z.number(),
  totalEarnings: z.string(),
});

export type AgentStats = z.infer<typeof AgentStatsSchema>;

// CV output types
export interface AgentSkill {
  name: string;
  frequency: number;
  source: 'tag' | 'description';
}

export interface CompletedTask {
  id: string;
  description: string;
  reward: number;
  rating: number | null;
  completedAt: string;
  tags: string[];
}

export interface AgentCV {
  agent: {
    address: string;
    agentId?: string;
    memberSince: string;
    reputationScore: number;
  };
  summary: string;
  skills: AgentSkill[];
  selectedWork: CompletedTask[];
  stats: {
    completedTasks: number;
    successRate: number;
    totalEarned: number;
    averageRating: number;
    averageReward: number;
  };
  generatedAt: string;
}

// Skill keywords to extract from descriptions
export const SKILL_KEYWORDS = [
  // Languages & Runtimes
  'typescript', 'javascript', 'python', 'rust', 'go', 'solidity',
  'bun', 'node', 'deno',
  // Frameworks
  'hono', 'express', 'fastify', 'next.js', 'react', 'vue',
  // Tools & Platforms
  'docker', 'railway', 'vercel', 'aws', 'gcp',
  'git', 'github', 'ci/cd', 'ci', 'pipeline',
  // Domains
  'api', 'rest', 'graphql', 'websocket',
  'web3', 'blockchain', 'ethereum', 'base', 'x402',
  'ai', 'llm', 'openai', 'claude',
  'testing', 'tdd', 'unit test',
  'scraping', 'puppeteer', 'playwright',
  'database', 'postgres', 'sqlite', 'redis',
  // Lucid specific
  'lucid', 'lucid-agents', '@lucid-agents',
  'payments', 'micropayments',
];
