import { createHash } from "node:crypto";

export const CARD_FIELDS = [
  "name","title","business","countryCode","countryIso","mobile","whatsapp","email","website",
  "state","stateCode","city","address","brochure","brochureData","social","about","services",
  "logo","cover","profileBackground","profileAccent","profileText","start","expiry",
  "logoScale","logoRotation","logoX","logoY","coverScale","coverRotation","coverX","coverY",
  "profileMode","enabledFeatures","vehicleConnect","emergencyContact","lostAndFound",
  "defaultContactPhone","defaultEmergencyName","defaultEmergencyRelationship","defaultEmergencyPhone",
  "profileFeatures","featureOrder",
] as const;

export type ProfileMode = "DIGITAL_PROFILE" | "VEHICLE_CONNECT" | "LOST_AND_FOUND";

export type ProfileFeatureKey =
  | "BASIC_PROFILE"
  | "CONTACT"
  | "SOCIAL_LINKS"
  | "WEBSITE"
  | "EMERGENCY_CONTACT"
  | "VEHICLE"
  | "LOST_AND_FOUND"
  | "PRODUCTS"
  | "SERVICES"
  | "PORTFOLIO"
  | "GALLERY"
  | "VIDEOS"
  | "BUSINESS_HOURS"
  | "LOCATION"
  | "PAYMENT_LINKS"
  | "DOCUMENTS"
  | "RESUME"
  | "ACHIEVEMENTS"
  | "CERTIFICATIONS";

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
  SERVICES: { enabled: false, sortOrder: 8 },
  PORTFOLIO: { enabled: false, sortOrder: 9 },
  GALLERY: { enabled: false, sortOrder: 10 },
  VIDEOS: { enabled: false, sortOrder: 11 },
  BUSINESS_HOURS: { enabled: false, sortOrder: 12 },
  LOCATION: { enabled: false, sortOrder: 13 },
  PAYMENT_LINKS: { enabled: false, sortOrder: 14 },
  DOCUMENTS: { enabled: false, sortOrder: 15 },
  RESUME: { enabled: false, sortOrder: 16 },
  ACHIEVEMENTS: { enabled: false, sortOrder: 17 },
  CERTIFICATIONS: { enabled: false, sortOrder: 18 },
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
  "SERVICES",
  "PORTFOLIO",
  "GALLERY",
  "VIDEOS",
  "BUSINESS_HOURS",
  "LOCATION",
  "PAYMENT_LINKS",
  "DOCUMENTS",
  "RESUME",
  "ACHIEVEMENTS",
  "CERTIFICATIONS",
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
  cardId: string;
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
  logo:"", cover:"", profileBackground:"#020202", profileAccent:"#0066FF", profileText:"#ffffff", start:"", expiry:"",
  logoScale:100, logoRotation:0, logoX:50, logoY:50, coverScale:100, coverRotation:0, coverX:50, coverY:50,
  profileMode: "DIGITAL_PROFILE",
  enabledFeatures: { ...DEFAULT_ENABLED_FEATURES },
  profileFeatures: { ...DEFAULT_PROFILE_FEATURES },
  featureOrder: [ ...DEFAULT_FEATURE_ORDER ],
  vehicleConnect: { ...DEFAULT_VEHICLE_CONNECT },
  emergencyContact: { ...DEFAULT_EMERGENCY_CONTACT },
  lostAndFound: { ...DEFAULT_LOST_AND_FOUND },
};

