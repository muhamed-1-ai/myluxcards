import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authTs = readFileSync("src/lib/auth.ts", "utf8");
const cardsRoute = readFileSync("src/app/api/cards/route.ts", "utf8");
const adminAuthTs = readFileSync("src/lib/adminAuth.ts", "utf8");

test("authOptions defines explicit sessionToken cookie configuration", () => {
  assert.match(authTs, /cookies\s*:\s*\{/, "authOptions must define explicit cookies configuration");
  assert.match(authTs, /sessionToken\s*:\s*\{/, "authOptions must define sessionToken configuration");
  assert.match(authTs, /__Secure-next-auth\.session-token/, "Production session token cookie name must be __Secure-next-auth.session-token");
  assert.match(authTs, /next-auth\.session-token/, "Development session token cookie name must be next-auth.session-token");
});

test("PUT /api/cards enforces origin and identity checks without modifying session_version", () => {
  assert.match(cardsRoute, /validMutationOrigin\(request\)/, "Origin validation required on card update");
  assert.match(cardsRoute, /currentIdentity\(\)/, "Identity validation required on card update");
  assert.doesNotMatch(cardsRoute, /session_version/, "PUT /api/cards must NOT modify or touch session_version");
  assert.doesNotMatch(cardsRoute, /update users/i, "PUT /api/cards must NOT update users table");
});

test("currentIdentity validates active status and session version", () => {
  assert.match(adminAuthTs, /getServerSession\(authOptions\)/, "Must use getServerSession with authOptions");
  assert.match(adminAuthTs, /profile\.session_version\s*!==\s*session\.user\.sessionVersion/, "Must check session_version equality");
});
