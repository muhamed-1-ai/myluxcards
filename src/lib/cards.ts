import { createHash } from "crypto";
import { normalizePhoneNumber } from "./phone";

export function formatCountryCode(code?: string | null): string {
  if (!code) return "+";
  const trimmed = String(code).trim();
  if (!trimmed) return "+";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

export const CARD_FIELDS = [
  "name","title","business","countryCode","countryIso","mobile","whatsapp","email","website",
  "state","stateCode","city","address","brochure","brochureData","social","about","services",
  "logo","cover","theme","profileTheme","profileBackground","profileAccent","profileText","start","expiry",
  "logoScale","logoZoom","logoRotation","logoX","logoY","coverScale","coverRotation","coverX","coverY",
  "profileMode","enabledFeatures","vehicleConnect","emergencyContact","lostAndFound",
  "defaultContactPhone","defaultEmergencyName","defaultEmergencyRelationship","defaultEmergencyPhone",
  "profileFeatures","featureOrder","profileFormat","modernConfig","simpleConfig",
  "contactNumbers","appDownload",
] as const;

export interface AppDownloadSettings {
  appName?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  referralUrl?: string;
}

export function isValidStoreUrl(value: string, store: "apple" | "google" | "universal"): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return false;

  // Reject unsafe schemes early (e.g. javascript:, data:, file:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

    // Reject URLs with embedded credentials (e.g. https://user:pass@example.com)
    if (parsed.username || parsed.password) return false;

    const host = parsed.hostname.toLowerCase();
    if (!host || host.length < 3) return false;

    // Hostname structure checks: must have at least one dot, cannot have consecutive dots or start/end with dot
    if (!host.includes(".") || host.startsWith(".") || host.endsWith(".") || host.includes("..")) {
      return false;
    }

    // Hostname characters check: only standard lowercase domain characters (alphanumeric, hyphens, dots)
    if (!/^[a-z0-9.-]+$/i.test(host)) return false;

    const labels = host.split(".");
    if (labels.some((l) => !l || l.startsWith("-") || l.endsWith("-"))) {
      return false;
    }
    const tld = labels[labels.length - 1];
    if (tld.length < 2 || !/^[a-z]{2,}$|^xn--[a-z0-9]+$/i.test(tld)) {
      return false;
    }

    // Reject deceptive store subdomains attempting to spoof store hosts (e.g. apps.apple.com.attacker.com)
    if (
      host.includes("apps.apple.com.") ||
      host.includes("play.google.com.") ||
      host.includes("itunes.apple.com.") ||
      host.includes("market.android.com.") ||
      host.includes("testflight.apple.com.")
    ) {
      return false;
    }

    // Reject generic homepages that are not store or referral app links
    if (["apple.com", "www.apple.com", "google.com", "www.google.com"].includes(host)) {
      return false;
    }

    const isAppleStoreHost = ["apps.apple.com", "itunes.apple.com", "testflight.apple.com"].includes(host);
    const isGoogleStoreHost = ["play.google.com", "market.android.com"].includes(host);

    // Direct store domain validations
    if (isAppleStoreHost) {
      if (parsed.pathname.length <= 1) return false;
      // Direct Apple App Store URL in Google Play field is mismatched
      if (store === "google") return false;
      return true;
    }

    if (isGoogleStoreHost) {
      if (parsed.pathname.length <= 1) return false;
      // Direct Google Play URL in Apple App Store field is mismatched
      if (store === "apple") return false;
      return true;
    }

    // Any other valid HTTPS/HTTP hostname is accepted as a referral, campaign, or app-provider link
    // (e.g. Branch, AppsFlyer OneLink, Adjust, Firebase Dynamic Links, custom vanity/campaign domains).
    // The field identifies which device platform (Apple vs Android) should use the destination.
    return true;
  } catch {
    return false;
  }
}

