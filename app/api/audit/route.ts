import { NextResponse, after } from "next/server";
import { AuditInputSchema, type Audit } from "@/lib/types";
import { fetchGbp } from "@/lib/apify";
import { fetchGbpFromPlaces } from "@/lib/placesApi";
import { scoreGbp } from "@/lib/scoring";
import { generateNarrative } from "@/lib/openai";
import { sendToGhl, pushAuditToGhlApi } from "@/lib/ghl";
import { saveAudit } from "@/lib/store";
import { validateLocation } from "@/lib/locationValidation";
import { notifyAuditError } from "@/lib/notify";

// Patterns that indicate a user-input problem (bad URL, unknown location,
// wrong business). Don't email chao for these — the customer just needs to
// fix their input and retry.
const USER_INPUT_ERROR_PATTERNS = [
  /LOCATION[ _]NOT[ _]FOUND/i,
  /Could not read a business from that link/i,
  /Could not find this business on Google Maps/i,
  /Could not find this business via Google Places/i,
];

function isUserInputError(msg: string): boolean {
  return USER_INPUT_ERROR_PATTERNS.some((re) => re.test(msg));
}

function isLocationNotFound(msg: string): boolean {
  return /LOCATION[ _]NOT[ _]FOUND/i.test(msg);
}

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

  // Pre-flight: confirm the location actually exists. Apify's actor fails
  // with "LOCATION NOT FOUND" when its geocoder (nominatim) can't resolve
  // the locationQuery — so we ask nominatim ourselves first and tell the
  // customer to fix their input instead of burning 30-150s on a doomed run.
  // Fails OPEN if nominatim is slow/down so the audit still proceeds.
  const locCheck = await validateLocation(parsedInput.location);
  if (!locCheck.ok) {
    return NextResponse.json({ error: locCheck.userMessage }, { status: 400 });
  }

  // Apify is the primary source — it returns the richest data (full review
  // sample, Posts, Q&A, services) which the report needs to be complete on
  // the first view. We block on it up to its internal 150s timeout, leaving
  // ~30s of the 180s function budget for narrative + save. If Apify times
  // out, errors, or returns empty, fall back to the Google Places API for a
  // fast basic profile so the audit still completes — the engagement
  // pillar's neutral-50 fallback covers the missing Posts/Q&A in that case.
  let gbp;
  let apifyMsg: string | undefined;
  try {
    gbp = await fetchGbp({ gbpUrl: parsedInput.gbpUrl, location: parsedInput.location });
  } catch (apifyErr) {
    apifyMsg = apifyErr instanceof Error ? apifyErr.message : String(apifyErr);
    console.warn("[audit] apify failed, falling back to Google Places API:", apifyMsg);
    try {
      gbp = await fetchGbpFromPlaces({
        gbpUrl: parsedInput.gbpUrl,
        location: parsedInput.location,
      });
    } catch (placesErr) {
      const placesMsg =
        placesErr instanceof Error ? placesErr.message : String(placesErr);
      console.error("[audit] places fallback also failed:", placesMsg);

      // Classify the failure before deciding what to surface and whether
      // to alert chao:
      //   • LOCATION_NOT_FOUND  → customer-fixable, friendly message, no email.
      //   • Other user-input    → friendly message from Apify, no email.
      //   • System / unknown    → generic message to user + email chao with
      //                           the full debug context.
      if (isLocationNotFound(apifyMsg) || isLocationNotFound(placesMsg)) {
        return NextResponse.json(
          {
            error:
              `We couldn't recognise the location "${parsedInput.location}". ` +
              "Please check the spelling, or try a nearby larger town or city.",
          },
          { status: 400 }
        );
      }

      if (isUserInputError(apifyMsg) || isUserInputError(placesMsg)) {
        // Prefer Apify's message (primary source); strip any internal
        // prefixes like "Apify 400: ".
        const userMsg = apifyMsg.replace(/^Apify \d+:\s*/, "") || placesMsg;
        return NextResponse.json({ error: userMsg }, { status: 400 });
      }

      // Genuine system error on BOTH sources — alert chao with full
      // context so he can debug, and give the customer a generic message.
      notifyAuditError({
        gbpUrl: parsedInput.gbpUrl,
        location: parsedInput.location,
        userEmail: parsedInput.email,
        userName: parsedInput.name,
        apifyError: apifyMsg,
        placesError: placesMsg,
      });

      return NextResponse.json(
        {
          error:
            "Something went wrong fetching your Google Business Profile. " +
            "Our team has been notified — please try again in a few minutes.",
        },
        { status: 502 }
      );
    }
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

  // Build the report URL. Order of preference:
  //   1. NEXT_PUBLIC_SITE_URL when it's set AND not pointing at localhost.
  //      On Vercel this should be the custom domain / vercel.app URL.
  //   2. The incoming request's own origin — always correct on Vercel and
  //      protects against the common config mistake of leaving the env var
  //      at its `http://localhost:3000` dev default in production (which
  //      would otherwise push dead localhost links into GHL notes).
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const reqOrigin = `${new URL(req.url).protocol}//${new URL(req.url).host}`;
  const origin =
    envOrigin && !/^https?:\/\/localhost([:/]|$)/i.test(envOrigin)
      ? envOrigin
      : reqOrigin;
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
