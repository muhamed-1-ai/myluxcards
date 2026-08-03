import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202607300004_smart_cards.sql","utf8");
const cards = readFileSync("src/app/api/cards/route.ts","utf8");
const lead = readFileSync("src/app/api/cards/public/[slug]/lead/route.ts","utf8");
const publicCard = readFileSync("src/app/api/cards/public/[slug]/route.ts","utf8");
const activation = readFileSync("src/app/api/admin/cards/activation/route.ts","utf8");
const customerActivation = readFileSync("src/app/api/cards/activate/route.ts","utf8");
const dashboard = readFileSync("src/app/dashboard/DashboardDemo.tsx","utf8");
const cardLibrary = readFileSync("src/lib/cards.ts","utf8");

test("digital card data is owner scoped and protected by RLS", () => {
  assert.match(migration,/digital_cards_owner_read/);
  assert.match(migration,/owner_id=auth\.uid\(\)/);
  assert.match(cards,/currentIdentity\(\)/);
  assert.match(cards,/owner_id=eq\.\$\{identity\.id\}/);
});

test("public lead exchange requires explicit consent", () => {
  assert.match(lead,/body\.consent !== true/);
  assert.match(migration,/consent_at timestamptz not null/);
});

test("activation stores a hash and requires an administrator to provision", () => {
  assert.match(activation,/requireAdmin\(\)/);
  assert.match(activation,/hashActivationCode\(code\)/);
  assert.doesNotMatch(activation,/activation_code_hash:code/);
});

test("replacing an activation code never switches a working card off", () => {
  assert.doesNotMatch(activation, /activation_code_hash:hashActivationCode\(code\),\s*activated_at:null/);
  assert.doesNotMatch(activation, /activation_code_hash:hashActivationCode\(code\),\s*active:false/);
});

test("activated cards stay published until the customer manually changes status", () => {
  assert.match(customerActivation, /expires_at: null/);
  assert.match(cardLibrary, /Boolean\(row\.active && row\.activated_at\)/);
  assert.doesNotMatch(cardLibrary, /new Date\(row\.expires_at\)/);
  assert.match(publicCard, /Boolean\(row\.active && row\.activated_at\)/);
  assert.doesNotMatch(publicCard, /new Date\(row\.expires_at\)/);
});

test("profile autosave cannot silently change publication status", () => {
  assert.match(cards, /body\.updateActive === true/);
  assert.match(dashboard, /updateActive:true/);
});

test("dashboard warns about inactive cards and automatically saves edits", () => {
  assert.match(dashboard, /Your card is not active yet/);
  assert.match(dashboard, /Your card is switched off/);
  assert.match(dashboard, /window\.setTimeout\(\(\) => \{ void save\("dashboard", undefined, true\); \}, 1200\)/);
  assert.match(dashboard, /Cloud save failed/);
});
