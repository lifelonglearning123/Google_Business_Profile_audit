import type { GbpData, Review } from "./types";
import { fetchWebsiteData } from "./website";
import { matchCategoriesToPages } from "./coverage";

const APIFY_ACTOR = "compass/crawler-google-places";

// Identifiers Apify can consume directly. Lookup precedence in fetchGbp:
//   1. placeId (ChIJ...) — extracted from the URL's `data=!19s<id>` segment
//      when the user pastes a long /maps/place/... URL. Most precise; no
//      search ambiguity.
//   2. searchStringsArray fallback — `<businessName> <location>` when we
//      have a name but no placeId (e.g. share.google links resolving to
//      /search?kgmid=...&q=... URLs, where the `q=` is the businessName).
function parseGbpUrl(url: string): {
  businessName?: string;
  placeId?: string;
  cid?: string;
  isShortLink: boolean;
} {
  const out: {
    businessName?: string;
    placeId?: string;
    cid?: string;
    isShortLink: boolean;
  } = { isShortLink: false };
  try {
    const u = new URL(url);

    const SHORT_HOSTS = new Set([
      "share.google",
      "maps.app.goo.gl",
      "g.page",
      "goo.gl",
      "maps.goo.gl",
      "posts.gle",
    ]);
    if (SHORT_HOSTS.has(u.hostname)) {
      out.isShortLink = true;
      return out;
    }

    const placeMatch = u.pathname.match(/\/place\/([^/]+)/);
    if (placeMatch) {
      out.businessName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
    }
    if (!out.businessName) {
      const q = u.searchParams.get("q");
      if (q) out.businessName = q;
    }

    // Google Maps embeds the ChIJ-form placeId after `!19s` in the data=
    // segment of long /maps/place/... URLs. Apify's `placeIds` input wants
    // exactly this format, so when it's there we route past search.
    const placeIdMatch = url.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
    if (placeIdMatch) out.placeId = placeIdMatch[1];

    const cid = u.searchParams.get("cid");
    if (cid) out.cid = cid;
  } catch {
    // swallow
  }
  return out;
}

function isLikelyMapsUrl(u: string): boolean {
  try {
    const { hostname, pathname } = new URL(u);
    const isGoogleHost =
      hostname === "www.google.com" ||
      hostname === "google.com" ||
      hostname === "maps.google.com";
    if (!isGoogleHost) return false;
    return pathname.startsWith("/maps") || pathname.startsWith("/search");
  } catch {
    return false;
  }
}

async function resolveShortLink(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });
    clearTimeout(timer);

    const finalUrl = res.url || url;
    if (isLikelyMapsUrl(finalUrl)) return finalUrl;

    const body = await res.text().catch(() => "");
    const candidates = [
      /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i,
      /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i,
      /<meta\s+http-equiv=["']refresh["'][^>]*url=([^"'>\s]+)/i,
    ];
    for (const re of candidates) {
      const m = body.match(re);
      if (m && isLikelyMapsUrl(m[1])) return m[1];
    }
    return finalUrl;
  } catch {
    return url;
  }
}

type ApifyPlace = {
  title?: string;
  description?: string | null;
  categoryName?: string;
  categories?: string[];
  address?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  imagesCount?: number;
  placeId?: string;
  fid?: string;
  cid?: string;
  imageUrl?: string;
  openingHours?: Array<{ day: string; hours: string }>;
  additionalInfo?: Record<string, Array<Record<string, boolean>>>;
  reviews?: Array<{
    name?: string;
    text?: string | null;
    stars?: number | null;
    publishAt?: string | null;
    publishedAtDate?: string | null;
    responseFromOwnerText?: string | null;
  }>;
  // Apify exposes Posts via `ownerUpdates` (empty array when none / not
  // scraped). Field shape inside the array isn't well-documented because
  // both test profiles had zero — map defensively.
  ownerUpdates?: Array<{
    text?: string | null;
    snippet?: string | null;
    body?: string | null;
    publishedAtDate?: string | null;
    publishAt?: string | null;
    date?: string | null;
  }>;
  // Apify exposes Q&A via `questionsAndAnswers` (NOT `questions`). Each
  // entry has a question string + an array of answers.
  questionsAndAnswers?: Array<{
    question?: string | null;
    askDate?: string | null;
    answers?: Array<{
      answer?: string | null;
      answerDate?: string | null;
    }>;
  }>;
  url?: string;
};

