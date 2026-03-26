import fetch from 'node-fetch';

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

async function callPageSpeed(url, strategy, apiKey) {
  const params = new URLSearchParams({ url, strategy, category: 'performance' });
  if (apiKey) params.set('key', apiKey);
  const res = await fetch(`${PAGESPEED_API}?${params}`);
  if (!res.ok) throw new Error(`PageSpeed API returned ${res.status}`);
  return res.json();
}

function getAuditValue(data, auditId) {
  return data?.lighthouseResult?.audits?.[auditId];
}

export async function runPerformanceChecks($, html, url, apiKey) {
  const checks = [];

  // 7. Viewport meta (3 pts) — no API needed
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  let vpCheck = { id: 'perf_viewport', name: 'Mobile viewport meta', maxScore: 3 };
  if (viewport.includes('width=device-width')) {
    vpCheck = { ...vpCheck, status: 'pass', score: 3, details: `Viewport: "${viewport}"`, recommendation: null };
  } else if (viewport) {
    vpCheck = { ...vpCheck, status: 'warn', score: 1, details: `Viewport tag present but may be incomplete: "${viewport}"`, recommendation: 'Set viewport to: width=device-width, initial-scale=1' };
  } else {
    vpCheck = { ...vpCheck, status: 'fail', score: 0, details: 'No viewport meta tag found.', recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your theme.' };
  }
  checks.push(vpCheck);

  // HTTPS check (2 pts) — no API needed
  let httpsCheck = { id: 'perf_https', name: 'HTTPS', maxScore: 2 };
  if (url.startsWith('https://')) {
    httpsCheck = { ...httpsCheck, status: 'pass', score: 2, details: 'Site is served over HTTPS.', recommendation: null };
  } else {
    httpsCheck = { ...httpsCheck, status: 'fail', score: 0, details: 'Site is not using HTTPS.', recommendation: 'Enable HTTPS. Shopify provides free SSL for all stores — check your domain settings.' };
  }
  checks.push(httpsCheck);

  // Image optimization check (4 pts) — from HTML
  const imgs = $('img');
  let lazyCount = 0;
  let modernFormatCount = 0;
  let totalCheckedImgs = 0;
  imgs.each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const loading = $(el).attr('loading');
    if (src) {
      totalCheckedImgs++;
      if (loading === 'lazy') lazyCount++;
      if (src.includes('.webp') || src.includes('.avif') || src.includes('format=webp') || src.includes('&format=')) modernFormatCount++;
    }
  });
  const lazyPct = totalCheckedImgs > 0 ? (lazyCount / totalCheckedImgs) * 100 : 0;
  const modernPct = totalCheckedImgs > 0 ? (modernFormatCount / totalCheckedImgs) * 100 : 0;
  let imgOptCheck = { id: 'perf_img_opt', name: 'Image optimization', maxScore: 4 };
  if (totalCheckedImgs === 0) {
    imgOptCheck = { ...imgOptCheck, status: 'warn', score: 2, details: 'No images detected.', recommendation: null };
  } else if (lazyPct >= 50 && modernPct >= 30) {
    imgOptCheck = { ...imgOptCheck, status: 'pass', score: 4, details: `${lazyCount}/${totalCheckedImgs} images lazy-loaded, ${modernFormatCount} using modern formats.`, recommendation: null };
  } else if (lazyPct >= 30 || modernPct >= 10) {
    imgOptCheck = { ...imgOptCheck, status: 'warn', score: 2, details: `${lazyCount}/${totalCheckedImgs} images lazy-loaded, ${modernFormatCount} using WebP/AVIF.`, recommendation: 'Add loading="lazy" to below-the-fold images and use WebP format where possible.' };
  } else {
    imgOptCheck = { ...imgOptCheck, status: 'fail', score: 0, details: `Only ${lazyCount}/${totalCheckedImgs} images are lazy-loaded and ${modernFormatCount} use modern formats.`, recommendation: 'Enable lazy loading on images and convert to WebP format to significantly improve page speed.' };
  }
  checks.push(imgOptCheck);

  // PageSpeed API checks
  let mobileData = null;
  let desktopData = null;
  let apiError = null;

  try {
    [mobileData, desktopData] = await Promise.all([
      callPageSpeed(url, 'mobile', apiKey),
      callPageSpeed(url, 'desktop', apiKey),
    ]);
  } catch (err) {
    apiError = err.message;
  }

  if (apiError || !mobileData) {
    // Fallback: no PageSpeed data
    const fallback = (id, name, max) => ({
      id, name, status: 'warn', score: Math.floor(max / 2), maxScore: max,
      details: 'PageSpeed data unavailable — scored at 50%.', recommendation: null
    });
    checks.push(fallback('perf_mobile', 'Mobile PageSpeed score', 5));
    checks.push(fallback('perf_desktop', 'Desktop PageSpeed score', 3));
    checks.push(fallback('perf_lcp', 'Largest Contentful Paint (LCP)', 4));
    checks.push(fallback('perf_cls', 'Cumulative Layout Shift (CLS)', 4));
    const score = checks.reduce((s, c) => s + c.score, 0);
    const max = checks.reduce((s, c) => s + c.maxScore, 0);
    return { score, max, checks, meta: { apiError } };
  }

  const mobileScore = mobileData.lighthouseResult?.categories?.performance?.score * 100;
  const desktopScore = desktopData.lighthouseResult?.categories?.performance?.score * 100;

  // Mobile score (5 pts)
  let mobileCheck = { id: 'perf_mobile', name: 'Mobile PageSpeed score', maxScore: 5 };
  if (mobileScore >= 90) {
    mobileCheck = { ...mobileCheck, status: 'pass', score: 5, details: `Mobile score: ${Math.round(mobileScore)}/100`, recommendation: null };
  } else if (mobileScore >= 50) {
    mobileCheck = { ...mobileCheck, status: 'warn', score: 3, details: `Mobile score: ${Math.round(mobileScore)}/100`, recommendation: `Improve mobile performance. Score is ${Math.round(mobileScore)} — target 90+.` };
  } else {
    mobileCheck = { ...mobileCheck, status: 'fail', score: 0, details: `Mobile score: ${Math.round(mobileScore)}/100 — critical.`, recommendation: 'Mobile performance is critically low. Compress images, reduce JavaScript, and enable caching.' };
  }
  checks.push(mobileCheck);

  // Desktop score (3 pts)
  let desktopCheck = { id: 'perf_desktop', name: 'Desktop PageSpeed score', maxScore: 3 };
  if (desktopScore >= 90) {
    desktopCheck = { ...desktopCheck, status: 'pass', score: 3, details: `Desktop score: ${Math.round(desktopScore)}/100`, recommendation: null };
  } else if (desktopScore >= 50) {
    desktopCheck = { ...desktopCheck, status: 'warn', score: 2, details: `Desktop score: ${Math.round(desktopScore)}/100`, recommendation: `Desktop score is ${Math.round(desktopScore)}. Target 90+.` };
  } else {
    desktopCheck = { ...desktopCheck, status: 'fail', score: 0, details: `Desktop score: ${Math.round(desktopScore)}/100`, recommendation: 'Reduce render-blocking resources and minimize CSS/JS to improve desktop speed.' };
  }
  checks.push(desktopCheck);

  // LCP (4 pts)
  const lcpAudit = getAuditValue(mobileData, 'largest-contentful-paint');
  const lcpValue = lcpAudit?.numericValue ? lcpAudit.numericValue / 1000 : null;
  let lcpCheck = { id: 'perf_lcp', name: 'Largest Contentful Paint (LCP)', maxScore: 4 };
  if (lcpValue === null) {
    lcpCheck = { ...lcpCheck, status: 'warn', score: 2, details: 'LCP data unavailable.', recommendation: null };
  } else if (lcpValue <= 2.5) {
    lcpCheck = { ...lcpCheck, status: 'pass', score: 4, details: `LCP: ${lcpValue.toFixed(1)}s (Good ≤2.5s)`, recommendation: null };
  } else if (lcpValue <= 4) {
    lcpCheck = { ...lcpCheck, status: 'warn', score: 2, details: `LCP: ${lcpValue.toFixed(1)}s (Needs improvement)`, recommendation: `LCP is ${lcpValue.toFixed(1)}s. Optimize your hero image — use WebP, preload it, and reduce its file size.` };
  } else {
    lcpCheck = { ...lcpCheck, status: 'fail', score: 0, details: `LCP: ${lcpValue.toFixed(1)}s (Poor >4s)`, recommendation: 'LCP is critically slow. Your hero image or main content is loading too slowly. Compress images and remove render-blocking scripts.' };
  }
  checks.push(lcpCheck);

  // CLS (4 pts)
  const clsAudit = getAuditValue(mobileData, 'cumulative-layout-shift');
  const clsValue = clsAudit?.numericValue ?? null;
  let clsCheck = { id: 'perf_cls', name: 'Cumulative Layout Shift (CLS)', maxScore: 4 };
  if (clsValue === null) {
    clsCheck = { ...clsCheck, status: 'warn', score: 2, details: 'CLS data unavailable.', recommendation: null };
  } else if (clsValue <= 0.1) {
    clsCheck = { ...clsCheck, status: 'pass', score: 4, details: `CLS: ${clsValue.toFixed(3)} (Good ≤0.1)`, recommendation: null };
  } else if (clsValue <= 0.25) {
    clsCheck = { ...clsCheck, status: 'warn', score: 2, details: `CLS: ${clsValue.toFixed(3)} (Needs improvement)`, recommendation: 'Layout shifts detected. Add explicit width/height to images and avoid inserting content above existing content.' };
  } else {
    clsCheck = { ...clsCheck, status: 'fail', score: 0, details: `CLS: ${clsValue.toFixed(3)} (Poor >0.25)`, recommendation: 'Severe layout shifts. Ensure images have dimensions set and avoid dynamic content injection above the fold.' };
  }
  checks.push(clsCheck);

  const score = checks.reduce((s, c) => s + c.score, 0);
  const max = checks.reduce((s, c) => s + c.maxScore, 0);
  return {
    score, max, checks,
    meta: {
      mobileScore: Math.round(mobileScore),
      desktopScore: Math.round(desktopScore),
      lcp: lcpValue ? lcpValue.toFixed(1) : null,
      cls: clsValue !== null ? clsValue.toFixed(3) : null,
    }
  };
}
