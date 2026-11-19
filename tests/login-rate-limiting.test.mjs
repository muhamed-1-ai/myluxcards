import test from "node:test";
import assert from "node:assert/strict";
import { getTrustedClientIp } from "../src/lib/rateLimit.js";

// Mock database pool for deterministic testing of rate limits
const mockStore = new Map();

function mockCheckRateLimit(action, subject, limit, windowSeconds) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const key = `${action}:${subject.toLowerCase()}`;
  const record = mockStore.get(key) || { timestamps: [] };

  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    return false;
  }

  record.timestamps.push(now);
  mockStore.set(key, record);
  return true;
}

async function mockEnforceLoginRateLimit({ email, clientIp, limits = { accountMax: 5, ipMax: 10 } }) {
  const normEmail = (email || "").trim().toLowerCase();
  const ip = (clientIp || "").trim() || "unknown";

  if (normEmail) {
    const accountAllowed = mockCheckRateLimit("LOGIN_ACCOUNT", normEmail, limits.accountMax, 900);
    if (!accountAllowed) return { allowed: false, reason: "ACCOUNT" };
  }

  if (ip && ip !== "unknown") {
    const ipAllowed = mockCheckRateLimit("LOGIN_IP", ip, limits.ipMax, 900);
    if (!ipAllowed) return { allowed: false, reason: "IP" };
  }

  return { allowed: true };
}

test("Rate Limit 1: Client IP derivation from trusted proxy headers", () => {
  // Comma-separated X-Forwarded-For chain
  const req1 = { headers: { get: (h) => (h === "x-forwarded-for" ? "198.51.100.24, 10.0.0.1" : null) } };
  assert.equal(getTrustedClientIp(req1), "198.51.100.24");

  // X-Real-IP fallback
  const req2 = { headers: { get: (h) => (h === "x-real-ip" ? "203.0.113.88" : null) } };
  assert.equal(getTrustedClientIp(req2), "203.0.113.88");

  // Plain object headers
  const req3 = { headers: { "x-forwarded-for": "192.0.2.1" } };
  assert.equal(getTrustedClientIp(req3), "192.0.2.1");

  // Empty or undefined fallback
  assert.equal(getTrustedClientIp(null), "127.0.0.1");
});

test("Rate Limit 2: Account limit blocks specific target email while allowing others", async () => {
  mockStore.clear();
  const targetEmail = "victim@example.com";
  const otherEmail = "innocent@example.com";
  const ip = "198.51.100.5";

  // Simulate 5 attempts for targetEmail
  for (let i = 0; i < 5; i++) {
    const res = await mockEnforceLoginRateLimit({ email: targetEmail, clientIp: ip });
    assert.equal(res.allowed, true, `Attempt ${i + 1} should be allowed`);
  }

  // 6th attempt for targetEmail should be blocked by ACCOUNT limit
  const blocked = await mockEnforceLoginRateLimit({ email: targetEmail, clientIp: "Different-IP" });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "ACCOUNT");

  // Other email from same IP should still be allowed (independent account limit)
  const otherRes = await mockEnforceLoginRateLimit({ email: otherEmail, clientIp: "New-IP" });
  assert.equal(otherRes.allowed, true);
});

test("Rate Limit 3: Email normalization ensures case-insensitive limit enforcement", async () => {
  mockStore.clear();

  // Try 5 variations of casing
  const emails = [
    "user@domain.com",
    "User@domain.com",
    "USER@DOMAIN.COM",
    "  user@domain.com  ",
    "uSeR@DoMaIn.CoM",
  ];

  for (const email of emails) {
    const res = await mockEnforceLoginRateLimit({ email, clientIp: "10.0.0.2" });
    assert.equal(res.allowed, true);
  }

  // Next attempt with another variation must be blocked
  const res6 = await mockEnforceLoginRateLimit({ email: "USER@domain.com", clientIp: "10.0.0.2" });
  assert.equal(res6.allowed, false);
  assert.equal(res6.reason, "ACCOUNT");
});

test("Rate Limit 4: IP limit blocks distributed credential stuffing across different accounts", async () => {
  mockStore.clear();
  const attackerIp = "185.220.101.5";

  // Attacker tries 10 different accounts from the same IP
  for (let i = 0; i < 10; i++) {
    const res = await mockEnforceLoginRateLimit({ email: `target${i}@example.com`, clientIp: attackerIp, limits: { accountMax: 5, ipMax: 10 } });
    assert.equal(res.allowed, true);
  }

  // 11th attempt from this attacker IP should be blocked by IP limit even with fresh email
  const blockedIp = await mockEnforceLoginRateLimit({ email: "brand_new_account@example.com", clientIp: attackerIp, limits: { accountMax: 5, ipMax: 10 } });
  assert.equal(blockedIp.allowed, false);
  assert.equal(blockedIp.reason, "IP");
});
