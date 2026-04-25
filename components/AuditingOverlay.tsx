"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search, Gauge, FileText } from "lucide-react";
import { AUDIT_FACTS } from "@/lib/facts";

type Step = {
  key: string;
  label: string;
  icon: typeof Search;
  /** When (seconds elapsed) this step should be marked active */
  activeAt: number;
  /** When (seconds elapsed) this step should be marked done */
  doneAt: number;
};

const STEPS: Step[] = [
  { key: "fetch", label: "Fetching your Google Business Profile", icon: Search, activeAt: 0, doneAt: 10 },
  { key: "score", label: "Scoring across 6 local-SEO pillars", icon: Gauge, activeAt: 10, doneAt: 25 },
  { key: "write", label: "Writing your tailored report", icon: FileText, activeAt: 25, doneAt: 55 },
];

/**
 * Full-screen overlay shown while the /api/audit request is in flight.
 * - Steps advance on time (the API is one round-trip, we don't have real progress events)
 * - Completes visually when the caller passes `completed = true`
 */
export default function AuditingOverlay({
  completed = false,
  error = null,
}: {
  completed?: boolean;
  error?: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const startRef = useRef(Date.now());
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const rotate = setInterval(() => {
      setFactIdx((i) => (i + 1) % AUDIT_FACTS.length);
    }, 4000);
    return () => clearInterval(rotate);
  }, []);

  useEffect(() => {
    if (completed) setFadingOut(true);
  }, [completed]);

  // Cap apparent progress at ~95% until the real response arrives
  const apparentSec = completed ? Math.max(elapsed, 58) : Math.min(elapsed, 55);

  return (
    <div
      className={`fixed inset-0 z-50 bg-surface bg-mesh flex items-center justify-center p-6 transition-opacity duration-300 ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
      aria-busy={!completed}
    >
      <div className="w-full max-w-xl">
        <div className="flex flex-col items-center">
          <ScanningDial elapsed={apparentSec} />
          <h2 className="mt-8 text-2xl md:text-3xl font-bold tracking-tight text-ink text-center">
            {error ? "We hit a snag" : completed ? "All done" : "Running your audit"}
          </h2>
          <p className="mt-2 text-sm text-ink-muted text-center">
            {error
              ? error
              : `Elapsed ${String(apparentSec).padStart(2, "0")}s · typically 30–60s`}
          </p>
        </div>

        {!error && (
          <ol className="mt-10 space-y-3">
            {STEPS.map((step) => {
              const status =
                apparentSec >= step.doneAt
                  ? "done"
                  : apparentSec >= step.activeAt
                  ? "active"
                  : "pending";
              const Icon = step.icon;
              return (
                <li
                  key={step.key}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-panel transition ${
                    status === "active"
                      ? "border-brand shadow-card"
                      : status === "done"
                      ? "border-hairline"
                      : "border-hairline opacity-60"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      status === "done"
                        ? "bg-accent text-white"
                        : status === "active"
                        ? "bg-brand text-white"
                        : "bg-surface text-ink-faint border border-hairline"
                    }`}
                  >
                    {status === "done" ? (
                      <Check className="w-4 h-4" strokeWidth={3} />
                    ) : status === "active" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </span>
                  <span
                    className={`text-sm md:text-[15px] font-medium ${
                      status === "pending" ? "text-ink-muted" : "text-ink"
                    }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {!error && (
          <div className="mt-8 rounded-xl bg-panel border border-hairline px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 mb-1">
              Did you know
            </div>
            <p
              key={factIdx}
              className="text-sm md:text-[15px] text-ink leading-relaxed animate-fade-in-up"
            >
              {AUDIT_FACTS[factIdx]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScanningDial({ elapsed }: { elapsed: number }) {
  const size = 168;
  const r = (size - 24) / 2;
  const circ = 2 * Math.PI * r;
  const approxPct = Math.min(95, (elapsed / 60) * 100);
  const offset = circ * (1 - approxPct / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Base ring */}
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e5e7eb"
          strokeWidth={10}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#4f46e5"
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms ease-out" }}
        />
      </svg>
      {/* Scanning arc */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0 scan-arc"
        aria-hidden
      >
        <defs>
          <linearGradient id="scan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(79,70,229,0)" />
            <stop offset="100%" stopColor="rgba(79,70,229,0.9)" />
          </linearGradient>
        </defs>
        <path
          d={describeArc(size / 2, size / 2, r, -90, 0)}
          stroke="url(#scan-grad)"
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      {/* Center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Auditing
        </div>
        <div className="mt-1 text-3xl font-extrabold text-ink tabular">
          {Math.round(approxPct)}%
        </div>
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
