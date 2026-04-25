"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, Share2 } from "lucide-react";
import { showToast } from "@/components/Toast";

export default function ReportStickyBar({
  businessName,
  score,
  grade,
  auditId,
}: {
  businessName: string;
  score: number;
  grade: string;
  auditId: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("hero-sentinel");
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const dotColor = score >= 75 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <>
      <div ref={sentinelRef} />
      <div
        className={`fixed top-14 inset-x-0 z-20 transition-all duration-200 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-panel/90 backdrop-blur-md border-b border-hairline">
          <div className="mx-auto max-w-6xl px-6 h-12 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <MiniDial score={score} grade={grade} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink truncate">{businessName}</p>
                <p className="text-[10px] text-ink-faint uppercase tracking-wider">Grade {grade} · {score}/100</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = `${location.origin}/report/${auditId}`;
                  navigator.clipboard?.writeText(url).then(() => showToast("Link copied"));
                }}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-hairline bg-white hover:bg-surface text-ink-muted hover:text-ink text-xs font-semibold px-2.5 py-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              <a
                href={`/api/pdf/${auditId}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink hover:bg-[#1e293b] text-white text-xs font-semibold px-3 py-1.5 shadow-sm"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MiniDial({ score, grade }: { score: number; grade: string }) {
  const size = 32;
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 75 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={3} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink">
        {grade}
      </div>
    </div>
  );
}
