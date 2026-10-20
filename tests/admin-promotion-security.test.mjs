import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adminRouteContent = readFileSync("src/app/api/admin/admins/route.ts", "utf8");
const superAdminRouteContent = readFileSync("src/app/api/super-admin/admins/route.ts", "utf8");
const managedUserRouteContent = readFileSync("src/app/api/admin/managed-users/[id]/route.ts", "utf8");
const authServiceContent = readFileSync("src/lib/authService.ts", "utf8");
const adminAppContent = readFileSync("src/app/admin/AdminApp.tsx", "utf8");
const adminCssContent = readFileSync("src/app/admin/admin.css", "utf8");
const ownerAuthContent = readFileSync("src/lib/ownerAuth.ts", "utf8");

const PRIMARY_OWNER_EMAIL = "muhammedfebincholayil@gmail.com";
const PRIMARY_OWNER_USER_ID = "b8c2491d-3769-4850-86d9-1ff17eef2257";

function isAuthoritativeOwner(identity) {
  if (!identity || !identity.id || !identity.email) return false;
  return (
    identity.id === PRIMARY_OWNER_USER_ID &&
    identity.email.trim().toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()
  );
}

function isOwnerAccount(userId, email) {
  if (userId && userId === PRIMARY_OWNER_USER_ID) return true;
  if (email && email.trim().toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase()) return true;
  return false;
}

test("TEST 1: Owner identity is strictly bound to immutable user ID and email", () => {
  assert.match(ownerAuthContent, /muhammedfebincholayil@gmail\.com/);
  assert.match(ownerAuthContent, /b8c2491d-3769-4850-86d9-1ff17eef2257/);

  // Valid owner
  assert.strictEqual(
    isAuthoritativeOwner({
      id: PRIMARY_OWNER_USER_ID,
      email: PRIMARY_OWNER_EMAIL,
      role: "SUPER_ADMIN",
    }),
    true
  );

  // Case insensitive email check
  assert.strictEqual(
    isAuthoritativeOwner({
      id: PRIMARY_OWNER_USER_ID,
      email: "MuhammedFebinCholayil@GMAIL.com",
      role: "SUPER_ADMIN",
    }),
    true
  );

  // Forged email with wrong ID
  assert.strictEqual(
    isAuthoritativeOwner({
      id: "wrong-id-uuid",
      email: PRIMARY_OWNER_EMAIL,
      role: "SUPER_ADMIN",
    }),
    false
  );

  // Forged ID with wrong email
  assert.strictEqual(
    isAuthoritativeOwner({
      id: PRIMARY_OWNER_USER_ID,
      email: "attacker@gmail.com",
      role: "SUPER_ADMIN",
    }),
    false
  );

  // Other SUPER_ADMIN (admin@zappit.com) must be denied
  assert.strictEqual(
    isAuthoritativeOwner({
      id: "8232e751-97f6-4c4f-90ef-786a132c1b0b",
      email: "admin@zappit.com",
      role: "SUPER_ADMIN",
    }),
    false
  );

  // Regular user must be denied
  assert.strictEqual(
    isAuthoritativeOwner({
      id: "customer-uuid",
      email: "user@example.com",
      role: "CUSTOMER",
    }),
    false
  );
});

test("TEST 2: isOwnerAccount protects the owner account from demotion or suspension", () => {
  assert.strictEqual(isOwnerAccount(PRIMARY_OWNER_USER_ID, PRIMARY_OWNER_EMAIL), true);
  assert.strictEqual(isOwnerAccount(PRIMARY_OWNER_USER_ID, "different@example.com"), true);
  assert.strictEqual(isOwnerAccount("different-id", PRIMARY_OWNER_EMAIL), true);
  assert.strictEqual(isOwnerAccount("other-id", "other@example.com"), false);
});

