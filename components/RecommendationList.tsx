"use client";

import { useEffect, useState } from "react";
import type { Narrative } from "@/lib/types";

type Rec = Narrative["recommendations"][number];

const priorityStyles: Record<string, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-slate-500 text-white",
};

const effortGroupOrder = ["quick-win", "medium", "project"] as const;
const effortLabels: Record<string, string> = {
  "quick-win": "Quick wins · Today",
  medium: "This week",
  project: "Bigger projects",
};

export default function RecommendationList({
  recs,
  auditId,
}: {
  recs: Rec[];
  auditId: string;
}) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const storageKey = `gbp-audit:done:${auditId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  function toggle(key: string) {
    setDone((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  if (!recs || recs.length === 0) {
    return <p className="text-sm text-ink-muted">No specific recommendations generated.</p>;
  }

  // Group by effort, keep priority order within each group
  const groups = effortGroupOrder
    .map((effort) => ({
      effort,
      items: recs
        .filter((r) => (r.effort ?? "medium") === effort)
        .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <div key={g.effort}>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-600">
              {effortLabels[g.effort]}
            </h3>
            <div className="flex-1 h-px bg-hairline" />
            <span className="text-xs text-ink-faint tabular">{g.items.length} item{g.items.length === 1 ? "" : "s"}</span>
          </div>
          <div className="space-y-3">
            {g.items.map((r, i) => {
              const key = `${g.effort}:${i}:${r.title}`;
              const isDone = !!done[key];
              return (
                <div
                  key={key}
                  className={`rounded-2xl border border-hairline bg-panel p-5 shadow-card transition ${
                    isDone ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone}
                      onClick={() => toggle(key)}
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition ${
                        isDone
                          ? "bg-accent border-accent"
                          : "border-hairline hover:border-ink-muted bg-white"
                      }`}
                    >
                      {isDone && (
                        <svg viewBox="0 0 16 16" className="w-3 h-3 text-white">
                          <path
                            d="M3 8.5l3 3 7-7"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                        <h4
                          className={`font-semibold text-ink text-[15px] leading-snug ${
                            isDone ? "line-through" : ""
                          }`}
                        >
                          {r.title}
                        </h4>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            priorityStyles[r.priority] ?? priorityStyles.low
                          }`}
                        >
                          {r.priority}
                        </span>
                      </div>
                      <p
                        className={`text-sm text-ink-muted leading-relaxed ${
                          isDone ? "line-through" : ""
                        }`}
                      >
                        {r.detail}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function priorityWeight(p: string): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}
