import type { Audit } from "./types";

/**
 * GHL integration runs in two parallel paths, controlled independently by
 * env vars. Set neither, one, or both:
 *
 *   GHL_WEBHOOK_URL      → POSTs the full audit JSON to a webhook
 *                          (use this for n8n / Zapier / custom flows)
 *
 *   GHL_API_KEY +        → upserts a Contact in GHL via the v2 API,
 *   GHL_LOCATION_ID         then attaches a Note with the audit summary
 *                          (first-class GHL workflows; no middleware)
 *
 * Both calls have a 5-second timeout and swallow their errors so a third-
 * party hiccup never blocks the audit response or 504s the user.
 */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";
const GHL_TIMEOUT_MS = 5_000;

/**
 * POST audit summary to the GHL inbound webhook (n8n / Zapier / custom).
 */
export async function sendToGhl(audit: Audit, reportUrl: string): Promise<void> {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) {
    console.warn("[ghl] GHL_WEBHOOK_URL not set — skipping lead dispatch");
    return;
  }

  const payload = {
    // Contact fields — GHL picks these up if the webhook is wired to a
    // Create/Update Contact workflow action.
    name: audit.input.name,
    email: audit.input.email,
    phone: audit.input.mobile,

    // Custom fields / metadata for the audit itself.
    gbp_url: audit.input.gbpUrl,
    gbp_name: audit.gbp.name,
    gbp_location: audit.input.location,
    gbp_industry: audit.input.industry,
    gbp_rating: audit.gbp.rating,
    gbp_review_count: audit.gbp.reviewCount,

    audit_id: audit.id,
    audit_score: audit.scorecard.overall,
    audit_grade: audit.scorecard.grade,
    audit_report_url: reportUrl,
    audit_summary: audit.narrative.summary,
    audit_top_fixes: audit.narrative.recommendations
      .filter((r) => r.priority === "high")
      .slice(0, 3)
      .map((r) => r.title),

    source: "gbp-audit-tool",
    submitted_at: audit.createdAt,
  };

  // Hard 5s ceiling: the audit route awaits this call (Vercel kills
  // background fetches), and we sit at the end of a ~30-35s pipeline. If
  // n8n / GHL is slow or unreachable, we'd rather drop this lead-dispatch
  // call than blow past Vercel's 60s maxDuration and 504 the user.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ghl] webhook returned ${res.status}: ${body.slice(0, 200)}`);
    } else {
      console.log(`[ghl] webhook returned ${res.status}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ghl] webhook timed out after 5s");
    } else {
      console.error("[ghl] webhook POST failed:", err);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Direct GHL v2 API integration. Three-step flow:
 *
 *   1. Search for the contact by mobile number  POST /contacts/search
 *      (mobile is the unique key — same person can run audits for several
 *      different businesses, but the phone identifies the human)
 *      → if found, use that contact id
 *      → if not, create one                     POST /contacts/
 *   2. Ensure the gbp-audit tag is set          POST /contacts/{id}/tags
 *      (idempotent — guarantees the tag even on reused contacts)
 *   3. Attach the audit note                    POST /contacts/{id}/notes
 *
 * Search-first (rather than /contacts/upsert) gives us explicit control
 * over create-vs-reuse and matches GHL's documented v2 pattern. Note
 * creation can optionally include a `userId` (GHL_USER_ID env var) to
 * attribute the note to a specific GHL team member.
 *
 * Each step has a 5-second timeout. If any step fails we log and bail —
 * the audit response is never blocked by GHL hiccups.
 */
export async function pushAuditToGhlApi(
  audit: Audit,
  reportUrl: string
): Promise<void> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    if (apiKey || locationId) {
      console.warn(
        "[ghl-api] GHL_API_KEY and GHL_LOCATION_ID both required — skipping API push"
      );
    }
    return;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const { input } = audit;

  // ── Step 1a: search by mobile (the preferred unique key) ──
  let contactId = await findContactByPhone(headers, locationId, input.mobile);

  // ── Step 1b: fall back to email if phone search missed ──
  // Catches the case where an existing contact has the same email but a
  // phone stored in a format that didn't match our normalisation (or no
  // phone at all). Cheaper than letting create-then-recover handle it.
  if (!contactId) {
    contactId = await findContactByEmail(headers, locationId, input.email);
  }

  // ── Step 1c: create if still nothing matched ──
  if (!contactId) {
    contactId = await createContact(headers, locationId, audit);
  }

  if (!contactId) {
    console.error("[ghl-api] no contact id available — note step skipped");
    return;
  }

  // ── Steps 2 + 3: ensure tag + attach note (parallel; independent) ──
  await Promise.all([
    ensureAuditTag(headers, contactId),
    attachAuditNote(headers, contactId, audit, reportUrl),
  ]);
}

async function findContactByPhone(
  headers: Record<string, string>,
  locationId: string,
  phone: string
): Promise<string | undefined> {
  const normalised = toE164Uk(phone);
  if (!normalised) return undefined;

  try {
    const res = await fetchWithTimeout(`${GHL_API_BASE}/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId,
        page: 1,
        pageLimit: 1,
        filters: [
          { field: "phone", operator: "eq", value: normalised },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status !== 404) {
        console.warn(
          `[ghl-api] phone search returned ${res.status}: ${body.slice(0, 240)}`
        );
      }
      return undefined;
    }
    const data = (await res.json().catch(() => ({}))) as {
      contacts?: Array<{ id?: string }>;
    };
    const found = data.contacts?.[0]?.id;
    if (found) {
      console.log(`[ghl-api] found existing contact by phone: ${found}`);
      return found;
    }
    console.log(`[ghl-api] no contact match by phone (${normalised})`);
    return undefined;
  } catch (err) {
    logFetchError("phone search", err);
    return undefined;
  }
}

