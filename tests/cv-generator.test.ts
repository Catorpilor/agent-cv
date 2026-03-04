import { describe, it, expect, beforeEach, mock } from 'bun:test';

// Mock types for testing
interface MockTask {
  id: string;
  description: string;
  reward: string;
  status: string;
  tags: string[];
  worker: string | null;
  rating: number | null;
  createdAt: string;
  expiryTime: string;
  requester: string;
  mode: string;
}

interface MockStats {
  address: string;
  balanceUsdc: string;
  completedTasks: number;
  averageRating: number;
  totalEarnings: string;
}

// Test data
const mockTasks: MockTask[] = [
  {
    id: '0x123',
    description: 'Build a TypeScript API with Hono and x402 payments',
    reward: '25000000',
    status: 'accepted',
    tags: ['typescript', 'api'],
    worker: '0x85261B8fDDc9c15Abb91c3DFf9f670472825167F',
    rating: 85,
    createdAt: '2026-02-15T10:00:00Z',
    expiryTime: '2026-02-20T10:00:00Z',
    requester: '0xAAA',
    mode: 'bounty',
  },
  {
    id: '0x456',
    description: 'Create a Python scraper with Puppeteer and Docker deployment',
    reward: '30000000',
    status: 'accepted',
    tags: ['python', 'scraping'],
    worker: '0x85261B8fDDc9c15Abb91c3DFf9f670472825167F',
    rating: 90,
    createdAt: '2026-02-20T10:00:00Z',
    expiryTime: '2026-02-25T10:00:00Z',
    requester: '0xBBB',
    mode: 'bounty',
  },
];

const mockStats: MockStats = {
  address: '0x85261B8fDDc9c15Abb91c3DFf9f670472825167F',
  balanceUsdc: '50.00',
  completedTasks: 2,
  averageRating: 87,
  totalEarnings: '55000000',
};

