/**
 * White-label brand name shown across the funnel — page titles, footers,
 * PDF cover, email subjects.
 *
 * Each Vercel project sets `NEXT_PUBLIC_BRAND_NAME` to its own brand.
 * Falls back to "GBP Audit" so anyone running the repo without env config
 * still sees a sensible label.
 *
 * NEXT_PUBLIC_ prefix means this resolves at build time and is safe in
 * both server and client components.
 */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "GBP Audit";
