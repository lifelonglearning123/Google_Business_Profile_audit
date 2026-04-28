import { z } from "zod";

export const AuditInputSchema = z.object({
  gbpUrl: z.string().url("Enter a valid Google Business Profile URL"),
  location: z.string().min(2, "Enter your city or service area"),
  industry: z.string().min(2, "Pick the closest industry"),
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email address"),
  mobile: z
    .string()
    .min(6, "Enter a valid mobile number")
    .regex(/^[+\d][\d\s()\-]{5,}$/, "Only digits, spaces, +, ( ), and - are allowed"),
});

export type AuditInput = z.infer<typeof AuditInputSchema>;

export type Review = {
  rating: number;
  text?: string;
  author?: string;
  date?: string;
  ownerResponse?: string;
};

export type GbpData = {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  categories: string[];
  rating?: number;
  reviewCount?: number;
  hours?: Record<string, string> | string;
  photoCount?: number;
  description?: string;
  // Best-effort summary extracted from the business's own website. Used as
  // a richer "does this business communicate clearly?" signal than the GBP
  // description box, which most data sources can't read.
  websiteDescription?: string;
  // For each GBP category, did we find a matching page on the website?
  // Undefined when we couldn't reach the website at all (no penalty in
  // scoring). Empty unmatched list = full coverage.
  categoryPageMatches?: {
    matched: string[];   // categories with a page found
    unmatched: string[]; // categories with no page found
    total: number;       // categories considered
  };
  // Lightweight signals about the linked website itself, used by the
  // dedicated Website pillar in scoreWebsite. Undefined when no website
  // was set on the GBP.
  websiteSignals?: {
    reachable: boolean;
    https: boolean;
  };
  services?: string[];
  attributes?: string[];
  posts?: { date?: string; text?: string }[];
  questions?: { question: string; answer?: string }[];
  reviews: Review[];
  placeId?: string;
  dataId?: string;
  thumbnail?: string;
};

export type SubScore = {
  key: string;
  label: string;
  score: number;
  weight: number;
  findings: string[];
};

export type ScoreCard = {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  subScores: SubScore[];
};

export type Narrative = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: {
    priority: "high" | "medium" | "low";
    title: string;
    detail: string;
    effort: "quick-win" | "medium" | "project";
  }[];
  industryInsights: string[];
};

export type Audit = {
  id: string;
  createdAt: string;
  input: AuditInput;
  gbp: GbpData;
  scorecard: ScoreCard;
  narrative: Narrative;
};
