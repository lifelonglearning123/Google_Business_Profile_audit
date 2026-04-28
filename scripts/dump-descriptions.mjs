// One-off diagnostic. Reads csv/google_business_profile_search_links.csv,
// for each (industry, city) row pulls the top-3 local_results from SerpAPI
// google_maps search, then fetches each one's place_results. Saves the raw
// JSON per profile under tmp/responses/ and writes a summary table to
// tmp/description-summary.md so we can see where description-shaped data
// actually lives in real responses.
//
// Run with: node scripts/dump-descriptions.mjs
//
// Reads SERPAPI_KEY from .env.local. Cost: ~25 search + ~75 place_results
// SerpAPI calls.

import fs from "node:fs/promises";
import path from "node:path";

const TOP_N = 3;
const OUT_DIR = "tmp/responses";
const SUMMARY_PATH = "tmp/description-summary.md";
const CSV_PATH = "csv/google_business_profile_search_links.csv";
const PACE_MS = 300; // gentle on SerpAPI

// ── Load .env.local manually (Next.js handles this in the app, but this
// script runs outside the Next runtime). ──
async function loadEnv() {
  let text;
  try {
    text = await fs.readFile(".env.local", "utf8");
  } catch {
    throw new Error(".env.local not found in cwd; run from project root");
  }
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
const SERPAPI_KEY = env.SERPAPI_KEY;
if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY missing from .env.local");

await fs.mkdir(OUT_DIR, { recursive: true });

async function serp(params) {
  const url = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries({ ...params, api_key: SERPAPI_KEY })) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SerpAPI ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Read CSV ──
const csvText = await fs.readFile(CSV_PATH, "utf8");
const rows = csvText
  .trim()
  .split(/\r?\n/)
  .slice(1) // header
  .map((line) => {
    const [location, industry] = line.split(",");
    return { location: location?.trim(), industry: industry?.trim() };
  })
  .filter((r) => r.location && r.industry);

console.log(`Loaded ${rows.length} queries from ${CSV_PATH}`);

const summary = [];

for (const { location, industry } of rows) {
  const q = `${industry} ${location}`;
  console.log(`\n[${q}] searching…`);
  let search;
  try {
    search = await serp({
      engine: "google_maps",
      q,
      type: "search",
      hl: "en",
    });
  } catch (e) {
    console.warn(`  search failed: ${e.message}`);
    continue;
  }
  await sleep(PACE_MS);

  const locals = (Array.isArray(search.local_results) ? search.local_results : []).slice(0, TOP_N);
  if (locals.length === 0) {
    console.warn(`  no local_results`);
    continue;
  }

  for (let i = 0; i < locals.length; i++) {
    const local = locals[i];
    if (!local.place_id) {
      console.warn(`  #${i + 1} no place_id, skipping`);
      continue;
    }

    let details;
    try {
      details = await serp({
        engine: "google_maps",
        place_id: local.place_id,
        hl: "en",
      });
    } catch (e) {
      console.warn(`  #${i + 1} details failed: ${e.message}`);
      await sleep(PACE_MS);
      continue;
    }
    await sleep(PACE_MS);

    const place = details.place_results ?? {};
    const title = place.title ?? local.title ?? "unknown";
    const safeName = title.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    const file = path.join(
      OUT_DIR,
      `${industry}-${location}-${i + 1}-${safeName}.json`
    );
    await fs.writeFile(file, JSON.stringify(place, null, 2));

    // ── Extract description-shaped fields ──
    const desc = typeof place.description === "string" ? place.description : null;

    const extKeys = Array.isArray(place.extensions)
      ? [
          ...new Set(
            place.extensions.flatMap((e) =>
              e && typeof e === "object" ? Object.keys(e) : []
            )
          ),
        ]
      : [];

    const aboutKeys = Array.isArray(place.about)
      ? [
          ...new Set(
            place.about.flatMap((a) => {
              if (!a || typeof a !== "object") return [];
              const own = Object.keys(a);
              const sectionsKeys = Array.isArray(a.sections)
                ? a.sections.flatMap((s) =>
                    s && typeof s === "object" ? Object.keys(s) : []
                  )
                : [];
              return [...own, ...sectionsKeys.map((k) => `sections.${k}`)];
            })
          ),
        ]
      : [];

    // Top-level keys that look description-ish (length-prone strings)
    const interestingKeys = Object.keys(place).filter((k) => {
      const v = place[k];
      return typeof v === "string" && v.length > 60;
    });

    const editorialSummary =
      typeof place.editorial_summary === "string"
        ? place.editorial_summary
        : place.editorial_summary?.overview ?? null;

    summary.push({
      query: q,
      rank: i + 1,
      title,
      placeId: local.place_id,
      descLen: desc?.length ?? 0,
      descPreview: desc?.slice(0, 120) ?? "",
      hasExtensions: Array.isArray(place.extensions),
      extensionsKeys: extKeys,
      hasAbout: Array.isArray(place.about),
      aboutKeys,
      editorialSummaryLen: editorialSummary?.length ?? 0,
      hasPosts: Array.isArray(place.posts),
      postsCount: place.posts?.length ?? 0,
      longStringKeys: interestingKeys,
      file: file.replace(/\\/g, "/"),
    });

    console.log(
      `  #${i + 1} ${title.slice(0, 40)} — desc=${desc?.length ?? 0} ext=[${extKeys.join(",")}] about=[${aboutKeys.join(",")}]`
    );
  }
}

// ── Summary markdown ──
const lines = [];
lines.push(`# Description field analysis`);
lines.push("");
lines.push(`Profiles inspected: **${summary.length}**`);
lines.push("");
lines.push(`## Field presence stats`);
lines.push("");
const stat = (label, n) => `- ${label}: **${n} / ${summary.length}**`;
lines.push(stat("Non-empty `place.description`", summary.filter((s) => s.descLen > 0).length));
lines.push(stat("`place.description` ≥ 100 chars", summary.filter((s) => s.descLen >= 100).length));
lines.push(stat("`place.extensions` present", summary.filter((s) => s.hasExtensions).length));
lines.push(stat("`place.about` present", summary.filter((s) => s.hasAbout).length));
lines.push(
  stat("`place.editorial_summary` present", summary.filter((s) => s.editorialSummaryLen > 0).length)
);
lines.push(stat("`place.posts` present", summary.filter((s) => s.hasPosts).length));
lines.push("");

const allExtKeys = [...new Set(summary.flatMap((s) => s.extensionsKeys))];
const allAboutKeys = [...new Set(summary.flatMap((s) => s.aboutKeys))];
const allLongKeys = [...new Set(summary.flatMap((s) => s.longStringKeys))];

lines.push(`## All observed sub-keys`);
lines.push("");
lines.push(`- Inside \`place.extensions[]\`: \`${allExtKeys.join("`, `") || "(none)"}\``);
lines.push(`- Inside \`place.about[]\` (incl. \`sections.\`): \`${allAboutKeys.join("`, `") || "(none)"}\``);
lines.push(`- Top-level string fields > 60 chars: \`${allLongKeys.join("`, `") || "(none)"}\``);
lines.push("");

lines.push(`## Per-profile detail`);
lines.push("");
lines.push(`| Query | Rk | Title | desc len | desc preview | ext keys | about keys |`);
lines.push(`|---|---|---|---|---|---|---|`);
for (const s of summary) {
  const preview = s.descPreview.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const title = (s.title ?? "").slice(0, 32).replace(/\|/g, "\\|");
  lines.push(
    `| ${s.query} | ${s.rank} | ${title} | ${s.descLen} | ${preview} | ${s.extensionsKeys.join(", ") || "-"} | ${s.aboutKeys.join(", ") || "-"} |`
  );
}

await fs.writeFile(SUMMARY_PATH, lines.join("\n") + "\n");
await fs.writeFile("tmp/description-summary.json", JSON.stringify(summary, null, 2));

console.log(`\nDone. ${summary.length} responses in ${OUT_DIR}/, summary at ${SUMMARY_PATH}`);
