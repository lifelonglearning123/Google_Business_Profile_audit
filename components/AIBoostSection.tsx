import {
  MessageCircle,
  FileText,
  Star,
  TrendingUp,
  Phone,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Audit } from "@/lib/types";

const AGENCY_EMAIL =
  process.env.NEXT_PUBLIC_AGENCY_EMAIL || "hello@example.com";

export default function AIBoostSection({ audit }: { audit: Audit }) {
  const { gbp } = audit;
  const photos = gbp.photoCount ?? 0;
  const reviews = gbp.reviewCount ?? 0;
  const services = gbp.services?.length ?? 0;
  const subject = encodeURIComponent(`GBP AI Implementation — ${gbp.name}`);
  const bookHref = `mailto:${AGENCY_EMAIL}?subject=${subject}&body=${encodeURIComponent(
    `Hi, I'd like to discuss implementing AI to grow my Google Business Profile.\nReport: ${audit.id}\nBusiness: ${gbp.name}`
  )}`;

  return (
    <section className="mt-8 relative overflow-hidden rounded-3xl border border-hairline shadow-card-lg">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-emerald-50/40 -z-10" />
      <div className="absolute inset-0 bg-mesh-soft -z-10 opacity-70" />

      <div className="p-6 md:p-10">
        {/* Header */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white border border-hairline text-brand-700 text-[11px] font-semibold tracking-[0.14em] uppercase px-3 py-1 mb-4 shadow-sm">
            <Sparkles className="w-3 h-3" />
            What AI changes
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink leading-tight">
            How AI can lift {gbp.name}'s ranking
          </h2>
          <p className="mt-3 text-base md:text-lg text-ink-muted leading-relaxed">
            Higher local rankings translate directly into more calls, more directions,
            and more bookings — without spending more on ads. Below: what's at stake,
            and three AI-powered ways to close the gap automatically.
          </p>
        </div>

        {/* Why ranking matters */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          <BenefitTile
            icon={TrendingUp}
            stat="~70%"
            label="of local clicks go to the top 3 GBP results"
          />
          <BenefitTile
            icon={Phone}
            stat="4–5×"
            label="more calls for profiles in the local 3-pack"
          />
          <BenefitTile
            icon={MapPin}
            stat="2×"
            label="more direction requests per rank above #4"
          />
          <BenefitTile
            icon={Sparkles}
            stat="Active"
            label="profiles outrank dormant ones at equal review counts"
          />
        </div>

        {/* Three solutions */}
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          <SolutionCard
            icon={MessageCircle}
            tag="Solution 01"
            title="WhatsApp → GBP & website pipeline"
            lead="Owner sends a 30-second voice note + photos from a finished job. AI does the rest."
            personalised={
              photos < 10
                ? `You have ${photos} photo${photos === 1 ? "" : "s"} on your profile. Top performers in your space carry 100+. The pipeline closes that gap in weeks.`
                : `You have ${photos} photos. The pipeline keeps that flow weekly without owner effort.`
            }
            benefits={[
              "Photos auto-categorised, captioned and scheduled (no spam-uploads)",
              "Weekly Google Posts published from real jobs — not generic templates",
              "Same content fans out to your website blog and social channels",
            ]}
            impact={["Photos pillar", "Posts & Q&A", "Profile freshness"]}
          />

          <SolutionCard
            icon={FileText}
            tag="Solution 02"
            title="AI-built service pages"
            lead="A dedicated, schema-rich landing page for every service you list on your GBP."
            personalised={
              services < 3
                ? `You have ${services} service${services === 1 ? "" : "s"} listed. Each missing service is a long-tail query you don't show up for.`
                : `You have ${services} services listed. Each becomes a ranking landing page on your site.`
            }
            benefits={[
              "Each service page targets its own long-tail keywords + service area",
              "Real photos and reviews from your jobs seed every page — not AI fluff",
              "LocalBusiness + Service schema sends Google the right signals",
            ]}
            impact={["Categories & Services", "Website rankings", "Lead conversion"]}
          />

          <SolutionCard
            icon={Star}
            tag="Solution 03"
            title="AI review engine"
            lead="The right ask at the right moment, replies drafted in your voice, themes mined and reused."
            personalised={
              reviews < 25
                ? `You have ${reviews} review${reviews === 1 ? "" : "s"} versus a 25+ benchmark. The engine typically adds 8–15 a month.`
                : `You have ${reviews} reviews. The engine keeps the velocity up and protects against silent dips.`
            }
            benefits={[
              "Review requests trigger automatically when a job completes",
              "Owner approves replies with a single tap on WhatsApp",
              "Recurring themes (e.g. 'tidy site') feed back into your description and Posts",
            ]}
            impact={["Reviews pillar", "Owner Responses", "Trust signals"]}
          />
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-hairline bg-white/60 backdrop-blur-sm p-5 md:p-6">
          <div>
            <p className="text-base md:text-lg font-bold text-ink">
              Want this running for {gbp.name}?
            </p>
            <p className="text-sm text-ink-muted">
              We'll set up the WhatsApp pipeline, build your service pages, and switch on the review engine — all wired into your existing systems.
            </p>
          </div>
          <a
            href={bookHref}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-ink hover:bg-[#1e293b] text-white font-semibold text-sm px-5 py-3 shadow-card transition btn-shine no-print"
          >
            Talk to us
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function BenefitTile({
  icon: Icon,
  stat,
  label,
}: {
  icon: LucideIcon;
  stat: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-white/80 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-brand-600" strokeWidth={2.5} />
        <span className="text-xl md:text-2xl font-extrabold tracking-tight text-ink tabular">
          {stat}
        </span>
      </div>
      <p className="text-[12px] md:text-[13px] text-ink-muted leading-snug">{label}</p>
    </div>
  );
}

function SolutionCard({
  icon: Icon,
  tag,
  title,
  lead,
  personalised,
  benefits,
  impact,
}: {
  icon: LucideIcon;
  tag: string;
  title: string;
  lead: string;
  personalised: string;
  benefits: string[];
  impact: string[];
}) {
  return (
    <div className="relative rounded-2xl bg-white border border-hairline shadow-card p-6 flex flex-col hover-lift">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-sm">
          <Icon className="w-5 h-5" strokeWidth={2.25} />
        </div>
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
          {tag}
        </span>
      </div>
      <h3 className="text-lg font-bold text-ink leading-snug mb-2">{title}</h3>
      <p className="text-sm text-ink-muted leading-relaxed mb-4">{lead}</p>

      <div className="rounded-lg bg-brand-soft text-brand-800 text-[13px] leading-relaxed px-3.5 py-2.5 mb-4">
        {personalised}
      </div>

      <ul className="space-y-2 text-sm text-ink mb-5">
        {benefits.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-accent shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4 border-t border-hairline">
        <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-faint mb-2">
          Lifts these scorecard pillars
        </p>
        <div className="flex flex-wrap gap-1.5">
          {impact.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center text-[11px] font-semibold rounded-md bg-surface text-ink-muted px-2 py-1 border border-hairline"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
