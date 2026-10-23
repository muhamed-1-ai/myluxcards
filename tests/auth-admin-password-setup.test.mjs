import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

config({ path: ".env" });

const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    path: serverOnlyPath,
    children: [],
    paths: [],
  };
} catch (_) {}

const { databaseConfig } = await import("../src/lib/db/config.ts");
const { authenticateCredentials, linkGoogleIdentity } = await import("../src/lib/authService.ts");
const {
  requestPasswordSetupByAdmin,
  requestPasswordResetByAdmin,
  verifyResetToken,
  redeemResetToken,
  userHasLocalPassword,
  isAccountGoogleOnly,
} = await import("../src/lib/auth/passwordRecovery.ts");
const { findManagedUsersByAdmin } = await import("../src/lib/repositories/users.ts");

const pool = new pg.Pool(databaseConfig());

test("ADMIN PASSWORD SETUP 1: Operational admin sends password setup link to eligible Google-only user", async () => {
  const client = await pool.connect();
  const testAdminId = "00000000-0000-0000-0000-0000000000a1";
  const testAdminEmail = `admin_tester_${Date.now()}@example.com`;
  const googleSub = `google_admin_setup_${Date.now()}`;
  const targetEmail = `google_target_${Date.now()}@testdomain.com`;
  const targetName = "Google Setup Target";

  try {
    // 0. Ensure test admin exists in users table
    await client.query(
      `insert into users (id, email, name, role, status, disabled, feature_permissions)
       values ($1, $2, 'Operational Admin Tester', 'ADMIN', 'ACTIVE', false, '{}'::jsonb)
       on conflict (id) do nothing`,
      [testAdminId, testAdminEmail]
    );

    // 1. Setup target Google-only user
    const linkedUser = await linkGoogleIdentity({
      providerAccountId: googleSub,
      email: targetEmail,
      name: targetName,
    });
    assert.ok(linkedUser.id);
    assert.equal(await userHasLocalPassword(linkedUser.id), false);
    assert.equal(await isAccountGoogleOnly(linkedUser.id), true);

    // 2. Directory query reflects credential status accurately
    const directoryUsers = await findManagedUsersByAdmin(testAdminId, { search: targetEmail }, client);
    const dirUser = directoryUsers.find((u) => u.id === linkedUser.id);
    assert.ok(dirUser, "Target user must appear in admin directory");
    assert.equal(dirUser.has_password, false, "Directory must show has_password = false");
    assert.equal(dirUser.has_google_account, true, "Directory must show has_google_account = true");

    // 3. Admin initiates password setup request
    const setupRes = await requestPasswordSetupByAdmin({
      adminId: testAdminId,
      adminRole: "ADMIN",
      targetUserId: linkedUser.id,
      clientIp: "127.0.0.1",
    });

    // In local test environment without configured RESEND_API_KEY, delivery provider is unconfigured
    assert.ok(setupRes.targetEmail === targetEmail);
    assert.ok(setupRes.status === "sent" || setupRes.status === "unconfigured");

    // 4. Verify token created in database with 15-minute expiry and is_setup flag
    const tokenRow = (
      await client.query(
        `select id, token_hash, expires_at, consumed_at, is_setup, requested_by_admin_id
         from auth_action_tokens
         where user_id = $1 and purpose = 'PASSWORD_RESET'
         order by created_at desc limit 1`,
        [linkedUser.id]
      )
    ).rows[0];

    assert.ok(tokenRow, "auth_action_tokens record must exist");
    assert.equal(tokenRow.consumed_at, null, "Token must be unconsumed");
    assert.equal(tokenRow.is_setup, true, "Token must be flagged as is_setup");
    assert.equal(tokenRow.requested_by_admin_id, testAdminId, "Token must record requesting admin ID");
    assert.ok(new Date(tokenRow.expires_at).getTime() > Date.now(), "Token must be unexpired");

    // 5. Verify audit log entry
    const auditRow = (
      await client.query(
        `select actor_id, action, entity_id, entity_type, after_summary
         from admin_audit_logs
         where entity_id = $1 and action = 'USER_PASSWORD_SETUP_REQUESTED'
         order by created_at desc limit 1`,
        [linkedUser.id]
      )
    ).rows[0];
    assert.ok(auditRow, "Audit log must be recorded for admin setup request");
    assert.equal(auditRow.actor_id, testAdminId);

    // 6. Test non-destructive verification with a known raw token
    const rawToken = randomBytes(32).toString("hex");
    const newHash = createHash("sha256").update(rawToken).digest("hex");
    await client.query("update auth_action_tokens set token_hash = $1 where id = $2", [newHash, tokenRow.id]);

    const verifyCheck = await verifyResetToken(rawToken);
    assert.equal(verifyCheck.valid, true);
    assert.equal(verifyCheck.isSetup, true);
    assert.equal(verifyCheck.userId, linkedUser.id);

    // Token must remain unconsumed after verification
    const checkRow = (await client.query("select consumed_at from auth_action_tokens where id = $1", [tokenRow.id])).rows[0];
    assert.equal(checkRow.consumed_at, null);

    // 7. Complete password establishment
    const newPassword = "PasswordSetup2026!#$";
    const redeemRes = await redeemResetToken(rawToken, newPassword);
    assert.equal(redeemRes.ok, true);

    // 8. Both Google and Credentials login now resolve to the identical user ID
    const credAuth = await authenticateCredentials(targetEmail, newPassword);
    assert.ok(credAuth);
    assert.equal(credAuth.id, linkedUser.id);

    const googleAuth = await linkGoogleIdentity({
      providerAccountId: googleSub,
      email: targetEmail,
      name: targetName,
    });
    assert.equal(googleAuth.id, linkedUser.id);

    // Directory query now reflects password enabled
    const updatedDirUsers = await findManagedUsersByAdmin(testAdminId, { search: targetEmail }, client);
    const updatedDirUser = updatedDirUsers.find((u) => u.id === linkedUser.id);
    assert.equal(updatedDirUser.has_password, true, "Directory must now reflect has_password = true");
    assert.equal(updatedDirUser.has_google_account, true, "Google account association must remain intact");

    // Cleanup
    await client.query("delete from auth_action_tokens where user_id = $1", [linkedUser.id]);
    await client.query("delete from admin_audit_logs where entity_id = $1", [linkedUser.id]);
    await client.query("delete from accounts where user_id = $1", [linkedUser.id]);
    await client.query("delete from profiles where id = $1", [linkedUser.id]);
    await client.query("delete from users where id = $1", [linkedUser.id]);
  } finally {
    client.release();
  }
});

