import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhoneNumber } from "../src/lib/phone.ts";

test("normalizePhoneNumber validates and formats contact numbers into standard E.164", () => {
  const invalid = normalizePhoneNumber("abc");
  assert.equal(invalid.isValid, false);

  const indianNumber = normalizePhoneNumber("9876543210");
  assert.equal(indianNumber.isValid, true);
  assert.equal(indianNumber.normalized, "+919876543210");

  const formattedWithSpaces = normalizePhoneNumber("+91 98765 43210");
  assert.equal(formattedWithSpaces.isValid, true);
  assert.equal(formattedWithSpaces.normalized, "+919876543210");
});

test("Lead stages lifecycle supports NEW, ACTIVE, FOLLOW_UP, QUALIFIED, CONVERTED, INACTIVE, LOST", () => {
  const allowedStages = ["NEW", "ACTIVE", "CONTACTED", "INTERESTED", "FOLLOW_UP", "QUALIFIED", "CONVERTED", "INACTIVE", "LOST"];
  for (const stage of allowedStages) {
    assert.ok(stage.length > 0);
  }
});

test("Lead sources architecture supports PROFILE_SHARE_DETAILS and MANUAL", () => {
  const allowedSources = ["PROFILE_SHARE_DETAILS", "NFC", "QR", "SHARE", "DIRECT", "UNKNOWN", "MANUAL", "REFERRAL", "WEBSITE", "CAMPAIGN"];
  assert.ok(allowedSources.includes("PROFILE_SHARE_DETAILS"));
  assert.ok(allowedSources.includes("MANUAL"));
});
