import type { GbpData, Review } from "./types";
import { parseGbpUrl, resolveShortLink } from "./apify";
import { fetchWebsiteData } from "./website";
import { matchCategoriesToPages } from "./coverage";

/**
 * Backup GBP fetcher using Google's first-party Places API (New).
 *
 * Used as a fallback when Apify times out, returns empty, or otherwise
 * fails. Trade-off vs. Apify:
 *   • Pros: <1s typical latency, no scraping fragility, generous free tier.
 *   • Cons: only the 5 most recent reviews; no Posts; no Q&A; no full
 *     services list. Engagement pillar's neutral-50 fallback handles the
 *     missing Posts/Q&A automatically (see lib/scoring.ts:scoreEngagement).
 *
 * Setup: enable Places API (New) in Google Cloud, create an API key,
 * add `GOOGLE_PLACES_API_KEY` to `.env.local` (and Vercel env vars).
 */

const PLACES_BASE = "https://places.googleapis.com/v1";

// Field mask for searchText (each field prefixed with `places.`).
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.types",
  "places.primaryTypeDisplayName",
  "places.editorialSummary",
  "places.reviews",
  "places.photos",
].join(",");

// GET /places/{id} uses bare field names (no `places.` prefix).
const DETAILS_FIELD_MASK = SEARCH_FIELD_MASK.replace(/places\./g, "");

type PlacesPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  types?: string[];
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    authorAttribution?: { displayName?: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
  }>;
  photos?: Array<{ name?: string }>;
};

export async function fetchGbpFromPlaces(args: {
  gbpUrl: string;
  location: string;
}): Promise<GbpData> {
  const { gbpUrl, location } = args;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is not set");

  let url = gbpUrl;
  let parsed = parseGbpUrl(url);
  if (parsed.isShortLink) {
    url = await resolveShortLink(url);
    parsed = parseGbpUrl(url);
  }

  if (!parsed.placeId && !parsed.businessName) {
    throw new Error(
      "Could not read a business from that link. Paste the full Google Maps URL from the Share button, or the URL from your browser bar when viewing the profile."
    );
  }

  console.log("[places] parsed URL:", {
    businessName: parsed.businessName,
    placeId: parsed.placeId,
    cid: parsed.cid,
  });

  // Lookup precedence:
  //   1. ChIJ placeId — direct GET, fastest and most precise.
  //   2. Search by name + location — Places handles fuzzy matches well.
  //   3. Search by name only — recover when the user typed the wrong town.
  // Note: Places API doesn't accept CIDs or hex FIDs as input, so when
  // the URL only carries those we go straight to text search.
  let place: PlacesPlace | undefined;
  if (parsed.placeId) {
    place = await placeDetails(parsed.placeId, apiKey);
  } else if (parsed.businessName) {
    const withLoc = await searchText(`${parsed.businessName} ${location}`, apiKey);
    place = withLoc[0];
    if (!place) {
      console.warn(
        `[places] no match for "${parsed.businessName}" in "${location}" — retrying without location bias`
      );
      const nameOnly = await searchText(parsed.businessName, apiKey);
      place = nameOnly[0];
    }
  }

  if (!place || !place.id) {
    throw new Error(
      "Could not find this business via Google Places API. Double-check the URL and location."
    );
  }

  console.log("[places] match:", {
    title: place.displayName?.text,
    placeId: place.id,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    reviewsReturned: place.reviews?.length ?? 0,
  });

  // ── Categories ──
  // Places API exposes a single human-readable primary category via
  // `primaryTypeDisplayName`. The `types` array is machine codes
  // ("plumber", "point_of_interest") — not useful for display, so skip.
  const categories: string[] = [];
  if (place.primaryTypeDisplayName?.text) {
    categories.push(place.primaryTypeDisplayName.text);
  }

  // ── Hours ──
  // weekdayDescriptions is a localized array like
  // ["Monday: 9:00 AM – 5:00 PM", "Tuesday: Closed", ...]
  const hours = place.regularOpeningHours?.weekdayDescriptions
    ? Object.fromEntries(
        place.regularOpeningHours.weekdayDescriptions
          .map((line): [string, string] | null => {
            const m = line.match(/^([^:]+):\s*(.+)$/);
            return m ? [m[1], m[2]] : null;
          })
          .filter((x): x is [string, string] => x !== null)
      )
    : undefined;

  // ── Reviews ──
  const reviews: Review[] = (place.reviews ?? []).map((r) => ({
    rating: typeof r.rating === "number" ? r.rating : 0,
    text: r.text?.text,
    author: r.authorAttribution?.displayName,
    // relativePublishTimeDescription is "2 weeks ago" form — what
    // lib/scoring.ts:parseRelativeDate already understands.
    date: r.relativePublishTimeDescription,
  }));

  // ── Website analysis (best-effort) ──
  let websiteDescription: string | undefined;
  let categoryPageMatches: GbpData["categoryPageMatches"];
  let websiteSignals: GbpData["websiteSignals"];
  if (place.websiteUri) {
    const web = await fetchWebsiteData(place.websiteUri);
    websiteDescription = web.description;
    websiteSignals = {
      reachable: web.reachable,
      https: web.https,
      listedAsHttp: web.listedAsHttp,
    };
    if (web.pages.length > 0 && categories.length > 0) {
      categoryPageMatches = matchCategoriesToPages(categories, web.pages);
    }
  }

  return {
    name: place.displayName?.text ?? parsed.businessName ?? "Unknown",
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber,
    website: place.websiteUri,
    categories,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    hours,
    description: place.editorialSummary?.text,
    services: [],
    reviews,
    // posts/questions deliberately omitted — Places API doesn't surface
    // them, so leaving these undefined lets scoreEngagement use its
    // neutral 50 fallback.
    placeId: place.id,
    photoCount: place.photos?.length,
    websiteDescription,
    categoryPageMatches,
    websiteSignals,
  };
}

async function placeDetails(placeId: string, apiKey: string): Promise<PlacesPlace> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places API ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as PlacesPlace;
}

async function searchText(query: string, apiKey: string): Promise<PlacesPlace[]> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Places API ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { places?: PlacesPlace[] };
  return json.places ?? [];
}
