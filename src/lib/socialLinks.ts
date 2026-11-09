/**
 * Utilities for multi-URL support across Apps & Links in Zappit Cards.
 * Supports up to 3 URLs per link type with custom display names,
 * URL normalization, duplicate URL rejection, and accessible labels.
 */

import {
  extractInstagramHandle,
  isValidInstagramUrl,
  normalizeInstagramUrl,
  cleanInstagramAccounts,
  resolveInstagramTiles,
  type InstagramAccount,
} from "./instagram";

export const MAX_URLS_PER_TYPE = 3;

export interface SocialLinkAccount {
  id?: string;
  url: string;
  name?: string;
}

export interface ResolvedSocialTile {
  key: string;
  url: string;
  name: string;
  subText?: string;
  brand: string;
  ariaLabel: string;
}

export interface SocialLinkTypeDefinition {
  key: string;
  label: string;
  brand: string;
  defaultLabel: string;
  placeholder: string;
  hint?: string;
}

export const SOCIAL_LINK_DEFINITIONS: Record<string, SocialLinkTypeDefinition> = {
  Instagram: {
    key: "Instagram",
    label: "Instagram",
    brand: "instagram",
    defaultLabel: "Instagram",
    placeholder: "https://instagram.com/yourname",
  },
  Facebook: {
    key: "Facebook",
    label: "Facebook",
    brand: "facebook",
    defaultLabel: "Facebook",
    placeholder: "https://facebook.com/yourname",
  },
  YouTube: {
    key: "YouTube",
    label: "YouTube",
    brand: "youtube",
    defaultLabel: "YouTube",
    placeholder: "https://youtube.com/yourname",
  },
  LinkedIn: {
    key: "LinkedIn",
    label: "LinkedIn",
    brand: "linkedin",
    defaultLabel: "LinkedIn",
    placeholder: "https://linkedin.com/yourname",
  },
  Twitter: {
    key: "Twitter",
    label: "Twitter/X",
    brand: "twitter",
    defaultLabel: "Twitter",
    placeholder: "https://twitter.com/yourname",
  },
  "Google Business": {
    key: "Google Business",
    label: "Google Business",
    brand: "google",
    defaultLabel: "Google Business",
    placeholder: "https://googlebusiness.com/yourname",
  },
  "Google Maps": {
    key: "Google Maps",
    label: "Google Maps",
    brand: "maps",
    defaultLabel: "Google Maps",
    placeholder: "Paste your Google Maps place or directions link",
  },
  "Google Reviews": {
    key: "Google Reviews",
    label: "Google Reviews",
    brand: "reviews",
    defaultLabel: "Google Reviews",
    placeholder: "Paste your Google review link (e.g. https://g.page/r/.../review)",
    hint: "Paste your business’s Google review link so visitors can read or leave a review.",
  },
  Website: {
    key: "Website",
    label: "Website",
    brand: "website",
    defaultLabel: "Website",
    placeholder: "https://example.com",
  },
};

export const ORDERED_LINK_TYPES = [
  "Instagram",
  "Facebook",
  "YouTube",
  "LinkedIn",
  "Twitter",
  "Google Business",
  "Google Maps",
  "Google Reviews",
  "Website",
];

// Reserved Twitter/X route names
const RESERVED_TWITTER_ROUTES = new Set([
  "home", "explore", "notifications", "messages", "search", "settings",
  "tos", "privacy", "help", "about", "intent", "share", "i"
]);

// Reserved Facebook route names
const RESERVED_FB_ROUTES = new Set([
  "pages", "groups", "watch", "photo", "photos", "share", "sharer", "login",
  "help", "settings", "terms", "privacy", "about", "dialog"
]);

/**
 * Extracts a recognizable handle or destination label from a URL.
 */
