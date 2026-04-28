// Run the production audit pipeline (fetchGbp + scoreGbp) against an
// arbitrary list of GBP URLs and print a scorecard summary for each.
// Skips the OpenAI narrative / GHL webhook / DB save — we only want scores.
//
// Usage:
//   npx tsx scripts/audit-urls.ts <url> <url> ...
//   (locations default to "United Kingdom"; the URL itself drives Apify)

import fs from "node:fs/promises";
import { fetchGbp } from "../lib/apify";
import { scoreGbp } from "../lib/scoring";

async function loadEnv() {
  const text = await fs.readFile(".env.local", "utf8");
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
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

async function main() {
  await loadEnv();

  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("usage: npx tsx scripts/audit-urls.ts <url> [<url> ...]");
    process.exit(1);
  }

  console.log(`Auditing ${urls.length} URL${urls.length === 1 ? "" : "s"}…\n`);

  for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  console.log("─".repeat(72));
  console.log(`[${i + 1}/${urls.length}] ${url}`);
  console.log("─".repeat(72));

  const t0 = Date.now();
  try {
    const gbp = await fetchGbp({ gbpUrl: url, location: "United Kingdom" });
    const card = scoreGbp(gbp);
    const ms = Date.now() - t0;

    console.log(`\nBusiness:        ${gbp.name}`);
    console.log(`Address:         ${gbp.address ?? "—"}`);
    console.log(`Phone:           ${gbp.phone ?? "—"}`);
    console.log(`Website:         ${gbp.website ?? "—"}`);
    console.log(`Categories (${gbp.categories.length}): ${gbp.categories.join(", ")}`);
    console.log(`Rating:          ${gbp.rating?.toFixed(1) ?? "—"}  (${gbp.reviewCount ?? 0} reviews)`);
    console.log(`Photos:          ${gbp.photoCount ?? "—"}`);
    console.log(`Services:        ${gbp.services?.length ?? 0}`);
    console.log(`Posts:           ${gbp.posts?.length ?? "(not measured)"}`);
    console.log(`Q&A:             ${gbp.questions?.length ?? "(not measured)"}`);
    console.log(`Description:     ${gbp.description ? `${gbp.description.length} chars` : "—"}`);
    console.log(`Website summary: ${gbp.websiteDescription ? `${gbp.websiteDescription.length} chars` : "—"}`);

    console.log(`\n┌─ Scorecard ────────────────────────────────────────────────────────┐`);
    console.log(`│ OVERALL: ${String(card.overall).padStart(3)}/100  (${card.grade})${" ".repeat(50)}│`);
    console.log(`├────────────────────────────────────────────────────────────────────┤`);
    for (const s of card.subScores) {
      const bar = "█".repeat(Math.round(s.score / 5)).padEnd(20, "·");
      console.log(
        `│ ${s.label.padEnd(28)} ${String(s.score).padStart(3)}/100 (w${String(s.weight).padStart(2)})  ${bar} │`
      );
    }
    console.log(`└────────────────────────────────────────────────────────────────────┘`);

    console.log(`\nKey findings:`);
    for (const s of card.subScores) {
      console.log(`  ${s.label}:`);
      for (const f of s.findings) console.log(`    • ${f}`);
    }

    console.log(`\n(took ${(ms / 1000).toFixed(1)}s)\n`);
  } catch (err) {
    console.error(`  failed: ${err instanceof Error ? err.message : err}\n`);
  }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
