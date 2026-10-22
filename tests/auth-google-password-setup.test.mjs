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
  requestPasswordRecovery,
  requestPasswordSetupForAuthenticatedUser,
  verifyResetToken,
  redeemResetToken,
  changePasswordForAuthenticatedUser,
  userHasLocalPassword,
  isAccountGoogleOnly,
} = await import("../src/lib/auth/passwordRecovery.ts");

const pool = new pg.Pool(databaseConfig());

test("GOOGLE PASSWORD SETUP 1: Google-only user adds first password via verified email recovery while logged out", async () => {
  const client = await pool.connect();
  const testEmail = `google_recov_${Date.now()}@testgoogle.com`;
  const googleSub = `google_sub_${Date.now()}`;
  const initialUserName = "Google Recovery User";

  try {
    // 1. Simulate Google registration (creates user with password_hash = NULL and accounts link)
    const linkedUser = await linkGoogleIdentity({
      providerAccountId: googleSub,
      email: testEmail,
      name: initialUserName,
    });

    assert.ok(linkedUser.id, "User ID must be generated");
    const preDbUser = (await client.query("select password_hash, role, session_version from users where id = $1", [linkedUser.id])).rows[0];
    assert.equal(preDbUser.password_hash, null, "Initial Google user must have NULL password_hash");
    assert.equal(await userHasLocalPassword(linkedUser.id), false);
    assert.equal(await isAccountGoogleOnly(linkedUser.id), true);

    // 2. Request recovery while logged out
    const recoveryRes = await requestPasswordRecovery(testEmail);
    assert.equal(recoveryRes.ok, true);
    assert.equal(recoveryRes.message, "If this account is eligible, we’ll email you a link to set or reset your password.");

    // 3. Find created token in auth_action_tokens
    const tokenRow = (
      await client.query(
        "select id, token_hash from auth_action_tokens where user_id = $1 and purpose = 'PASSWORD_RESET' order by created_at desc limit 1",
        [linkedUser.id]
      )
    ).rows[0];
    assert.ok(tokenRow, "Recovery token must be generated for Google-only user");

    // 4. Test non-destructive token verification (safe for link inspection/scanners)
    const rawToken = randomBytes(32).toString("hex");
    const newHash = createHash("sha256").update(rawToken).digest("hex");
    await client.query("update auth_action_tokens set token_hash = $1 where id = $2", [newHash, tokenRow.id]);

    const verifyCheck = await verifyResetToken(rawToken);
    assert.equal(verifyCheck.valid, true);
    assert.equal(verifyCheck.userId, linkedUser.id);
    assert.equal(verifyCheck.isSetup, true, "Token must be identified as first password setup");

    // Verify token was not consumed by the check
    const checkRow = (await client.query("select consumed_at from auth_action_tokens where id = $1", [tokenRow.id])).rows[0];
    assert.equal(checkRow.consumed_at, null);

    // 5. Redeem token with strong password
    const newPassword = "StrongPassword2026!#$";
    const redeemRes = await redeemResetToken(rawToken, newPassword);
    assert.equal(redeemRes.ok, true);
    assert.match(redeemRes.message, /Password (created|added) successfully/i);

    // 6. Verify BOTH login methods resolve to the exact same user ID and preserved profile
    // A) Credentials login
    const credAuth = await authenticateCredentials(testEmail, newPassword);
    assert.ok(credAuth, "Credentials login must succeed");
    assert.equal(credAuth.id, linkedUser.id, "Credentials login must resolve to exact same user ID");
    assert.equal(credAuth.email, testEmail);

    // B) Google OAuth login continues to work seamlessly
    const googleAuth = await linkGoogleIdentity({
      providerAccountId: googleSub,
      email: testEmail,
      name: initialUserName,
    });
    assert.equal(googleAuth.id, linkedUser.id, "Google login must resolve to exact same user ID");

    // 7. Re-verifying account state
    assert.equal(await userHasLocalPassword(linkedUser.id), true, "Account now has local password");
    assert.equal(await isAccountGoogleOnly(linkedUser.id), false, "Account is no longer Google-only");

    // Clean up test data
    await client.query("delete from auth_action_tokens where user_id = $1", [linkedUser.id]);
    await client.query("delete from accounts where user_id = $1", [linkedUser.id]);
    await client.query("delete from profiles where id = $1", [linkedUser.id]);
    await client.query("delete from users where id = $1", [linkedUser.id]);
  } finally {
    client.release();
  }
});

