import { config } from 'dotenv';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

import { generateCV, getCacheStatus, clearCache } from './cv-generator';
import { formatMarkdown } from './formatter';
import { generatePDF } from './pdf-generator';

config();

const PORT = parseInt(process.env.PORT || '3404');
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS as `0x${string}`;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://facilitator.payai.network';
const NETWORK = process.env.NETWORK || 'eip155:8453'; // Base Mainnet

if (!PAYMENT_ADDRESS) {
  console.error('❌ PAYMENT_ADDRESS environment variable is required');
  process.exit(1);
}

const app = new Hono();

// CORS for API access
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Payment-Response', 'X-PAYMENT', 'PAYMENT-SIGNATURE'],
  exposeHeaders: ['X-Payment-Response', 'WWW-Authenticate', 'PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'],
}));

// Health check (FREE)
app.get('/health', (c) => {
  const cacheStatus = getCacheStatus();
  return c.json({
    status: 'ok',
    service: 'agent-cv',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    cache: cacheStatus,
  });
});

// Landing page
app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>AgentCV - AI Résumé Generator</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }
    h1 { color: #4ade80; }
    h2 { color: #e0e0e0; margin-top: 30px; }
    pre { background: #1a1a1a; padding: 15px; border-radius: 8px; overflow-x: auto; }
    code { color: #fbbf24; }
    .endpoint { background: #1a1a2e; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 3px solid #4ade80; }
    .price { color: #60a5fa; font-weight: bold; }
    a { color: #60a5fa; }
  </style>
</head>
<body>
  <h1>📄 AgentCV</h1>
  <p>Generates professional résumés for TaskMarket agents from their public history using x402 micropayments.</p>
  
  <h2>Endpoints</h2>
  
  <div class="endpoint">
    <h3>GET /v1/cv/:agentId</h3>
    <p>Full CV in JSON format with stats, task history, and AI-generated summary.</p>
    <p>Price: <span class="price">$0.003 USDC</span> per call</p>
    <pre><code>curl https://demos.zeh.app/agent-cv/v1/cv/0x1234...abcd</code></pre>
  </div>
  
  <div class="endpoint">
    <h3>GET /v1/cv/:agentId/markdown</h3>
    <p>CV formatted as Markdown, ready to paste or render.</p>
    <p>Price: <span class="price">$0.002 USDC</span> per call</p>
    <pre><code>curl https://demos.zeh.app/agent-cv/v1/cv/0x1234...abcd/markdown</code></pre>
  </div>
  
  <div class="endpoint">
    <h3>GET /v1/cv/:agentId/pdf</h3>
    <p>CV as a downloadable PDF document.</p>
    <p>Price: <span class="price">$0.005 USDC</span> per call</p>
    <pre><code>curl https://demos.zeh.app/agent-cv/v1/cv/0x1234...abcd/pdf -o cv.pdf</code></pre>
  </div>
  
  <div class="endpoint">
    <h3>GET /health</h3>
    <p>Health check endpoint.</p>
    <p>Price: <span class="price">FREE</span></p>
  </div>
  
  <h2>x402 Payment</h2>
  <p>Payments are handled via the x402 protocol on Base mainnet (USDC).</p>
  <p>Payment address: <code>${PAYMENT_ADDRESS}</code></p>
  <p>Network: <code>${NETWORK}</code></p>
  
  <h2>Source</h2>
  <p><a href="https://github.com/Catorpilor/agent-cv">GitHub Repository</a></p>
</body>
</html>`;
  return c.html(html);
});

// Agent manifest for xgate.run discovery
app.get('/.well-known/agent.json', (c) => {
  return c.json({
    name: 'AgentCV',
    version: '1.0.0',
    description: 'Generates professional résumés for TaskMarket agents from their public history',
    payment: {
      network: NETWORK,
      address: PAYMENT_ADDRESS,
      facilitator: FACILITATOR_URL,
    },
    endpoints: [
      {
        path: '/v1/cv/:agentId',
        method: 'GET',
        price: '$0.003 USDC',
        description: 'Full CV in JSON format',
      },
      {
        path: '/v1/cv/:agentId/markdown',
        method: 'GET',
        price: '$0.002 USDC',
        description: 'CV in Markdown format',
      },
      {
        path: '/v1/cv/:agentId/pdf',
        method: 'GET',
        price: '$0.005 USDC',
        description: 'CV as downloadable PDF',
      },
    ],
    contact: 'https://github.com/Catorpilor/agent-cv',
  });
});

// Setup x402 payment middleware
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

const paidRoutes = {
  'GET /v1/cv/*/markdown': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.002',
        network: NETWORK,
        payTo: PAYMENT_ADDRESS,
      },
    ],
    description: 'CV in Markdown format ($0.002 USDC)',
    mimeType: 'text/markdown',
  },
  'GET /v1/cv/*/pdf': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.005',
        network: NETWORK,
        payTo: PAYMENT_ADDRESS,
      },
    ],
    description: 'CV as downloadable PDF ($0.005 USDC)',
    mimeType: 'application/pdf',
  },
  'GET /v1/cv/*': {
    accepts: [
      {
        scheme: 'exact',
        price: '$0.003',
        network: NETWORK,
        payTo: PAYMENT_ADDRESS,
      },
    ],
    description: 'Full CV in JSON format ($0.003 USDC)',
    mimeType: 'application/json',
  },
};

const evmScheme = new ExactEvmScheme();
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, evmScheme);

// Apply payment middleware
app.use(paymentMiddleware(paidRoutes, resourceServer));

// Validate agent ID (0x address)
const validateAgentId = (agentId: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(agentId);
};

// GET /v1/cv/:agentId - Full JSON CV ($0.003)
app.get('/v1/cv/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  
  if (!validateAgentId(agentId)) {
    return c.json({ error: 'Invalid agent ID. Must be a valid Ethereum address.' }, 422);
  }

  try {
    const cv = await generateCV(agentId);
    return c.json({
      ok: true,
      data: cv,
      freshness: {
        generatedAt: cv.generatedAt,
        cacheTtlMs: 15 * 60 * 1000,
      },
    });
  } catch (error) {
    console.error('CV generation error:', error);
    return c.json({ error: 'Failed to generate CV', details: String(error) }, 500);
  }
});

// GET /v1/cv/:agentId/markdown - Markdown CV ($0.002)
app.get('/v1/cv/:agentId/markdown', async (c) => {
  const agentId = c.req.param('agentId');
  
  if (!validateAgentId(agentId)) {
    return c.json({ error: 'Invalid agent ID. Must be a valid Ethereum address.' }, 422);
  }

  try {
    const cv = await generateCV(agentId);
    const markdown = formatMarkdown(cv);
    
    return c.text(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
    });
  } catch (error) {
    console.error('Markdown generation error:', error);
    return c.json({ error: 'Failed to generate CV', details: String(error) }, 500);
  }
});

// GET /v1/cv/:agentId/pdf - PDF CV ($0.005)
app.get('/v1/cv/:agentId/pdf', async (c) => {
  const agentId = c.req.param('agentId');
  
  if (!validateAgentId(agentId)) {
    return c.json({ error: 'Invalid agent ID. Must be a valid Ethereum address.' }, 422);
  }

  try {
    const cv = await generateCV(agentId);
    const pdfBuffer = await generatePDF(cv);
    
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="agent-cv-${agentId.slice(0, 10)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return c.json({ error: 'Failed to generate PDF', details: String(error) }, 500);
  }
});

// Export for Bun/Lucid
export default {
  port: PORT,
  fetch: app.fetch,
};

// Start server
console.log(`🤖 AgentCV running on http://localhost:${PORT}`);
console.log(`💰 Payment address: ${PAYMENT_ADDRESS}`);
console.log(`🔗 Network: ${NETWORK}`);
