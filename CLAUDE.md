# CLAUDE.md — Shopify Store Grader

## What is this project?

A free web tool that analyzes any Shopify store from its public URL and generates a detailed score (0-100) across 4 categories: SEO, Performance/UX, Shopify Configuration, and Content Quality. The tool serves as a lead magnet for a freelance eCommerce consultancy — the free report covers what's visible from outside; a full backend audit is the paid upsell.

**Live URL:** Deployed on Vercel (hobby plan, free).
**Stack:** Vanilla HTML/CSS/JS frontend + Vercel Serverless Functions (Node.js) backend. No frameworks.

---

## Project structure

```
shopify-grader/
├── CLAUDE.md                  # This file
├── index.html                 # Landing page with URL input
├── results.html               # Results page with score display
├── css/
│   └── style.css              # All styles (single file, no preprocessor)
├── js/
│   ├── main.js                # Landing page logic (form validation, submit)
│   └── results.js             # Results page logic (fetch data, render score, PDF)
├── api/
│   ├── analyze.js             # Main serverless function — orchestrates all checks
│   ├── lib/
│   │   ├── scraper.js         # HTML fetching + Cheerio parsing
│   │   ├── seo-checks.js      # SEO category scoring logic
│   │   ├── performance.js     # PageSpeed API integration + scoring
│   │   ├── shopify-checks.js  # Shopify-specific checks + scoring
│   │   ├── content-checks.js  # Content analysis (Phase 2: Claude API)
│   │   └── scoring.js         # Score aggregation + grade calculation
├── assets/
│   └── og-image.png           # Social sharing image
├── package.json
├── vercel.json                # Vercel config (routes, functions)
└── .env.example               # Template for environment variables
```

---

## Tech decisions (non-negotiable)

- **No frameworks.** No React, no Next.js, no Tailwind. Vanilla HTML/CSS/JS only. The frontend is two static pages.
- **Serverless functions** in `/api/` directory — Vercel auto-detects and deploys them as serverless endpoints.
- **Cheerio** for HTML parsing (server-side, in serverless functions). NOT Puppeteer — it's too heavy for serverless and we don't need JS rendering.
- **Google PageSpeed Insights API** for performance data. Free tier, 25,000 calls/day.
- **No database.** Analysis is stateless — run on demand, return results, done.
- **No authentication.** Public tool, no login required.

---

## Environment variables

```env
PAGESPEED_API_KEY=           # Google PageSpeed Insights API key (required Phase 1)
ANTHROPIC_API_KEY=           # Anthropic API key (required Phase 2 only)
```

Store in `.env` locally. On Vercel, set via dashboard > Settings > Environment Variables.

---

