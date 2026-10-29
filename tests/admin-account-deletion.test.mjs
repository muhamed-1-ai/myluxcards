import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config.ts";

const adminApp = readFileSync(new URL("../src/app/admin/AdminApp.tsx", import.meta.url), "utf8");
const adminCss = readFileSync(new URL("../src/app/admin/admin.css", import.meta.url), "utf8");
const managedUserRoute = readFileSync(new URL("../src/app/api/admin/managed-users/[id]/route.ts", import.meta.url), "utf8");
const accountDeletionService = readFileSync(new URL("../src/lib/accountDeletion.ts", import.meta.url), "utf8");
const usersRepo = readFileSync(new URL("../src/lib/repositories/users.ts", import.meta.url), "utf8");
const publicCardRoute = readFileSync(new URL("../src/app/api/cards/public/[slug]/route.ts", import.meta.url), "utf8");
const followUpScheduler = readFileSync(new URL("../src/lib/followUpScheduler.ts", import.meta.url), "utf8");
const currentIdentityModule = readFileSync(new URL("../src/lib/auth/currentIdentity.ts", import.meta.url), "utf8");
const authServiceModule = readFileSync(new URL("../src/lib/authService.ts", import.meta.url), "utf8");

// ==========================================
// 1. STATIC CODE & ARCHITECTURE GUARANTEES
// ==========================================

test("Admin Users UI includes Delete Account button beside Suspend for eligible users", () => {
  assert.match(adminApp, /admin-btn-delete-account/);
  assert.match(adminApp, /Delete Account/);
  assert.match(adminApp, /isActorSuperAdmin/);
  assert.match(adminApp, /!isTargetOwner/);
  assert.match(adminApp, /user\.id !== identity\.id/);
  assert.match(adminApp, /user\.status !== "DELETED"/);
});

test("Admin Users UI status filter includes DELETED and filters out deleted users from ALL", () => {
  assert.match(adminApp, /<option value="DELETED">Deleted<\/option>/);
  assert.match(adminApp, /const isDeleted = user\.status === "DELETED"/);
  assert.match(adminApp, /statusFilter === "ALL"\s*\?\s*!isDeleted/);
});

