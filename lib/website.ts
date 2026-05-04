/**
 * Fetch a business's website and extract two signals for the audit:
 *  1. A short description-shaped summary of what the business does (used as
 *     a proxy for the GBP "About" blurb, which most data sources can't see).
 *  2. The list of internal pages discovered in the homepage navigation
 *     (used to check whether each GBP category has a matching service page).
 *
 * Best-effort throughout: any failure returns an empty/undefined result.
 * The audit pipeline never blocks on this.
 */

export type WebsiteData = {
  description?: string;
  pages: WebsitePage[];
  // Did the homepage actually respond with HTML? Distinguishes "owner has
  // no website on the GBP" from "URL is set but parked / dead".
  reachable: boolean;
  // Does the actually-served site use HTTPS? Determined from the final URL
  // after following redirects, so an http:// URL that 301s to https://
  // counts as secure. Google Search has been a confirmed lightweight
  // ranking factor for HTTPS for years.
  https: boolean;
  // The URL stored on the GBP starts with http:// (regardless of where it
  // redirects). When true and `https` is also true, the site itself is
  // secure but the listing exposes the insecure URL — owner should fix the
  // GBP field. When true and `https` is false, the site is genuinely
  // insecure.
  listedAsHttp: boolean;
};

export type WebsitePage = {
  url: string;
  text: string; // anchor text or the URL slug, whichever's available
};

export async function fetchWebsiteData(rawUrl: string): Promise<WebsiteData> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { pages: [], reachable: false, https: false, listedAsHttp: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { pages: [], reachable: false, https: false, listedAsHttp: false };
  }
  const listedAsHttp = url.protocol === "http:";

  // ── Pass 1: homepage HTML (with desktop → mobile → Apify fallback) ──
  let html: string | undefined;
  let finalUrl = url.toString();
  try {
    const result = await fetchHtmlWithFallbacks(url.toString());
    html = result.html;
    if (result.finalUrl) finalUrl = result.finalUrl;
    if (result.via !== "desktop") {
      console.log(`[audit] website fetched via ${result.via} fallback`);
    }
  } catch (err) {
    console.warn(
      "[audit] website fetch failed (all fallbacks exhausted):",
      err instanceof Error ? err.message : err
    );
    // Couldn't reach the site — fall back to the listed URL's protocol
    // for https detection. Same behavior as before this signal existed.
    return { pages: [], reachable: false, https: !listedAsHttp, listedAsHttp };
  }

  // Use the post-redirect URL's protocol so http:// → https:// upgrades
  // count as secure. fetchViaApify can't expose a final URL, in which
  // case finalUrl is still the input URL (degraded but consistent).
  let https = !listedAsHttp;
  try {
    https = new URL(finalUrl).protocol === "https:";
  } catch {
    // keep the listed-URL fallback above
  }

  const description = extractSummary(html);
  const navPages = extractInternalLinks(html, url);

  // The homepage itself is a page that backs up the business's identity —
  // for single-category businesses (e.g. "Cafe", "Bakery") the homepage's
  // title or h1 is usually the only place the category word appears. Add
  // it as a synthetic page entry so the category-coverage matcher sees it.
  const homepagePage = buildHomepagePage(html, url);
  const navWithHomepage = homepagePage ? [homepagePage, ...navPages] : navPages;

  // ── Pass 2 (best-effort): sitemap.xml ──
  const sitemapPages = await fetchSitemapPages(url).catch(() => [] as WebsitePage[]);

  const pages = dedupePages([...navWithHomepage, ...sitemapPages]);

  return {
    description: description
      ? description.length > 600
        ? description.slice(0, 600).trimEnd() + "…"
        : description
      : undefined,
    pages,
    reachable: true,
    https,
    listedAsHttp,
  };
}

/**
 * Backwards-compatible wrapper retained because it's a tiny surface and
 * lets the description signal be requested without the page list when
 * pages aren't needed.
 */
export async function fetchWebsiteDescription(
  rawUrl: string
): Promise<string | undefined> {
  const data = await fetchWebsiteData(rawUrl);
  return data.description;
}

// Browser-shaped headers — many lightweight bot-blockers (Wordfence,
// Cloudflare free tier, Sucuri) only check User-Agent and a couple of the
// Sec-Fetch-* hints. Identifying as Chrome-on-Windows clears most of them.
const DESKTOP_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "no-cache",
};

