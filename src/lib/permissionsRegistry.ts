import type { FeaturePermissions } from "../types/database";

export type FeatureGroup = "Dashboards" | "Master Config" | "Card & Profile" | "Workspace";

export type FeatureKey =
  // Dashboards
  | "overview"
  | "all_leads"
  | "qr_activity"
  // Master Config
  | "lead_sources"
  | "config_products"
  | "lead_stages"
  | "calendar"
  | "lob_reasons"
  | "dynamic_leads"
  // Card & Profile
  | "profile_features"
  | "contact_info"
  | "apps_links"
  | "company"
  | "card_design"
  // Workspace
  | "my_cards"
  | "notifications"
  | "my_orders";

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  group: FeatureGroup;
  description: string;
  dashboardTab: string;
}

export const FEATURE_CATALOGUE: FeatureDefinition[] = [
  // Dashboards
  { key: "overview", label: "Overview", group: "Dashboards", description: "KPI overview and activity summary", dashboardTab: "dashboard" },
  { key: "all_leads", label: "All Leads", group: "Dashboards", description: "Leads workspace and management", dashboardTab: "leads" },
  { key: "qr_activity", label: "QR Activity", group: "Dashboards", description: "QR analytics and scan tracking", dashboardTab: "analytics" },

  // Master Config
  { key: "lead_sources", label: "Lead Sources", group: "Master Config", description: "Manage lead acquisition sources", dashboardTab: "config-sources" },
  { key: "config_products", label: "Products", group: "Master Config", description: "Manage lead products catalog", dashboardTab: "config-products" },
  { key: "lead_stages", label: "Lead Stages", group: "Master Config", description: "Manage sales pipeline stages", dashboardTab: "config-stages" },
  { key: "calendar", label: "Calendar", group: "Master Config", description: "Team calendar and appointments", dashboardTab: "config-calendar" },
  { key: "lob_reasons", label: "LOB Reasons", group: "Master Config", description: "Loss of Business reason tracking", dashboardTab: "config-reasons" },
  { key: "dynamic_leads", label: "Dynamic Leads", group: "Master Config", description: "Custom fields builder for leads", dashboardTab: "config-dynamic" },

  // Card & Profile
  { key: "profile_features", label: "Profile Features", group: "Card & Profile", description: "Digital profile mode settings", dashboardTab: "modes" },
  { key: "contact_info", label: "Contact Info", group: "Card & Profile", description: "Personal and business contact details", dashboardTab: "contact" },
  { key: "apps_links", label: "Apps & Links", group: "Card & Profile", description: "Social links and app integrations", dashboardTab: "social" },
  { key: "company", label: "Company", group: "Card & Profile", description: "Company profile details", dashboardTab: "company" },
  { key: "card_design", label: "Card Design", group: "Card & Profile", description: "Card themes and appearance editor", dashboardTab: "appearance" },

  // Workspace
  { key: "my_cards", label: "My Cards", group: "Workspace", description: "Manage digital business cards", dashboardTab: "cards" },
  { key: "notifications", label: "Notifications", group: "Workspace", description: "System & activity notifications", dashboardTab: "notifications-tab" },
  { key: "my_orders", label: "My Orders", group: "Workspace", description: "Orders history & status", dashboardTab: "orders-tab" },
];

export const ZERO_FEATURE_PERMISSIONS: Record<FeatureKey, boolean> = {
  overview: false,
  all_leads: false,
  qr_activity: false,
  lead_sources: false,
  config_products: false,
  lead_stages: false,
  calendar: false,
  lob_reasons: false,
  dynamic_leads: false,
  profile_features: false,
  contact_info: false,
  apps_links: false,
  company: false,
  card_design: false,
  my_cards: false,
  notifications: false,
  my_orders: false,
};

export const DEFAULT_FEATURE_PERMISSIONS: Record<FeatureKey, boolean> = {
  ...ZERO_FEATURE_PERMISSIONS,
};

