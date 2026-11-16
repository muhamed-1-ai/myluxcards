export type FeatureKey =
  | "overview"
  | "all_leads"
  | "lead_sources"
  | "config_products"
  | "lead_stages"
  | "calendar"
  | "lob_reasons"
  | "dynamic_leads"
  | "profile_features"
  | "contact_info"
  | "apps_links"
  | "company"
  | "card_design"
  | "my_cards"
  | "notifications"
  | "my_orders";

export type PlanId = "plan-lite" | "plan-pro";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  fullName: string;
  kicker: string;
  price: number;
  priceMinor: number;
  currency: string;
  billingPeriod: string;
  renewalDetail: string;
  buttonLabel: string;
  badge: string | null;
  popular?: boolean;
  features: string[];
  permissions: Record<FeatureKey, boolean>;
}

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  "plan-lite": {
    id: "plan-lite",
    name: "Lite",
    fullName: "Zappit Lite",
    kicker: "ESSENTIAL DIGITAL PROFILE",
    price: 1999,
    priceMinor: 199900,
    currency: "INR",
    billingPeriod: "One-time hardware purchase · Includes 1-yr profile hosting · Renews at ₹499/yr",
    renewalDetail: "Renews at ₹499/year after 1st year",
    buttonLabel: "Choose Lite",
    badge: null,
    popular: false,
    features: [
      "Custom Smart NFC Card with dynamic QR backup",
      "Dynamic Digital Business Profile & Bio Link",
      "Direct WhatsApp, Phone, Email & Social links",
      "Instant Contact (.vcf) Save to phonebook",
      "Unlimited real-time profile updates & customizations",
      "Standard Profile Traffic Analytics & Visitor Counters",
      "Lead capture notification alerts",
      "Full 1-Year Cloud Profile Hosting included",
    ],
    permissions: {
      // Lite features
      profile_features: true,
      contact_info: true,
      apps_links: true,
      company: true,
      card_design: true,
      my_cards: true,
      notifications: true,
      my_orders: true,
      // Pro features disabled
      overview: false,
      all_leads: false,
      lead_sources: false,
      config_products: false,
      lead_stages: false,
      calendar: false,
      lob_reasons: false,
      dynamic_leads: false,
    },
  },
  "plan-pro": {
    id: "plan-pro",
    name: "Pro",
    fullName: "Zappit Pro CRM",
    kicker: "PROFILE + COMPLETE CRM SUITE",
    price: 2999,
    priceMinor: 299900,
    currency: "INR",
    billingPeriod: "/year · Billed Annually · Includes smart NFC card + 1 year of CRM access",
    renewalDetail: "Billed annually at ₹2,999/year",
    buttonLabel: "Choose Pro",
    badge: "Includes Full CRM Workspace",
    popular: true,
    features: [
      "Everything in Lite included (Smart NFC Card + Profile)",
      "Full CRM Workspace & Pipeline Dashboard",
      "Unlimited Lead Management with visual Kanban boards",
      "Interactive CRM Follow-Up Calendar & Schedule",
      "Custom Lead Sources & Stage Pipeline Config",
      "Custom Product Catalog & Deal Tracking",
      "Loss Reason Analysis (LOB) & Win/Loss reporting",
      "Dynamic Custom Fields for tailored industry workflows",
      "Multi-user lead assignment & team notes",
      "Priority customer support & dedicated account onboarding",
    ],
    permissions: {
      // Lite features
      profile_features: true,
      contact_info: true,
      apps_links: true,
      company: true,
      card_design: true,
      my_cards: true,
      notifications: true,
      my_orders: true,
      // Pro CRM features
      overview: true,
      all_leads: true,
      lead_sources: true,
      config_products: true,
      lead_stages: true,
      calendar: true,
      lob_reasons: true,
      dynamic_leads: true,
    },
  },
};

/**
 * Physical NFC Card Finishes available for purchase with Zappit plans
 */
export type CardFinishId = "black" | "white";

export interface CardFinishDefinition {
  id: CardFinishId;
  name: string;
  shortName: string;
  badge: string;
  description: string;
  image: string;
  alt: string;
  material: string;
}

export const CARD_FINISHES: Record<CardFinishId, CardFinishDefinition> = {
  black: {
    id: "black",
    name: "Velvet Matte Black PVC",
    shortName: "Matte Black PVC",
    badge: "Matte Finish",
    description:
      "Durable matte PVC with a smooth, glare-free black finish. Water-resistant, sturdy, and embedded with a high-speed NTAG216 NFC chip and high-contrast QR backup.",
    image: "/assets/black-pvc-card.jpg",
    alt: "Zappit Velvet Matte Black PVC smart card",
    material: "Matte Black PVC",
  },
  white: {
    id: "white",
    name: "Ceramic White PVC",
    shortName: "Ceramic White PVC",
    badge: "Matte Finish",
    description:
      "Durable white PVC with a smooth, glare-free matte finish. Resilient, water-resistant, and printed with crisp high-contrast typography and QR code backup.",
    image: "/assets/white-pvc-card.jpg",
    alt: "Zappit Ceramic White PVC smart card",
    material: "Ceramic White PVC",
  },
};

/**
 * Resolves standard card finish ID from finish name, ID, or query parameter
 */
export function resolveCardFinishId(rawId: string | null | undefined): CardFinishId | null {
  if (!rawId || typeof rawId !== "string") return null;
  const s = rawId.toLowerCase().trim();
  if (s === "black" || s.includes("black")) return "black";
  if (s === "white" || s.includes("white")) return "white";
  return null;
}

/**
 * Resolves standard plan keys from various catalog IDs (e.g. bundle-standard, plan-lite, lite, bundle-crm, etc.)
 */
export function resolvePlanId(rawId: string | null | undefined): PlanId | null {
  if (!rawId || typeof rawId !== "string") return null;
  const s = rawId.toLowerCase().trim();
  if (s === "plan-lite" || s === "lite" || s.startsWith("bundle-standard")) {
    return "plan-lite";
  }
  if (s === "plan-pro" || s === "pro" || s.startsWith("bundle-crm")) {
    return "plan-pro";
  }
  return null;
}

/**
 * Merges target plan permissions with existing permissions.
 * Preserves existing admin-granted privileges (such as accounting_access or custom flags).
 */
export function mergePlanPermissions(
  existingRaw: unknown,
  planId: PlanId
): Record<string, boolean> {
  const plan = PLAN_CATALOG[planId];
  if (!plan) {
    throw new Error(`Invalid plan identifier: ${planId}`);
  }

  const result: Record<string, boolean> = {
    ...plan.permissions,
  };

  // Ensure any permission that was already explicitly granted (true) remains preserved
  if (existingRaw && typeof existingRaw === "object") {
    const rawObj = existingRaw as Record<string, unknown>;
    for (const [key, val] of Object.entries(rawObj)) {
      if (val === true) {
        result[key] = true;
      }
    }
  }

  return result;
}