export function cleanSlug(value: unknown) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function cleanCardProfile(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const field of CARD_FIELDS) {
    const value = input[field];
    if (field === "social" && value && typeof value === "object" && !Array.isArray(value)) {
      output.social = Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 12)
        .map(([key, url]) => [String(key).slice(0, 40), cleanUrl(url)]));
    } else if (field === "services" && Array.isArray(value)) {
      output.services = value.slice(0, 30).map(item => String(item).trim().slice(0, 120)).filter(Boolean);
    } else if (field === "profileMode") {
      output.profileMode = ["DIGITAL_PROFILE", "VEHICLE_CONNECT", "LOST_AND_FOUND"].includes(String(value))
        ? String(value)
        : "DIGITAL_PROFILE";
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
        "VEHICLE", "LOST_AND_FOUND", "PRODUCTS", "SERVICES", "PORTFOLIO", "GALLERY",
        "VIDEOS", "BUSINESS_HOURS", "LOCATION", "PAYMENT_LINKS", "DOCUMENTS", "RESUME",
        "ACHIEVEMENTS", "CERTIFICATIONS"
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
        "VEHICLE", "LOST_AND_FOUND", "PRODUCTS", "SERVICES", "PORTFOLIO", "GALLERY",
        "VIDEOS", "BUSINESS_HOURS", "LOCATION", "PAYMENT_LINKS", "DOCUMENTS", "RESUME",
        "ACHIEVEMENTS", "CERTIFICATIONS"
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
    } else if (["logoScale","coverScale"].includes(field)) {
      output[field] = clamp(value, 25, 300, 100);
    } else if (["logoRotation","coverRotation"].includes(field)) {
      output[field] = clamp(value, -180, 180, 0);
    } else if (["logoX","logoY","coverX","coverY"].includes(field)) {
      output[field] = clamp(value, 0, 100, 50);
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (field === "website") output[field] = cleanUrl(trimmed);
      else if (field === "email") output[field] = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed.toLowerCase().slice(0, 254) : "";
      else if (["mobile","whatsapp","defaultContactPhone","defaultEmergencyPhone"].includes(field)) output[field] = /^[0-9 ()+.-]{0,30}$/.test(trimmed) ? trimmed : "";
      else if (field === "countryCode") output[field] = /^\+?[0-9]{0,5}$/.test(trimmed) ? trimmed : "";
      else if (["profileBackground","profileAccent","profileText"].includes(field)) output[field] = /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : field === "profileBackground" ? "#020202" : field === "profileAccent" ? "#0066FF" : "#ffffff";
      else if (["logo","cover"].includes(field)) output[field] = cleanImage(trimmed);
      else if (field === "brochureData") output[field] = /^https:\/\/[^\s]+$/i.test(trimmed) ? trimmed.slice(0, 2000) : /^data:application\/pdf;base64,[a-z0-9+/=\r\n]+$/i.test(trimmed) ? trimmed.slice(0, 7_000_000) : "";
      else output[field] = trimmed.slice(0, field === "about" ? 3000 : 500);
    }
  }
  return output;
}

export function completeCardProfile(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const cleaned = cleanCardProfile(source);
  return {
    ...CARD_PROFILE_DEFAULTS,
    ...cleaned,
    social: cleaned.social && typeof cleaned.social === "object" ? cleaned.social : {},
    services: Array.isArray(cleaned.services) ? cleaned.services : [],
    enabledFeatures: { ...DEFAULT_ENABLED_FEATURES, ...(cleaned.enabledFeatures as object) },
    profileFeatures: { ...DEFAULT_PROFILE_FEATURES, ...(cleaned.profileFeatures as object) },
    featureOrder: Array.isArray(cleaned.featureOrder) && cleaned.featureOrder.length > 0 ? cleaned.featureOrder : [...DEFAULT_FEATURE_ORDER],
    vehicleConnect: { ...DEFAULT_VEHICLE_CONNECT, ...(cleaned.vehicleConnect as object) },
    emergencyContact: { ...DEFAULT_EMERGENCY_CONTACT, ...(cleaned.emergencyContact as object) },
    lostAndFound: { ...DEFAULT_LOST_AND_FOUND, ...(cleaned.lostAndFound as object) },
  };
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function cleanImage(value: string) {
  if (/^https:\/\/[^\s]+$/i.test(value)) return value.slice(0, 2000);
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\r\n]+$/i.test(value) ? value.slice(0, 7_000_000) : "";
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
    ...completeCardProfile(row.profile),
    emergencyContact: sanitizedEmergencyContact,
    hasEmergencyPhone: Boolean(emergencyPhone),
    active: Boolean(row.active),
  };
}
