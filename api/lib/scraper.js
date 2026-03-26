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

export function isHeadlessShopify(html, headers) {
  const headlessIndicators = [
    'shopify.com/storefront',
    'shopify-storefront',
    'shopify-pay',
    'shop.app',
    'shopifycloud.com',
    '@shopify/hydrogen',
    'shopify-analytics',
    'shopify_pay_integration',
  ];
  const headersStr = headers ? JSON.stringify(Object.fromEntries(headers)) : '';
  const combined = html + headersStr;
  return headlessIndicators.some(indicator => combined.toLowerCase().includes(indicator.toLowerCase()));
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
      const status = response.status;
      let msg;
      if (status === 429) msg = 'This store is blocking our requests. Try again in a few minutes.';
      else if (status === 403) msg = 'This store is blocking external access.';
      else if (status === 503 || status === 500) msg = 'The store is temporarily unavailable. Try again later.';
      else msg = `Could not reach the store (HTTP ${status}).`;
      const err = new Error(msg);
      err.isUserFacing = true;
      throw err;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    return { html, $, finalUrl: response.url, headers: response.headers };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 15 seconds');
    }
    throw err;
  }
}
