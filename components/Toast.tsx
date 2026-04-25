"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type ToastMsg = { id: number; text: string };

let externalTrigger: ((text: string) => void) | null = null;

export function showToast(text: string) {
  externalTrigger?.(text);
}

export default function Toast() {
  const [messages, setMessages] = useState<ToastMsg[]>([]);

  useEffect(() => {
    externalTrigger = (text: string) => {
      const id = Date.now() + Math.random();
      setMessages((prev) => [...prev, { id, text }]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, 2400);
    };
    return () => {
      externalTrigger = null;
    };
  }, []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {messages.map((m) => (
        <div
          key={m.id}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink text-white text-sm font-medium px-4 py-2.5 shadow-card-lg animate-fade-in-up"
        >
          <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
          {m.text}
        </div>
      ))}
    </div>
  );
}
