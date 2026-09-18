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

export function normalizeRootPrefix(rawPrefix?: string): string {
  if (!rawPrefix) return "";
  let trimmed = rawPrefix.trim().replace(/\\/g, "/");
  // Trim leading and trailing slashes
  trimmed = trimmed.replace(/^\/+|\/+$/g, "");
  // Remove traversal components
  const parts = trimmed
    .split("/")
    .filter((segment) => segment !== "." && segment !== ".." && segment.length > 0);
  return parts.join("/");
}

export function normalizePublicUrl(rawUrl?: string): string {
  if (!rawUrl) return "";
  let trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

export function resolveWasabiEndpoint(
  customEndpoint?: string,
  customRegion?: string,
  isProd = process.env.NODE_ENV === "production"
): WasabiEndpointResult {
  const explicitRegion = (customRegion || process.env.WASABI_REGION || "").trim();
  const rawEndpoint = customEndpoint !== undefined ? customEndpoint : process.env.WASABI_ENDPOINT;

  // 1. Trim whitespace
  let endpoint = (rawEndpoint || "").trim();

  // 2. Remove trailing slashes
  endpoint = endpoint.replace(/\/+$/, "");

  // Validate HTTPS protocol in production if endpoint is provided
  if (isProd && endpoint && endpoint.startsWith("http://")) {
    throw new Error("Wasabi endpoint must use HTTPS in production.");
  }

  // 3. Extract region from explicit regional hostname if present (e.g. s3.us-east-1.wasabisys.com)
  let endpointRegion: string | null = null;
  const wasabiRegionalMatch = endpoint.match(/^https?:\/\/s3[.-]([a-z0-9-]+)\.wasabisys\.com$/i);
  if (wasabiRegionalMatch) {
    const matched = wasabiRegionalMatch[1].toLowerCase();
    if (matched !== "wasabisys") {
      endpointRegion = matched;
    }
  }

  // Determine effective region
  const region = explicitRegion || endpointRegion || "ap-southeast-1";

  // Check explicit mismatch if BOTH explicit region and endpoint region exist
  if (explicitRegion && endpointRegion && explicitRegion !== endpointRegion) {
    throw new Error(`Wasabi endpoint region mismatch: WASABI_ENDPOINT (${endpointRegion}) does not match WASABI_REGION (${explicitRegion}).`);
  }

  // 4. Check for generic endpoint variants (e.g. empty, "https://s3.wasabisys.com", "http://s3.wasabisys.com")
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

  // Absolute HTTP / HTTPS URLs or data URLs or relative paths starting with '/' or 'blob:'
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  const cleanKey = trimmed.replace(/^\/+/, "");

  // If WASABI_PUBLIC_URL is explicitly configured, use it directly
  const configuredPublicUrl = normalizePublicUrl(process.env.WASABI_PUBLIC_URL);
  if (configuredPublicUrl) {
    return `${configuredPublicUrl}/${cleanKey}`;
  }

  // Construct Wasabi public URL for object key using endpoint + bucket
  const bucket = process.env.WASABI_BUCKET;
  if (bucket) {
    const { endpoint } = resolveWasabiEndpoint();
    const cleanEndpoint = endpoint.replace(/\/+$/, "");
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

  // Wasabi public URL pattern with configured WASABI_PUBLIC_URL
  const configuredPublicUrl = normalizePublicUrl(process.env.WASABI_PUBLIC_URL);
  if (configuredPublicUrl && trimmed.startsWith(configuredPublicUrl)) {
    const key = trimmed.slice(configuredPublicUrl.length).replace(/^\/+/, "");
    if (key) return key;
  }

  // Wasabi bucket URL pattern
  const bucket = process.env.WASABI_BUCKET;
  if (bucket && trimmed.includes(`/${bucket}/`)) {
    const parts = trimmed.split(`/${bucket}/`);
    if (parts.length > 1 && parts[1]) {
      return parts[1];
    }
  }

  // Supabase URL pattern: /storage/v1/object/public/card-media/...
  if (trimmed.includes("/storage/v1/object/public/card-media/")) {
    const parts = trimmed.split("/storage/v1/object/public/card-media/");
    if (parts.length > 1 && parts[1]) {
      return parts[1];
    }
  }

  // If it does not start with http://, https://, or /, assume it's already an object key
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    return trimmed;
  }

  return null;
}

