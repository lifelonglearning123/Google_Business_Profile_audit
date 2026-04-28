// Apify smoke test (Phase 1: 5 profiles only) — verifies the
// `compass/crawler-google-places` Actor returns the owner-written
// description and covers the fields we currently get from SerpAPI.
//
// Run with: node scripts/dump-apify.mjs
//
// Reads APIFY_API_TOKEN from .env.local. Cost: ~$0.025 (5 places).

import fs from "node:fs/promises";
import path from "node:path";

const ACTOR = "compass/crawler-google-places";
const CSV_PATH = "csv/google_business_profile_search_links.csv";
const OUT_DIR = "tmp/apify-responses";
const SUMMARY_PATH = "tmp/apify-coverage.md";
const PROFILES_TO_FETCH = 5; // smoke test scope
const PLACES_PER_SEARCH = 1; // top result only — keep cost tiny

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
const TOKEN =
  env.APIFY_API_TOKEN || env.APIFY_API_KEY || env.APIFY_TOKEN;
if (!TOKEN) {
  throw new Error(
    "Apify token missing from .env.local. Add `APIFY_API_KEY=apify_api_...`"
  );
}

await fs.mkdir(OUT_DIR, { recursive: true });

async function callActor(input) {
  // Use `~` form in the actor path (Apify URL convention).
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

const csvText = await fs.readFile(CSV_PATH, "utf8");
const rows = csvText
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [location, industry] = line.split(",");
    return { location: location?.trim(), industry: industry?.trim() };
  })
  .filter((r) => r.location && r.industry)
  .slice(0, PROFILES_TO_FETCH);

console.log(`Smoke-testing Apify ${ACTOR} on ${rows.length} queries…`);

const summary = [];

for (const { location, industry } of rows) {
  const search = `${industry} ${location}`;
  console.log(`\n[${search}] running actor…`);

  // Input shape for compass/crawler-google-places.
  // searchStringsArray + locationQuery is the standard search mode.
  const input = {
    searchStringsArray: [search],
    locationQuery: "United Kingdom",
    maxCrawledPlacesPerSearch: PLACES_PER_SEARCH,
    language: "en",
    countryCode: "gb",
    scrapeReviewsCount: 0,
    scrapeImageAuthors: false,
    skipClosedPlaces: false,
  };

  let items;
  try {
    items = await callActor(input);
  } catch (err) {
    console.warn(`  failed: ${err.message}`);
    continue;
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.warn(`  no items returned`);
    continue;
  }

  const place = items[0];
  const safeName = (place.title ?? place.name ?? "unknown")
    .replace(/[^a-z0-9]/gi, "_")
    .slice(0, 40);
  const file = path.join(
    OUT_DIR,
    `${industry}-${location}-${safeName}.json`
  );
  await fs.writeFile(file, JSON.stringify(place, null, 2));

  // Probe for fields we care about. The Apify Actor's output schema isn't
  // identical to SerpAPI's, so we cast a wide net and let the summary tell
  // us which keys are actually populated.
  const desc =
    place.description ??
    place.businessDescription ??
    place.about ??
    null;
  const descLen = typeof desc === "string" ? desc.length : 0;

  summary.push({
    query: search,
    title: place.title ?? place.name,
    topLevelKeys: Object.keys(place),
    description: typeof desc === "string" ? desc : null,
    descLen,
    descPreview: typeof desc === "string" ? desc.slice(0, 160) : null,
    categoriesField:
      place.categoryName ??
      place.categories ??
      place.category ??
      place.types ??
      null,
    phone: place.phone ?? place.phoneUnformatted ?? null,
    website: place.website ?? null,
    rating: place.totalScore ?? place.rating ?? null,
    reviewsCount: place.reviewsCount ?? place.reviews_count ?? place.reviews ?? null,
    photosCount: place.imagesCount ?? place.photosCount ?? null,
    address: place.address ?? null,
    placeId: place.placeId ?? place.place_id ?? null,
    hours: place.openingHours ?? place.hours ?? null,
    file: file.replace(/\\/g, "/"),
  });

  console.log(
    `  ${place.title ?? place.name} — desc=${descLen} cat=${JSON.stringify(
      place.categoryName ?? place.categories ?? place.category ?? "—"
    ).slice(0, 80)} reviews=${place.reviewsCount ?? "?"} photos=${
      place.imagesCount ?? "?"
    }`
  );
}

// ── Markdown summary ──
const lines = [];
lines.push(`# Apify smoke test — ${summary.length} profiles`);
lines.push("");
lines.push(`Actor: \`${ACTOR}\``);
lines.push("");
lines.push(`## Field coverage`);
lines.push("");
const stat = (label, n) => `- ${label}: **${n} / ${summary.length}**`;
lines.push(stat("Has description", summary.filter((s) => s.descLen > 0).length));
lines.push(stat("Description ≥ 100 chars", summary.filter((s) => s.descLen >= 100).length));
lines.push(stat("Has categories field", summary.filter((s) => s.categoriesField).length));
lines.push(stat("Has phone", summary.filter((s) => s.phone).length));
lines.push(stat("Has website", summary.filter((s) => s.website).length));
lines.push(stat("Has rating", summary.filter((s) => s.rating != null).length));
lines.push(stat("Has reviewsCount", summary.filter((s) => s.reviewsCount != null).length));
lines.push(stat("Has photosCount (any name)", summary.filter((s) => s.photosCount != null).length));
lines.push(stat("Has hours", summary.filter((s) => s.hours).length));
lines.push("");

const allKeys = [...new Set(summary.flatMap((s) => s.topLevelKeys))].sort();
lines.push(`## All top-level keys observed`);
lines.push("");
lines.push("`" + allKeys.join("`, `") + "`");
lines.push("");

lines.push(`## Per-profile`);
lines.push("");
for (const s of summary) {
  lines.push(`### ${s.title} — ${s.query}`);
  lines.push("");
  lines.push(`- desc length: ${s.descLen}`);
  lines.push(`- desc preview: ${s.descPreview ? "`" + s.descPreview.replace(/`/g, "'") + "`" : "(none)"}`);
  lines.push(`- categories: \`${JSON.stringify(s.categoriesField)}\``);
  lines.push(`- phone: \`${s.phone ?? "—"}\``);
  lines.push(`- website: \`${s.website ?? "—"}\``);
  lines.push(`- rating: \`${s.rating ?? "—"}\``);
  lines.push(`- reviewsCount: \`${s.reviewsCount ?? "—"}\``);
  lines.push(`- photosCount: \`${s.photosCount ?? "—"}\``);
  lines.push(`- raw file: \`${s.file}\``);
  lines.push("");
}

await fs.writeFile(SUMMARY_PATH, lines.join("\n") + "\n");
console.log(`\nDone. Summary: ${SUMMARY_PATH}, raw: ${OUT_DIR}/`);