test("ADMIN PASSWORD SETUP 2: Authorization and scope protection - rejects unauthorized, out-of-scope, and protected targets", async () => {
  const client = await pool.connect();
  const ordinaryAdminId = "00000000-0000-0000-0000-0000000000b2";
  const protectedOwnerId = "b8c2491d-3769-4850-86d9-1ff17eef2257";
  const otherAdminId = "00000000-0000-0000-0000-0000000000c3";
  const otherAdminEmail = `admin_${Date.now()}@example.com`;

  try {
    // Ensure ordinaryAdminId exists
    await client.query(
      `insert into users (id, email, name, role, status, disabled, feature_permissions)
       values ($1, $2, 'Ordinary Admin', 'ADMIN', 'ACTIVE', false, '{}'::jsonb)
       on conflict (id) do nothing`,
      [ordinaryAdminId, `ordinary_${Date.now()}@example.com`]
    );

    // 1. Ordinary admin cannot initiate credential setup for the protected primary owner
    const ownerSetupRes = await requestPasswordSetupByAdmin({
      adminId: ordinaryAdminId,
      adminRole: "ADMIN",
      targetUserId: protectedOwnerId,
    });
    assert.equal(ownerSetupRes.ok, false);
    assert.equal(ownerSetupRes.code, "FORBIDDEN");
    assert.match(ownerSetupRes.message, /protected/i);

    // 2. Ordinary admin cannot alter an administrator account
    await client.query(
      `insert into users (id, email, name, role, status, disabled, feature_permissions)
       values ($1, $2, 'Other Admin', 'ADMIN', 'ACTIVE', false, '{}'::jsonb)
       on conflict (id) do nothing`,
      [otherAdminId, otherAdminEmail]
    );

    const adminTargetRes = await requestPasswordSetupByAdmin({
      adminId: ordinaryAdminId,
      adminRole: "ADMIN",
      targetUserId: otherAdminId,
    });
    assert.equal(adminTargetRes.ok, false);
    assert.equal(adminTargetRes.code, "FORBIDDEN");
    assert.match(adminTargetRes.message, /primary owner/i);

    // Cleanup
    await client.query("delete from users where id in ($1, $2)", [ordinaryAdminId, otherAdminId]);
  } finally {
    client.release();
  }
});

