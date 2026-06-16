/**
 * Per-deployment regional configuration. One env var picks the country
 * the deployment is set up for; everything user-facing and API-facing
 * derives from this single source.
 *
 *   .env.local:
 *     NEXT_PUBLIC_REGION=us   # or uk, au, ca
 *
 * Default (env var missing or unrecognised) is "uk" so existing
 * deployments keep their behaviour.
 *
 * Note: NEXT_PUBLIC_ prefix is required so client components (the audit
 * form, loss calculator) can read the same value the server uses.
 */
import { DollarSign, PoundSterling, type LucideIcon } from "lucide-react";

export type RegionCode = "us" | "uk" | "au" | "ca";

export type RegionConfig = {
  code: RegionCode;
  countryName: string;
  apifyCountryCode: string;
  dataForSeoLocation: number;
  acceptLanguage: string;
  englishVariant: string;
  locationLabel: string;
  locationPlaceholder: string;
  phonePlaceholder: string;
  phoneCountryCode: string;
  currencyCode: string;
  currencySymbol: string;
  currencyLocale: string;
  currencyIcon: LucideIcon;
  dateLocale: string;
  sampleCity: string;
  /**
   * Per-region keyword overrides for the loss-calculator search-volume
   * lookup. Keys match entries in INDUSTRIES; values are the
   * region-correct phrase people actually search for in that country.
   * Anything not listed uses the default keyword.
   */
  industryKeywordOverrides: Record<string, string>;
};

const REGIONS: Record<RegionCode, RegionConfig> = {
  uk: {
    code: "uk",
    countryName: "the UK",
    apifyCountryCode: "gb",
    dataForSeoLocation: 2826,
    acceptLanguage: "en-GB,en;q=0.9",
    englishVariant: "British English",
    locationLabel: "City / Service Area",
    locationPlaceholder: "Manchester, UK",
    phonePlaceholder: "+44...",
    phoneCountryCode: "44",
    currencyCode: "GBP",
    currencySymbol: "£",
    currencyLocale: "en-GB",
    currencyIcon: PoundSterling,
    dateLocale: "en-GB",
    sampleCity: "Manchester, UK",
    industryKeywordOverrides: {},
  },
  us: {
    code: "us",
    countryName: "the US",
    apifyCountryCode: "us",
    dataForSeoLocation: 2840,
    acceptLanguage: "en-US,en;q=0.9",
    englishVariant: "American English",
    locationLabel: "City, State",
    locationPlaceholder: "Austin, TX",
    phonePlaceholder: "(555) 123-4567",
    phoneCountryCode: "1",
    currencyCode: "USD",
    currencySymbol: "$",
    currencyLocale: "en-US",
    currencyIcon: DollarSign,
    dateLocale: "en-US",
    sampleCity: "Austin, TX",
    industryKeywordOverrides: {
      "Law Firm / Solicitor": "lawyer",
      "Real Estate / Lettings Agent": "real estate agent",
      "Tyre / MOT Garage": "tire shop",
      "HVAC / Heating Engineer": "hvac contractor",
      "Bar / Pub": "bar",
      "Hotel / B&B": "hotel",
      "Landscaper / Gardener": "landscaper",
      "Retail Shop": "store",
      "Moving / Removals": "moving company",
      "School / Nursery / Tutor": "tutor",
    },
  },
  au: {
    code: "au",
    countryName: "Australia",
    apifyCountryCode: "au",
    dataForSeoLocation: 2036,
    acceptLanguage: "en-AU,en;q=0.9",
    englishVariant: "Australian English",
    locationLabel: "City, State",
    locationPlaceholder: "Sydney, NSW",
    phonePlaceholder: "04xx xxx xxx",
    phoneCountryCode: "61",
    currencyCode: "AUD",
    currencySymbol: "$",
    currencyLocale: "en-AU",
    currencyIcon: DollarSign,
    dateLocale: "en-AU",
    sampleCity: "Sydney, NSW",
    industryKeywordOverrides: {
      "Tyre / MOT Garage": "tyre shop",
      "Law Firm / Solicitor": "solicitor",
      "Real Estate / Lettings Agent": "real estate agent",
    },
  },
  ca: {
    code: "ca",
    countryName: "Canada",
    apifyCountryCode: "ca",
    dataForSeoLocation: 2124,
    acceptLanguage: "en-CA,en;q=0.9",
    englishVariant: "Canadian English",
    locationLabel: "City, Province",
    locationPlaceholder: "Toronto, ON",
    phonePlaceholder: "(555) 123-4567",
    phoneCountryCode: "1",
    currencyCode: "CAD",
    currencySymbol: "$",
    currencyLocale: "en-CA",
    currencyIcon: DollarSign,
    dateLocale: "en-CA",
    sampleCity: "Toronto, ON",
    industryKeywordOverrides: {
      "Law Firm / Solicitor": "lawyer",
      "Real Estate / Lettings Agent": "real estate agent",
      "Tyre / MOT Garage": "tire shop",
    },
  },
};

function resolveRegionCode(): RegionCode {
  const raw =
    (process.env.NEXT_PUBLIC_REGION || process.env.REGION || "")
      .toLowerCase()
      .trim();
  if (raw === "us" || raw === "uk" || raw === "au" || raw === "ca") return raw;
  if (raw === "gb") return "uk";
  return "uk";
}

export const REGION: RegionConfig = REGIONS[resolveRegionCode()];

/**
 * Normalise a typed phone string to E.164, using the region's national
 * conventions. Handles the common forms users actually type for each
 * country; falls back to "prepend +" when the input is already in
 * international form but missing the plus.
 *
 *   UK:   "07712 345678"    → "+447712345678"
 *   US:   "(555) 123-4567"  → "+15551234567"
 *   AU:   "0412 345 678"    → "+61412345678"
 *   CA:   "555-123-4567"    → "+15551234567"
 */
export function toE164(phone: string, region: RegionConfig = REGION): string {
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned;

  const { phoneCountryCode } = region;

  switch (region.code) {
    case "uk":
    case "au":
      if (cleaned.startsWith("0")) return "+" + phoneCountryCode + cleaned.slice(1);
      if (cleaned.startsWith(phoneCountryCode)) return "+" + cleaned;
      return "+" + cleaned;
    case "us":
    case "ca":
      if (cleaned.length === 10) return "+" + phoneCountryCode + cleaned;
      if (cleaned.length === 11 && cleaned.startsWith(phoneCountryCode)) {
        return "+" + cleaned;
      }
      return "+" + cleaned;
  }
}

/**
 * Format a number as currency in the configured region.
 */
export function formatCurrency(
  amount: number,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat(REGION.currencyLocale, {
    style: "currency",
    currency: REGION.currencyCode,
    maximumFractionDigits: 0,
    ...options,
  }).format(amount);
}
