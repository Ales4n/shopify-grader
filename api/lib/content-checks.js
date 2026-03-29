// Content checks: 3 automated + 3 AI (Phase 2)
// With API key:    about(3) + reviews(4) + blog(3) + homepage_copy(5) + product_desc(5) + cta(5) = 25 pts
// Without API key: automated only, scaled to /25 (Phase 1 fallback)

import { load } from 'cheerio';

const AI_TIMEOUT_MS = 5000;

async function callOpenAI(apiKey, systemPrompt, userContent) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 200,
        temperature: 0.3
      }),
      signal: controller.signal
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    // GPT sometimes wraps JSON in markdown code fences — strip before parsing
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } finally {
    clearTimeout(timer);
  }
}

const aiFallback = (id, name, maxScore) => ({
  id, name, maxScore, score: 2, status: 'warn', details: 'AI analysis unavailable', recommendation: null
});

async function checkHomepageCopy(apiKey, $) {
  const base = { id: 'content_homepage_copy', name: 'Homepage copy quality', maxScore: 5 };
  try {
    const bodyText = $('body').text()
      .replace(/[\t\r\n]+/g, ' ')   // collapse tabs and newlines
      .replace(/\s{2,}/g, ' ')      // collapse multiple spaces
      .replace(/[^\x20-\x7E\u00C0-\u024F]/g, '') // strip non-latin/control chars
      .trim()
      .slice(0, 1500);
    console.log('Homepage text length:', bodyText.length);
    const systemPrompt = 'You are an eCommerce copywriting expert. Analyze the following homepage text from a Shopify store. Score it from 0 to 5 based on: clarity of value proposition, persuasive language, brand voice consistency, and call-to-action presence. Respond ONLY with a JSON object: {"score": N, "status": "pass|warn|fail", "details": "one sentence summary", "recommendation": "one sentence actionable tip or null if score >= 4"}';
    const result = await callOpenAI(apiKey, systemPrompt, bodyText);
    return { ...base, score: result.score, status: result.status, details: result.details, recommendation: result.recommendation ?? null };
  } catch (err) {
    console.log('Homepage AI error:', err);
    return aiFallback(base.id, base.name, base.maxScore);
  }
}

async function checkProductDescription(apiKey, $, baseUrl) {
  const base = { id: 'content_product_desc', name: 'Product description quality', maxScore: 5 };
  try {
    // Find a product URL in the homepage links
    let productUrl = null;
    $('a[href]').each((_, el) => {
      if (productUrl) return false;
      const href = $(el).attr('href') || '';
      if (href.includes('/products/') && !href.match(/\/products\/?$/)) {
        productUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
      }
    });

    if (!productUrl) {
      return { ...base, score: 2, status: 'warn', details: 'Could not find a product page to analyze.', recommendation: 'Ensure products are linked from the homepage for easy discovery.' };
    }

    // Fetch the product page
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    let productHtml;
    try {
      const res = await fetch(productUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShopifyGrader/1.0; +https://shopifystoregrader.com)' },
        signal: controller.signal
      });
      productHtml = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const $p = load(productHtml);

    // Extract product description text, trying several selector patterns
    let desc = $p('.product-description, .product__description').first().text().trim();
    if (!desc) {
      $p('[class*="product"]').find('[class*="description"]').each((_, el) => {
        if (!desc) desc = $p(el).text().trim();
      });
    }
    if (!desc) {
      let maxLen = 0;
      $p('main p, .main-content p, #MainContent p').each((_, el) => {
        const t = $p(el).text().trim();
        if (t.length > maxLen) { maxLen = t.length; desc = t; }
      });
    }

    if (!desc || desc.length < 30) {
      return { ...base, score: 1, status: 'fail', details: 'Product description appears empty or very short.', recommendation: 'Write detailed product descriptions focused on benefits. Aim for 150-300 words per product.' };
    }

    const systemPrompt = 'You are an eCommerce copywriting expert. Analyze this product description from a Shopify store. Score from 0 to 5 based on: does it sell benefits (not just features), readability, detail level, and emotional appeal. Respond ONLY with JSON: {"score": N, "status": "pass|warn|fail", "details": "one sentence", "recommendation": "one sentence or null"}';
    const result = await callOpenAI(apiKey, systemPrompt, desc.slice(0, 2000));
    return { ...base, score: result.score, status: result.status, details: result.details, recommendation: result.recommendation ?? null };
  } catch (_) {
    return aiFallback(base.id, base.name, base.maxScore);
  }
}

