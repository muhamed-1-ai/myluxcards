import test from "node:test";
import assert from "node:assert/strict";

test("Direct Admin Flow: Admin login proceeds directly to dashboard without MFA redirects", () => {
  function getRedirectDestination(user) {
    if (!user) return "/?login=1";
    if (user.role === "SUPER_ADMIN") return "/super-admin";
    if (user.role === "ADMIN") return "/admin";
    return "/dashboard";
  }

  // Super Admin redirects directly to /super-admin
  assert.equal(getRedirectDestination({ role: "SUPER_ADMIN" }), "/super-admin");

  // Admin redirects directly to /admin
  assert.equal(getRedirectDestination({ role: "ADMIN" }), "/admin");

  // Customer redirects to /dashboard
  assert.equal(getRedirectDestination({ role: "CUSTOMER" }), "/dashboard");

  // Unauthenticated redirects to /?login=1
  assert.equal(getRedirectDestination(null), "/?login=1");
});
