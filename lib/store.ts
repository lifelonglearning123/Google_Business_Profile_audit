import fs from "node:fs";
import path from "node:path";
import { createClient } from "@vercel/kv";
import type { Audit } from "./types";

/**
 * Audit persistence.
 *
 * Production (Vercel): writes to Vercel KV / Upstash Redis. Cross-instance
 * reads work because every serverless instance hits the same store.
 *
 * Local dev (no KV creds): writes to .audits/{id}.json on disk.
 *
 * Env-var detection is intentionally loose. Vercel's marketplace integration
 * sometimes namespaces vars with the store name (e.g. `kv_KV_REST_API_URL`
 * instead of `KV_REST_API_URL`), and a raw Upstash setup uses different names
 * again (`UPSTASH_REDIS_REST_*`). Any of the three patterns works.
 */

const PREFIX = "gbp-audit:";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.kv_KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  "";

const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.kv_KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

const kv = KV_URL && KV_TOKEN ? createClient({ url: KV_URL, token: KV_TOKEN }) : null;

const FILE_BASE = process.env.VERCEL
  ? "/tmp/gbp-audits"
  : path.join(process.cwd(), ".audits");

export async function saveAudit(audit: Audit): Promise<void> {
  if (kv) {
    await kv.set(PREFIX + audit.id, audit, { ex: TTL_SECONDS });
    return;
  }

  try {
    fs.mkdirSync(FILE_BASE, { recursive: true });
  } catch {
    // dir exists or unwritable — writeFileSync below surfaces real errors
  }
  fs.writeFileSync(path.join(FILE_BASE, `${audit.id}.json`), JSON.stringify(audit), "utf8");
}

export async function getAudit(id: string): Promise<Audit | undefined> {
  if (!/^[a-z0-9]+$/i.test(id)) return undefined;

  if (kv) {
    const v = await kv.get<Audit>(PREFIX + id);
    return v ?? undefined;
  }

  try {
    const raw = fs.readFileSync(path.join(FILE_BASE, `${id}.json`), "utf8");
    return JSON.parse(raw) as Audit;
  } catch {
    return undefined;
  }
}
