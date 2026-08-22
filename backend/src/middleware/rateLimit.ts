import type {
  NextFunction,
  Request,
  Response,
} from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

export function createFixedWindowRateLimit(options: {
  limit: number;
  windowMs: number;
  scope: string;
}) {
  const buckets = new Map<string, Bucket>();
  let lastSweep = 0;

  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const now = Date.now();

    if (now - lastSweep >= options.windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      lastSweep = now;
    }

    const identity = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.scope}:${identity}`;
    const current = buckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.limit - bucket.count);
    res.setHeader("RateLimit-Limit", String(options.limit));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader(
      "RateLimit-Reset",
      String(Math.ceil(bucket.resetAt / 1000)),
    );

    if (bucket.count > options.limit) {
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
      );
      res.status(429).json({
        error: "Too many requests. Try again after the rate-limit window.",
      });
      return;
    }

    next();
  };
}
