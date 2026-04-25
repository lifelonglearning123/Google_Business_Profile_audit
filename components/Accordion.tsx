"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

export type AccordionItem = { q: string; a: string };

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-hairline rounded-2xl border border-hairline bg-panel">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-5 text-left group"
            >
              <span className="font-semibold text-ink text-base md:text-[17px]">{it.q}</span>
              <span
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-hairline transition ${
                  isOpen ? "bg-brand text-white border-brand" : "bg-surface text-ink-muted group-hover:border-ink-muted"
                }`}
              >
                {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 md:px-6 pb-5 text-ink-muted leading-relaxed text-[15px]">
                  {it.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
