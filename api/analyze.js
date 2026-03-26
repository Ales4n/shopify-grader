import { fetchAndParse, isShopifyStore, isHeadlessShopify } from './lib/scraper.js';
import { runSeoChecks } from './lib/seo-checks.js';
import { runPerformanceChecks } from './lib/performance.js';
import { runShopifyChecks } from './lib/shopify-checks.js';
import { runContentChecks } from './lib/content-checks.js';
import { aggregateScores } from './lib/scoring.js';

function normalizeUrl(input) {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  url = url.replace(/\/+$/, '');
  return url;
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const rawUrl = body?.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'Please enter a valid URL (e.g., mystore.com)' });
  }

  const url = normalizeUrl(rawUrl);
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid URL (e.g., mystore.com)' });
  }

  try {
    const { html, $, finalUrl, headers } = await fetchAndParse(url);

    if (!isShopifyStore(html)) {
      if (isHeadlessShopify(html, headers)) {
        return res.status(422).json({
          error: 'This appears to be a headless Shopify store (Hydrogen/custom frontend). Our tool currently only analyzes standard Shopify themes. Headless stores require a manual audit.',
          isShopify: true,
          isHeadless: true
        });
      }
      return res.status(422).json({
        error: "This doesn't appear to be a Shopify store. This tool only works with Shopify.",
        isShopify: false
      });
    }

    const apiKey = process.env.PAGESPEED_API_KEY;

    // Scraping is done. Now run HTML-based checks + PageSpeed API calls in parallel.
    // Inside runPerformanceChecks, the two PageSpeed calls (mobile + desktop) also run in parallel.
    const [seoResult, perfResult, shopifyResult, contentResult] = await Promise.all([
      Promise.resolve(runSeoChecks($, html)),
      runPerformanceChecks($, html, finalUrl || url, apiKey),
      Promise.resolve(runShopifyChecks($, html)),
      Promise.resolve(runContentChecks($, html)),
    ]);

    const categories = {
      seo: { score: seoResult.score, max: seoResult.max, checks: seoResult.checks },
      performance: { score: perfResult.score, max: perfResult.max, checks: perfResult.checks },
      shopify: { score: shopifyResult.score, max: shopifyResult.max, checks: shopifyResult.checks },
      content: { score: contentResult.score, max: contentResult.max, checks: contentResult.checks },
    };

    const { total, grade } = aggregateScores(categories);

    return res.status(200).json({
      url: finalUrl || url,
      isShopify: true,
      analyzedAt: new Date().toISOString(),
      score: {
        total,
        grade,
        categories,
      },
      meta: {
        theme: shopifyResult.meta?.theme || null,
        mobileScore: perfResult.meta?.mobileScore ?? null,
        desktopScore: perfResult.meta?.desktopScore ?? null,
        lcp: perfResult.meta?.lcp ?? null,
        cls: perfResult.meta?.cls ?? null,
        pageSpeedError: perfResult.meta?.apiError ?? null,
      }
    });

  } catch (err) {
    console.error('Analysis error:', err);
    if (err.isUserFacing) {
      return res.status(422).json({ error: err.message });
    }
    if (err.message?.includes('timed out') || err.message?.includes('AbortError')) {
      return res.status(504).json({ error: 'Analysis is taking longer than expected. Try again in a minute.' });
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.message?.includes('fetch')) {
      return res.status(422).json({ error: "We couldn't reach this website. Check the URL and try again." });
    }
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}
