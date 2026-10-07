import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// REST credentials for the Upstash/Vercel-KV Redis. The Vercel Upstash Marketplace
// integration injects KV_REST_API_URL / KV_REST_API_TOKEN; a manual Upstash setup
// uses UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Accept either. Use the
// full (write) token, not the read-only one — sliding-window limiting writes.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

// When Redis is not configured, limiting falls back to a per-instance memory
// counter (see applyMemoryLimit). Production should still provide Redis.
const hasUpstash = !!redisUrl && !!redisToken;

// Loud warning when Redis is missing in production: login/API brute force is
// unthrottled. We must NOT throw here — this module is imported by the Edge
// middleware, which runs on every request, so a throw would 500 the entire site
// (MIDDLEWARE_INVOCATION_FAILED). Warn instead and fall back to memory limiting.
if (
  !hasUpstash &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  console.error(
    "[rate-limit] Redis non configurato in produzione: limite solo in memoria " +
      "per istanza. Imposta KV_REST_API_URL/KV_REST_API_TOKEN (o le UPSTASH_*).",
  );
}

const redis = hasUpstash ? new Redis({ url: redisUrl!, token: redisToken! }) : null;

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

const WINDOW_UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

function windowToMs(window: Window): number {
  const [n, unit] = window.split(" ") as [string, keyof typeof WINDOW_UNIT_MS];
  return Number(n) * WINDOW_UNIT_MS[unit];
}

export type Limiter = {
  redis: Ratelimit | null;
  reqs: number;
  windowMs: number;
  prefix: string;
};

function makeLimiter(reqs: number, window: Window, prefix: string): Limiter {
  return {
    redis: redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(reqs, window),
          analytics: true,
          prefix,
        })
      : null,
    reqs,
    windowMs: windowToMs(window),
    prefix,
  };
}

// Tuneable per surface: aggressive on auth, looser on API, lenient on assets.
export const apiLimiter = makeLimiter(100, "1 m", "rl:api");
export const authLimiter = makeLimiter(10, "1 m", "rl:auth");
export const cronLimiter = makeLimiter(60, "1 m", "rl:cron");

// Fallback when Redis is missing or down: a fixed-window counter in this
// instance's memory. Weaker than the shared Redis limiter (each instance
// counts on its own) but it still slows brute force instead of letting every
// request through.
const MEMORY_MAX_KEYS = 10_000;
const memoryHits = new Map<string, { count: number; resetAt: number }>();

function applyMemoryLimit(limiter: Limiter, key: string): LimitResult {
  const now = Date.now();
  const id = `${limiter.prefix}:${key}`;
  let entry = memoryHits.get(id);
  if (!entry || entry.resetAt <= now) {
    if (memoryHits.size >= MEMORY_MAX_KEYS) {
      for (const [k, v] of memoryHits) if (v.resetAt <= now) memoryHits.delete(k);
      if (memoryHits.size >= MEMORY_MAX_KEYS) memoryHits.clear();
    }
    entry = { count: 0, resetAt: now + limiter.windowMs };
    memoryHits.set(id, entry);
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limiter.reqs,
    limit: limiter.reqs,
    remaining: Math.max(0, limiter.reqs - entry.count),
    resetMs: entry.resetAt,
  };
}

export type LimitResult = {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  resetMs?: number;
};

export async function applyLimit(
  limiter: Limiter,
  key: string,
): Promise<LimitResult> {
  if (!limiter.redis) return applyMemoryLimit(limiter, key);
  try {
    const { success, limit, remaining, reset } = await limiter.redis.limit(key);
    return {
      allowed: success,
      limit,
      remaining,
      resetMs: reset,
    };
  } catch (err) {
    // Redis/Upstash outage: fall back to the per-instance memory limiter so a
    // Redis problem neither locks users out nor leaves login unthrottled.
    console.error("[rate-limit] Redis error, using in-memory fallback:", err);
    return applyMemoryLimit(limiter, key);
  }
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
