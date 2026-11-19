import test from "node:test";
import assert from "node:assert/strict";
import { getTrustedClientIp, sanitizeIpAddress } from "../src/lib/rateLimit.ts";

test("IP 1: sanitizeIpAddress validates and strips ports from IPv4 and IPv6", () => {
  // Clean IPv4
  assert.equal(sanitizeIpAddress("192.168.1.1"), "192.168.1.1");
  // IPv4 with port
  assert.equal(sanitizeIpAddress("192.168.1.1:8080"), "192.168.1.1");
  assert.equal(sanitizeIpAddress("10.0.0.1:443"), "10.0.0.1");

  // Clean IPv6
  assert.equal(sanitizeIpAddress("2001:db8::1"), "2001:db8::1");
  // IPv6 with brackets and port
  assert.equal(sanitizeIpAddress("[2001:db8::1]:8080"), "2001:db8::1");

  // Invalid / malicious inputs
  assert.equal(sanitizeIpAddress("not-an-ip"), null);
  assert.equal(sanitizeIpAddress("192.168.1.300"), null);
  assert.equal(sanitizeIpAddress("'; DROP TABLE users;--"), null);
  assert.equal(sanitizeIpAddress("../../etc/passwd"), null);
  assert.equal(sanitizeIpAddress(""), null);
  assert.equal(sanitizeIpAddress(null), null);
});

test("IP 2: Spoofed X-Forwarded-For is rejected in reverse-proxy environment", () => {
  // Scenario: Attacker connects from real IP 203.0.113.195.
  // Attacker sends header: "X-Forwarded-For: 1.1.1.1, 8.8.8.8" (spoofing Google DNS/Cloudflare).
  // Traefik (1 hop) appends the attacker's real connection IP to the end:
  // "1.1.1.1, 8.8.8.8, 203.0.113.195"
  const req = {
    headers: {
      "x-forwarded-for": "1.1.1.1, 8.8.8.8, 203.0.113.195",
    },
  };

  // With 1 trusted hop (Traefik), the resolver MUST derive 203.0.113.195, NOT the spoofed 1.1.1.1
  const resolved = getTrustedClientIp(req, { trustProxy: true, trustedHops: 1 });
  assert.equal(resolved, "203.0.113.195", "Must return the real client IP appended by proxy, not the spoofed leftmost IP");
});

test("IP 3: Multi-hop proxy chain correctly derives client IP", () => {
  // Scenario: Attacker spoofs "203.0.113.1".
  // Real Client (198.51.100.42) connects to Edge CDN (Hop 2).
  // Edge CDN appends 198.51.100.42 and forwards to Traefik (Hop 1).
  // Traefik appends Edge CDN IP (172.68.20.10) and forwards to Next.js app.
  // Chain: [Spoofed 203.0.113.1, Real Client 198.51.100.42, Edge CDN 172.68.20.10]
  const req = {
    headers: {
      "x-forwarded-for": "203.0.113.1, 198.51.100.42, 172.68.20.10",
    },
  };

  // With 2 trusted proxy hops, the resolver derives 198.51.100.42 (index 3 - 2 = 1)
  const resolved = getTrustedClientIp(req, { trustProxy: true, trustedHops: 2 });
  assert.equal(resolved, "198.51.100.42");
});

test("IP 4: Direct-origin requests do not trust spoofed proxy headers", () => {
  // Scenario: Direct attack on application port without passing through trusted proxy.
  // Attacker sends spoofed headers directly.
  const req = {
    headers: {
      "x-forwarded-for": "1.2.3.4",
      "x-real-ip": "5.6.7.8",
      "cf-connecting-ip": "9.10.11.12",
    },
    socket: {
      remoteAddress: "192.0.2.100", // Actual socket connection address
    },
  };

  // When trustProxy is false (direct origin request), forwarded headers are completely ignored
  const resolved = getTrustedClientIp(req, { trustProxy: false });
  assert.equal(resolved, "192.0.2.100", "Direct requests must use socket address and ignore forwarded headers");
});

