import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileDown,
  Star,
  MessageSquare,
  Tags,
  Image as ImageIcon,
  TrendingUp,
  AlertTriangle,
  Quote,
  MapPin,
  Briefcase,
  Calendar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getAudit } from "@/lib/store";
import ScoreDial from "@/components/ScoreDial";
import SubScoreBar from "@/components/SubScoreBar";
import RecommendationList from "@/components/RecommendationList";
import ReportStickyBar from "@/components/ReportStickyBar";
import ShareButton from "@/components/ShareButton";
import Toast from "@/components/Toast";
import AIBoostSection from "@/components/AIBoostSection";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = await getAudit(id);
  if (!audit) notFound();

  const { gbp, scorecard, narrative, input } = audit;
  const issuedDate = new Date(audit.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <ReportStickyBar
        businessName={gbp.name}
        score={scorecard.overall}
        grade={scorecard.grade}
        auditId={audit.id}
      />
      <main className="min-h-screen">
        <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
          <div className="mb-5 no-print">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Audit another business
            </Link>
          </div>

          {/* ──── Hero ──── */}
          <section className="relative overflow-hidden rounded-3xl border border-hairline bg-panel shadow-card-lg">
            <div className="absolute inset-0 bg-mesh-soft -z-10" />
            <div className="p-6 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <ScoreDial score={scorecard.overall} grade={scorecard.grade} size={200} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-2">
                    GBP Audit Report
                  </p>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink leading-tight">
                    {gbp.name}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
                    {input.industry && (
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-ink-faint" />
                        {input.industry}
                      </span>
                    )}
                    {gbp.address && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-ink-faint" />
                        {gbp.address}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-ink-faint" />
                      Issued {issuedDate}
                    </span>
                  </div>

                  {/* KPI tiles */}
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiTile
                      icon={Star}
                      label="Rating"
                      value={gbp.rating ? gbp.rating.toFixed(1) : "—"}
                      suffix="/5"
                    />
                    <KpiTile
                      icon={MessageSquare}
                      label="Reviews"
                      value={gbp.reviewCount?.toLocaleString() ?? "—"}
                    />
                    <KpiTile
                      icon={Tags}
                      label="Categories"
                      value={gbp.categories.length.toString()}
                    />
                    <KpiTile
                      icon={ImageIcon}
                      label="Photos"
                      value={gbp.photoCount?.toString() ?? "—"}
                    />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2 no-print">
                    <a
                      href={`/api/pdf/${audit.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-ink hover:bg-[#1e293b] text-white font-semibold text-sm px-5 py-2.5 shadow-card transition btn-shine"
                    >
                      <FileDown className="w-4 h-4" />
                      Download PDF Report
                    </a>
                    <ShareButton auditId={audit.id} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Sentinel for the sticky bar */}
          <div id="hero-sentinel" className="h-px" aria-hidden />

          {/* ──── Executive Summary ──── */}
          {narrative.summary && (
            <section className="mt-8 rounded-2xl border border-hairline bg-panel p-6 md:p-8 shadow-card">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-3">
                Executive Summary
              </p>
              <p className="text-lg md:text-xl text-ink leading-relaxed">
                {narrative.summary}
              </p>
            </section>
          )}

          {/* ──── Strengths & Issues ──── */}
          {(narrative.strengths.length > 0 || narrative.weaknesses.length > 0) && (
            <section className="mt-8 grid md:grid-cols-2 gap-5">
              {narrative.strengths.length > 0 && (
                <PointList
                  title="Strengths"
                  items={narrative.strengths}
                  icon={TrendingUp}
                  tone="good"
                />
              )}
              {narrative.weaknesses.length > 0 && (
                <PointList
                  title="Issues to Fix"
                  items={narrative.weaknesses}
                  icon={AlertTriangle}
                  tone="bad"
                />
              )}
            </section>
          )}

          {/* ──── Scorecard ──── */}
          <section className="mt-12">
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600">
                  Scorecard
                </p>
                <h2 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-ink">
                  Six pillars of a winning profile
                </h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {scorecard.subScores.map((s) => (
                <SubScoreBar key={s.key} s={s} />
              ))}
            </div>
          </section>

          {/* ──── Recommendations ──── */}
          <section className="mt-16">
            <div className="mb-6">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600">
                Action Plan
              </p>
              <h2 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-ink">
                Your prioritised fixes
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                Check items off as you complete them — your progress is saved locally.
              </p>
            </div>
            <RecommendationList recs={narrative.recommendations} auditId={audit.id} />
          </section>

          {/* ──── Industry Insights ──── */}
          {narrative.industryInsights.length > 0 && (
            <section className="mt-16 rounded-3xl border border-hairline bg-panel shadow-card overflow-hidden">
              <div className="relative p-6 md:p-10 bg-mesh-soft">
                <Quote
                  className="absolute top-4 left-6 w-16 h-16 text-brand-100 -rotate-180"
                  aria-hidden
                />
                <div className="relative">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-3">
                    Industry Insights · {input.industry}
                  </p>
                  <ul className="space-y-4">
                    {narrative.industryInsights.map((t, i) => (
                      <li key={i} className="flex gap-3 text-[17px] text-ink leading-relaxed">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-brand-soft text-brand-700 flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* ──── How AI Can Lift This Business's Ranking (closing CTA) ──── */}
          <AIBoostSection audit={audit} />

          <div className="mt-8 flex justify-center no-print">
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white text-ink-muted hover:text-ink hover:border-ink-muted font-semibold px-5 py-2.5 text-sm transition"
            >
              Audit another business
            </a>
          </div>

          <footer className="text-center text-xs text-ink-faint py-8">
            Audit generated {new Date(audit.createdAt).toLocaleString()} · Report ID {audit.id}
          </footer>
        </div>
      </main>

      <Toast />
    </>
  );
}

/* ──── helpers ──── */

function KpiTile({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-bold text-ink tabular">{value}</span>
        {suffix && <span className="text-xs text-ink-faint tabular">{suffix}</span>}
      </div>
    </div>
  );
}

function PointList({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
  tone: "good" | "bad";
}) {
  const toneClasses =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-red-50 text-red-700 border-red-100";
  return (
    <div className="rounded-2xl border border-hairline bg-panel p-6 shadow-card hover-lift">
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center border ${toneClasses}`}>
          <Icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
        </span>
        <h3 className="font-semibold text-ink text-[17px]">{title}</h3>
      </div>
      <ul className="space-y-2.5 text-sm text-ink leading-relaxed">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className={tone === "good" ? "text-accent" : "text-red-500"}>●</span>
            <span className="text-ink-muted">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
