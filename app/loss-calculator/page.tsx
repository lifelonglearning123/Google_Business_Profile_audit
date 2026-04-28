import Link from "next/link";
import { ArrowLeft, TrendingDown } from "lucide-react";
import LossCalculator from "@/components/LossCalculator";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `How much business are you losing? — ${BRAND_NAME}`,
  description:
    "Estimate how much revenue your business is leaving on the table by not appearing in the top 3 of Google Business Profile results. Live UK search-volume data, conservative click-share benchmarks.",
};

export default function LossCalculatorPage() {
  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh -z-10" />
        <div className="mx-auto max-w-3xl px-6 pt-10 md:pt-14 pb-10">
          <div className="mb-5 no-print">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to the audit
            </Link>
          </div>

          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold tracking-[0.14em] uppercase px-3 py-1 mb-5">
              <TrendingDown className="w-3 h-3" />
              Revenue at stake
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-ink leading-[1.05]">
              How much business are you losing
              <span className="block mt-2 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500 bg-clip-text text-transparent">
                by not being in the top 3?
              </span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed">
              The top 3 Google Business Profile results capture roughly half of
              all local-pack clicks. If you're not there, that gap is your
              monthly miss. Three inputs, ten seconds.
            </p>
          </div>

          <LossCalculator />

          {/* Methodology */}
          <section className="mt-12 rounded-2xl border border-hairline bg-panel p-6 md:p-8">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-3">
              How we calculate it
            </p>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-ink mb-4">
              The math, transparently
            </h2>
            <ol className="space-y-3 text-sm text-ink-muted leading-relaxed list-decimal list-inside marker:text-ink-faint">
              <li>
                <strong className="text-ink">Monthly searches</strong> — we
                pull live UK search volume for "<em>your industry</em>{" "}
                <em>your location</em>" from a paid keyword-data API. This is
                the actual number of times people type that phrase into Google
                each month.
              </li>
              <li>
                <strong className="text-ink">Click-share gap</strong> — we
                apply a conservative 50% click-share difference between the
                top 3 and ranks 4+. Published local-SEO benchmarks put the
                top 3's share at ~58%; we round down to keep the headline
                defensible.
              </li>
              <li>
                <strong className="text-ink">Conversion rate</strong> — we
                use industry-typical conversion rates (e.g. ~10% for
                emergency services, ~4% for restaurants). These are
                directional defaults, not your specific number.
              </li>
              <li>
                <strong className="text-ink">Average sale</strong> — your
                figure, multiplied through.
              </li>
            </ol>
            <p className="mt-5 text-xs text-ink-faint leading-relaxed">
              The output is a directional estimate, not a guarantee. It tells
              you the order of magnitude — not whether you'll capture exactly
              that much by getting to the top 3. Real performance depends on
              your offering, pricing, conversion funnel, and competition.
            </p>
          </section>

          {/* CTA back to audit */}
          <section className="mt-10 rounded-2xl border border-hairline bg-gradient-to-br from-brand-50 via-white to-accent/5 p-6 md:p-8 text-center">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              Now find out exactly why you're not ranking
            </h3>
            <p className="mt-2 text-sm md:text-base text-ink-muted max-w-xl mx-auto">
              Run the free 60-second audit to see which of the seven ranking
              pillars are dragging your profile down — and what to fix this
              week.
            </p>
            <Link
              href="/#audit-form-anchor"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink hover:bg-[#1e293b] text-white font-semibold text-sm px-6 py-3 shadow-card transition"
            >
              Run my free audit →
            </Link>
          </section>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} {BRAND_NAME} · Built for local businesses and their agencies
      </footer>
    </main>
  );
}
