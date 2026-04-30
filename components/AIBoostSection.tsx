import {
  MessageCircle,
  FileText,
  Star,
  ArrowRight,
  Workflow,
  PhoneCall,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Audit, GbpData } from "@/lib/types";

const AGENCY_EMAIL =
  process.env.NEXT_PUBLIC_AGENCY_EMAIL || "hello@example.com";

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || "";

const MONTHLY_FEE_LABEL = "£500/month";

type SolutionDef = {
  key: string;
  // Pillars this layer most directly lifts. Used to rank layers by audit
  // deficit so the prospect sees the biggest-impact item annotated.
  relevantPillars: string[];
  icon: LucideIcon;
  title: string;
  // What this layer does in one short sentence — outcome, not feature.
  outcome: string;
  // A second line tied to THIS audit's data so the layer feels personal.
  personalised: (gbp: GbpData) => string;
};

const SOLUTIONS: SolutionDef[] = [
  {
    key: "content",
    relevantPillars: ["photos", "engagement"],
    icon: MessageCircle,
    title: "AI content engine",
    outcome:
      "Photos and Posts auto-published from a 30-second voice note. Owner never opens an editor.",
    personalised: (gbp) => {
      const photos = gbp.photoCount ?? 0;
      const posts = gbp.posts?.length ?? 0;
      return `Closes your photos (${photos} → 100+) and Posts (${posts} → weekly) gap.`;
    },
  },
  {
    key: "voice",
    relevantPillars: ["responses"],
    icon: PhoneCall,
    title: "AI voice receptionist",
    outcome:
      "Picks up every call in two rings, qualifies the caller, books the slot, texts you the lead.",
    personalised: () =>
      "Catches the 25-40% of inbound calls most local businesses miss.",
  },
  {
    key: "automation",
    relevantPillars: ["responses", "engagement"],
    icon: Workflow,
    title: "Lead-flow automation",
    outcome:
      "Missed calls texted back in 30 seconds, web enquiries booked instantly, follow-ups run themselves.",
    personalised: () =>
      "Recovers the half of inbound leads that go cold without follow-up.",
  },
  {
    key: "website",
    relevantPillars: ["website", "categories"],
    icon: FileText,
    title: "AI-built service website",
    outcome:
      "A fast, schema-rich site with a dedicated landing page for every service you offer.",
    personalised: (gbp) => {
      const unmatched = gbp.categoryPageMatches?.unmatched ?? [];
      if (unmatched.length > 0) {
        return `Builds the ${unmatched.length} missing service page${unmatched.length === 1 ? "" : "s"} your audit flagged.`;
      }
      return "Each GBP category becomes its own ranking landing page.";
    },
  },
  {
    key: "reviews",
    relevantPillars: ["reviews", "responses"],
    icon: Star,
    title: "AI review engine",
    outcome:
      "Right ask at the right moment, owner-voice replies drafted automatically, themes mined for marketing.",
    personalised: (gbp) => {
      const responsesPillar = gbp.reviews?.length
        ? Math.round(
            (gbp.reviews.filter((r) => !!r.ownerResponse).length /
              gbp.reviews.length) *
              100
          )
        : null;
      if (responsesPillar !== null && responsesPillar < 50) {
        return `Lifts your ${responsesPillar}% reply rate to 90%+ within weeks.`;
      }
      return "Compounds the review velocity you already have.";
    },
  },
];

