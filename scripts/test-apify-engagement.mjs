// Phase A diagnostic for the Posts & Q&A capture.
// Calls compass/crawler-google-places with scrapePlaceDetailPage=true and
// maxQuestions=50 against two profiles, saves raw JSON, and prints the
// shapes of any post/Q&A-shaped arrays so we can write the production parser
// against real keys.

import fs from "node:fs/promises";
import path from "node:path";

const ACTOR = "compass/crawler-google-places";
const OUT_DIR = "tmp/apify-engagement";

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
if (!TOKEN) throw new Error("Apify token missing from .env.local");

await fs.mkdir(OUT_DIR, { recursive: true });

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

const TARGETS = [
  {
    label: "Pimlico Plumbers (active chain)",
    search: "Pimlico Plumbers London",
  },
  {
    label: "Trowbridge Plumbers (smaller SMB)",
    search: "Trowbridge Plumbers Trowbridge",
  },
];

const ENGAGEMENT_KEY_HINTS = [
  "ownerUpdates",
  "posts",
  "updates",
  "questions",
  "qa",
  "questionsAndAnswers",
];

for (const t of TARGETS) {
  console.log(`\n[${t.label}] running…`);
  const input = {
    searchStringsArray: [t.search],
    locationQuery: "United Kingdom",
    maxCrawledPlacesPerSearch: 1,
    language: "en",
    countryCode: "gb",
    scrapePlaceDetailPage: true,
    maxQuestions: 50,
    maxReviews: 0,
    scrapeReviewsCount: 0,
    skipClosedPlaces: false,
    scrapeImageAuthors: false,
  };
  const t0 = Date.now();
  let items;
  try {
    items = await callActor(input);
  } catch (err) {
    console.warn(`  failed: ${err.message}`);
    continue;
  }
  const ms = Date.now() - t0;

  if (!Array.isArray(items) || items.length === 0) {
    console.warn(`  no items (took ${ms}ms)`);
    continue;
  }

  const place = items[0];
  const safeName = (place.title ?? "unknown")
    .replace(/[^a-z0-9]/gi, "_")
    .slice(0, 40);
  await fs.writeFile(
    path.join(OUT_DIR, `${safeName}.json`),
    JSON.stringify(place, null, 2)
  );

  console.log(`  title: ${place.title}`);
  console.log(`  runtime: ${ms}ms`);
  console.log(`  top-level keys (${Object.keys(place).length}):`);

  for (const hint of ENGAGEMENT_KEY_HINTS) {
    if (!(hint in place)) continue;
    const val = place[hint];
    if (Array.isArray(val)) {
      console.log(`    ${hint}: array, length=${val.length}`);
      if (val.length > 0 && typeof val[0] === "object") {
        console.log(`      first item keys: ${Object.keys(val[0]).join(", ")}`);
        // Print first item, truncating long string values.
        const sanitised = {};
        for (const [k, v] of Object.entries(val[0])) {
          if (typeof v === "string") sanitised[k] = v.length > 80 ? v.slice(0, 80) + "…" : v;
          else sanitised[k] = v;
        }
        console.log(`      first item: ${JSON.stringify(sanitised, null, 2).split("\n").map(l => "      " + l).join("\n").trim()}`);
      }
    } else if (val !== null && val !== undefined) {
      console.log(`    ${hint}: ${typeof val}, value=${JSON.stringify(val).slice(0, 100)}`);
    }
  }

  // Also surface ANY array-of-objects key we haven't inspected, in case the
  // field name differs from our hints.
  const otherArrayKeys = Object.keys(place).filter(
    (k) =>
      Array.isArray(place[k]) &&
      place[k].length > 0 &&
      typeof place[k][0] === "object" &&
      !ENGAGEMENT_KEY_HINTS.includes(k)
  );
  if (otherArrayKeys.length) {
    console.log(`    (other array-of-object keys: ${otherArrayKeys.join(", ")})`);
  }
}

console.log(`\nDone. Raw JSON in ${OUT_DIR}/`);
