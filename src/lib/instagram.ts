/**
 * Utilities for Instagram multi-account support in Zappit Cards.
 * Supports up to 3 Instagram accounts per card with custom display names,
 * URL normalization, duplicate handle rejection, and accessible labels.
 */

export const MAX_INSTAGRAM_ACCOUNTS = 3;

export interface InstagramAccount {
  id?: string;
  url: string;
  name?: string;
}

export interface ResolvedInstagramTile {
  key: string;
  url: string;
  name: string;
  subText?: string;
  handle: string;
  ariaLabel: string;
}

// Reserved Instagram pathnames that are not personal or business profiles
const RESERVED_IG_ROUTES = new Set([
  "p", "reel", "reels", "stories", "explore", "direct", "accounts",
  "developer", "about", "legal", "terms", "privacy", "help", "static", "tv"
]);

/**
 * Extracts a clean Instagram username/handle from an input URL or raw handle.
 * Returns null if the URL is invalid, points to a reserved route, or is not an Instagram URL.
 */
export function extractInstagramHandle(urlOrHandle: string): string | null {
  if (!urlOrHandle || typeof urlOrHandle !== "string") return null;
  const trimmed = urlOrHandle.trim();
  if (!trimmed || trimmed.length > 500) return null;

  // If user typed @username directly
  if (/^@?[a-zA-Z0-9._]{1,30}$/.test(trimmed) && !trimmed.includes(".") && !trimmed.includes("/")) {
    const handle = trimmed.replace(/^@/, "");
    return handle && !RESERVED_IG_ROUTES.has(handle.toLowerCase()) ? handle : null;
  }

  // Prepend https:// if protocol is missing
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const validHosts = ["instagram.com", "www.instagram.com", "instagr.am", "www.instagr.am"];
    if (!validHosts.includes(host)) return null;

    // Reject URLs with credentials
    if (parsed.username || parsed.password) return null;

    // Pathname segments
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    const firstSegment = segments[0].replace(/^@/, "");
    if (!firstSegment || RESERVED_IG_ROUTES.has(firstSegment.toLowerCase())) return null;

    // Valid Instagram handle format: 1-30 characters, alphanumeric, dots, underscores
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(firstSegment)) return null;

    return firstSegment;
  } catch {
    return null;
  }
}

/**
 * Validates whether the given string is a valid Instagram profile URL or handle.
 */
export function isValidInstagramUrl(urlOrHandle: string): boolean {
  return extractInstagramHandle(urlOrHandle) !== null;
}

/**
 * Normalizes an Instagram profile URL into canonical https://instagram.com/{handle}.
 */
export function normalizeInstagramUrl(urlOrHandle: string): string | null {
  const handle = extractInstagramHandle(urlOrHandle);
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

/**
 * Cleans and sanitizes an array of Instagram accounts:
 * - Trims and normalizes URLs
 * - Trims display names
 * - Discards completely empty rows
 * - Enforces uniqueness of handles (case-insensitive)
 * - Enforces maximum of 3 accounts
 */
export function cleanInstagramAccounts(raw: unknown): InstagramAccount[] {
  if (!Array.isArray(raw)) return [];

  const cleaned: InstagramAccount[] = [];
  const seenHandles = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;

    const rawUrl = String((item as any).url || "").trim();
    const rawName = String((item as any).name || "").trim().slice(0, 60);

    // Completely empty row -> skip
    if (!rawUrl && !rawName) continue;

    const handle = extractInstagramHandle(rawUrl);
    if (!handle) continue;

    const lowerHandle = handle.toLowerCase();
    if (seenHandles.has(lowerHandle)) continue;
    seenHandles.add(lowerHandle);

    cleaned.push({
      id: String((item as any).id || `ig_${i}_${Date.now()}`),
      url: `https://instagram.com/${handle}`,
      name: rawName,
    });

    if (cleaned.length >= MAX_INSTAGRAM_ACCOUNTS) break;
  }

  return cleaned;
}

/**
 * Resolves tile metadata for the public profile card and preview:
 * - 1 account, no custom name: label = "Instagram", subText = undefined
 * - 1 account, with custom name: label = customName, subText = undefined
 * - Multiple accounts: custom name if present with @handle subtext, or @handle as main label
 */
export function resolveInstagramTiles(
  accounts?: InstagramAccount[] | null,
  legacySocialInstagram?: string | null
): ResolvedInstagramTile[] {
  const rawList: InstagramAccount[] = [];

  if (Array.isArray(accounts) && accounts.length > 0) {
    for (const acc of accounts) {
      if (acc && typeof acc === "object" && acc.url && String(acc.url).trim()) {
        rawList.push({
          id: acc.id,
          url: String(acc.url).trim(),
          name: typeof acc.name === "string" ? acc.name.trim() : "",
        });
      }
    }
  } else if (legacySocialInstagram && String(legacySocialInstagram).trim()) {
    rawList.push({
      url: String(legacySocialInstagram).trim(),
      name: "",
    });
  }

  // Deduplicate and validate
  const validList: { account: InstagramAccount; handle: string }[] = [];
  const seenHandles = new Set<string>();

  for (const acc of rawList) {
    const handle = extractInstagramHandle(acc.url);
    if (!handle) continue;
    const lower = handle.toLowerCase();
    if (seenHandles.has(lower)) continue;
    seenHandles.add(lower);

    validList.push({ account: acc, handle });
    if (validList.length >= MAX_INSTAGRAM_ACCOUNTS) break;
  }

  const count = validList.length;
  if (count === 0) return [];

  return validList.map(({ account, handle }, index) => {
    const customName = (account.name || "").trim();
    const handleTag = `@${handle}`;
    let mainLabel: string;
    let subText: string | undefined;
    let ariaLabel: string;

    if (count === 1) {
      if (customName) {
        mainLabel = customName;
        subText = undefined;
        ariaLabel = `${customName} (${handleTag}) on Instagram`;
      } else {
        mainLabel = "Instagram";
        subText = undefined;
        ariaLabel = `Instagram (${handleTag})`;
      }
    } else {
      if (customName) {
        mainLabel = customName;
        subText = handleTag;
        ariaLabel = `${customName} (${handleTag}) on Instagram`;
      } else {
        mainLabel = handleTag;
        subText = undefined;
        ariaLabel = `${handleTag} on Instagram`;
      }
    }

    return {
      key: `instagram-${index}`,
      url: normalizeInstagramUrl(account.url) || account.url,
      name: mainLabel,
      subText,
      handle,
      ariaLabel,
    };
  });
}

