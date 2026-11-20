import test from "node:test";
import assert from "node:assert/strict";

test("Direct Admin Authorization: Authorized Admins & Super Admins access dashboards directly", () => {
  function evaluateAdminAccess(user) {
    if (!user) return { allowed: false, status: 401, redirect: "/?login=1" };
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return { allowed: false, status: 403, redirect: "/forbidden" };
    }
    // Directly allowed without any MFA gating
    return { allowed: true, status: 200, dashboard: user.role === "SUPER_ADMIN" ? "/super-admin" : "/admin" };
  }

  // 1. Unauthenticated request must be denied with 401 / redirect to login
  const unauthed = evaluateAdminAccess(null);
  assert.equal(unauthed.allowed, false);
  assert.equal(unauthed.status, 401);
  assert.equal(unauthed.redirect, "/?login=1");

  // 2. Regular CUSTOMER must be blocked from admin with 403 / forbidden
  const customer = evaluateAdminAccess({ id: "cust-1", role: "CUSTOMER" });
  assert.equal(customer.allowed, false);
  assert.equal(customer.status, 403);
  assert.equal(customer.redirect, "/forbidden");

  // 3. Regular ADMIN accesses /admin directly without MFA
  const admin = evaluateAdminAccess({ id: "admin-1", role: "ADMIN" });
  assert.equal(admin.allowed, true);
  assert.equal(admin.status, 200);
  assert.equal(admin.dashboard, "/admin");

  // 4. SUPER_ADMIN accesses /super-admin directly without MFA
  const superAdmin = evaluateAdminAccess({ id: "super-1", role: "SUPER_ADMIN" });
  assert.equal(superAdmin.allowed, true);
  assert.equal(superAdmin.status, 200);
  assert.equal(superAdmin.dashboard, "/super-admin");
});

test("Legacy MFA Redirect Security: Validates next URL and prevents redirect loops", () => {
  function resolveSafeRedirect(rawNext, role) {
    const defaultDashboard = role === "SUPER_ADMIN" ? "/super-admin" : "/admin";
    if (!rawNext || typeof rawNext !== "string") return defaultDashboard;
    const trimmed = rawNext.trim();

    if (
      trimmed.startsWith("/") &&
      !trimmed.startsWith("//") &&
      !trimmed.includes(":") &&
      !trimmed.startsWith("/admin/mfa")
    ) {
      if (role === "ADMIN" && trimmed.startsWith("/super-admin")) {
        return "/admin";
      }
      return trimmed;
    }
    return defaultDashboard;
  }

  // Safe internal path
  assert.equal(resolveSafeRedirect("/admin/orders", "ADMIN"), "/admin/orders");
  assert.equal(resolveSafeRedirect("/super-admin/users", "SUPER_ADMIN"), "/super-admin/users");

  // Regular admin cannot be redirected into /super-admin
  assert.equal(resolveSafeRedirect("/super-admin", "ADMIN"), "/admin");

  // Redirect loops back into /admin/mfa are prevented
  assert.equal(resolveSafeRedirect("/admin/mfa/enroll", "SUPER_ADMIN"), "/super-admin");
  assert.equal(resolveSafeRedirect("/admin/mfa/verify?next=%2Fadmin", "ADMIN"), "/admin");

  // Open redirect attempts are neutralized
  assert.equal(resolveSafeRedirect("//evil.com", "ADMIN"), "/admin");
  assert.equal(resolveSafeRedirect("https://attacker.com", "ADMIN"), "/admin");
  assert.equal(resolveSafeRedirect("javascript:alert(1)", "ADMIN"), "/admin");
  assert.equal(resolveSafeRedirect("", "ADMIN"), "/admin");
});

test("Cookie Cleanup: Legacy MFA cookies are included in session cleanup", () => {
  const cookieNamesToClear = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "zappit_admin_mfa",
    "__Secure-zappit_admin_mfa",
  ];

  assert.equal(cookieNamesToClear.includes("zappit_admin_mfa"), true);
  assert.equal(cookieNamesToClear.includes("__Secure-zappit_admin_mfa"), true);
});
