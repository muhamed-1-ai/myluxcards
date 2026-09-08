import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const cardLibrary = readFileSync("src/lib/cards.ts", "utf8");
const featureRouteExists = existsSync("src/app/api/profile/features/route.ts");
const featureRoute = featureRouteExists ? readFileSync("src/app/api/profile/features/route.ts", "utf8") : "";
const publicCardClient = readFileSync("src/app/card/[slug]/PublicCardClient.tsx", "utf8");
const dashboardDemo = readFileSync("src/app/dashboard/DashboardDemo.tsx", "utf8");
const migration0026 = existsSync("db/migrations/0026_dynamic_profile_engine.sql") ? readFileSync("db/migrations/0026_dynamic_profile_engine.sql", "utf8") : "";

test("Dynamic Profile Engine - cards library defines profileFeatures and featureOrder", () => {
  assert.match(cardLibrary, /"profileFeatures","featureOrder"/);
  assert.match(cardLibrary, /DEFAULT_PROFILE_FEATURES/);
  assert.match(cardLibrary, /DEFAULT_FEATURE_ORDER/);
  assert.match(cardLibrary, /ProfileFeatureKey/);
});

test("Dynamic Profile Engine - API route implements GET and PATCH with audit logging", () => {
  assert.equal(featureRouteExists, true);
  assert.match(featureRoute, /export async function GET/);
  assert.match(featureRoute, /export async function PATCH/);
  assert.match(featureRoute, /validMutationOrigin/);
  assert.match(featureRoute, /PROFILE_FEATURE_UPDATED/);
});

test("Dynamic Profile Engine - PublicCardClient renders sections dynamically based on profileFeatures and featureOrder", () => {
  assert.match(publicCardClient, /profileFeatures/);
  assert.match(publicCardClient, /featureOrder/);
  assert.match(publicCardClient, /orderKeys\.map/);
});

test("Dynamic Profile Engine - DashboardDemo provides feature toggle manager, live status, and section reordering", () => {
  assert.match(dashboardDemo, /ProfileFeatureEngineManager/);
  assert.match(dashboardDemo, /PROFILE LIVE/);
  assert.match(dashboardDemo, /handleToggleFeature/);
  assert.match(dashboardDemo, /handleMoveFeature/);
});

test("Dynamic Profile Engine - Migration 0026 populates default profile feature settings", () => {
  assert.match(migration0026, /Dynamic Profile Engine/);
  assert.match(migration0026, /profileFeatures/);
  assert.match(migration0026, /BASIC_PROFILE/);
});
