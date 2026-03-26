// Phase 1: automated checks only (about page, reviews, blog)
// Phase 2: Claude API checks (homepage copy, product descriptions, CTAs)
// Phase 1 automated points (10 max) are scaled to /25 in scoring.js

export function runContentChecks($, html) {
  const checks = [];
  const allLinks = [];
  $('a[href]').each((_, el) => allLinks.push(($(el).attr('href') || '').toLowerCase()));
  const htmlLower = html.toLowerCase();

  // 1. About page (3 pts)
  const hasAbout = allLinks.some(l =>
    l.includes('/pages/about') ||
    l.includes('/about') ||
    l.includes('nosotros') ||
    l.includes('quienes-somos') ||
    l.includes('about-us')
  );
  let aboutCheck = { id: 'content_about', name: 'About page', maxScore: 3 };
  if (hasAbout) {
    aboutCheck = { ...aboutCheck, status: 'pass', score: 3, details: 'About page linked in navigation or footer.', recommendation: null };
  } else {
    aboutCheck = { ...aboutCheck, status: 'fail', score: 0, details: 'No About page link detected.', recommendation: 'Add an About page telling your story. Customers trust stores with a clear brand story — it significantly improves conversion rates.' };
  }
  checks.push(aboutCheck);

  // 2. Social proof / reviews (4 pts)
  const reviewSignals = [
    'judge.me', 'yotpo', 'stamped', 'okendo', 'loox', 'reviews.io',
    'data-product-reviews', 'product-reviews', 'shopify-product-reviews',
    'spr-container', 'jdgm-', 'yotpo-main-widget'
  ];
  const hasReviewApp = reviewSignals.some(s => htmlLower.includes(s));
  const reviewText = $('[class*="review"], [id*="review"], [class*="rating"], [id*="rating"]').length > 0;
  let reviewCheck = { id: 'content_reviews', name: 'Social proof (reviews)', maxScore: 4 };
  if (hasReviewApp) {
    reviewCheck = { ...reviewCheck, status: 'pass', score: 4, details: 'Review app detected on the page.', recommendation: null };
  } else if (reviewText) {
    reviewCheck = { ...reviewCheck, status: 'warn', score: 2, details: 'Review-related elements found but no dedicated review app detected.', recommendation: 'Install a dedicated review app like Judge.me (free) or Loox to collect and display verified customer reviews.' };
  } else {
    reviewCheck = { ...reviewCheck, status: 'fail', score: 0, details: 'No reviews or social proof detected.', recommendation: 'Install a reviews app immediately. Social proof is the #1 driver of eCommerce conversions. Judge.me is free and excellent.' };
  }
  checks.push(reviewCheck);

  // 3. Blog / content hub (3 pts)
  const hasBlog = allLinks.some(l => l.includes('/blogs/') || l.includes('/blog')) ||
    $('a[href*="blog"]').length > 0;
  let blogCheck = { id: 'content_blog', name: 'Blog / content hub', maxScore: 3 };
  if (hasBlog) {
    blogCheck = { ...blogCheck, status: 'pass', score: 3, details: 'Blog or content section linked.', recommendation: null };
  } else {
    blogCheck = { ...blogCheck, status: 'fail', score: 0, details: 'No blog or content section detected.', recommendation: 'Start a blog with 4-6 posts per month. Content marketing drives organic traffic and builds brand authority.' };
  }
  checks.push(blogCheck);

  // Raw score out of 10 (Phase 1 only)
  const rawScore = checks.reduce((s, c) => s + c.score, 0);
  const rawMax = checks.reduce((s, c) => s + c.maxScore, 0); // 10

  // Scale to 25 points
  const score = Math.round((rawScore / rawMax) * 25);
  const max = 25;

  return { score, max, checks, meta: { phase1Only: true } };
}
