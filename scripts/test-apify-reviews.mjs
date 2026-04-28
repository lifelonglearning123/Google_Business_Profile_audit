// Probe Apify's review record shape so the production mapper can be written
// against real keys. Pulls 10 reviews for one known profile.

import fs from "node:fs/promises";

const ACTOR = "compass/crawler-google-places";

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
const TOKEN = env.APIFY_API_KEY || env.APIFY_API_TOKEN;
if (!TOKEN) throw new Error("Apify token missing");

const actorPath = ACTOR.replace("/", "~");
const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN)}`;

const input = {
  placeIds: ["ChIJl381_ewEdkgRICMBqcXSYR4"], // Kennington Lane Cafe
  maxCrawledPlacesPerSearch: 1,
  language: "en",
  countryCode: "gb",
  // The Actor exposes several names for review scraping in different
  // versions. Pass them all — the unused ones are ignored.
  maxReviews: 10,
  reviewsCount: 10,
  scrapeReviewsCount: 10,
  scrapeReviews: true,
  includeReviews: true,
};

console.log("requesting…");
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(input),
});
if (!res.ok) {
  console.error(res.status, (await res.text()).slice(0, 600));
  process.exit(1);
}
const items = await res.json();
const place = items[0] ?? {};
await fs.writeFile("tmp/apify-reviews-probe.json", JSON.stringify(place, null, 2));

console.log("title:", place.title);
console.log("reviewsCount:", place.reviewsCount);
console.log("reviews length:", place.reviews?.length);
if (Array.isArray(place.reviews) && place.reviews.length) {
  console.log("review[0] keys:", Object.keys(place.reviews[0]));
  console.log("review[0]:", JSON.stringify(place.reviews[0], null, 2));
}