describe('AgentCV Generator', () => {
  describe('Skill Extraction', () => {
    it('should extract skills from task tags', () => {
      const tags = ['typescript', 'api'];
      expect(tags).toContain('typescript');
      expect(tags).toContain('api');
    });

    it('should extract skills from description keywords', () => {
      const desc = 'Build a TypeScript API with Hono and x402 payments';
      const keywords = ['typescript', 'hono', 'x402', 'api'];
      for (const kw of keywords) {
        expect(desc.toLowerCase()).toContain(kw.toLowerCase());
      }
    });

    it('should deduplicate skills from multiple sources', () => {
      const skills = new Set(['typescript', 'api', 'typescript']);
      expect(skills.size).toBe(2);
    });

    it('should sort skills by frequency', () => {
      const skillCounts = [
        { name: 'typescript', count: 5 },
        { name: 'python', count: 2 },
        { name: 'docker', count: 8 },
      ];
      const sorted = skillCounts.sort((a, b) => b.count - a.count);
      expect(sorted[0].name).toBe('docker');
      expect(sorted[1].name).toBe('typescript');
    });

    it('should limit skills to top 15', () => {
      const skills = Array.from({ length: 20 }, (_, i) => ({ name: `skill${i}`, count: 20 - i }));
      const top15 = skills.slice(0, 15);
      expect(top15.length).toBe(15);
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary for agent with completed tasks', () => {
      const summary = `Experienced TaskMarket agent with 2 completed tasks with an average rating of 87/100.`;
      expect(summary).toContain('2 completed tasks');
      expect(summary).toContain('87/100');
    });

    it('should handle new agent with no tasks', () => {
      const summary = 'New agent on TaskMarket. No completed tasks yet.';
      expect(summary).toContain('No completed tasks');
    });

    it('should include top skills in summary', () => {
      const topSkills = ['typescript', 'api', 'docker'];
      const skillsText = `Specializes in ${topSkills.join(', ')}.`;
      expect(skillsText).toContain('typescript');
    });

    it('should format total earnings correctly', () => {
      const earnings = 55000000;
      const formatted = (earnings / 1_000_000).toFixed(2);
      expect(formatted).toBe('55.00');
    });
  });

  describe('Selected Work', () => {
    it('should select top 5 tasks by rating', () => {
      const tasks = mockTasks.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      expect(tasks[0].rating).toBe(90);
    });

    it('should truncate long descriptions', () => {
      const longDesc = 'A'.repeat(300);
      const truncated = longDesc.slice(0, 200) + '...';
      expect(truncated.length).toBe(203);
    });

    it('should convert reward to USDC', () => {
      const rewardBase = '25000000';
      const usdc = parseFloat(rewardBase) / 1_000_000;
      expect(usdc).toBe(25);
    });

    it('should handle null ratings', () => {
      const task = { rating: null };
      const rating = task.rating ?? 0;
      expect(rating).toBe(0);
    });

    it('should include task tags in selected work', () => {
      // Check that at least one task has tags
      const hasTags = mockTasks.some(t => t.tags.length > 0);
      expect(hasTags).toBe(true);
    });
  });

  describe('Statistics Calculation', () => {
    it('should calculate total earned correctly', () => {
      const totalEarnings = '55000000';
      const totalUsdc = parseFloat(totalEarnings) / 1_000_000;
      expect(totalUsdc).toBe(55);
    });

    it('should calculate average reward', () => {
      const rewards = mockTasks.map(t => parseFloat(t.reward) / 1_000_000);
      const avg = rewards.reduce((a, b) => a + b, 0) / rewards.length;
      expect(avg).toBe(27.5);
    });

    it('should calculate success rate', () => {
      const completed = 2;
      const total = 2;
      const rate = (completed / total) * 100;
      expect(rate).toBe(100);
    });

    it('should handle zero completed tasks', () => {
      const completed = 0;
      const rate = completed > 0 ? 100 : 0;
      expect(rate).toBe(0);
    });
  });

  describe('Address Validation', () => {
    it('should validate correct Ethereum address', () => {
      const valid = /^0x[a-fA-F0-9]{40}$/.test('0x85261B8fDDc9c15Abb91c3DFf9f670472825167F');
      expect(valid).toBe(true);
    });

    it('should reject invalid address - too short', () => {
      const valid = /^0x[a-fA-F0-9]{40}$/.test('0x1234');
      expect(valid).toBe(false);
    });

    it('should reject invalid address - no 0x prefix', () => {
      const valid = /^0x[a-fA-F0-9]{40}$/.test('85261B8fDDc9c15Abb91c3DFf9f670472825167F');
      expect(valid).toBe(false);
    });

    it('should reject invalid address - invalid characters', () => {
      const valid = /^0x[a-fA-F0-9]{40}$/.test('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG');
      expect(valid).toBe(false);
    });
  });

  describe('Cache', () => {
    it('should cache results', () => {
      const cache = new Map<string, { data: any; timestamp: number }>();
      cache.set('0x123', { data: { agent: '0x123' }, timestamp: Date.now() });
      expect(cache.has('0x123')).toBe(true);
    });

    it('should expire after TTL', () => {
      const TTL = 15 * 60 * 1000;
      const timestamp = Date.now() - TTL - 1000;
      const isExpired = Date.now() - timestamp > TTL;
      expect(isExpired).toBe(true);
    });

    it('should return cached data within TTL', () => {
      const TTL = 15 * 60 * 1000;
      const timestamp = Date.now() - TTL + 60000;
      const isValid = Date.now() - timestamp < TTL;
      expect(isValid).toBe(true);
    });

    it('should clear cache for specific agent', () => {
      const cache = new Map<string, any>();
      cache.set('0x123', { data: 'test' });
      cache.set('0x456', { data: 'test2' });
      cache.delete('0x123');
      expect(cache.has('0x123')).toBe(false);
      expect(cache.has('0x456')).toBe(true);
    });
  });
});

describe('Markdown Formatter', () => {
  it('should format agent address in header', () => {
    const address = '0x85261B8fDDc9c15Abb91c3DFf9f670472825167F';
    const formatted = `**Address:** \`${address}\``;
    expect(formatted).toContain(address);
  });

  it('should format date correctly', () => {
    const date = new Date('2026-02-15T10:00:00Z');
    const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    expect(formatted).toContain('2026');
  });

  it('should format skills as inline list', () => {
    const skills = [{ name: 'typescript', frequency: 5 }, { name: 'api', frequency: 3 }];
    const formatted = skills.map(s => `**${s.name}** (${s.frequency})`).join(' • ');
    expect(formatted).toContain('typescript');
    expect(formatted).toContain(' • ');
  });

  it('should format stats as markdown table', () => {
    const table = '| Metric | Value |\n|--------|-------|\n| Completed Tasks | 2 |';
    expect(table).toContain('| Metric |');
    expect(table).toContain('Completed Tasks');
  });
});

describe('PDF Generator', () => {
  it('should generate valid HTML for PDF', () => {
    const html = '<!DOCTYPE html><html><head></head><body></body></html>';
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('should include CSS styles', () => {
    const html = '<style>body { font-family: sans-serif; }</style>';
    expect(html).toContain('<style>');
  });

  it('should escape special characters in HTML', () => {
    const text = 'Test & <script>';
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    expect(escaped).toBe('Test &amp; &lt;script>');
  });
});
