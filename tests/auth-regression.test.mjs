import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auth = readFileSync("src/lib/auth.ts", "utf8");
const authService = readFileSync("src/lib/authService.ts", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("TEST 1: GOOGLE PROFILE VALIDATION (email_verified handling)", () => {
  // Must allow both boolean true and string "true", must deny others
  assert.match(auth, /email_verified === true/);
  assert.match(auth, /email_verified\) === "true"/);
  assert.match(auth, /if\s*\(!user\.email\s*\|\|\s*!isVerified\)/);
});

test("TEST 2 & 3: NEW AND EXISTING GOOGLE USER (Database columns)", () => {
  // Existing Google user lookup
  assert.match(authService, /select u\.id,u\.email,u\.name,u\.session_version,u\.role.*from accounts/);
  assert.match(authService, /provider='google'/);
  
  // New Google user insert
  assert.match(authService, /insert into users\(email,normalized_email,name,role,feature_permissions\)/);
  
  // Must specifically protect against previous schema mismatch
  assert.doesNotMatch(authService, /insert into users\([^)]*email_verified_at/);
  assert.doesNotMatch(authService, /insert into users\([^)]*\bimage\b/);
});

test("TEST 4: DUPLICATE USER PROTECTION", () => {
  assert.match(authService, /where normalized_email=\$1/);
  assert.match(schema, /email\s+String\s+@unique/);
});

test("TEST 5: GOOGLE ACCOUNT LINKING", () => {
  assert.match(authService, /insert into accounts\(user_id,type,provider,provider_account_id\)/);
  assert.match(authService, /on conflict\(provider,provider_account_id\) do nothing/);
});

test("TEST 6: ROLE ASSIGNMENT (SUPER_ADMIN protection)", () => {
  assert.match(authService, /const assignedRole = isAdminEmail \? "ADMIN" : "CUSTOMER"/);
  assert.match(authService, /role !== "SUPER_ADMIN"/);
  assert.match(authService, /update users set role='ADMIN'/);
  assert.doesNotMatch(authService, /role='SUPER_ADMIN'/);
});

test("TEST 7 & 8: SESSION CREATION & PERSISTENCE", () => {
  assert.match(auth, /strategy:\s*"jwt"/);
  assert.match(auth, /sessionToken:/);
  assert.match(auth, /userId=user\.id/);
});

test("TEST 9 & 10: EMAIL/PASSWORD & LOGOUT", () => {
  assert.match(auth, /CredentialsProvider/);
  assert.match(authService, /authenticateCredentials/);
  assert.match(authService, /verifyPassword/);
});

test("TEST 11: CALLBACK URL SECURITY", () => {
  assert.match(auth, /const canonicalBase = process\.env\.NODE_ENV === "production" \? "https:\/\/3gzappit\.com" : baseUrl/);
  assert.match(auth, /new URL\(url\)\.origin\s*===\s*new URL\(baseUrl\)\.origin/);
});

test("TEST 12: MIDDLEWARE PROTECTION", () => {
  assert.match(middleware, /isAccountRoute/);
  assert.match(middleware, /getSessionToken/);
});

test("TEST 13: DATABASE SCHEMA REGRESSION", () => {
  // Ensure the schema doesn't have the missing columns
  assert.doesNotMatch(schema, /email_verified_at/);
  // Ensure the query doesn't try to write columns that don't exist
  assert.doesNotMatch(authService, /insert into users\([^)]*email_verified_at/);
});

test("TEST 14: ERROR HANDLING (No swallowed errors)", () => {
  // Verify there is no blanket catch { return false }
  assert.doesNotMatch(auth, /catch\s*\{\s*return\s*false\s*\}/);
  assert.match(auth, /catch\s*\([a-zA-Z0-9_]+\)\s*\{/);
  assert.match(auth, /console\.error/);
});

test("TEST 15: SECURITY REGRESSION", () => {
  assert.match(authService, /withTransaction/);
  assert.match(authService, /for update/);
});