export function cleanStoreUrl(value: unknown, store: "apple" | "google" | "universal"): string {
  if (!value || typeof value !== "string") return "";
  let trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return "";

  // Reject unsafe schemes early
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return "";
  }

  // Normalize protocol to HTTPS without modifying query parameters, encoded nested URLs, or fragment
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  } else if (/^http:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed.slice(7)}`;
  }

  if (!isValidStoreUrl(trimmed, store)) return "";
  return trimmed;
}

export interface CardContactNumber {
  id: string;
  label: string;
  countryCode: string;
  phoneNumber: string;
  isPrimary: boolean;
  sortOrder?: number;
}

export const MAX_CONTACT_NUMBERS = 5;

/**
 * Reconciles draft contact numbers with server-persisted numbers.
 *
 * Guarantees that:
 * 1. Empty, incomplete, or newly added draft rows are never erased by server responses.
 * 2. Active user edits in draft rows (label, countryCode, phoneNumber) are never overwritten by stale responses.
 * 3. Canonical order and row identity (stable id) are preserved.
 * 4. Explicitly removed rows are not resurrected.
 */
export function reconcileContactNumbers(
  draftRows: CardContactNumber[] | undefined,
  savedRows: CardContactNumber[] | undefined
): CardContactNumber[] {
  if (!Array.isArray(draftRows) || draftRows.length === 0) {
    return Array.isArray(savedRows) ? savedRows : [];
  }
  if (!Array.isArray(savedRows) || savedRows.length === 0) {
    return draftRows;
  }

  const savedById = new Map<string, CardContactNumber>();
  for (const row of savedRows) {
    if (row && row.id) savedById.set(row.id, row);
  }

  return draftRows.map((draftRow) => {
    const savedRow = savedById.get(draftRow.id);
    if (!savedRow) {
      // Row exists only in local draft (e.g. newly added row or empty/in-progress row)
      return draftRow;
    }
    // Row exists in both: preserve user's local input while adopting any server metadata
    return {
      ...savedRow,
      ...draftRow,
    };
  });
}

export interface SimpleConfig {
  coverScale?: number;
  coverRotation?: number;
  coverX?: number;
  coverY?: number;
}

export type ProfileMode = "DIGITAL_PROFILE" | "VEHICLE_CONNECT" | "LOST_AND_FOUND";

export type ProfileDesignFormat = "modern" | "simple";

export interface ProfileDesignDefinition {
  id: ProfileDesignFormat;
  name: string;
  tagline: string;
  description: string;
}

export const SUPPORTED_PROFILE_DESIGNS: readonly ProfileDesignDefinition[] = [
  {
    id: "modern",
    name: "Modern",
    tagline: "Expansive & dynamic digital profile",
    description: "Rich showcase with prominent cover, badge accents, and expansive layout.",
  },
  {
    id: "simple",
    name: "Simple",
    tagline: "Clean digital business card",
    description: "Clean business profile with plain background, contained photo, and focused contact actions.",
  },
] as const;

export function isSupportedProfileDesign(format: unknown): format is ProfileDesignFormat {
  return typeof format === "string" && (format.toLowerCase().trim() === "modern" || format.toLowerCase().trim() === "simple");
}

export type ProfileFeatureKey =
  | "BASIC_PROFILE"
  | "CONTACT"
  | "SOCIAL_LINKS"
  | "WEBSITE"
  | "EMERGENCY_CONTACT"
  | "VEHICLE"
  | "LOST_AND_FOUND"
  | "PRODUCTS";

export interface ProfileFeatureItemConfig {
  enabled: boolean;
  sortOrder: number;
}

export type ProfileFeaturesConfig = Record<ProfileFeatureKey, ProfileFeatureItemConfig>;

export const DEFAULT_PROFILE_FEATURES: ProfileFeaturesConfig = {
  BASIC_PROFILE: { enabled: true, sortOrder: 0 },
  CONTACT: { enabled: true, sortOrder: 1 },
  SOCIAL_LINKS: { enabled: true, sortOrder: 2 },
  WEBSITE: { enabled: true, sortOrder: 3 },
  EMERGENCY_CONTACT: { enabled: true, sortOrder: 4 },
  VEHICLE: { enabled: true, sortOrder: 5 },
  LOST_AND_FOUND: { enabled: true, sortOrder: 6 },
  PRODUCTS: { enabled: false, sortOrder: 7 },
};

export const DEFAULT_FEATURE_ORDER: ProfileFeatureKey[] = [
  "BASIC_PROFILE",
  "CONTACT",
  "SOCIAL_LINKS",
  "WEBSITE",
  "EMERGENCY_CONTACT",
  "VEHICLE",
  "LOST_AND_FOUND",
  "PRODUCTS",
];

export interface EnabledFeatures {
  digitalProfile: boolean;
  vehicleConnect: boolean;
  lostAndFound: boolean;
}

export interface CardVehicle {
  id: string;
  cardId: string;
  displayName: string;
  make: string;
  model: string;
  color: string;
  licensePlate: string;
  contactPhone: string;
  useDefaultContact: boolean;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  useDefaultEmergency: boolean;
  ownerNote: string;
  enabled: boolean;
  sortOrder: number;
}

export interface CardLostItem {
  id: string;
  cardId: string;
  name: string;
  category: string;
  description: string;
  color: string;
  contactPhone: string;
  useDefaultContact: boolean;
  rewardEnabled: boolean;
  rewardText: string;
  returnInstructions: string;
  enabled: boolean;
  sortOrder: number;
}

export interface CardProfileProduct {
  id: string;
  cardId?: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  enabled: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface VehicleConnectSettings {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
  parkingNote: string;
  allowDirectCall: boolean;
  allowDirectMessage: boolean;
  showEmergencyContact: boolean;
}

export interface EmergencyContactSettings {
  name: string;
  relationship: string;
  phone: string;
  notifyOnScan: boolean;
}

export interface LostAndFoundSettings {
  itemName: string;
  itemCategory: string;
  rewardNote: string;
  returnInstructions: string;
  allowAnonymousMessage: boolean;
}

export const DEFAULT_ENABLED_FEATURES: EnabledFeatures = {
  digitalProfile: true,
  vehicleConnect: true,
  lostAndFound: true,
};

export const DEFAULT_VEHICLE_CONNECT: VehicleConnectSettings = {
  vehicleMake: "",
  vehicleModel: "",
  vehicleColor: "",
  licensePlate: "",
  parkingNote: "If my vehicle is blocking traffic or parked improperly, please tap below to notify me immediately.",
  allowDirectCall: true,
  allowDirectMessage: true,
  showEmergencyContact: true,
};

export const DEFAULT_EMERGENCY_CONTACT: EmergencyContactSettings = {
  name: "",
  relationship: "",
  phone: "",
  notifyOnScan: false,
};

export const DEFAULT_LOST_AND_FOUND: LostAndFoundSettings = {
  itemName: "",
  itemCategory: "Other",
  rewardNote: "A reward will be offered upon safe return of this item. Thank you for your honesty!",
  returnInstructions: "Please contact me using the form below or drop this item off at building reception.",
  allowAnonymousMessage: true,
};

const CARD_PROFILE_DEFAULTS: Record<string, unknown> = {
  name:"", title:"", business:"", countryCode:"", countryIso:"", mobile:"", whatsapp:"", email:"", website:"",
  state:"", stateCode:"", city:"", address:"", brochure:"", brochureData:"", social:{}, about:"", services:[],
  logo:"", cover:"", profileBackground:"#050B14", profileAccent:"#0066FF", profileText:"#ffffff", start:"", expiry:"",
  logoScale:100, logoZoom:100, logoRotation:0, logoX:50, logoY:50, coverScale:100, coverRotation:0, coverX:50, coverY:50,
  profileMode: "DIGITAL_PROFILE",
  profileFormat: "modern",
  modernConfig: {},
  simpleConfig: {},
  contactNumbers: [] as CardContactNumber[],
  enabledFeatures: { ...DEFAULT_ENABLED_FEATURES },
  profileFeatures: { ...DEFAULT_PROFILE_FEATURES },
  featureOrder: [ ...DEFAULT_FEATURE_ORDER ],
  vehicleConnect: { ...DEFAULT_VEHICLE_CONNECT },
  emergencyContact: { ...DEFAULT_EMERGENCY_CONTACT },
  lostAndFound: { ...DEFAULT_LOST_AND_FOUND },
  appDownload: { appName: "", appStoreUrl: "", playStoreUrl: "", referralUrl: "" },
};

export function cleanSlug(value: unknown) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function cleanCardProfile(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const field of CARD_FIELDS) {
    const value = input[field];
    if (field === "contactNumbers") {
      if (Array.isArray(value)) {
        const cleanedNumbers: CardContactNumber[] = [];
        const seenNormalized = new Set<string>();
        for (let i = 0; i < Math.min(value.length, MAX_CONTACT_NUMBERS); i++) {
          const item = value[i];
          if (!item || typeof item !== "object") continue;
          const rawNum = String((item as any).phoneNumber || (item as any).number || (item as any).phone || "").trim();
          const cleanPhone = rawNum.replace(/[^0-9+]/g, "").slice(0, 30);
          if (!cleanPhone) continue;
          const rawCc = String((item as any).countryCode || input.countryCode || "").trim().slice(0, 10);
          const countryCode = /^\+?[0-9]{0,5}$/.test(rawCc) ? rawCc : "";
          const norm = normalizePhoneNumber(cleanPhone, countryCode);
          const numNormKey = norm.isValid ? norm.normalized : `${countryCode}:${cleanPhone.replace(/\D/g, "")}`;
          if (seenNormalized.has(numNormKey)) continue;
          seenNormalized.add(numNormKey);

          const label = String((item as any).label || (i === 0 ? "Mobile" : "Other")).trim().slice(0, 40) || (i === 0 ? "Mobile" : "Other");
          const isPrimary = (item as any).isPrimary === true || (cleanedNumbers.length === 0 && (item as any).isPrimary !== false);

          cleanedNumbers.push({
            id: String((item as any).id || `num_${i}_${Date.now()}`).slice(0, 50),
            label,
            countryCode,
            phoneNumber: cleanPhone,
            isPrimary,
            sortOrder: typeof (item as any).sortOrder === "number" ? (item as any).sortOrder : i,
          });
        }
        if (cleanedNumbers.length > 0) {
          const hasPrimary = cleanedNumbers.some((n) => n.isPrimary);
          if (!hasPrimary) cleanedNumbers[0].isPrimary = true;
          output.contactNumbers = cleanedNumbers;
          const primaryNumber = cleanedNumbers.find((n) => n.isPrimary) || cleanedNumbers[0];
          output.mobile = primaryNumber.phoneNumber;
          if (primaryNumber.countryCode) {
            output.countryCode = primaryNumber.countryCode;
          }
        } else {
          output.contactNumbers = [];
        }
      }
    } else if (field === "social" && value && typeof value === "object" && !Array.isArray(value)) {
      output.social = Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 24)
        .map(([key, url]) => [String(key).slice(0, 40), cleanUrl(url)]));
    } else if (field === "appDownload" && value && typeof value === "object" && !Array.isArray(value)) {
      const ad = value as Record<string, unknown>;
      const appName = typeof ad.appName === "string" ? ad.appName.trim().slice(0, 100) : "";
      const appStoreUrl = cleanStoreUrl(ad.appStoreUrl, "apple");
      const playStoreUrl = cleanStoreUrl(ad.playStoreUrl, "google");
      const referralUrl = cleanStoreUrl(ad.referralUrl, "universal");
      output.appDownload = {
        appName,
        appStoreUrl,
        playStoreUrl,
        referralUrl,
      };
    } else if (field === "services" && Array.isArray(value)) {
      output.services = value.slice(0, 30).map(item => String(item).trim().slice(0, 120)).filter(Boolean);
    } else if (field === "profileMode") {
      output.profileMode = ["DIGITAL_PROFILE", "VEHICLE_CONNECT", "LOST_AND_FOUND"].includes(String(value))
        ? String(value)
        : "DIGITAL_PROFILE";
    } else if (field === "profileFormat") {
      const fmt = String(value || "").toLowerCase().trim();
      output.profileFormat = fmt === "simple" ? "simple" : "modern";
    } else if (field === "modernConfig" && value && typeof value === "object" && !Array.isArray(value)) {
      const mc = value as Record<string, unknown>;
      output.modernConfig = {
        cardBackground: typeof mc.cardBackground === "string" ? mc.cardBackground : undefined,
        cardBorder: typeof mc.cardBorder === "string" ? mc.cardBorder : undefined,
        mutedText: typeof mc.mutedText === "string" ? mc.mutedText : undefined,
        primaryBtnBg: typeof mc.primaryBtnBg === "string" ? mc.primaryBtnBg : undefined,
        primaryBtnText: typeof mc.primaryBtnText === "string" ? mc.primaryBtnText : undefined,
        secondaryBtnBg: typeof mc.secondaryBtnBg === "string" ? mc.secondaryBtnBg : undefined,
        secondaryBtnText: typeof mc.secondaryBtnText === "string" ? mc.secondaryBtnText : undefined,
        secondaryBtnBorder: typeof mc.secondaryBtnBorder === "string" ? mc.secondaryBtnBorder : undefined,
        headerStyle: ["gradient", "solid"].includes(String(mc.headerStyle)) ? String(mc.headerStyle) : undefined,
        headerGradientStart: typeof mc.headerGradientStart === "string" ? mc.headerGradientStart : undefined,
        headerGradientEnd: typeof mc.headerGradientEnd === "string" ? mc.headerGradientEnd : undefined,
        headerHeight: typeof mc.headerHeight === "number" ? Math.max(80, Math.min(300, mc.headerHeight)) : undefined,
        coverOverlay: typeof mc.coverOverlay === "number" ? Math.max(0, Math.min(100, mc.coverOverlay)) : undefined,
        fontFamily: typeof mc.fontFamily === "string" ? mc.fontFamily.slice(0, 50) : undefined,
        nameSize: typeof mc.nameSize === "number" ? Math.max(14, Math.min(40, mc.nameSize)) : undefined,
        bodySize: typeof mc.bodySize === "number" ? Math.max(10, Math.min(24, mc.bodySize)) : undefined,
        cardRadius: typeof mc.cardRadius === "number" ? Math.max(0, Math.min(40, mc.cardRadius)) : undefined,
        buttonRadius: typeof mc.buttonRadius === "number" ? Math.max(0, Math.min(40, mc.buttonRadius)) : undefined,
        spacingDensity: ["compact", "comfortable", "spacious"].includes(String(mc.spacingDensity)) ? String(mc.spacingDensity) : undefined,
      };
    } else if (field === "simpleConfig" && value && typeof value === "object" && !Array.isArray(value)) {
      const sc = value as Record<string, unknown>;
      output.simpleConfig = {
        coverScale: typeof sc.coverScale === "number" ? clamp(sc.coverScale, 25, 300, 100) : undefined,
        coverRotation: typeof sc.coverRotation === "number" ? clamp(sc.coverRotation, -180, 180, 0) : undefined,
        coverX: typeof sc.coverX === "number" ? clamp(sc.coverX, 0, 100, 50) : undefined,
        coverY: typeof sc.coverY === "number" ? clamp(sc.coverY, 0, 100, 50) : undefined,
      };
    } else if (field === "enabledFeatures" && value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      output.enabledFeatures = {
        digitalProfile: v.digitalProfile !== false,
        vehicleConnect: v.vehicleConnect !== false,
        lostAndFound: v.lostAndFound !== false,
      };
    } else if (field === "profileFeatures" && value && typeof value === "object") {
      const pfObj = value as Record<string, unknown>;
      const validKeys: ProfileFeatureKey[] = [
        "BASIC_PROFILE", "CONTACT", "SOCIAL_LINKS", "WEBSITE", "EMERGENCY_CONTACT",
        "VEHICLE", "LOST_AND_FOUND", "PRODUCTS"
      ];
      const cleanedPF: Partial<ProfileFeaturesConfig> = {};
      for (const k of validKeys) {
        const item = pfObj[k] as Record<string, unknown> | undefined;
        if (item && typeof item === "object") {
          cleanedPF[k] = {
            enabled: item.enabled !== false,
            sortOrder: typeof item.sortOrder === "number" ? Math.max(0, Math.min(100, Math.floor(item.sortOrder))) : DEFAULT_PROFILE_FEATURES[k].sortOrder,
          };
        } else {
          cleanedPF[k] = { ...DEFAULT_PROFILE_FEATURES[k] };
        }
      }
      output.profileFeatures = cleanedPF;
    } else if (field === "featureOrder" && Array.isArray(value)) {
      const validKeys: ProfileFeatureKey[] = [
        "BASIC_PROFILE", "CONTACT", "SOCIAL_LINKS", "WEBSITE", "EMERGENCY_CONTACT",
        "VEHICLE", "LOST_AND_FOUND", "PRODUCTS"
      ];
      const filtered = value.map(v => String(v)).filter((v): v is ProfileFeatureKey => validKeys.includes(v as ProfileFeatureKey));
      const missing = validKeys.filter(k => !filtered.includes(k));
      output.featureOrder = [...filtered, ...missing];
    } else if (field === "vehicleConnect" && value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      output.vehicleConnect = {
        vehicleMake: String(v.vehicleMake || "").trim().slice(0, 80),
        vehicleModel: String(v.vehicleModel || "").trim().slice(0, 80),
        vehicleColor: String(v.vehicleColor || "").trim().slice(0, 50),
        licensePlate: String(v.licensePlate || "").trim().toUpperCase().slice(0, 30),
        parkingNote: String(v.parkingNote || DEFAULT_VEHICLE_CONNECT.parkingNote).trim().slice(0, 1000),
        allowDirectCall: v.allowDirectCall !== false,
        allowDirectMessage: v.allowDirectMessage !== false,
        showEmergencyContact: v.showEmergencyContact !== false,
      };
    } else if (field === "emergencyContact" && value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      output.emergencyContact = {
        name: String(v.name || "").trim().slice(0, 100),
        relationship: String(v.relationship || "").trim().slice(0, 50),
        phone: /^[0-9 ()+.-]{0,30}$/.test(String(v.phone || "").trim()) ? String(v.phone || "").trim() : "",
        notifyOnScan: Boolean(v.notifyOnScan),
      };
    } else if (field === "lostAndFound" && value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      output.lostAndFound = {
        itemName: String(v.itemName || "").trim().slice(0, 120),
        itemCategory: String(v.itemCategory || "Other").trim().slice(0, 50),
        rewardNote: String(v.rewardNote || DEFAULT_LOST_AND_FOUND.rewardNote).trim().slice(0, 1000),
        returnInstructions: String(v.returnInstructions || DEFAULT_LOST_AND_FOUND.returnInstructions).trim().slice(0, 1000),
        allowAnonymousMessage: v.allowAnonymousMessage !== false,
      };
    } else if (["logoScale","logoZoom","coverScale"].includes(field)) {
      output[field] = clamp(value, field === "logoZoom" ? 100 : 25, 300, 100);
    } else if (["logoRotation","coverRotation"].includes(field)) {
      output[field] = clamp(value, -180, 180, 0);
    } else if (["logoX","logoY","coverX","coverY"].includes(field)) {
      output[field] = clamp(value, 0, 100, 50);
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (field === "website") output[field] = cleanUrl(trimmed);
      else if (field === "email") output[field] = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed.toLowerCase().slice(0, 254) : "";
      else if (["mobile","whatsapp","defaultContactPhone","defaultEmergencyPhone"].includes(field)) {
        if (!/^[0-9 ()+.-]{0,30}$/.test(trimmed)) {
          output[field] = "";
        } else {
          let cleanVal = trimmed.replace(/[^0-9+]/g, "");
          const cc = String(input.countryCode || "").replace(/\D/g, "") || "91";
          if (cleanVal.startsWith("+91") && cleanVal.length === 13) {
            cleanVal = cleanVal.slice(3);
          } else if (cc === "91" && cleanVal.length === 12 && cleanVal.startsWith("91")) {
            cleanVal = cleanVal.slice(2);
          }
          output[field] = cleanVal;
        }
      }
      else if (field === "countryCode") output[field] = /^\+?[0-9]{0,5}$/.test(trimmed) ? trimmed : "";
      else if (["theme","profileTheme"].includes(field)) output[field] = trimmed.slice(0, 50);
      else if (["profileBackground","profileAccent","profileText"].includes(field)) {
        const fallback = field === "profileBackground" ? "#050B14" : field === "profileAccent" ? "#0066FF" : "#ffffff";
        if (/^#[0-9a-fA-F]{6}$/i.test(trimmed)) {
          output[field] = trimmed;
        } else if (/^#[0-9a-fA-F]{3}$/i.test(trimmed)) {
          const [r, g, b] = trimmed.slice(1).split("");
          output[field] = `#${r}${r}${g}${g}${b}${b}`;
        } else {
          output[field] = fallback;
        }
      }
      else if (["logo","cover"].includes(field)) output[field] = cleanImage(trimmed);
      else if (field === "brochureData") output[field] = /^https?:\/\/[^\r\n]+$/i.test(trimmed) ? trimmed.slice(0, 2000) : /^data:application\/pdf;base64,[a-z0-9+/=\r\n]+$/i.test(trimmed) ? trimmed.slice(0, 7_000_000) : "";
      else output[field] = trimmed.slice(0, field === "about" ? 3000 : 500);
    }
  }
  return output;
}

