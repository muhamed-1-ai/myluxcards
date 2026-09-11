/**
 * Canonical URL utilities for 3G ZAPPIT.
 * Prevents deployment provider lock-in and guarantees consistent origin generation
 * across Coolify, Vercel, Hetzner, or any host.
 */

export const CANONICAL_PRODUCTION_DOMAIN = "https://3gzappit.com";

/**
 * Returns the canonical application origin.
 * In production mode, public destinations ALWAYS prioritize the permanent production domain
 * (https://3gzappit.com) or explicit APP_URL over temporary Coolify / proxy hostnames.
 */
export function getAppOrigin(request?: Request): string {
  const isProd = process.env.NODE_ENV === "production";

  // 1. Environmental override (server or build-time client env)
  const envUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) {
    const cleaned = envUrl.trim().replace(/\/$/, "");
    const isLocal = /localhost|127\.0\.0\.1/i.test(cleaned);
    const isCoolifyTemp = /coolify|ssli|preview|docker|local/i.test(cleaned);
    if (cleaned && /^https?:\/\//i.test(cleaned) && (!isProd || (!isLocal && !isCoolifyTemp))) {
      return cleaned;
    }
  }

  // 2. Production default: Always return canonical public domain
  if (isProd) {
    return CANONICAL_PRODUCTION_DOMAIN;
  }

  // 3. Browser runtime context (for local dev interaction)
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  // 4. Derive from incoming Request headers (reverse-proxy aware for local dev)
  if (request) {
    try {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const host = forwardedHost || request.headers.get("host");
      if (host) {
        const cleanHost = host.split(",")[0].trim();
        const proto = request.headers.get("x-forwarded-proto") || (cleanHost.includes("localhost") ? "http" : "https");
        return `${proto}://${cleanHost}`;
      }
    } catch {
      // Fallback below
    }
  }

  return CANONICAL_PRODUCTION_DOMAIN;
}

export function cleanSlugString(slug: string): string {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Returns the permanent public card profile URL: https://3gzappit.com/<profile-slug>
 */
export function getPublicCardUrl(slug: string, request?: Request): string {
  const cleanSlug = cleanSlugString(slug);
  const origin = getAppOrigin(request);
  return `${origin}/${cleanSlug}`;
}

export function getPublicCardQrUrl(slug: string, request?: Request): string {
  return `${getPublicCardUrl(slug, request)}?src=qr`;
}

export function getPublicCardNfcUrl(slug: string, request?: Request): string {
  return `${getPublicCardUrl(slug, request)}?src=nfc`;
}

/**
 * Legacy card URL format: https://3gzappit.com/card/<profile-slug>
 */
export function getLegacyCardUrl(slug: string, request?: Request): string {
  const cleanSlug = cleanSlugString(slug);
  const origin = getAppOrigin(request);
  return `${origin}/card/${cleanSlug}`;
}

export function getRelativeCardUrl(slug: string): string {
  const cleanSlug = cleanSlugString(slug);
  return `/${cleanSlug}`;
}

export function getCanonicalUserQrUrl(userOrSlug: any, request?: Request): string {
  if (!userOrSlug) return `${getAppOrigin(request)}/find?src=qr`;
  if (typeof userOrSlug === "string") {
    return getPublicCardQrUrl(userOrSlug, request);
  }
  const slug =
    userOrSlug.digital_card_slug ||
    userOrSlug.card_slug ||
    userOrSlug.slug ||
    (Array.isArray(userOrSlug.digitalCards) && userOrSlug.digitalCards[0]?.slug) ||
    userOrSlug.id;

  return getPublicCardQrUrl(String(slug), request);
}


