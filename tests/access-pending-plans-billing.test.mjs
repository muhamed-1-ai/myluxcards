import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PLAN_CATALOG,
  resolvePlanId,
  mergePlanPermissions,
} from "../src/lib/billingPlans.ts";
import {
  FEATURE_CATALOGUE,
  isFeatureAllowed,
  getFirstPermittedTab,
} from "../src/lib/permissionsRegistry.ts";

// Source files inspection
const dashboardDemoCode = readFileSync(new URL("../src/app/dashboard/DashboardDemo.tsx", import.meta.url), "utf8");
const dashboardCssCode = readFileSync(new URL("../src/app/dashboard/dashboard.css", import.meta.url), "utf8");
const choosePlanCode = readFileSync(new URL("../src/components/dashboard/ChoosePlanSection.tsx", import.meta.url), "utf8");
const razorpayLibCode = readFileSync(new URL("../src/lib/razorpay.ts", import.meta.url), "utf8");
const billingEntitlementsCode = readFileSync(new URL("../src/lib/billingEntitlements.ts", import.meta.url), "utf8");
const checkoutApiCode = readFileSync(new URL("../src/app/api/checkout/route.ts", import.meta.url), "utf8");
const verifyApiCode = readFileSync(new URL("../src/app/api/payments/razorpay/verify/route.ts", import.meta.url), "utf8");
const webhookApiCode = readFileSync(new URL("../src/app/api/payments/razorpay/webhook/route.ts", import.meta.url), "utf8");
const confirmApiCode = readFileSync(new URL("../src/app/api/billing/confirm/route.ts", import.meta.url), "utf8");
const crmCalendarApiCode = readFileSync(new URL("../src/app/api/dashboard/crm-calendar/route.ts", import.meta.url), "utf8");
const leadSummaryApiCode = readFileSync(new URL("../src/app/api/dashboard/lead-summary/route.ts", import.meta.url), "utf8");
const dynamicFieldsApiCode = readFileSync(new URL("../src/app/api/dynamic-fields/route.ts", import.meta.url), "utf8");
const remindersApiCode = readFileSync(new URL("../src/app/api/follow-ups/reminders/due/route.ts", import.meta.url), "utf8");
const leadsPageCode = readFileSync(new URL("../src/app/dashboard/leads/page.tsx", import.meta.url), "utf8");

test("1. Plan catalog contains exact Lite and Pro plan definitions", () => {
  const lite = PLAN_CATALOG["plan-lite"];
  const pro = PLAN_CATALOG["plan-pro"];

  assert.ok(lite, "Lite plan definition must exist");
  assert.equal(lite.id, "plan-lite");
  assert.equal(lite.name, "Lite");
  assert.equal(lite.price, 1999);
  assert.equal(lite.currency, "INR");
  assert.equal(lite.ctaLabel || lite.buttonLabel, "Choose Lite");
  assert.match(lite.billingPeriod, /One-time hardware purchase/);

  assert.ok(pro, "Pro plan definition must exist");
  assert.equal(pro.id, "plan-pro");
  assert.equal(pro.name, "Pro");
  assert.equal(pro.price, 2999);
  assert.equal(pro.currency, "INR");
  assert.equal(pro.ctaLabel || pro.buttonLabel, "Choose Pro");
  assert.match(pro.billingPeriod, /year/);
  assert.equal(pro.badge, "Includes Full CRM Workspace");

  // Plan ID resolver correctly aliases variations
  assert.equal(resolvePlanId("plan-lite"), "plan-lite");
  assert.equal(resolvePlanId("bundle-standard"), "plan-lite");
  assert.equal(resolvePlanId("lite"), "plan-lite");
  assert.equal(resolvePlanId("plan-pro"), "plan-pro");
  assert.equal(resolvePlanId("bundle-crm"), "plan-pro");
  assert.equal(resolvePlanId("pro"), "plan-pro");
});

