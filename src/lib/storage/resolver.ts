/**
 * Media URL Resolver for ZAPPIT
 * Seamlessly resolves stored media references:
 * - Legacy Supabase URLs (https://...supabase...) -> returned as-is
 * - External absolute URLs (https://...) -> returned as-is
 * - Local static asset paths (/assets/...) -> returned as-is
 * - Wasabi storage keys (e.g. cards/123/logo/abc.png) -> converted to canonical Wasabi public URL
 */

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
  const endpoint = process.env.WASABI_ENDPOINT;

  if (bucket && endpoint) {
    const cleanEndpoint = endpoint.replace(/\/+$/, "");
    const cleanKey = trimmed.replace(/^\/+/, "");
    // Standard Wasabi S3 endpoint pattern: https://s3.wasabisys.com/bucket-name/key or https://bucket-name.s3.wasabisys.com/key
    if (cleanEndpoint.includes("wasabisys.com")) {
      return `${cleanEndpoint}/${bucket}/${cleanKey}`;
    }
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
