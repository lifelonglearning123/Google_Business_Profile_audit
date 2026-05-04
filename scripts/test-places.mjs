// Smoke test for GOOGLE_PLACES_API_KEY.
//
// Usage:
//   node scripts/test-places.mjs                       # uses default test target
//   node scripts/test-places.mjs "Pimlico Plumbers London"
//
// Hits the Places API (New) `searchText` endpoint with the same field mask
// the production fallback uses (lib/placesApi.ts) and prints the matched
// place. A 200 response with a populated place = key is good. Any 4xx
// response surfaces the underlying Google error so you can see exactly
// what's misconfigured.
import fs from "node:fs/promises";

async function loadEnv() {
  const text = await fs.readFile(".env.local", "utf8");
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = await loadEnv();
const KEY = env.GOOGLE_PLACES_API_KEY;
if (!KEY) {
  console.error("✗ GOOGLE_PLACES_API_KEY missing from .env.local");
  process.exit(1);
}

const QUERY = process.argv[2] || "Pimlico Plumbers London";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.regularOpeningHours",
  "places.reviews",
  "places.photos",
].join(",");

console.log(`[places] query: "${QUERY}"`);
const t0 = Date.now();

const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": KEY,
    "X-Goog-FieldMask": FIELD_MASK,
  },
  body: JSON.stringify({ textQuery: QUERY, maxResultCount: 1 }),
});

const ms = Date.now() - t0;
const body = await res.text();

if (!res.ok) {
  console.error(`✗ HTTP ${res.status} (${ms}ms)`);
  console.error(body);
  process.exit(1);
}

const json = JSON.parse(body);
const place = json.places?.[0];
if (!place) {
  console.warn(`⚠ HTTP 200 but no place returned (${ms}ms). Try a more specific query.`);
  console.warn(body);
  process.exit(1);
}

console.log(`✓ HTTP 200 (${ms}ms)`);
console.log({
  name: place.displayName?.text,
  address: place.formattedAddress,
  phone: place.nationalPhoneNumber,
  website: place.websiteUri,
  rating: place.rating,
  reviewCount: place.userRatingCount,
  category: place.primaryTypeDisplayName?.text,
  placeId: place.id,
  reviewsReturned: place.reviews?.length ?? 0,
  photosReturned: place.photos?.length ?? 0,
});
