import test from "node:test";
import assert from "node:assert/strict";
import { cleanCardProfile, completeCardProfile, MAX_CONTACT_NUMBERS } from "../src/lib/cards.ts";
import { serializeContactToVCard } from "../src/lib/contactExport.ts";
import { buildVCardString } from "../src/lib/vcard.ts";
import { normalizePhoneNumber } from "../src/lib/phone.ts";

test("Legacy profiles: resolves single mobile into primary contactNumbers without duplication", () => {
  const legacyProfile = {
    name: "Febin Cholayil",
    mobile: "9876543210",
    countryCode: "+91",
  };

  const completed = completeCardProfile(legacyProfile);
  assert.ok(Array.isArray(completed.contactNumbers), "contactNumbers must be an array");
  assert.equal(completed.contactNumbers.length, 1, "Must synthesize exactly 1 primary row");
  assert.equal(completed.contactNumbers[0].phoneNumber, "9876543210");
  assert.equal(completed.contactNumbers[0].countryCode, "+91");
  assert.equal(completed.contactNumbers[0].isPrimary, true);
  assert.equal(completed.mobile, "9876543210");

  // Re-cleaning must not duplicate or alter the synthesized row
  const cleanedAgain = cleanCardProfile(completed);
  assert.equal(cleanedAgain.contactNumbers.length, 1);
  assert.equal(cleanedAgain.contactNumbers[0].phoneNumber, "9876543210");
});

