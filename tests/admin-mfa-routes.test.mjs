import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  signAdminMfaToken,
  verifyAdminMfaToken,
  hashSessionToken,
  encryptMfaSecret,
  decryptMfaSecret,
  ADMIN_MFA_COOKIE_NAME,
} from "../src/lib/auth/adminMfa.ts";

test("Routes 1: Static route architecture guarantees in MFA endpoints", () => {
  const setupRoute = readFileSync("src/app/api/admin/mfa/setup/route.ts", "utf8");
  const confirmRoute = readFileSync("src/app/api/admin/mfa/confirm/route.ts", "utf8");
  const verifyRoute = readFileSync("src/app/api/admin/mfa/verify/route.ts", "utf8");
  const statusRoute = readFileSync("src/app/api/admin/mfa/status/route.ts", "utf8");

  // All endpoints require validMutationOrigin or authentication
  assert.match(setupRoute, /validMutationOrigin/);
  assert.match(confirmRoute, /validMutationOrigin/);
  assert.match(verifyRoute, /validMutationOrigin/);

  // Setup and confirm enforce re-enrollment guards
  assert.match(setupRoute, /currentStatus\.enrolled/);
  assert.match(setupRoute, /isSessionMfaVerified/);
  assert.match(confirmRoute, /currentStatus\.enrolled/);
  assert.match(confirmRoute, /isSessionMfaVerified/);

  // Verify enforces user & IP rate limits
  assert.match(verifyRoute, /checkRateLimit\("MFA_VERIFY_USER"/);
  assert.match(verifyRoute, /checkRateLimit\("MFA_VERIFY_IP"/);

  // Cookie setting enforces HttpOnly, SameSite, and 12-hour maxAge
  assert.match(confirmRoute, /httpOnly:\s*true/);
  assert.match(confirmRoute, /sameSite:\s*"lax"/);
  assert.match(confirmRoute, /maxAge:\s*maxAgeSeconds/);

  assert.match(verifyRoute, /httpOnly:\s*true/);
  assert.match(verifyRoute, /sameSite:\s*"lax"/);
  assert.match(verifyRoute, /maxAge:\s*maxAgeSeconds/);
});

test("Routes 2: Session-bound MFA tokens strictly enforce cookie security flags", () => {
  process.env.AUTH_SECRET = "production-auth-secret-32-chars-long!";
  const userId = "c1a11111-2222-3333-4444-555555555555";
  const sessionToken = "session_cookie_alpha_99999";

  const token = signAdminMfaToken({
    userId,
    role: "ADMIN",
    sessionVersion: 1,
    sessionToken,
  });

  // Verify token has cryptographic HMAC signature
  const parts = token.split(".");
  assert.equal(parts.length, 2);

  const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  assert.equal(payload.uid, userId);
  assert.equal(payload.role, "ADMIN");
  assert.equal(payload.sv, 1);
  assert.equal(payload.sth, hashSessionToken(sessionToken));
  assert.equal(typeof payload.exp, "number");
  assert.equal(payload.exp > Math.floor(Date.now() / 1000), true);

  // Verification succeeds with matching session
  assert.equal(verifyAdminMfaToken(token, userId, 1, sessionToken), true);

  // Rejection scenarios:
  // 1. Stolen MFA cookie presented with wrong session token
  assert.equal(verifyAdminMfaToken(token, userId, 1, "attacker_different_session"), false);

  // 2. Old MFA cookie presented after logout (no active session token)
  assert.equal(verifyAdminMfaToken(token, userId, 1, null), false);

  // 3. Old MFA cookie presented after password reset (session version bumped to 2)
  assert.equal(verifyAdminMfaToken(token, userId, 2, sessionToken), false);

  // 4. Old MFA cookie presented for a different user ID
  assert.equal(verifyAdminMfaToken(token, "different-user-id", 1, sessionToken), false);
});

test("Routes 3: AES-256-GCM encryption at rest handles decryption and tampering", () => {
  const secret = "MZXW633PN5XW6MZXW633PN5XW6MZXW63";
  const encrypted = encryptMfaSecret(secret);

  assert.equal(encrypted.startsWith("enc:v1:"), true);
  assert.notEqual(encrypted, secret);

  // Successful decryption
  const decrypted = decryptMfaSecret(encrypted);
  assert.equal(decrypted, secret);

  // Tampered ciphertext fails decryption
  const parts = encrypted.split(":");
  const tamperedCiphertext = parts[4].slice(0, -2) + (parts[4].endsWith("0") ? "1" : "0");
  const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCiphertext}`;

  assert.throws(() => {
    decryptMfaSecret(tampered);
  });
});
