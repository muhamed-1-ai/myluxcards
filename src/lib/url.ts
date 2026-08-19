/**
 * Canonical URL utilities for MyLuxCards.
 * Prevents deployment provider lock-in and guarantees consistent origin generation
 * across Vercel, Coolify, Hetzner, or any host.
 */

export function getAppOrigin(request?: Request): string {
  const isProd = process.env.NODE_ENV === "production";

  // 1. Browser runtime context (always accurate for client interactions)
  if (typeof window !== "undefined" && window.location?.origin) {
    const isBrowserLocal = /localhost|127\.0\.0\.1/i.test(window.location.origin);
    if (!isProd || !isBrowserLocal) {
      return window.location.origin;
    }
  }

  // 2. Derive from incoming Request headers (reverse-proxy aware for Coolify / Hetzner)
  if (request) {
    try {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const host = forwardedHost || request.headers.get("host");
      if (host) {
        const cleanHost = host.split(",")[0].trim();
        const isHostLocal = /localhost|127\.0\.0\.1/i.test(cleanHost);
        if (!isHostLocal || !isProd) {
          const proto = request.headers.get("x-forwarded-proto") || (cleanHost.includes("localhost") ? "http" : "https");
          return `${proto}://${cleanHost}`;
        }
      }
    } catch {
      // Fallback below
    }
  }

  // 3. Environmental override (server or build-time client env)
  const envUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) {
    const cleaned = envUrl.trim().replace(/\/$/, "");
    const isLocal = /localhost|127\.0\.0\.1/i.test(cleaned);
    if (cleaned && /^https?:\/\//i.test(cleaned) && (!isProd || !isLocal)) {
      return cleaned;
    }
  }

  // 4. Default canonical production domain (Never vercel.app, never localhost in production)
  return "https://myluxcards.com";
}

export function getPublicCardUrl(slug: string, request?: Request): string {
  const cleanSlug = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const origin = getAppOrigin(request);
  return `${origin}/card/${cleanSlug}`;
}

export function getRelativeCardUrl(slug: string): string {
  const cleanSlug = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `/card/${cleanSlug}`;
}
