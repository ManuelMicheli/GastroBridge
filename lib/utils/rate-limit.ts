import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// When Upstash env vars are not configured, rate limiting becomes a no-op so
// preview / local builds keep working. Production should set both vars.
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

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
  const { success, limit, remaining, reset } = await limiter.limit(key);
  return {
    allowed: success,
    limit,
    remaining,
    resetMs: reset,
  };
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
