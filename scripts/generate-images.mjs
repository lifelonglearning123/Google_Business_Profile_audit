// Generate marketing illustrations via OpenAI's gpt-image-1 model.
// Re-runnable: tweak prompts here, rerun, files in public/generated/ are
// replaced. Costs ~$0.04-0.07 per high-quality 1024px image.
//
// Run: node scripts/generate-images.mjs
//   or: node scripts/generate-images.mjs <slug>   (regen one)

import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

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

await loadEnv();
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY missing from .env.local");
  process.exit(1);
}

const OUT_DIR = "public/generated";
await fs.mkdir(OUT_DIR, { recursive: true });

// ── Edit this list to add / change images. ──
// Slugs are filenames; prompts should be self-contained (no implicit shared
// brand context — describe the style fully each time so re-runs stay
// consistent).
const IMAGES = [
  {
    slug: "calculator-loss",
    size: "1536x1024",
    quality: "high",
    prompt: `Modern flat vector illustration in the style of Stripe or Linear marketing pages.
A small independent UK high-street shopfront stands on the left side of the
composition with its sign reading nothing (no legible text). Five soft yellow
stars hover gently above the shop's roofline. To the right of the shop, a
faded, translucent procession of customer silhouettes walks past without
stopping, gradually fading away toward the right edge of the image — they're
missing the business entirely. The background is a soft pale-blue to teal
gradient sky, with a subtle ground line. Clean geometric shapes, minimalist
composition, generous whitespace, gentle shadows. Professional B2B SaaS
aesthetic. Soft red-orange accents on a small downward arrow indicating
missed business. No text, no faces, no recognisable brand logos. Wide
horizontal aspect.`,
  },
];

const onlySlug = process.argv[2];

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

for (const img of IMAGES) {
  if (onlySlug && img.slug !== onlySlug) continue;
  console.log(`\n[${img.slug}] generating (${img.size}, ${img.quality})…`);
  const t0 = Date.now();
  try {
    const res = await client.images.generate({
      model: "gpt-image-1",
      prompt: img.prompt,
      size: img.size,
      quality: img.quality,
      n: 1,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      console.error(`  no image data returned`);
      continue;
    }
    const filePath = path.join(OUT_DIR, `${img.slug}.png`);
    await fs.writeFile(filePath, Buffer.from(b64, "base64"));
    console.log(`  wrote ${filePath} (${(Date.now() - t0) / 1000}s)`);
  } catch (err) {
    console.error(
      `  failed: ${err instanceof Error ? err.message : err}`
    );
  }
}

console.log(`\nDone.`);
