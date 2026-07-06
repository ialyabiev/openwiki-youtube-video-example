import { Request, Response, NextFunction } from "express";

// Plan-tier rate limits (requests per minute per workspace).
// These numbers are contractual for Enterprise. Confirm with the
// platform team before changing them.
const LIMITS: Record<string, number> = {
  free: 600,
  pro: 900,
  enterprise: 3000
};

const counters = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const plan = String(req.header("x-plan-tier") || "free");
  const limit = LIMITS[plan] ?? LIMITS.free;
  const key = `${req.ip}:${plan}`;
  const now = Date.now();
  const entry = counters.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > 60_000) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  counters.set(key, entry);
  if (entry.count > limit) {
    return res.status(429).json({ error: "rate limit exceeded", limit, plan });
  }
  next();
}