async function apifyRequest(input: Record<string, unknown>): Promise<ApifyPlace[]> {
  const token =
    process.env.APIFY_API_KEY ||
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_API_KEY is not set");

  // Apify URL convention: username~actor-name
  const actorPath = APIFY_ACTOR.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token
  )}`;

  // Apify sync runs typically take 15-40s with reviews enabled. Cap at 55s
  // so we leave headroom under Vercel's 60s function limit. Override via
  // APIFY_TIMEOUT_MS for local diagnostic scripts that aren't bound by
  // Vercel's request budget.
  const TIMEOUT_MS = Number(process.env.APIFY_TIMEOUT_MS) || 55_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Apify ${res.status}: ${body.slice(0, 400)}`);
    }
    const items = (await res.json()) as ApifyPlace[];
    if (!Array.isArray(items)) {
      throw new Error("Apify returned a non-array payload");
    }
    return items;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Apify timed out after ${Math.round(TIMEOUT_MS / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a GBP from Apify given user inputs.
 *
 * Strategy:
 *   1. Resolve short links and parse the business name out of the URL.
 *   2. Run Apify with `searchStringsArray: [<name> <location>]`. We tried
 *      the `startUrls` path earlier, but `compass/crawler-google-places`
 *      crashes (run-failed) on path-based /maps/place/<name> URLs that
 *      lack an embedded ftid/cid — which is what share.google links
 *      typically resolve to. Search is more reliable.
 *   3. Validate that the matched title resembles the input — search can
 *      pick the wrong business when names are generic.
 *   4. Reviews + Posts + Q&A come back inline.
 *   5. Once we have the place, fetch the website (best-effort) for the
 *      websiteDescription proxy signal.
 */
export async function fetchGbp(args: {
  gbpUrl: string;
  location: string;
}): Promise<GbpData> {
  const { gbpUrl, location } = args;

  let url = gbpUrl;
  let parsed = parseGbpUrl(url);
  if (parsed.isShortLink) {
    url = await resolveShortLink(url);
    parsed = parseGbpUrl(url);
  }

  console.log("[audit] parsed URL:", {
    businessName: parsed.businessName,
    placeId: parsed.placeId,
    cid: parsed.cid,
    isShortLink: parsed.isShortLink,
  });

  if (!parsed.placeId && !parsed.businessName) {
    throw new Error(
      "Could not read a business from that link. Paste the full Google Maps URL from the Share button, or the URL from your browser bar when viewing the profile."
    );
  }

  const baseInput = {
    maxCrawledPlacesPerSearch: 1,
    language: "en",
    countryCode: "gb",
    maxReviews: 40,
    scrapeReviewsCount: 40,
    // Unlocks ownerUpdates (Posts) and questionsAndAnswers (Q&A) on the
    // response. Without this the engagement pillar stays at the neutral 50.
    scrapePlaceDetailPage: true,
    maxQuestions: 50,
    skipClosedPlaces: false,
    scrapeImageAuthors: false,
  };

  // Prefer placeId when the URL gave us one — pinpoint accuracy, no search
  // ambiguity. Fall back to search-by-name otherwise.
  const items = parsed.placeId
    ? await apifyRequest({ ...baseInput, placeIds: [parsed.placeId] })
    : await apifyRequest({
        ...baseInput,
        searchStringsArray: [`${parsed.businessName} ${location}`],
        locationQuery: location,
      });

  const place = items[0];
  if (!place || !place.placeId) {
    throw new Error(
      "Could not find this business on Google Maps. Double-check the URL and location."
    );
  }

  // Bug-2 guard: search can pick the wrong business when names are
  // generic. Compare the input name to the matched title using the first
  // significant token; warn loudly so the operator notices an obvious
  // mismatch (e.g. "Tech and tyres" → "Pure Tyre Norwich").
  warnOnNameMismatch(parsed.businessName, place.title);

  console.log("[audit] apify match:", {
    title: place.title,
    placeId: place.placeId,
    categories: place.categories,
    reviewsCount: place.reviewsCount,
    imagesCount: place.imagesCount,
    reviewsReturned: place.reviews?.length ?? 0,
    postsReturned: place.ownerUpdates?.length ?? 0,
    questionsReturned: place.questionsAndAnswers?.length ?? 0,
  });

  // ── Categories ──
  const categories: string[] = [];
  if (place.categoryName && !categories.includes(place.categoryName)) {
    categories.push(place.categoryName);
  }
  if (Array.isArray(place.categories)) {
    for (const c of place.categories) {
      if (typeof c === "string" && c && !categories.includes(c)) categories.push(c);
    }
  }

  // ── Hours ──
  const hours: Record<string, string> | undefined = Array.isArray(place.openingHours)
    ? Object.fromEntries(
        place.openingHours
          .filter((h) => h && h.day && h.hours)
          .map((h) => [h.day, h.hours])
      )
    : undefined;

  // ── Services ──
  // additionalInfo shape: { "Service options": [{ "Onsite services": true }, ...], ... }
  // We pull out every key whose value is true across the relevant sections,
  // skipping the more attribute-y categories (Accessibility, Payments).
  const services: string[] = [];
  const SERVICE_SECTIONS = new Set([
    "Service options",
    "Offerings",
    "Service Options",
  ]);
  if (place.additionalInfo && typeof place.additionalInfo === "object") {
    for (const [section, items] of Object.entries(place.additionalInfo)) {
      if (!SERVICE_SECTIONS.has(section) || !Array.isArray(items)) continue;
      for (const entry of items) {
        if (!entry || typeof entry !== "object") continue;
        for (const [name, val] of Object.entries(entry)) {
          if (val === true && !services.includes(name)) services.push(name);
        }
      }
    }
  }

  // ── Reviews ──
  const reviews: Review[] = Array.isArray(place.reviews)
    ? place.reviews.map(mapReview)
    : [];

  // ── Posts (Google "Updates" tab) ──
  // Only set when Apify actually attempted detail-page scraping. If the
  // field is missing entirely we leave gbp.posts undefined so the
  // engagement pillar's "not measured" fallback kicks in.
  const posts = Array.isArray(place.ownerUpdates)
    ? place.ownerUpdates
        .map((u) => ({
          text:
            (typeof u.text === "string" && u.text) ||
            (typeof u.snippet === "string" && u.snippet) ||
            (typeof u.body === "string" && u.body) ||
            undefined,
          date:
            (typeof u.publishedAtDate === "string" && u.publishedAtDate) ||
            (typeof u.publishAt === "string" && u.publishAt) ||
            (typeof u.date === "string" && u.date) ||
            undefined,
        }))
        .filter((p) => p.text || p.date)
    : undefined;

  // ── Q&A ──
  // Each Apify entry has a question + an array of answers (most have one,
  // some have several). For our scoring we take the first answer's text.
  const questions = Array.isArray(place.questionsAndAnswers)
    ? place.questionsAndAnswers
        .map((q) => {
          const question = typeof q.question === "string" ? q.question : "";
          const firstAnswer = Array.isArray(q.answers) ? q.answers[0] : undefined;
          const answer =
            firstAnswer && typeof firstAnswer.answer === "string"
              ? firstAnswer.answer
              : undefined;
          return { question, answer };
        })
        .filter((q) => q.question)
    : undefined;

  // ── Website analysis (description + category-page coverage + signals) ──
  // Done LAST and best-effort — if the website is slow or blocks bots, the
  // audit still completes with everything else intact.
  let websiteDescription: string | undefined;
  let categoryPageMatches: GbpData["categoryPageMatches"];
  let websiteSignals: GbpData["websiteSignals"];
  if (place.website) {
    const web = await fetchWebsiteData(place.website);
    websiteDescription = web.description;
    websiteSignals = { reachable: web.reachable, https: web.https };
    if (web.pages.length > 0 && categories.length > 0) {
      categoryPageMatches = matchCategoriesToPages(categories, web.pages);
    }
  }

  return {
    name: place.title ?? parsed.businessName ?? "Unknown",
    address: place.address,
    phone: place.phone,
    website: place.website,
    categories,
    rating: place.totalScore,
    reviewCount: place.reviewsCount,
    hours,
    description: typeof place.description === "string" ? place.description : undefined,
    services,
    reviews,
    posts,
    questions,
    placeId: place.placeId,
    dataId: place.fid,
    thumbnail: place.imageUrl,
    photoCount: place.imagesCount,
    websiteDescription,
    categoryPageMatches,
    websiteSignals,
  };
}

// Stopwords that don't carry identity in a business name. The "first
// significant token" used by warnOnNameMismatch should skip these so it
// doesn't trigger on the wrong word ("The Moka Pot" → first token "moka",
// not "the").
const NAME_STOPWORDS = new Set([
  "the", "a", "an", "and", "of", "or", "for", "to", "in", "at", "on",
  "ltd", "limited", "llc", "llp", "inc", "co", "corp",
]);

function warnOnNameMismatch(input: string | undefined, matched: string | undefined): void {
  if (!input || !matched) return;
  const inputTokens = input.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const firstSignificant = inputTokens.find(
    (t) => t.length >= 3 && !NAME_STOPWORDS.has(t)
  );
  if (!firstSignificant) return;
  const matchedLower = matched.toLowerCase();
  if (matchedLower.includes(firstSignificant)) return;
  console.warn(
    `[audit] ⚠ business name mismatch: input "${input}" → matched "${matched}". ` +
      `The audit may be for the wrong business — confirm the URL points at the intended profile.`
  );
}

function mapReview(r: NonNullable<ApifyPlace["reviews"]>[number]): Review {
  return {
    rating: typeof r.stars === "number" ? r.stars : 0,
    text: typeof r.text === "string" ? r.text : undefined,
    author: typeof r.name === "string" ? r.name : undefined,
    // publishAt is the relative form ("2 weeks ago") that
    // lib/scoring.ts:parseRelativeDate already understands.
    date: typeof r.publishAt === "string" ? r.publishAt : undefined,
    ownerResponse:
      typeof r.responseFromOwnerText === "string" ? r.responseFromOwnerText : undefined,
  };
}
