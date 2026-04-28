// Targeted test: hit Apify for 3 specific profiles we know SerpAPI returned
// a description for (chain-style cafes in London). If Apify ALSO returns a
// description for these, the field works — owner-blank profiles in the
// earlier smoke test just legitimately have no description. If Apify
// returns null even here, the Actor doesn't expose descriptions.

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
const TOKEN = env.APIFY_API_KEY || env.APIFY_API_TOKEN || env.APIFY_TOKEN;
if (!TOKEN) throw new Error("Apify token missing");

// Known profiles that had editorial descriptions in the SerpAPI dump.
const TARGETS = [
  {
    label: "Kennington Lane Cafe",
    placeId: "ChIJl381_ewEdkgRICMBqcXSYR4",
  },
  {
    label: "Drury Covent Garden",
    // From SerpAPI: title "Drury Covent Garden | Cafe & Brunch"
    // We don't have its place_id offhand — fall back to a search.
    search: "Drury Covent Garden Cafe London",
  },
  {
    label: "London Cafe",
    search: "London Cafe Camden",
  },
];

async function callActor(input) {
  const actorPath = ACTOR.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

await fs.mkdir("tmp/apify-known", { recursive: true });

for (const t of TARGETS) {
  console.log(`\n[${t.label}]`);
  let input;
  if (t.placeId) {
    input = {
      placeIds: [t.placeId],
      maxCrawledPlacesPerSearch: 1,
      language: "en",
      countryCode: "gb",
      scrapeReviewsCount: 0,
    };
  } else {
    input = {
      searchStringsArray: [t.search],
      locationQuery: "United Kingdom",
      maxCrawledPlacesPerSearch: 1,
      language: "en",
      countryCode: "gb",
      scrapeReviewsCount: 0,
    };
  }
  let items;
  try {
    items = await callActor(input);
  } catch (err) {
    console.warn(`  failed: ${err.message}`);
    continue;
  }
  if (!Array.isArray(items) || items.length === 0) {
    console.warn(`  no items`);
    continue;
  }
  const p = items[0];
  console.log(`  title=${p.title}`);
  console.log(`  description=${JSON.stringify(p.description)}`);
  console.log(`  hotelDescription=${JSON.stringify(p.hotelDescription)}`);
  const ai = p.additionalInfo ?? {};
  console.log(`  additionalInfo keys=${Object.keys(ai).join(", ")}`);
  if (ai["From the business"]) {
    console.log(`  FROM THE BUSINESS=${JSON.stringify(ai["From the business"])}`);
  }
  // Look for any string > 50 chars that might be a description
  const longStrings = [];
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" && v.length > 50 && !k.toLowerCase().includes("link") && !k.toLowerCase().includes("url") && k !== "address" && k !== "title") {
      longStrings.push({ key: k, len: v.length, preview: v.slice(0, 120) });
    }
  }
  if (longStrings.length) {
    console.log(`  long strings:`);
    for (const ls of longStrings) {
      console.log(`    ${ls.key} (${ls.len}): ${ls.preview}`);
    }
  }
  await fs.writeFile(
    `tmp/apify-known/${t.label.replace(/[^a-z0-9]/gi, "_")}.json`,
    JSON.stringify(p, null, 2)
  );
}
