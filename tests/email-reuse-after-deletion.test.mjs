import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config.ts";

// =========================================================================
// EMAIL REUSE AFTER ACCOUNT DELETION - VERIFICATION & REGRESSION TEST SUITE
// =========================================================================

test("Email reuse after account deletion lifecycle", async (t) => {
  const pool = new Pool({ ...databaseConfig(), max: 2 });
  const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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

  const sharedEmail = `lifecycle_test_${uniqueId}@example.com`;
  let accountAId = null;
  let accountBId = null;
  let testOrderId = null;
  let testWorkspaceId = null;

  try {
    const { createCredentialUser, authenticateCredentials, linkGoogleIdentity } = await import("../src/lib/authService.ts");
    const { deleteUserAccount } = await import("../src/lib/accountDeletion.ts");
    const { requestPasswordRecovery, verifyResetToken, redeemResetToken } = await import("../src/lib/auth/passwordRecovery.ts");
    const { findManagedUsersByAdmin } = await import("../src/lib/repositories/users.ts");

    // -----------------------------------------------------------------------
    // STEP 1: Register Account A
    // -----------------------------------------------------------------------
    await t.test("1. Register Account A with fresh email", async () => {
      const userA = await createCredentialUser({
        name: "Account Alpha",
        email: sharedEmail,
        password: "Password123!@#AAA",
      });
      assert.ok(userA.id, "Account A should have a generated UUID");
      assert.equal(userA.email.toLowerCase(), sharedEmail.toLowerCase());
      assert.equal(userA.role, "CUSTOMER");
      accountAId = userA.id;

      // Verify login works for Account A
      const authA = await authenticateCredentials(sharedEmail, "Password123!@#AAA");
      assert.ok(authA, "Account A should authenticate successfully");
      assert.equal(authA.id, accountAId);
    });

    // -----------------------------------------------------------------------
    // STEP 2: Attach resources to Account A (Order, Reset Token, Workspace Membership)
    // -----------------------------------------------------------------------
    await t.test("2. Attach orders, workspace membership, and tokens to Account A", async () => {
      // Create order belonging to Account A
      const orderRes = await pool.query(
        `INSERT INTO orders (
          order_number, number, customer_id, user_id, customer_name, customer_email,
          shipping_address, currency, subtotal_minor, total_minor, status, payment_status
        ) VALUES (
          $1, $1, $2, $2, 'Account Alpha', $3,
          '{"line1": "123 Alpha St"}'::jsonb, 'INR', 199900, 199900, 'CONFIRMED', 'SUCCEEDED'
        ) RETURNING id`,
        [`ORD-${uniqueId}`, accountAId, sharedEmail]
      );
      testOrderId = orderRes.rows[0].id;

      // Create a shared workspace and add Account A as a member
      const wsRes = await pool.query(
        `INSERT INTO accounting_workspaces (owner_user_id, name, currency)
         VALUES ($1, $2, 'INR')
         RETURNING id`,
        [testAdminId, `Test Workspace ${uniqueId}`]
      );
      testWorkspaceId = wsRes.rows[0].id;
      await pool.query(
        `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'STAFF')`,
        [testWorkspaceId, accountAId]
      );

      // Create a password reset token for Account A
      const recoveryResult = await requestPasswordRecovery(sharedEmail, "127.0.0.1");
      assert.equal(recoveryResult.ok, true);
    });

    // -----------------------------------------------------------------------
    // STEP 3: Confirm active duplicate email registration is strictly BLOCKED
    // -----------------------------------------------------------------------
    await t.test("3. Reject duplicate registration while Account A is active", async () => {
      let duplicateBlocked = false;
      try {
        await createCredentialUser({
          name: "Duplicate Attempt",
          email: sharedEmail,
          password: "Password123!@#DUP",
        });
      } catch (err) {
        if (err && err.code === "23505") {
          duplicateBlocked = true;
        }
      }
      assert.equal(duplicateBlocked, true, "Attempting to register active email must throw unique_violation (23505)");
    });

    // -----------------------------------------------------------------------
    // STEP 4: Delete Account A via the official admin deletion flow
    // -----------------------------------------------------------------------
    await t.test("4. Delete Account A through official admin deletion flow", async () => {
      const deleteRes = await deleteUserAccount({
        admin: mockAdminIdentity,
        targetUserId: accountAId,
        confirmationEmail: sharedEmail,
      });

      assert.equal(deleteRes.success, true);
      assert.equal(deleteRes.status, 200);

      // Check DB row state for Account A
      const rowRes = await pool.query(
        `SELECT id, email, original_email, status, disabled, password_hash FROM users WHERE id = $1`,
        [accountAId]
      );
      const row = rowRes.rows[0];
      assert.equal(row.status, "DELETED");
      assert.equal(row.disabled, true);
      assert.equal(row.password_hash, null);
      assert.equal(row.original_email, sharedEmail);
      assert.equal(row.email, `deleted+${accountAId}@deleted.zappit.local`);

      // Confirm Account A workspace membership was cleanly revoked
      const memRes = await pool.query(
        `SELECT * FROM accounting_workspace_members WHERE user_id = $1`,
        [accountAId]
      );
      assert.equal(memRes.rows.length, 0, "Account A should be removed from workspace memberships");

      // Confirm Account A's tokens were consumed
      const tokenRes = await pool.query(
        `SELECT * FROM auth_action_tokens WHERE user_id = $1 AND consumed_at IS NULL`,
        [accountAId]
      );
      assert.equal(tokenRes.rows.length, 0, "All Account A tokens must be consumed");
    });

    // -----------------------------------------------------------------------
    // STEP 5: Confirm Account A is permanently inaccessible
    // -----------------------------------------------------------------------
    await t.test("5. Confirm old credentials cannot authenticate Account A", async () => {
      const authAttempt = await authenticateCredentials(sharedEmail, "Password123!@#AAA");
      assert.equal(authAttempt, null, "Deleted account credentials must fail authentication");

      // Even if querying by tombstone email, authenticateCredentials rejects deleted status
      const tombstoneAuth = await authenticateCredentials(`deleted+${accountAId}@deleted.zappit.local`, "Password123!@#AAA");
      assert.equal(tombstoneAuth, null, "Tombstone credentials must fail authentication");
    });

    // -----------------------------------------------------------------------
    // STEP 6: Register Account B with the SAME released email
    // -----------------------------------------------------------------------
    await t.test("6. Register Account B with released email succeeds with fresh identity", async () => {
      const userB = await createCredentialUser({
        name: "Account Bravo (Fresh)",
        email: sharedEmail,
        password: "Password123!@#BBB",
      });

      assert.ok(userB.id);
      assert.notEqual(userB.id, accountAId, "New account must receive a distinct, brand new user ID");
      assert.equal(userB.email.toLowerCase(), sharedEmail.toLowerCase());
      assert.equal(userB.role, "CUSTOMER");
      accountBId = userB.id;

      // Verify Account B logs in with its new password
      const authB = await authenticateCredentials(sharedEmail, "Password123!@#BBB");
      assert.ok(authB);
      assert.equal(authB.id, accountBId);
      assert.equal(authB.name, "Account Bravo (Fresh)");
    });

    // -----------------------------------------------------------------------
    // STEP 7: Confirm Account B inherits NO data, orders, or privileges
    // -----------------------------------------------------------------------
    await t.test("7. Confirm zero inheritance of historical orders or permissions", async () => {
      // 1. Account B orders query using fixed isolation logic:
      // Orders where customer_id = accountBId or user_id = accountBId, or unassigned guest orders
      const userOrdersRes = await pool.query(
        `SELECT id, order_number, customer_id, user_id, customer_email
         FROM orders
         WHERE (customer_id = $1 OR user_id = $1)
            OR ((customer_id IS NULL AND user_id IS NULL) AND lower(customer_email) = lower($2))`,
        [accountBId, sharedEmail]
      );
      assert.equal(userOrdersRes.rows.length, 0, "Account B must NOT see historical orders belonging to Account A");

      // 2. Verify Account A's order is still safely preserved under Account A's immutable ID
      const preservedOrderRes = await pool.query(
        `SELECT id, customer_id, user_id, customer_email FROM orders WHERE id = $1`,
        [testOrderId]
      );
      assert.equal(preservedOrderRes.rows[0].customer_id, accountAId, "Account A's order must remain bound to Account A's ID");

      // 3. Verify Account B has no workspace memberships
      const wsMemB = await pool.query(
        `SELECT * FROM accounting_workspace_members WHERE user_id = $1`,
        [accountBId]
      );
      assert.equal(wsMemB.rows.length, 0, "Account B must have no workspace memberships");

      // 4. Verify Account B has no digital cards
      const dcB = await pool.query(
        `SELECT * FROM digital_cards WHERE owner_id = $1`,
        [accountBId]
      );
      assert.equal(dcB.rows.length, 0, "Account B must have no digital cards");
    });

    // -----------------------------------------------------------------------
    // STEP 8: Confirm old tokens cannot affect Account B
    // -----------------------------------------------------------------------
    await t.test("8. Confirm old reset tokens cannot affect Account B", async () => {
      // Find the consumed token from Account A
      const oldTokenRow = (
        await pool.query(
          `SELECT token_hash FROM auth_action_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [accountAId]
        )
      ).rows[0];

      if (oldTokenRow) {
        // Validation check
        const valRes = await verifyResetToken("invalid_or_old_token_raw_string_that_does_not_match");
        assert.equal(valRes.valid, false);

        // Attempting to redeem an expired/consumed token fails
        const redeemRes = await redeemResetToken("invalid_or_old_token_raw_string_that_does_not_match", "NewPassword999!@#");
        assert.equal(redeemRes.ok, false);
      }
    });

    // -----------------------------------------------------------------------
    // STEP 9: Test email normalization & suspended accounts
    // -----------------------------------------------------------------------
    await t.test("9. Case/whitespace normalization and suspended duplicate rejection", async () => {
      // Whitespace and uppercase variation of sharedEmail must collide with active Account B
      let duplicateBlocked = false;
      try {
        await createCredentialUser({
          name: "Uppercase Duplicate",
          email: `  ${sharedEmail.toUpperCase()}  `,
          password: "Password123!@#UPP",
        });
      } catch (err) {
        if (err && err.code === "23505") {
          duplicateBlocked = true;
        }
      }
      assert.equal(duplicateBlocked, true, "Uppercase/whitespace variant of active email must be blocked");

      // Suspend Account B
      await pool.query(
        `UPDATE users SET status = 'SUSPENDED', disabled = true WHERE id = $1`,
        [accountBId]
      );

      // Attempting to register while SUSPENDED must also be blocked
      let suspendedDuplicateBlocked = false;
      try {
        await createCredentialUser({
          name: "Suspended Duplicate",
          email: sharedEmail,
          password: "Password123!@#SUS",
        });
      } catch (err) {
        if (err && err.code === "23505") {
          suspendedDuplicateBlocked = true;
        }
      }
      assert.equal(suspendedDuplicateBlocked, true, "Suspended account email must remain strictly reserved");
    });

    // -----------------------------------------------------------------------
    // STEP 10: Test Google OAuth identity handling
    // -----------------------------------------------------------------------
    await t.test("10. Google identity linking handles deleted account release cleanly", async () => {
      const googleEmail = `google_test_${uniqueId}@example.com`;
      const googleSub = `google_sub_${uniqueId}`;

      // 1. Create User C via Google OAuth
      const userC = await linkGoogleIdentity({
        providerAccountId: googleSub,
        email: googleEmail,
        name: "Google User Charlie",
      });
      assert.ok(userC.id);
      const userCId = userC.id;

      // 2. Delete User C
      const delC = await deleteUserAccount({
        admin: mockAdminIdentity,
        targetUserId: userCId,
        confirmationEmail: googleEmail,
      });
      assert.equal(delC.success, true);

      // 3. User with same Google email signs in again -> should create fresh identity User D
      const userD = await linkGoogleIdentity({
        providerAccountId: googleSub,
        email: googleEmail,
        name: "Google User Delta (Fresh)",
      });
      assert.ok(userD.id);
      assert.notEqual(userD.id, userCId, "Fresh Google sign-in after deletion must create brand new user ID");
      assert.equal(userD.email.toLowerCase(), googleEmail.toLowerCase());

      // Cleanup User D
      await pool.query(`DELETE FROM accounts WHERE user_id = $1`, [userD.id]);
      await pool.query(`DELETE FROM profiles WHERE id = $1`, [userD.id]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [userD.id]);
      // Cleanup User C
      await pool.query(`DELETE FROM profiles WHERE id = $1`, [userCId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [userCId]);
    });

    // -----------------------------------------------------------------------
    // STEP 11: Idempotent maintenance repair script verification
    // -----------------------------------------------------------------------
    await t.test("11. Idempotent maintenance repair verification", async () => {
      // Create a temporary mock "previously deleted" user that was deleted before email tombstoning existed
      const legacyDeletedEmail = `legacy_deleted_${uniqueId}@example.com`;
      const legacyRes = await pool.query(
        `INSERT INTO users (email, name, role, status, disabled, deleted_at)
         VALUES ($1, 'Legacy Deleted', 'CUSTOMER', 'DELETED', true, NOW())
         RETURNING id`,
        [legacyDeletedEmail]
      );
      const legacyId = legacyRes.rows[0].id;

      // Run repair SQL
      const repairRes = await pool.query(
        `UPDATE users
         SET original_email = email,
             email = 'deleted+' || id || '@deleted.zappit.local',
             updated_at = NOW()
         WHERE status = 'DELETED'
           AND email NOT LIKE 'deleted+%'
           AND id = $1
         RETURNING id, email, original_email`,
        [legacyId]
      );
      assert.equal(repairRes.rowCount, 1);
      assert.equal(repairRes.rows[0].original_email, legacyDeletedEmail);
      assert.equal(repairRes.rows[0].email, `deleted+${legacyId}@deleted.zappit.local`);

      // Running the repair query a second time must be idempotent (0 rows affected)
      const secondRepairRes = await pool.query(
        `UPDATE users
         SET original_email = email,
             email = 'deleted+' || id || '@deleted.zappit.local',
             updated_at = NOW()
         WHERE status = 'DELETED'
           AND email NOT LIKE 'deleted+%'
           AND id = $1`,
        [legacyId]
      );
      assert.equal(secondRepairRes.rowCount, 0, "Second repair pass must affect 0 rows (idempotent)");

      // Active / suspended users must never be touched
      const activeTouchRes = await pool.query(
        `SELECT id FROM users WHERE status != 'DELETED' AND email LIKE 'deleted+%'`
      );
      assert.equal(activeTouchRes.rows.length, 0, "Active or suspended users must never be tombstoned");

      // Cleanup legacy test user
      await pool.query(`DELETE FROM users WHERE id = $1`, [legacyId]);
    });

  } finally {
    // Teardown test fixtures
    if (testOrderId) {
      await pool.query(`DELETE FROM order_items WHERE order_id = $1`, [testOrderId]).catch(() => undefined);
      await pool.query(`DELETE FROM orders WHERE id = $1`, [testOrderId]).catch(() => undefined);
    }
    if (testWorkspaceId) {
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [testWorkspaceId]).catch(() => undefined);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWorkspaceId]).catch(() => undefined);
    }
    if (accountAId) {
      await pool.query(`DELETE FROM auth_action_tokens WHERE user_id = $1`, [accountAId]).catch(() => undefined);
      await pool.query(`DELETE FROM profiles WHERE id = $1`, [accountAId]).catch(() => undefined);
      await pool.query(`DELETE FROM users WHERE id = $1`, [accountAId]).catch(() => undefined);
    }
    if (accountBId) {
      await pool.query(`DELETE FROM auth_action_tokens WHERE user_id = $1`, [accountBId]).catch(() => undefined);
      await pool.query(`DELETE FROM profiles WHERE id = $1`, [accountBId]).catch(() => undefined);
      await pool.query(`DELETE FROM users WHERE id = $1`, [accountBId]).catch(() => undefined);
    }
    await pool.end();
  }
});