async function findContactByEmail(
  headers: Record<string, string>,
  locationId: string,
  email: string
): Promise<string | undefined> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return undefined;

  try {
    const res = await fetchWithTimeout(`${GHL_API_BASE}/contacts/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId,
        page: 1,
        pageLimit: 1,
        filters: [
          { field: "email", operator: "eq", value: trimmed },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status !== 404) {
        console.warn(
          `[ghl-api] email search returned ${res.status}: ${body.slice(0, 240)}`
        );
      }
      return undefined;
    }
    const data = (await res.json().catch(() => ({}))) as {
      contacts?: Array<{ id?: string }>;
    };
    const found = data.contacts?.[0]?.id;
    if (found) {
      console.log(`[ghl-api] found existing contact by email: ${found}`);
      return found;
    }
    console.log("[ghl-api] no contact match by email either — will create");
    return undefined;
  } catch (err) {
    logFetchError("email search", err);
    return undefined;
  }
}

/**
 * Normalise a UK-friendly phone string to E.164 so it matches what GHL
 * stores. Handles the common forms users actually type:
 *
 *   "07712 345678"     → "+447712345678"   (UK national → E.164)
 *   "+44 7712 345678"  → "+447712345678"   (already E.164, just clean)
 *   "447712345678"     → "+447712345678"   (no plus, country code present)
 *   "+15551234567"     → "+15551234567"    (non-UK E.164 left untouched)
 *
 * Limited to UK as the assumed default country. If you start auditing
 * non-UK businesses, swap this for a proper libphonenumber call.
 */
function toE164Uk(phone: string): string {
  // Strip anything that isn't a digit or leading plus.
  let cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";

  // Already E.164 — return as-is.
  if (cleaned.startsWith("+")) return cleaned;

  // UK national format starting with 0 → strip the 0, prepend +44.
  if (cleaned.startsWith("0")) return "+44" + cleaned.slice(1);

  // Has a country code already, just missing the plus.
  return "+" + cleaned;
}

async function createContact(
  headers: Record<string, string>,
  locationId: string,
  audit: Audit
): Promise<string | undefined> {
  const { input } = audit;
  const [firstName, ...rest] = (input.name || "").trim().split(/\s+/);
  const lastName = rest.join(" ");

  try {
    const res = await fetchWithTimeout(`${GHL_API_BASE}/contacts/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        locationId,
        firstName,
        lastName: lastName || undefined,
        email: input.email,
        phone: input.mobile,
        source: "GBP Audit Tool",
        tags: ["gbp-audit"],
      }),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        contact?: { id?: string };
      };
      const id = data.contact?.id;
      if (id) {
        console.log(`[ghl-api] contact created: ${id}`);
        return id;
      }
      console.error("[ghl-api] contact create returned 200 but no id in body");
      return undefined;
    }

    // GHL returns 400 with the existing contactId in the body when the
    // location has "no duplicate contacts" enabled and our search-by-phone
    // missed because the existing contact matched on a different field
    // (typically email). Recover the contactId so we can still attach the
    // note rather than treating this as a hard failure.
    //
    // Sample 400 body:
    //   {
    //     "statusCode": 400,
    //     "message": "This location does not allow duplicated contacts.",
    //     "meta": { "contactId": "...", "matchingField": "email" }
    //   }
    const body = await res.text().catch(() => "");
    if (res.status === 400) {
      try {
        const parsed = JSON.parse(body) as {
          meta?: { contactId?: string; matchingField?: string };
          message?: string;
        };
        const existingId = parsed.meta?.contactId;
        if (typeof existingId === "string" && existingId.length > 0) {
          console.log(
            `[ghl-api] duplicate contact detected — reusing id ${existingId} (matched on ${parsed.meta?.matchingField ?? "?"})`
          );
          return existingId;
        }
      } catch {
        // body wasn't JSON we can parse — fall through to error log
      }
    }
    console.error(
      `[ghl-api] contact create returned ${res.status}: ${body.slice(0, 240)}`
    );
    return undefined;
  } catch (err) {
    logFetchError("contact create", err);
    return undefined;
  }
}

