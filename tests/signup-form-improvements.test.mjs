import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePhoneNumber } from "../src/lib/phone.ts";

test("PHONE NORMALIZATION: handles optional, international, and duplicate +91 prefixes", () => {
  // Empty phone -> empty result
  const empty = normalizePhoneNumber("");
  assert.equal(empty.isValid, false);
  assert.equal(empty.normalized, "");

  // 10-digit Indian national number -> canonical E.164 +919876543210
  const indian10 = normalizePhoneNumber("9876543210");
  assert.equal(indian10.isValid, true);
  assert.equal(indian10.normalized, "+919876543210");

  // Already prefixed E.164
  const alreadyE164 = normalizePhoneNumber("+919876543210");
  assert.equal(alreadyE164.isValid, true);
  assert.equal(alreadyE164.normalized, "+919876543210");

  // Duplicate country code (+91 91...) -> strips duplicate country code
  const duplicate91 = normalizePhoneNumber("+91 919876543210");
  assert.equal(duplicate91.isValid, true);
  assert.equal(duplicate91.normalized, "+919876543210");

  // International US number
  const usNum = normalizePhoneNumber("+14155552671");
  assert.equal(usNum.isValid, true);
  assert.equal(usNum.normalized, "+14155552671");

  // Truncated / invalid input
  const truncated = normalizePhoneNumber("123");
  assert.equal(truncated.isValid, false);
  assert.ok(truncated.error);

  const nonDigits = normalizePhoneNumber("not-a-number");
  assert.equal(nonDigits.isValid, false);
  assert.ok(nonDigits.error);
});

test("CREATE ACCOUNT FORM: strictly verifies field order, visible labels, and placeholders", () => {
  const pageMarkup = readFileSync("src/app/page.tsx", "utf8");

  // Verify form structure inside signup modal
  const signupModalMatch = pageMarkup.match(/<div class="modal-overlay" id="signup-modal"[\s\S]*?<\/form>/);
  assert.ok(signupModalMatch, "signup-modal form must exist");
  const formContent = signupModalMatch[0];

  // 1. Verify Field Order:
  // Full Name -> Email Address -> Phone Number (optional) -> Password -> Confirm Password
  const namePos = formContent.indexOf('id="signup-name"');
  const emailPos = formContent.indexOf('id="signup-email"');
  const phonePos = formContent.indexOf('id="signup-phone"');
  const passwordPos = formContent.indexOf('id="signup-password"');
  const confirmPos = formContent.indexOf('id="signup-confirm-password"');

  assert.ok(namePos !== -1, "signup-name input must exist");
  assert.ok(emailPos !== -1, "signup-email input must exist");
  assert.ok(phonePos !== -1, "signup-phone input must exist");
  assert.ok(passwordPos !== -1, "signup-password input must exist");
  assert.ok(confirmPos !== -1, "signup-confirm-password input must exist");

  assert.ok(
    namePos < emailPos && emailPos < phonePos && phonePos < passwordPos && passwordPos < confirmPos,
    "Field sequence must strictly follow: Full Name, Email Address, Phone Number (optional), Password, Confirm Password"
  );

  // 2. Verify Permanent Labels and accessibility associations:
  assert.match(formContent, /<label\s+for="signup-name"[^>]*>Full Name<\/label>/);
  assert.match(formContent, /<label\s+for="signup-email"[^>]*>Email Address<\/label>/);
  assert.match(formContent, /<label\s+for="signup-phone"[^>]*>Phone Number\s*<span[^>]*>\(optional\)<\/span><\/label>/);
  assert.match(formContent, /<label\s+for="signup-password"[^>]*>Password<\/label>/);
  assert.match(formContent, /<label\s+for="signup-confirm-password"[^>]*>Confirm Password<\/label>/);

  // 3. Verify Exact Placeholders:
  assert.match(formContent, /placeholder="Enter your full name"/);
  assert.match(formContent, /placeholder="you@example.com"/);
  assert.match(formContent, /placeholder="Enter your phone number"/);
  assert.match(formContent, /placeholder="At least 12 characters"/);
  assert.match(formContent, /placeholder="Re-enter your password"/);

  // 4. Verify Phone is Genuinely Optional (no required attribute):
  const phoneTag = formContent.match(/<input[^>]+id="signup-phone"[^>]*>/);
  assert.ok(phoneTag, "Phone input must be rendered");
  assert.equal(phoneTag[0].includes("required"), false, "Phone input must NOT be marked required");

  // 5. Verify Password Controls:
  assert.match(formContent, /id="signup-password-toggle"/);
  assert.match(formContent, /id="signup-confirm-password-toggle"/);
  assert.match(formContent, /class="password-requirements"/);
  assert.match(formContent, /data-rule="length"/);
  assert.match(formContent, /data-rule="upper"/);
  assert.match(formContent, /data-rule="lower"/);
  assert.match(formContent, /data-rule="number"/);
  assert.match(formContent, /data-rule="symbol"/);
});

