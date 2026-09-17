import "server-only";

interface RateLimitRecord {
  timestamps: number[];
}

const cache = new Map<string, RateLimitRecord>();
const MAX_CACHE_ENTRIES = 5000;

export function checkRateLimit(options: {
  key: string;
  windowMs: number;
  maxRequests: number;
}): { success: boolean; remaining: number; resetTimeMs: number } {
  const { key, windowMs, maxRequests } = options;
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = cache.get(key);
  if (!record) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      // Evict expired entries when capacity is reached
      for (const [k, rec] of cache.entries()) {
        if (rec.timestamps.every((ts) => ts < windowStart)) {
          cache.delete(k);
        }
      }
    }
    record = { timestamps: [] };
    cache.set(key, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((ts) => ts >= windowStart);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0];
    const resetTimeMs = oldestTimestamp + windowMs - now;
    return { success: false, remaining: 0, resetTimeMs: Math.max(1000, resetTimeMs) };
  }

  record.timestamps.push(now);
  return {
    success: true,
    remaining: maxRequests - record.timestamps.length,
    resetTimeMs: windowMs,
  };
}

export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim().slice(0, 64);
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim().slice(0, 64);
  }
  return "127.0.0.1";
}
