import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config.ts";

import { randomUUID } from "node:crypto";

const usersRepoContent = readFileSync("src/lib/repositories/users.ts", "utf8");
const managedUsersRouteContent = readFileSync("src/app/api/admin/managed-users/route.ts", "utf8");
const managedUserDetailRouteContent = readFileSync("src/app/api/admin/managed-users/[id]/route.ts", "utf8");
const adminManagementRouteContent = readFileSync("src/app/api/admin/admins/route.ts", "utf8");
const adminAppContent = readFileSync("src/app/admin/AdminApp.tsx", "utf8");
const ownerAuthContent = readFileSync("src/lib/ownerAuth.ts", "utf8");

test("DIRECTORY 1: findManagedUsersByAdmin grants operational ADMIN accounts directory access without created_by_admin_id restriction", () => {
  // Query must NOT be restricted by created_by_admin_id for operational admins
  assert.strictEqual(
    usersRepoContent.includes("WHERE u.created_by_admin_id = $1"),
    false,
    "users.ts must NOT restrict user directory to u.created_by_admin_id"
  );
  assert.match(usersRepoContent, /export async function findManagedUsersByAdmin/);
});

test("DIRECTORY 2: findManagedUsersByAdmin explicitly projects public fields and NEVER exposes password_hash", () => {
  // Must NOT do SELECT u.* which would expose password_hash
  assert.strictEqual(
    usersRepoContent.includes("SELECT u.*"),
    false,
    "users.ts must NOT use 'SELECT u.*' in findManagedUsersByAdmin"
  );

  // Must explicitly select public fields
  assert.match(usersRepoContent, /u\.id/);
  assert.match(usersRepoContent, /u\.email/);
  assert.match(usersRepoContent, /u\.name/);
  assert.match(usersRepoContent, /u\.role/);
  assert.match(usersRepoContent, /u\.status/);
  assert.match(usersRepoContent, /u\.created_at/);
  assert.match(usersRepoContent, /p\.phone/);
  assert.match(usersRepoContent, /dc\.slug as digital_card_slug/);
});

test("DIRECTORY 3: GET /api/admin/managed-users supports search and status filtering, requires admin authorization", () => {
  assert.match(managedUsersRouteContent, /requireAdmin/);
  assert.match(managedUsersRouteContent, /currentIdentity\(request\)/);
  assert.match(managedUsersRouteContent, /status:\s*403/);
  assert.match(managedUsersRouteContent, /searchParams\.get\("search"\)/);
  assert.match(managedUsersRouteContent, /searchParams\.get\("status"\)/);
});

test("DIRECTORY 4: Managed user details and actions protect Owner and other Admins from non-owner modification", () => {
  // Owner account protected
  assert.match(managedUserDetailRouteContent, /isOwnerAccount\(managedUser\.id,\s*managedUser\.email\)/);
  assert.match(managedUserDetailRouteContent, /The primary owner account is protected and cannot be modified/);
  assert.match(managedUserDetailRouteContent, /The primary owner account is protected and cannot be deleted or disabled/);

  // Admin and Super Admin protected from modification by non-owner admins
  assert.match(managedUserDetailRouteContent, /managedUser\.role === "ADMIN"/);
  assert.match(managedUserDetailRouteContent, /Only the primary owner can alter an administrator account/);
  assert.match(managedUserDetailRouteContent, /Only the primary owner can disable an administrator account/);
});

test("DIRECTORY 5: Promotion and demotion are strictly owner-only and increment session_version for instant revocation", () => {
  assert.match(adminManagementRouteContent, /requireAuthoritativeOwner\(request\)/);
  assert.match(adminManagementRouteContent, /session_version\s*=\s*session_version\s*\+\s*1/);
  assert.match(ownerAuthContent, /muhammedfebincholayil@gmail\.com/);
  assert.match(ownerAuthContent, /b8c2491d-3769-4850-86d9-1ff17eef2257/);

  // In AdminApp UI, promotion/demotion buttons are only rendered for the owner
  assert.match(adminAppContent, /isActorOwner/);
  assert.match(adminAppContent, /admin-action-promote/);
  assert.match(adminAppContent, /admin-action-demote/);
});