test("Multi-number: allows up to MAX_CONTACT_NUMBERS with independent countries and custom labels", () => {
  assert.equal(MAX_CONTACT_NUMBERS, 5, "Central limit must be 5");

  const inputProfile = {
    name: "Global Executive",
    countryCode: "+91",
    mobile: "9876543210",
    contactNumbers: [
      { id: "1", label: "Mobile", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
      { id: "2", label: "US Office", countryCode: "+1", phoneNumber: "2025550143", isPrimary: false },
      { id: "3", label: "UK Direct", countryCode: "+44", phoneNumber: "7911123456", isPrimary: false },
      { id: "4", label: "Dubai Branch", countryCode: "+971", phoneNumber: "501234567", isPrimary: false },
      { id: "5", label: "Emergency", countryCode: "+91", phoneNumber: "9876543219", isPrimary: false },
      { id: "6", label: "Excess Number", countryCode: "+91", phoneNumber: "9999999999", isPrimary: false },
    ],
  };

  const cleaned = cleanCardProfile(inputProfile);
  assert.equal(cleaned.contactNumbers.length, 5, "Must enforce MAX_CONTACT_NUMBERS cap of 5");
  assert.equal(cleaned.contactNumbers[0].phoneNumber, "9876543210");
  assert.equal(cleaned.contactNumbers[0].countryCode, "+91");
  assert.equal(cleaned.contactNumbers[1].phoneNumber, "2025550143");
  assert.equal(cleaned.contactNumbers[1].countryCode, "+1");
  assert.equal(cleaned.contactNumbers[2].countryCode, "+44");
  assert.equal(cleaned.contactNumbers[3].countryCode, "+971");
  assert.equal(cleaned.contactNumbers[4].countryCode, "+91");
});

test("Duplicate number rejection: normalized duplicate phone numbers are removed server-side", () => {
  const profileWithDuplicates = {
    name: "Test User",
    countryCode: "+91",
    mobile: "9876543210",
    contactNumbers: [
      { id: "1", label: "Primary", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
      // Duplicate of row 1 in different format (with spaces and country code)
      { id: "2", label: "Duplicate 1", countryCode: "+91", phoneNumber: "+91 98765 43210", isPrimary: false },
      // Duplicate of row 1 with leading 0
      { id: "3", label: "Duplicate 2", countryCode: "+91", phoneNumber: "09876543210", isPrimary: false },
      // Distinct number
      { id: "4", label: "Work", countryCode: "+91", phoneNumber: "9876543211", isPrimary: false },
    ],
  };

  const cleaned = cleanCardProfile(profileWithDuplicates);
  assert.equal(cleaned.contactNumbers.length, 2, "Duplicates must be filtered out");
  assert.equal(cleaned.contactNumbers[0].phoneNumber, "9876543210");
  assert.equal(cleaned.contactNumbers[1].phoneNumber, "9876543211");
});

test("WhatsApp compatibility: WhatsApp follows only primary mobile and preserves independent value", () => {
  // Case A: sameAsMobile behavior
  const cardA = {
    mobile: "9876543210",
    whatsapp: "9876543210",
    countryCode: "+91",
    contactNumbers: [
      { id: "1", label: "Mobile", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
      { id: "2", label: "Work", countryCode: "+1", phoneNumber: "2025550199", isPrimary: false },
    ],
  };

  const cleanedA = cleanCardProfile(cardA);
  assert.equal(cleanedA.mobile, "9876543210");
  assert.equal(cleanedA.whatsapp, "9876543210");
  assert.equal(cleanedA.contactNumbers.length, 2);

  // Case B: independent WhatsApp number is preserved
  const cardB = {
    mobile: "9876543210",
    whatsapp: "9123456789",
    countryCode: "+91",
    contactNumbers: [
      { id: "1", label: "Mobile", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
      { id: "2", label: "Support", countryCode: "+91", phoneNumber: "9988776655", isPrimary: false },
    ],
  };

  const cleanedB = cleanCardProfile(cardB);
  assert.equal(cleanedB.mobile, "9876543210");
  assert.equal(cleanedB.whatsapp, "9123456789", "Independent WhatsApp number must remain untouched");
});

test("Primary promotion: when primary row is replaced/promoted, mobile and countryCode sync", () => {
  // Simulate promoting the second row to primary
  const originalNumbers = [
    { id: "1", label: "Mobile", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
    { id: "2", label: "Work", countryCode: "+1", phoneNumber: "2025550199", isPrimary: false },
  ];

  // Remove row 1 and promote row 2
  const promotedList = [
    { ...originalNumbers[1], isPrimary: true, label: "Work" },
  ];

  const cleaned = cleanCardProfile({
    name: "User",
    mobile: promotedList[0].phoneNumber,
    countryCode: promotedList[0].countryCode,
    contactNumbers: promotedList,
  });

  assert.equal(cleaned.mobile, "2025550199");
  assert.equal(cleaned.countryCode, "+1");
  assert.equal(cleaned.contactNumbers[0].isPrimary, true);
  assert.equal(cleaned.contactNumbers[0].phoneNumber, "2025550199");
});

test("vCard serialization: includes primary phone and all additional contact numbers with labels", () => {
  const contactData = {
    name: "Febin Cholayil",
    companyName: "3gzappit",
    jobTitle: "CEO",
    countryCode: "+91",
    mobile: "9876543210",
    contactNumbers: [
      { id: "1", label: "Mobile", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
      { id: "2", label: "Work", countryCode: "+1", phoneNumber: "2025550143", isPrimary: false },
      { id: "3", label: "UK Office", countryCode: "+44", phoneNumber: "7911123456", isPrimary: false },
    ],
  };

  const vCardString = serializeContactToVCard(contactData);

  // Must contain RFC 6350 headers
  assert.ok(vCardString.includes("BEGIN:VCARD"), "Must have BEGIN:VCARD");
  assert.ok(vCardString.includes("VERSION:3.0"), "Must have VERSION:3.0");
  assert.ok(vCardString.includes("FN:Febin Cholayil"), "Must have FN");

  // Primary phone
  assert.ok(
    vCardString.includes("TEL;TYPE=CELL:+919876543210") || vCardString.includes("+919876543210"),
    "Must contain primary phone number"
  );

  // Additional numbers
  assert.ok(
    vCardString.includes("TEL;TYPE=WORK:+12025550143") || vCardString.includes("+12025550143"),
    "Must contain US Work phone"
  );
  assert.ok(
    vCardString.includes("TEL;TYPE=\"UK OFFICE\":+447911123456") ||
    vCardString.includes("TEL;TYPE=UK_OFFICE:+447911123456") ||
    vCardString.includes("+447911123456"),
    "Must contain UK Office phone"
  );
  assert.ok(vCardString.includes("END:VCARD"), "Must terminate with END:VCARD");
});

test("RFC 6350 Label Escaping: special characters in labels do not break vCard syntax", () => {
  const { vcard } = buildVCardString({
    profileName: "Test User",
    phone: "+919876543210",
    additionalPhones: [
      { label: "Dept, Legal; HQ", number: "+919876543211" },
    ],
  });

  assert.ok(vcard.includes("BEGIN:VCARD"));
  assert.ok(vcard.includes("END:VCARD"));
  assert.ok(vcard.includes("TEL;TYPE=DEPTLEGALHQ:+919876543211"));
});

test("Backward compatibility: older update payload omitting contactNumbers preserves saved numbers", () => {
  const existingProfile = {
    name: "Febin",
    mobile: "9876543210",
    countryCode: "+91",
    contactNumbers: [
      { id: "1", label: "Mobile", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
      { id: "2", label: "Work", countryCode: "+1", phoneNumber: "2025550143", isPrimary: false },
    ],
  };

  // Older payload omitting contactNumbers entirely
  const olderUpdatePayload = {
    title: "Senior Director",
    email: "febin@zappit.link",
  };

  const mergedInput = { ...existingProfile, ...olderUpdatePayload };
  if (olderUpdatePayload.contactNumbers === undefined && existingProfile.contactNumbers !== undefined) {
    mergedInput.contactNumbers = existingProfile.contactNumbers;
  }

  const cleaned = cleanCardProfile(mergedInput);
  assert.equal(cleaned.contactNumbers.length, 2, "Saved numbers must not be erased");
  assert.equal(cleaned.title, "Senior Director");
});

test("Ignore blank added rows: completely blank additional rows are omitted on save", () => {
  const profileWithBlanks = {
    name: "Febin",
    mobile: "9876543210",
    countryCode: "+91",
    contactNumbers: [
      { id: "1", label: "Mobile", countryCode: "+91", phoneNumber: "9876543210", isPrimary: true },
      { id: "2", label: "Empty row 1", countryCode: "+91", phoneNumber: "", isPrimary: false },
      { id: "3", label: "Empty row 2", countryCode: "+1", phoneNumber: "   ", isPrimary: false },
      { id: "4", label: "Valid Office", countryCode: "+44", phoneNumber: "7911123456", isPrimary: false },
    ],
  };

  const cleaned = cleanCardProfile(profileWithBlanks);
  assert.equal(cleaned.contactNumbers.length, 2, "Blank additional rows must be omitted");
  assert.equal(cleaned.contactNumbers[0].phoneNumber, "9876543210");
  assert.equal(cleaned.contactNumbers[1].phoneNumber, "7911123456");
});