async function checkCtaEffectiveness(apiKey, $) {
  const base = { id: 'content_cta', name: 'CTA effectiveness', maxScore: 5 };
  try {
    const seen = new Set();
    const ctaTexts = [];
    $('a.btn, button, [class*="cta"], [class*="button"], .shopify-payment-button, [class*="add-to-cart"]').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t && t.length > 1 && t.length < 80 && !seen.has(t)) {
        seen.add(t);
        ctaTexts.push(t);
      }
    });

    if (ctaTexts.length === 0) {
      return { ...base, score: 0, status: 'fail', details: 'No CTA buttons or action elements detected.', recommendation: 'Add clear call-to-action buttons above the fold guiding visitors to the next step.' };
    }

    const systemPrompt = 'You are a CRO expert. Here are the main CTAs/buttons found on a Shopify store homepage. Score from 0 to 5 based on: clarity, action-orientation, urgency, and variety. Respond ONLY with JSON: {"score": N, "status": "pass|warn|fail", "details": "one sentence", "recommendation": "one sentence or null"}';
    const result = await callOpenAI(apiKey, systemPrompt, ctaTexts.slice(0, 20).join('\n'));
    return { ...base, score: result.score, status: result.status, details: result.details, recommendation: result.recommendation ?? null };
  } catch (_) {
    return aiFallback(base.id, base.name, base.maxScore);
  }
}

export async function runContentChecks($, html, baseUrl, openAiKey) {
  const allLinks = [];
  $('a[href]').each((_, el) => allLinks.push(($(el).attr('href') || '').toLowerCase()));
  const htmlLower = html.toLowerCase();

  // 1. About page (3 pts)
  const hasAbout = allLinks.some(l =>
    l.includes('/pages/about') || l.includes('/about') ||
    l.includes('nosotros') || l.includes('quienes-somos') || l.includes('about-us')
  );
  const aboutCheck = hasAbout
    ? { id: 'content_about', name: 'About page', maxScore: 3, status: 'pass', score: 3, details: 'About page linked in navigation or footer.', recommendation: null }
    : { id: 'content_about', name: 'About page', maxScore: 3, status: 'fail', score: 0, details: 'No About page link detected.', recommendation: 'Add an About page telling your story. Customers trust stores with a clear brand story — it significantly improves conversion rates.' };

  // 2. Social proof / reviews (4 pts)
  const reviewSignals = [
    'judge.me', 'yotpo', 'stamped', 'okendo', 'loox', 'reviews.io',
    'data-product-reviews', 'product-reviews', 'shopify-product-reviews',
    'spr-container', 'jdgm-', 'yotpo-main-widget'
  ];
  const hasReviewApp = reviewSignals.some(s => htmlLower.includes(s));
  const reviewText = $('[class*="review"], [id*="review"], [class*="rating"], [id*="rating"]').length > 0;
  let reviewCheck;
  if (hasReviewApp) {
    reviewCheck = { id: 'content_reviews', name: 'Social proof (reviews)', maxScore: 4, status: 'pass', score: 4, details: 'Review app detected on the page.', recommendation: null };
  } else if (reviewText) {
    reviewCheck = { id: 'content_reviews', name: 'Social proof (reviews)', maxScore: 4, status: 'warn', score: 2, details: 'Review-related elements found but no dedicated review app detected.', recommendation: 'Install a dedicated review app like Judge.me (free) or Loox to collect and display verified customer reviews.' };
  } else {
    reviewCheck = { id: 'content_reviews', name: 'Social proof (reviews)', maxScore: 4, status: 'fail', score: 0, details: 'No reviews or social proof detected.', recommendation: 'Install a reviews app immediately. Social proof is the #1 driver of eCommerce conversions. Judge.me is free and excellent.' };
  }

  // 3. Blog (3 pts)
  const hasBlog = allLinks.some(l => l.includes('/blogs/') || l.includes('/blog')) ||
    $('a[href*="blog"]').length > 0;
  const blogCheck = hasBlog
    ? { id: 'content_blog', name: 'Blog / content hub', maxScore: 3, status: 'pass', score: 3, details: 'Blog or content section linked.', recommendation: null }
    : { id: 'content_blog', name: 'Blog / content hub', maxScore: 3, status: 'fail', score: 0, details: 'No blog or content section detected.', recommendation: 'Start a blog with 4-6 posts per month. Content marketing drives organic traffic and builds brand authority.' };

  const automatedChecks = [aboutCheck, reviewCheck, blogCheck];

  // No API key → Phase 1 fallback (scale automated checks to /25)
  if (!openAiKey) {
    const rawScore = automatedChecks.reduce((s, c) => s + c.score, 0);
    const rawMax = automatedChecks.reduce((s, c) => s + c.maxScore, 0);
    const score = rawMax > 0 ? Math.round((rawScore / rawMax) * 25) : 0;
    return { score, max: 25, checks: automatedChecks, meta: { phase1Only: true } };
  }

  // Run AI checks in parallel
  const [homepageResult, productResult, ctaResult] = await Promise.all([
    checkHomepageCopy(openAiKey, $),
    checkProductDescription(openAiKey, $, baseUrl),
    checkCtaEffectiveness(openAiKey, $),
  ]);

  const allChecks = [...automatedChecks, homepageResult, productResult, ctaResult];
  const score = allChecks.reduce((s, c) => s + c.score, 0);
  const max = allChecks.reduce((s, c) => s + c.maxScore, 0); // 25

  return { score, max, checks: allChecks };
}
