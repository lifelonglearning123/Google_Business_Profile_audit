"use client";

import { useState } from "react";
import Image from "next/image";
import {
  TrendingDown,
  Briefcase,
  MapPin,
  PoundSterling,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { INDUSTRIES } from "@/lib/industries";

// Shared key the AuditForm reads on mount to pre-fill industry/location.
export const LOSS_PREFILL_KEY = "gbp-audit:loss-prefill";

type ResultState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ok";
      keyword: string;
      monthlySearches: number;
      lostCustomersMonthly: number;
      lostRevenueMonthly: number;
      lostRevenueYearly: number;
      breakdown: string;
    }
  | { kind: "low-volume"; keyword: string; message: string }
  | { kind: "error"; message: string };

export default function LossCalculator() {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [avgSale, setAvgSale] = useState("");
  const [result, setResult] = useState<ResultState>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!industry || !location.trim() || !avgSale) {
      setResult({ kind: "error", message: "Fill in all three fields." });
      return;
    }
    const sale = Number(avgSale);
    if (!Number.isFinite(sale) || sale <= 0) {
      setResult({
        kind: "error",
        message: "Enter your average sale value as a positive number.",
      });
      return;
    }

    setResult({ kind: "loading" });
    try {
      const res = await fetch("/api/loss-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, location: location.trim(), avgSale: sale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({
          kind: "error",
          message: data?.error ?? `Request failed (${res.status})`,
        });
        return;
      }
      // The route returns 200 even for low-volume cases, with `error` set.
      if (data.error) {
        setResult({ kind: "low-volume", keyword: data.keyword ?? "", message: data.error });
        return;
      }
      setResult({
        kind: "ok",
        keyword: data.keyword,
        monthlySearches: data.estimate.monthlySearches,
        lostCustomersMonthly: data.estimate.lostCustomersMonthly,
        lostRevenueMonthly: data.estimate.lostRevenueMonthly,
        lostRevenueYearly: data.estimate.lostRevenueYearly,
        breakdown: data.estimate.breakdown,
      });
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  function handleCtaClick() {
    // Stash industry + location for AuditForm to pre-fill on mount.
    try {
      sessionStorage.setItem(
        LOSS_PREFILL_KEY,
        JSON.stringify({ industry, location: location.trim() })
      );
    } catch {
      // sessionStorage can throw in Safari private mode — ignore.
    }
    // If the audit form is mounted on this page, scroll to it. Otherwise
    // navigate to the home page where the form lives — the prefill above
    // survives the navigation via sessionStorage.
    const form = document.getElementById("audit-form-anchor");
    if (form) {
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.href = "/#audit-form-anchor";
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-panel shadow-card-lg overflow-hidden text-left">
      {/* Hero illustration — customers walking past a non-visible storefront */}
      <div className="relative aspect-[3/2] w-full bg-gradient-to-br from-sky-50 via-white to-teal-50/60 hidden sm:block">
        <Image
          src="/generated/calculator-loss.png"
          alt="Customers walking past a small business that isn't visible online"
          fill
          priority
          sizes="(min-width: 768px) 672px, 100vw"
          className="object-cover object-center"
        />
      </div>

      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-red-600">
            Revenue at stake
          </p>
        </div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-ink leading-snug">
          How much business are you losing right now?
        </h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Top-3 results capture roughly half of all local-pack clicks. If you're
          not in the top 3, that gap is your monthly miss. Estimate it in 10
          seconds.
        </p>

      <form onSubmit={onSubmit} className="mt-5 grid sm:grid-cols-3 gap-3">
        <Field icon={Briefcase} label="Industry">
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-ink"
          >
            <option value="">Choose…</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>
        <Field icon={MapPin} label="Location">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Trowbridge"
            className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-faint"
          />
        </Field>
        <Field icon={PoundSterling} label="Average sale">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-ink-faint">£</span>
            <input
              type="number"
              inputMode="numeric"
              value={avgSale}
              onChange={(e) => setAvgSale(e.target.value)}
              placeholder="450"
              className="w-full bg-transparent outline-none text-sm text-ink placeholder:text-ink-faint"
            />
          </div>
        </Field>

        <button
          type="submit"
          disabled={result.kind === "loading"}
          className="sm:col-span-3 mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-ink hover:bg-[#1e293b] text-white font-semibold text-sm px-5 py-3 shadow-card transition disabled:opacity-60"
        >
          {result.kind === "loading" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Calculating…
            </>
          ) : (
            "Calculate revenue at stake"
          )}
        </button>
      </form>

      {/* ── Result ── */}
      {result.kind === "ok" && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/60 p-5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl md:text-4xl font-extrabold text-red-700 tabular">
              {formatGbp(result.lostRevenueMonthly)}
            </span>
            <span className="text-sm font-semibold text-red-700">/ month</span>
            <span className="text-sm text-ink-muted ml-2">
              ≈ {formatGbp(result.lostRevenueYearly)} / year
            </span>
          </div>
          <p className="mt-2 text-sm text-ink leading-relaxed">
            That's roughly{" "}
            <strong>{result.lostCustomersMonthly} customers a month</strong>{" "}
            you're not converting because you sit outside the top 3.
          </p>
          <p className="mt-2 text-xs text-ink-muted leading-relaxed">
            {result.breakdown}
          </p>
          <button
            type="button"
            onClick={handleCtaClick}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-5 py-2.5 shadow-card transition"
          >
            Run my free audit to see exactly why
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {result.kind === "low-volume" && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{result.message}</p>
        </div>
      )}

      {result.kind === "error" && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 inline-flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{result.message}</span>
        </div>
      )}

      <p className="mt-4 text-[11px] text-ink-faint">
        Estimate uses live UK search-volume data plus published local-SEO CTR
        benchmarks. Directional, not a guarantee.
      </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition">
        <Icon className="w-4 h-4 text-ink-faint shrink-0" />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </label>
  );
}

function formatGbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}
