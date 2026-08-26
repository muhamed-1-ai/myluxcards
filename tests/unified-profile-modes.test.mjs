import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cardLibrary = readFileSync("src/lib/cards.ts", "utf8");
const publicCardRoute = readFileSync("src/app/api/cards/public/[slug]/route.ts", "utf8");
const publicCardClient = readFileSync("src/app/card/[slug]/PublicCardClient.tsx", "utf8");
const dashboardDemo = readFileSync("src/app/dashboard/DashboardDemo.tsx", "utf8");
const migration0012 = readFileSync("db/migrations/0012_unified_profile_modes.sql", "utf8");

test("cards library defines profileMode, enabledFeatures, vehicleConnect, emergencyContact, and lostAndFound", () => {
  assert.match(cardLibrary, /"profileMode","enabledFeatures","vehicleConnect","emergencyContact","lostAndFound"/);
  assert.match(cardLibrary, /export type ProfileMode = "DIGITAL_PROFILE" \| "VEHICLE_CONNECT" \| "LOST_AND_FOUND"/);
  assert.match(cardLibrary, /DEFAULT_ENABLED_FEATURES/);
  assert.match(cardLibrary, /DEFAULT_VEHICLE_CONNECT/);
  assert.match(cardLibrary, /DEFAULT_EMERGENCY_CONTACT/);
  assert.match(cardLibrary, /DEFAULT_LOST_AND_FOUND/);
});

test("safePublicCard enforces visitor privacy by sanitizing raw emergency phone numbers", () => {
  assert.match(cardLibrary, /sanitizedEmergencyContact = \{/);
  assert.match(cardLibrary, /hasPhone: Boolean\(emergencyPhone\)/);
  assert.match(cardLibrary, /hasEmergencyPhone: Boolean\(emergencyPhone\)/);
  assert.match(cardLibrary, /emergencyContact: sanitizedEmergencyContact/);
});

test("public API route validates phone numbers and rate limits LOST_ITEM_FOUND submissions", () => {
  assert.match(publicCardRoute, /NOTIFY_OWNER/);
  assert.match(publicCardRoute, /EMERGENCY_CONTACT/);
  assert.match(publicCardRoute, /LOST_ITEM_FOUND/);
  assert.match(publicCardRoute, /insert into card_leads/);
  assert.match(publicCardRoute, /Please enter a valid phone number/);
  assert.match(publicCardRoute, /interval '30 seconds'/);
});

test("PublicCardClient renders ultra-clean Vehicle Connect and Lost & Found finder contact flow", () => {
  assert.match(publicCardClient, /CONTACT VEHICLE OWNER/);
  assert.match(publicCardClient, /EMERGENCY CONTACT/);
  assert.doesNotMatch(publicCardClient, /Emergency Alert \(/);
  assert.match(publicCardClient, /SEND CONTACT NUMBER TO OWNER/);
  assert.match(publicCardClient, /type="tel"/);
  assert.doesNotMatch(publicCardClient, /Message \/ Where the item was found/);
  assert.match(publicCardClient, /Contact details sent/);
});

test("DashboardDemo provides independent feature entitlements toggles", () => {
  assert.match(dashboardDemo, /ModesForm/);
  assert.match(dashboardDemo, /Permanent Feature Entitlements/);
  assert.match(dashboardDemo, /enabledFeatures/);
  assert.match(dashboardDemo, /Vehicle Connect Settings/);
  assert.match(dashboardDemo, /Lost &(?:amp;)? Found Settings/);
});

test("Migration 0012 indexes profileMode for performance", () => {
  assert.match(migration0012, /create index if not exists digital_cards_profile_mode_idx/);
  assert.match(migration0012, /profile->>'profileMode'/);
});
