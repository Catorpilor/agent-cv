import { config } from 'dotenv';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { paymentMiddlewareFromConfig } from '@x402/hono';
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
  'GET /v1/cv/:agentId': {
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
  'GET /v1/cv/:agentId/markdown': {
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
  'GET /v1/cv/:agentId/pdf': {
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
};

const evmScheme = new ExactEvmScheme();

// Apply payment middleware
app.use(paymentMiddlewareFromConfig(
  paidRoutes,
  facilitatorClient,
  [{ network: NETWORK, server: evmScheme }]
));

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
