// Diagnostic tool: run the real scraper + checks against a store and dump what
// the analyzer actually sees (links, nav, check outcomes). Helps trace detection
// misses reported by users without touching production.
//
// Usage: node scripts/debug-store.mjs https://mystore.com

import { fetchAndParse, isShopifyStore } from '../api/lib/scraper.js';
import { collectLinks } from '../api/lib/detect-utils.js';
import { runSeoChecks } from '../api/lib/seo-checks.js';
import { runShopifyChecks } from '../api/lib/shopify-checks.js';
import { runContentChecks } from '../api/lib/content-checks.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/debug-store.mjs <store-url>');
  process.exit(1);
}

const { html, $, finalUrl } = await fetchAndParse(url.startsWith('http') ? url : `https://${url}`);

console.log('=== FETCH ===');
console.log('finalUrl:', finalUrl);
console.log('htmlLength:', html.length);
console.log('isShopifyStore:', isShopifyStore(html));

console.log('\n=== LINKS (href | text) ===');
for (const { href, text } of collectLinks($)) {
  console.log(`${href} | ${text}`);
}

console.log('\n=== CHECK RESULTS ===');
const seo = runSeoChecks($, html);
const shopify = runShopifyChecks($, html);
const content = await runContentChecks($, html, finalUrl, null);
for (const check of [...seo.checks, ...shopify.checks, ...content.checks]) {
  console.log(`[${check.status.toUpperCase()}] ${check.id} (${check.score}/${check.maxScore}) — ${check.details}`);
}