test("IP 5: CF-Connecting-IP is only trusted when trustCloudflare is explicitly enabled", () => {
  const req = {
    headers: {
      "cf-connecting-ip": "104.28.19.4",
      "x-forwarded-for": "198.51.100.55",
    },
  };

  // Untrusted Cloudflare header defaults to XFF / proxy derivation
  const untrustedCf = getTrustedClientIp(req, { trustProxy: true, trustCloudflare: false });
  assert.equal(untrustedCf, "198.51.100.55");

  // Trusted Cloudflare header prioritizes CF-Connecting-IP
  const trustedCf = getTrustedClientIp(req, { trustProxy: true, trustCloudflare: true });
  assert.equal(trustedCf, "104.28.19.4");
});

test("IP 6: Fallback to loopback when no valid IP can be extracted", () => {
  assert.equal(getTrustedClientIp(null), "127.0.0.1");
  assert.equal(getTrustedClientIp({ headers: {} }, { trustProxy: true }), "127.0.0.1");
  assert.equal(getTrustedClientIp({ headers: { "x-forwarded-for": "garbage-string" } }, { trustProxy: true }), "127.0.0.1");
});

test("IP 7: Explicit CIDR matching verifies Coolify/Docker proxy subnets", async () => {
  const { ipMatchesCidr, isTrustedProxy } = await import("../src/lib/rateLimit.ts");

  // Traefik Docker bridge (172.16.0.0/12)
  assert.equal(ipMatchesCidr("172.18.0.2", "172.16.0.0/12"), true);
  assert.equal(ipMatchesCidr("172.31.255.254", "172.16.0.0/12"), true);
  assert.equal(ipMatchesCidr("172.32.0.1", "172.16.0.0/12"), false);

  // Coolify private container network (10.0.0.0/8)
  assert.equal(ipMatchesCidr("10.0.1.5", "10.0.0.0/8"), true);
  assert.equal(ipMatchesCidr("11.0.0.1", "10.0.0.0/8"), false);

  // Local loopback
  assert.equal(ipMatchesCidr("127.0.0.1", "127.0.0.1/8"), true);
  assert.equal(ipMatchesCidr("::1", "::1/128"), true);

  // Default trusted proxy ranges recognize Traefik container
  assert.equal(isTrustedProxy("172.18.0.2"), true);
  assert.equal(isTrustedProxy("10.0.0.1"), true);
  assert.equal(isTrustedProxy("127.0.0.1"), true);
  assert.equal(isTrustedProxy("203.0.113.195"), false);
});

test("IP 8: Direct origin connection from untrusted socket IP strictly rejects forwarded headers", () => {
  // Scenario: Attacker connects directly to port 3000 bypassing Traefik.
  // Socket remote address is public IP 203.0.113.50 (NOT in trusted proxy ranges).
  // Attacker attempts to spoof XFF as "1.1.1.1".
  const req = {
    headers: {
      "x-forwarded-for": "1.1.1.1",
      "x-real-ip": "8.8.8.8",
    },
    socket: {
      remoteAddress: "203.0.113.50",
    },
  };

  // Even with default settings, because the connecting socket is NOT a trusted proxy,
  // the forwarded headers are ignored and the socket IP is returned.
  const resolved = getTrustedClientIp(req);
  assert.equal(resolved, "203.0.113.50", "Must return direct socket IP and ignore spoofed headers");
});

test("IP 9: Legitimate private client through trusted Traefik socket is correctly preserved", () => {
  // Scenario: Internal admin on 192.168.1.55 connects through Traefik (172.18.0.2).
  // Socket remoteAddress is 172.18.0.2 (trusted proxy).
  // Traefik sets X-Forwarded-For: 192.168.1.55.
  const req = {
    headers: {
      "x-forwarded-for": "192.168.1.55",
    },
    socket: {
      remoteAddress: "172.18.0.2",
    },
  };

  // Because private IP detection is separate from proxy trust, 192.168.1.55 is correctly
  // identified as the client IP, rather than being discarded.
  const resolved = getTrustedClientIp(req);
  assert.equal(resolved, "192.168.1.55", "Private client IP through trusted proxy must be preserved");
});
