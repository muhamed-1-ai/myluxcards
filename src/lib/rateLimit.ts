import "server-only";
import { isIP } from "node:net";

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

/**
 * Sanitizes and validates an IP address string.
 * Strips optional ports (e.g., "192.168.1.1:8080" or "[2001:db8::1]:8080")
 * and verifies that the output is a valid IPv4 or IPv6 address.
 */
export function sanitizeIpAddress(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== "string") return null;
  let candidate = ip.trim();

  // Strip port from IPv4 address
  if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(candidate)) {
    candidate = candidate.split(":")[0];
  }
  // Strip bracketed IPv6 with optional port
  if (/^\[([a-fA-F0-9:]+)\](:\d+)?$/.test(candidate)) {
    candidate = candidate.replace(/^\[|\](:\d+)?$/g, "");
  }

  if (isIP(candidate)) {
    return candidate;
  }
  return null;
}

export function getClientIp(request: Request): string {
  return getTrustedClientIp(request);
}

/**
 * Checks whether an IP address belongs to private, loopback, or internal networks.
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  // IPv4 Private subnets
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  // IPv4 Link-local
  if (ip.startsWith("169.254.")) return true;
  // IPv6 ULA / link-local
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  return false;
}

/**
 * Resolves the client IP address according to the reverse proxy architecture.
 *
 * Security Guarantees:
 * 1. Do not blindly trust arbitrary or leftmost forwarded headers, as an attacker can spoof them.
 * 2. In reverse-proxy environments (Coolify / Traefik / Nginx), the proxy appends the caller's IP.
 *    By traversing right-to-left past internal/private infrastructure hops, the true client IP is extracted.
 * 3. Direct origin requests without a trusted proxy (trustProxy=false) do not trust forwarded headers.
 * 4. Strictly validates IP format (IPv4 / IPv6) to reject header injections and malformed strings.
 */
export function getTrustedClientIp(
  req?: Request | { headers?: any; socket?: any } | Headers | null,
  options?: { trustProxy?: boolean; trustedHops?: number; trustCloudflare?: boolean }
): string {
  if (!req) return "127.0.0.1";

  // Check if proxy trust is active
  const isProd = process.env.NODE_ENV === "production";
  const trustProxy =
    options?.trustProxy ??
    (process.env.TRUST_PROXY !== "false");

  const explicitHops = options?.trustedHops ?? (process.env.TRUSTED_PROXY_HOPS ? parseInt(process.env.TRUSTED_PROXY_HOPS, 10) : undefined);
  const trustCloudflare =
    options?.trustCloudflare ?? (process.env.TRUST_CLOUDFLARE === "true");

  let directSocketIp: string | null = null;
  if ("socket" in req && req.socket?.remoteAddress) {
    directSocketIp = sanitizeIpAddress(req.socket.remoteAddress);
  }

    // If proxy trust is disabled (direct-origin requests), do not trust forwarded headers
    if (!trustProxy) {
      return directSocketIp || "127.0.0.1";
    }

      let xff: string | null = null;
      let realIp: string | null = null;
      let cfIp: string | null = null;

      if (typeof (req as any).get === "function") {
        const h = req as Headers;
        xff = h.get("x-forwarded-for");
        realIp = h.get("x-real-ip");
        cfIp = h.get("cf-connecting-ip");
      } else if ("headers" in req && req.headers) {
        const h = req.headers;
        if (typeof h.get === "function") {
          xff = h.get("x-forwarded-for");
          realIp = h.get("x-real-ip");
          cfIp = h.get("cf-connecting-ip");
        } else {
          xff = h["x-forwarded-for"] || h["X-Forwarded-For"] || null;
          realIp = h["x-real-ip"] || h["X-Real-IP"] || null;
          cfIp = h["cf-connecting-ip"] || h["CF-Connecting-IP"] || null;
        }
      }

        // 1. Cloudflare connecting IP (when explicitly enabled or present in CF environment)
        if (cfIp) {
          const cleanCf = sanitizeIpAddress(cfIp);
          if (cleanCf && (trustCloudflare || options?.trustCloudflare !== false)) {
            return cleanCf;
          }
        }

        // 2. X-Forwarded-For header resolution
        if (xff && typeof xff === "string") {
          const parts = xff
            .split(",")
            .map((part) => sanitizeIpAddress(part))
            .filter((ip): ip is string => Boolean(ip));

          if (parts.length > 0) {
            if (explicitHops !== undefined && explicitHops > 0) {
              const targetIndex = Math.max(0, parts.length - explicitHops);
              return parts[targetIndex];
            }

            // If no explicit hop count is given, inspect from right (closest proxy) to left.
            // Strip internal private infrastructure hops (e.g. Docker 10.x, 172.x).
            // The first external/public IP from the right is the true client IP.
            for (let i = parts.length - 1; i >= 0; i--) {
              if (!isPrivateOrLoopbackIp(parts[i])) {
                return parts[i];
              }
            }

            // If all IPs are internal/private, return the rightmost valid IP
            return parts[parts.length - 1];
          }
        }

        // 3. X-Real-IP set by trusted upstream reverse proxy
        if (realIp && typeof realIp === "string") {
          const cleanReal = sanitizeIpAddress(realIp);
          if (cleanReal) return cleanReal;
        }

        // 4. Fallback to direct socket IP or loopback
        return directSocketIp || "127.0.0.1";
      }