export function extractRecognizableHandleOrDestination(
  type: string,
  urlOrHandle: string,
  index: number
): string | null {
  if (!urlOrHandle || typeof urlOrHandle !== "string") return null;
  const trimmed = urlOrHandle.trim();
  if (!trimmed) return null;

  if (type === "Instagram") {
    const igHandle = extractInstagramHandle(trimmed);
    return igHandle ? `@${igHandle}` : null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (type === "Twitter" || type === "Twitter/X") {
      if (host.includes("twitter.com") || host.includes("x.com")) {
        const segments = pathname.split("/").filter(Boolean);
        if (segments.length > 0) {
          const first = segments[0].replace(/^@/, "");
          if (first && !RESERVED_TWITTER_ROUTES.has(first.toLowerCase())) {
            return `@${first}`;
          }
        }
      }
      return `@${trimmed.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\/?/i, "").replace(/^@/, "").split(/[\/?#]/)[0] || `Twitter ${index + 1}`}`;
    }

    if (type === "Facebook") {
      if (host.includes("facebook.com") || host.includes("fb.com") || host.includes("fb.watch")) {
        const segments = pathname.split("/").filter(Boolean);
        if (segments.length > 0) {
          const first = segments[0].replace(/^@/, "");
          if (first && !RESERVED_FB_ROUTES.has(first.toLowerCase()) && !first.startsWith("profile.php")) {
            return `@${first}`;
          }
        }
      }
      return `Facebook ${index + 1}`;
    }

    if (type === "YouTube") {
      if (host.includes("youtube.com") || host.includes("youtu.be")) {
        const segments = pathname.split("/").filter(Boolean);
        if (segments.length > 0) {
          const first = segments[0];
          if (first.startsWith("@")) return first;
          if ((first === "c" || first === "channel" || first === "user") && segments[1]) {
            return `@${segments[1]}`;
          }
          if (first && first !== "watch" && first !== "shorts" && first !== "feed") {
            return `@${first}`;
          }
        }
      }
      return `YouTube ${index + 1}`;
    }

    if (type === "LinkedIn") {
      if (host.includes("linkedin.com")) {
        const segments = pathname.split("/").filter(Boolean);
        if (segments.length >= 2 && (segments[0] === "in" || segments[0] === "company")) {
          return `@${segments[1]}`;
        }
        if (segments.length > 0 && segments[0] !== "feed") {
          return `@${segments[0]}`;
        }
      }
      return `LinkedIn ${index + 1}`;
    }

    if (type === "Website") {
      const cleanHost = host.replace(/^www\./i, "");
      return cleanHost || `Website ${index + 1}`;
    }

    if (type === "Google Maps") {
      const q = parsed.searchParams.get("q") || parsed.searchParams.get("query");
      if (q && q.length <= 30 && !/^[0-9.,+-]+$/.test(q)) {
        return q.replace(/\+/g, " ");
      }
      return `Google Maps ${index + 1}`;
    }

    if (type === "Google Reviews") {
      return `Google Reviews ${index + 1}`;
    }

    if (type === "Google Business") {
      return `Google Business ${index + 1}`;
    }

    return `${type} ${index + 1}`;
  } catch {
    return `${type} ${index + 1}`;
  }
}

/**
 * Normalizes a URL for comparison and storage.
 */
export function normalizeSocialUrl(type: string, urlOrHandle: string): string | null {
  if (!urlOrHandle || typeof urlOrHandle !== "string") return null;
  const trimmed = urlOrHandle.trim();
  if (!trimmed) return null;

  if (type === "Instagram") {
    return normalizeInstagramUrl(trimmed);
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes(".")) return null;
    let path = parsed.pathname.replace(/\/+$/, "");
    if (!path) path = "";
    return `${parsed.protocol}//${host}${path}${parsed.search}`;
  } catch {
    return null;
  }
}

/**
 * Canonical deduplication key for duplicate detection.
 */
