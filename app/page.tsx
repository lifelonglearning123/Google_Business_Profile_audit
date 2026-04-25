import AuditForm from "@/components/AuditForm";
import FeatureChip from "@/components/FeatureChip";
import Accordion from "@/components/Accordion";
import {
  ShieldCheck,
  FileDown,
  Timer,
  Lock,
  Star,
  Link as LinkIcon,
  Gauge,
  FileText,
  Target,
  Lightbulb,
  Sparkles,
  BadgeCheck,
  MessageSquareReply,
  Image as ImageIcon,
  ArrowRight,
  ArrowDown,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* ──── Hero ──── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh -z-10" />
        <div className="mx-auto max-w-5xl px-6 pt-14 md:pt-20 pb-10 md:pb-16 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand-700 text-[11px] font-semibold tracking-[0.14em] uppercase px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulseGlow" />
            Free local SEO tool
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-ink leading-[1.05]">
            Audit your Google Business Profile
            <span className="block mt-2 bg-gradient-to-r from-brand-600 via-brand-500 to-accent bg-clip-text text-transparent">
              in under 60 seconds.
            </span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed">
            Get a detailed scorecard, prioritised fixes, and a downloadable PDF —
            tailored to your industry and location. No fluff, just the numbers and what to do next.
          </p>

          {/* Form card */}
          <div className="mt-10 md:mt-12 relative max-w-2xl mx-auto">
            <div className="absolute -inset-2 bg-gradient-to-r from-brand-500/25 via-brand-500/10 to-accent/20 blur-2xl -z-10 rounded-3xl" />
            <div className="rounded-2xl bg-panel shadow-card-lg border border-hairline p-6 md:p-8 text-left">
              <AuditForm />
            </div>
          </div>

          {/* Trust row */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <AvatarStack />
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 stroke-amber-400" />
                ))}
              </div>
              <span className="text-sm text-ink-muted">
                Trusted by <strong className="text-ink">500+ local businesses</strong>
              </span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              <FeatureChip icon={Lock} label="No Google login" />
              <FeatureChip icon={FileDown} label="PDF report" />
              <FeatureChip icon={Timer} label="Under 60 seconds" />
              <FeatureChip icon={ShieldCheck} label="GDPR safe" />
            </div>
          </div>

          <div className="mt-14 flex justify-center text-ink-faint">
            <ArrowDown className="w-5 h-5 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ──── Product preview ──── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-3">
            See what you get
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-ink">
            A proper diagnostic, not a 5-line email.
          </h2>
        </div>

        <SamplePreview />
      </section>

      {/* ──── How it works ──── */}
      <section id="how" className="bg-white border-y border-hairline">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-3">
              How it works
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-ink">
              Three steps. One minute.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <StepCard
              n={1}
              icon={LinkIcon}
              title="Paste your GBP link"
              body="Copy the share link from your Google Business Profile. We find the rest — no login needed."
            />
            <StepCard
              n={2}
              icon={Gauge}
              title="We score 6 pillars"
              body="Completeness, reviews, responses, categories, photos, engagement — weighted for local ranking."
            />
            <StepCard
              n={3}
              icon={FileText}
              title="You get the report"
              body="Readable on web, downloadable as PDF, emailed for reference. Share it with your team."
            />
          </div>
        </div>
      </section>

      {/* ──── What's inside ──── */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-3">
            What's in the report
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-ink">
            Specifics you can act on this week.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={Gauge}
            title="Overall score & grade"
            body="0-100 score with a letter grade, benchmarked against local-SEO standards."
          />
          <FeatureCard
            icon={BadgeCheck}
            title="6-pillar scorecard"
            body="Every pillar scored individually, with the exact issues dragging it down."
          />
          <FeatureCard
            icon={Target}
            title="Prioritised action plan"
            body="Quick wins, this-week items, bigger projects — sorted by priority and effort."
          />
          <FeatureCard
            icon={MessageSquareReply}
            title="Review intelligence"
            body="Response rate, unanswered negatives, review velocity, and how you trend over 90 days."
          />
          <FeatureCard
            icon={ImageIcon}
            title="Content & media gaps"
            body="Photo counts, Google Posts cadence, Q&A coverage, service listings, attributes."
          />
          <FeatureCard
            icon={Lightbulb}
            title="Industry-specific insights"
            body="Tailored recommendations for your vertical — what top performers in your space do."
          />
        </div>
      </section>

      {/* ──── FAQ ──── */}
      <section id="faq" className="bg-white border-y border-hairline">
        <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600 mb-3">
              FAQ
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-ink">
              Common questions
            </h2>
          </div>
          <Accordion
            items={[
              {
                q: "Do I need to give Google access?",
                a: "No. We use only the public data visible on your Google Business Profile — the same information any customer sees when they search for you.",
              },
              {
                q: "Is this actually free?",
                a: "Yes. One free audit per business. There's no credit card, no trial expiration, and no surprise upsell to unlock the PDF.",
              },
              {
                q: "What data do you collect?",
                a: "We store your name, email, mobile, and the audit results so you can reference the report later. You can request deletion at any time by emailing us.",
              },
              {
                q: "How accurate is the scoring?",
                a: "The scorecard uses a weighted rule set based on well-documented local-SEO benchmarks. Your narrative is then written by GPT-5.4 from the actual numbers — no guesswork.",
              },
            ]}
          />
        </div>
      </section>

      {/* ──── Footer CTA band ──── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 -z-10" />
        <div className="absolute inset-0 bg-mesh opacity-30 -z-10" />
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-20 text-center text-white">
          <Sparkles className="w-8 h-8 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready to see where you stand?
          </h2>
          <p className="mt-3 text-white/80 text-lg max-w-xl mx-auto">
            Scroll back up and run your free audit. No credit card, no catch.
          </p>
          <a
            href="#top"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white text-brand-700 font-semibold px-6 py-3 text-sm shadow-card-lg hover:bg-brand-soft transition"
          >
            Start my audit
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} GBP Audit · Built for local businesses and their agencies
      </footer>
    </main>
  );
}

/* ──── helpers ──── */

function StepCard({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: number;
  icon: typeof LinkIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel p-6 hover-lift shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-lg bg-brand-soft text-brand-700 flex items-center justify-center font-bold tabular">
          0{n}
        </span>
        <Icon className="w-5 h-5 text-ink-faint" />
      </div>
      <h3 className="font-semibold text-ink text-lg mb-1.5">{title}</h3>
      <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof LinkIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel p-6 hover-lift">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-sm mb-4">
        <Icon className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <h3 className="font-semibold text-ink mb-1.5">{title}</h3>
      <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
    </div>
  );
}

function AvatarStack() {
  const gradients = [
    "from-rose-400 to-orange-400",
    "from-indigo-400 to-purple-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-pink-500",
  ];
  return (
    <div className="flex -space-x-2">
      {gradients.map((g, i) => (
        <span
          key={i}
          className={`w-7 h-7 rounded-full border-2 border-white bg-gradient-to-br ${g} shadow-sm`}
        />
      ))}
    </div>
  );
}

/* ──── Sample preview card (faux report) ──── */

function SamplePreview() {
  return (
    <div className="relative max-w-4xl mx-auto">
      <div className="absolute -inset-6 bg-gradient-to-r from-brand-500/10 via-transparent to-accent/10 blur-3xl -z-10" />
      <div className="rounded-2xl border border-hairline bg-panel shadow-card-lg overflow-hidden">
        {/* browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline bg-surface">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs text-ink-faint font-mono">
            gbp-audit.app/report/demo
          </span>
        </div>

        <div className="p-6 md:p-8 bg-mesh-soft">
          <div className="grid md:grid-cols-[auto,1fr] gap-6 md:gap-10 items-center">
            {/* Dial */}
            <StaticSampleDial />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
                GBP Audit · Sample
              </p>
              <h3 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-ink">
                Maple Street Dental Practice
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                Dentist · Manchester, UK · 146 reviews · 4.6 ★
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 max-w-md">
                <MiniPillar label="Completeness" score={92} />
                <MiniPillar label="Reviews" score={78} />
              </div>
              <div className="mt-5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 max-w-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  High priority
                </p>
                <p className="text-sm text-ink mt-0.5">
                  Reply to 3 unanswered negative reviews from the last 60 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaticSampleDial() {
  const size = 140;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const score = 82;
  const offset = circ * (1 - score / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={10} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#10b981"
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-extrabold text-ink tabular">82</div>
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">Grade B</div>
      </div>
    </div>
  );
}

function MiniPillar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? "bg-accent" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="rounded-lg bg-white border border-hairline px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-ink">{label}</span>
        <span className="text-sm font-bold text-ink tabular">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
