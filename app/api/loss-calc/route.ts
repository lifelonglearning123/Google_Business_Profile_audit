import { NextResponse } from "next/server";
import { z } from "zod";
import { INDUSTRIES, type Industry } from "@/lib/industries";
import { buildKeyword, computeLoss } from "@/lib/lossCalc";
import { fetchSearchVolume } from "@/lib/dataforseo";

export const runtime = "nodejs";
export const maxDuration = 30;

const InputSchema = z.object({
  industry: z.enum(INDUSTRIES as unknown as [Industry, ...Industry[]]),
  location: z.string().min(2, "Enter a city or area"),
  avgSale: z.coerce.number().positive("Average sale must be greater than zero"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  const { industry, location, avgSale } = parsed.data;

  const keyword = buildKeyword(industry, location);
  if (!keyword) {
    return NextResponse.json(
      { error: "Couldn't build a keyword for this industry / location combination." },
      { status: 400 }
    );
  }

  let monthlySearches: number | undefined;
  try {
    monthlySearches = await fetchSearchVolume(keyword);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Keyword lookup failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // DataForSEO returns null/0 for very low or unmeasured volumes. Treat
  // anything below a small floor as "not enough signal" and tell the user
  // honestly rather than producing a misleadingly tiny figure.
  if (!monthlySearches || monthlySearches < 10) {
    return NextResponse.json(
      {
        error:
          "Search volume for that combination is too low to estimate reliably. Try a broader location or a different industry phrasing.",
        keyword,
      },
      { status: 200 }
    );
  }

  const estimate = computeLoss({ monthlySearches, industry, avgSale, keyword });

  return NextResponse.json({ keyword, estimate });
}