export function completeCardProfile(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const cleaned = cleanCardProfile(source);
  const rawFormat = String(source.profileFormat || "").toLowerCase().trim();
  const isRetiredOrInvalidFormat = !rawFormat || rawFormat === "standard" || (rawFormat !== "modern" && rawFormat !== "simple");
  const isLegacyGold = cleaned.profileAccent === "#FFAE00" || cleaned.profileAccent === "#D4AF37" || cleaned.profileAccent === "#C5A059";
  const isLegacyGoldDefault = (!source.profileBackground && !source.profileAccent) || (isRetiredOrInvalidFormat && isLegacyGold);

  const resolvedBg = isLegacyGoldDefault ? "#050B14" : (cleaned.profileBackground || "#050B14");
  const resolvedAccent = isLegacyGoldDefault ? "#0066FF" : (cleaned.profileAccent || "#0066FF");

  const rawContactNumbers = Array.isArray(cleaned.contactNumbers) ? (cleaned.contactNumbers as CardContactNumber[]) : [];
  let resolvedContactNumbers: CardContactNumber[] = rawContactNumbers;
  if (resolvedContactNumbers.length === 0 && cleaned.mobile) {
    resolvedContactNumbers = [
      {
        id: "primary_mobile",
        label: "Mobile",
        countryCode: (cleaned.countryCode as string) || "+91",
        phoneNumber: cleaned.mobile as string,
        isPrimary: true,
        sortOrder: 0,
      },
    ];
  }

  return {
    ...CARD_PROFILE_DEFAULTS,
    ...cleaned,
    contactNumbers: resolvedContactNumbers,
    profileFormat: cleaned.profileFormat === "simple" ? "simple" : "modern",
    simpleConfig: cleaned.simpleConfig && typeof cleaned.simpleConfig === "object" ? cleaned.simpleConfig : {},
    profileBackground: resolvedBg,
    profileAccent: resolvedAccent,
    profileText: cleaned.profileText || "#ffffff",
    social: cleaned.social && typeof cleaned.social === "object" ? cleaned.social : {},
    services: Array.isArray(cleaned.services) ? cleaned.services : [],
    enabledFeatures: { ...DEFAULT_ENABLED_FEATURES, ...(cleaned.enabledFeatures as object) },
    profileFeatures: { ...DEFAULT_PROFILE_FEATURES, ...(cleaned.profileFeatures as object) },
    featureOrder: Array.isArray(cleaned.featureOrder) && cleaned.featureOrder.length > 0 ? cleaned.featureOrder : [...DEFAULT_FEATURE_ORDER],
    vehicleConnect: { ...DEFAULT_VEHICLE_CONNECT, ...(cleaned.vehicleConnect as object) },
    emergencyContact: { ...DEFAULT_EMERGENCY_CONTACT, ...(cleaned.emergencyContact as object) },
    lostAndFound: { ...DEFAULT_LOST_AND_FOUND, ...(cleaned.lostAndFound as object) },
    appDownload: cleaned.appDownload && typeof cleaned.appDownload === "object" ? cleaned.appDownload : { appName: "", appStoreUrl: "", playStoreUrl: "", referralUrl: "" },
  };
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function cleanImage(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^https?:\/\/[^\r\n]+$/i.test(trimmed)) return trimmed.slice(0, 2000);
  if (/^blob:https?:\/\/[^\r\n]+$/i.test(trimmed)) return trimmed.slice(0, 2000);
  if (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=\r\n]+$/i.test(trimmed)) return trimmed.slice(0, 7_000_000);
  if (/^(?:[a-zA-Z0-9_ %-]+\/)*(?:images|documents|cards|profiles|users|uploads)\/[a-zA-Z0-9_ %./-]+$/i.test(trimmed)) return trimmed.slice(0, 500);
  if (/^\/[^\r\n]+$/i.test(trimmed)) return trimmed.slice(0, 2000);
  return "";
}