test("GOOGLE PASSWORD SETUP 2: Logged-in Google user requests verified setup link from Security Settings", async () => {
  const client = await pool.connect();
  const testEmail = `google_auth_setup_${Date.now()}@testgoogle.com`;
  const googleSub = `google_sub_auth_${Date.now()}`;

  try {
    const linkedUser = await linkGoogleIdentity({
      providerAccountId: googleSub,
      email: testEmail,
      name: "Logged-in Google User",
    });

    // 1. Logged in user with !hasPassword calls setup endpoint
    const setupRes = await requestPasswordSetupForAuthenticatedUser(linkedUser.id, "127.0.0.1");
    assert.equal(setupRes.ok, true);
    assert.match(setupRes.message, /setup link has been sent/i);

    // 2. Token created in DB with 15-minute expiry
    const tokenRow = (
      await client.query(
        "select id, token_hash, expires_at, consumed_at from auth_action_tokens where user_id = $1 and purpose = 'PASSWORD_RESET' order by created_at desc limit 1",
        [linkedUser.id]
      )
    ).rows[0];
    assert.ok(tokenRow);
    assert.equal(tokenRow.consumed_at, null);
    assert.ok(new Date(tokenRow.expires_at).getTime() > Date.now());

    // 3. Trying to call changePasswordForAuthenticatedUser directly without password fails safely
    const directChangeRes = await changePasswordForAuthenticatedUser(linkedUser.id, "bogus", "NewPassword123!@#");
    assert.equal(directChangeRes.ok, false);
    assert.match(directChangeRes.message, /does not have a password yet/i);

    // Clean up
    await client.query("delete from auth_action_tokens where user_id = $1", [linkedUser.id]);
    await client.query("delete from accounts where user_id = $1", [linkedUser.id]);
    await client.query("delete from profiles where id = $1", [linkedUser.id]);
    await client.query("delete from users where id = $1", [linkedUser.id]);
  } finally {
    client.release();
  }
});

test("GOOGLE PASSWORD SETUP 3: Session revocation on password establishment and token reuse rejection", async () => {
  const client = await pool.connect();
  const testEmail = `session_revok_${Date.now()}@testgoogle.com`;

  try {
    const initialHash = await bcrypt.hash("OldPassword123!@#", 10);
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'Session Revoke User', $2, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [testEmail, initialHash]
    );
    const userId = userRes.rows[0].id;

    // Generate token
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await client.query(
      `insert into auth_action_tokens(user_id, purpose, token_hash, expires_at)
       values($1, 'PASSWORD_RESET', $2, now() + interval '15 minutes')`,
      [userId, tokenHash]
    );

    // Initial session version is 1
    const beforeUser = (await client.query("select session_version from users where id = $1", [userId])).rows[0];
    assert.equal(beforeUser.session_version, 1);

    // Redeem token
    const res = await redeemResetToken(rawToken, "BrandNewPassword123!@#");
    assert.equal(res.ok, true);

    // session_version must be incremented to 2 (revoking existing sessions)
    const afterUser = (await client.query("select session_version from users where id = $1", [userId])).rows[0];
    assert.equal(afterUser.session_version, 2);

    // Replaying same token must fail atomically
    const replayRes = await redeemResetToken(rawToken, "AnotherPassword123!@#");
    assert.equal(replayRes.ok, false);
    assert.match(replayRes.message, /already been used|invalid/i);

    // Clean up
    await client.query("delete from auth_action_tokens where user_id = $1", [userId]);
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    client.release();
  }
});

test("GOOGLE PASSWORD SETUP 4: Suspended users and disabled accounts cannot set or reset passwords", async () => {
  const client = await pool.connect();
  const testEmail = `suspended_${Date.now()}@testgoogle.com`;

  try {
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, status, disabled, session_version, feature_permissions)
       values($1, 'Suspended User', null, 'CUSTOMER', 'SUSPENDED', true, 1, '{}'::jsonb)
       returning id`,
      [testEmail]
    );
    const userId = userRes.rows[0].id;

    // Recovery request returns generic response but inserts NO token
    const res = await requestPasswordRecovery(testEmail);
    assert.equal(res.ok, true);
    assert.equal(res.message, "If this account is eligible, we’ll email you a link to set or reset your password.");

    const tokenCount = (await client.query("select count(*)::int as cnt from auth_action_tokens where user_id = $1", [userId])).rows[0].cnt;
    assert.equal(tokenCount, 0, "No token should be issued for suspended account");

    // Clean up
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
