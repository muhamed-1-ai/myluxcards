import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test("1. Landing page HTML contains floating navbar, backdrop, and accessible controls", () => {
  const pageContent = fs.readFileSync(path.join(rootDir, "src/app/page.tsx"), "utf-8");

  // Navbar wrapper & backdrop
  assert.match(pageContent, /class="navbar-wrapper"\s+id="navbar-wrapper"/, "Navbar wrapper must exist");
  assert.match(pageContent, /class="nav-backdrop"\s+id="nav-backdrop"/, "Nav backdrop overlay must exist for mobile");

  // Main navbar & container
  assert.match(pageContent, /<nav\s+class="navbar"\s+id="main-navbar"/, "Main navbar must exist");
  assert.match(pageContent, /class="navbar-container"/, "Navbar container must exist");

  // Logo on Left
  assert.match(pageContent, /<a\s+href="\/"\s+class="logo logo-img-link"\s+aria-label="Zappit Home"/, "Logo link must exist on left");

  // Nav menu
  assert.match(pageContent, /<ul\s+class="nav-menu"\s+id="nav-menu"/, "Nav menu list must exist");
  assert.match(pageContent, /id="nav-home-link"/, "Home link must exist");
  assert.match(pageContent, /id="nav-materials-link"/, "Cards link must exist");
  assert.match(pageContent, /id="nav-profile-link"/, "Profile link must exist");
  assert.match(pageContent, /id="nav-crm-link"/, "CRM link must exist");
  assert.match(pageContent, /id="nav-steps-link"/, "How It Works link must exist");
  assert.match(pageContent, /id="nav-bundles-link"/, "Bundles link must exist");
  assert.match(pageContent, /id="nav-faq-link"/, "FAQ link must exist");

  // Right controls
  assert.match(pageContent, /class="nav-actions"/, "Nav actions container must exist");

  // Cart trigger
  assert.match(pageContent, /id="cart-trigger"/, "Cart trigger button must exist");
  assert.match(pageContent, /aria-label="Open shopping cart"/, "Cart trigger must have accessible label");
  assert.match(pageContent, /aria-controls="cart-drawer"/, "Cart trigger must reference cart-drawer");
  assert.match(pageContent, /cart-count-badge/, "Cart trigger must contain dynamic badge element");

  // Account menu & trigger
  assert.match(pageContent, /id="account-menu"/, "Account menu wrapper must exist");
  assert.match(pageContent, /id="login-trigger"/, "Login trigger button must exist");
  assert.match(pageContent, /id="account-dropdown"/, "Account dropdown must exist");
  assert.match(pageContent, /id="account-dashboard"/, "Dashboard item in account dropdown must exist");
  assert.match(pageContent, /id="account-orders"/, "Orders item in account dropdown must exist");
  assert.match(pageContent, /id="account-logout"/, "Logout button in account dropdown must exist");

  // Hamburger button
  assert.match(pageContent, /id="hamburger"/, "Hamburger button must exist");
  assert.match(pageContent, /aria-controls="nav-menu"/, "Hamburger must control nav-menu");
  assert.match(pageContent, /aria-expanded="false"/, "Hamburger must initialize with aria-expanded false");
  assert.match(pageContent, /aria-label="Open navigation menu"/, "Hamburger must have descriptive aria-label");
});

test("2. CSS styles navbar as a sleek rounded floating pill with mobile responsiveness", () => {
  const landingCss = fs.readFileSync(path.join(rootDir, "src/app/landing.css"), "utf-8");

  // Floating navbar capsule
  assert.match(landingCss, /\.landing-page \.navbar\s*\{[^}]*border-radius:\s*9999px/s, "Navbar must be a rounded pill");
  assert.match(landingCss, /\.landing-page \.navbar-wrapper\s*\{[^}]*position:\s*fixed/s, "Navbar wrapper must be fixed");

  // Touch target rules (minimum 44x44px target area)
  assert.match(landingCss, /\.landing-page \.btn-icon::after|\.landing-page \.hamburger::after/, "Buttons must have extended touch targets for mobile");

  // Cart badge placement
  assert.match(landingCss, /\.landing-page \.badge-count\s*\{[^}]*position:\s*absolute/s, "Badge must be positioned absolute on cart trigger");

  // Hamburger animated transform
  assert.match(landingCss, /\.landing-page \.hamburger\[aria-expanded="true"\]\s+span:nth-child\(1\)/, "Hamburger must animate into X when open");
  assert.match(landingCss, /\.landing-page \.hamburger\[aria-expanded="true"\]\s+span:nth-child\(2\)/, "Middle hamburger line must hide when open");
  assert.match(landingCss, /\.landing-page \.hamburger\[aria-expanded="true"\]\s+span:nth-child\(3\)/, "Bottom hamburger line must rotate into X when open");

  // Backdrop overlay styles
  assert.match(landingCss, /\.landing-page \.nav-backdrop/, "Nav backdrop overlay must be styled");

  // Mobile nav drawer styles
  assert.match(landingCss, /\.landing-page \.nav-menu\.is-open/, "Mobile nav menu must have open state");
});

test("3. JavaScript coordinates mobile menu without duplicate clashing event listeners", () => {
  const appJs = fs.readFileSync(path.join(rootDir, "public/js/app.js"), "utf-8");
  const indexJs = fs.readFileSync(path.join(rootDir, "public/js/inline/index.js"), "utf-8");

  // Check that index.js and app.js prevent double-binding or coordinate via single handler
  assert.ok(
    appJs.includes("toggleMobileNav") || appJs.includes("closeMobileNav") || appJs.includes("dataset.navBound"),
    "app.js must provide or guard mobile navigation handlers"
  );
  assert.ok(
    indexJs.includes("navBound") || indexJs.includes("toggleMobileNav") || indexJs.includes("app.closeMobileNav"),
    "index.js must coordinate with app.js to prevent duplicate toggling"
  );

  // Check body scroll locking in JavaScript
  assert.ok(
    appJs.includes("mobile-nav-open") || indexJs.includes("mobile-nav-open") || appJs.includes("overflow = 'hidden'"),
    "Body scroll lock must be handled when mobile navigation opens"
  );
});

test("4. Account dropdown is constrained to viewport on mobile", () => {
  const landingCss = fs.readFileSync(path.join(rootDir, "src/app/landing.css"), "utf-8");

  // Account dropdown should have max-width or right: 0 constraint
  assert.match(landingCss, /\.landing-page \.account-dropdown\s*\{[^}]*right:\s*0/s, "Account dropdown must be right-aligned");
  assert.match(landingCss, /\.landing-page \.account-dropdown\s*\{[^}]*max-width:/s, "Account dropdown must have max-width constraint to prevent overflow");
});

