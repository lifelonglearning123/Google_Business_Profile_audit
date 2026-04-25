import type { GbpData, Review } from "./types";

const SERPAPI_BASE = "https://serpapi.com/search.json";

/**
 * Extract identifiers from a Google Business Profile URL. We try in order:
 *   - businessName: from /place/<name>/ segment
 *   - dataId:      from !1s<hex:hex> segment in data=... (the most precise ID)
 *   - cid:         from ?cid=NNN (legacy)
 *
 * Short links (maps.app.goo.gl, g.page) don't expose identifiers; caller
 * must follow them first.
 */
export function parseGbpUrl(url: string): {
  businessName?: string;
  dataId?: string;
  cid?: string;
  isShortLink: boolean;
} {
  const out: {
    businessName?: string;
    dataId?: string;
    cid?: string;
    isShortLink: boolean;
  } = { isShortLink: false };

  try {
    const u = new URL(url);

    // Known Google short-link hosts — must be resolved to an expanded URL first
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

    // share.google / other short-links redirect to /search?q=<name>&kgmid=... or
    // /maps?q=<name>. If we haven't got a business name from the path yet, read ?q=.
    if (!out.businessName) {
      const q = u.searchParams.get("q");
      if (q) out.businessName = q;
    }

    // data_id is inside the "data=" segment as !1s0x<hex>:0x<hex>
    const dataIdMatch = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
    if (dataIdMatch) out.dataId = dataIdMatch[1];

    const cid = u.searchParams.get("cid");
    if (cid) out.cid = cid;
  } catch {
    // swallow — caller will fall back
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
    // Accept both /maps/... and /search?q=... (share.google redirects to /search)
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
        // Some Google short-links gate on a real-browser User-Agent
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });
    clearTimeout(timer);

    const finalUrl = res.url || url;
    if (isLikelyMapsUrl(finalUrl)) return finalUrl;

    // Redirect didn't leave the short host — try to extract a target from the HTML body
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

type SerpLocal = {
  place_id?: string;
  data_id?: string;
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  type?: string;
  types?: string[];
  categories?: string[];
  rating?: number;
  reviews?: number;
  hours?: Record<string, string> | string;
  open_state?: string;
  description?: string;
  service_options?: Record<string, boolean>;
  thumbnail?: string;
  photos_link?: string;
  photos_count?: number;
  user_review?: unknown;
};

async function serpRequest(params: Record<string, string>): Promise<any> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set");

  const url = new URL(SERPAPI_BASE);
  for (const [k, v] of Object.entries({ ...params, api_key: key })) {
    url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SerpAPI ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`SerpAPI timed out after 15s (${params.engine ?? "?"})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a GBP from SerpAPI given user inputs.
 *
 * Strategy:
 *   1. Parse identifiers from the URL (follow short-link first).
 *   2. If we have a businessName: run google_maps search `"<name> <location>"`.
 *      Take local_results[0] if place_results isn't directly present.
 *   3. Always follow up with a dedicated place-details lookup using place_id.
 *      This is the call that returns rich fields (hours, website, photos_count,
 *      full categories, etc.) — the search result on its own is too sparse.
 *   4. Pull up to 40 reviews via google_maps_reviews.
 */
export async function fetchGbp(args: {
  gbpUrl: string;
  location: string;
}): Promise<GbpData> {
  const { gbpUrl, location } = args;

  let parsed = parseGbpUrl(gbpUrl);
  if (parsed.isShortLink) {
    const expanded = await resolveShortLink(gbpUrl);
    parsed = parseGbpUrl(expanded);
  }

  // Diagnostic log — helps debug wrong-business issues in dev
  console.log("[audit] parsed URL:", {
    businessName: parsed.businessName,
    dataId: parsed.dataId,
    cid: parsed.cid,
  });

  // Don't silently search by location alone — that returned wrong businesses in v1.
  if (!parsed.businessName && !parsed.dataId && !parsed.cid) {
    throw new Error(
      "Could not read a business from that link. Paste the full Google Maps URL from the Share button, or the URL from your browser bar when viewing the profile."
    );
  }

  const query = parsed.businessName
    ? `${parsed.businessName} ${location}`
    : location;

  const searchRes = await serpRequest({
    engine: "google_maps",
    q: query,
    type: "search",
    hl: "en",
  });

  let place: SerpLocal | undefined =
    searchRes.place_results ||
    (Array.isArray(searchRes.local_results) ? searchRes.local_results[0] : undefined);

  if (!place?.place_id) {
    throw new Error(
      "Could not find this business on Google Maps. Double-check the URL and location."
    );
  }

  console.log("[audit] search match:", {
    matchedTitle: place.title,
    matchedAddress: place.address,
    place_id: place.place_id,
    data_id: place.data_id,
  });

  // ── Follow-up: fetch full place details ──
  // The search endpoint returns a thin record; place-details returns everything.
  try {
    const detailsRes = await serpRequest({
      engine: "google_maps",
      place_id: place.place_id,
      hl: "en",
    });
    if (detailsRes.place_results) {
      place = { ...place, ...detailsRes.place_results };
      console.log("[audit] place details fetched", {
        reviews: place.reviews,
        rating: place.rating,
        categories: place.categories ?? place.types,
        hasWebsite: !!place.website,
        hasPhone: !!place.phone,
      });
    }
  } catch (err) {
    console.warn("[audit] place-details follow-up failed, continuing with search data:", err);
  }

  // ── Reviews (up to ~40) ──
  const reviews: Review[] = [];
  const dataId = place.data_id ?? parsed.dataId;
  if (dataId) {
    try {
      const r1 = await serpRequest({
        engine: "google_maps_reviews",
        data_id: dataId,
        hl: "en",
      });
      for (const r of r1.reviews ?? []) reviews.push(mapReview(r));
      if (r1.serpapi_pagination?.next_page_token) {
        const r2 = await serpRequest({
          engine: "google_maps_reviews",
          data_id: dataId,
          next_page_token: r1.serpapi_pagination.next_page_token,
          hl: "en",
        });
        for (const r of r2.reviews ?? []) reviews.push(mapReview(r));
      }
    } catch (err) {
      console.warn("[audit] reviews fetch failed:", err);
    }
  }

  // ── Categories ──
  const categories: string[] = [];
  if (Array.isArray(place.categories)) {
    for (const c of place.categories) if (c && !categories.includes(c)) categories.push(c);
  }
  if (place.type && !categories.includes(place.type)) categories.push(place.type);
  if (Array.isArray(place.types)) {
    for (const t of place.types) if (t && !categories.includes(t)) categories.push(t);
  }

  // ── Services ──
  const services = place.service_options
    ? Object.entries(place.service_options)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/_/g, " "))
    : [];

  return {
    name: place.title ?? parsed.businessName ?? "Unknown",
    address: place.address,
    phone: place.phone,
    website: place.website,
    categories,
    rating: place.rating,
    reviewCount: place.reviews,
    hours: place.hours,
    description: place.description,
    services,
    attributes: [],
    posts: [],
    questions: [],
    reviews,
    placeId: place.place_id,
    dataId,
    thumbnail: place.thumbnail,
    photoCount: place.photos_count,
  };
}

function mapReview(r: any): Review {
  return {
    rating: r.rating ?? 0,
    text: r.snippet ?? r.extracted_snippet?.original,
    author: r.user?.name,
    date: r.date,
    ownerResponse: r.response?.snippet,
  };
}
