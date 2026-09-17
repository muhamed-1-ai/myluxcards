/**
 * Media URL Resolver for ZAPPIT
 * Seamlessly resolves stored media references:
 * - Legacy Supabase URLs (https://...supabase...) -> returned as-is
 * - External absolute URLs (https://...) -> returned as-is
 * - Local static asset paths (/assets/...) -> returned as-is
 * - Wasabi storage keys (e.g. cards/123/logo/abc.png) -> converted to canonical Wasabi public URL
 */

export interface WasabiEndpointResult {
  endpoint: string;
  region: string;
  autoCorrected: boolean;
}

export function resolveWasabiEndpoint(
  customEndpoint?: string,
  customRegion?: string,
  isProd = process.env.NODE_ENV === "production"
): WasabiEndpointResult {
  const region = (customRegion || process.env.WASABI_REGION || "ap-southeast-1").trim();
  const rawEndpoint = customEndpoint !== undefined ? customEndpoint : process.env.WASABI_ENDPOINT;

  // 1. Trim whitespace
  let endpoint = (rawEndpoint || "").trim();

  // 2. Remove trailing slashes
  endpoint = endpoint.replace(/\/+$/, "");

  // 3. Check for generic endpoint variants
  const isGeneric =
    !endpoint ||
    endpoint === "https://s3.wasabisys.com" ||
    endpoint === "http://s3.wasabisys.com";

  if (isGeneric) {
    if (region === "us-east-1") {
      const derived = "https://s3.wasabisys.com";
      return {
        endpoint: derived,
        region,
        autoCorrected: Boolean(endpoint && endpoint !== derived),
      };
    } else {
      const derived = `https://s3.${region}.wasabisys.com`;
      return {
        endpoint: derived,
        region,
        autoCorrected: true,
      };
    }
  }

  // Validate HTTPS protocol in production
  if (isProd && endpoint.startsWith("http://")) {
    throw new Error("Wasabi endpoint must use HTTPS in production.");
  }

  // Check explicit regional Wasabi endpoint mismatch
  const wasabiRegionalMatch = endpoint.match(/^https?:\/\/s3[.-]([a-z0-9-]+)\.wasabisys\.com$/i);
  if (wasabiRegionalMatch) {
    const endpointRegion = wasabiRegionalMatch[1].toLowerCase();
    if (endpointRegion === "wasabisys") {
      if (region !== "us-east-1") {
        return {
          endpoint: `https://s3.${region}.wasabisys.com`,
          region,
          autoCorrected: true,
        };
      }
    } else if (endpointRegion !== region) {
      throw new Error(`Wasabi endpoint region mismatch: WASABI_ENDPOINT (${endpointRegion}) does not match WASABI_REGION (${region}).`);
    }
  }

  return {
    endpoint,
    region,
    autoCorrected: false,
  };
}

export function resolveMediaUrl(urlOrKey: string | null | undefined): string {
  if (!urlOrKey) return "";
  const trimmed = urlOrKey.trim();
  if (!trimmed) return "";

  // Absolute HTTP / HTTPS URLs or data URLs or relative paths starting with '/'
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // Construct Wasabi public URL for object key
  const bucket = process.env.WASABI_BUCKET;
  if (bucket) {
    const { endpoint } = resolveWasabiEndpoint();
    const cleanEndpoint = endpoint.replace(/\/+$/, "");
    const cleanKey = trimmed.replace(/^\/+/, "");
    return `${cleanEndpoint}/${bucket}/${cleanKey}`;
  }

  // Fallback: return as-is
  return trimmed;
}

/**
 * Extracts storage key or path from a given media URL or storage key.
 * Used by media pruner and delete logic to safely reference objects.
 */
export function extractStorageKey(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  const trimmed = urlOrKey.trim();
  if (!trimmed) return null;

  // Wasabi URL pattern
  const bucket = process.env.WASABI_BUCKET;
  if (bucket && trimmed.includes(`/${bucket}/`)) {
    const parts = trimmed.split(`/${bucket}/`);
    if (parts.length > 1) {
      return parts[1];
    }
  }

  // Supabase URL pattern: /storage/v1/object/public/card-media/...
  if (trimmed.includes("/storage/v1/object/public/card-media/")) {
    const parts = trimmed.split("/storage/v1/object/public/card-media/");
    if (parts.length > 1) {
      return parts[1];
    }
  }

  // If it does not start with http://, https://, or /, assume it's already an object key
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    return trimmed;
  }

  return null;
}
