import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (compatible; ShopifyGrader/1.0; +https://shopifystoregrader.com)';

export function isShopifyStore(html) {
  const indicators = [
    'cdn.shopify.com',
    'Shopify.theme',
    'shopify-section',
    'myshopify.com',
    'shopify-features',
    'content_for_header'
  ];
  return indicators.some(indicator => html.includes(indicator));
}

export async function fetchAndParse(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    return { html, $, finalUrl: response.url };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 15 seconds');
    }
    throw err;
  }
}
