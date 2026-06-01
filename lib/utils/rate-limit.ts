import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// REST credentials for the Upstash/Vercel-KV Redis. The Vercel Upstash Marketplace
// integration injects KV_REST_API_URL / KV_REST_API_TOKEN; a manual Upstash setup
// uses UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Accept either. Use the
// full (write) token, not the read-only one — sliding-window limiting writes.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

// When Redis is not configured, rate limiting becomes a no-op so preview / local
// builds keep working. Production MUST provide it.
const hasUpstash = !!redisUrl && !!redisToken;

// Loud warning when Redis is missing in production: login/API brute force is
// unthrottled. We must NOT throw here — this module is imported by the Edge
// middleware, which runs on every request, so a throw would 500 the entire site
// (MIDDLEWARE_INVOCATION_FAILED). Warn instead and fall back to no-op limiting.
if (
  !hasUpstash &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  console.error(
    "[rate-limit] Redis non configurato in produzione: login e API non hanno " +
      "protezione brute-force. Imposta KV_REST_API_URL/KV_REST_API_TOKEN (o le UPSTASH_*).",
  );
}

const redis = hasUpstash ? new Redis({ url: redisUrl!, token: redisToken! }) : null;

function makeLimiter(reqs: number, window: `${number} ${"s" | "m" | "h" | "d"}`, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(reqs, window),
    analytics: true,
    prefix,
  });
}

// Tuneable per surface: aggressive on auth, looser on API, lenient on assets.
export const apiLimiter = makeLimiter(100, "1 m", "rl:api");
export const authLimiter = makeLimiter(10, "1 m", "rl:auth");
export const cronLimiter = makeLimiter(60, "1 m", "rl:cron");

export type LimitResult = {
  allowed: boolean;
  limit?: number;
  remaining?: number;
  resetMs?: number;
};

export async function applyLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<LimitResult> {
  if (!limiter) return { allowed: true };
  try {
    const { success, limit, remaining, reset } = await limiter.limit(key);
    return {
      allowed: success,
      limit,
      remaining,
      resetMs: reset,
    };
  } catch (err) {
    // Redis/Upstash outage: fail OPEN so a transient infra problem can't lock
    // every user out of login. Log loudly so the outage is visible.
    console.error("[rate-limit] limiter error, failing open:", err);
    return { allowed: true };
  }
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
