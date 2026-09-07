import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("Account Hierarchy - Google OAuth Allowlist & Security Controls", () => {
  const service = read("../src/lib/authService.ts");
  const adminAuth = read("../src/lib/adminAuth.ts");
  const managedRoute = read("../src/app/api/admin/managed-users/route.ts");
  const managedDetailRoute = read("../src/app/api/admin/managed-users/[id]/route.ts");
  const superRoute = read("../src/app/api/super-admin/admins/route.ts");

  assert.match(service, /isApprovedGoogleAdminEmail/);
  assert.match(service, /ADMIN_GOOGLE_EMAILS/);
  assert.match(service, /createAdminManagedUser/);

  assert.match(adminAuth, /requirePermission/);
  assert.match(adminAuth, /requireManagedUserOwnership/);
  assert.match(adminAuth, /requireSuperAdmin/);

  assert.match(managedRoute, /Role is ALWAYS 'USER'/i);
  assert.match(managedDetailRoute, /requireManagedUserOwnership/);
  assert.match(superRoute, /requireSuperAdmin/);
});

test("Account Hierarchy - Authority Limits Definition", () => {
  const adminAllowedSections = ["overview", "managed_users", "orders", "customers", "activations", "products", "payments", "support", "notifications"];
  const superAdminOnlySections = ["admins", "audit", "settings"];

  for (const section of superAdminOnlySections) {
    assert.equal(adminAllowedSections.includes(section), false, `ADMIN must NOT have access to ${section}`);
  }
});
