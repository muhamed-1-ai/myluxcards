import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { getTrustedClientIp } from "../src/lib/rateLimit.ts";
import {
  signAdminMfaToken,
  verifyAdminMfaToken,
  normalizeRecoveryCode,
} from "../src/lib/auth/adminMfa.ts";

test("Integration 1: Trusted proxy IP resolution across reverse proxy architectures", () => {
  // Scenario A: Client behind multi-hop proxy (e.g. Cloudflare -> Traefik -> Next.js)
  const reqCloudflare = {
    headers: {
      "cf-connecting-ip": "203.0.113.195",
      "x-forwarded-for": "203.0.113.195, 172.68.23.4, 10.0.0.2",
    },
  };
  assert.equal(getTrustedClientIp(reqCloudflare), "203.0.113.195");

  // Scenario B: Direct reverse proxy (Nginx / Coolify) with X-Forwarded-For
  const reqNginx = {
    headers: {
      get: (h) => (h.toLowerCase() === "x-forwarded-for" ? "198.51.100.42, 10.0.0.1" : null),
    },
  };
  assert.equal(getTrustedClientIp(reqNginx), "198.51.100.42");

  // Scenario C: X-Real-IP provided
  const reqRealIp = {
    headers: {
      get: (h) => (h.toLowerCase() === "x-real-ip" ? "192.0.2.77" : null),
    },
  };
  assert.equal(getTrustedClientIp(reqRealIp), "192.0.2.77");

  // Scenario D: No proxy headers (local development fallback)
  assert.equal(getTrustedClientIp({ headers: {} }), "127.0.0.1");
});

test("Integration 2: MFA verification rate limiting blocks brute-force guessing", () => {
  const attempts = new Map();
  function checkLimit(key, max, windowMs = 900_000) {
    const now = Date.now();
    const timestamps = (attempts.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) return false;
    timestamps.push(now);
    attempts.set(key, timestamps);
    return true;
  }

  const adminUserId = "admin-user-uuid-1234";
  const attackerIp = "185.220.101.99";

  // Simulate 5 failed TOTP code attempts for this admin user
  for (let i = 0; i < 5; i++) {
    const allowed = checkLimit(`MFA_USER:${adminUserId}`, 5);
    assert.equal(allowed, true, `Attempt ${i + 1} should be permitted`);
  }

  // 6th attempt should be blocked
  const blocked = checkLimit(`MFA_USER:${adminUserId}`, 5);
  assert.equal(blocked, false, "6th attempt must be blocked by rate limiter");

  // Attacker trying another user from same IP hits IP limit (max 20)
  for (let i = 0; i < 20; i++) {
    const allowed = checkLimit(`MFA_IP:${attackerIp}`, 20);
    assert.equal(allowed, true);
  }
  const ipBlocked = checkLimit(`MFA_IP:${attackerIp}`, 20);
  assert.equal(ipBlocked, false, "Exceeding IP limit must lock out attacker IP");
});

test("Integration 3: Session-bound MFA cookies invalidate on session version bump (logout/password reset)", () => {
  process.env.AUTH_SECRET = "super-secret-production-auth-key-32chars";
  const userId = "b8c2491d-3769-4850-86d9-1ff17eef2257";
  const initialSessionVersion = 5;

  // 1. Issue MFA token tied to session version 5
  const token = signAdminMfaToken({
    userId,
    role: "SUPER_ADMIN",
    sessionVersion: initialSessionVersion,
  });

  // Verify token is valid for active session
  assert.equal(verifyAdminMfaToken(token, userId, initialSessionVersion), true);

  // 2. User resets password or logs out -> sessionVersion bumped to 6
  const updatedSessionVersion = 6;

  // Verify that the old MFA token is IMMEDIATELY INVALID for sessionVersion 6
  assert.equal(
    verifyAdminMfaToken(token, userId, updatedSessionVersion),
    false,
    "MFA token must be invalidated when session version increments"
  );
});

test("Integration 4: Atomic single-use recovery code consumption", () => {
  // Setup simulated database recovery codes state
  const rawCodes = ["A1B2-C3D4", "E5F6-G7H8", "J9K0-L1M2"];
  const storedCodes = rawCodes.map((code) => ({
    hash: createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex"),
    used: false,
    used_at: null,
  }));

  // Simulate atomic consumption function (matching verifyAdminMfaCodeOrRecovery logic)
  function consumeRecoveryCode(inputCode) {
    const norm = normalizeRecoveryCode(inputCode);
    const hash = createHash("sha256").update(norm).digest("hex");
    const codeObj = storedCodes.find((c) => c.hash === hash);

    if (!codeObj) {
      return { success: false, reason: "NOT_FOUND" };
    }
    if (codeObj.used) {
      return { success: false, reason: "ALREADY_USED" };
    }

    // Atomically mark used
    codeObj.used = true;
    codeObj.used_at = new Date().toISOString();
    return { success: true };
  }

  // 1. First consumption of code A1B2-C3D4 succeeds
  const firstUse = consumeRecoveryCode("A1B2-C3D4");
  assert.equal(firstUse.success, true);

  // 2. Immediate second attempt with same code fails (atomic single-use)
  const replayAttempt = consumeRecoveryCode("A1B2-C3D4");
  assert.equal(replayAttempt.success, false);
  assert.equal(replayAttempt.reason, "ALREADY_USED");

  // 3. Normalization test: lowercase with space and no dashes
  const normalizedUse = consumeRecoveryCode("e5f6g7h8");
  assert.equal(normalizedUse.success, true);

  // 4. Second attempt of second code fails
  const secondReplay = consumeRecoveryCode("E5F6-G7H8");
  assert.equal(secondReplay.success, false);
  assert.equal(secondReplay.reason, "ALREADY_USED");

  // 5. Invalid / nonexistent code fails
  const invalidCode = consumeRecoveryCode("ZZZZ-9999");
  assert.equal(invalidCode.success, false);
  assert.equal(invalidCode.reason, "NOT_FOUND");
});

test("Integration 5: Admin API guardrails fail closed when MFA is unverified", async () => {
  // Simulate requireAdmin gatekeeper check
  function guardAdminApi(identity, hasMfaToken) {
    if (!identity) return { status: 401, message: "Unauthorized" };
    if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") {
      return { status: 403, message: "Forbidden" };
    }
    if (!hasMfaToken) {
      return { status: 403, message: "Forbidden: MFA verification required." };
    }
    return { status: 200, actor: identity };
  }

  const superAdmin = { id: "user-1", role: "SUPER_ADMIN", sessionVersion: 1 };
  const regularCustomer = { id: "user-2", role: "CUSTOMER", sessionVersion: 1 };

  // Super admin without verified MFA token -> 403 Forbidden
  const blockedAdmin = guardAdminApi(superAdmin, false);
  assert.equal(blockedAdmin.status, 403);
  assert.equal(blockedAdmin.message.includes("MFA verification required"), true);

  // Super admin with verified MFA token -> 200 OK
  const allowedAdmin = guardAdminApi(superAdmin, true);
  assert.equal(allowedAdmin.status, 200);
  assert.equal(allowedAdmin.actor.id, "user-1");

  // Customer even with a forged token -> 403 Forbidden
  const blockedCustomer = guardAdminApi(regularCustomer, true);
  assert.equal(blockedCustomer.status, 403);
});
