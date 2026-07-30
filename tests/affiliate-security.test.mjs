import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202607300001_affiliate_program.sql", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");
const affiliate = readFileSync("src/lib/affiliate.ts", "utf8");
const payout = readFileSync("src/app/api/admin/affiliates/payouts/route.ts", "utf8");
const apply = readFileSync("src/app/api/affiliate/apply/route.ts", "utf8");

test("affiliate writes are server-only and payout commissions cannot be reused", () => {
  assert.match(migration, /No browser write policy is granted/);
  assert.match(migration, /commission_id uuid not null unique/);
  assert.match(migration, /request_affiliate_payout/);
  assert.match(migration, /for update/);
});

test("referral cookies are signed, HttpOnly, secure in production, and SameSite Lax", () => {
  assert.match(middleware, /signPayload/);
  assert.match(middleware, /httpOnly: true/);
  assert.match(middleware, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(middleware, /sameSite: "lax"/);
});

test("attribution validates current approval and gives configurable coupon priority", () => {
  assert.match(affiliate, /status=eq\.APPROVED/);
  assert.match(affiliate, /COUPON_THEN_COOKIE/);
  assert.match(affiliate, /resolveAffiliateAttribution/);
});

test("commissions use integer math and trusted persisted order state", () => {
  assert.match(affiliate, /Number\.isSafeInteger/);
  assert.match(affiliate, /order\.payment_status !== "SUCCEEDED"/);
  assert.match(affiliate, /Math\.round\(\(commissionableMinor \* value\) \/ 10_000\)/);
});

test("application and payout mutations enforce origin and server identity", () => {
  assert.match(apply, /validMutationOrigin/);
  assert.match(apply, /currentIdentity/);
  assert.match(payout, /validMutationOrigin/);
  assert.match(payout, /requireAdmin/);
});
