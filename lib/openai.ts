import OpenAI from "openai";
import type { GbpData, Narrative, ScoreCard } from "./types";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server."
    );
  }
  _client = new OpenAI({
    apiKey,
    timeout: 45_000, // 45s hard cap — prevents infinite hangs in the audit route
    maxRetries: 1,
  });
  return _client;
}

const SYSTEM_PROMPT = `You are a senior local-SEO consultant specialising in Google Business Profile (GBP) optimisation.
You produce concise, practical audit narratives for small and medium local businesses.

Rules:
- Be specific. Quote the real numbers from the data (review count, rating, category count, etc.) rather than vague language.
- Tie every recommendation to a concrete action the owner can take this week.
- Tailor advice to the business's industry and location context.
- British English. Avoid fluff, hype, and emojis.
- Never invent facts that aren't supported by the data provided.

Output format: strict JSON matching the schema the user provides. No prose outside the JSON.`;

export async function generateNarrative(args: {
  gbp: GbpData;
  scorecard: ScoreCard;
  industry: string;
  location: string;
}): Promise<Narrative> {
  const { gbp, scorecard, industry, location } = args;

  const reviewSample = (gbp.reviews ?? []).slice(0, 15).map((r) => ({
    rating: r.rating,
    date: r.date,
    text: r.text?.slice(0, 400),
    hasOwnerResponse: !!r.ownerResponse,
  }));

  const userPayload = {
    business: {
      name: gbp.name,
      address: gbp.address,
      phone: gbp.phone,
      website: gbp.website,
      categories: gbp.categories,
      services: gbp.services,
      rating: gbp.rating,
      reviewCount: gbp.reviewCount,
      photoCount: gbp.photoCount,
      hasDescription: !!gbp.description,
      descriptionLength: gbp.description?.length ?? 0,
      // Hero copy / meta description scraped from the business's own
      // website. Use it to judge how clearly this business communicates
      // what they do, and to ground recommendations in their own language.
      websiteDescription: gbp.websiteDescription,
      // For each GBP category, did we find a matching page on the site?
      // When `unmatched` is non-empty the LLM should reference the exact
      // missing pages in its recommendations — concrete + actionable.
      categoryPageCoverage: gbp.categoryPageMatches,
      hoursSet: !!gbp.hours,
    },
    reviewSample,
    scorecard,
    audit_context: { industry, location },
    schema: {
      summary: "string, 2-3 sentences, overall state of the profile",
      strengths: "array of 3-5 short strings",
      weaknesses: "array of 3-6 short strings",
      recommendations: [
        {
          priority: "high | medium | low",
          title: "short imperative action",
          detail: "1-2 sentences of how + why, industry-specific where possible",
          effort: "quick-win | medium | project",
        },
      ],
      industryInsights: "array of 2-4 observations specific to this industry and location",
    },
  };

  const completion = await getClient().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Produce the audit narrative as a single JSON object per the schema. Data follows:\n\n" +
          JSON.stringify(userPayload, null, 2),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let parsed: Narrative;
  try {
    parsed = JSON.parse(raw) as Narrative;
  } catch {
    // If the model slips, fall back to a minimal narrative from the scorecard findings.
    return fallbackNarrative(scorecard);
  }

  // Defensive normalisation — the UI expects these fields to exist.
  return {
    summary: parsed.summary ?? "",
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    industryInsights: Array.isArray(parsed.industryInsights) ? parsed.industryInsights : [],
  };
}

function fallbackNarrative(scorecard: ScoreCard): Narrative {
  const weakest = [...scorecard.subScores].sort((a, b) => a.score - b.score).slice(0, 3);
  return {
    summary: `Overall GBP score: ${scorecard.overall}/100 (${scorecard.grade}). The strongest gains will come from improving the lowest-scoring areas below.`,
    strengths: scorecard.subScores.filter((s) => s.score >= 75).map((s) => `${s.label}: ${s.score}/100`),
    weaknesses: weakest.map((s) => `${s.label}: ${s.score}/100`),
    recommendations: weakest.map((s) => ({
      priority: "high" as const,
      title: `Improve ${s.label.toLowerCase()}`,
      detail: s.findings.join(" "),
      effort: "medium" as const,
    })),
    industryInsights: [],
  };
}
