import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config.ts";

const authServiceContent = readFileSync("src/lib/authService.ts", "utf8");
const authOptionsContent = readFileSync("src/lib/auth.ts", "utf8");
const appJsContent = readFileSync("public/js/app.js", "utf8");
const rootAppJsContent = readFileSync("js/app.js", "utf8");
const pageContent = readFileSync("src/app/page.tsx", "utf8");

test("REGRESSION 1: authService.ts strictly does NOT reference non-existent normalized_email column", () => {
  assert.strictEqual(
    authServiceContent.includes("normalized_email"),
    false,
    "authService.ts must not reference non-existent 'normalized_email' column"
  );
});

test("REGRESSION 2: linkGoogleIdentityOnce uses LOWER(email) and valid users table schema", () => {
  // Case-insensitive lookup of existing user
  assert.match(
    authServiceContent,
    /select id,email,name,session_version,role,disabled,status from users where LOWER\(email\)=\$1 for update/
  );
  // Insertion of new Google user into valid columns only
  assert.match(
    authServiceContent,
    /insert into users\(email,name,role,feature_permissions\)\s*values\(\$1,\$2,\$3,\$4::jsonb\)/
  );
  // Zero feature permissions assigned to new users
  assert.match(authServiceContent, /ZERO_FEATURE_PERMISSIONS/);
});

test("REGRESSION 3: createCredentialUser and createAdminManagedUser use valid users schema without normalized_email", () => {
  assert.match(
    authServiceContent,
    /insert into users\(email, name, password_hash, feature_permissions, role\)\s*values\(\$1, \$2, \$3, \$4::jsonb, 'CUSTOMER'\)/
  );
  assert.match(
    authServiceContent,
    /insert into users\(email, name, password_hash, role, status, disabled, created_by_admin_id, feature_permissions\)\s*values\(\$1, \$2, \$3, 'CUSTOMER'/
  );
});

test("REGRESSION 4: auth.ts handles differentiated OAuth errors without confusing error grouping", () => {
  assert.match(authOptionsContent, /ACCOUNT_DISABLED/);
  assert.match(authOptionsContent, /GOOGLE_IDENTITY_CONFLICT/);
  assert.match(authOptionsContent, /return "\/\?error=AccountDisabled"/);
  assert.match(authOptionsContent, /return "\/\?error=IdentityConflict"/);
  assert.match(authOptionsContent, /return false;/);
});

test("REGRESSION 5: Client app.js clears stale errors and differentiates cancellation from account errors", () => {
  for (const [name, content] of [["public/js/app.js", appJsContent], ["js/app.js", rootAppJsContent]]) {
    // Stale error clearing
    assert.match(content, /const loginError = document\.getElementById\('login-error'\);[\s\S]*loginError\.textContent = '';/, `${name} must clear stale errors`);
    // Cancellation wording ONLY for AccessDenied
    assert.match(content, /oauthError === 'AccessDenied'[\s\S]*Google sign-in was cancelled\. Please try again\./, `${name} must show cancellation wording only for AccessDenied`);
    // Separate account disabled message
    assert.match(content, /oauthError === 'AccountDisabled'[\s\S]*This account has been disabled or suspended\./, `${name} must handle AccountDisabled`);
    // Separate conflict message
    assert.match(content, /oauthError === 'IdentityConflict'[\s\S]*already linked to another user\./, `${name} must handle IdentityConflict`);
  }
});

test("REGRESSION 6: Google buttons are independent button elements (not form submitters)", () => {
  // Must have type="button" and onclick handler
  assert.match(pageContent, /<button type="button" class="btn btn-google" id="google-login-btn"/);
  assert.match(pageContent, /<button type="button" class="btn btn-google" id="google-signup-btn"/);
});

test("REGRESSION 7: Live Database Integration - linkGoogleIdentity queries and account linking succeed", async () => {
  const pool = new Pool(databaseConfig());
  const client = await pool.connect();

  const dummyGoogleSub = `test-google-sub-${Date.now()}`;
  const dummyEmail = `test_google_user_${Date.now()}@example.com`;
  const dummyName = "Google Test User";

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // 1. Account lookup query by provider & provider_account_id
    const linkedLookup = await client.query(
      `select u.id,u.email,u.name,u.session_version,u.role,u.disabled,u.status from accounts a join users u on u.id=a.user_id
       where a.provider='google' and a.provider_account_id=$1 for update`,
      [dummyGoogleSub]
    );
    assert.equal(linkedLookup.rows.length, 0);

    // 2. User lookup query by LOWER(email)
    const userLookup = await client.query(
      "select id,email,name,session_version,role,disabled,status from users where LOWER(email)=$1 for update",
      [dummyEmail.toLowerCase()]
    );
    assert.equal(userLookup.rows.length, 0);

    // 3. User creation query
    const insertRes = await client.query(
      `insert into users(email,name,role,feature_permissions)
       values($1,$2,$3,$4::jsonb) returning id,email,name,session_version,role,disabled,status`,
      [dummyEmail.toLowerCase(), dummyName, "CUSTOMER", JSON.stringify({})]
    );
    const newUser = insertRes.rows[0];
    assert.ok(newUser.id, "New user must have ID");
    assert.equal(newUser.email, dummyEmail.toLowerCase());
    assert.equal(newUser.role, "CUSTOMER");

    // Profile insert
    await client.query("insert into profiles(id) values($1)", [newUser.id]);

    // 4. Accounts linking query
    await client.query(
      `insert into accounts(user_id,type,provider,provider_account_id) values($1,'oauth','google',$2)
       on conflict(provider,provider_account_id) do nothing`,
      [newUser.id, dummyGoogleSub]
    );

    // Verify account ownership
    const owner = (await client.query(
      "select user_id from accounts where provider='google' and provider_account_id=$1",
      [dummyGoogleSub]
    )).rows[0];
    assert.equal(owner.user_id, newUser.id);

    // 5. Subsequent Google login: lookup by provider & provider_account_id returns same user
    const existingLookup = (await client.query(
      `select u.id,u.email,u.name,u.session_version,u.role,u.disabled,u.status from accounts a join users u on u.id=a.user_id
       where a.provider='google' and a.provider_account_id=$1 for update`,
      [dummyGoogleSub]
    )).rows[0];
    assert.equal(existingLookup.id, newUser.id);

    // Rollback so live database is completely unchanged
    await client.query("ROLLBACK");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
});
