// Shared helpers for link/text detection across check modules.
//
// Checks used to match only URL slugs, so stores whose pages have custom slugs
// but clear link labels ("Sobre nosotros" -> /pages/la-empresa) failed checks for
// pages they actually have. Matching now covers both href and visible link text,
// with accents stripped so "Politica" matches "politica".

const COMBINING_MARKS = /[\u0300-\u036f]/g;

export function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function collectLinks($) {
  const links = [];
  $('a[href]').each((_, el) => {
    links.push({
      href: ($(el).attr('href') || '').toLowerCase(),
      text: normalizeText($(el).text()).slice(0, 80),
    });
  });
  return links;
}

// Text matching is capped to short strings so navigation/footer labels match
// but a keyword buried in a linked paragraph doesn't.
export function linkMatches(links, { hrefParts = [], textParts = [] }) {
  return links.some(({ href, text }) =>
    hrefParts.some(p => href.includes(p)) ||
    (text && text.length <= 60 && textParts.some(p => text.includes(p)))
  );
}
