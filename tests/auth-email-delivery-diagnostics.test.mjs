import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config.ts";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getAppOrigin, CANONICAL_PRODUCTION_DOMAIN } from "../src/lib/url.ts";

const pool = new Pool(databaseConfig());

test("EMAIL DIAGNOSTICS 1: Canonical URL guarantees secure production origin and prevents untrusted header injection", () => {
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.APP_URL;

    // In production, getAppOrigin MUST return CANONICAL_PRODUCTION_DOMAIN even if request header is untrusted
    const untrustedReq = new Request("http://evil-attacker.com", {
      headers: { host: "evil-attacker.com", "x-forwarded-host": "evil-attacker.com" },
    });
    const origin = getAppOrigin(untrustedReq);
    assert.equal(origin, CANONICAL_PRODUCTION_DOMAIN);
    assert.equal(origin, "https://3gzappit.com");
  } finally {
    process.env.NODE_ENV = originalEnv;
  }
});

test("EMAIL DIAGNOSTICS 2: Live forgot-password request creates token and records UNCONFIGURED status when credentials are missing", async () => {
  const client = await pool.connect();
  const testEmail = `diag_test_${Date.now()}@testdomain.com`;
  const initialPassword = "OldSecurePassword123!@#";
  const initialHash = await bcrypt.hash(initialPassword, 10);

  try {
    // 1. Create registered user
    const insertUserRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'Diagnostic Tester', $2, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [testEmail, initialHash]
    );
    const userId = insertUserRes.rows[0].id;

    // 2. Call live endpoint
    const response = await fetch("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.message, "If this account is eligible, we’ll email you a link to set or reset your password.");
    assert.match(response.headers.get("cache-control") || "", /no-store/);

    // 3. Query the created token in the database
    const tokenRes = await client.query(
      `select id, user_id, delivery_status, delivery_provider, delivery_error, created_at, expires_at, consumed_at
       from auth_action_tokens
       where user_id = $1 and purpose = 'PASSWORD_RESET'
       order by created_at desc limit 1`,
      [userId]
    );

    assert.equal(tokenRes.rows.length, 1);
    const token = tokenRes.rows[0];
    assert.equal(token.delivery_status, "UNCONFIGURED");
    assert.equal(token.delivery_provider, "unconfigured");
    assert.match(token.delivery_error, /RESEND_API_KEY or SMTP_HOST is missing/i);
    assert.equal(token.consumed_at, null);
    assert.ok(new Date(token.expires_at).getTime() > Date.now());

    // Clean up test data
    await client.query("delete from auth_action_tokens where user_id = $1", [userId]);
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    client.release();
  }
});

test("EMAIL DIAGNOSTICS 3: Non-existent emails yield identical generic response without creating token or leaking account presence", async () => {
  const fakeEmail = `nonexistent_${Date.now()}@ghostaccount.org`;

  const response = await fetch("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: fakeEmail }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.message, "If this account is eligible, we’ll email you a link to set or reset your password.");

  // Confirm NO token was inserted for this nonexistent email
  const check = await pool.query(
    `select t.id from auth_action_tokens t
     join users u on u.id = t.user_id
     where u.email = $1`,
    [fakeEmail]
  );
  assert.equal(check.rows.length, 0);
});

test("EMAIL DIAGNOSTICS 4: Token lifecycle, non-destructive check, atomic redemption, and session revocation", async () => {
  const client = await pool.connect();
  const testEmail = `token_lifecycle_${Date.now()}@testdomain.com`;
  const initialPassword = "InitialPassword123!@#";
  const newPassword = "UpdatedSecurePassword456$%^";
  const initialHash = await bcrypt.hash(initialPassword, 10);

  try {
    // 1. Create active user with session_version = 1
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'Lifecycle Tester', $2, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [testEmail, initialHash]
    );
    const userId = userRes.rows[0].id;

    // 2. Generate 32-byte raw token and store SHA-256 verifier with SENT status (simulating successful provider dispatch)
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const insertToken = await client.query(
      `insert into auth_action_tokens(user_id, purpose, token_hash, expires_at, delivery_status, delivery_provider, delivery_message_id, sent_at)
       values($1, 'PASSWORD_RESET', $2, $3, 'SENT', 'resend', 'msg_test_12345', now())
       returning id, delivery_status, delivery_message_id`,
      [userId, tokenHash, expiresAt]
    );
    assert.equal(insertToken.rows[0].delivery_status, "SENT");
    assert.equal(insertToken.rows[0].delivery_message_id, "msg_test_12345");

    // 3. Non-destructive verify endpoint test
    const verifyRes = await fetch(`http://localhost:3000/api/auth/verify-reset-token?token=${rawToken}`);
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.valid, true);

    // Verify token was NOT consumed by the link inspection
    const tokenStillOpen = await client.query(
      "select consumed_at from auth_action_tokens where token_hash = $1",
      [tokenHash]
    );
    assert.equal(tokenStillOpen.rows[0].consumed_at, null);

    // 4. Redeem token via POST /api/auth/reset-password
    const redeemRes = await fetch("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, password: newPassword }),
    });
    assert.equal(redeemRes.status, 200);
    const redeemData = await redeemRes.json();
    assert.equal(redeemData.ok, true);

    // 5. Confirm token is now consumed
    const tokenConsumed = await client.query(
      "select consumed_at from auth_action_tokens where token_hash = $1",
      [tokenHash]
    );
    assert.notEqual(tokenConsumed.rows[0].consumed_at, null);

    // 6. Confirm user's session_version was bumped from 1 to 2
    const updatedUser = await client.query(
      "select password_hash, session_version from users where id = $1",
      [userId]
    );
    assert.equal(updatedUser.rows[0].session_version, 2, "session_version must be incremented to revoke active sessions");

    // 7. Confirm password was updated: old password fails, new password succeeds
    const oldMatches = await bcrypt.compare(initialPassword, updatedUser.rows[0].password_hash);
    const newMatches = await bcrypt.compare(newPassword, updatedUser.rows[0].password_hash);
    assert.equal(oldMatches, false, "Old password must be invalid");
    assert.equal(newMatches, true, "New password must match");

    // 8. Replay attack prevention: second attempt with same token must fail
    const replayRes = await fetch("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, password: "AnotherPassword789!@#" }),
    });
    const replayData = await replayRes.json();
    assert.equal(replayData.ok, false);

    // Cleanup
    await client.query("delete from auth_action_tokens where user_id = $1", [userId]);
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    client.release();
  }
});

