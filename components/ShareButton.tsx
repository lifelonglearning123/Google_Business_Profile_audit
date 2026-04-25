"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { showToast } from "@/components/Toast";

export default function ShareButton({ auditId }: { auditId: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url = `${location.origin}/report/${auditId}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      showToast("Link copied — share away");
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-white hover:bg-surface text-ink font-semibold text-sm px-4 py-2.5 transition"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-accent" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          Share link
        </>
      )}
    </button>
  );
}
