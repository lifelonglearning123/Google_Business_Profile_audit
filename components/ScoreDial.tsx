"use client";

import { useEffect, useState } from "react";

/**
 * Segmented arc score dial with zone colouring and count-up on mount.
 * Respects prefers-reduced-motion — snaps to final value when set.
 */
export default function ScoreDial({
  score,
  grade,
  size = 200,
}: {
  score: number;
  grade: string;
  size?: number;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayed(score);
      return;
    }
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      setDisplayed(Math.round(score * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const TICKS = 40;
  const r = (size - 28) / 2;
  const innerR = r - 8;
  const cx = size / 2;
  const cy = size / 2;

  const lit = Math.round((score / 100) * TICKS);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Zone ring (very subtle) */}
      <svg width={size} height={size} className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id="dial-zones" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fee2e2" />
            <stop offset="45%" stopColor="#fef3c7" />
            <stop offset="75%" stopColor="#d1fae5" />
            <stop offset="100%" stopColor="#d1fae5" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r - 1} stroke="#f1f5f9" strokeWidth={2} fill="none" />
      </svg>

      {/* Ticks */}
      <svg width={size} height={size} className="relative">
        {Array.from({ length: TICKS }).map((_, i) => {
          const angle = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + innerR * Math.cos(angle);
          const y1 = cy + innerR * Math.sin(angle);
          const x2 = cx + r * Math.cos(angle);
          const y2 = cy + r * Math.sin(angle);
          const pct = (i / TICKS) * 100;
          const isLit = i < lit;
          const zoneColor =
            pct < 45 ? "#ef4444" : pct < 75 ? "#f59e0b" : "#10b981";
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isLit ? zoneColor : "#e5e7eb"}
              strokeWidth={3}
              strokeLinecap="round"
              style={{ transition: "stroke 900ms ease-out" }}
            />
          );
        })}
      </svg>

      {/* Centre */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl md:text-6xl font-extrabold text-ink tabular leading-none">
          {displayed}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand-700 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase">
          Grade {grade}
        </div>
      </div>
    </div>
  );
}
