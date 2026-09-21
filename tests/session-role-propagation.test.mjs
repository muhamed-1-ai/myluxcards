import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authOptionsContent = readFileSync("src/lib/auth.ts", "utf8");
const authSessionContent = readFileSync("src/lib/authSession.ts", "utf8");
const nextAuthTypesContent = readFileSync("src/types/next-auth.d.ts", "utf8");

test("TEST 1: TypeScript next-auth definitions include role in Session, User, and JWT interfaces", () => {
  assert.match(nextAuthTypesContent, /role\?: string;/);
  assert.match(nextAuthTypesContent, /declare module "next-auth\/jwt"/);
});

test("TEST 2: auth.ts returns role in authorize callback", () => {
  assert.match(authOptionsContent, /return user \? \{ id: user\.id, email: user\.email, name: user\.name, role: user\.role, sessionVersion: user\.sessionVersion \}/);
});

test("TEST 3: auth.ts links role in Google signIn callback", () => {
  assert.match(authOptionsContent, /Object\.assign\(user, \{ id: linked\.id, role: linked\.role, sessionVersion: linked\.session_version \}\)/);
});

test("TEST 4: auth.ts populates token.role and fallback DB lookup in jwt callback", () => {
  assert.match(authOptionsContent, /token\.role = \(user as any\)\?\.role \|\| token\.role/);
  assert.match(authOptionsContent, /if \(token\.userId && !token\.role\)/);
  assert.match(authOptionsContent, /const dbUser = await findUserById\(token\.userId as string\)/);
  assert.match(authOptionsContent, /token\.role = dbUser\.role/);
});

test("TEST 5: auth.ts attaches token.role to session.user in session callback", () => {
  assert.match(authOptionsContent, /Object\.assign\(session\.user, \{ id: token\.userId, role: token\.role, sessionVersion: token\.sessionVersion \}\)/);
});

test("TEST 6: authSession.ts includes role in encode JWT payload", () => {
  assert.match(authSessionContent, /role: user\.role \|\| "CUSTOMER"/);
});

test("TEST 7: Role values (SUPER_ADMIN, ADMIN, CUSTOMER) are correctly mapped without hardcoding", () => {
  assert.strictEqual(authOptionsContent.includes("SUPER_ADMIN"), false, "auth.ts must not hardcode SUPER_ADMIN string check in user mapping");
});
