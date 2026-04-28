# Multi-tenant deployment guide

This repo is built to deploy as **one codebase, many websites**. Each website is its own Vercel project pointed at the same GitHub repo, with its own per-site environment variables and its own Vercel KV instance.

When you push to `main`, every linked Vercel project rebuilds and redeploys automatically. Each site keeps its own brand label, calendar booking link, GHL webhook, agency email, and audit data — without touching the code.

---

## How it works at a glance

```
                ┌─────────────────────────────────────┐
                │   GitHub repo (single source)       │
                └────────────────┬────────────────────┘
                                 │  push origin main
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌──────────────┐        ┌──────────────┐         ┌──────────────┐
│ Vercel proj. │        │ Vercel proj. │         │ Vercel proj. │
│  audit-acme  │        │  audit-beta  │         │ audit-gamma  │
│              │        │              │         │              │
│ env: ACME    │        │ env: BETA    │         │ env: GAMMA   │
│ KV: ACME-kv  │        │ KV: BETA-kv  │         │ KV: GAMMA-kv │
│              │        │              │         │              │
│ audit.acme   │        │ audit.beta   │         │ audit.gamma  │
│      .com    │        │      .com    │         │      .com    │
└──────────────┘        └──────────────┘         └──────────────┘
```

---

## Per-site vs shared environment variables

When configuring a new Vercel project, set these **per-site** variables to that client's values:

| Variable | What it controls |
|---|---|
| `NEXT_PUBLIC_BRAND_NAME` | Brand label in the page title, footer, and PDF cover (e.g. "Acme GBP Audit") |
| `NEXT_PUBLIC_SITE_URL` | The custom domain Vercel serves this project on (used to build report URLs) |
| `NEXT_PUBLIC_AGENCY_EMAIL` | Mailto fallback target for the report's CTA |
| `NEXT_PUBLIC_CALENDLY_URL` | The strategy-call booking calendar for this client |
| `GHL_WEBHOOK_URL` | The GHL inbound webhook the audit POSTs leads to |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Auto-injected when you create a Vercel KV instance and link it to the project — leave manual setup alone |

These can be **shared** across all projects (same value everywhere — typically one billing account):

| Variable | Notes |
|---|---|
| `OPENAI_API_KEY` | One OpenAI account billing for narrative generation across all sites |
| `OPENAI_MODEL` | `gpt-5.5` (or whatever model you've standardised on) |
| `APIFY_API_KEY` | One Apify account billing for GBP scraping across all sites |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | One DataForSEO account for the loss-calculator's keyword volumes |

`SERPAPI_KEY` is no longer used by the audit pipeline (legacy from the SerpAPI → Apify migration) and can be omitted.

---

## Adding a new site — 7-step checklist

### 1. Create the Vercel project

In the Vercel dashboard:
- **Add New… → Project**
- Import the same GitHub repo
- Project name: `audit-{client}` (e.g. `audit-acme`)
- Framework preset: **Next.js**
- Root directory: leave default
- Build / install commands: leave default

### 2. Add the per-site environment variables

Project → **Settings → Environment Variables**. Set each per-site var listed above for **Production** (and ideally **Preview** too, so PR previews work).

Tip: copy the shared vars from an existing audit project so you don't re-paste API keys each time.

### 3. Create a dedicated KV instance

Project → **Storage → Create Database → KV**. Vercel will auto-inject `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc. into this project only — keeping each client's audit data isolated.

⚠️ **Don't link an existing KV** from another project. Audit IDs are randomly generated per-request and could (rarely) collide; more importantly, sharing storage breaks tenant isolation.

### 4. Connect a custom domain

Project → **Settings → Domains → Add**. Examples:
- `audit.acme.com` (subdomain of the client's main site)
- `acme-audit.com` (standalone domain)

Add the DNS records Vercel shows. Wait for the green "Valid Configuration" tick.

### 5. Trigger the first deploy

If Vercel hasn't already built on project creation, **Deployments → Redeploy → Redeploy** (or push any commit to `main`).

### 6. Smoke-test

Open `https://{your-new-domain}` and check:

- [ ] Page title in the browser tab reads the new `NEXT_PUBLIC_BRAND_NAME`
- [ ] Footer reads `© YEAR {NEW BRAND} · …`
- [ ] Submit a test audit using a real Google Business Profile URL
- [ ] Watch the GHL workflow inbox — confirm the test lead arrives at **this** client's webhook (not another's)
- [ ] On the report page, click "Apply for strategy call" — confirm it opens **this** client's Calendly URL
- [ ] If you've configured PDF — click "Download PDF Report" and check the brand on the cover page

### 7. (Optional) Lock down preview deployments

If you don't want preview deployments accessible to the public:

Project → **Settings → Deployment Protection → Vercel Authentication: All preview deployments**.

This password-protects every preview URL — production stays public.

---

## Pushing updates

Once all projects are connected, **the only workflow you need is**:

```bash
git push origin main
```

Vercel webhooks fire for every linked project, each builds with its own env vars, each deploys to its own domain. Take ~60-90 seconds per project, all in parallel.

To roll back a single site without affecting others: in that project's **Deployments** tab, find a previous deploy, **Promote to Production**.

---

## What's shared at the data layer

- **OpenAI / Apify / DataForSEO API quotas** are consumed across all projects (since the API keys are shared). Watch usage on the respective dashboards if any one site grows fast.
- **Vercel function execution time** counts per project — multi-tenant doesn't multiply your bill, but heavy traffic on one site won't affect another's quota.
- **Vercel KV reads/writes** are per-instance. Each client's audit reads/writes go to their own KV.

---

## Adding more per-site customisation later

The current setup white-labels the **brand name**. If clients ask for more (logo, hero copy, palette tweaks), the path is:

1. **For simple swaps** — add more `NEXT_PUBLIC_*` env vars (e.g. `NEXT_PUBLIC_HERO_TAGLINE`) and reference them via `lib/brand.ts` or a similar small helper.
2. **For richer per-site config** — replace the env-var approach with a single JSON-shaped `SITE_CONFIG` env var or a static `sites/{slug}.json` file selected at build time. More flexible, more setup per client.

For now, the single brand-name env var is enough for most cases.

---

## Troubleshooting

**The new site shows the old brand name.** Vercel caches `NEXT_PUBLIC_*` vars at build time. If you change the var, redeploy: **Deployments → Redeploy** with **Use existing Build Cache: OFF**.

**GHL webhook not receiving leads.** Confirm `GHL_WEBHOOK_URL` is set on this project specifically (not just on the original). Test it directly with `curl -X POST $GHL_WEBHOOK_URL -d '{"test": true}'` from a terminal.

**Audit IDs colliding between sites.** Shouldn't happen — IDs are random 16-char strings. If you see it, you've accidentally linked the same KV instance to multiple projects. Detach and create a fresh KV per project.

**"Apply for strategy call" goes nowhere.** `NEXT_PUBLIC_CALENDLY_URL` is empty on that project — falls back to the `mailto:` for `NEXT_PUBLIC_AGENCY_EMAIL`. Set the Calendly URL and redeploy.
