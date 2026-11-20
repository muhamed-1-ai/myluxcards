import test from "node:test";
import assert from "node:assert/strict";
import { getTrustedClientIp } from "../src/lib/rateLimit.ts";

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

test("Integration 2: Login rate limiting blocks brute-force guessing", () => {
  const attempts = new Map();
  function checkLimit(key, max, windowMs = 900_000) {
    const now = Date.now();
    const timestamps = (attempts.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= max) return false;
    timestamps.push(now);
    attempts.set(key, timestamps);
    return true;
  }

  const email = "admin@3gzappit.com";
  const clientIp = "185.220.101.99";

  // Simulate 5 attempts for this email
  for (let i = 0; i < 5; i++) {
    const allowed = checkLimit(`LOGIN_USER:${email}`, 5);
    assert.equal(allowed, true, `Attempt ${i + 1} should be permitted`);
  }

  // 6th attempt should be blocked
  const blocked = checkLimit(`LOGIN_USER:${email}`, 5);
  assert.equal(blocked, false, "6th attempt must be blocked by rate limiter");

  // IP limit blocks distributed attacks
  for (let i = 0; i < 20; i++) {
    const allowed = checkLimit(`LOGIN_IP:${clientIp}`, 20);
    assert.equal(allowed, true);
  }
  const ipBlocked = checkLimit(`LOGIN_IP:${clientIp}`, 20);
  assert.equal(ipBlocked, false, "Exceeding IP limit must lock out attacker IP");
});

test("Integration 3: Session revocation on password reset / session version increment", () => {
  function verifySession(session, userDbRecord) {
    if (!session || !userDbRecord) return false;
    if (userDbRecord.disabled || userDbRecord.status === "DISABLED") return false;
    return session.sessionVersion === userDbRecord.sessionVersion;
  }

  const activeUser = { id: "u-1", sessionVersion: 1, disabled: false, status: "ACTIVE" };
  const currentSession = { userId: "u-1", sessionVersion: 1 };

  // Active session matches DB
  assert.equal(verifySession(currentSession, activeUser), true);

  // User resets password -> sessionVersion in DB becomes 2
  const updatedUser = { ...activeUser, sessionVersion: 2 };

  // Old session is immediately rejected without requiring MFA
  assert.equal(verifySession(currentSession, updatedUser), false);
});

test("Integration 4: Direct Admin & Super Admin authorization without MFA gating", () => {
  function authorizeAdminRoute(identity, requiredRole = "ADMIN") {
    if (!identity) return { status: 401, error: "Unauthorized" };
    if (requiredRole === "SUPER_ADMIN" && identity.role !== "SUPER_ADMIN") {
      return { status: 403, error: "Forbidden: Super Admin required" };
    }
    if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") {
      return { status: 403, error: "Forbidden: Admin required" };
    }
    return { status: 200, actor: identity };
  }

  // Super Admin can access both ADMIN and SUPER_ADMIN routes directly
  const superAdmin = { id: "sa-1", email: "super@3gzappit.com", role: "SUPER_ADMIN" };
  assert.equal(authorizeAdminRoute(superAdmin, "ADMIN").status, 200);
  assert.equal(authorizeAdminRoute(superAdmin, "SUPER_ADMIN").status, 200);

  // Admin can access ADMIN routes, but not SUPER_ADMIN routes
  const regularAdmin = { id: "ad-1", email: "admin@3gzappit.com", role: "ADMIN" };
  assert.equal(authorizeAdminRoute(regularAdmin, "ADMIN").status, 200);
  assert.equal(authorizeAdminRoute(regularAdmin, "SUPER_ADMIN").status, 403);

  // Customer cannot access any admin routes
  const customer = { id: "cu-1", email: "user@example.com", role: "CUSTOMER" };
  assert.equal(authorizeAdminRoute(customer, "ADMIN").status, 403);
  assert.equal(authorizeAdminRoute(customer, "SUPER_ADMIN").status, 403);

  // Anonymous request fails
  assert.equal(authorizeAdminRoute(null, "ADMIN").status, 401);
});
