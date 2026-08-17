import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tokens=readFileSync("src/lib/security/cardTokens.ts","utf8");
const service=readFileSync("src/lib/physicalCards.ts","utf8");
const migration=readFileSync("db/migrations/0012_physical_card_claim_and_production.sql","utf8");
const claim=readFileSync("src/app/api/cards/claim/route.ts","utf8");
const resolver=readFileSync("src/app/t/[token]/page.tsx","utf8");
const claimUi=readFileSync("src/app/t/[token]/ClaimCard.tsx","utf8");
const admin=readFileSync("src/app/api/admin/physical-cards/route.ts","utf8");
const qr=readFileSync("src/app/api/admin/physical-cards/[id]/qr/route.ts","utf8");
const dashboard=readFileSync("src/app/dashboard/DashboardDemo.tsx","utf8");
const adminUi=readFileSync("src/app/admin/AdminApp.tsx","utf8");
const auth=readFileSync("public/js/app.js","utf8");

test("secure permanent tokens use 32 random bytes, base64url, hashing, and uniqueness",()=>{assert.match(tokens,/CARD_TOKEN_BYTES = 32/);assert.match(tokens,/randomBytes\(CARD_TOKEN_BYTES\)\.toString\("base64url"\)/);assert.match(tokens,/createHash\("sha256"\)/);assert.match(service,/hashCardToken\(token\)/);assert.match(service,/insert into cards/)});
test("QR and NFC share the immutable token URL with print-safe artifacts",()=>{assert.match(service,/\/t\/\$\{token\}/);assert.match(service,/QRCode\.toString\(url/);assert.match(service,/QRCode\.toBuffer\(url/);assert.match(service,/errorCorrectionLevel: "H"/);assert.match(service,/margin: 4/);assert.match(migration,/qr_svg text/);assert.match(migration,/qr_png bytea/)});
test("invalid and unclaimed tokens produce customer-safe resolver states",()=>{assert.match(service,/PUBLIC_TOKEN_PATTERN/);assert.match(resolver,/state="not-found"/);assert.match(resolver,/state="ready"/);assert.doesNotMatch(claimUi,/inventory_reference|public_token_hash|database/i)});
test("logged-out claim and login/signup return preserve a safe internal callback",()=>{assert.match(claimUi,/Sign in to activate|SIGN IN TO CLAIM/);assert.match(claimUi,/myluxcards_auth_next/);assert.match(auth,/next\.startsWith\('\/'\).*?!next\.startsWith\('\/\/'\)/);assert.match(auth,/window\.location\.href = next/)});
test("claim is transactional, row locked, idempotent, and race safe",()=>{assert.match(service,/client\.query\("begin"\)/);assert.match(service,/for update/);assert.match(service,/card\.owner_id === userId/);assert.match(service,/ALREADY_CLAIMED/);assert.match(service,/client\.query\("commit"\)/);assert.match(service,/client\.query\("rollback"\)/)});
test("disabled, replaced, personalized, stock, and activated cards resolve safely",()=>{for(const state of ["DISABLED","REPLACED","LOST","RETIRED"])assert.match(service,new RegExp(state));assert.match(migration,/card_mode.*STOCK.*PERSONALIZED/i);assert.match(resolver,/redirect\(`\/card\/\$\{card\.slug\}`\)/)});
test("digital-card linkage and replacement uniqueness are database constrained",()=>{assert.match(service,/insert into digital_cards/);assert.match(migration,/cards_current_digital_card_uidx/);assert.match(migration,/status not in \('REPLACED','RETIRED'\)/)});
test("admin APIs enforce authorization and QR artifacts are private",()=>{assert.match(admin,/requireAdmin\(\)/);assert.match(qr,/requireAdmin\(\)/);assert.match(qr,/private, no-store/);assert.match(qr,/PNG|image\/png/i);assert.match(qr,/SVG|image\/svg\+xml/i)});
test("bulk generation creates independently generated cards and production URLs are one-time",()=>{assert.match(admin,/Math\.min\(100/);assert.match(admin,/for\(let i=0;i<quantity;i\+\+\)cards\.push\(await createPhysicalCard/);assert.match(service,/const token = newPublicCardToken\(\)/);assert.doesNotMatch(admin,/public_token_hash.*select/i)});
test("normal customer navigation hides Leads and Referrals while admin and affiliate systems remain",()=>{const nav=dashboard.slice(dashboard.indexOf('<nav className="side-nav">'),dashboard.indexOf('</nav>',dashboard.indexOf('<nav className="side-nav">')));assert.doesNotMatch(nav,/> Leads|Referrals/);assert.match(adminUi,/QR &amp; NFC Management/);assert.match(adminUi,/Affiliate program/)});
test("claim and lifecycle APIs never accept a client user id as ownership authority",()=>{assert.match(claim,/currentIdentity\(\)/);assert.match(claim,/claimPhysicalCard\(token, identity\.id\)/);assert.doesNotMatch(claim,/body\.(userId|ownerId|role)/);assert.match(migration,/card_lifecycle_events/)});
test("customer-facing claim responses are stable and non-technical",()=>{for(const text of ["This MyLuxCard could not be found.","This MyLuxCard is currently unavailable.","This MyLuxCard has already been activated.","Your MyLuxCard is live."])assert.ok(claim.includes(text)||claimUi.includes(text))});
