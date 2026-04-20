// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";

function createFallbackLimiter() {
  return {
    limit: async () => ({ success: true, limit: Number.POSITIVE_INFINITY, remaining: Number.POSITIVE_INFINITY, reset: Date.now() }),
  };
}

export const baseRateLimit =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "rate-limit",
      })
    : createFallbackLimiter();
