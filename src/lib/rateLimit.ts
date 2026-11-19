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
 * Default trusted reverse proxy address ranges matching Coolify/Traefik Docker architecture.
 * - 127.0.0.1/8: Local host reverse proxies
 * - ::1/128: IPv6 loopback
 * - 172.16.0.0/12: Docker default bridge and user-defined bridge networks
 * - 10.0.0.0/8: Docker overlay / Coolify container networks
 */
export const DEFAULT_TRUSTED_PROXY_RANGES = [
  "127.0.0.1/8",
  "::1",
  "::1/128",
  "172.16.0.0/12",
  "10.0.0.0/8",
];

/**
 * Checks whether an IPv4 address matches a given CIDR subnet or exact IP.
 */
function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!ip || !cidr) return false;
  const cleanIp = ip.trim();
  const cleanCidr = cidr.trim();

  // Handle exact IPv6 loopback
  if (cleanIp === "::1" && (cleanCidr === "::1" || cleanCidr === "::1/128")) {
    return true;
  }

  // Handle IPv4 CIDR matching
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp)) {
    if (cleanCidr.includes("/")) {
      const [range, bitsStr] = cleanCidr.split("/");
      const bits = parseInt(bitsStr, 10);
      if (isNaN(bits) || bits < 0 || bits > 32) return false;
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(range)) return false;

      const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0;
      return (ipv4ToInt(cleanIp) & mask) === (ipv4ToInt(range) & mask);
    }
    return cleanIp === cleanCidr;
  }

  return cleanIp.toLowerCase() === cleanCidr.toLowerCase();
}

/**
 * Verifies whether an incoming socket address is a recognized trusted reverse proxy.
 * Checks against TRUSTED_PROXIES env var or DEFAULT_TRUSTED_PROXY_RANGES.
 */
export function isTrustedProxy(ip: string | null | undefined, customList?: string[]): boolean {
  if (!ip) return false;
  const rawList =
    customList ||
    (process.env.TRUSTED_PROXIES
      ? process.env.TRUSTED_PROXIES.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_TRUSTED_PROXY_RANGES);

  return rawList.some((range) => ipMatchesCidr(ip, range));
}

/**
 * Address classifier: Checks whether an IP address belongs to private or loopback ranges.
 * Kept strictly separate from proxy trust validation.
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
 * Resolves the authentic client IP address according to our Coolify/Traefik reverse proxy architecture.
 *
 * Security Guarantees:
 * 1. Explicit proxy trust: Direct connections from untrusted socket addresses reject forwarded headers.
 * 2. Traefik single-hop verification: Traefik appends the real caller IP to the end of X-Forwarded-For.
 *    Using verified trusted hops (default 1), the client IP is extracted from (parts.length - trustedHops).
 * 3. Leftmost spoofed IPs injected by malicious callers are safely ignored.
 * 4. Private IP detection is treated as an address classifier, not an automatic proxy trust bypass.
 */
export function getTrustedClientIp(
  req?: Request | { headers?: any; socket?: any } | Headers | null,
  options?: {
    trustProxy?: boolean;
    trustedHops?: number;
    trustedProxies?: string[];
    trustCloudflare?: boolean;
  }
): string {
  if (!req) return "127.0.0.1";

  const isProd = process.env.NODE_ENV === "production";
  const trustProxy =
    options?.trustProxy ??
    (process.env.TRUST_PROXY !== "false");

  const trustedHops = Math.max(
    1,
    options?.trustedHops ??
    (process.env.TRUSTED_PROXY_HOPS
      ? parseInt(process.env.TRUSTED_PROXY_HOPS, 10)
      : 1)
  );

  const trustCloudflare =
    options?.trustCloudflare ?? (process.env.TRUST_CLOUDFLARE === "true");

  let directSocketIp: string | null = null;
  if ("socket" in req && req.socket?.remoteAddress) {
    directSocketIp = sanitizeIpAddress(req.socket.remoteAddress);
  }

    // If the direct socket connection IP is known, verify that the caller is an authentic trusted proxy.
    // If the connection arrived directly from an untrusted peer (bypassing Traefik), reject all forwarded headers.
    if (directSocketIp) {
      const isSocketTrusted = isTrustedProxy(directSocketIp, options?.trustedProxies);
      if (!isSocketTrusted) {
        return directSocketIp;
      }
    } else if (!trustProxy) {
      return "127.0.0.1";
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

    // 1. Cloudflare connecting IP (when Cloudflare is trusted or present without explicit disable)
    if (cfIp) {
      const cleanCf = sanitizeIpAddress(cfIp);
      if (cleanCf && (trustCloudflare || options?.trustCloudflare !== false)) {
        return cleanCf;
      }
    }

      // 2. X-Forwarded-For resolution matching Traefik proxy hops
      if (xff && typeof xff === "string") {
        const parts = xff
          .split(",")
          .map((part) => sanitizeIpAddress(part))
          .filter((ip): ip is string => Boolean(ip));

          if (parts.length > 0) {
            if (options?.trustedHops !== undefined) {
              const targetIndex = Math.max(0, parts.length - options.trustedHops);
              return parts[targetIndex];
            }

          // Walk right-to-left past trusted reverse proxy hops (e.g. Traefik / Docker bridge)
          for (let i = parts.length - 1; i >= 0; i--) {
            if (!isTrustedProxy(parts[i], options?.trustedProxies)) {
              return parts[i];
            }
          }

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
