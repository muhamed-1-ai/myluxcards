import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Routes 1: Admin and Super Admin guards operate directly without MFA", () => {
  const adminAuthCode = readFileSync("src/lib/adminAuth.ts", "utf8");
  const ownerAuthCode = readFileSync("src/lib/ownerAuth.ts", "utf8");

  // MFA check must be completely removed from requireAdmin
  assert.equal(adminAuthCode.includes("isSessionMfaVerified"), false, "isSessionMfaVerified must not be present in adminAuth.ts");
  assert.equal(adminAuthCode.includes("getAdminMfaStatus"), false, "getAdminMfaStatus must not be present in adminAuth.ts");

  // requireAdminPage and requireSuperAdminPage must not redirect to /admin/mfa
  assert.equal(adminAuthCode.includes("/admin/mfa/enroll"), false, "requireAdminPage must not redirect to /admin/mfa/enroll");
  assert.equal(adminAuthCode.includes("/admin/mfa/verify"), false, "requireAdminPage must not redirect to /admin/mfa/verify");

  // requireAuthoritativeOwner must not check MFA
  assert.equal(ownerAuthCode.includes("isSessionMfaVerified"), false, "isSessionMfaVerified must not be in ownerAuth.ts");
  assert.equal(ownerAuthCode.includes("MFA verification required"), false, "MFA error must not be in ownerAuth.ts");
});

test("Routes 2: Old MFA APIs are retired and return 410 Gone", () => {
  const setupRoute = readFileSync("src/app/api/admin/mfa/setup/route.ts", "utf8");
  const confirmRoute = readFileSync("src/app/api/admin/mfa/confirm/route.ts", "utf8");
  const verifyRoute = readFileSync("src/app/api/admin/mfa/verify/route.ts", "utf8");
  const statusRoute = readFileSync("src/app/api/admin/mfa/status/route.ts", "utf8");

  // All 4 retired routes must return status 410
  assert.match(setupRoute, /status:\s*410/);
  assert.match(confirmRoute, /status:\s*410/);
  assert.match(verifyRoute, /status:\s*410/);
  assert.match(statusRoute, /status:\s*410/);

  // All 4 routes clear the legacy zappit_admin_mfa cookie
  assert.match(setupRoute, /zappit_admin_mfa/);
  assert.match(confirmRoute, /zappit_admin_mfa/);
  assert.match(verifyRoute, /zappit_admin_mfa/);
  assert.match(statusRoute, /zappit_admin_mfa/);

  // Must not contain secret generation or TOTP confirmation
  assert.equal(setupRoute.includes("generateMfaEnrollmentSetup"), false);
  assert.equal(confirmRoute.includes("confirmMfaEnrollment"), false);
  assert.equal(verifyRoute.includes("verifyAdminMfaCodeOrRecovery"), false);
});

test("Routes 3: Old MFA pages safely redirect authorized admins to dashboards", () => {
  const enrollPage = readFileSync("src/app/admin/mfa/enroll/page.tsx", "utf8");
  const verifyPage = readFileSync("src/app/admin/mfa/verify/page.tsx", "utf8");

  // Pages must use server-side redirect, not client-side QR forms
  assert.match(enrollPage, /redirect\(/);
  assert.match(verifyPage, /redirect\(/);

  // Must enforce authentication and role checks before redirect
  assert.match(enrollPage, /currentIdentity/);
  assert.match(verifyPage, /currentIdentity/);

  // Must prevent redirect loops back to /admin/mfa
  assert.match(enrollPage, /!trimmed\.startsWith\("\/admin\/mfa"\)/);
  assert.match(verifyPage, /!trimmed\.startsWith\("\/admin\/mfa"\)/);
});

test("Routes 4: Forward migration removes admin_mfa table without CASCADE", () => {
  const migration0056 = readFileSync("db/migrations/0056_remove_admin_mfa.sql", "utf8");
  assert.match(migration0056, /DROP TABLE IF EXISTS admin_mfa;/);
  assert.equal(/DROP TABLE[^\n;]+CASCADE/i.test(migration0056), false, "Migration 0056 must not use DROP TABLE ... CASCADE");
});
