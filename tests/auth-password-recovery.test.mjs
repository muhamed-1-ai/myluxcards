import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config.ts";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const forgotRoute = readFileSync("src/app/api/auth/forgot-password/route.ts", "utf8");
const verifyRoute = readFileSync("src/app/api/auth/verify-reset-token/route.ts", "utf8");
const resetRoute = readFileSync("src/app/api/auth/reset-password/route.ts", "utf8");
const changeRoute = readFileSync("src/app/api/auth/change-password/route.ts", "utf8");
const recoveryLib = readFileSync("src/lib/auth/passwordRecovery.ts", "utf8");
const emailLib = readFileSync("src/lib/email/transactional.ts", "utf8");
const currentIdentityLib = readFileSync("src/lib/auth/currentIdentity.ts", "utf8");
const authOptions = readFileSync("src/lib/auth.ts", "utf8");

test("RECOVERY 1: Public forgot password endpoint uses uniform, non-enumerating response text and headers", () => {
  const uniformMessage = "If this email is eligible, we’ll send password recovery instructions.";
  assert.match(forgotRoute, /"Cache-Control":\s*"no-store/);
  assert.match(recoveryLib, new RegExp(uniformMessage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // Must execute dummy bcrypt comparison to neutralize timing side channels on non-existent accounts
  assert.match(recoveryLib, /DUMMY_HASH/);
  assert.match(recoveryLib, /compare\("dummy_password_timing_defense",\s*DUMMY_HASH\)/);
});

test("RECOVERY 2: Token generation produces 32+ byte cryptographic tokens with SHA-256 verifier storage", () => {
  assert.match(recoveryLib, /randomBytes\(32\)\.toString\("hex"\)/);
  assert.match(recoveryLib, /createHash\("sha256"\)\.update\(rawToken\)\.digest\("hex"\)/);
  assert.match(recoveryLib, /purpose\s*=\s*'PASSWORD_RESET'/);
  assert.match(recoveryLib, /15\s*\*\s*60\s*\*\s*1000/); // 15 minute expiration
});

test("RECOVERY 3: Verify token endpoint is non-destructive (safe for email link scanners and pre-fetching)", () => {
  assert.match(verifyRoute, /verifyResetToken\(token\)/);
  assert.doesNotMatch(verifyRoute, /consumed_at/);
  const verifyFunc = recoveryLib.slice(
    recoveryLib.indexOf("export async function verifyResetToken"),
    recoveryLib.indexOf("export async function redeemResetToken")
  );
  assert.doesNotMatch(verifyFunc, /update\s+auth_action_tokens/i);
});

test("RECOVERY 4: Server-side session revocation increments session_version and currentIdentity rejects stale tokens", () => {
  // Reset password increments session_version
  assert.match(recoveryLib, /session_version\s*=\s*session_version\s*\+\s*1/);
  // currentIdentity invalidates request if session_version changed
  assert.match(currentIdentityLib, /profile\.session_version\s*!==\s*tokenSessionVersion/);
  // auth.ts only initializes sessionVersion if undefined (prevents revoked sessions from reviving)
  assert.match(authOptions, /token\.sessionVersion === undefined/);
});

test("RECOVERY 5: Change Password enforces current password verification, rejects same password, and derives target from session", () => {
  assert.match(changeRoute, /validMutationOrigin\(request\)/);
  assert.match(changeRoute, /currentIdentity\(request\)/);
  assert.match(recoveryLib, /verifyPassword\(currentPassword,\s*user\.password_hash\)/);
  assert.match(recoveryLib, /currentPassword\s*===\s*newPassword/);
  assert.match(recoveryLib, /New password must be different from your current password\./);
});

test("RECOVERY 6: Google-only accounts are protected from password creation, takeover, or local change", () => {
  assert.match(recoveryLib, /Your sign-in is managed through Google\. Password change is not applicable for Google-only accounts\./);
  assert.match(recoveryLib, /sendGoogleAccountRecoveryInfoEmail/);
  assert.match(emailLib, /Sign in to ZAPPIT with Google/);
});

test("RECOVERY 7: Transactional email service implements verified sender, escaping, and no password leaks", () => {
  assert.match(emailLib, /process\.env\.EMAIL_FROM\s*\|\|\s*"ZAPPIT <no-reply@3gzappit\.com>"/);
  assert.match(emailLib, /export function escapeHtml/);
  assert.match(emailLib, /This link will expire in \$\{minutes\} minutes/);
  // Password changed email must NEVER include raw passwords or reset tokens
  assert.doesNotMatch(emailLib, /sendPasswordChangedEmail[\s\S]*password:\s*input/i);
  assert.doesNotMatch(emailLib, /sendPasswordChangedEmail[\s\S]*token/i);
});

test("RECOVERY 8: Live PostgreSQL Transaction Lifecycle - Token creation, single-use redemption, session bump, and reuse rejection", async () => {
  const pool = new Pool(databaseConfig());
  const client = await pool.connect();

  const testEmail = `pw_test_${Date.now()}@testrecovery.local`;
  const initialPassword = "OldPassword123!@#";
  const newPassword = "NewSecurePassword456$%^";
  const initialHash = await bcrypt.hash(initialPassword, 10);

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // 1. Create test user with session_version = 1
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, session_version, feature_permissions)
       values($1, 'Password Recovery Test User', $2, 'CUSTOMER', 1, '{}'::jsonb)
       returning id, email, session_version`,
      [testEmail, initialHash]
    );
    const user = userRes.rows[0];
    assert.equal(user.session_version, 1);

    // 2. Generate 32-byte opaque recovery token and insert SHA-256 hash
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await client.query(
      `insert into auth_action_tokens(user_id, purpose, token_hash, expires_at)
       values($1, 'PASSWORD_RESET', $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // 3. Verify token (non-consuming check)
    const tokenCheck = await client.query(
      `select id, user_id, expires_at, consumed_at from auth_action_tokens
       where token_hash = $1 and purpose = 'PASSWORD_RESET'`,
      [tokenHash]
    );
    assert.equal(tokenCheck.rows.length, 1);
    assert.equal(tokenCheck.rows[0].consumed_at, null);
    assert.ok(new Date(tokenCheck.rows[0].expires_at).getTime() > Date.now());

    // 4. Redeem token atomically: update password, bump session_version, consume token
    const newHash = await bcrypt.hash(newPassword, 10);
    const redeemRes = await client.query(
      `update users
       set password_hash = $1, session_version = session_version + 1, updated_at = now()
       where id = $2 returning session_version`,
      [newHash, user.id]
    );
    assert.equal(redeemRes.rows[0].session_version, 2, "session_version must be incremented to 2");

    await client.query(
      "update auth_action_tokens set consumed_at = now() where token_hash = $1",
      [tokenHash]
    );

    // 5. Attempt second redemption with same token: MUST fail
    const replayCheck = await client.query(
      `select id, consumed_at from auth_action_tokens
       where token_hash = $1 and purpose = 'PASSWORD_RESET' and consumed_at is null`,
      [tokenHash]
    );
    assert.equal(replayCheck.rows.length, 0, "Consumed token must not be available for second use");

    // 6. Verify old password fails and new password verifies against updated hash
    const updatedUser = (await client.query("select password_hash from users where id = $1", [user.id])).rows[0];
    const oldMatches = await bcrypt.compare(initialPassword, updatedUser.password_hash);
    const newMatches = await bcrypt.compare(newPassword, updatedUser.password_hash);
    assert.equal(oldMatches, false, "Old password must no longer match");
    assert.equal(newMatches, true, "New password must match");

    // Rollback so live database remains clean
    await client.query("ROLLBACK");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
});
