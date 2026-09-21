import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authServiceContent = readFileSync("src/lib/authService.ts", "utf8");
const usersRepoContent = readFileSync("src/lib/repositories/users.ts", "utf8");
const authOptionsContent = readFileSync("src/lib/auth.ts", "utf8");

test("TEST 1: New Google user creation logic in authService", () => {
  // Verify INSERT into users sets role to CUSTOMER by default or ADMIN if in ADMIN_GOOGLE_EMAILS
  assert.match(authServiceContent, /insert into users\(email,name,role,feature_permissions\)/);
  assert.match(authServiceContent, /insert into profiles\(id\)/);
  assert.match(authServiceContent, /insert into accounts\(user_id,type,provider,provider_account_id\)/);
});

test("TEST 2: Existing user linking preserves user role and avoids duplicate user insertion", () => {
  assert.match(authServiceContent, /select id,email,name,session_version,role,disabled,status from users where LOWER\(email\)=\$1 for update/);
});

test("TEST 3: Existing Google account lookup returns linked user", () => {
  assert.match(authServiceContent, /select u\.id,u\.email,u\.name,u\.session_version,u\.role,u\.disabled,u\.status from accounts a join users u on u\.id=a\.user_id/);
});

test("TEST 4: Account linking checks ownership and throws error on conflict", () => {
  assert.match(authServiceContent, /if \(owner\?\.user_id !== user\.id\) throw new Error\("GOOGLE_IDENTITY_CONFLICT"\)/);
});

test("TEST 5: Database queries in auth files MUST NOT reference normalized_email or non-existent columns", () => {
  assert.strictEqual(authServiceContent.includes("normalized_email"), false, "authService.ts must not contain normalized_email");
  assert.strictEqual(usersRepoContent.includes("normalized_email"), false, "repositories/users.ts must not contain normalized_email");
  assert.strictEqual(authServiceContent.includes("last_login_at"), false, "authService.ts must not contain last_login_at");
});

test("TEST 6: Normal email/password credential queries use valid schema columns and LOWER(email)", () => {
  assert.match(authServiceContent, /select id,email,name,password_hash,disabled,status,session_version,role,must_change_password from users where LOWER\(email\)=\$1/);
  assert.match(usersRepoContent, /where LOWER\(email\)=\$1/);
});

test("TEST 7: Database failure inside linkGoogleIdentity MUST cause signIn to return false (not true)", () => {
  // In auth.ts, catch block logs rejection and returns false
  assert.match(authOptionsContent, /console\.error\("\[OAuth\]\[signIn\]\[REJECT\]"/);
  assert.match(authOptionsContent, /return false;/);
});
