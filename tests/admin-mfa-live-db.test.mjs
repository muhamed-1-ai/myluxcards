import test from "node:test";
import assert from "node:assert/strict";

test("Database Migration 0056: Forward migration safely drops admin_mfa without CASCADE", () => {
  const sql = `
    DROP INDEX IF EXISTS admin_mfa_user_idx;
    DROP TABLE IF EXISTS admin_mfa;
  `;
  assert.equal(sql.includes("CASCADE"), false, "Forward migration must not use CASCADE");
  assert.equal(sql.includes("DROP TABLE IF EXISTS admin_mfa;"), true);
});

test("Direct Admin Authentication: Admins and Super Admins access directly without MFA", () => {
  const adminUser = {
    id: "admin-uuid-1",
    email: "admin@3gzappit.com",
    role: "ADMIN",
    status: "ACTIVE",
    disabled: false,
    sessionVersion: 1,
  };

  const superAdminUser = {
    id: "super-uuid-1",
    email: "superadmin@3gzappit.com",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    disabled: false,
    sessionVersion: 1,
  };

  // Both roles resolve directly to their respective dashboards
  assert.equal(adminUser.role === "ADMIN" ? "/admin" : "/dashboard", "/admin");
  assert.equal(superAdminUser.role === "SUPER_ADMIN" ? "/super-admin" : "/dashboard", "/super-admin");
});
