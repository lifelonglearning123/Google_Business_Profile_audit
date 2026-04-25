import type { Audit } from "./types";

/**
 * Fire-and-forget POST of a lead + audit summary to a GHL inbound webhook.
 * Failures are swallowed + logged — we never want webhook problems to block the user's report.
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

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ghl] webhook returned ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("[ghl] webhook POST failed:", err);
  }
}