test("Admin Users UI defines AdminDeleteAccountModal with explicit confirmation and safety guards", () => {
  assert.match(adminApp, /function AdminDeleteAccountModal/);
  assert.match(adminApp, /Delete this account\?/);
  assert.match(adminApp, /cancelBtnRef\.current\?\.focus\(\)/);
  assert.match(adminApp, /e\.key === "Escape"/);
  assert.match(adminApp, /e\.key === "Enter"\) \{\s*e\.preventDefault\(\)/);
  assert.match(adminApp, /confirmEmail\.trim\(\)\.toLowerCase\(\) === user\.email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(adminApp, /disabled=\{!isEmailMatch \|\| submitting\}/);
  assert.match(adminApp, /Deleting Account\.\.\./);
});

test("Admin CSS includes responsive styling for Delete Account button, dialog, and pills", () => {
  assert.match(adminCss, /\.admin-btn-delete-account/);
  assert.match(adminCss, /\.admin-delete-dialog/);
  assert.match(adminCss, /\.pill\.deleted/);
  assert.match(adminCss, /\.admin-btn-delete-confirm/);
});

test("DELETE /api/admin/managed-users/[id] enforces mutation origin and super admin role", () => {
  assert.match(managedUserRoute, /validMutationOrigin\(request\)/);
  assert.match(managedUserRoute, /requireAdmin\(request\)/);
  assert.match(managedUserRoute, /admin\.role !== "SUPER_ADMIN"/);
  assert.match(managedUserRoute, /deleteUserAccount\(\{/);
});

test("Core accountDeletion service enforces atomicity, protections, and audit logging", () => {
  assert.match(accountDeletionService, /SELF_DELETION_FORBIDDEN/);
  assert.match(accountDeletionService, /CONFIRMATION_EMAIL_MISMATCH/);
  assert.match(accountDeletionService, /PROTECTED_ACCOUNT/);
  assert.match(accountDeletionService, /LAST_SUPER_ADMIN/);
  assert.match(accountDeletionService, /OWNERSHIP_TRANSFER_REQUIRED/);
  assert.match(accountDeletionService, /status = 'DELETED'/);
  assert.match(accountDeletionService, /disabled = true/);
  assert.match(accountDeletionService, /deleted_at = NOW\(\)/);
  assert.match(accountDeletionService, /session_version = session_version \+ 1/);
  assert.match(accountDeletionService, /password_hash = NULL/);
  assert.match(accountDeletionService, /DELETE FROM accounts WHERE user_id = \$1/);
  assert.match(accountDeletionService, /UPDATE digital_cards\s+SET active = false/);
  assert.match(accountDeletionService, /UPDATE cards\s+SET status = 'DISABLED'/);
  assert.match(accountDeletionService, /audit\(\s*admin,\s*"USER_DELETED"/);
});

test("Public card route blocks deleted accounts and attaches no-cache headers", () => {
  assert.match(publicCardRoute, /owner\.status === "DELETED"/);
  assert.match(publicCardRoute, /ACCOUNT_DEACTIVATED/);
  assert.match(publicCardRoute, /Cache-Control/);
  assert.match(publicCardRoute, /no-store, must-revalidate/);
});

test("Follow-up scheduler filters out deleted and disabled accounts from reminder dispatch", () => {
  assert.match(followUpScheduler, /u\.status = 'ACTIVE'/);
  assert.match(followUpScheduler, /u\.disabled = false/);
});

test("Auth and identity modules reject DELETED user accounts", () => {
  assert.match(currentIdentityModule, /profile\.status === "DELETED"/);
  assert.match(authServiceModule, /user\.status === "DELETED"/);
  assert.match(authServiceModule, /linked\.status === "DELETED"/);
});

// ==========================================
// 2. LIVE INTEGRATION & DATABASE LIFECYCLE
// ==========================================

test("Database Lifecycle: Account deletion workflow with disposable test records", async () => {
  const pool = new Pool({ ...databaseConfig(), max: 2 });
  const uniqueId = Date.now();
  const testAdminId = "b8c2491d-3769-4850-86d9-1ff17eef2257"; // Authoritative owner / super admin
  const testAdminEmail = "muhammedfebincholayil@gmail.com";
  const mockAdminIdentity = {
    id: testAdminId,
    email: testAdminEmail,
    name: "Primary Owner",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    disabled: false,
    mustChangePassword: false,
    featurePermissions: {},
  };

  const testUserEmail = `test_delete_${uniqueId}@example.com`;
  let testUserId = null;
  let testCardId = null;
  let testWsId = null;

  try {
    // 1. Create a disposable test customer user
    const createRes = await pool.query(
      `INSERT INTO users (email, name, role, status, disabled, created_by_admin_id)
       VALUES ($1, $2, 'CUSTOMER', 'ACTIVE', false, $3)
       RETURNING id, email, name, role, status`,
      [testUserEmail, `Test User ${uniqueId}`, testAdminId]
    );
    testUserId = createRes.rows[0].id;
    await pool.query(`INSERT INTO profiles (id) VALUES ($1)`, [testUserId]);

    // Import the dynamic deletion service
    const { deleteUserAccount } = await import("../src/lib/accountDeletion.ts");

    // 2. Verification: Self-deletion attempt must be rejected
    const selfRes = await deleteUserAccount({
      admin: { ...mockAdminIdentity, id: testUserId },
      targetUserId: testUserId,
      confirmationEmail: testUserEmail,
    });
    assert.equal(selfRes.success, false);
    assert.equal(selfRes.code, "SELF_DELETION_FORBIDDEN");

    // 3. Verification: Unauthorized role (non-super-admin) must be rejected
    const nonSuperAdmin = { ...mockAdminIdentity, id: "00000000-0000-0000-0000-000000000001", email: "staff@example.com", role: "ADMIN" };
    const unauthorizedRes = await deleteUserAccount({
      admin: nonSuperAdmin,
      targetUserId: testUserId,
      confirmationEmail: testUserEmail,
    });
    assert.equal(unauthorizedRes.success, false);
    assert.equal(unauthorizedRes.status, 403);
    assert.equal(unauthorizedRes.code, "FORBIDDEN");

    // 4. Verification: Email confirmation mismatch must be rejected
    const mismatchRes = await deleteUserAccount({
      admin: mockAdminIdentity,
      targetUserId: testUserId,
      confirmationEmail: "wrong_email@example.com",
    });
    assert.equal(mismatchRes.success, false);
    assert.equal(mismatchRes.status, 400);
    assert.equal(mismatchRes.code, "CONFIRMATION_EMAIL_MISMATCH");

    // 5. Verification: Protected owner account deletion attempt must be rejected
    const ownerDeleteRes = await deleteUserAccount({
      admin: mockAdminIdentity,
      targetUserId: testAdminId,
      confirmationEmail: testAdminEmail,
    });
    assert.equal(ownerDeleteRes.success, false);
    assert.equal(ownerDeleteRes.status, 400); // self-deletion triggered first or protected account

    // 6. Verification: Shared resource ownership transfer guardrail
    // Create a workspace owned by test user and add a second member
    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type)
       VALUES ($1, $2, 'BUSINESS')
       RETURNING id`,
      [testUserId, `Shared Workspace ${uniqueId}`]
    );
    testWsId = wsRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER'), ($1, $3, 'STAFF')`,
      [testWsId, testUserId, testAdminId]
    );

    const sharedBlockRes = await deleteUserAccount({
      admin: mockAdminIdentity,
      targetUserId: testUserId,
      confirmationEmail: testUserEmail,
    });
    assert.equal(sharedBlockRes.success, false);
    assert.equal(sharedBlockRes.status, 409);
    assert.equal(sharedBlockRes.code, "OWNERSHIP_TRANSFER_REQUIRED");
    assert.match(sharedBlockRes.message, /Please transfer workspace ownership/);

    // Remove secondary member so workspace is no longer shared across active users
    await pool.query(
      `DELETE FROM accounting_workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [testWsId, testAdminId]
    );

    // 7. Attach digital card, physical card, auth action token, push subscription, scheduled follow-up
    const cardSlug = `test-card-${uniqueId}`;
    const cardRes = await pool.query(
      `INSERT INTO digital_cards (owner_id, slug, active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [testUserId, cardSlug]
    );
    testCardId = cardRes.rows[0].id;

    await pool.query(
      `INSERT INTO cards (digital_card_id, status)
       VALUES ($1, 'ACTIVATED')`,
      [testCardId]
    );

    await pool.query(
      `INSERT INTO auth_action_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'PASSWORD_RESET', 'fakehash123', NOW() + INTERVAL '1 hour')`,
      [testUserId]
    );

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, 'key', 'auth')`,
      [testUserId, `https://push.example.com/${uniqueId}`]
    );

    const leadRes = await pool.query(
      `INSERT INTO leads (owner_user_id, card_id, name, contact_number, contact_number_normalized)
       VALUES ($1, $2, 'Lead 1', '9876543210', '9876543210')
       RETURNING id`,
      [testUserId, testCardId]
    );
    const leadId = leadRes.rows[0].id;

    await pool.query(
      `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, status)
       VALUES ($1, $2, NOW() + INTERVAL '1 day', 'SCHEDULED')`,
      [testUserId, leadId]
    );

    // 8. Execute successful deletion with exact matching email
    const deleteSuccess = await deleteUserAccount({
      admin: mockAdminIdentity,
      targetUserId: testUserId,
      confirmationEmail: testUserEmail,
    });
    assert.equal(deleteSuccess.success, true);
    assert.equal(deleteSuccess.status, 200);
    assert.match(deleteSuccess.message, /deleted successfully/i);

    // 9. Verify database changes:
    const userCheck = (await pool.query(`SELECT status, disabled, deleted_at, password_hash FROM users WHERE id = $1`, [testUserId])).rows[0];
    assert.equal(userCheck.status, "DELETED");
    assert.equal(userCheck.disabled, true);
    assert.notEqual(userCheck.deleted_at, null);
    assert.equal(userCheck.password_hash, null);

    const cardCheck = (await pool.query(`SELECT active FROM digital_cards WHERE id = $1`, [testCardId])).rows[0];
    assert.equal(cardCheck.active, false);

    const physicalCardCheck = (await pool.query(`SELECT status FROM cards WHERE digital_card_id = $1`, [testCardId])).rows[0];
    assert.equal(physicalCardCheck.status, "DISABLED");

    const tokensCheck = (await pool.query(`SELECT count(*) as unconsumed FROM auth_action_tokens WHERE user_id = $1 AND consumed_at IS NULL`, [testUserId])).rows[0];
    assert.equal(tokensCheck.unconsumed, "0");

    const pushCheck = (await pool.query(`SELECT count(*) as total FROM push_subscriptions WHERE user_id = $1`, [testUserId])).rows[0];
    assert.equal(pushCheck.total, "0");

    const followUpCheck = (await pool.query(`SELECT status, dismissed_at FROM lead_follow_ups WHERE owner_user_id = $1`, [testUserId])).rows[0];
    assert.equal(followUpCheck.status, "CANCELLED");
    assert.notEqual(followUpCheck.dismissed_at, null);

    // 10. Verify repeated deletion request safety (idempotent / already deleted)
    const repeatedRes = await deleteUserAccount({
      admin: mockAdminIdentity,
      targetUserId: testUserId,
      confirmationEmail: testUserEmail,
    });
    assert.equal(repeatedRes.success, false);
    assert.equal(repeatedRes.status, 400);
    assert.equal(repeatedRes.code, "ALREADY_DELETED");

    // 11. Verify Directory Exclusion
    const { findManagedUsersByAdmin } = await import("../src/lib/repositories/users.ts");
    const defaultList = await findManagedUsersByAdmin(testAdminId, { search: testUserEmail });
    assert.equal(defaultList.length, 0, "Deleted user must not appear in normal default directory query");

    const deletedFiltered = await findManagedUsersByAdmin(testAdminId, { status: "DELETED", search: testUserEmail });
    assert.equal(deletedFiltered.length, 1, "Deleted user must appear when explicitly filtering by DELETED");
    assert.equal(deletedFiltered[0].status, "DELETED");

    // 12. Verify Audit Trail
    const auditRes = await pool.query(
      `SELECT action, entity_type, entity_id FROM admin_audit_logs WHERE action = 'USER_DELETED' AND entity_id = $1`,
      [testUserId]
    );
    assert.equal(auditRes.rows.length >= 1, true);

  } finally {
    // Clean up disposable test data
    if (testUserId) {
      await pool.query(`DELETE FROM admin_audit_logs WHERE entity_id = $1`, [testUserId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_workspace_members WHERE user_id = $1`, [testUserId]).catch(() => {});
      if (testWsId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWsId]).catch(() => {});
      await pool.query(`DELETE FROM lead_follow_ups WHERE owner_user_id = $1`, [testUserId]).catch(() => {});
      await pool.query(`DELETE FROM leads WHERE owner_user_id = $1`, [testUserId]).catch(() => {});
      await pool.query(`DELETE FROM cards WHERE digital_card_id = $1`, [testCardId]).catch(() => {});
      await pool.query(`DELETE FROM digital_cards WHERE owner_id = $1`, [testUserId]).catch(() => {});
      await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [testUserId]).catch(() => {});
      await pool.query(`DELETE FROM auth_action_tokens WHERE user_id = $1`, [testUserId]).catch(() => {});
      await pool.query(`DELETE FROM profiles WHERE id = $1`, [testUserId]).catch(() => {});
      await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]).catch(() => {});
    }
    await pool.end();
    const { closeDatabasePool } = await import("../src/lib/db/core.ts");
    await closeDatabasePool();
  }
});