test("GOOGLE AUTH INDEPENDENCE: Google button is isolated from manual form validation", () => {
  const pageMarkup = readFileSync("src/app/page.tsx", "utf8");

  // Google button exists outside the <form id="signup-form">
  const formStart = pageMarkup.indexOf('<form id="signup-form"');
  const googleBtn = pageMarkup.indexOf('id="google-signup-btn"');

  assert.ok(googleBtn !== -1, "Google signup button must exist");
  assert.ok(formStart !== -1, "Signup form must exist");
  assert.ok(googleBtn < formStart, "Google signup button must be placed outside and before manual form");

  // Button must be type="button" and trigger window.app.loginWithGoogle()
  const btnTag = pageMarkup.slice(googleBtn - 50, googleBtn + 150);
  assert.match(btnTag, /type="button"/);
  assert.match(btnTag, /onclick="window\.app\.loginWithGoogle\(\)"/);
});

test("CSS STYLING & MOBILE RESPONSIVENESS: Label visibility, spacing, and scrollability", () => {
  const css = readFileSync("src/app/landing.css", "utf8");

  // Max-height constraint and internal scrolling for mobile / keyboard safety
  assert.match(css, /\.zappit-login-panel\s*\{[\s\S]*?max-height:\s*90vh/);
  assert.match(css, /\.zappit-login-panel\s*\{[\s\S]*?overflow-y:\s*auto/);

  // High-contrast labels in light theme
  assert.match(css, /\.zappit-login-panel label[\s\S]*?color:\s*#1E293B/);
  assert.match(css, /\.zappit-login-panel label[\s\S]*?margin-bottom:\s*6px/);

  // Spacing between form groups (~15–20px)
  assert.match(css, /\.zappit-login-panel \.form-group[\s\S]*?margin-bottom:\s*15px/);

  // Dark mode theme support
  assert.match(css, /body\.dark-mode \.zappit-login-panel label[\s\S]*?color:\s*#F1F5F9/);
  assert.match(css, /body\.dark-mode \.zappit-login-panel\s*\{[\s\S]*?background:\s*#0B132B/);
});

test("CLIENT & SERVER PHONE INTEGRATION: optional throughout registration flow", () => {
  const routeCode = readFileSync("src/app/api/auth/signup/route.ts", "utf8");
  const authService = readFileSync("src/lib/authService.ts", "utf8");
  const clientJs = readFileSync("public/js/app.js", "utf8");

  // Client reads signup-phone and submits phone as string or null
  assert.match(clientJs, /document\.getElementById\('signup-phone'\)/);
  assert.match(clientJs, /phone:\s*rawPhone\s*\|\|\s*null/);

  // Route normalizes phone only when provided, rejects invalid format with 400
  assert.match(routeCode, /const rawPhone = typeof body\.phone === "string" \? body\.phone\.trim\(\) : "";/);
  assert.match(routeCode, /normalizePhoneNumber\(rawPhone\)/);
  assert.match(routeCode, /phone = phoneRes\.normalized;/);
  assert.match(routeCode, /createCredentialUser\(\{\s*name,\s*email,\s*password:\s*body\.password,\s*phone\s*\}\)/);

  // Service stores phone in profiles.phone
  assert.match(authService, /insert into profiles\(id, phone\) values\(\$1, \$2\)/);
});
