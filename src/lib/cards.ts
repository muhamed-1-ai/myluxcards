import { createHash } from "node:crypto";

export const CARD_FIELDS = [
  "name","title","business","countryCode","countryIso","mobile","whatsapp","email","website",
  "state","stateCode","city","address","brochure","brochureData","social","about","services",
  "logo","cover","profileBackground","profileAccent","profileText","start","expiry",
  "logoScale","logoRotation","logoX","logoY","coverScale","coverRotation","coverX","coverY",
] as const;

const CARD_PROFILE_DEFAULTS: Record<string, unknown> = {
  name:"", title:"", business:"", countryCode:"", countryIso:"", mobile:"", whatsapp:"", email:"", website:"",
  state:"", stateCode:"", city:"", address:"", brochure:"", brochureData:"", social:{}, about:"", services:[],
  logo:"", cover:"", profileBackground:"#020202", profileAccent:"#d4af37", profileText:"#ffffff", start:"", expiry:"",
  logoScale:100, logoRotation:0, logoX:50, logoY:50, coverScale:100, coverRotation:0, coverX:50, coverY:50,
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
      else if (["mobile","whatsapp"].includes(field)) output[field] = /^[0-9 ()+.-]{0,30}$/.test(trimmed) ? trimmed : "";
      else if (field === "countryCode") output[field] = /^\+?[0-9]{0,5}$/.test(trimmed) ? trimmed : "";
      else if (["profileBackground","profileAccent","profileText"].includes(field)) output[field] = /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : field === "profileBackground" ? "#020202" : field === "profileAccent" ? "#d4af37" : "#ffffff";
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
  return {
    id: row.id,
    slug: row.slug,
    ...completeCardProfile(row.profile),
    active: Boolean(row.active),
  };
}
