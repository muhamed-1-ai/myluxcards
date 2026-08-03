import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkout = readFileSync(new URL("../src/app/api/checkout/route.ts", import.meta.url), "utf8");
const publicApp = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
const publicCard = readFileSync(new URL("../src/app/api/cards/public/[slug]/route.ts", import.meta.url), "utf8");
const publicLead = readFileSync(new URL("../src/app/api/cards/public/[slug]/lead/route.ts", import.meta.url), "utf8");
const cardsLibrary = readFileSync(new URL("../src/lib/cards.ts", import.meta.url), "utf8");

test("the storefront submits real orders and does not claim a demo order succeeded", () => {
  const handler = publicApp.slice(publicApp.indexOf("async completeCheckout"), publicApp.indexOf("setupCheckout"));
  assert.match(handler, /fetch\('\/api\/checkout'/);
  assert.match(handler, /if \(!response\.ok\)/);
  assert.doesNotMatch(handler, /Demo order placed/i);
});

test("custom-card prices are derived on the server from an allowlist", () => {
  assert.match(checkout, /White PVC[\s\S]*79900/);
  assert.match(checkout, /Matte Black PVC[\s\S]*89900/);
  assert.match(checkout, /input\.design\?\.expertDesign/);
  assert.match(checkout, /cleanOrderLogo/);
  assert.doesNotMatch(checkout, /Number\(.*price/i);
});

test("all public card mutations enforce same-origin requests", () => {
  assert.match(publicCard, /validMutationOrigin\(request\)/);
  assert.match(publicLead, /validMutationOrigin\(request\)/);
});

test("public card content filters unsafe URLs and image payloads", () => {
  assert.match(cardsLibrary, /cleanUrl/);
  assert.match(cardsLibrary, /cleanImage/);
  assert.match(cardsLibrary, /png\|jpeg\|webp\|gif/);
  assert.doesNotMatch(cardsLibrary, /image\/svg\+xml/);
  assert.match(cardsLibrary, /\.\.\.cleanCardProfile\(row\.profile/);
});

test("authenticated account button opens a real logout menu", () => {
  assert.match(publicApp, /accountDropdown\.hidden = !opening/);
  assert.match(publicApp, /fetch\('\/api\/auth\/logout', \{ method: 'POST' \}\)/);
  assert.match(publicApp, /localStorage\.removeItem\('myluxcards_current_user'\)/);
  assert.match(publicApp, /event\.key === 'Escape'/);
});
