"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  MapPin,
  Briefcase,
  User,
  Mail,
  Phone,
  ArrowRight,
  Search,
} from "lucide-react";
import { INDUSTRIES } from "@/lib/industries";
import AuditingOverlay from "@/components/AuditingOverlay";

type FieldErrors = Partial<Record<string, string[]>>;
type Values = {
  gbpUrl: string;
  location: string;
  industry: string;
  name: string;
  email: string;
  mobile: string;
};

export default function AuditForm() {
  const router = useRouter();
  const [values, setValues] = useState<Values>({
    gbpUrl: "",
    location: "",
    industry: "",
    name: "",
    email: "",
    mobile: "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  function update<K extends keyof Values>(k: K, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function onBlur(k: keyof Values) {
    setTouched((prev) => ({ ...prev, [k]: true }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setApiError(null);
    setTouched({
      gbpUrl: true,
      location: true,
      industry: true,
      name: true,
      email: true,
      mobile: true,
    });
    setSubmitting(true);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.issues) setErrors(data.issues);
        setApiError(data.error ?? "Something went wrong");
        setSubmitting(false);
        setShakeKey((k) => k + 1);
        return;
      }
      router.push(`/report/${data.id}`);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
      setShakeKey((k) => k + 1);
    }
  }

  // Simple client-side validity (for the ✓/✗ icons)
  const validity = useMemo(() => {
    const v = values;
    return {
      gbpUrl: /^https?:\/\/.+/.test(v.gbpUrl),
      location: v.location.trim().length >= 2,
      industry: v.industry.trim().length >= 2,
      name: v.name.trim().length >= 2,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email),
      mobile: /^[+\d][\d\s()\-]{5,}$/.test(v.mobile),
    };
  }, [values]);

  return (
    <>
      <form
        key={shakeKey}
        onSubmit={onSubmit}
        className={`space-y-6 ${apiError ? "animate-shake" : ""}`}
      >
        <Section title="Your business">
          <FloatingField
            label="Google Business Profile URL"
            hint="Paste the link from Google Maps → Share → Copy link"
            icon={LinkIcon}
            error={touched.gbpUrl ? errors.gbpUrl?.[0] : undefined}
            valid={touched.gbpUrl ? validity.gbpUrl : null}
          >
            <input
              type="url"
              required
              placeholder="https://www.google.com/maps/place/..."
              value={values.gbpUrl}
              onChange={(e) => update("gbpUrl", e.target.value)}
              onBlur={() => onBlur("gbpUrl")}
              className={inputClass}
            />
          </FloatingField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FloatingField
              label="City / Service Area"
              icon={MapPin}
              error={touched.location ? errors.location?.[0] : undefined}
              valid={touched.location ? validity.location : null}
            >
              <input
                type="text"
                required
                placeholder="Manchester, UK"
                value={values.location}
                onChange={(e) => update("location", e.target.value)}
                onBlur={() => onBlur("location")}
                className={inputClass}
              />
            </FloatingField>

            <FloatingField
              label="Industry"
              icon={Briefcase}
              error={touched.industry ? errors.industry?.[0] : undefined}
              valid={touched.industry ? validity.industry : null}
            >
              <IndustryCombobox
                value={values.industry}
                onChange={(v) => update("industry", v)}
                onBlur={() => onBlur("industry")}
              />
            </FloatingField>
          </div>
        </Section>

        <Section title="Where to send your report" eyebrow>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FloatingField
              label="Your name"
              icon={User}
              error={touched.name ? errors.name?.[0] : undefined}
              valid={touched.name ? validity.name : null}
            >
              <input
                type="text"
                required
                autoComplete="name"
                placeholder="Jane Smith"
                value={values.name}
                onChange={(e) => update("name", e.target.value)}
                onBlur={() => onBlur("name")}
                className={inputClass}
              />
            </FloatingField>
            <FloatingField
              label="Email"
              icon={Mail}
              error={touched.email ? errors.email?.[0] : undefined}
              valid={touched.email ? validity.email : null}
            >
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@business.com"
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
                onBlur={() => onBlur("email")}
                className={inputClass}
              />
            </FloatingField>
            <FloatingField
              label="Mobile"
              icon={Phone}
              error={touched.mobile ? errors.mobile?.[0] : undefined}
              valid={touched.mobile ? validity.mobile : null}
            >
              <input
                type="tel"
                required
                autoComplete="tel"
                placeholder="+44..."
                value={values.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                onBlur={() => onBlur("mobile")}
                className={inputClass}
              />
            </FloatingField>
          </div>
        </Section>

        {apiError && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-shine group w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ink hover:bg-[#1e293b] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 text-[15px] shadow-card-lg transition"
        >
          Run my free audit
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        <p className="text-xs text-ink-faint text-center">
          Takes ~30-60 seconds · No credit card · We email your report as a PDF
        </p>
      </form>

      {submitting && <AuditingOverlay completed={false} error={apiError} />}
    </>
  );
}

/* ——— small inner building blocks ——— */

function Section({
  title,
  children,
  eyebrow = false,
}: {
  title: string;
  children: React.ReactNode;
  eyebrow?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h3 className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${eyebrow ? "text-brand-600" : "text-ink-muted"}`}>
          {title}
        </h3>
        <div className="flex-1 h-px bg-hairline" />
      </div>
      {children}
    </div>
  );
}

function FloatingField({
  label,
  icon: Icon,
  hint,
  error,
  valid,
  children,
}: {
  label: string;
  icon?: typeof LinkIcon;
  hint?: string;
  error?: string;
  valid: boolean | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink mb-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-ink-faint" strokeWidth={2.5} />}
          {label}
        </span>
        <div className="relative">
          {children}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {valid === true && <CheckCircle2 className="w-4 h-4 text-accent" />}
            {valid === false && <AlertCircle className="w-4 h-4 text-red-500" />}
          </span>
        </div>
      </label>
      {hint && !error && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function IndustryCombobox({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onBlur();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onBlur]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDUSTRIES.slice(0, 10);
    return INDUSTRIES.filter((i) => i.toLowerCase().includes(q)).slice(0, 10);
  }, [query]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange(e.target.value);
          }}
          placeholder="Search e.g. dentist, plumber…"
          className={`${inputClass} pl-10`}
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1.5 w-full max-h-64 overflow-auto rounded-lg border border-hairline bg-panel shadow-card-lg py-1">
          {filtered.map((i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onChange(i);
                  setQuery(i);
                  setOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-sm hover:bg-brand-soft hover:text-brand-700 transition"
              >
                {i}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-hairline bg-panel px-3.5 py-3 pr-10 text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 transition";
