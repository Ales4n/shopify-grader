import { fetchAndParse, isShopifyStore, isHeadlessShopify, looksLikeBotChallenge } from './lib/scraper.js';
import { collectLinks } from './lib/detect-utils.js';
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
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname;
    // Require a public-looking hostname; block internal targets (localhost, private IPs)
    if (!host.includes('.') || host.includes(':')) return false;
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const a = Number(ipv4[1]), b = Number(ipv4[2]);
      if (a === 0 || a === 10 || a === 127 || a >= 224 ||
          (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
          (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

function isPasswordPage(finalUrl) {
  try {
    return new URL(finalUrl).pathname.replace(/\/+$/, '').endsWith('/password');
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

  // GET with ?url= is supported for debugging/manual testing; add &debug=1 to see
  // the links the analyzer actually found (helps diagnose detection misses)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const rawUrl = req.method === 'GET' ? req.query?.url : body?.url;
  const debugMode = req.method === 'GET' && req.query?.debug === '1';
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'Please enter a valid URL (e.g., mystore.com)' });
  }

  const url = normalizeUrl(rawUrl);
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid URL (e.g., mystore.com)' });
  }

  const apiKey = process.env.PAGESPEED_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  try {
    const { html, $, finalUrl, headers } = await fetchAndParse(url);

    if (!isShopifyStore(html)) {
      if (looksLikeBotChallenge(html)) {
        return res.status(422).json({
          error: "This store's bot protection blocked our request. Try again in a few minutes.",
          isShopify: null
        });
      }
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

    // Shopify redirects locked storefronts to /password — analyzing that page produces a bogus report
    if (isPasswordPage(finalUrl || url)) {
      return res.status(422).json({
        error: 'This store is password-protected, so we can only see its password page. Remove the password (or try again after launch) to get a full report.',
        isShopify: true,
        isPasswordProtected: true
      });
    }

    const [seoResult, perfResult, shopifyResult, contentResult] = await Promise.all([
      Promise.resolve(runSeoChecks($, html)),
      runPerformanceChecks($, finalUrl || url, apiKey),
      Promise.resolve(runShopifyChecks($, html)),
      runContentChecks($, html, finalUrl || url, openAiKey),
    ]);

    const categories = {
      seo: { score: seoResult.score, max: seoResult.max, checks: seoResult.checks },
      performance: { score: perfResult.score, max: perfResult.max, checks: perfResult.checks },
      shopify: { score: shopifyResult.score, max: shopifyResult.max, checks: shopifyResult.checks },
      content: { score: contentResult.score, max: contentResult.max, checks: contentResult.checks },
    };

    const { total, grade } = aggregateScores(categories);

    if (debugMode) {
      return res.status(200).json({
        url: finalUrl || url,
        isShopify: true,
        analyzedAt: new Date().toISOString(),
        score: { total, grade, categories },
        debugLinks: collectLinks($).slice(0, 300),
      });
    }

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
    if (err.message?.includes('timed out') || err.name === 'AbortError') {
      return res.status(504).json({ error: 'Analysis is taking longer than expected. Try again in a minute.' });
    }
    const netCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH',
      'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT'];
    const errCode = err.code || err.cause?.code;
    if (netCodes.includes(errCode) || err.name === 'FetchError' || err.message?.includes('fetch failed') || err.message?.includes('redirect')) {
      return res.status(422).json({ error: "We couldn't reach this website. Check the URL and try again." });
    }
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}
