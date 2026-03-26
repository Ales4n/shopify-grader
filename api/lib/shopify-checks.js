export function runShopifyChecks($, html) {
  const checks = [];

  // 1. Theme detected (2 pts)
  let theme = null;
  const themeMatch = html.match(/Shopify\.theme\s*=\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if (themeMatch) theme = themeMatch[1];
  if (!theme) {
    const metaGenerator = $('meta[name="generator"]').attr('content') || '';
    if (metaGenerator.toLowerCase().includes('shopify')) theme = 'Shopify (theme name unknown)';
  }
  const knownThemes = ['Dawn', 'Debut', 'Brooklyn', 'Minimal', 'Narrative', 'Venture', 'Supply', 'Boundless', 'Jumpstart', 'Streamline', 'Prestige', 'Impulse', 'Pipeline', 'Motion', 'Turbo'];
  const isKnown = theme && knownThemes.some(t => theme.toLowerCase().includes(t.toLowerCase()));
  let themeCheck = { id: 'shopify_theme', name: 'Theme detected', maxScore: 2 };
  if (theme && isKnown) {
    themeCheck = { ...themeCheck, status: 'pass', score: 2, details: `Theme: ${theme}`, recommendation: null };
  } else if (theme) {
    themeCheck = { ...themeCheck, status: 'pass', score: 2, details: `Theme: ${theme}`, recommendation: null };
  } else {
    themeCheck = { ...themeCheck, status: 'warn', score: 1, details: 'Theme name could not be detected.', recommendation: null };
  }
  checks.push(themeCheck);

  // 2. Favicon (2 pts)
  const favicon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').first().attr('href');
  let faviconCheck = { id: 'shopify_favicon', name: 'Favicon', maxScore: 2 };
  if (favicon) {
    faviconCheck = { ...faviconCheck, status: 'pass', score: 2, details: `Favicon found: ${favicon.substring(0, 60)}`, recommendation: null };
  } else {
    faviconCheck = { ...faviconCheck, status: 'fail', score: 0, details: 'No favicon detected.', recommendation: 'Add a favicon in Shopify Admin > Online Store > Themes > Customize > Logo & favicon.' };
  }
  checks.push(faviconCheck);

  // 3. Trust elements (3 pts)
  const bodyText = $('body').text().toLowerCase();
  const bodyHtml = $('body').html() || '';
  const paymentKeywords = ['visa', 'mastercard', 'paypal', 'american express', 'amex', 'stripe', 'apple pay', 'google pay', 'shop pay'];
  const trustKeywords = ['secure checkout', 'ssl', 'money-back', 'money back', 'guaranteed', 'free returns', 'free shipping', 'satisfaction'];
  const foundPayments = paymentKeywords.filter(k => bodyText.includes(k) || bodyHtml.toLowerCase().includes(k));
  const foundTrust = trustKeywords.filter(k => bodyText.includes(k));
  const trustScore = Math.min(3, Math.floor((foundPayments.length + foundTrust.length) / 2));
  let trustCheck = { id: 'shopify_trust', name: 'Trust elements', maxScore: 3 };
  if (foundPayments.length >= 2 && foundTrust.length >= 1) {
    trustCheck = { ...trustCheck, status: 'pass', score: 3, details: `Payment methods: ${foundPayments.slice(0, 3).join(', ')}. Trust signals: ${foundTrust.slice(0, 2).join(', ')}.`, recommendation: null };
  } else if (foundPayments.length >= 1 || foundTrust.length >= 1) {
    trustCheck = { ...trustCheck, status: 'warn', score: 2, details: `Some trust elements found. Payment: ${foundPayments.join(', ') || 'none'}. Trust: ${foundTrust.join(', ') || 'none'}.`, recommendation: 'Add payment method icons and trust badges (secure checkout, money-back guarantee) to increase conversions.' };
  } else {
    trustCheck = { ...trustCheck, status: 'fail', score: 0, details: 'No payment icons or trust badges detected.', recommendation: 'Display payment method icons and add trust badges to your homepage and cart page to build customer confidence.' };
  }
  checks.push(trustCheck);

  // 4. Navigation (4 pts)
  const navLinks = $('nav a, header nav a, .site-nav a, #site-navigation a');
  const topNavCount = navLinks.length;
  let navCheck = { id: 'shopify_nav', name: 'Navigation depth', maxScore: 4 };
  if (topNavCount >= 2 && topNavCount <= 7) {
    navCheck = { ...navCheck, status: 'pass', score: 4, details: `${topNavCount} navigation links found — clean and manageable.`, recommendation: null };
  } else if (topNavCount >= 8 && topNavCount <= 12) {
    navCheck = { ...navCheck, status: 'warn', score: 2, details: `${topNavCount} navigation links — slightly too many.`, recommendation: 'Consider reducing navigation items to 7 or fewer. Too many options cause decision paralysis.' };
  } else if (topNavCount > 12) {
    navCheck = { ...navCheck, status: 'fail', score: 0, details: `${topNavCount} navigation links — overwhelming.`, recommendation: 'Simplify navigation to 5-7 top-level items. Group related pages under dropdown menus.' };
  } else {
    navCheck = { ...navCheck, status: 'warn', score: 2, details: `Only ${topNavCount} navigation links found.`, recommendation: 'Ensure your main navigation is visible and links to your key collections and pages.' };
  }
  checks.push(navCheck);

  // 5. Search (2 pts)
  const hasSearchInput = $('input[type="search"], input[name="q"], form[action="/search"]').length > 0;
  const hasSearchLink = $('a[href*="/search"]').length > 0;
  let searchCheck = { id: 'shopify_search', name: 'Search functionality', maxScore: 2 };
  if (hasSearchInput) {
    searchCheck = { ...searchCheck, status: 'pass', score: 2, details: 'Search input found in the header.', recommendation: null };
  } else if (hasSearchLink) {
    searchCheck = { ...searchCheck, status: 'warn', score: 1, details: 'Search link found but no visible search input.', recommendation: 'Make your search bar more visible — place it in the header for easy access.' };
  } else {
    searchCheck = { ...searchCheck, status: 'fail', score: 0, details: 'No search functionality detected.', recommendation: 'Add a search bar to your header. Many customers use search to find products quickly.' };
  }
  checks.push(searchCheck);

  // 6. Legal pages (4 pts)
  const footerHtml = ($('footer').html() || '').toLowerCase();
  const allLinks = [];
  $('a[href]').each((_, el) => allLinks.push(($(el).attr('href') || '').toLowerCase()));
  const hasPrivacy = allLinks.some(l => l.includes('privacy') || l.includes('privacidad'));
  const hasTerms = allLinks.some(l => l.includes('terms') || l.includes('terminos') || l.includes('condiciones'));
  const hasRefund = allLinks.some(l => l.includes('refund') || l.includes('return') || l.includes('devolucion') || l.includes('reembolso'));
  const legalCount = [hasPrivacy, hasTerms, hasRefund].filter(Boolean).length;
  let legalCheck = { id: 'shopify_legal', name: 'Legal pages', maxScore: 4 };
  if (legalCount === 3) {
    legalCheck = { ...legalCheck, status: 'pass', score: 4, details: 'Privacy, Terms, and Returns/Refund pages all linked.', recommendation: null };
  } else if (legalCount >= 1) {
    const missing = ['Privacy Policy', 'Terms of Service', 'Refund Policy'].filter((_, i) => ![hasPrivacy, hasTerms, hasRefund][i]);
    legalCheck = { ...legalCheck, status: 'warn', score: 2, details: `${legalCount}/3 legal pages linked. Missing: ${missing.join(', ')}.`, recommendation: `Add the missing legal pages: ${missing.join(', ')}. Required for trust and compliance.` };
  } else {
    legalCheck = { ...legalCheck, status: 'fail', score: 0, details: 'No legal pages (Privacy, Terms, Refund) found in footer.', recommendation: 'Add Privacy Policy, Terms of Service, and Refund Policy pages. Shopify provides templates for these in Settings > Policies.' };
  }
  checks.push(legalCheck);

  // 7. Social media links (2 pts)
  const socialDomains = ['instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com', 'pinterest.com', 'youtube.com', 'linkedin.com'];
  const socialLinks = allLinks.filter(l => socialDomains.some(d => l.includes(d)));
  const uniqueSocials = [...new Set(socialLinks.map(l => socialDomains.find(d => l.includes(d))))];
  let socialCheck = { id: 'shopify_social', name: 'Social media links', maxScore: 2 };
  if (uniqueSocials.length >= 2) {
    socialCheck = { ...socialCheck, status: 'pass', score: 2, details: `Social profiles linked: ${uniqueSocials.join(', ')}`, recommendation: null };
  } else if (uniqueSocials.length === 1) {
    socialCheck = { ...socialCheck, status: 'warn', score: 1, details: `Only 1 social profile linked: ${uniqueSocials[0]}`, recommendation: 'Link to at least 2 social media profiles to build credibility and cross-channel presence.' };
  } else {
    socialCheck = { ...socialCheck, status: 'fail', score: 0, details: 'No social media links found.', recommendation: 'Add links to your Instagram, Facebook, or TikTok in the footer to build trust and community.' };
  }
  checks.push(socialCheck);

  // 8. App ecosystem (4 pts)
  const reviewApps = ['judge.me', 'yotpo', 'stamped', 'okendo', 'loox', 'reviews.io', 'reviewbit'];
  const emailApps = ['klaviyo', 'mailchimp', 'omnisend', 'drip', 'privy', 'popup', 'sms'];
  const analyticsApps = ['gtag', 'google-analytics', 'ga4', 'googletagmanager', 'gtm', 'fbq', 'facebook pixel', 'heap', 'hotjar', 'mixpanel'];
  const htmlLower = html.toLowerCase();
  const hasReviews = reviewApps.some(a => htmlLower.includes(a));
  const hasEmail = emailApps.some(a => htmlLower.includes(a));
  const hasAnalytics = analyticsApps.some(a => htmlLower.includes(a));
  const appCount = [hasReviews, hasEmail, hasAnalytics].filter(Boolean).length;
  let appCheck = { id: 'shopify_apps', name: 'App ecosystem', maxScore: 4 };
  if (appCount === 3) {
    appCheck = { ...appCheck, status: 'pass', score: 4, details: 'Reviews app, email marketing, and analytics all detected.', recommendation: null };
  } else if (appCount >= 1) {
    const missing = ['review app', 'email marketing', 'analytics'].filter((_, i) => ![hasReviews, hasEmail, hasAnalytics][i]);
    appCheck = { ...appCheck, status: 'warn', score: 2, details: `${appCount}/3 key apps detected. Missing: ${missing.join(', ')}.`, recommendation: `Add the missing tools: ${missing.join(', ')}. These are essential for growth.` };
  } else {
    appCheck = { ...appCheck, status: 'fail', score: 0, details: 'No review app, email marketing, or analytics detected.', recommendation: 'Install a reviews app (Judge.me), email marketing (Klaviyo), and Google Analytics 4. These are essential for any serious store.' };
  }
  checks.push(appCheck);

  // 9. Cart accessibility (2 pts)
  const hasCartLink = $('a[href="/cart"], a[href*="cart"]').length > 0;
  const hasCartIcon = html.toLowerCase().includes('cart') && ($('[class*="cart"]').length > 0 || $('[id*="cart"]').length > 0);
  let cartCheck = { id: 'shopify_cart', name: 'Cart accessibility', maxScore: 2 };
  if (hasCartLink || hasCartIcon) {
    cartCheck = { ...cartCheck, status: 'pass', score: 2, details: 'Cart link/icon found in header.', recommendation: null };
  } else {
    cartCheck = { ...cartCheck, status: 'fail', score: 0, details: 'Cart link not easily found.', recommendation: 'Ensure the cart icon is prominently displayed in the header on all pages.' };
  }
  checks.push(cartCheck);

  const score = checks.reduce((s, c) => s + c.score, 0);
  const max = checks.reduce((s, c) => s + c.maxScore, 0);
  const detectedTheme = theme || null;
  return { score, max, checks, meta: { theme: detectedTheme } };
}
