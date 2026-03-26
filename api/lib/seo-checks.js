export function runSeoChecks($, html) {
  const checks = [];

  // 1. Title tag (4 pts)
  const title = $('title').first().text().trim();
  const titleLen = title.length;
  let titleCheck = { id: 'seo_title', name: 'Title tag', maxScore: 4 };
  if (!title) {
    titleCheck = { ...titleCheck, status: 'fail', score: 0, details: 'No title tag found.', recommendation: 'Add a unique, descriptive title tag between 50-60 characters.' };
  } else if (titleLen >= 50 && titleLen <= 60) {
    titleCheck = { ...titleCheck, status: 'pass', score: 4, details: `Title: "${title}" (${titleLen} chars)`, recommendation: null };
  } else if (titleLen >= 40 && titleLen <= 70) {
    titleCheck = { ...titleCheck, status: 'warn', score: 2, details: `Title: "${title}" (${titleLen} chars)`, recommendation: `Your title is ${titleLen} chars. Ideal length is 50-60 characters for best search display.` };
  } else {
    titleCheck = { ...titleCheck, status: 'fail', score: 0, details: `Title: "${title}" (${titleLen} chars)`, recommendation: `Your title is ${titleLen} chars. Keep it between 50-60 characters.` };
  }
  checks.push(titleCheck);

  // 2. Meta description (3 pts)
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const descLen = metaDesc.trim().length;
  let descCheck = { id: 'seo_meta_desc', name: 'Meta description', maxScore: 3 };
  if (!metaDesc.trim()) {
    descCheck = { ...descCheck, status: 'fail', score: 0, details: 'No meta description found.', recommendation: 'Add a meta description between 120-160 characters summarizing your store.' };
  } else if (descLen >= 120 && descLen <= 160) {
    descCheck = { ...descCheck, status: 'pass', score: 3, details: `Description: "${metaDesc.trim().substring(0, 80)}…" (${descLen} chars)`, recommendation: null };
  } else if ((descLen >= 100 && descLen < 120) || (descLen > 160 && descLen <= 180)) {
    descCheck = { ...descCheck, status: 'warn', score: 2, details: `Meta description is ${descLen} chars.`, recommendation: `Ideal meta description length is 120-160 characters (currently ${descLen}).` };
  } else {
    descCheck = { ...descCheck, status: 'fail', score: 0, details: `Meta description is ${descLen} chars.`, recommendation: `Meta description is too ${descLen < 100 ? 'short' : 'long'}. Target 120-160 characters.` };
  }
  checks.push(descCheck);

  // 3. H1 (4 pts)
  const h1s = $('h1');
  const h1Count = h1s.length;
  let h1Check = { id: 'seo_h1', name: 'H1 heading', maxScore: 4 };
  if (h1Count === 1) {
    h1Check = { ...h1Check, status: 'pass', score: 4, details: `H1: "${h1s.first().text().trim().substring(0, 60)}"`, recommendation: null };
  } else if (h1Count > 1) {
    h1Check = { ...h1Check, status: 'warn', score: 2, details: `Found ${h1Count} H1 tags — only one is recommended.`, recommendation: 'Use exactly one H1 per page. Multiple H1s dilute SEO signals.' };
  } else {
    h1Check = { ...h1Check, status: 'fail', score: 0, details: 'No H1 tag found on the homepage.', recommendation: 'Add a single H1 tag with your main keyword to your homepage.' };
  }
  checks.push(h1Check);

  // 4. Image alt text (4 pts)
  const allImgs = $('img');
  const totalImgs = allImgs.length;
  let imgsWithAlt = 0;
  allImgs.each((_, el) => {
    if ($(el).attr('alt') !== undefined && $(el).attr('alt') !== '') imgsWithAlt++;
  });
  const altPct = totalImgs > 0 ? (imgsWithAlt / totalImgs) * 100 : 100;
  let altCheck = { id: 'seo_img_alt', name: 'Image alt text', maxScore: 4 };
  if (totalImgs === 0) {
    altCheck = { ...altCheck, status: 'warn', score: 2, details: 'No images found on the page.', recommendation: null };
  } else if (altPct > 90) {
    altCheck = { ...altCheck, status: 'pass', score: 4, details: `${imgsWithAlt}/${totalImgs} images have alt text (${Math.round(altPct)}%)`, recommendation: null };
  } else if (altPct >= 50) {
    altCheck = { ...altCheck, status: 'warn', score: 2, details: `${imgsWithAlt}/${totalImgs} images have alt text (${Math.round(altPct)}%)`, recommendation: `${totalImgs - imgsWithAlt} images are missing alt text. Add descriptive alt attributes for better SEO and accessibility.` };
  } else {
    altCheck = { ...altCheck, status: 'fail', score: 0, details: `Only ${imgsWithAlt}/${totalImgs} images have alt text (${Math.round(altPct)}%)`, recommendation: 'Most images are missing alt text. Add descriptive alt attributes to all images.' };
  }
  checks.push(altCheck);

  // 5. Open Graph tags (3 pts)
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const ogCount = [ogTitle, ogImage, ogDesc].filter(Boolean).length;
  let ogCheck = { id: 'seo_og', name: 'Open Graph tags', maxScore: 3 };
  if (ogCount === 3) {
    ogCheck = { ...ogCheck, status: 'pass', score: 3, details: 'og:title, og:image, and og:description all present.', recommendation: null };
  } else if (ogCount >= 1) {
    const missing = ['og:title', 'og:image', 'og:description'].filter((tag, i) => ![ogTitle, ogImage, ogDesc][i]);
    ogCheck = { ...ogCheck, status: 'warn', score: 1, details: `${ogCount}/3 Open Graph tags present. Missing: ${missing.join(', ')}.`, recommendation: `Add the missing Open Graph tags to improve social media sharing previews.` };
  } else {
    ogCheck = { ...ogCheck, status: 'fail', score: 0, details: 'No Open Graph tags found.', recommendation: 'Add og:title, og:image, and og:description to improve how your store looks when shared on social media.' };
  }
  checks.push(ogCheck);

  // 6. Structured data / JSON-LD (4 pts)
  let hasProductSchema = false;
  let hasAnySchema = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      hasAnySchema = true;
      const types = Array.isArray(json) ? json.map(j => j['@type']) : [json['@type']];
      if (types.some(t => t === 'Product' || t === 'Store' || t === 'Organization')) hasProductSchema = true;
    } catch (_) {}
  });
  let schemaCheck = { id: 'seo_schema', name: 'Structured data (JSON-LD)', maxScore: 4 };
  if (hasProductSchema) {
    schemaCheck = { ...schemaCheck, status: 'pass', score: 4, details: 'Product or Store JSON-LD structured data found.', recommendation: null };
  } else if (hasAnySchema) {
    schemaCheck = { ...schemaCheck, status: 'warn', score: 2, details: 'JSON-LD found but no Product/Store schema detected.', recommendation: 'Add Product schema markup to your product pages to enable rich results in Google.' };
  } else {
    schemaCheck = { ...schemaCheck, status: 'fail', score: 0, details: 'No JSON-LD structured data found.', recommendation: 'Add JSON-LD structured data (Product, Organization) to improve search result appearance.' };
  }
  checks.push(schemaCheck);

  // 7. Canonical URL (3 pts)
  const canonical = $('link[rel="canonical"]').attr('href');
  let canonicalCheck = { id: 'seo_canonical', name: 'Canonical URL', maxScore: 3 };
  if (!canonical) {
    canonicalCheck = { ...canonicalCheck, status: 'fail', score: 0, details: 'No canonical URL tag found.', recommendation: 'Add a <link rel="canonical"> tag to prevent duplicate content issues.' };
  } else if (canonical.startsWith('http')) {
    canonicalCheck = { ...canonicalCheck, status: 'pass', score: 3, details: `Canonical: ${canonical}`, recommendation: null };
  } else {
    canonicalCheck = { ...canonicalCheck, status: 'warn', score: 1, details: `Canonical URL may be invalid: ${canonical}`, recommendation: 'Ensure the canonical URL is an absolute URL (starting with https://).' };
  }
  checks.push(canonicalCheck);

  const score = checks.reduce((sum, c) => sum + c.score, 0);
  const max = checks.reduce((sum, c) => sum + c.maxScore, 0);
  return { score, max, checks };
}
