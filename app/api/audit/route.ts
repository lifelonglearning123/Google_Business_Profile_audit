import { NextResponse } from "next/server";
import { AuditInputSchema, type Audit } from "@/lib/types";
import { fetchGbp } from "@/lib/serpapi";
import { scoreGbp } from "@/lib/scoring";
import { generateNarrative } from "@/lib/openai";
import { sendToGhl } from "@/lib/ghl";
import { saveAudit } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const input = parsed.data;

  let gbp;
  try {
    gbp = await fetchGbp({ gbpUrl: input.gbpUrl, location: input.location });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch GBP data";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

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

  saveAudit(audit);

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${new URL(req.url).protocol}//${new URL(req.url).host}`;
  const reportUrl = `${origin}/report/${audit.id}`;

  // Fire GHL webhook without blocking the response.
  sendToGhl(audit, reportUrl).catch((e) => console.error("[audit] ghl dispatch:", e));

  return NextResponse.json({ id: audit.id, reportUrl });
}