const MOBILE_HEADERS: Record<string, string> = {
  ...DESKTOP_HEADERS,
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
};

async function fetchHtml(
  targetUrl: string,
  headers: Record<string, string> = DESKTOP_HEADERS,
  timeoutMs = 5_000
): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      throw new Error(`unexpected content-type: ${ct}`);
    }
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 200_000 ? buf.slice(0, 200_000) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    return { html, finalUrl: res.url || targetUrl };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a page with graceful fallbacks for anti-bot:
 *   1. Direct fetch with desktop browser headers (5s timeout).
 *   2. Direct fetch with mobile Safari headers (5s timeout) — many WAFs
 *      gate desktop UAs more aggressively than mobile.
 *   3. Apify cheerio-scraper with proxy rotation (20s timeout). Costs ~$0.001
 *      per call but handles UA-based and IP-based blocks.
 *
 * Returns the HTML and which path was used (for log visibility).
 */
async function fetchHtmlWithFallbacks(
  targetUrl: string
): Promise<{ html: string; finalUrl?: string; via: "desktop" | "mobile" | "apify" }> {
  // Tier 1a — desktop UA
  try {
    const { html, finalUrl } = await fetchHtml(targetUrl, DESKTOP_HEADERS, 5_000);
    return { html, finalUrl, via: "desktop" };
  } catch (err) {
    console.warn(
      `[audit] website desktop fetch failed (${err instanceof Error ? err.message : err}); trying mobile UA…`
    );
  }
  // Tier 1b — mobile UA
  try {
    const { html, finalUrl } = await fetchHtml(targetUrl, MOBILE_HEADERS, 5_000);
    return { html, finalUrl, via: "mobile" };
  } catch (err) {
    console.warn(
      `[audit] website mobile fetch failed (${err instanceof Error ? err.message : err}); falling back to Apify scraper…`
    );
  }
  // Tier 2 — Apify scraper (paid fallback). Cheerio-scraper doesn't expose
  // the post-redirect URL, so finalUrl stays undefined here and HTTPS
  // detection degrades to the listed URL's protocol.
  const html = await fetchViaApify(targetUrl);
  return { html, via: "apify" };
}

