import type { Industry } from "./industries";

/**
 * Per-industry defaults for the landing-page loss calculator. Each entry has:
 *
 *   keyword       — the seed phrase we send to DataForSEO. We append the
 *                   user's location at call time (e.g. "plumber Trowbridge")
 *                   so the volume reflects local intent, not generic.
 *   conversionRate — the rough share of local-pack clicks that turn into a
 *                   customer for this industry. Sourced from common
 *                   marketing benchmarks; intentionally conservative so the
 *                   resulting £-figure isn't a fantasy.
 *
 * These are starting numbers, not gospel — easy to tune as you see real
 * audit conversions.
 */
const INDUSTRY_DEFAULTS: Record<
  Industry,
  { keyword: string; conversionRate: number }
> = {
  "Dentist / Dental Clinic": { keyword: "dentist", conversionRate: 0.08 },
  "Medical / GP / Clinic": { keyword: "doctor", conversionRate: 0.07 },
  "Chiropractor / Physio": { keyword: "physiotherapist", conversionRate: 0.08 },
  "Cosmetic / Aesthetics Clinic": { keyword: "aesthetic clinic", conversionRate: 0.06 },
  "Law Firm / Solicitor": { keyword: "solicitor", conversionRate: 0.04 },
  "Accountant / Bookkeeper": { keyword: "accountant", conversionRate: 0.05 },
  "Financial Advisor / IFA": { keyword: "financial advisor", conversionRate: 0.04 },
  "Real Estate / Lettings Agent": { keyword: "estate agent", conversionRate: 0.05 },
  "Restaurant / Cafe": { keyword: "restaurant", conversionRate: 0.04 },
  "Bar / Pub": { keyword: "pub", conversionRate: 0.04 },
  "Hotel / B&B": { keyword: "hotel", conversionRate: 0.03 },
  "Plumber": { keyword: "plumber", conversionRate: 0.10 },
  "Electrician": { keyword: "electrician", conversionRate: 0.10 },
  "Builder / Construction": { keyword: "builder", conversionRate: 0.05 },
  "Roofer": { keyword: "roofer", conversionRate: 0.08 },
  "HVAC / Heating Engineer": { keyword: "heating engineer", conversionRate: 0.10 },
  "Landscaper / Gardener": { keyword: "gardener", conversionRate: 0.06 },
  "Cleaner / Cleaning Company": { keyword: "cleaner", conversionRate: 0.07 },
  "Auto Repair / Mechanic": { keyword: "mechanic", conversionRate: 0.10 },
  "Tyre / MOT Garage": { keyword: "MOT garage", conversionRate: 0.10 },
  "Car Dealer": { keyword: "car dealer", conversionRate: 0.04 },
  "Hair Salon / Barber": { keyword: "hair salon", conversionRate: 0.07 },
  "Beauty Salon / Nails": { keyword: "beauty salon", conversionRate: 0.07 },
  "Spa / Massage": { keyword: "spa", conversionRate: 0.06 },
  "Gym / Personal Trainer": { keyword: "gym", conversionRate: 0.04 },
  "Yoga / Pilates Studio": { keyword: "yoga studio", conversionRate: 0.05 },
  "Vet / Veterinary Clinic": { keyword: "vet", conversionRate: 0.10 },
  "Pet Groomer / Boarding": { keyword: "dog groomer", conversionRate: 0.07 },
  "Photographer": { keyword: "photographer", conversionRate: 0.05 },
  "Wedding / Event Services": { keyword: "wedding venue", conversionRate: 0.04 },
  "Marketing Agency": { keyword: "marketing agency", conversionRate: 0.03 },
  "IT / Computer Repair": { keyword: "computer repair", conversionRate: 0.08 },
  "Locksmith": { keyword: "locksmith", conversionRate: 0.15 },
  "Pest Control": { keyword: "pest control", conversionRate: 0.10 },
  "Moving / Removals": { keyword: "removals", conversionRate: 0.06 },
  "Storage Facility": { keyword: "self storage", conversionRate: 0.06 },
  "Funeral Services": { keyword: "funeral director", conversionRate: 0.10 },
  "School / Nursery / Tutor": { keyword: "tutor", conversionRate: 0.05 },
  "Retail Shop": { keyword: "shop", conversionRate: 0.04 },
  "Other": { keyword: "", conversionRate: 0.06 },
};

export function defaultsForIndustry(
  industry: string
): { keyword: string; conversionRate: number } {
  return (
    (INDUSTRY_DEFAULTS as Record<string, { keyword: string; conversionRate: number }>)[
      industry
    ] ?? INDUSTRY_DEFAULTS["Other"]
  );
}

/**
 * Build the keyword we send to DataForSEO. The phrase we want the volume of
 * is "<industry-keyword> <location>" — that's the kind of long-tail query
 * actually typed by people looking for a local provider.
 */
export function buildKeyword(industry: string, location: string): string {
  const seed = defaultsForIndustry(industry).keyword;
  if (!seed) return location.trim();
  return `${seed} ${location}`.replace(/\s+/g, " ").trim();
}

export type LossEstimate = {
  monthlySearches: number;
  // Click-share gap between top 3 and outside top 3 (well-cited local-SEO
  // benchmark — top 3 captures ~58%, ranks 4-10 split the rest).
  clickShareLost: number;
  conversionRate: number;
  avgSale: number;
  lostCustomersMonthly: number;
  lostRevenueMonthly: number;
  lostRevenueYearly: number;
  // Human-readable breakdown for the UI.
  breakdown: string;
};

/**
 * Compute the headline "you're losing roughly £X/month by not being in the
 * top 3". Inputs are intentionally few — this is a directional estimate to
 * motivate running the full audit, not an accounting figure.
 */
export function computeLoss(args: {
  monthlySearches: number;
  industry: Industry;
  avgSale: number;
  keyword: string;
}): LossEstimate {
  const { monthlySearches, industry, avgSale, keyword } = args;
  const { conversionRate } = defaultsForIndustry(industry);

  // 0.50 = the share of local-pack clicks captured by the top 3 that a
  // rank-5+ business is missing. Conservative round number — the literal
  // figure depends on the source (33%/15%/10% for ranks 1/2/3 = 58%; we
  // shave it so the headline can't be accused of inflation).
  const clickShareLost = 0.5;

  const lostCustomersMonthly = Math.round(
    monthlySearches * clickShareLost * conversionRate
  );
  const lostRevenueMonthly = Math.round(lostCustomersMonthly * avgSale);
  const lostRevenueYearly = lostRevenueMonthly * 12;

  const breakdown =
    `Based on ~${formatCount(monthlySearches)} monthly searches for ` +
    `"${keyword}" and a typical ${(conversionRate * 100).toFixed(0)}% ` +
    `conversion rate for this industry, the top 3 captures roughly half ` +
    `the clicks — that gap is what's at stake.`;

  return {
    monthlySearches,
    clickShareLost,
    conversionRate,
    avgSale,
    lostCustomersMonthly,
    lostRevenueMonthly,
    lostRevenueYearly,
    breakdown,
  };
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
