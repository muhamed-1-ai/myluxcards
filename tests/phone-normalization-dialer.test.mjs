import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhoneNumber, extractCallingCode } from "../src/lib/phone.ts";
import { serializeContactToVCard } from "../src/lib/contactExport.ts";

test("Regression 1: 10-digit national number with India country context produces tel:+919876543210", () => {
  const result = normalizePhoneNumber("9876543210", "+91");
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, "+919876543210");
  assert.equal(result.telLink, "tel:+919876543210");
  assert.equal(result.smsLink, "sms:+919876543210");
  assert.equal(result.waDigits, "919876543210");
  assert.equal(result.waLink, "https://wa.me/919876543210");
});

test("Regression 2: E.164 number already containing +91 does not duplicate prefix", () => {
  const result = normalizePhoneNumber("+919876543210", "+91");
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, "+919876543210");
  assert.equal(result.telLink, "tel:+919876543210");
  assert.equal(result.waDigits, "919876543210");
});

test("Regression 3: Formatted number with spaces and +91 normalizes cleanly", () => {
  const result = normalizePhoneNumber("+91 98765 43210", "+91");
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, "+919876543210");
  assert.equal(result.telLink, "tel:+919876543210");
  assert.equal(result.waDigits, "919876543210");
});

test("Regression 4: 10-digit Indian number starting with 91 retains its national digits", () => {
  // CRITICAL REQUIREMENT: An Indian national number can itself start with 91.
  // 9123456789 is a 10-digit national number, so prepending +91 must yield +919123456789.
  const result = normalizePhoneNumber("9123456789", "+91");
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, "+919123456789");
  assert.equal(result.telLink, "tel:+919123456789");
  assert.equal(result.waDigits, "919123456789");
});

test("Regression 5: Confirmed country-prefixed number without + (12 digits starting with 91)", () => {
  const result = normalizePhoneNumber("919876543210", "+91");
  assert.equal(result.isValid, true);
  assert.equal(result.normalized, "+919876543210");
  assert.equal(result.telLink, "tel:+919876543210");
  assert.equal(result.waDigits, "919876543210");
});

test("Regression 6: Foreign numbers preserve their international calling code", () => {
  // US number
  const usRes = normalizePhoneNumber("+14155552671", "US");
  assert.equal(usRes.isValid, true);
  assert.equal(usRes.normalized, "+14155552671");
  assert.equal(usRes.telLink, "tel:+14155552671");
  assert.equal(usRes.waDigits, "14155552671");

  // UK number
  const ukRes = normalizePhoneNumber("+447911123456", "GB");
  assert.equal(ukRes.isValid, true);
  assert.equal(ukRes.normalized, "+447911123456");
  assert.equal(ukRes.telLink, "tel:+447911123456");

  // Explicit foreign number with India context must preserve foreign code
  const foreignWithIn = normalizePhoneNumber("+14155552671", "+91");
  assert.equal(foreignWithIn.normalized, "+14155552671");
  assert.equal(foreignWithIn.telLink, "tel:+14155552671");
});

test("Regression 7: Duplicated country prefixes (+91 91...) are safely repaired", () => {
  const dup1 = normalizePhoneNumber("+91 91555555345", "+91");
  assert.equal(dup1.normalized, "+91555555345");
  assert.equal(dup1.telLink, "tel:+91555555345");

  const dup2 = normalizePhoneNumber("+91 919876543210", "+91");
  assert.equal(dup2.normalized, "+919876543210");
  assert.equal(dup2.telLink, "tel:+919876543210");
});

test("Regression 8: Idempotency - normalizing an already normalized result never alters it", () => {
  const inputs = [
    "9876543210",
    "+919876543210",
    "+91 98765 43210",
    "9123456789",
    "919876543210",
    "+14155552671",
    "+447911123456",
    "+91 91555555345",
  ];

  for (const raw of inputs) {
    const pass1 = normalizePhoneNumber(raw, "+91");
    const pass2 = normalizePhoneNumber(pass1.normalized, "+91");
    assert.equal(pass2.normalized, pass1.normalized, `Idempotency failed for: ${raw}`);
    assert.equal(pass2.telLink, pass1.telLink, `Tel link idempotency failed for: ${raw}`);
    assert.equal(pass2.waDigits, pass1.waDigits, `WhatsApp digits idempotency failed for: ${raw}`);
  }
});

test("Regression 9: Empty, missing, or invalid input returns validation error and empty links", () => {
  const emptyRes = normalizePhoneNumber("", "+91");
  assert.equal(emptyRes.isValid, false);
  assert.equal(emptyRes.normalized, "");
  assert.equal(emptyRes.telLink, "");
  assert.equal(emptyRes.smsLink, "");
  assert.equal(emptyRes.waLink, "");
  assert.ok(emptyRes.error);

  const textRes = normalizePhoneNumber("invalid-phone-string", "+91");
  assert.equal(textRes.isValid, false);
  assert.equal(textRes.telLink, "");

  const shortRes = normalizePhoneNumber("123", "+91");
  assert.equal(shortRes.isValid, false);
  assert.equal(shortRes.telLink, "");
});

test("Regression 10: VCard serialization uses normalized international format", () => {
  const vcard = serializeContactToVCard({
    name: "Febin Test",
    contactNumber: "9555555345",
    countryCode: "+91",
  });

  assert.match(vcard, /TEL;TYPE=CELL:\+919555555345/);
  // Ensure no duplicate 91 in vcard
  assert.doesNotMatch(vcard, /TEL;TYPE=CELL:\+9191/);
});