test("EMAIL DIAGNOSTICS 5: Expired tokens fail verification and redemption safely", async () => {
  const client = await pool.connect();
  const testEmail = `expired_token_${Date.now()}@testdomain.com`;
  const initialHash = await bcrypt.hash("InitialPass123!@#", 10);

  try {
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'Expired Tester', $2, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [testEmail, initialHash]
    );
    const userId = userRes.rows[0].id;

    // Insert token that was created 20 minutes ago and expired 5 minutes ago
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const pastCreatedAt = new Date(Date.now() - 20 * 60 * 1000);
    const pastExpiresAt = new Date(Date.now() - 5 * 60 * 1000);

    await client.query(
      `insert into auth_action_tokens(user_id, purpose, token_hash, created_at, expires_at, delivery_status)
       values($1, 'PASSWORD_RESET', $2, $3, $4, 'SENT')`,
      [userId, tokenHash, pastCreatedAt, pastExpiresAt]
    );

    // Verify should return valid: false
    const verifyRes = await fetch(`http://localhost:3000/api/auth/verify-reset-token?token=${rawToken}`);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.valid, false);
    assert.match(verifyData.message, /expired/i);

    // Redeem should fail
    const redeemRes = await fetch("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken, password: "NewStrongPassword123!@#" }),
    });
    const redeemData = await redeemRes.json();
    assert.equal(redeemData.ok, false);

    // Cleanup
    await client.query("delete from auth_action_tokens where user_id = $1", [userId]);
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    client.release();
  }
});

test("EMAIL DIAGNOSTICS 6: Rate limiting on forgot-password requests (max 3 per 15 minutes per email)", async () => {
  const client = await pool.connect();
  const testEmail = `ratelimit_${Date.now()}@testdomain.com`;
  const initialHash = await bcrypt.hash("InitialPass123!@#", 10);

  try {
    const userRes = await client.query(
      `insert into users(email, name, password_hash, role, status, session_version, feature_permissions)
       values($1, 'RateLimit Tester', $2, 'CUSTOMER', 'ACTIVE', 1, '{}'::jsonb)
       returning id`,
      [testEmail, initialHash]
    );
    const userId = userRes.rows[0].id;

    // Send 3 requests (within limit)
    for (let i = 1; i <= 3; i++) {
      const res = await fetch("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": `192.0.2.${i}` },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await res.json();
      assert.equal(data.ok, true);
    }

    // 4th request exceeds email rate limit (3/15m)
    const fourthRes = await fetch("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.99" },
      body: JSON.stringify({ email: testEmail }),
    });
    assert.equal(fourthRes.status, 200);
    const fourthData = await fourthRes.json();
    // Public response remains uniform
    assert.equal(fourthData.ok, true);
    assert.equal(fourthData.message, "If this account is eligible, we’ll email you a link to set or reset your password.");

    // Count how many tokens were created for this user: should be exactly 3, not 4
    const countRes = await client.query(
      "select count(*)::int as count from auth_action_tokens where user_id = $1",
      [userId]
    );
    assert.equal(countRes.rows[0].count, 3, "4th rate-limited request must not generate a new token");

    // Cleanup
    await client.query("delete from auth_action_tokens where user_id = $1", [userId]);
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    client.release();
    await pool.end();
  }
});
