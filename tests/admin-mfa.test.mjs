import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  base32Encode,
  base32Decode,
  generateTotpCode,
  verifyTotpCode,
  generateRecoveryCodes,
  normalizeRecoveryCode,
  signAdminMfaToken,
  verifyAdminMfaToken,
} from "../src/lib/auth/adminMfa.ts";

test("MFA 1: Base32 encoding and decoding RFC 4648 roundtrip", () => {
  const original = Buffer.from("Hello Zappit Security World 2026!");
  const encoded = base32Encode(original);
  assert.equal(typeof encoded, "string");
  assert.match(encoded, /^[A-Z2-7]+$/);

  const decoded = base32Decode(encoded);
  assert.deepEqual(decoded, original);
});

test("MFA 2: TOTP generation adheres to RFC 6238 6-digit standard", () => {
  const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"; // 32-char Base32 test key
  const code = generateTotpCode(secret);
  assert.equal(code.length, 6);
  assert.match(code, /^\d{6}$/);

  // Exact time-step verification must pass
  assert.equal(verifyTotpCode(secret, code), true);

  // Incorrect code must fail
  const wrongCode = code === "123456" ? "654321" : "123456";
  assert.equal(verifyTotpCode(secret, wrongCode), false);

  // Non-6-digit tokens must fail
  assert.equal(verifyTotpCode(secret, "123"), false);
  assert.equal(verifyTotpCode(secret, "abcdef"), false);
});

test("MFA 3: TOTP time drift window tolerance (±30s)", () => {
  const secret = "MZXW633PN5XW6MZXW633PN5XW6MZXW63";
  // Current code
  const currentCode = generateTotpCode(secret, 0);
  // Code from 30 seconds ago (offset -1)
  const prevCode = generateTotpCode(secret, -1);
  // Code from 30 seconds in the future (offset +1)
  const nextCode = generateTotpCode(secret, 1);
  // Code from 90 seconds ago (offset -3, outside window of 1)
  const farPastCode = generateTotpCode(secret, -3);

  assert.equal(verifyTotpCode(secret, currentCode, 1), true);
  assert.equal(verifyTotpCode(secret, prevCode, 1), true);
  assert.equal(verifyTotpCode(secret, nextCode, 1), true);
  assert.equal(verifyTotpCode(secret, farPastCode, 1), false);
});

test("MFA 4: Recovery codes generate in XXXX-XXXX format and normalize properly", () => {
  const codes = generateRecoveryCodes(8);
  assert.equal(codes.length, 8);

  for (const c of codes) {
    assert.match(c, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(normalizeRecoveryCode(c).length, 8);
    assert.equal(normalizeRecoveryCode(c.toLowerCase()), normalizeRecoveryCode(c));
  }
});

test("MFA 5: Signed admin MFA session cookie tokens verify cryptographically", () => {
  process.env.AUTH_SECRET = "test-secret-key-32-chars-long-security!";
  const userId = "b8c2491d-3769-4850-86d9-1ff17eef2257";
  const role = "SUPER_ADMIN";
  const sessionVersion = 3;

  const token = signAdminMfaToken({ userId, role, sessionVersion });
  assert.equal(typeof token, "string");
  assert.equal(token.includes("."), true);

  // Valid token for matching user and session
  assert.equal(verifyAdminMfaToken(token, userId, sessionVersion), true);

  // Mismatched user must fail
  assert.equal(verifyAdminMfaToken(token, "another-user-id", sessionVersion), false);

  // Mismatched session version (e.g. after password reset) must fail
  assert.equal(verifyAdminMfaToken(token, userId, sessionVersion + 1), false);

  // Tampered token must fail
  const tampered = token.slice(0, -3) + "xyz";
  assert.equal(verifyAdminMfaToken(tampered, userId, sessionVersion), false);
});

test("MFA 6: Server-side admin guardrails enforce MFA in adminAuth.ts", () => {
  const adminAuthCode = readFileSync("src/lib/adminAuth.ts", "utf8");

  // Page guards check MFA status and redirect
  assert.match(adminAuthCode, /getAdminMfaStatus/);
  assert.match(adminAuthCode, /isSessionMfaVerified/);
  assert.match(adminAuthCode, /redirect\("\/admin\/mfa\/enroll\?next=%2Fadmin"\)/);
  assert.match(adminAuthCode, /redirect\("\/admin\/mfa\/verify\?next=%2Fadmin"\)/);
  assert.match(adminAuthCode, /redirect\("\/admin\/mfa\/enroll\?next=%2Fsuper-admin"\)/);
  assert.match(adminAuthCode, /redirect\("\/admin\/mfa\/verify\?next=%2Fsuper-admin"\)/);

  // API guards require MFA verification
  assert.match(adminAuthCode, /const mfaVerified = await isSessionMfaVerified\(identity, req\);/);
});
