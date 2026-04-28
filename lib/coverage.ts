import type { WebsitePage } from "./website";

/**
 * For each GBP category, decide whether the website has a matching page.
 * Heuristic:
 *   1. Tokenize the category name; drop generic words ("service", "ltd"…)
 *      and stopwords. A category like "Heating contractor" reduces to
 *      ["heating"].
 *   2. For each remaining "essence" token, scan the page list. A page
 *      counts as a match if any essence token appears in the URL path or
 *      anchor text.
 *   3. If the category had no essence tokens left after filtering (e.g.
 *      the GBP category was just "Service"), treat it as not measurable
 *      and skip it.
 *
 * The function returns the matched + unmatched category names, plus the
 * total considered (excluding skipped ones).
 */
export function matchCategoriesToPages(
  categories: string[],
  pages: WebsitePage[]
): { matched: string[]; unmatched: string[]; total: number } {
  const matched: string[] = [];
  const unmatched: string[] = [];
  let total = 0;

  // Pre-normalize all page haystacks once.
  const haystacks = pages.map((p) => {
    const slug = decodePath(p.url);
    return (slug + " " + p.text).toLowerCase();
  });

  for (const cat of categories) {
    const tokens = essenceTokens(cat);
    if (tokens.length === 0) continue; // skip un-scoreable categories
    total++;
    const found = haystacks.some((h) =>
      tokens.some((t) => containsWord(h, t))
    );
    if (found) matched.push(cat);
    else unmatched.push(cat);
  }

  return { matched, unmatched, total };
}

// Words that don't carry topical meaning. If a category name is JUST
// stopwords we skip it; otherwise we filter them out.
const TOPIC_STOPWORDS = new Set([
  // generic suffixes
  "service", "services", "shop", "store", "company", "ltd", "limited", "llc",
  "inc", "co", "corp", "agency", "specialist", "specialists", "professional",
  "professionals", "expert", "experts", "consultant", "consultants",
  // English fillers
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "at", "on", "with",
  // category-trailers we see in GBP categories like "Heating contractor"
  "contractor", "contractors", "business", "businesses",
]);

function essenceTokens(name: string): string[] {
  const raw = name
    .toLowerCase()
    .replace(/&/g, " ")
    .match(/[a-z]+/g) ?? [];
  const out: string[] = [];
  for (const t of raw) {
    if (t.length < 3) continue;
    if (TOPIC_STOPWORDS.has(t)) continue;
    if (out.includes(t)) continue;
    out.push(t);
  }
  return out;
}

function decodePath(url: string): string {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname).replace(/[-_/.]+/g, " ");
  } catch {
    return url;
  }
}

// Word-boundary substring match. Avoids "tile" matching "stile" but allows
// "plumb" to match "plumbing" (we prefix-match because category names tend
// to be the "root" while page slugs add suffixes — "plumb" → "plumbing",
// "remodel" → "remodelling").
function containsWord(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) {
    // Verify it's at a word boundary on the LEFT side. Right side is
    // intentionally loose so "plumb" matches "plumbing".
    const idx = haystack.indexOf(needle);
    const before = idx === 0 ? " " : haystack[idx - 1];
    return !/[a-z0-9]/.test(before);
  }
  return false;
}
