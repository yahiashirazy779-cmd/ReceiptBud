import rateLimit from "express-rate-limit";
import type { Request } from "express";

/**
 * Build a per-user rate limiter. The key is the authenticated userId set by
 * requireAuth, so limits are per-account rather than per-IP (which would
 * unfairly group users behind shared NAT/proxies).
 *
 * NOTE: requireAuth must run before these limiters in the middleware chain.
 */
function perUserLimiter(options: {
  windowMs: number;
  limit: number;
  message: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    // Use userId as the rate-limit key; fall back to IP only if somehow
    // userId is missing (should never happen after requireAuth).
    // userId is always set by requireAuth before these limiters run.
    // We deliberately avoid req.ip to sidestep the ERR_ERL_KEY_GEN_IPV6
    // validation and to prevent grouping users behind shared NAT proxies.
    keyGenerator: (req: Request) => (req as any).userId ?? "unknown",
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: options.message, code: "RATE_LIMIT" },
    // In-memory store is fine for a single-instance server.
    // Swap for a Redis store if the app scales horizontally.
  });
}

/** 10 receipt scans per user per minute (vision AI — expensive). */
export const scanRateLimiter = perUserLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  message: "Too many scan requests. Please wait a moment before trying again.",
});

/** 30 chat messages per user per minute (streaming SSE — expensive). */
export const chatRateLimiter = perUserLimiter({
  windowMs: 60 * 1000,
  limit: 30,
  message:
    "Too many messages. Please wait a moment before sending another message.",
});

/** 5 image generations per user per minute (image AI — very expensive). */
export const imageGenRateLimiter = perUserLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  message:
    "Too many image generation requests. Please wait a moment before trying again.",
});
