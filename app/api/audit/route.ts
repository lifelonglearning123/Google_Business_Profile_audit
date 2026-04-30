import { NextResponse, after } from "next/server";
import { AuditInputSchema, type Audit } from "@/lib/types";
import { fetchGbp } from "@/lib/apify";
import { scoreGbp } from "@/lib/scoring";
import { generateNarrative } from "@/lib/openai";
import { sendToGhl, pushAuditToGhlApi } from "@/lib/ghl";
import { saveAudit } from "@/lib/store";

export const runtime = "nodejs";
// 180s ceiling — Vercel Pro supports up to 300s. The audit pipeline is
// inherently sequential (Apify ~30s + website ~5s + OpenAI ~10-60s + GHL
// ~5s). 180s comfortably absorbs slow gpt-5.5 reasoning runs (which can
// occasionally take 60-90s on cold starts) without timing out the user.
export const maxDuration = 180;

function randomId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AuditInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  const parsedInput = parsed.data;

  let gbp;
  try {
    gbp = await fetchGbp({ gbpUrl: parsedInput.gbpUrl, location: parsedInput.location });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch GBP data";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Backfill industry from Google's primary category. The audit form no
  // longer asks for it — Google's category taxonomy is exhaustive and more
  // accurate than any dropdown we'd maintain. Downstream code (report
  // header, PDF, GHL note) keeps reading audit.input.industry unchanged.
  const input = {
    ...parsedInput,
    industry: parsedInput.industry || gbp.categories[0] || "",
  };

  const scorecard = scoreGbp(gbp);

  let narrative;
  try {
    narrative = await generateNarrative({
      gbp,
      scorecard,
      industry: input.industry,
      location: input.location,
    });
  } catch (err) {
    console.error("[audit] narrative generation failed:", err);
    narrative = {
      summary: `Overall score: ${scorecard.overall}/100 (${scorecard.grade}). See the scorecard below for areas to improve.`,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      industryInsights: [],
    };
  }

  const audit: Audit = {
    id: randomId(),
    createdAt: new Date().toISOString(),
    input,
    gbp,
    scorecard,
    narrative,
  };

  await saveAudit(audit);

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${new URL(req.url).protocol}//${new URL(req.url).host}`;
  const reportUrl = `${origin}/report/${audit.id}`;

  // Run BOTH GHL paths in the BACKGROUND via Next.js 15's `after()`.
  // The user gets their report URL the moment saveAudit completes — they
  // don't wait for n8n or GHL. Vercel keeps the function alive long
  // enough for the after() callback to finish (still inside maxDuration).
  // Promise.allSettled inside means one path's failure doesn't break
  // the other; each function logs its own errors.
  after(async () => {
    await Promise.allSettled([
      sendToGhl(audit, reportUrl),
      pushAuditToGhlApi(audit, reportUrl),
    ]);
  });

  return NextResponse.json({ id: audit.id, reportUrl });
}
