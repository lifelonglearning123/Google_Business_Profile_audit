# Google Business Profile Audit Tool

A lead-magnet web app that lets local businesses enter their **Google Business Profile URL, location, and industry** — along with their name, email, and mobile — and returns a comprehensive audit in ~60 seconds. The report is shown on a web page and can be downloaded as a PDF. Leads are pushed to your GHL inbound webhook.

**Stack:** Next.js 15 + TypeScript on Vercel · SerpAPI for GBP data · OpenAI GPT-5.4 for the narrative · `@react-pdf/renderer` for PDF · Tailwind CSS.

---

## 1. Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` with your keys:

| Variable | Where to get it |
|---|---|
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com) → account → API key |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `OPENAI_MODEL` | Defaults to `gpt-5.4` — override if needed |
| `GHL_WEBHOOK_URL` | In GHL: Automation → Workflows → new workflow → **Inbound Webhook** trigger → copy URL |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for dev, your Vercel URL for prod |

Run:

```bash
npm run dev
```

Visit http://localhost:3000.

---

## 2. How it works

1. User fills the form: GBP URL, city/service area, industry, name, email, mobile.
2. `POST /api/audit`:
   - Validates input (Zod).
   - Parses the GBP URL to find the business name (or follows short links).
   - Calls **SerpAPI** `google_maps` engine to get place details, then `google_maps_reviews` for up to ~40 recent reviews.
   - Runs the **rule-based scoring engine** (`lib/scoring.ts`) — 6 pillars, 0–100 each, weighted.
   - Calls **GPT-5.4** with the scorecard + review sample + industry context, receives a structured JSON narrative.
   - Fires the lead (name/email/mobile + audit summary) to the **GHL webhook** — non-blocking.
   - Saves the audit in an in-process store and returns `{ id, reportUrl }`.
3. Browser navigates to `/report/[id]` — the full web report.
4. "Download PDF Report" button hits `/api/pdf/[id]` which streams a PDF via `@react-pdf/renderer`.

### Scoring pillars (weights)

| Pillar | Weight |
|---|---|
| Profile Completeness | 25 |
| Reviews (volume × rating) | 25 |
| Owner Responses | 15 |
| Categories & Services | 15 |
| Photos | 10 |
| Posts & Q&A engagement | 10 |

Thresholds live in `lib/scoring.ts` — tune to taste.

---

## 3. GHL webhook payload

The webhook receives:

```jsonc
{
  "name": "...",
  "email": "...",
  "phone": "...",              // "mobile" from the form, mapped to GHL's phone field
  "gbp_url": "...",
  "gbp_name": "...",
  "gbp_location": "...",
  "gbp_industry": "...",
  "gbp_rating": 4.7,
  "gbp_review_count": 128,
  "audit_id": "...",
  "audit_score": 72,
  "audit_grade": "B",
  "audit_report_url": "https://<your-domain>/report/<id>",
  "audit_summary": "...",
  "audit_top_fixes": ["...", "...", "..."],
  "source": "gbp-audit-tool",
  "submitted_at": "2026-04-24T..."
}
```

In GHL, wire the webhook trigger to a **Create/Update Contact** action and map the fields above to contact / custom fields.

---

## 4. Deploy to Vercel

1. **Confirm secrets aren't tracked.** `git status` should NOT show `.env.local`.
2. **Push to GitHub.** Repo is on `main`; create a remote and push if you haven't.
3. **Import in Vercel.** [vercel.com](https://vercel.com) → Add New → Project → import your GitHub repo. Framework auto-detected as Next.js.
4. **Pick a plan — Pro is required ($20/mo).** The audit function takes 20–40s; Hobby caps serverless functions at 10s and will time out the audit. Pro gives 60s headroom.
5. **Add environment variables** in Vercel → Project → Settings → Environment Variables (scope: Production + Preview + Development):

   | Variable | Value |
   |---|---|
   | `SERPAPI_KEY` | your SerpAPI key |
   | `OPENAI_API_KEY` | your OpenAI key |
   | `OPENAI_MODEL` | `gpt-5.4` (or `gpt-4o` if 5.4 isn't on your account) |
   | `GHL_WEBHOOK_URL` | your GHL inbound webhook URL (or blank) |
   | `NEXT_PUBLIC_AGENCY_EMAIL` | inbox the "Talk to us" CTA mails |
   | `NEXT_PUBLIC_SITE_URL` | leave blank for first deploy; set after step 7 |

6. **Click Deploy.** First build is ~2 min.
7. **After it deploys**, copy the URL (e.g. `gbp-audit-abc123.vercel.app`) into `NEXT_PUBLIC_SITE_URL` and redeploy once. This is what gets sent to GHL as `audit_report_url`.
8. **Custom domain (optional)**: Vercel → Settings → Domains. After DNS propagates, update `NEXT_PUBLIC_SITE_URL` to the custom domain and redeploy.

> **Note on audit storage.** `lib/store.ts` writes audits to `/tmp/gbp-audits` on Vercel. Same warm instance reads what it wrote, so the standard "submit → view report" flow works. **Cold starts wipe `/tmp`**, so a link opened 30+ minutes after generation can 404. Acceptable for a lead-magnet (most users read immediately). The durable fix is **Vercel KV**: `npm i @vercel/kv`, swap `saveAudit`/`getAudit` to `kv.set`/`kv.get` — no other files change.

---

## 5. Extending

- **Persistent storage:** replace `lib/store.ts` with Vercel KV, Upstash Redis, or Postgres.
- **Competitor comparison:** run `fetchGbp` for the top 3 local results and diff against the user's profile.
- **White-label:** change brand colours in `tailwind.config.ts` and `BRAND` in `components/pdf/ReportPdf.tsx`.
- **Email delivery:** wire Resend / Postmark into `/api/audit` to send the PDF directly after generation.

---

## 6. File map

```
app/
  page.tsx                   # landing + form
  layout.tsx
  globals.css
  report/[id]/page.tsx       # web report
  api/audit/route.ts         # POST: run the audit
  api/audit/[id]/route.ts    # GET: fetch audit JSON
  api/pdf/[id]/route.ts      # GET: stream the PDF
components/
  AuditForm.tsx
  ScoreDial.tsx
  SubScoreBar.tsx
  RecommendationList.tsx
  pdf/ReportPdf.tsx          # @react-pdf/renderer document
lib/
  types.ts                   # Zod schema + all shared types
  industries.ts              # dropdown options
  serpapi.ts                 # GBP fetching
  scoring.ts                 # rule-based scorecard
  openai.ts                  # GPT-5.4 narrative
  ghl.ts                     # webhook dispatch
  store.ts                   # in-memory audit cache
```
