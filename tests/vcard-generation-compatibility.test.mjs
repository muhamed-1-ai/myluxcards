import test from "node:test";
import assert from "node:assert/strict";
import { buildVCardString, resolveContactName, escapeVCardValue } from "../src/lib/vcard.ts";

test("vCard: English names with spaces generates correct FN and structured N", () => {
  const result = buildVCardString({
    profileName: "John Doe",
    email: "john@example.com",
    phone: "+15550199",
  });

  assert.match(result.vcard, /^BEGIN:VCARD\r\n/m);
  assert.equal(result.fn, "FN:John Doe");
  assert.equal(result.n, "N:Doe;John;;;");
  assert.match(result.vcard, /FN:John Doe/);
  assert.match(result.vcard, /N:Doe;John;;;/);
  assert.match(result.vcard, /TEL;TYPE=CELL:\+15550199/);
  assert.match(result.vcard, /EMAIL;TYPE=INTERNET:john@example\.com/);
  assert.match(result.vcard, /END:VCARD$/);
});

test("vCard: Names with multiple spaces correctly splits first and last name", () => {
  const result = buildVCardString({
    profileName: "John Michael Smith",
  });

  assert.equal(result.fn, "FN:John Michael Smith");
  assert.equal(result.n, "N:Michael Smith;John;;;");
});

test("vCard: Malayalam names parse and preserve UTF-8 characters", () => {
  const result = buildVCardString({
    profileName: "അരുൺ കുമാർ",
    phone: "+919876543210",
  });

  assert.equal(result.fn, "FN:അരുൺ കുമാർ");
  assert.equal(result.n, "N:കുമാർ;അരുൺ;;;");
  assert.match(result.vcard, /FN:അരുൺ കുമാർ/);
  assert.match(result.vcard, /N:കുമാർ;അരുൺ;;;/);
});

test("vCard: Arabic names parse and preserve UTF-8 characters", () => {
  const result = buildVCardString({
    profileName: "محمد أحمد",
    email: "mohamed@example.com",
  });

  assert.equal(result.fn, "FN:محمد أحمد");
  assert.equal(result.n, "N:أحمد;محمد;;;");
  assert.match(result.vcard, /FN:محمد أحمد/);
  assert.match(result.vcard, /N:أحمد;محمد;;;/);
});

test("vCard: Missing surname (single-word name) generates non-empty FN and N", () => {
  const result = buildVCardString({
    profileName: "John",
  });

  assert.equal(result.fn, "FN:John");
  assert.equal(result.n, "N:;John;;;");
  assert.notEqual(result.fn, "FN:");
  assert.notEqual(result.n, "N:;;;");
});

test("vCard: Missing first name (surname only) generates non-empty FN and N", () => {
  const result = buildVCardString({
    profileName: "Doe",
  });

  assert.equal(result.fn, "FN:Doe");
  assert.equal(result.n, "N:;Doe;;;");
  assert.notEqual(result.fn, "FN:");
  assert.notEqual(result.n, "N:;;;");
});

test("vCard: Company-only profiles fall back to company name", () => {
  const result = buildVCardString({
    companyName: "Acme Corporation",
    phone: "+18005550199",
  });

  assert.equal(result.fn, "FN:Acme Corporation");
  assert.equal(result.n, "N:Corporation;Acme;;;");
  assert.match(result.vcard, /ORG:Acme Corporation/);
  assert.notEqual(result.fn, "FN:");
  assert.notEqual(result.n, "N:;;;");
});

test("vCard: Data mapping priority order (Profile Name > Card Name > User Name > Company Name)", () => {
  // Priority 1: Full profile name
  let res = resolveContactName({
    profileName: "Profile Name",
    cardName: "Card Name",
    userName: "User Name",
    companyName: "Company Name",
  });
  assert.equal(res.fullName, "Profile Name");

  // Priority 2: Card name
  res = resolveContactName({
    cardName: "Card Name",
    userName: "User Name",
    companyName: "Company Name",
  });
  assert.equal(res.fullName, "Card Name");

  // Priority 3: User name
  res = resolveContactName({
    userName: "User Name",
    companyName: "Company Name",
  });
  assert.equal(res.fullName, "User Name");

  // Priority 4: Company name
  res = resolveContactName({
    companyName: "Company Name",
  });
  assert.equal(res.fullName, "Company Name");

  // Fallback when all empty
  res = resolveContactName({});
  assert.equal(res.fullName, "Contact");
});

test("vCard: Escape special characters (commas, semicolons, backslashes, newlines)", () => {
  const escapedStr = escapeVCardValue("John, CEO; Tech\\Corp\nLine2");
  assert.equal(escapedStr, "John\\, CEO\\; Tech\\\\Corp Line2");

  const result = buildVCardString({
    profileName: "John, CEO",
    companyName: "Acme, Inc.",
    title: "Lead; Senior\\Engineer",
  });

  assert.equal(result.fn, "FN:John\\, CEO");
  assert.equal(result.n, "N:CEO;John\\,;;;");
  assert.match(result.vcard, /ORG:Acme\\, Inc\./);
  assert.match(result.vcard, /TITLE:Lead\\; Senior\\\\Engineer/);
});

test("vCard: Guarantees RFC 6350 compliance and CRLF line endings", () => {
  const result = buildVCardString({
    profileName: "Test User",
    email: "test@example.com",
  });

  assert.match(result.vcard, /\r\n/);
  const lines = result.vcard.split("\r\n");
  assert.equal(lines[0], "BEGIN:VCARD");
  assert.equal(lines[1], "VERSION:3.0");
  assert.equal(lines[lines.length - 1], "END:VCARD");
});