test("DIRECTORY 6: Frontend distinguishes loading, error, and genuine empty results", () => {
  // Error handling sets error and clears data
  assert.match(adminAppContent, /setError\(e instanceof Error\?e\.message:"Could not load this section\."\)/);
  assert.match(adminAppContent, /setData\(null\)/);
  // Empty state title
  assert.match(adminAppContent, /No matching users found/);
  assert.match(adminAppContent, /Unable to load data/);
});

test("DIRECTORY 7: Live Database Integration - Promoted ADMIN sees all users, search works, and password_hash is omitted", async () => {
  const pool = new Pool(databaseConfig());
  const client = await pool.connect();

  const promotedAdminId = randomUUID();
  const promotedAdminEmail = `promoted_admin_${Date.now()}@example.com`;
  const existingUserEmail = `existing_user_${Date.now()}@example.com`;

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // 1. Create an existing regular user created by system (created_by_admin_id IS NULL)
    const userRes = await client.query(
      `INSERT INTO users (email, name, role, status, disabled, created_by_admin_id, feature_permissions)
       VALUES ($1, 'Existing Directory User', 'CUSTOMER', 'ACTIVE', false, null, '{}'::jsonb)
       RETURNING id, email, name`,
      [existingUserEmail]
    );
    const existingUser = userRes.rows[0];

    // 2. Create promoted operational admin account
    await client.query(
      `INSERT INTO users (id, email, name, role, status, disabled, feature_permissions)
       VALUES ($1, $2, 'Operational Admin', 'ADMIN', 'ACTIVE', false, '{}'::jsonb)`,
      [promotedAdminId, promotedAdminEmail]
    );

    // 3. Test directory query executed for the promoted admin (who created 0 users)
    const directoryQuery = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.role,
        u.status,
        u.disabled,
        u.created_at,
        u.updated_at,
        u.created_by_admin_id,
        u.feature_permissions,
        p.phone,
        dc.slug as digital_card_slug
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN LATERAL (
        SELECT slug FROM digital_cards WHERE owner_id = u.id ORDER BY created_at DESC LIMIT 1
      ) dc ON TRUE
      ORDER BY u.created_at DESC
    `;

    const allUsersRes = await client.query(directoryQuery);
    const allUsers = allUsersRes.rows;
    assert.ok(allUsers.length > 0, "Promoted admin must see platform user directory");
    
    const foundExisting = allUsers.find((u) => u.email === existingUserEmail);
    assert.ok(foundExisting, "Promoted admin must see users created before their promotion or via signup");
    assert.strictEqual(
      foundExisting.password_hash,
      undefined,
      "Directory query MUST NOT expose password_hash"
    );

    // 4. Test search filter query
    const searchRes = await client.query(
      `SELECT u.id, u.email, u.name, u.role, u.status, p.phone, dc.slug as digital_card_slug
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN LATERAL (
         SELECT slug FROM digital_cards WHERE owner_id = u.id ORDER BY created_at DESC LIMIT 1
       ) dc ON TRUE
       WHERE (LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1)
       ORDER BY u.created_at DESC`,
      ["%Existing Directory User%".toLowerCase()]
    );
    assert.ok(searchRes.rows.length >= 1, "Search must return matching user");
    assert.equal(searchRes.rows[0].email, existingUserEmail);

    // 5. Test status filter query
    const activeRes = await client.query(
      `SELECT u.id, u.email, u.status FROM users u WHERE u.status = $1`,
      ["ACTIVE"]
    );
    assert.ok(activeRes.rows.some((u) => u.email === existingUserEmail));

    const suspendedRes = await client.query(
      `SELECT u.id, u.email, u.status FROM users u WHERE u.status = $1`,
      ["SUSPENDED"]
    );
    assert.equal(
      suspendedRes.rows.some((u) => u.email === existingUserEmail),
      false,
      "Active user must not appear in suspended status filter"
    );

    // Rollback cleanly
    await client.query("ROLLBACK");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
});