export function canonicalDedupeKey(type: string, urlOrHandle: string): string | null {
  if (!urlOrHandle || typeof urlOrHandle !== "string") return null;
  const trimmed = urlOrHandle.trim();
  if (!trimmed) return null;

  if (type === "Instagram") {
    const handle = extractInstagramHandle(trimmed);
    return handle ? `ig:${handle.toLowerCase()}` : null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, "");
    return `${host}${pathname}${parsed.search.toLowerCase()}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Validates whether a URL is acceptable for the specified link type.
 */
export function isValidSocialUrl(type: string, urlOrHandle: string): boolean {
  if (!urlOrHandle || typeof urlOrHandle !== "string") return false;
  const trimmed = urlOrHandle.trim();
  if (!trimmed) return false;

  if (type === "Instagram") {
    return isValidInstagramUrl(trimmed);
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return Boolean(parsed.hostname && parsed.hostname.includes("."));
  } catch {
    return false;
  }
}

/**
 * Cleans and sanitizes an array of accounts for a specific link type:
 * - Trims URLs and display names
 * - Enforces max 3 accounts
 * - Discards completely empty rows
 * - Deduplicates URLs/handles
 */
export function cleanAccountsForType(type: string, raw: unknown): SocialLinkAccount[] {
  if (!Array.isArray(raw)) return [];
  if (type === "Instagram") {
    return cleanInstagramAccounts(raw);
  }

  const cleaned: SocialLinkAccount[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;

    const rawUrl = String((item as any).url || "").trim();
    const rawName = String((item as any).name || "").trim().slice(0, 60);

    if (!rawUrl && !rawName) continue;
    if (!isValidSocialUrl(type, rawUrl)) continue;

    const key = canonicalDedupeKey(type, rawUrl);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const normUrl = normalizeSocialUrl(type, rawUrl) || rawUrl;
    cleaned.push({
      id: String((item as any).id || `${type.toLowerCase().replace(/[^a-z0-9]/g, "")}_${i}_${Date.now()}`),
      url: normUrl,
      name: rawName,
    });

    if (cleaned.length >= MAX_URLS_PER_TYPE) break;
  }

  return cleaned;
}

/**
 * Cleans the full socialAccounts map:
 * Returns Record<string, SocialLinkAccount[]>
 */
export function cleanSocialAccounts(raw: unknown): Record<string, SocialLinkAccount[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const output: Record<string, SocialLinkAccount[]> = {};

  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    const cleaned = cleanAccountsForType(key, list);
    output[key] = cleaned;
  }

  return output;
}

/**
 * Resolves tile metadata for a single link type:
 * - 1 URL, no custom name: label = defaultLabel, subText = undefined
 * - 1 URL, with custom name: label = customName, subText = undefined
 * - Multiple URLs: custom name with destination subtext, or destination as main label
 */
export function resolveLinkTiles(
  linkType: string,
  accounts?: SocialLinkAccount[] | null,
  legacyFallbackUrl?: string | null
): ResolvedSocialTile[] {
  const def = SOCIAL_LINK_DEFINITIONS[linkType] || {
    key: linkType,
    label: linkType,
    brand: linkType.toLowerCase().replace(/[^a-z0-9]/g, ""),
    defaultLabel: linkType,
    placeholder: "https://...",
  };

  if (linkType === "Instagram") {
    const igTiles = resolveInstagramTiles(accounts as InstagramAccount[] | undefined, legacyFallbackUrl);
    return igTiles.map((t) => ({
      key: t.key,
      url: t.url,
      name: t.name,
      subText: t.subText,
      brand: "instagram",
      ariaLabel: t.ariaLabel,
    }));
  }

  const rawList: SocialLinkAccount[] = [];
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
  } else if (legacyFallbackUrl && String(legacyFallbackUrl).trim()) {
    rawList.push({
      url: String(legacyFallbackUrl).trim(),
      name: "",
    });
  }

  // Deduplicate and validate
  const validList: { account: SocialLinkAccount; dest: string }[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < rawList.length; i++) {
    const acc = rawList[i];
    if (!isValidSocialUrl(linkType, acc.url)) continue;
    const key = canonicalDedupeKey(linkType, acc.url);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const dest = extractRecognizableHandleOrDestination(linkType, acc.url, i) || `${def.defaultLabel} ${i + 1}`;
    validList.push({ account: acc, dest });
    if (validList.length >= MAX_URLS_PER_TYPE) break;
  }

  const count = validList.length;
  if (count === 0) return [];

  return validList.map(({ account, dest }, index) => {
    const customName = (account.name || "").trim();
    let mainLabel: string;
    let subText: string | undefined;
    let ariaLabel: string;

    if (count === 1) {
      if (customName) {
        mainLabel = customName;
        subText = undefined;
        ariaLabel = `${customName} on ${def.defaultLabel}`;
      } else {
        mainLabel = def.defaultLabel;
        subText = undefined;
        ariaLabel = `${def.defaultLabel} (${dest})`;
      }
    } else {
      if (customName) {
        mainLabel = customName;
        subText = dest && dest !== customName ? dest : undefined;
        ariaLabel = `${customName} (${dest || def.defaultLabel}) on ${def.defaultLabel}`;
      } else {
        mainLabel = dest || `${def.defaultLabel} ${index + 1}`;
        subText = undefined;
        ariaLabel = `${mainLabel} on ${def.defaultLabel}`;
      }
    }

    const normUrl = normalizeSocialUrl(linkType, account.url) || account.url;

    return {
      key: `${def.brand}-${index}`,
      url: normUrl,
      name: mainLabel,
      subText,
      brand: def.brand,
      ariaLabel,
    };
  });
}

/**
 * Resolves all social link tiles for a card profile in defined order.
 */
export function resolveAllCardSocialTiles(card: {
  social?: Record<string, string>;
  instagramAccounts?: InstagramAccount[];
  socialAccounts?: Record<string, SocialLinkAccount[]>;
  website?: string;
}): ResolvedSocialTile[] {
  const tiles: ResolvedSocialTile[] = [];
  const socialAccounts = card.socialAccounts || {};
  const social = card.social || {};

  // 1. Instagram
  const igAccounts = socialAccounts.Instagram || card.instagramAccounts;
  const igTiles = resolveLinkTiles("Instagram", igAccounts, social.Instagram || social.instagram);
  tiles.push(...igTiles);

  // 2. Website
  const webAccounts = socialAccounts.Website;
  const webTiles = resolveLinkTiles("Website", webAccounts, card.website);
  tiles.push(...webTiles);

  // 3. LinkedIn
  const liAccounts = socialAccounts.LinkedIn;
  const liTiles = resolveLinkTiles("LinkedIn", liAccounts, social.LinkedIn || social.linkedin);
  tiles.push(...liTiles);

  // 4. YouTube
  const ytAccounts = socialAccounts.YouTube;
  const ytTiles = resolveLinkTiles("YouTube", ytAccounts, social.YouTube || social.youtube);
  tiles.push(...ytTiles);

  // 5. Facebook
  const fbAccounts = socialAccounts.Facebook;
  const fbTiles = resolveLinkTiles("Facebook", fbAccounts, social.Facebook || social.facebook);
  tiles.push(...fbTiles);

  // 6. Twitter
  const twAccounts = socialAccounts.Twitter;
  const twTiles = resolveLinkTiles("Twitter", twAccounts, social.Twitter || social.twitter);
  tiles.push(...twTiles);

  // 7. Google Business
  const gbAccounts = socialAccounts["Google Business"];
  const gbTiles = resolveLinkTiles("Google Business", gbAccounts, social["Google Business"] || social.googlebusiness);
  tiles.push(...gbTiles);

  // 8. Google Maps
  const gmAccounts = socialAccounts["Google Maps"];
  const gmTiles = resolveLinkTiles("Google Maps", gmAccounts, social["Google Maps"] || social.googlemaps || (!social["Google Business"] && !social.googlebusiness ? social.google : undefined));
  tiles.push(...gmTiles);

  // 9. Google Reviews
  const grAccounts = socialAccounts["Google Reviews"];
  const grTiles = resolveLinkTiles("Google Reviews", grAccounts, social["Google Reviews"] || social["google-reviews"] || social["google_reviews"] || social.googlereviews || social.reviews);
  tiles.push(...grTiles);

  return tiles;
}

