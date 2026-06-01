import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// When Upstash env vars are not configured, rate limiting becomes a no-op so
// preview / local builds keep working. Production MUST set both vars.
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Loud warning when Upstash is missing in production: login/API brute force is
// unthrottled. We must NOT throw here — this module is imported by the Edge
// middleware, which runs on every request, so a throw would 500 the entire site
// (MIDDLEWARE_INVOCATION_FAILED). Warn instead and fall back to no-op limiting;
// configure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in production.
if (
  !hasUpstash &&
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  console.error(
    "[rate-limit] Upstash non configurato in produzione: login e API non hanno " +
      "protezione brute-force. Imposta UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.",
  );
}

const redis = hasUpstash ? Redis.fromEnv() : null;

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
