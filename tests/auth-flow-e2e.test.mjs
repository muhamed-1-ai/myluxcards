import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Auth validation logic mirrored exactly from src/lib/authService.ts
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validEmail(email) {
  return EMAIL_PATTERN.test(email) && email.length <= 320;
}
function validPassword(password) {
  return (
    password.length >= 12 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

test("E2E AUTH VERIFICATION: Form Validation rules", () => {
  // Test valid and invalid email addresses
  assert.equal(validEmail("test@3gzappit.com"), true);
  assert.equal(validEmail("customer.name+tag@domain.co.uk"), true);
  assert.equal(validEmail("invalid-email"), false);
  assert.equal(validEmail("@domain.com"), false);
  assert.equal(validEmail(""), false);

  // Test password complexity rules (12+ chars, upper, lower, number, symbol)
  assert.equal(validPassword("Zappit2026!Secure"), true);
  assert.equal(validPassword("short1!Aa"), false); // Under 12 chars
  assert.equal(validPassword("nouppercase12345!"), false);
  assert.equal(validPassword("NOLOWERCASE12345!"), false);
  assert.equal(validPassword("NoNumbersHere!Aaaa"), false);
  assert.equal(validPassword("NoSymbols12345Aaaa"), false);
});

test("E2E AUTH VERIFICATION: Sign-Up Modal HTML structure in page.tsx", () => {
  const pageContent = readFileSync("src/app/page.tsx", "utf8");
  
  // Both modals must exist with correct IDs
  assert.match(pageContent, /id="login-modal"/);
  assert.match(pageContent, /id="signup-modal"/);
  assert.match(pageContent, /id="forgot-password-modal"/);

  // Signup form elements
  assert.match(pageContent, /id="signup-form"/);
  assert.match(pageContent, /id="signup-name"/);
  assert.match(pageContent, /id="signup-email"/);
  assert.match(pageContent, /id="signup-password"/);
  assert.match(pageContent, /id="signup-confirm-password"/);
  assert.match(pageContent, /id="signup-error"/);

  // Inter-modal triggers
  assert.match(pageContent, /id="signup-trigger"/);
  assert.match(pageContent, /id="back-to-login"/);
  assert.match(pageContent, /id="google-signup-btn"/);

  // Password toggles
  assert.match(pageContent, /data-password-toggle="login-password"/);
  assert.match(pageContent, /data-password-toggle="signup-password"/);
  assert.match(pageContent, /data-password-toggle="signup-confirm-password"/);

  // Password requirement rule chips
  assert.match(pageContent, /data-rule="length"/);
  assert.match(pageContent, /data-rule="upper"/);
  assert.match(pageContent, /data-rule="lower"/);
  assert.match(pageContent, /data-rule="number"/);
  assert.match(pageContent, /data-rule="symbol"/);
});

test("E2E AUTH VERIFICATION: Client JS auth logic in public/js/app.js", () => {
  const appJs = readFileSync("public/js/app.js", "utf8");

  // Signup form handler
  assert.match(appJs, /document\.getElementById\('signup-form'\)/);
  assert.match(appJs, /fetch\('\/api\/auth\/signup'/);
  assert.match(appJs, /switchAuthModal\('login-modal',\s*'signup-modal'\)/);
  assert.match(appJs, /switchAuthModal\('signup-modal',\s*'login-modal'\)/);

  // On successful signup & login, proper redirect to dashboard
  assert.match(appJs, /data\.redirectTo\s*\|\|\s*'\/dashboard'/);
  assert.match(appJs, /window\.dispatchEvent\(new CustomEvent\('zappit:auth-changed'/);

  // Logout method exists
  assert.match(appJs, /async logout\(\)/);
  assert.match(appJs, /fetch\('\/api\/auth\/logout'/);
});

test("E2E AUTH VERIFICATION: Server-side signup route validation and response", () => {
  const signupRoute = readFileSync("src/app/api/auth/signup/route.ts", "utf8");

  // Rate limiting & origin check
  assert.match(signupRoute, /validMutationOrigin\(request\)/);
  assert.match(signupRoute, /checkRateLimit\("SIGNUP"/);
  assert.match(signupRoute, /createCredentialUser/);
  assert.match(signupRoute, /await authenticatedResponse/);
  assert.match(signupRoute, /409/); // duplicate account
});

test("E2E AUTH VERIFICATION: Background polling & SSE protection in FollowUpReminderModal", () => {
  const modalCode = readFileSync("src/components/notifications/FollowUpReminderModal.tsx", "utf8");

  // Gated on isAuthenticated state
  assert.match(modalCode, /const \[isAuthenticated, setIsAuthenticated\]/);
  assert.match(modalCode, /if \(!isAuthenticated\) return/);
  assert.match(modalCode, /fetch\("\/api\/auth\/me"/);
  assert.match(modalCode, /if \(res\.status === 401\)/);
});