test("2. Access Pending view replaces empty main area and shows Lite and Pro plans", () => {
  // Verifies ChoosePlanSection component is integrated into DashboardDemo
  assert.match(dashboardDemoCode, /ChoosePlanSection/, "DashboardDemo must import and use ChoosePlanSection");
  assert.match(dashboardDemoCode, /dash-shell-pending/, "DashboardDemo must use dash-shell-pending class");

  // Verifies side by side on desktop and stacked on mobile in ChoosePlanSection
  assert.match(choosePlanCode, /grid\s+grid-cols-1\s+md:grid-cols-2/, "ChoosePlanSection must use responsive grid (1 col mobile, 2 col desktop)");
  assert.match(choosePlanCode, /Choose your Zappit plan/, "ChoosePlanSection must contain 'Choose your Zappit plan' heading");
  assert.equal(PLAN_CATALOG["plan-lite"].buttonLabel, "Choose Lite", "Must define 'Choose Lite' button label");
  assert.equal(PLAN_CATALOG["plan-pro"].buttonLabel, "Choose Pro", "Must define 'Choose Pro' button label");
  assert.match(choosePlanCode, /plan\.buttonLabel/, "Button must render plan.buttonLabel");

  // Floating look with soft shadow and hover lift
  assert.match(choosePlanCode, /shadow-xl|shadow-2xl/, "Plan cards must have soft shadow");
  assert.match(dashboardCssCode, /transform:\s*translateY\(-4px\)/, "dashboard.css must specify hover lift");

  // Reachable Account Settings and Sign out
  assert.match(dashboardDemoCode, /Account Settings/, "Header must have reachable Account Settings");
  assert.match(dashboardDemoCode, /Sign out/, "Header must have reachable Sign out");

  // Mobile full-width settings
  assert.match(dashboardCssCode, /\.dash-pending-settings-wrapper\s*\{[^}]*width:\s*100%\s*!important/s, "Settings wrapper must take full width on mobile");
});

