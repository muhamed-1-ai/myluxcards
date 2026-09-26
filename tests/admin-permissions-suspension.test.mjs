import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FEATURE_CATALOGUE,
  DEFAULT_FEATURE_PERMISSIONS,
  normalizeFeaturePermissions,
  isFeatureAllowed,
  isGroupAllowed,
  getFirstPermittedTab
} from "../src/lib/permissionsRegistry.ts";

const managedUserApi = readFileSync(new URL("../src/app/api/admin/managed-users/[id]/route.ts", import.meta.url), "utf8");
const managedUserListApi = readFileSync(new URL("../src/app/api/admin/managed-users/route.ts", import.meta.url), "utf8");
const usersRepo = readFileSync(new URL("../src/lib/repositories/users.ts", import.meta.url), "utf8");
const adminAuth = readFileSync(new URL("../src/lib/adminAuth.ts", import.meta.url), "utf8");
const adminApp = readFileSync(new URL("../src/app/admin/AdminApp.tsx", import.meta.url), "utf8");
const dashboardApp = readFileSync(new URL("../src/app/dashboard/DashboardDemo.tsx", import.meta.url), "utf8");

test("Canonical features catalogue contains exact 17 features", () => {
  assert.equal(FEATURE_CATALOGUE.length, 17);
  
  const featureKeys = FEATURE_CATALOGUE.map(f => f.key);
  const expectedKeys = [
    "overview", "all_leads", "qr_activity",
    "lead_sources", "config_products", "lead_stages", "calendar", "lob_reasons", "dynamic_leads",
    "profile_features", "contact_info", "apps_links", "company", "card_design",
    "my_cards", "notifications", "my_orders"
  ];
  
  assert.deepEqual(featureKeys, expectedKeys);
});

test("Feature groups cover all 17 features under 4 categories", () => {
  const groups = Array.from(new Set(FEATURE_CATALOGUE.map(f => f.group)));
  assert.equal(groups.length, 4);
  assert.deepEqual(groups, ["Dashboards", "Master Config", "Card & Profile", "Workspace"]);
});

test("normalizeFeaturePermissions normalizes legacy permissions and default values", () => {
  // Empty or undefined raw permissions default to ZERO access (all 17 false)
  const emptyPermissions = normalizeFeaturePermissions({});
  for (const f of FEATURE_CATALOGUE) {
    assert.equal(emptyPermissions[f.key], false);
  }

  // Legacy input with old keys like crm, nfc_card, qr_profile, analytics
  const legacyPermissions = {
    crm: true,
    nfc_card: false,
    qr_profile: true,
    analytics: false,
    lead_sources: false
  };

  const normalized = normalizeFeaturePermissions(legacyPermissions);
  
  // All 17 keys must exist as explicit booleans
  for (const f of FEATURE_CATALOGUE) {
    assert.equal(typeof normalized[f.key], "boolean");
  }

  // legacy mapping check: crm -> lead_stages, dynamic_leads (since crm is true)
  assert.equal(normalized.lead_stages, true);
  assert.equal(normalized.dynamic_leads, true);

  // explicit false preserved
  assert.equal(normalized.lead_sources, false);
});

test("isFeatureAllowed correctly evaluates roles and explicit denials", () => {
  const perm = normalizeFeaturePermissions({
    overview: true,
    all_leads: false
  });

  // User role with unconfigured or false feature is DENIED
  assert.equal(isFeatureAllowed(perm, "all_leads", "USER"), false);
  // User role with explicit true is ALLOWED
  assert.equal(isFeatureAllowed(perm, "overview", "USER"), true);

  // Default empty permissions return false for ordinary USER
  assert.equal(isFeatureAllowed(undefined, "overview", "USER"), false);

  // Admin/Super Admin override explicit denials for platform admin
  assert.equal(isFeatureAllowed(perm, "all_leads", "SUPER_ADMIN"), true);
  assert.equal(isFeatureAllowed(perm, "all_leads", "ADMIN"), true);
});

test("isGroupAllowed evaluates true if any child feature in group is allowed", () => {
  const allDisabled = FEATURE_CATALOGUE.reduce((acc, f) => ({ ...acc, [f.key]: false }), {});
  assert.equal(isGroupAllowed("Master Config", allDisabled), false);

  const oneEnabled = { ...allDisabled, lead_sources: true };
  assert.equal(isGroupAllowed("Master Config", oneEnabled), true);
});

test("getFirstPermittedTab falls back to first allowed feature tab when Overview is disabled", () => {
  const allEnabled = FEATURE_CATALOGUE.reduce((acc, f) => ({ ...acc, [f.key]: true }), {});
  const overviewDisabled = { ...allEnabled, overview: false };
  const firstTab = getFirstPermittedTab(overviewDisabled);
  assert.equal(firstTab, "leads");

  const allDisabled = FEATURE_CATALOGUE.reduce((acc, f) => ({ ...acc, [f.key]: false }), {});
  assert.equal(getFirstPermittedTab(allDisabled), null);
});

test("API route prevents self-suspension and last super admin suspension", () => {
  assert.match(managedUserApi, /identity\.id === managedUser\.id/);
  assert.match(managedUserApi, /cannot suspend your own account/i);
  assert.match(managedUserApi, /activeSuperCount <= 1/);
  assert.match(managedUserApi, /Cannot suspend the last active Super Admin/);
});

test("Permissions and Status changes increment session_version in database", () => {
  assert.match(usersRepo, /updateUserPermissions/);
  assert.match(usersRepo, /updateUserStatus/);
  assert.match(usersRepo, /session_version\s*=\s*session_version\s*\+\s*1/);
});

test("Auth identity checks session_version and normalizes permissions", () => {
  assert.match(adminAuth, /profile\.session_version\s*!==\s*session\.user\.sessionVersion/);
  assert.match(adminAuth, /normalizeFeaturePermissions/);
  assert.match(adminAuth, /requirePermission/);
});

test("Admin UI displays 17 features, enabled count, status filter, and suspend dialog", () => {
  assert.match(adminApp, /17 Features Enabled/);
  assert.match(adminApp, /FEATURE_CATALOGUE/);
  assert.match(adminApp, /AdminPermissionsModal/);
  assert.match(adminApp, /AdminSuspendModal/);
  assert.match(adminApp, /All Statuses/);
  assert.match(adminApp, /Active/);
  assert.match(adminApp, /Suspended/);
});

test("Dashboard UI filters sidebar navigation using isFeatureAllowed and isGroupAllowed", () => {
  assert.match(dashboardApp, /isFeatureAllowed/);
  assert.match(dashboardApp, /isGroupAllowed/);
  assert.match(dashboardApp, /isFeatureAllowed\(currentUser\?\.featurePermissions,\s*"overview"/);
});