async function attachAuditNote(
  headers: Record<string, string>,
  contactId: string,
  audit: Audit,
  reportUrl: string
): Promise<void> {
  const userId = process.env.GHL_USER_ID;
  const payload: { body: string; userId?: string } = {
    body: formatNoteBody(audit, reportUrl),
  };
  if (userId) payload.userId = userId;

  try {
    const res = await fetchWithTimeout(
      `${GHL_API_BASE}/contacts/${contactId}/notes`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[ghl-api] note returned ${res.status}: ${body.slice(0, 240)}`
      );
      return;
    }
    console.log(`[ghl-api] note attached to contact ${contactId}`);
  } catch (err) {
    logFetchError("note create", err);
  }
}

// POST /contacts/{id}/tags is additive (no-op if already present), so this
// is safe to call on every push — covers the reuse paths where the contact
// was found via phone/email search or recovered from a 400 duplicate.
async function ensureAuditTag(
  headers: Record<string, string>,
  contactId: string
): Promise<void> {
  try {
    const res = await fetchWithTimeout(
      `${GHL_API_BASE}/contacts/${contactId}/tags`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ tags: ["gbp-audit"] }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[ghl-api] tag add returned ${res.status}: ${body.slice(0, 240)}`
      );
      return;
    }
    console.log(`[ghl-api] gbp-audit tag ensured on contact ${contactId}`);
  } catch (err) {
    logFetchError("tag add", err);
  }
}

function logFetchError(label: string, err: unknown): void {
  if (err instanceof Error && err.name === "AbortError") {
    console.error(`[ghl-api] ${label} timed out after 5s`);
  } else {
    console.error(`[ghl-api] ${label} failed:`, err);
  }
}

/**
 * Build the Note body. Plain text (GHL renders it as-is in the contact
 * timeline). Includes the report URL so the user can click straight from
 * GHL to the live audit.
 */
function formatNoteBody(audit: Audit, reportUrl: string): string {
  const { input, gbp, scorecard, narrative } = audit;
  const topFixes =
    (narrative.recommendations ?? [])
      .filter((r) => r.priority === "high")
      .slice(0, 3)
      .map((r, i) => `${i + 1}. ${r.title}`)
      .join("\n") || "(none flagged)";

  return [
    `GBP Audit — ${scorecard.overall}/100 (${scorecard.grade})`,
    "",
    `Business: ${gbp.name}`,
    `Industry: ${input.industry}`,
    `Location: ${input.location}`,
    "",
    `GBP URL:`,
    input.gbpUrl,
    "",
    `Full Report:`,
    reportUrl,
    "",
    `Top priority fixes:`,
    topFixes,
    "",
    `Audit ID: ${audit.id}`,
    `Submitted: ${new Date(audit.createdAt).toISOString()}`,
  ].join("\n");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = GHL_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