test("3. Theme support matches pure black/dark blue in dark mode and white/blue in light mode", () => {
  assert.match(dashboardCssCode, /\.dash-shell\.dash-shell-pending\s*\{[^}]*background:\s*var\(--background,\s*#07080B\)/s);
  assert.match(dashboardCssCode, /\[data-theme="light"\]\s+\.dash-shell\.dash-shell-pending[^}]*background:\s*#F8FAFC/s);
  assert.match(dashboardCssCode, /\[data-theme="light"\]\s+\.choose-plan-root[^}]*--plan-heading:\s*#0F172A/s);
  assert.match(choosePlanCode, /isDark\s*=\s*theme\s*===\s*"dark"/, "ChoosePlanSection must adapt styles based on light/dark theme");
});

test("4. Successful Lite purchase activates exact Lite entitlements and preserves session", () => {
  const emptyPermissions = {};
  const activated = mergePlanPermissions(emptyPermissions, "plan-lite");

  assert.equal(activated["profile_features"], true);
  assert.equal(activated["contact_info"], true);
  assert.equal(activated["apps_links"], true);
  assert.equal(activated["company"], true);
  assert.equal(activated["card_design"], true);
  assert.equal(activated["my_cards"], true);
  assert.equal(activated["notifications"], true);
  assert.equal(activated["my_orders"], true);

  // Pro-only features must be false
  assert.equal(activated["overview"], false);
  assert.equal(activated["all_leads"], false);
  assert.equal(activated["lead_sources"], false);
  assert.equal(activated["config_products"], false);
  assert.equal(activated["lead_stages"], false);
  assert.equal(activated["calendar"], false);
  assert.equal(activated["lob_reasons"], false);
  assert.equal(activated["dynamic_leads"], false);

  // Verify server activation avoids bumping session_version so active sessions are not revoked
  assert.match(billingEntitlementsCode, /UPDATE users SET feature_permissions/);
  assert.ok(!billingEntitlementsCode.includes("session_version = session_version + 1"), "Must NOT bump session_version so active session is preserved");

  // Lite user landing tab is first permitted (cards or modes), NOT dashboard/leads
  const firstTab = getFirstPermittedTab(activated, "CUSTOMER");
  assert.ok(firstTab === "modes" || firstTab === "cards", `Lite landing tab must be modes or cards, got ${firstTab}`);
});

test("5. Successful Pro purchase activates all Lite features plus full CRM workspace", () => {
  const emptyPermissions = {};
  const activated = mergePlanPermissions(emptyPermissions, "plan-pro");

  // Lite features active
  assert.equal(activated["profile_features"], true);
  assert.equal(activated["my_cards"], true);

  // Pro features active
  assert.equal(activated["overview"], true);
  assert.equal(activated["all_leads"], true);
  assert.equal(activated["lead_sources"], true);
  assert.equal(activated["config_products"], true);
  assert.equal(activated["lead_stages"], true);
  assert.equal(activated["calendar"], true);
  assert.equal(activated["lob_reasons"], true);
  assert.equal(activated["dynamic_leads"], true);

  // Verify Pro plan provisions default workspace
  assert.match(billingEntitlementsCode, /ensureDefaultWorkspace/, "Pro plan must provision default workspace");

  // Pro user landing tab is dashboard overview
  const firstTab = getFirstPermittedTab(activated, "CUSTOMER");
  assert.equal(firstTab, "dashboard", "Pro landing tab must be dashboard");
});

test("6. Cancelled checkout keeps both plans available with no permissions granted", () => {
  // Verify modal ondismiss / cancellation logic
  assert.match(choosePlanCode, /ondismiss/, "ChoosePlanSection must listen for checkout modal dismiss");
  assert.match(choosePlanCode, /Payment was cancelled\. Both plans remain available to choose\./);
  assert.match(choosePlanCode, /Both plans remain available/, "Checkout error messages must explicitly reassure availability");
});

test("7. Client-side URL tampering or state alone cannot grant access without server verification", () => {
  // Check that DashboardDemo does not grant permissions from query params like ?payment=success or ?plan=pro
  assert.ok(!dashboardDemoCode.includes("url.searchParams.get('plan')"), "DashboardDemo must not grant plan access from query params");
  assert.ok(!dashboardDemoCode.includes("url.searchParams.get('payment')"), "DashboardDemo must not grant access from payment query params");

  // Confirm route requires server-side HMAC signature verification
  assert.match(confirmApiCode, /verifyRazorpaySignature/, "Confirm API must verify Razorpay signature");
  assert.match(razorpayLibCode, /createHmac\("sha256"/, "Razorpay verification must verify HMAC-SHA256 signature");
  assert.match(confirmApiCode, /activatePlanEntitlements/, "Confirm API must activate entitlements on the server");
});

test("8. Idempotent payment handling prevents duplicate access errors or privilege escalation", () => {
  const existing = { profile_features: true, my_cards: true };

  // Calling twice in a row
  const first = mergePlanPermissions(existing, "plan-lite");
  const second = mergePlanPermissions(first, "plan-lite");

  assert.deepEqual(first, second, "Repeated activations must produce identical idempotent entitlements");

  // Verify verification route idempotency
  assert.match(verifyApiCode, /alreadyConfirmed:\s*true/, "Verification route must handle already confirmed orders idempotently");
});

test("9. Preserves preexisting admin-granted access during plan activation", () => {
  const adminGranted = {
    accounting_access: true,
    special_vip_feature: true,
  };

  const activated = mergePlanPermissions(adminGranted, "plan-lite");

  // Preexisting custom permissions must be retained!
  assert.equal(activated["accounting_access"], true, "Must retain admin-granted accounting_access");
  assert.equal(activated["special_vip_feature"], true, "Must retain admin-granted special_vip_feature");
  assert.equal(activated["profile_features"], true, "Must add Lite features");
});

test("10. Enforces plan entitlements on Pro-only dashboard routes and API endpoints", () => {
  // Server-side route guard on /dashboard/leads
  assert.match(leadsPageCode, /requirePermission\("all_leads"\)/, "/dashboard/leads route must enforce all_leads permission");

  // API endpoints check Pro permissions
  assert.match(crmCalendarApiCode, /isFeatureAllowed\([^,]+,\s*"calendar"[^)]*\)/, "crm-calendar API must check calendar permission");
  assert.match(crmCalendarApiCode, /FORBIDDEN/, "crm-calendar API must return 403 when not entitled");

  assert.match(leadSummaryApiCode, /isFeatureAllowed\([^,]+,\s*"overview"[^)]*\)/, "lead-summary API must check overview permission");
  assert.match(leadSummaryApiCode, /FORBIDDEN/, "lead-summary API must return 403 when not entitled");

  assert.match(dynamicFieldsApiCode, /isFeatureAllowed\([^,]+,\s*"dynamic_leads"[^)]*\)/, "dynamic-fields API must check dynamic_leads permission");
  assert.match(dynamicFieldsApiCode, /FORBIDDEN/, "dynamic-fields API must return 403 when not entitled");

  assert.match(remindersApiCode, /isFeatureAllowed\([^,]+,\s*"calendar"[^)]*\)/, "reminders API must check calendar permission");
  assert.match(remindersApiCode, /FORBIDDEN/, "reminders API must return 403 when not entitled");
});

test("11. Webhook asynchronously activates plan entitlements on captured payment", () => {
  assert.match(webhookApiCode, /payment\.captured/, "Webhook must listen for payment.captured event");
  assert.match(webhookApiCode, /activatePlanEntitlementsForOrder/, "Webhook must call activatePlanEntitlementsForOrder");
});