function cleanUrl(value: unknown) {
  const text = String(value || "").trim().slice(0, 1000);
  return /^https?:\/\//i.test(text) ? text : "";
}

export function hashActivationCode(code: string) {
  // Activation hashes must remain identical across deployments. The code itself
  // carries sufficient random entropy; only its one-way hash is stored.
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
  return createHash("sha256").update(`myluxcards-activation-v2:${normalized}`).digest("hex");
}

export function safePublicCard(row: any) {
  const profile = completeCardProfile(row.profile);
  
  // PUBLIC PRIVACY SANITIZATION:
  // Never expose raw private emergency phone numbers to unauthenticated browser visitors.
  // Instead, return boolean flags like hasEmergencyPhone and sanitized emergency metadata.
  const emergencyContactObj = (profile.emergencyContact || {}) as EmergencyContactSettings;
  const emergencyPhone = emergencyContactObj.phone || "";
  const sanitizedEmergencyContact = {
    name: emergencyContactObj.name || "",
    relationship: emergencyContactObj.relationship || "",
    hasPhone: Boolean(emergencyPhone),
  };

  return {
    id: row.id,
    slug: row.slug,
    ownerId: row.owner_id,
    ...completeCardProfile(row.profile),
    emergencyContact: sanitizedEmergencyContact,
    hasEmergencyPhone: Boolean(emergencyPhone),
    active: Boolean(row.active),
  };
}

export { resolveAppDownloadTile, type AppTileResolution, type AppTileBrand } from "./appDownload";
