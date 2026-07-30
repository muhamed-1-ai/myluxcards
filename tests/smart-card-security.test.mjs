import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202607300004_smart_cards.sql","utf8");
const cards = readFileSync("src/app/api/cards/route.ts","utf8");
const lead = readFileSync("src/app/api/cards/public/[slug]/lead/route.ts","utf8");
const activation = readFileSync("src/app/api/admin/cards/activation/route.ts","utf8");

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
