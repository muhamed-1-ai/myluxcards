import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const signup = readFileSync(new URL("../src/app/api/auth/signup/route.ts", import.meta.url), "utf8");
const admin = readFileSync(new URL("../src/app/api/admin/admins/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/202607250001_super_admin.sql", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../scripts/create-super-admin.ts", import.meta.url), "utf8");
const notifications = readFileSync(new URL("../src/lib/orderNotifications.ts", import.meta.url), "utf8");
const orders = readFileSync(new URL("../src/app/api/admin/orders/route.ts", import.meta.url), "utf8");

test("public signup fixes the role server-side", () => {
  assert.match(signup, /role:\s*"CUSTOMER"/);
  assert.doesNotMatch(signup, /body\.role/);
});
test("admin management requires Super Admin and protects Super Admin targets", () => {
  assert.match(admin, /requireAdmin\(true\)/);
  assert.match(admin, /target\.role === "SUPER_ADMIN"/);
});
test("commerce and administration tables use RLS", () => {
  for (const table of ["profiles","products","orders","payments","admin_audit_logs","admin_notifications","admin_invites","website_settings"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});
test("customer order policy is owner-scoped", () => {
  assert.match(migration, /customer_id=auth\.uid\(\)/);
});
test("database trigger prevents customer role and account-state manipulation", () => {
  assert.match(migration, /protect_profile_security_fields/);
  assert.match(migration, /new\.role := old\.role/);
  assert.match(migration, /current_user not in \('postgres', 'service_role', 'supabase_admin'\)/);
  assert.match(migration, /auth\.jwt\(\)->>'role'.*service_role/);
});
test("existing accounts require explicit promotion and are not password-reset", () => {
  assert.match(bootstrap, /SUPER_ADMIN_CONFIRM_EXISTING/);
  const existingBranch = bootstrap.slice(bootstrap.indexOf("if (existing)"), bootstrap.indexOf("} else {"));
  assert.doesNotMatch(existingBranch, /password\s*,|password:/);
});
test("order notification delivery is idempotent and never contains secrets", () => {
  assert.match(migration, /event_key text not null unique/);
  assert.match(notifications, /Idempotency-Key/);
  assert.doesNotMatch(notifications, /password|cvv|card_number/i);
});
test("admin order mutation cannot change payment status", () => {
  const patch = orders.slice(orders.indexOf("export async function PATCH"));
  assert.doesNotMatch(patch, /changes\.payment_status/);
  assert.match(patch, /requireAdmin\(\)/);
});
