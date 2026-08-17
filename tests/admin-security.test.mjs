import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const signup = readFileSync(new URL("../src/app/api/auth/signup/route.ts", import.meta.url), "utf8");
const authService = readFileSync(new URL("../src/lib/authService.ts", import.meta.url), "utf8");
const admin = readFileSync(new URL("../src/app/api/admin/admins/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/202607250001_super_admin.sql", import.meta.url), "utf8");
const bootstrap = readFileSync(new URL("../scripts/create-super-admin.ts", import.meta.url), "utf8");
const notifications = readFileSync(new URL("../src/lib/orderNotifications.ts", import.meta.url), "utf8");
const orders = readFileSync(new URL("../src/app/api/admin/orders/route.ts", import.meta.url), "utf8");
const support = readFileSync(new URL("../src/app/api/support/route.ts", import.meta.url), "utf8");
const publicApp = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
const customerDetail = readFileSync(new URL("../src/app/api/admin/customers/[id]/route.ts", import.meta.url), "utf8");
const dashboardPage = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const refresh = readFileSync(new URL("../src/app/api/auth/refresh/route.ts", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");

test("public signup fixes the role server-side", () => {
  assert.match(authService, /'CUSTOMER'/);
  assert.doesNotMatch(signup, /body\.role/);
  assert.match(signup, /createCredentialUser/);
  assert.doesNotMatch(signup, /Supabase|auth\/v1/);
});
test("admin management requires Super Admin and protects Super Admin targets", () => {
  assert.match(admin, /requireAdmin\(true\)/);
  assert.match(admin, /target\.role==="SUPER_ADMIN"/);
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
test("support submissions create rate-limited admin notifications", () => {
  assert.match(support, /validMutationOrigin\(request\)/);
  assert.match(support, /type: "SUPPORT_TICKET"/);
  assert.match(support, /recentCount >= 3/);
  assert.match(support, /admin_notifications/);
  assert.match(publicApp, /fetch\('\/api\/support'/);
  const handler = publicApp.slice(publicApp.indexOf("async handleSupportTicket"), publicApp.indexOf("handleReviewSubmission"));
  assert.match(handler, /if \(!response\.ok\) throw/);
  assert.doesNotMatch(handler, /submitted successfully/);
});
test("customer detail records require admin access and stay scoped to one customer", () => {
  assert.match(customerDetail, /requireAdmin\(\)/);
  assert.match(customerDetail, /id=eq\.\$\{id\}&role=eq\.CUSTOMER/);
  assert.match(customerDetail, /owner_id=eq\.\$\{id\}/);
  assert.match(customerDetail, /customer_id=eq\.\$\{id\}/);
  assert.doesNotMatch(customerDetail, /password_hash|encrypted_password/);
});
test("dashboard validates the Auth.js session before asking the user to sign in", () => {
  assert.match(dashboardPage, /currentIdentity/);
  assert.match(refresh, /export async function GET/);
  assert.match(refresh, /!value\.startsWith\("\/\/"\)/);
  assert.match(middleware, /isAccountRoute/);
  assert.match(middleware, /session\?\.userId/);
  assert.match(middleware, /\/api\/auth\/refresh/);
  for (const route of ["dashboard", "orders", "affiliate/apply", "partners/apply", "admin"]) {
    assert.match(middleware, new RegExp(route.replace("/", "\\/")));
  }
});

test("super admin promotion is server-only, idempotent, and increments session_version", () => {
  const promoteScript = readFileSync(new URL("../scripts/promote-super-admin.ts", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts["promote:super-admin"], "tsx scripts/promote-super-admin.ts");
  assert.match(promoteScript, /normalizeEmail/);
  assert.match(promoteScript, /select id, email, role, session_version from users/);
  assert.match(promoteScript, /User is already SUPER_ADMIN/);
  assert.match(promoteScript, /role = 'SUPER_ADMIN', session_version = session_version \+ 1/);
  assert.match(promoteScript, /SUPER_ADMIN_PROMOTION/);
  assert.match(promoteScript, /SERVER_CLI/);
  assert.doesNotMatch(promoteScript, /password_hash|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(promoteScript, /console\.log\(.*DATABASE_URL/);
});
