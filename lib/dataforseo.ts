/**
 * DataForSEO Keyword Volume client. Used by the landing-page loss
 * calculator to get real monthly search volumes for "<industry> <city>"
 * phrases.
 *
 * Auth: Basic, login + password from the DataForSEO dashboard.
 *   .env.local:
 *     DATAFORSEO_LOGIN=...
 *     DATAFORSEO_PASSWORD=...
 *
 * Cost: roughly $0.0006 per keyword on the live endpoint. Free $1 credit
 * on signup is plenty for testing (~1600 lookups).
 */

const ENDPOINT =
  "https://api.dataforseo.com/v3/keywords_data/google/search_volume/live";

// 2826 = United Kingdom in DataForSEO's location codes. Hardcoded for now;
// can be made configurable later if we expand beyond the UK.
const UK_LOCATION_CODE = 2826;

export async function fetchSearchVolume(
  keyword: string,
  locationCode: number = UK_LOCATION_CODE
): Promise<number | undefined> {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error(
      "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD missing — sign up at dataforseo.com and add the credentials to .env.local"
    );
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");

  const body = [
    {
      language_code: "en",
      location_code: locationCode,
      keywords: [keyword],
    },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`DataForSEO ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as DataForSeoResponse;
    const result = json.tasks?.[0]?.result?.[0];
    if (!result) return undefined;
    // search_volume is the average monthly searches for the keyword over
    // the last 12 months.
    return typeof result.search_volume === "number" ? result.search_volume : undefined;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("DataForSEO timed out after 10s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

type DataForSeoResponse = {
  tasks?: Array<{
    result?: Array<{
      keyword?: string;
      search_volume?: number | null;
      cpc?: number | null;
      competition?: number | null;
    }>;
  }>;
};
