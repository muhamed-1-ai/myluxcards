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
const dashboardAdmin = readFileSync("src/app/admin/AdminApp.tsx","utf8");
const cardLibrary = readFileSync("src/lib/cards.ts","utf8");
const publicCardClient = readFileSync("src/app/card/[slug]/PublicCardClient.tsx","utf8");
const cardQr = readFileSync("src/app/api/cards/qr/route.ts","utf8");

test("digital card data is owner scoped and protected by RLS", () => {
  assert.match(migration,/digital_cards_owner_read/);
  assert.match(migration,/owner_id=auth\.uid\(\)/);
  assert.match(cards,/currentIdentity\(\)/);
  assert.match(cards,/owner_id=eq\.\$\{identity\.id\}/);
  assert.match(cards,/completeCardProfile\(row\.profile\)/);
  assert.match(cardLibrary,/export function completeCardProfile/);
});

test("public lead exchange requires explicit consent", () => {
  assert.match(lead,/body\.consent !== true/);
  assert.match(migration,/consent_at timestamptz not null/);
});

test("card provisioning requires an administrator", () => {
  assert.match(activation,/requireAdmin\(\)/);
  assert.match(activation,/role=eq\.CUSTOMER/);
  assert.match(activation,/customersWithoutCards/);
  assert.match(activation,/owner_id: ownerId/);
  assert.match(activation,/force-dynamic/);
  assert.match(dashboardAdmin,/section==="activations"\?"customers"/);
  assert.match(dashboardAdmin,/body:JSON\.stringify\(\{ownerId:customer\.id\}\)/);
});

test("digital cards stay published until the customer manually changes status", () => {
  assert.match(cardLibrary, /active: Boolean\(row\.active\)/);
  assert.match(publicCard, /publiclyActive = Boolean\(row\.active/);
});

test("profile autosave cannot silently change publication status", () => {
  assert.match(cards, /body\.updateActive === true/);
  assert.match(cards, /body\.toggleActive === true/);
  assert.match(cards, /active:!Boolean\(card\.active\)/);
  assert.match(cards, /slug=eq\.\$\{encodeURIComponent\(statusSlug\)\}&owner_id=eq\.\$\{identity\.id\}/);
  assert.match(dashboard, /toggleActive:true/);
  assert.match(dashboard, /JSON\.stringify\(\{id:card\.id,slug:card\.slug,toggleActive:true\}\)/);
});

test("dashboard manages card published status", () => {
  assert.match(dashboard, /Published until you switch it off/);
  assert.match(dashboard, /Currently switched off/);
  assert.match(dashboard, /toggleActive:true/);
});

test("dashboard identity and card ownership come from the authenticated server", () => {
  assert.match(dashboard, /DashboardDemo\(\{identity\}/);
  assert.match(dashboard, /const user = identity/);
  assert.match(dashboard, /const normalizeCard =/);
  assert.match(dashboard, /payload\.cards\.map\(\(card:Partial<Card>\) => normalizeCard\(card, user\)\)/);
  assert.match(dashboard, /storageKey\(user\.id\)/);
  assert.match(dashboard, /card\.ownerId === user\.id/);
  assert.doesNotMatch(dashboard, /storageKey\(user\.email\)/);
});

test("dashboard logout, uploads, and deletion use secure server state", () => {
  assert.match(dashboard, /fetch\("\/api\/auth\/logout", \{ method:"POST" \}\)/);
  assert.match(dashboard, /fetchWithSessionRefresh\("\/api\/media"/);
  assert.match(dashboard, /const remaining = cards\.filter\(card=>card\.id!==cardId\)/);
  assert.match(dashboard, /if \(!response\.ok\) \{ notify\(payload\.message \|\| "Card could not be removed\."\); return; \}/);
});

test("card QR generation is stable across loading and supports recovery", () => {
  assert.ok(
    publicCardClient.indexOf("const [qrOpen, setQrOpen] = useState(false)") < publicCardClient.indexOf("if (!loaded) return"),
    "QR hooks must run before the public card's conditional returns",
  );
  assert.match(publicCardClient, /setQrError\("Could not generate the QR code\. Please try again\."\)/);
  assert.match(publicCardClient, />Try again<\/button>/);
  assert.match(dashboard, /setQrSvg\(null\);[\s\S]*\}, \[card\.slug\]\)/);
  assert.match(cardQr, /QRCode\.toString\(cardUrl/);
  assert.match(cardQr, /Content-Type": "image\/svg\+xml"/);
});
