import assert from "node:assert/strict";
import test from "node:test";
import { cleanCardProfile, completeCardProfile, safePublicCard } from "../src/lib/cards";
import { runProfileMigration } from "../scripts/migrate-profiles-to-modern";

// Unit Tests for Authoritative Approved Template Enforcement
test("cleanCardProfile: retired 'standard' format always normalizes to canonical 'modern'", () => {
  const input = {
    name: "John Doe",
    profileFormat: "standard",
    profileBackground: "#000000",
  };
  const cleaned = cleanCardProfile(input);
  assert.equal(cleaned.profileFormat, "modern", "profileFormat must be modern even if standard is submitted");
});

test("cleanCardProfile: missing or invalid format resolves to canonical 'modern'", () => {
  const cleanedNull = cleanCardProfile({ profileFormat: null });
  assert.equal(cleanedNull.profileFormat, "modern");

  const cleanedInvalid = cleanCardProfile({ profileFormat: "vintage_gold_v1" });
  assert.equal(cleanedInvalid.profileFormat, "modern");
});

test("completeCardProfile: new blank profile receives Screenshot 2 approved theme defaults", () => {
  const profile = completeCardProfile({});
  assert.equal(profile.profileFormat, "modern");
  assert.equal(profile.profileBackground, "#050B14");
  assert.equal(profile.profileAccent, "#0066FF");
  assert.equal(profile.profileText, "#ffffff");
});

test("completeCardProfile: legacy gold or retired standard profile colors convert to approved blue theme", () => {
  const legacyProfile = completeCardProfile({
    profileFormat: "standard",
    profileBackground: "#FFFFFF",
    profileAccent: "#FFAE00",
    name: "Hafiz Rahman pk",
    mobile: "6282836951",
    email: "hafiz@example.com",
    social: { Instagram: "https://instagram.com/hafiz" },
  });

  assert.equal(legacyProfile.profileFormat, "modern", "profileFormat must be modern");
  assert.equal(legacyProfile.profileAccent, "#0066FF", "Legacy gold accent must convert to approved blue");
  assert.equal(legacyProfile.name, "Hafiz Rahman pk", "User name must be preserved");
  assert.equal(legacyProfile.mobile, "6282836951", "User phone must be preserved");
  assert.equal(legacyProfile.email, "hafiz@example.com", "User email must be preserved");
  assert.equal(legacyProfile.social.Instagram, "https://instagram.com/hafiz", "User links must be preserved");
});

test("completeCardProfile: custom approved colors on modern profile are preserved without mutation", () => {
  const customModernProfile = completeCardProfile({
    profileFormat: "modern",
    profileBackground: "#111827",
    profileAccent: "#3B82F6",
    profileText: "#E5E7EB",
    name: "Muhammed Febin",
  });

  assert.equal(customModernProfile.profileFormat, "modern");
  assert.equal(customModernProfile.profileBackground, "#111827");
  assert.equal(customModernProfile.profileAccent, "#3B82F6");
  assert.equal(customModernProfile.profileText, "#E5E7EB");
  assert.equal(customModernProfile.name, "Muhammed Febin");
});

test("safePublicCard: always sanitizes and outputs modern format for public visitors", () => {
  const cardRow = {
    id: "card-123456",
    slug: "john-doe",
    owner_id: "user-123456",
    active: true,
    profile: {
      name: "John Doe",
      profileFormat: "standard",
      profileAccent: "#FFAE00",
      mobile: "1234567890",
      emergencyContact: {
        name: "Jane Doe",
        phone: "9876543210",
        relationship: "Spouse",
      },
    },
  };

  const safe = safePublicCard(cardRow);
  assert.equal(safe.profileFormat, "modern");
  assert.equal(safe.name, "John Doe");
  assert.equal(safe.emergencyContact.name, "Jane Doe");
  assert.equal(safe.emergencyContact.phone, undefined, "Private phone must be scrubbed");
  assert.equal(safe.hasEmergencyPhone, true);
});

test("migration idempotency: database scan reports 0 remaining conversions after migration", async () => {
  const report = await runProfileMigration({ dryRun: true });
  assert.equal(report.requiringConversion, 0, "No profiles should require conversion after migration");
  assert.equal(report.unresolvedRecords, 0, "No unresolved records");
  assert.equal(report.alreadyApproved, report.totalInspected, "All inspected profiles must be already approved");
});
