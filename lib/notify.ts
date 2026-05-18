/**
 * Out-of-band error notifications. Fire-and-forget — never blocks the
 * audit response.
 *
 * Currently only ships email via Resend's HTTP API (no SDK needed).
 * Setup:
 *   1. Sign up at https://resend.com (free tier: 3000 emails/month).
 *   2. Verify a sending domain (or use `onboarding@resend.dev` for testing).
 *   3. Add to Vercel env vars:
 *        RESEND_API_KEY=re_xxxxxxxxxxxx
 *        ERROR_EMAIL_FROM="GBP Audit <alerts@yourdomain.com>"
 *        ERROR_EMAIL_TO=chao@macaws.ai     (optional, defaults to chao@macaws.ai)
 *
 * If RESEND_API_KEY is missing we just log to console — the audit response
 * still surfaces a user-friendly message; chao just won't get the email.
 */

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 4_000;
const DEFAULT_RECIPIENT = "chao@macaws.ai";

export type AuditErrorContext = {
  gbpUrl: string;
  location: string;
  userEmail?: string;
  userName?: string;
  /** Apify-side error (always set when notify is called) */
  apifyError: string;
  /** Places-side error if we tried and that also failed */
  placesError?: string;
  /** Anything else useful — parsed URL, run ids, etc. */
  extra?: Record<string, unknown>;
};

export function notifyAuditError(ctx: AuditErrorContext): void {
  // Fire-and-forget. We intentionally do NOT await — the audit route
  // returns its response immediately and Vercel `after()` semantics or a
  // plain dangling promise keeps us alive long enough to flush in
  // practice. Worst case the email is lost; the error is still logged.
  void sendNow(ctx).catch((err) => {
    console.error("[notify] background email send failed:", err);
  });
}

async function sendNow(ctx: AuditErrorContext): Promise<void> {
  // Always log full context to Vercel logs as the source of truth.
  console.error("[notify] AUDIT ERROR", JSON.stringify(ctx, null, 2));

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ERROR_EMAIL_FROM;
  const to = process.env.ERROR_EMAIL_TO || DEFAULT_RECIPIENT;

  if (!apiKey || !from) {
    console.warn(
      "[notify] RESEND_API_KEY or ERROR_EMAIL_FROM not set — email skipped (see log above for details)"
    );
    return;
  }

  const subject = buildSubject(ctx);
  const text = buildBody(ctx);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[notify] resend returned ${res.status}: ${body.slice(0, 300)}`);
      return;
    }
    console.log(`[notify] error email sent to ${to}`);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[notify] resend send timed out after ${TIMEOUT_MS}ms`);
    } else {
      console.error("[notify] resend send failed:", err);
    }
  } finally {
    clearTimeout(timer);
  }
}

function buildSubject(ctx: AuditErrorContext): string {
  // Trim the error to a recognisable headline so chao can triage from the
  // inbox subject alone without opening the message.
  const firstLine = ctx.apifyError.split("\n")[0].slice(0, 100);
  return `GBP error: ${firstLine}`;
}

function buildBody(ctx: AuditErrorContext): string {
  const lines = [
    "A GBP audit failed. Details below.",
    "",
    "─── User input ───",
    `GBP URL:   ${ctx.gbpUrl}`,
    `Location:  ${ctx.location}`,
  ];
  if (ctx.userName) lines.push(`Name:      ${ctx.userName}`);
  if (ctx.userEmail) lines.push(`Email:     ${ctx.userEmail}`);

  lines.push(
    "",
    "─── Apify error ───",
    ctx.apifyError
  );

  if (ctx.placesError) {
    lines.push("", "─── Places fallback error ───", ctx.placesError);
  } else {
    lines.push("", "(No Places fallback attempted, or it succeeded but downstream failed.)");
  }

  if (ctx.extra && Object.keys(ctx.extra).length > 0) {
    lines.push("", "─── Extra context ───");
    for (const [k, v] of Object.entries(ctx.extra)) {
      lines.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
  }

  lines.push(
    "",
    `Timestamp: ${new Date().toISOString()}`,
    "",
    "— GBP Audit Tool"
  );

  return lines.join("\n");
}
