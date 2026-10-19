import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  normalizeFeaturePermissions,
  isAccountingEntitled,
  ACCOUNTING_MODULE_ENTITLEMENT,
  ZERO_FEATURE_PERMISSIONS,
} from "../src/lib/permissionsRegistry.ts";

const adminAuth = readFileSync(new URL("../src/lib/adminAuth.ts", import.meta.url), "utf8");
const adminApp = readFileSync(new URL("../src/app/admin/AdminApp.tsx", import.meta.url), "utf8");
const authService = readFileSync(new URL("../src/lib/authService.ts", import.meta.url), "utf8");

test("Accounting module entitlement: default is OFF for all new ordinary users", () => {
  // ZERO_FEATURE_PERMISSIONS defaults accounting_access to false
  const emptyNormalized = normalizeFeaturePermissions({});
  assert.equal(emptyNormalized["accounting_access"], false);
  assert.equal(isAccountingEntitled(emptyNormalized, "CUSTOMER"), false);
  assert.equal(isAccountingEntitled(emptyNormalized, "USER"), false);
  assert.equal(isAccountingEntitled(undefined, "CUSTOMER"), false);
});

test("Accounting module entitlement: credential signup and Google signup initialize with ZERO permissions", () => {
  assert.match(authService, /JSON\.stringify\(ZERO_FEATURE_PERMISSIONS\)/);
});

test("Accounting module entitlement: explicit grant enables access for ordinary user", () => {
  const grantedPerms = normalizeFeaturePermissions({
    accounting_access: true,
  });
  assert.equal(grantedPerms["accounting_access"], true);
  assert.equal(isAccountingEntitled(grantedPerms, "CUSTOMER"), true);
  assert.equal(isAccountingEntitled(grantedPerms, "USER"), true);

  // Aliases supported for backwards compatibility
  const aliasPerms = normalizeFeaturePermissions({
    "accounting.access": true,
  });
  assert.equal(aliasPerms["accounting_access"], true);
  assert.equal(isAccountingEntitled(aliasPerms, "USER"), true);
});

test("Accounting module entitlement: platform administrators have universal access", () => {
  const emptyPerms = normalizeFeaturePermissions({});
  assert.equal(isAccountingEntitled(emptyPerms, "SUPER_ADMIN"), true);
  assert.equal(isAccountingEntitled(emptyPerms, "ADMIN"), true);
});

test("Admin UI renders Zappit Accounts toggle with approved label and helper text", () => {
  assert.match(adminApp, /Zappit Accounts/);
  assert.match(adminApp, /Allows this user to access the Accounting module\./);
  assert.match(adminApp, /Platform Module Entitlement/);
  assert.match(adminApp, /accounting_access/);
});

test("adminAuth.ts exports requireAccountingAccess guard", () => {
  assert.match(adminAuth, /export async function requireAccountingAccess/);
  assert.match(adminAuth, /isAccountingEntitled\(identity\.featurePermissions/);
});
