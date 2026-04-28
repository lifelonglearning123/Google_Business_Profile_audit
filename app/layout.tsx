import type { Metadata } from "next";
import "./globals.css";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND_NAME} — Free Google Business Profile Audit`,
  description:
    "Get a comprehensive review of your Google Business Profile in under 60 seconds. Scorecard, prioritised fixes, and a sharable PDF report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-surface text-ink font-sans">
        <TopNav />
        {children}
      </body>
    </html>
  );
}

function TopNav() {
  return (
    <nav className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-hairline">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-bold text-ink tracking-tight">
          <Mark />
          <span className="whitespace-nowrap">{BRAND_NAME}</span>
        </a>
        <div className="flex items-center gap-5">
          <a href="/#how" className="hidden sm:inline text-sm text-ink-muted hover:text-ink transition">
            How it works
          </a>
          <a href="/#faq" className="hidden sm:inline text-sm text-ink-muted hover:text-ink transition">
            FAQ
          </a>
          <span className="hidden md:inline text-xs text-ink-faint px-2 py-1 rounded-md bg-brand-soft text-brand-700 font-semibold">
            Built for agencies
          </span>
        </div>
      </div>
    </nav>
  );
}

function Mark() {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
      </svg>
    </span>
  );
}