test("ADMIN PASSWORD SETUP 3: Rejects accounts that already have local passwords and accounts without Google identity", async () => {
  const client = await pool.connect();
  const adminId = "00000000-0000-0000-0000-0000000000a1";
  const passwordUserEmail = `has_pwd_${Date.now()}@example.com`;
  const nonGoogleEmail = `no_google_${Date.now()}@example.com`;

  try {
    await client.query(
      `insert into users (id, email, name, role, status, disabled, feature_permissions)
       values ($1, $2, 'Admin User Tester', 'ADMIN', 'ACTIVE', false, '{}'::jsonb)
       on conflict (id) do nothing`,
      [adminId, `admin_t3_${Date.now()}@example.com`]
    );
    // 1. Account with existing password
    const pwdHash = await bcrypt.hash("ExistingPass123!@#", 10);
    const pwdUserRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'Password User', $2, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [passwordUserEmail, pwdHash]
    );
    const pwdUserId = pwdUserRes.rows[0].id;

    const setupOnPwdUser = await requestPasswordSetupByAdmin({
      adminId,
      adminRole: "ADMIN",
      targetUserId: pwdUserId,
    });
    assert.equal(setupOnPwdUser.ok, false);
    assert.equal(setupOnPwdUser.code, "PASSWORD_ALREADY_EXISTS");
    assert.match(setupOnPwdUser.message, /already has a password/i);

    // But sending a Reset Link to this user works properly!
    const resetOnPwdUser = await requestPasswordResetByAdmin({
      adminId,
      adminRole: "ADMIN",
      targetUserId: pwdUserId,
    });
    assert.equal(resetOnPwdUser.targetEmail, passwordUserEmail);

    // 2. Account without password and WITHOUT Google identity
    const noGoogleRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'No Google User', null, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [nonGoogleEmail]
    );
    const noGoogleUserId = noGoogleRes.rows[0].id;

    const setupOnNoGoogle = await requestPasswordSetupByAdmin({
      adminId,
      adminRole: "ADMIN",
      targetUserId: noGoogleUserId,
    });
    assert.equal(setupOnNoGoogle.ok, false);
    assert.equal(setupOnNoGoogle.code, "NOT_GOOGLE_USER");

    // Cleanup
    await client.query("delete from auth_action_tokens where user_id in ($1, $2)", [pwdUserId, noGoogleUserId]);
    await client.query("delete from admin_audit_logs where entity_id in ($1, $2)", [pwdUserId, noGoogleUserId]);
    await client.query("delete from users where id in ($1, $2)", [pwdUserId, noGoogleUserId]);
  } finally {
    client.release();
  }
});

test("ADMIN PASSWORD SETUP 4: Recheck eligibility prevents older first-password setup links from overwriting an established password", async () => {
  const client = await pool.connect();
  const testEmail = `overwrite_guard_${Date.now()}@example.com`;

  try {
    // 1. Create Google user without password
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'Overwrite Tester', null, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [testEmail]
    );
    const userId = userRes.rows[0].id;

    // 2. Generate setup token with is_setup = true
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await client.query(
      `insert into auth_action_tokens(user_id, purpose, token_hash, expires_at, is_setup, delivery_status)
       values($1, 'PASSWORD_RESET', $2, now() + interval '15 minutes', true, 'SENT')`,
      [userId, tokenHash]
    );

    // 3. Meanwhile, user establishes a password through another method
    const establishedHash = await bcrypt.hash("AlreadyEstablishedPass123!@#", 10);
    await client.query(
      `update users set password_hash = $1 where id = $2`,
      [establishedHash, userId]
    );

    // 4. Submitting the older setup link MUST be rejected
    const redeemRes = await redeemResetToken(rawToken, "AttackerAttemptingOverwrite123!@#");
    assert.equal(redeemRes.ok, false);
    assert.match(redeemRes.message, /already been established/i);

    // Verify existing password was NOT modified
    const checkUser = (await client.query("select password_hash from users where id = $1", [userId])).rows[0];
    assert.equal(checkUser.password_hash, establishedHash, "Password must not be overwritten by older setup link");

    // Cleanup
    await client.query("delete from auth_action_tokens where user_id = $1", [userId]);
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    client.release();
  }
});

test("ADMIN PASSWORD SETUP 5: Replay attack, concurrency, and session invalidation", async () => {
  const client = await pool.connect();
  const testEmail = `concurrent_setup_${Date.now()}@example.com`;

  try {
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'Concurrent User', null, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [testEmail]
    );
    const userId = userRes.rows[0].id;

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await client.query(
      `insert into auth_action_tokens(user_id, purpose, token_hash, expires_at, is_setup, delivery_status)
       values($1, 'PASSWORD_RESET', $2, now() + interval '15 minutes', true, 'SENT')`,
      [userId, tokenHash]
    );

    // Concurrent submissions of the exact same token
    const [res1, res2] = await Promise.all([
      redeemResetToken(rawToken, "ConcurrentSuccess123!@#"),
      redeemResetToken(rawToken, "ConcurrentSuccess123!@#"),
    ]);

    // Exactly one must succeed, the other must fail
    const successes = [res1, res2].filter((r) => r.ok);
    const failures = [res1, res2].filter((r) => !r.ok);
    assert.equal(successes.length, 1, "Exactly one submission must succeed");
    assert.equal(failures.length, 1, "Concurrent submission must fail");

    // Verify session_version was incremented
    const afterUser = (await client.query("select session_version from users where id = $1", [userId])).rows[0];
    assert.equal(afterUser.session_version, 2);

    // Replay attempt must fail
    const replayRes = await redeemResetToken(rawToken, "AnotherPasswordAttempt123!@#");
    assert.equal(replayRes.ok, false);

    // Cleanup
    await client.query("delete from auth_action_tokens where user_id = $1", [userId]);
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    client.release();
  }
});

test.after(async () => {
  await pool.end().catch(() => {});
  const { pool: dbPool } = await import("../src/lib/db/core.ts");
  await dbPool.end().catch(() => {});
  process.exit(0);
});
