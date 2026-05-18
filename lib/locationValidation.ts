/**
 * Pre-flight check that a user-typed location resolves to a real place.
 *
 * Apify's `compass/crawler-google-places` actor fails fast with
 *   "LOCATION NOT FOUND! Input: '<text>'. You can validate your location at
 *    https://nominatim.openstreetmap.org/search?q=<text>"
 * when its geocoder (nominatim) can't resolve `locationQuery`. By calling
 * nominatim ourselves before we hit Apify, we can tell the customer up-front
 * to fix their spelling instead of burning 30-150s on a doomed Apify run.
 *
 * Failure mode: nominatim itself unreachable or slow → we fail OPEN
 * (`{ ok: true }`) so the audit still proceeds. Apify or Places may still
 * succeed via placeId/cid even when the location text is junk.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 2_500;

export type LocationCheck =
  | { ok: true }
  | { ok: false; userMessage: string };

export async function validateLocation(location: string): Promise<LocationCheck> {
  const trimmed = location.trim();
  if (!trimmed) return { ok: true }; // upstream zod already requires min 2 chars

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim usage policy requires a meaningful UA identifying the app.
        "User-Agent": "gbp-audit (https://github.com/macawsai)",
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[location] nominatim returned ${res.status} — skipping pre-check`);
      return { ok: true };
    }
    const data = (await res.json().catch(() => [])) as unknown;
    const hits = Array.isArray(data) ? data.length : 0;
    if (hits > 0) return { ok: true };
    return {
      ok: false,
      userMessage:
        `We couldn't recognise the location "${trimmed}". ` +
        "Please check the spelling, or try a nearby larger town or city.",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[location] nominatim timed out after ${TIMEOUT_MS}ms — skipping pre-check`);
    } else {
      console.warn("[location] nominatim error — skipping pre-check:", err);
    }
    return { ok: true };
  } finally {
    clearTimeout(timer);
  }
}
