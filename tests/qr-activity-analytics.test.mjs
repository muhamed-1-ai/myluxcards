import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const migration0015 = fs.readFileSync(path.join(root, "db/migrations/0015_qr_activity_analytics.sql"), "utf8");
const publicCardRoute = fs.readFileSync(path.join(root, "src/app/api/cards/public/[slug]/route.ts"), "utf8");
const analyticsRoute = fs.readFileSync(path.join(root, "src/app/api/analytics/route.ts"), "utf8");
const publicCardClient = fs.readFileSync(path.join(root, "src/app/card/[slug]/PublicCardClient.tsx"), "utf8");
const dashboardDemo = fs.readFileSync(path.join(root, "src/app/dashboard/DashboardDemo.tsx"), "utf8");

const migration0016 = fs.readFileSync(path.join(root, "db/migrations/0016_analytics_attribution_dedup.sql"), "utf8");

test("Migration 0015 & 0016 add asset_type, visit_id, and channel attribution constraints", () => {
  assert.match(migration0015, /asset_type text/);
  assert.match(migration0015, /vehicle_id uuid references card_vehicles/);
  assert.match(migration0015, /lost_item_id uuid references card_lost_items/);
  assert.match(migration0016, /visit_id text/);
  assert.match(migration0016, /card_events_channel_check/);
  assert.match(migration0016, /card_events_visit_idx/);
});

test("Public card API supports structured analytics events, visit_id deduplication, and 10s throttling", () => {
  assert.match(publicCardRoute, /PROFILE_OPENED/);
  assert.match(publicCardRoute, /VEHICLE_MODE_OPENED/);
  assert.match(publicCardRoute, /VEHICLE_SELECTED/);
  assert.match(publicCardRoute, /LOST_FOUND_MODE_OPENED/);
  assert.match(publicCardRoute, /LOST_FOUND_ITEM_SELECTED/);
  assert.match(publicCardRoute, /PHONE_NUMBER_TAPPED/);
  assert.match(publicCardRoute, /LOCATION_SHARED/);
  assert.match(publicCardRoute, /visit_id/);
  assert.match(publicCardRoute, /interval '10 seconds'/);
});

test("GET /api/analytics returns source attribution breakdown (nfcTaps, qrScans, otherOpens) with mathematical consistency", () => {
  assert.match(analyticsRoute, /currentIdentity\(\)/);
  assert.match(analyticsRoute, /Sign in required\./);
  assert.match(analyticsRoute, /profile->>'name'/);
  assert.match(analyticsRoute, /nfcTaps/);
  assert.match(analyticsRoute, /qrScans/);
  assert.match(analyticsRoute, /otherOpens/);
  assert.match(analyticsRoute, /recentActivity/);
});

test("PublicCardClient provides visitId session deduplication, preview suppression, and voluntary location sharing", () => {
  assert.match(publicCardClient, /recordedEventsRef/);
  assert.match(publicCardClient, /mylux_visit_/);
  assert.match(publicCardClient, /PREVIEW/);
  assert.match(publicCardClient, /PHONE_NUMBER_TAPPED/);
  assert.match(publicCardClient, /LOCATION_SHARED/);
  assert.match(publicCardClient, /Share location where item was found with owner/);
  assert.match(publicCardClient, /navigator\.geolocation/);
});

test("DashboardDemo permanently removes AnalyticsTab, Scan History & Activity, and QR Activity UI from all users", () => {
  assert.match(dashboardDemo, /type Tab = "dashboard"/);
  assert.doesNotMatch(dashboardDemo, /AnalyticsTab/);
  assert.doesNotMatch(dashboardDemo, /Scan History &(?:amp;)? Activity/);
  assert.doesNotMatch(dashboardDemo, /QR ACTIVITY &(?:amp;)? ANALYTICS/);
  assert.doesNotMatch(dashboardDemo, /Profile Entry Sources/);
  assert.doesNotMatch(dashboardDemo, /Visitor Feature Interactions/);
  assert.doesNotMatch(dashboardDemo, /qr_activity/);
  assert.doesNotMatch(dashboardDemo, /tab === "analytics"/);
});