export default function AIBoostSection({ audit }: { audit: Audit }) {
  const { gbp, scorecard, input } = audit;

  const scoreFor = (key: string) =>
    scorecard.subScores.find((s) => s.key === key)?.score ?? 100;

  // Rank layers by deficit so the system card can annotate which 1-2 will
  // move the needle most for THIS audit. Doesn't reorder the system —
  // we present the same five layers in the same order — but the top
  // layer gets a "Starts here for you" mark.
  const rankedKeys = new Set(
    [...SOLUTIONS]
      .map((s) => ({
        key: s.key,
        deficit: s.relevantPillars.reduce(
          (sum, k) => sum + (100 - scoreFor(k)),
          0
        ),
      }))
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 1)
      .map((s) => s.key)
  );

  // Use Google's primary category (backfilled into input.industry by the
  // audit route) as the search-phrase noun. It's already canonical and
  // covers any business Google indexes — no curated taxonomy needed.
  const industryNoun = (input.industry || "business").trim();
  const city = input.location.trim() || "your area";
  const searchPhrase = `${industryNoun} ${city}`.toLowerCase();

  const subject = encodeURIComponent(
    `90-day strategy call — ${gbp.name}`
  );
  const mailtoHref = `mailto:${AGENCY_EMAIL}?subject=${subject}&body=${encodeURIComponent(
    `Hi, I'd like to apply for a 15-min strategy call.\nReport: ${audit.id}\nBusiness: ${gbp.name}\nLocation: ${input.location}`
  )}`;
  const ctaHref = CALENDLY_URL || mailtoHref;

  return (
    <section className="mt-12 relative overflow-hidden rounded-3xl border border-hairline shadow-card-lg">
      {/* Restrained cream-tinted background — premium reads as quiet, not loud */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-stone-50/60 -z-10" />

      <div className="p-8 md:p-14">
        {/* ── 1. OUTCOME STATEMENT ── */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-amber-700 mb-5">
            <Sparkles className="w-3 h-3" />
            Your 90-day plan
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-ink leading-[1.1]">
            Picture {gbp.name} in 90 days —
            <span className="block mt-2 text-ink/85 font-bold">
              top of the pack for "{searchPhrase}", every call answered,
              every review replied to, weekly content shipping.
            </span>
          </h2>
          <p className="mt-6 text-lg md:text-xl text-ink-muted leading-relaxed max-w-2xl">
            That's the system we run, end-to-end, for{" "}
            <strong className="text-ink whitespace-nowrap">
              {MONTHLY_FEE_LABEL}
            </strong>
            . One team, one fee, all five layers below.
          </p>
        </div>

        {/* ── 2. THE SYSTEM (one card, five layers) ── */}
        <div className="mt-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] shadow-card-lg">
          {/* Decorative soft glow */}
          <div
            aria-hidden
            className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"
          />

          <div className="relative p-8 md:p-12">
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-8">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber-300/90">
                  The system
                </p>
                <h3 className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Five layers. One team. One fee.
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40">
                  Monthly investment
                </p>
                <p className="mt-1 text-3xl md:text-4xl font-extrabold tracking-tight text-amber-300 tabular">
                  {MONTHLY_FEE_LABEL}
                </p>
              </div>
            </div>

            <ol className="relative space-y-1">
              {SOLUTIONS.map((s, i) => (
                <SystemLayer
                  key={s.key}
                  index={i + 1}
                  icon={s.icon}
                  title={s.title}
                  outcome={s.outcome}
                  personalised={s.personalised(gbp)}
                  isStartsHere={rankedKeys.has(s.key)}
                  isLast={i === SOLUTIONS.length - 1}
                />
              ))}
            </ol>
          </div>
        </div>

        {/* ── 3. THE MATH ── */}
        <div className="mt-12 grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-white border border-hairline p-7 md:p-8 shadow-card">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-faint">
              What you pay
            </p>
            <p className="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight text-ink tabular">
              {MONTHLY_FEE_LABEL}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm md:text-[15px] text-ink">
              <Tick>All five layers, fully managed</Tick>
              <Tick>Setup, integrations, monthly optimisation</Tick>
              <Tick>No long-term contract</Tick>
            </ul>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-white to-amber-50/50 border border-amber-200 p-7 md:p-8 shadow-card">
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber-800">
              What you typically recover
            </p>
            <p className="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight text-ink tabular">
              £2,000 — £8,000
              <span className="block text-base font-semibold text-ink-muted mt-1">
                in new business per month
              </span>
            </p>
            <p className="mt-5 text-sm md:text-[15px] text-ink leading-relaxed">
              Once the system is live (typically week 4), most clients
              recover 4-16× their monthly investment in new bookings —
              before any improvement in local-pack rank.
            </p>
          </div>
        </div>

        {/* ── 4. APPLY CTA ── */}
        <div className="mt-12 relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] shadow-card-lg">
          <div
            aria-hidden
            className="absolute -bottom-24 -left-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"
          />
          <div className="relative p-8 md:p-12 text-white">
            <div className="grid md:grid-cols-[1fr,auto] gap-8 items-end">
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-amber-300/90">
                  Next step
                </p>
                <h3 className="mt-2 text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
                  Apply for a 15-min strategy call
                </h3>
                <p className="mt-4 text-base md:text-lg text-white/80 leading-relaxed">
                  Limited to four new businesses per quarter — one{" "}
                  {industryNoun} per UK town. We'll review your audit, walk
                  you through the 90-day plan, and confirm we're the right
                  fit before either side commits.
                </p>
                <p className="mt-3 text-sm text-white/50">
                  No prep needed — your audit is your brief.
                </p>
              </div>
              <div className="md:text-right">
                <a
                  href={ctaHref}
                  target={CALENDLY_URL ? "_blank" : undefined}
                  rel={CALENDLY_URL ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-400 hover:bg-amber-300 text-ink font-bold text-sm md:text-base px-7 py-4 shadow-card-lg transition no-print"
                >
                  Apply now
                  <ArrowRight className="w-4 h-4" />
                </a>
                <p className="mt-3 text-xs text-white/40 tabular">
                  Slot for {industryNoun}s in {city}: open
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One row in the vertical 5-layer system stack. Each row shows the layer
 * number, icon, title, what-it-does line, and an audit-personalised
 * how-it-helps-you line. The 1-2 layers ranked highest by audit deficit
 * carry a "Starts here for you" marker.
 */
function SystemLayer({
  index,
  icon: Icon,
  title,
  outcome,
  personalised,
  isStartsHere,
  isLast,
}: {
  index: number;
  icon: LucideIcon;
  title: string;
  outcome: string;
  personalised: string;
  isStartsHere: boolean;
  isLast: boolean;
}) {
  return (
    <li className="relative flex gap-5 md:gap-6 py-4">
      {/* Vertical connector running between rows */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[19px] md:left-[23px] top-12 bottom-0 w-px bg-gradient-to-b from-amber-300/40 via-white/15 to-transparent"
        />
      )}

      <div className="shrink-0 relative">
        <div
          className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-card ring-1 ${
            isStartsHere
              ? "bg-gradient-to-br from-amber-300 to-amber-500 text-ink ring-amber-200/50"
              : "bg-white/5 text-amber-300 ring-white/10"
          }`}
        >
          <Icon className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.25} />
        </div>
      </div>

      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h4 className="text-lg md:text-xl font-bold text-white tracking-tight">
            <span className="text-amber-300/60 mr-2 tabular">0{index}.</span>
            {title}
          </h4>
          {isStartsHere && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 text-amber-200 text-[10px] font-bold tracking-[0.14em] uppercase px-2.5 py-1 ring-1 ring-amber-300/30">
              ← Starts here for you
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[15px] text-white/80 leading-relaxed">
          {outcome}
        </p>
        <p className="mt-1.5 text-sm text-amber-200/90 leading-relaxed">
          {personalised}
        </p>
      </div>
    </li>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <CheckCircle2
        className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
        strokeWidth={2.25}
      />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
