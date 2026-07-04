import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const FETCH_TIMEOUT_MS = 15000;

// Realistic browser User-Agents. WAFs (Cloudflare, bot protection apps) routinely
// block "bot-style" UAs like "compatible; ShopifyGrader/1.0", which made many
// legitimate stores return 403 or a challenge page.
const PRIMARY_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FALLBACK_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

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

// Anti-bot challenge pages (Cloudflare, DDoS-Guard, PerimeterX…) return 200 with
// no Shopify markup, which previously produced a misleading "not a Shopify store" error.
export function looksLikeBotChallenge(html) {
  const signals = [
    'just a moment',
    'attention required! | cloudflare',
    'cf-chl',
    'cdn-cgi/challenge-platform',
    'ddos-guard',
    'px-captcha',
    'turnstile',
    'verify you are human',
  ];
  const lower = html.toLowerCase();
  return signals.some(s => lower.includes(s));
}

function userFacingError(msg) {
  const err = new Error(msg);
  err.isUserFacing = true;
  return err;
}

async function fetchWithTimeout(url, userAgent) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAndParse(url) {
  let response = await fetchWithTimeout(url, PRIMARY_UA);

  // Some WAFs block one browser fingerprint but accept another — retry once before giving up.
  if (response.status === 403 || response.status === 429 || response.status === 503) {
    try {
      const retry = await fetchWithTimeout(url, FALLBACK_UA);
      if (retry.ok) response = retry;
    } catch (_) { /* keep the original response for error reporting */ }
  }

  if (!response.ok) {
    const status = response.status;
    let msg;
    if (status === 429) msg = 'This store is blocking our requests. Try again in a few minutes.';
    else if (status === 403) msg = 'This store is blocking external access.';
    else if (status === 503 || status === 500) msg = 'The store is temporarily unavailable. Try again later.';
    else if (status === 404) msg = 'This page was not found (HTTP 404). Check the URL and try again.';
    else msg = `Could not reach the store (HTTP ${status}).`;
    throw userFacingError(msg);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType && !/html|text|xml/i.test(contentType)) {
    throw userFacingError("This URL doesn't point to a web page. Enter your store's homepage URL (e.g., mystore.com).");
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  return { html, $, finalUrl: response.url, headers: response.headers };
}
