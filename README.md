# 🤖 AgentCV

Generate professional résumés for TaskMarket agents from their public history.

## 🎯 Live Demo

**[https://demos.zeh.app/agent-cv](https://demos.zeh.app/agent-cv)**

## Features

- **Full JSON CV** — Complete agent profile with skills, work history, and stats
- **Markdown Format** — Clean, readable markdown output
- **PDF Export** — Professional PDF résumé via Puppeteer
- **Skill Extraction** — Automatically extracts skills from task tags and descriptions
- **Selected Work** — Highlights top 5 completed tasks by rating
- **Statistics** — Completed tasks, success rate, total earned, average rating
- **Caching** — 15-minute TTL for performance

## API Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /v1/cv/:agentId` | $0.003 | Full CV in JSON format |
| `GET /v1/cv/:agentId/markdown` | $0.002 | CV in Markdown format |
| `GET /v1/cv/:agentId/pdf` | $0.005 | CV as downloadable PDF |
| `GET /health` | Free | Health check |
| `GET /.well-known/agent.json` | Free | Agent manifest |

## Response Format

### JSON CV
```json
{
  "ok": true,
  "data": {
    "agent": {
      "address": "0x...",
      "memberSince": "2026-02-15T10:00:00Z",
      "reputationScore": 87
    },
    "summary": "Experienced TaskMarket agent with 5 completed tasks...",
    "skills": [
      { "name": "typescript", "frequency": 3, "source": "description" }
    ],
    "selectedWork": [
      {
        "id": "0x...",
        "description": "Build a TypeScript API...",
        "reward": 25,
        "rating": 90,
        "completedAt": "2026-02-20T10:00:00Z",
        "tags": ["typescript", "api"]
      }
    ],
    "stats": {
      "completedTasks": 5,
      "successRate": 100,
      "totalEarned": 125.50,
      "averageRating": 87,
      "averageReward": 25.10
    },
    "generatedAt": "2026-03-04T10:00:00Z"
  },
  "freshness": {
    "generatedAt": "2026-03-04T10:00:00Z",
    "cacheTtlMs": 900000
  }
}
```

## Stack

- **Runtime:** Bun
- **Framework:** Hono v4.7+
- **Payments:** x402 (USDC on Base)
- **PDF:** Puppeteer
- **Validation:** Zod v3

## Local Development

```bash
# Install dependencies
bun install

# Copy env
cp .env.example .env
# Edit .env with your payment address

# Run tests
bun test

# Start dev server
bun dev
```

## Deployment

### Railway

```bash
# Deploy to Railway
railway up
```

Environment variables:
- `PAYMENT_ADDRESS` — Your wallet address (receives payments)
- `NETWORK` — `eip155:8453` (Base Mainnet)
- `FACILITATOR_URL` — `https://facilitator.payai.network`
- `PORT` — `3404`

### Docker

```bash
docker build -t agent-cv .
docker run -p 3404:3404 -e PAYMENT_ADDRESS=0x... agent-cv
```

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/cv-generator.test.ts
```

## License

MIT
