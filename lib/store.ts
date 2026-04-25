import fs from "node:fs";
import path from "node:path";
import type { Audit } from "./types";

/**
 * Audit persistence. JSON-per-audit on disk — survives dev HMR and Next.js
 * route-level module re-instantiation, which an in-memory Map does not.
 *
 * On Vercel, only /tmp is writable. Same warm instance can read what it wrote;
 * cold starts can still 404 stale links — migrate to Vercel KV for durable prod
 * storage without changing this interface.
 */

const BASE = process.env.VERCEL
  ? "/tmp/gbp-audits"
  : path.join(process.cwd(), ".audits");

function ensureDir(): void {
  try {
    fs.mkdirSync(BASE, { recursive: true });
  } catch {
    // already exists or unwritable — writeFileSync will surface the real error
  }
}

export function saveAudit(audit: Audit): void {
  ensureDir();
  const file = path.join(BASE, `${audit.id}.json`);
  fs.writeFileSync(file, JSON.stringify(audit), "utf8");
}

export function getAudit(id: string): Audit | undefined {
  // randomId() emits only base-36 chars; reject anything else to block path traversal
  if (!/^[a-z0-9]+$/i.test(id)) return undefined;
  const file = path.join(BASE, `${id}.json`);
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as Audit;
  } catch {
    return undefined;
  }
}
