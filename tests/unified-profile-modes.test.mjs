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

test("public API route supports visitor actions for NOTIFY_OWNER, EMERGENCY_CONTACT, and LOST_ITEM_FOUND", () => {
  assert.match(publicCardRoute, /NOTIFY_OWNER/);
  assert.match(publicCardRoute, /EMERGENCY_CONTACT/);
  assert.match(publicCardRoute, /LOST_ITEM_FOUND/);
  assert.match(publicCardRoute, /insert into card_leads/);
});

test("PublicCardClient renders dynamic activeView mode switcher and supports simultaneous features", () => {
  assert.match(publicCardClient, /useState<PublicProfileView>\("profile"\)/);
  assert.match(publicCardClient, /pc-mode-switcher-bar/);
  assert.match(publicCardClient, /pc-mode-switch-btn/);
  assert.match(publicCardClient, /NOTIFY_OWNER/);
  assert.match(publicCardClient, /LOST_ITEM_FOUND/);
  assert.match(publicCardClient, /MyLux Vehicle Connect/);
  assert.match(publicCardClient, /MyLux Lost &(?:amp;)? Found Tag/);
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
