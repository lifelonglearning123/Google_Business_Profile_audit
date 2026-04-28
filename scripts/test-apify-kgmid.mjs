// Probe whether compass/crawler-google-places can resolve a
// google.com/search?kgmid=... URL via startUrls (the format share.google
// resolves to). If it works, we can pin to the exact business — fixing
// Bug 2 properly.

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

// Two variants of "Tech and tyres" disambiguation:
const TESTS = [
  {
    label: "(A) full /search URL with kgmid",
    input: {
      startUrls: [
        {
          url: "https://www.google.com/search?kgmid=/g/11vrdqrqv5&q=Tech+and+tyres",
        },
      ],
      maxCrawledPlacesPerSearch: 1,
      language: "en",
      countryCode: "gb",
      maxReviews: 0,
      scrapeReviewsCount: 0,
      scrapePlaceDetailPage: false,
    },
  },
  {
    label: "(B) /maps URL with kgmid",
    input: {
      startUrls: [
        {
          url: "https://www.google.com/maps?kgmid=/g/11vrdqrqv5",
        },
      ],
      maxCrawledPlacesPerSearch: 1,
      language: "en",
      countryCode: "gb",
      maxReviews: 0,
      scrapeReviewsCount: 0,
      scrapePlaceDetailPage: false,
    },
  },
];

for (const t of TESTS) {
  console.log(`\n${t.label}`);
  console.log(`  startUrl: ${t.input.startUrls[0].url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t.input),
    });
    if (!res.ok) {
      console.log(`  HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`  no items returned`);
      continue;
    }
    const p = items[0];
    console.log(`  ✓ matched: ${p.title}`);
    console.log(`    placeId: ${p.placeId}`);
    console.log(`    address: ${p.address}`);
    console.log(`    reviewsCount: ${p.reviewsCount}`);
  } catch (err) {
    console.log(`  failed: ${err.message}`);
  }
}