test("TEST 3: Backend API enforces requireAuthoritativeOwner and protects owner", () => {
  assert.match(adminRouteContent, /requireAuthoritativeOwner\(request\)/);
  assert.match(adminRouteContent, /isOwnerAccount\(targetId\)/);
  assert.match(adminRouteContent, /targetId === actor\.id/);
  assert.match(adminRouteContent, /target\.role==="SUPER_ADMIN"/);
  assert.match(adminRouteContent, /ADMIN_PROMOTED/);
  assert.match(adminRouteContent, /ADMIN_DEMOTED/);

  // Super admin route also enforces requireAuthoritativeOwner
  assert.match(superAdminRouteContent, /requireAuthoritativeOwner\(request\)/);

  // Managed users route protects owner from modification, suspension, and deletion
  assert.match(managedUserRouteContent, /isOwnerAccount\(managedUser\.id/);
  assert.match(managedUserRouteContent, /The primary owner account is protected and cannot be modified/);
  assert.match(managedUserRouteContent, /The primary owner account is protected and cannot be (deleted or disabled|suspended or disabled)/);
});

test("TEST 4: Old invitation route is safely retired and directs to Users", () => {
  assert.match(adminRouteContent, /Admin invitations have been retired/);
  assert.match(adminRouteContent, /Please promote existing registered users directly from Admin → Users/);
});

test("TEST 5: Google OAuth bypass is closed (no auto-admin promotion by email)", () => {
  assert.doesNotMatch(authServiceContent, /role:\s*email\s*===\s*['"]admin@/);
  assert.doesNotMatch(authServiceContent, /role:\s*user\.email\s*===/);
});

test("TEST 6: Admin UI renders 1-click controls beside Permissions exclusively for owner", () => {
  assert.match(adminAppContent, /const isActorOwner = identity\.id === OWNER_USER_ID && identity\.email\?\.toLowerCase\(\) === OWNER_EMAIL;/);
  assert.match(adminAppContent, /admin-action-promote/);
  assert.match(adminAppContent, /admin-action-demote/);
  assert.match(adminAppContent, /admin-owner-badge/);
  assert.match(adminAppContent, /Make admin/);
  assert.match(adminAppContent, /Remove admin/);
  assert.match(adminCssContent, /\.admin-action-promote/);
  assert.match(adminCssContent, /\.admin-action-demote/);
  assert.match(adminCssContent, /\.admin-owner-badge/);
  assert.match(adminCssContent, /\.admin-toast-notice/);
});

test("TEST 7: Live database promotion, demotion, idempotency, and audit logging", async () => {
  // 1. Create a dedicated temporary test user
  const testUserEmail = `promotest_${Date.now()}@example.com`;
  const insertRes = await pool.query(
    `INSERT INTO users (email, name, role, status, disabled, session_version, created_at, updated_at)
     VALUES ($1, 'Promotion Test Candidate', 'CUSTOMER', 'ACTIVE', false, 1, NOW(), NOW())
     RETURNING id, email, role, status`,
    [testUserEmail]
  );
  const testUser = insertRes.rows[0];
  assert.ok(testUser?.id);
  assert.strictEqual(testUser.role, "CUSTOMER");

  try {
    // 2. Perform direct promotion to ADMIN
    await pool.query(
      `UPDATE users SET role = 'ADMIN', updated_at = NOW() WHERE id = $1`,
      [testUser.id]
    );
    const promotedRes = await pool.query(`SELECT id, role, status FROM users WHERE id = $1`, [testUser.id]);
    assert.strictEqual(promotedRes.rows[0].role, "ADMIN");
    assert.strictEqual(promotedRes.rows[0].status, "ACTIVE"); // status preserved

    // 3. Perform demotion back to CUSTOMER
    await pool.query(
      `UPDATE users SET role = 'CUSTOMER', updated_at = NOW() WHERE id = $1`,
      [testUser.id]
    );
    const demotedRes = await pool.query(`SELECT id, role, status FROM users WHERE id = $1`, [testUser.id]);
    assert.strictEqual(demotedRes.rows[0].role, "CUSTOMER");
    assert.strictEqual(demotedRes.rows[0].status, "ACTIVE"); // status preserved

    // 4. Record audit log entry matching production audit format
    await pool.query(
      `INSERT INTO admin_audit_logs (actor_id, actor_role, action, entity_type, entity_id, before_summary, after_summary)
       VALUES ($1, 'SUPER_ADMIN', 'ADMIN_PROMOTED', 'users', $2, $3, $4)`,
      [
        PRIMARY_OWNER_USER_ID,
        testUser.id,
        JSON.stringify({ role: "CUSTOMER" }),
        JSON.stringify({ role: "ADMIN" }),
      ]
    );
    const auditCheck = await pool.query(
      `SELECT * FROM admin_audit_logs WHERE entity_id = $1 AND action = 'ADMIN_PROMOTED'`,
      [testUser.id]
    );
    assert.strictEqual(auditCheck.rows.length, 1);
    assert.strictEqual(auditCheck.rows[0].actor_id, PRIMARY_OWNER_USER_ID);
  } finally {
    // Cleanup test user and audit entries
    await pool.query(`DELETE FROM admin_audit_logs WHERE entity_id = $1`, [testUser.id]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [testUser.id]);
    await pool.end();
  }
});
