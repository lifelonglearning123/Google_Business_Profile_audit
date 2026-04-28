"use client";

import { useState } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  Star,
  MessageSquareReply,
  Tags,
  Image as ImageIcon,
  Megaphone,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SubScore } from "@/lib/types";

const PILLAR_ICONS: Record<string, LucideIcon> = {
  completeness: ClipboardCheck,
  reviews: Star,
  responses: MessageSquareReply,
  categories: Tags,
  photos: ImageIcon,
  engagement: Megaphone,
  website: Globe,
};

export default function SubScoreBar({ s }: { s: SubScore }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = PILLAR_ICONS[s.key];

  const barColor =
    s.score >= 75 ? "bg-score-good" : s.score >= 60 ? "bg-score-warn" : "bg-score-bad";
  const iconBg =
    s.score >= 75
      ? "bg-emerald-50 text-emerald-700"
      : s.score >= 60
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  const visible = expanded ? s.findings : s.findings.slice(0, 2);
  const hidden = s.findings.length - visible.length;

  return (
    <div className="rounded-2xl border border-hairline bg-panel p-5 md:p-6 shadow-card hover-lift">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={2.25} />
            </span>
          )}
          <h4 className="font-semibold text-ink text-[15px]">{s.label}</h4>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-ink tabular leading-none">{s.score}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-faint mt-0.5">/ 100</div>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-4">
        <div
          className={`h-full ${barColor}`}
          style={
            {
              width: `${s.score}%`,
              "--bar-pct": `${s.score}%`,
              animation: "barFill 900ms cubic-bezier(0.22,1,0.36,1) both",
            } as React.CSSProperties
          }
        />
      </div>

      <ul className="space-y-1.5 text-sm text-ink-muted leading-relaxed">
        {visible.map((f, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-ink-faint select-none">•</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Show {hidden} more
          <ChevronDown className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
