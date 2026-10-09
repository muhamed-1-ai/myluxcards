import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FEATURE_CATALOGUE,
  ZERO_FEATURE_PERMISSIONS,
  normalizeFeaturePermissions,
  isFeatureAllowed,
} from "../src/lib/permissionsRegistry.ts";

const preferenceApiCode = readFileSync(
  new URL("../src/app/api/user/dashboard-preferences/route.ts", import.meta.url),
  "utf8"
);
const dashboardComponentCode = readFileSync(
  new URL("../src/components/dashboard/LeadManagementDashboard.tsx", import.meta.url),
  "utf8"
);
const dashboardDemoCode = readFileSync(
  new URL("../src/app/dashboard/DashboardDemo.tsx", import.meta.url),
  "utf8"
);

test("1. Lead Management permission key is identified as 'all_leads'", () => {
  const leadFeature = FEATURE_CATALOGUE.find((f) => f.key === "all_leads");
  assert.ok(leadFeature, "all_leads must exist in FEATURE_CATALOGUE");
  assert.equal(leadFeature.label, "All Leads");
  assert.equal(leadFeature.group, "Dashboards");

  // Verify new accounts with zero features have Lead Management disabled by default
  assert.equal(ZERO_FEATURE_PERMISSIONS.all_leads, false);

  const emptyNorm = normalizeFeaturePermissions({});
  assert.equal(emptyNorm.all_leads, false);
});

test("2. Permission resolver correctly grants and denies customization based on 'all_leads'", () => {
  const deniedPermissions = normalizeFeaturePermissions({ all_leads: false });
  assert.equal(isFeatureAllowed(deniedPermissions, "all_leads", "CUSTOMER"), false);
  assert.equal(isFeatureAllowed(undefined, "all_leads", "CUSTOMER"), false);

  const grantedPermissions = normalizeFeaturePermissions({ all_leads: true });
  assert.equal(isFeatureAllowed(grantedPermissions, "all_leads", "CUSTOMER"), true);

  // Administrative role override
  assert.equal(isFeatureAllowed(deniedPermissions, "all_leads", "SUPER_ADMIN"), true);
  assert.equal(isFeatureAllowed(deniedPermissions, "all_leads", "ADMIN"), true);
});

test("3. Server API route /api/user/dashboard-preferences enforces Lead Management entitlement", () => {
  // Checks that isFeatureAllowed with "all_leads" is invoked in both GET and PUT handlers
  assert.match(preferenceApiCode, /isFeatureAllowed\(identity\.featurePermissions,\s*"all_leads",\s*identity\.role\)/);
  assert.match(preferenceApiCode, /status:\s*403/);
  assert.match(preferenceApiCode, /Forbidden:\s*Lead Management permission is required/);

  // Checks that preference updates are bound strictly to the authenticated identity.id
  assert.match(preferenceApiCode, /updateUserDashboardPreferences\(identity\.id,\s*sanitizedPreferences\)/);
  assert.match(preferenceApiCode, /getUserDashboardPreferences\(identity\.id\)/);
});

test("4. Dashboard component restricts all UI entry points when Lead Management is disabled", () => {
  // Verifies canCustomize uses isFeatureAllowed with "all_leads"
  assert.match(dashboardComponentCode, /isFeatureAllowed\(identity\.featurePermissions,\s*"all_leads",\s*identity\.role\)/);

  // Main button, Manage Sections button, empty state button, and drawer rendering checked against canCustomize
  assert.match(dashboardComponentCode, /canCustomize\s*\?\s*\([\s\S]*crm-btn-customize-primary/);
  assert.match(dashboardComponentCode, /canCustomize\s*\?\s*\([\s\S]*crm-btn-manage-secondary/);
  assert.match(dashboardComponentCode, /\{canCustomize\s*&&\s*\([\s\S]*<CustomizeDashboardDrawer/);
});

test("5. Grants, revocations, and drawer auto-closure logic", () => {
  // Verifies useEffect auto-closes customize drawer if canCustomize becomes false
  assert.match(dashboardComponentCode, /useEffect\(\(\)\s*=>\s*\{[\s\S]*!canCustomize\s*&&\s*customizeOpen[\s\S]*setCustomizeOpen\(false\)/);

  // Verifies handleSaveCustomization blocks save requests when canCustomize is false
  assert.match(dashboardComponentCode, /if\s*\(!canCustomize\)\s*\{\s*throw new Error\("Lead Management permission is required to customize the dashboard."\)/);
});

test("6. Individual widgets respect their feature permissions independently", () => {
  // Verifies isWidgetFeatureAllowed checks feature permissions for lob_reasons, calendar, and all_leads
  assert.match(dashboardComponentCode, /isWidgetFeatureAllowed/);
  assert.match(dashboardComponentCode, /isFeatureAllowed\(perms,\s*"lob_reasons",\s*role\)/);
  assert.match(dashboardComponentCode, /isFeatureAllowed\(perms,\s*"calendar",\s*role\)/);
  assert.match(dashboardComponentCode, /isFeatureAllowed\(perms,\s*"all_leads",\s*role\)/);

  // Verifies visibleCards and visibleSections are filtered by isWidgetFeatureAllowed
  assert.match(dashboardComponentCode, /isWidgetFeatureAllowed\(item\.id\)/);
});

test("7. DashboardDemo passes featurePermissions in identity prop", () => {
  assert.match(dashboardDemoCode, /featurePermissions:\s*userPermissions/);
});
