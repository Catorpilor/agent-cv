import puppeteer from 'puppeteer';
import type { AgentCV } from './types';
import { formatHTML } from './formatter';

let browserInstance: puppeteer.Browser | null = null;

// Use browserless in docker, local chromium otherwise
const BROWSERLESS_URL = process.env.BROWSERLESS_URL;

async function getBrowser(): Promise<puppeteer.Browser> {
  if (!browserInstance || !browserInstance.connected) {
    if (BROWSERLESS_URL) {
      // Connect to browserless service
      browserInstance = await puppeteer.connect({
        browserWSEndpoint: BROWSERLESS_URL,
      });
    } else {
      // Launch local browser
      browserInstance = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
  }
  return browserInstance;
}

export async function generatePDF(cv: AgentCV): Promise<Buffer> {
  const html = formatHTML(cv);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