## Vercel configuration

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ],
  "functions": {
    "api/analyze.js": {
      "maxDuration": 30
    }
  }
}
```

The `maxDuration: 30` is important — scraping + PageSpeed API calls can take 10-20 seconds total.

---

## User flow

1. User lands on `index.html`, sees a clean input field asking for a Shopify store URL.
2. User enters URL (e.g., `tappergourmet.com` or `https://tappergourmet.com`).
3. Frontend normalizes the URL (add https:// if missing, strip trailing slashes).
4. Frontend calls `POST /api/analyze` with `{ url: "https://tappergourmet.com" }`.
5. Backend validates: is this a Shopify store? (Check for `Shopify.theme` or `cdn.shopify.com` in HTML).
6. If not Shopify → return error: "This doesn't appear to be a Shopify store."
7. If Shopify → run all checks in parallel (scraping + PageSpeed API).
8. Return JSON with scores per category + individual check results.
9. Frontend renders the results page: overall score, category breakdown, individual checks with pass/fail/warning.
10. User can download a PDF report (client-side generation with html2pdf.js).
11. Below the report: CTA → "Want a full backend audit? Book a free 30-min call" (link to Calendly or contact form).

---

## API endpoint: POST /api/analyze

### Request
```json
{
  "url": "https://example-store.com"
}
```

### Response
```json
{
  "url": "https://example-store.com",
  "isShopify": true,
  "analyzedAt": "2026-03-26T12:00:00Z",
  "score": {
    "total": 72,
    "grade": "B",
    "categories": {
      "seo": { "score": 18, "max": 25, "checks": [...] },
      "performance": { "score": 20, "max": 25, "checks": [...] },
      "shopify": { "score": 17, "max": 25, "checks": [...] },
      "content": { "score": 17, "max": 25, "checks": [...] }
    }
  },
  "meta": {
    "theme": "Dawn",
    "pageLoadTime": 2.4,
    "mobileScore": 65,
    "desktopScore": 88
  }
}
```

### Check object format
Each individual check returns:
```json
{
  "id": "seo_title_tag",
  "name": "Title tag",
  "status": "pass" | "warn" | "fail",
  "score": 4,
  "maxScore": 4,
  "details": "Title found: 'Tapper Gourmet — Comida gourmet a domicilio' (49 chars)",
  "recommendation": null
}
```

When status is `warn` or `fail`, `recommendation` contains a short, actionable fix:
```json
{
  "recommendation": "Your title is 78 characters. Keep it under 60 for optimal display in search results."
}
```

---

## Scoring system: 100 points total

### Grading scale
- 90-100 → A (Excellent)
- 75-89 → B (Good)
- 60-74 → C (Needs work)
- 40-59 → D (Significant issues)
- 0-39 → F (Critical problems)

---

### Category 1: SEO on-page (25 points)

File: `api/lib/seo-checks.js`

| Check | Points | Pass | Warn | Fail | How to detect |
|-------|--------|------|------|------|---------------|
| Title tag exists + length | 0-4 | 50-60 chars | 40-49 or 61-70 | Missing or <40 or >70 | `document.querySelector('title')` |
| Meta description exists + length | 0-3 | 120-160 chars | 100-119 or 161-180 | Missing or <100 or >180 | `meta[name="description"]` |
| H1 exists + is unique | 0-4 | Exactly 1 H1 | Multiple H1s | No H1 | Count `h1` elements |
| Image alt text coverage | 0-4 | >90% have alt | 50-90% | <50% | Count `img` with/without `alt` |
| Open Graph tags | 0-3 | og:title + og:image + og:description | 1-2 present | None | `meta[property^="og:"]` |
| Product structured data | 0-4 | JSON-LD with @type Product | Partial schema | None | `script[type="application/ld+json"]` |
| Canonical URL | 0-3 | `link[rel="canonical"]` present and valid | Present but self-referencing issues | Missing | `link[rel="canonical"]` |

### Category 2: Performance + UX (25 points)

File: `api/lib/performance.js`

| Check | Points | Pass | Warn | Fail | How to detect |
|-------|--------|------|------|------|---------------|
| Mobile PageSpeed score | 0-5 | ≥90 | 50-89 | <50 | PageSpeed API `category: performance, strategy: mobile` |
| Desktop PageSpeed score | 0-3 | ≥90 | 50-89 | <50 | PageSpeed API `strategy: desktop` |
| LCP (Largest Contentful Paint) | 0-4 | ≤2.5s | 2.5-4s | >4s | PageSpeed API `largest-contentful-paint` |
| CLS (Cumulative Layout Shift) | 0-4 | ≤0.1 | 0.1-0.25 | >0.25 | PageSpeed API `cumulative-layout-shift` |
| Mobile viewport meta | 0-3 | `viewport` meta present with `width=device-width` | Present but incomplete | Missing | `meta[name="viewport"]` |
| HTTPS | 0-2 | URL is https:// | — | http:// only | Check URL protocol |
| Image optimization | 0-4 | WebP/AVIF used + lazy loading | Some optimization | No optimization | Check `img` src extensions, `loading="lazy"` |

### Category 3: Shopify configuration (25 points)

File: `api/lib/shopify-checks.js`

| Check | Points | Pass | Warn | Fail | How to detect |
|-------|--------|------|------|------|---------------|
| Theme detected | 0-2 | Known theme identified | Generic/unknown theme | Detection failed | `Shopify.theme` in scripts, or meta generator |
| Favicon | 0-2 | `link[rel="icon"]` or `link[rel="shortcut icon"]` | — | Missing | Check `<link>` tags |
| Trust elements | 0-3 | Payment icons + trust badges visible | Partial | None | Look for common payment icon classes, img alts with "visa", "mastercard", etc. |
| Navigation depth | 0-4 | Clear menu with ≤7 top items, logical hierarchy | 8-12 items or flat | >12 items or no nav | Parse `nav` element, count top-level links |
| Search functionality | 0-2 | Search visible in header | Search exists but hidden | No search | Look for `input[type="search"]`, `/search` links |
| Legal pages | 0-4 | Privacy + Terms + Returns/Refund linked | 1-2 present | None | Check footer links for common legal page patterns |
| Social media links | 0-2 | 2+ social links | 1 social link | None | Links to instagram.com, facebook.com, tiktok.com, etc. |
| App ecosystem | 0-4 | Reviews + email + analytics detected | 1-2 detected | None | Check for known app scripts: Klaviyo, Judge.me, Yotpo, Stamped, Mailchimp, GA4, etc. |
| Cart accessibility | 0-2 | Cart icon/link visible in header | — | No cart access | Look for `/cart` links, cart icon elements |

### Category 4: Content quality (25 points)

File: `api/lib/content-checks.js`

**Phase 1 (automated, no Claude API):**

| Check | Points | How to detect |
|-------|--------|---------------|
| About page exists | 0-3 | Link to `/pages/about` or similar in navigation/footer |
| Social proof (reviews) | 0-4 | Presence of review app scripts or review-related elements |
| Blog/content hub | 0-3 | Link to `/blogs/` in navigation |

**Phase 2 (Claude API — implement later):**

| Check | Points | How to detect |
|-------|--------|---------------|
| Homepage copy quality | 0-5 | Send homepage text to Claude API, ask for 0-5 score on clarity, persuasion, brand voice |
| Product description quality | 0-5 | Send first product page text to Claude API, evaluate detail, benefits vs features, readability |
| CTA effectiveness | 0-5 | Send visible CTAs to Claude API, evaluate clarity and urgency |

**Phase 1 fallback:** Categories without Claude API get their points distributed among the automated checks. Content category in Phase 1 is scored out of 10 automated points, scaled to /25.

---

## Shopify detection logic

In `api/lib/scraper.js`, after fetching the HTML:

```javascript
function isShopifyStore(html) {
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
```

Must match at least 1 indicator. If none match, return `{ isShopify: false, error: "This doesn't appear to be a Shopify store." }`

---

## Frontend design principles

- **Clean, professional, minimal.** Think: HubSpot Website Grader meets Lighthouse report.
- **Colors:** Dark background (#0F172A or similar dark blue-gray) for the landing. White/light for the results page.
- **Typography:** System font stack. Large, confident headings.
- **Landing page:** Centered layout. One heading ("How does your Shopify store score?"), one input field, one button. Below: 4 icons showing the categories analyzed. Footer: "Built by Alessandro Sansossio" with link to LinkedIn.
- **Results page:** Large circular score gauge at top. 4 category cards below with individual scores. Expandable sections showing each check's pass/warn/fail status. PDF download button. CTA section at bottom.
- **Loading state:** Progress bar or animated steps showing "Analyzing SEO...", "Checking performance...", etc. The analysis takes 10-20 seconds — the user needs feedback.
- **Mobile-first.** Must look good on phones — many store owners check tools on mobile.
- **Dark mode support** via `prefers-color-scheme` media query.

---

## Score visualization

The main score uses a circular gauge (SVG donut chart):
- 0-39 = Red
- 40-59 = Orange
- 60-74 = Yellow
- 75-89 = Green
- 90-100 = Bright green

Each category card shows a horizontal progress bar with the same color logic.

Individual checks use icons:
- ✅ Pass (green)
- ⚠️ Warning (amber)
- ❌ Fail (red)

---

## PDF generation

Client-side only using html2pdf.js (loaded from CDN). The PDF should contain:
- Store URL + date analyzed
- Overall score + grade
- Category breakdown with scores
- All individual checks with status and recommendations
- Footer: "Report generated by Shopify Store Grader — shopifystoregrader.com | Full audit: alessandro@sansossio.com"

---

## CTA section (bottom of results page)

After the report, show a section:
- Heading: "This report covers what's visible from outside."
- Subheading: "Your email flows, checkout funnel, backend apps, and conversion data need a deeper look."
- Button: "Book a free 30-min audit call" → links to Calendly (placeholder URL for now)
- Secondary link: "Or email me directly" → mailto:sansossiobss@gmail.com

---

## Error handling

- Invalid URL format → "Please enter a valid URL (e.g., mystore.com)"
- URL not reachable → "We couldn't reach this website. Check the URL and try again."
- Not a Shopify store → "This doesn't appear to be a Shopify store. This tool only works with Shopify."
- PageSpeed API error → Skip performance category, score out of /75 instead, show note.
- Timeout (>30s) → "Analysis is taking longer than expected. Try again in a minute."

---

## Build phases

### Phase 1 — MVP (build this first)
- Landing page with URL input
- Shopify detection
- SEO checks (all 7)
- Performance checks (all 7, via PageSpeed API)
- Shopify config checks (all 9)
- Content checks (automated only: about page, reviews, blog = 3 checks)
- Results page with score display
- Loading states
- Error handling
- Mobile responsive
- Deploy to Vercel

### Phase 2 — AI layer
- Integrate Claude API for content analysis (3 additional checks)
- Full 25-point content category
- Improve recommendations with AI-generated suggestions

### Phase 3 — PDF + Polish
- PDF download with html2pdf.js
- Open Graph image for sharing results
- "Share your score" social buttons
- Analytics (simple Vercel Analytics or Plausible)
- Custom domain

---

## Dependencies (package.json)

```json
{
  "name": "shopify-store-grader",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "cheerio": "^1.0.0",
    "node-fetch": "^3.3.0"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=18"
  }
}
```

Only two dependencies for Phase 1. Keep it minimal.

---

## Commands

```bash
# Install dependencies
npm install

# Run locally (requires Vercel CLI)
npx vercel dev

# Deploy
npx vercel --prod

# Or just push to GitHub — Vercel auto-deploys from main branch
git push origin main
```

---

## Important constraints

- **Serverless function size limit:** Vercel hobby plan allows 50MB uncompressed. Cheerio is ~2MB — no problem.
- **Serverless execution time:** 10 seconds default, set to 30 in vercel.json. Should be enough.
- **PageSpeed API rate limit:** 25,000 queries/day free. More than enough.
- **CORS:** The serverless function serves the same domain, so no CORS issues for the frontend fetch.
- **User-Agent:** When scraping, use a realistic User-Agent string to avoid blocks. Example: `Mozilla/5.0 (compatible; ShopifyGrader/1.0; +https://shopifystoregrader.com)`

---

## What NOT to build

- No user accounts or login
- No database or storage
- No email collection (in Phase 1)
- No payment processing
- No Shopify app integration
- No browser extension
- No comparison between stores
- No historical tracking
