import { createHash } from "node:crypto";

export const CARD_FIELDS = [
  "name","title","business","countryCode","countryIso","mobile","whatsapp","email","website",
  "state","stateCode","city","address","brochure","brochureData","social","about","services",
  "logo","cover","profileBackground","profileAccent","profileText","start","expiry",
  "logoScale","logoRotation","logoX","logoY","coverScale","coverRotation","coverX","coverY",
] as const;

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
    } else if (["logoScale","logoRotation","logoX","logoY","coverScale","coverRotation","coverX","coverY"].includes(field)) {
      output[field] = Number.isFinite(Number(value)) ? Number(value) : 0;
    } else if (typeof value === "string") {
      const max = ["logo","cover","brochureData"].includes(field) ? 7_000_000 : field === "about" ? 3000 : 500;
      output[field] = value.trim().slice(0, max);
    }
  }
  return output;
}

function cleanUrl(value: unknown) {
  const text = String(value || "").trim().slice(0, 1000);
  return /^https?:\/\//i.test(text) ? text : "";
}

export function hashActivationCode(code: string) {
  return createHash("sha256").update(`${process.env.CARD_ACTIVATION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "development"}:${code.trim().toUpperCase()}`).digest("hex");
}

export function safePublicCard(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    ...(row.profile || {}),
    active: Boolean(row.active && row.activated_at && (!row.expires_at || new Date(row.expires_at) > new Date())),
  };
}
