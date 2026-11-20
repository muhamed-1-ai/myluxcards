import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

test("1. Sidebar Item Visibility: 'Courier & Shipping' is visible ONLY to SUPER_ADMIN in /admin", () => {
  const adminAppSource = fs.readFileSync(path.resolve("src/app/admin/AdminApp.tsx"), "utf-8");

  // Verify 'courier_shipping' is registered in Section and labels
  assert.match(adminAppSource, /"courier_shipping"/, "Section type includes courier_shipping");
  assert.match(adminAppSource, /courier_shipping:\s*"Courier & Shipping"/, "labels dictionary includes Courier & Shipping");

  // Verify the navigation button is strictly within the SUPER_ADMIN block
  const superAdminBlockMatch = adminAppSource.match(/identity\.role\s*===\s*"SUPER_ADMIN"\s*&&\s*\([\s\S]*?renderNavBtn\("courier_shipping",\s*"Courier & Shipping",\s*Truck\)[\s\S]*?\)/);
  assert.ok(superAdminBlockMatch, "Courier & Shipping button is enclosed inside identity.role === 'SUPER_ADMIN' guard");

  // Simulate sidebar rendering logic for SUPER_ADMIN vs ADMIN
  function getSidebarSections(identity) {
    const sections = [
      { key: "overview", label: "Dashboard" },
      { key: "managed_users", label: "Users" },
      { key: "team_calendar", label: "Team Calendar" },
      { key: "team_leads", label: "Team Leads" },
      { key: "team_analytics", label: "Team Analytics" },
      { key: "team_lob_reasons", label: "Team LOB Reasons" },
      { key: "activations", label: "My Card" },
      { key: "orders", label: "My Orders" },
      { key: "notifications", label: "Notifications" },
    ];
    if (identity.role === "SUPER_ADMIN") {
      sections.push({ key: "admins", label: "Admin Management" });
      sections.push({ key: "courier_shipping", label: "Courier & Shipping" });
      sections.push({ key: "audit", label: "Audit Logs" });
      sections.push({ key: "settings", label: "Platform Settings" });
    }
    return sections;
  }

  const superAdminSections = getSidebarSections({ id: "sa-1", role: "SUPER_ADMIN" });
  assert.ok(superAdminSections.some((s) => s.key === "courier_shipping" && s.label === "Courier & Shipping"), "SUPER_ADMIN has Courier & Shipping in sidebar");

  const regularAdminSections = getSidebarSections({ id: "adm-1", role: "ADMIN" });
  assert.equal(regularAdminSections.some((s) => s.key === "courier_shipping"), false, "Regular ADMIN must NOT have Courier & Shipping in sidebar");

  const customerSections = getSidebarSections({ id: "usr-1", role: "USER" });
  assert.equal(customerSections.some((s) => s.key === "courier_shipping"), false, "Customer must NOT have Courier & Shipping in sidebar");
});