export function normalizeFeaturePermissions(raw: unknown): Record<FeatureKey, boolean> {
  const result: Record<FeatureKey, boolean> = { ...ZERO_FEATURE_PERMISSIONS };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  const obj = raw as Record<string, unknown>;

  // Direct 17 feature keys evaluate first
  FEATURE_CATALOGUE.forEach((f) => {
    if (typeof obj[f.key] === "boolean") {
      result[f.key] = obj[f.key] as boolean;
    }
  });

  // Legacy mappings for backwards compatibility if 17 key not present
  if (typeof obj["dashboard"] === "boolean" && typeof obj["overview"] !== "boolean") {
    result.overview = Boolean(obj["dashboard"]);
  }
  if (typeof obj["leads"] === "boolean" && typeof obj["all_leads"] !== "boolean") {
    result.all_leads = Boolean(obj["leads"]);
  }
  if ((typeof obj["analytics"] === "boolean" || typeof obj["qr_profile"] === "boolean") && typeof obj["qr_activity"] !== "boolean") {
    result.qr_activity = Boolean(obj["analytics"] ?? obj["qr_profile"]);
  }

  if (typeof obj["crm"] === "boolean") {
    const crmVal = Boolean(obj["crm"]);
    if (typeof obj["lead_sources"] !== "boolean") result.lead_sources = crmVal;
    if (typeof obj["lead_stages"] !== "boolean") result.lead_stages = crmVal;
    if (typeof obj["lob_reasons"] !== "boolean") result.lob_reasons = crmVal;
    if (typeof obj["dynamic_leads"] !== "boolean") result.dynamic_leads = crmVal;
    if (typeof obj["calendar"] !== "boolean") result.calendar = crmVal;
  }

  if (typeof obj["products"] === "boolean" && typeof obj["config_products"] !== "boolean") {
    result.config_products = Boolean(obj["products"]);
  }

  if (typeof obj["profile"] === "boolean" || typeof obj["nfc_card"] === "boolean") {
    const profileVal = Boolean(obj["profile"] ?? obj["nfc_card"]);
    if (typeof obj["profile_features"] !== "boolean") result.profile_features = profileVal;
    if (typeof obj["contact_info"] !== "boolean") result.contact_info = profileVal;
    if (typeof obj["apps_links"] !== "boolean") result.apps_links = profileVal;
    if (typeof obj["company"] !== "boolean") result.company = profileVal;
    if (typeof obj["card_design"] !== "boolean") result.card_design = profileVal;
    if (typeof obj["my_cards"] !== "boolean") result.my_cards = profileVal;
  }

  if (typeof obj["orders"] === "boolean" && typeof obj["my_orders"] !== "boolean") {
    result.my_orders = Boolean(obj["orders"]);
  }

  if (typeof obj["notifications"] === "boolean" && typeof obj["notifications"] !== "boolean") {
    result.notifications = Boolean(obj["notifications"]);
  }

  return result;
}

export function isGroupAllowed(group: FeatureGroup, permissions: Record<string, boolean> | undefined, userRole?: string): boolean {
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") return true;
  const normalized = normalizeFeaturePermissions(permissions);
  const groupFeatures = FEATURE_CATALOGUE.filter((f) => f.group === group);
  return groupFeatures.some((f) => normalized[f.key] === true);
}

export function isFeatureAllowed(permissions: Record<string, boolean> | undefined, key: FeatureKey, userRole?: string): boolean {
  // SUPER_ADMIN and ADMIN always have full platform permissions
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") return true;
  const normalized = normalizeFeaturePermissions(permissions);
  return normalized[key] === true;
}

export function getFirstPermittedTab(permissions: Record<string, boolean> | undefined, userRole?: string): string | null {
  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") return "dashboard";
  const normalized = normalizeFeaturePermissions(permissions);
  for (const feature of FEATURE_CATALOGUE) {
    if (normalized[feature.key] === true) {
      return feature.dashboardTab;
    }
  }
  return null;
}