async function fetchViaApify(targetUrl: string): Promise<string> {
  const token =
    process.env.APIFY_API_KEY ||
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY token missing — Apify fallback unavailable");

  // apify/cheerio-scraper: fast (no JS rendering) + proxy rotation. The
  // pageFunction simply returns the raw HTML body so we can re-use our
  // own existing parsers.
  const apiUrl =
    "https://api.apify.com/v2/acts/apify~cheerio-scraper/run-sync-get-dataset-items?token=" +
    encodeURIComponent(token);

  const input = {
    startUrls: [{ url: targetUrl }],
    pageFunction:
      "async function pageFunction(context) { return { html: context.body }; }",
    proxyConfiguration: { useApifyProxy: true },
    maxRequestsPerCrawl: 1,
    maxPagesPerCrawl: 1,
    maxResultsPerCrawl: 1,
    maxRequestRetries: 1,
    additionalMimeTypes: [],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Apify scraper ${res.status}: ${body.slice(0, 200)}`);
    }
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Apify scraper returned empty dataset");
    }
    const html = items[0]?.html;
    if (typeof html !== "string" || html.length < 50) {
      throw new Error("Apify scraper returned no usable HTML");
    }
    return html;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Apify scraper timed out after 20s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function extractSummary(html: string): string | undefined {
  const cleaned = stripHtmlNoise(html);

  const parts: string[] = [];

  const metaDesc = matchAttr(cleaned, "meta", "name", "description", "content");
  if (metaDesc) parts.push(metaDesc);

  if (parts.length === 0) {
    const og = matchAttr(cleaned, "meta", "property", "og:description", "content");
    if (og) parts.push(og);
  }

  const h1 = extractTagText(cleaned, "h1");
  if (h1 && !parts.some((p) => p.includes(h1))) parts.push(h1);

  const ps = extractTagTexts(cleaned, "p", 4)
    .filter((t) => t.length >= 30)
    .slice(0, 2);
  for (const p of ps) {
    if (!parts.some((existing) => existing.includes(p))) parts.push(p);
  }

  if (parts.length === 0) return undefined;
  return parts.join(" — ").replace(/\s+/g, " ").trim();
}

function stripHtmlNoise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
}

/**
 * Walk every <a href="..."> in the cleaned HTML, keep links that point at
 * the same site (relative or same-origin), and pair each with its anchor
 * text. We don't restrict to <nav>/<header>/<footer> — single-page sites
 * scatter their navigation, and false positives on body links are harmless
 * for our category-matching use case.
 */
function buildHomepagePage(html: string, base: URL): WebsitePage | undefined {
  const cleaned = stripHtmlNoise(html);
  const title = extractTagText(cleaned, "title");
  const h1 = extractTagText(cleaned, "h1");
  // og:site_name + og:title widen the net for sites that lazy-load <title>.
  const ogTitle = matchAttr(cleaned, "meta", "property", "og:title", "content");
  const ogSite = matchAttr(cleaned, "meta", "property", "og:site_name", "content");
  const text = [title, h1, ogTitle, ogSite].filter(Boolean).join(" ").trim();
  if (!text) return undefined;
  // Use the canonical homepage URL (no trailing slash, no fragment).
  const u = new URL("/", base);
  u.hash = "";
  return { url: u.toString().replace(/\/$/, "") || u.toString(), text };
}

function extractInternalLinks(html: string, base: URL): WebsitePage[] {
  const cleaned = stripHtmlNoise(html);
  const re = /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const out: WebsitePage[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const href = m[1];
    const text = cleanInline(m[2]);
    const resolved = resolveSameOrigin(href, base);
    if (!resolved) continue;
    out.push({ url: resolved, text });
  }
  return out;
}

function resolveSameOrigin(href: string, base: URL): string | undefined {
  // Skip anchors, mailto, tel, javascript, etc.
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return undefined;
  }
  try {
    const u = new URL(href, base);
    if (u.hostname !== base.hostname) return undefined;
    // Strip fragment + trailing slash for consistent dedup.
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return undefined;
  }
}

async function fetchSitemapPages(base: URL): Promise<WebsitePage[]> {
  const sitemapUrl = new URL("/sitemap.xml", base).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(sitemapUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GBPAuditBot/1.0; +https://example.com/bot)",
      },
    });
    if (!res.ok) return [];
    const text = await res.text();
    // Cheap XML parse — pull every <loc>...</loc>.
    const out: WebsitePage[] = [];
    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      try {
        const u = new URL(m[1].trim());
        if (u.hostname !== base.hostname) continue;
        u.hash = "";
        let s = u.toString();
        if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
        // Use the URL slug as the "text" for sitemap entries — we don't
        // have anchor copy here.
        const text = decodeURIComponent(u.pathname.replace(/\//g, " ").trim());
        out.push({ url: s, text });
      } catch {
        // skip malformed
      }
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function dedupePages(pages: WebsitePage[]): WebsitePage[] {
  const byUrl = new Map<string, WebsitePage>();
  for (const p of pages) {
    const existing = byUrl.get(p.url);
    if (!existing) {
      byUrl.set(p.url, p);
    } else if (!existing.text && p.text) {
      // Prefer the entry that has anchor text.
      byUrl.set(p.url, p);
    }
  }
  return Array.from(byUrl.values());
}

function matchAttr(
  html: string,
  tag: string,
  keyAttr: string,
  keyValue: string,
  contentAttr: string
): string | undefined {
  const reA = new RegExp(
    `<${tag}\\b[^>]*\\b${keyAttr}\\s*=\\s*["']${escapeRegex(keyValue)}["'][^>]*\\b${contentAttr}\\s*=\\s*["']([^"']+)["']`,
    "i"
  );
  const reB = new RegExp(
    `<${tag}\\b[^>]*\\b${contentAttr}\\s*=\\s*["']([^"']+)["'][^>]*\\b${keyAttr}\\s*=\\s*["']${escapeRegex(keyValue)}["']`,
    "i"
  );
  const m = html.match(reA) ?? html.match(reB);
  return m ? decodeHtmlEntities(m[1]).trim() : undefined;
}

function extractTagText(html: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  return m ? cleanInline(m[1]) : undefined;
}

function extractTagTexts(html: string, tag: string, max: number): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < max) {
    const t = cleanInline(m[1]);
    if (t) out.push(t);
  }
  return out;
}

function cleanInline(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