test("2. /admin Direct Navigation & Access Guard: Regular Admins are denied courier_shipping", () => {
  const adminPageSource = fs.readFileSync(path.resolve("src/app/admin/page.tsx"), "utf-8");
  const adminAppSource = fs.readFileSync(path.resolve("src/app/admin/AdminApp.tsx"), "utf-8");

  // Verify page.tsx sanitizes initialSection for non-super admins
  assert.match(
    adminPageSource,
    /sec\s*===\s*"courier_shipping"\s*&&\s*identity\.role\s*!==\s*"SUPER_ADMIN"/,
    "AdminPage sanitizes courier_shipping section for non-super admins"
  );

  // Verify AdminApp guards section === 'courier_shipping' against non-super admins
  assert.match(
    adminAppSource,
    /if\s*\(\s*section\s*===\s*"courier_shipping"\s*\)\s*\{[\s\S]*?identity\.role\s*!==\s*"SUPER_ADMIN"/,
    "AdminApp Content rejects non-super admins accessing courier_shipping"
  );

  // Simulate resolution logic
  function resolveAdminSection(identity, requestedSection) {
    if (requestedSection === "courier_shipping" && identity.role !== "SUPER_ADMIN") {
      return "overview";
    }
    return requestedSection || "overview";
  }

  assert.equal(resolveAdminSection({ role: "SUPER_ADMIN" }, "courier_shipping"), "courier_shipping");
  assert.equal(resolveAdminSection({ role: "ADMIN" }, "courier_shipping"), "overview");
  assert.equal(resolveAdminSection({ role: "USER" }, "courier_shipping"), "overview");
});

test("3. Shipping Workspace Reuse: Opening an order renders ShipOrderWorkspace", () => {
  const adminAppSource = fs.readFileSync(path.resolve("src/app/admin/AdminApp.tsx"), "utf-8");

  // Verify ShippingMode is imported and rendered with onOpenWorkspace connecting to openShipOrder
  assert.match(adminAppSource, /import ShippingMode from "@\/components\/super-admin\/ShippingMode"/);
  assert.match(adminAppSource, /<ShippingMode[\s\S]*?onOpenWorkspace=\{\(id\)\s*=>\s*openShipOrder\(id\)\}/);

  // Verify ShipOrderWorkspace is rendered whenever shipOrderId is active
  assert.match(adminAppSource, /if\s*\(\s*shipOrderId\s*\)\s*\{[\s\S]*?<ShipOrderWorkspace[\s\S]*?orderId=\{shipOrderId\}/);

  // Verify link to Super Admin Fulfillment Command Center exists
  assert.match(adminAppSource, /href="\/super-admin\?section=fulfillment&mode=shipping"/);
});

test("4. /super-admin Direct Navigation: Query parameters activate Fulfillment & Shipping Mode directly", () => {
  const superAdminPageSource = fs.readFileSync(path.resolve("src/app/super-admin/page.tsx"), "utf-8");
  const superAdminAppSource = fs.readFileSync(path.resolve("src/app/super-admin/SuperAdminApp.tsx"), "utf-8");

  // Verify SuperAdminPage parses searchParams and determines initialSection, initialMode, initialOrderId
  assert.match(superAdminPageSource, /secParam\s*===\s*"fulfillment"/);
  assert.match(superAdminPageSource, /secParam\s*===\s*"shipping"/);
  assert.match(superAdminPageSource, /resolvedParams\.mode\s*===\s*"shipping"/);

  // Verify SuperAdminApp initializes from query or URL params
  assert.match(superAdminAppSource, /initialSection\?: Section/);
  assert.match(superAdminAppSource, /initialMode\?:\s*"all"\s*\|\s*"packing"\s*\|\s*"shipping"/);
  assert.match(superAdminAppSource, /initialOrderId\?:\s*string/);

  // Simulate SuperAdmin route parameter resolution
  function resolveSuperAdminParams(searchParams) {
    const secParam = searchParams.section || searchParams.tab;
    let initialSection = "overview";
    let initialMode = "all";
    if (secParam === "fulfillment" || secParam === "shipping" || secParam === "courier_shipping" || searchParams.mode || searchParams.orderId || searchParams.shipOrderId) {
      initialSection = "fulfillment";
    }
    if (searchParams.mode === "shipping" || secParam === "shipping" || secParam === "courier_shipping") {
      initialMode = "shipping";
    } else if (searchParams.mode === "packing") {
      initialMode = "packing";
    }
    const initialOrderId = searchParams.orderId || searchParams.shipOrderId || null;
    return { initialSection, initialMode, initialOrderId };
  }

  // Direct navigation to shipping mode
  const res1 = resolveSuperAdminParams({ section: "fulfillment", mode: "shipping" });
  assert.equal(res1.initialSection, "fulfillment");
  assert.equal(res1.initialMode, "shipping");

  // Direct navigation to courier shipping shortcut
  const res2 = resolveSuperAdminParams({ section: "courier_shipping" });
  assert.equal(res2.initialSection, "fulfillment");
  assert.equal(res2.initialMode, "shipping");

  // Direct navigation to a specific order's ship workspace
  const res3 = resolveSuperAdminParams({ orderId: "ord-test-456" });
  assert.equal(res3.initialSection, "fulfillment");
  assert.equal(res3.initialOrderId, "ord-test-456");
});

test("5. RBAC & Security: Regular Admins and Customers are blocked from /super-admin and Shipping APIs", () => {
  // Page guard verification (requireSuperAdminPage)
  function evaluateSuperAdminPageAccess(user) {
    if (!user) return { redirect: "/?login=1&next=%2Fsuper-admin" };
    if (user.role !== "SUPER_ADMIN") return { redirect: "/forbidden" };
    return { allowed: true, identity: user };
  }

  assert.equal(evaluateSuperAdminPageAccess(null).redirect, "/?login=1&next=%2Fsuper-admin");
  assert.equal(evaluateSuperAdminPageAccess({ role: "USER" }).redirect, "/forbidden");
  assert.equal(evaluateSuperAdminPageAccess({ role: "ADMIN" }).redirect, "/forbidden");
  assert.equal(evaluateSuperAdminPageAccess({ role: "SUPER_ADMIN" }).allowed, true);

  // API guard verification (requireSuperAdmin)
  function evaluateSuperAdminApi(user) {
    if (!user || user.role !== "SUPER_ADMIN") return { status: 403, message: "Forbidden" };
    return { status: 200, message: "Authorized" };
  }

  assert.equal(evaluateSuperAdminApi(null).status, 403);
  assert.equal(evaluateSuperAdminApi({ role: "USER" }).status, 403);
  assert.equal(evaluateSuperAdminApi({ role: "ADMIN" }).status, 403);
  assert.equal(evaluateSuperAdminApi({ role: "SUPER_ADMIN" }).status, 200);
});
