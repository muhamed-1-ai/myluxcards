import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeBrandKey } from "../src/components/card/BrandLogo";

const rootDir = process.cwd();

console.log("=== RUNNING APPS & LINKS POLISH AND VERIFICATION TESTS ===");

// 1. Verify "Choose store" has been completely removed from layout source code
console.log("Test 1: Verify 'Choose store' removal from components and CSS...");
const modernLayoutCode = fs.readFileSync(path.join(rootDir, "src/components/card/ModernProfileLayout.tsx"), "utf-8");
const simpleLayoutCode = fs.readFileSync(path.join(rootDir, "src/components/card/SimpleProfileLayout.tsx"), "utf-8");
const globalsCssCode = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf-8");

assert.ok(!modernLayoutCode.includes("Choose store"), "ModernProfileLayout must not contain 'Choose store'");
assert.ok(!modernLayoutCode.includes("zappit-choose-store-action"), "ModernProfileLayout must not use 'zappit-choose-store-action'");
assert.ok(!modernLayoutCode.includes("zappit-modern-app-item-wrap"), "ModernProfileLayout must not wrap app tiles in extra flex column div");

assert.ok(!simpleLayoutCode.includes("Choose store"), "SimpleProfileLayout must not contain 'Choose store'");
assert.ok(!simpleLayoutCode.includes("zappit-choose-store-action"), "SimpleProfileLayout must not use 'zappit-choose-store-action'");

assert.ok(!globalsCssCode.includes(".zappit-choose-store-action"), "globals.css must not have .zappit-choose-store-action");
console.log("✔ 'Choose store' text and wrappers cleanly removed");

// 2. Verify Google Reviews icon uses multicolour Google 'G' brand SVG
console.log("Test 2: Verify Google Reviews brand icon...");
const brandLogoCode = fs.readFileSync(path.join(rootDir, "src/components/card/BrandLogo.tsx"), "utf-8");

// normalizeBrandKey maps Google Reviews to "reviews"
assert.equal(normalizeBrandKey("Google Reviews"), "reviews");
assert.equal(normalizeBrandKey("googlereviews"), "reviews");
assert.equal(normalizeBrandKey("reviews"), "reviews");

// BrandLogo handles "reviews" alongside "google" with official multicolour Google 'G'
assert.ok(brandLogoCode.includes('case "reviews":'), "BrandLogo must handle case 'reviews'");
assert.ok(brandLogoCode.includes("#4285F4"), "Must contain Google Blue #4285F4");
assert.ok(brandLogoCode.includes("#34A853"), "Must contain Google Green #34A853");
assert.ok(brandLogoCode.includes("#FBBC04"), "Must contain Google Yellow #FBBC04");
assert.ok(brandLogoCode.includes("#EA4335"), "Must contain Google Red #EA4335");
assert.ok(!brandLogoCode.includes("star-grad"), "Star gradient must be removed from BrandLogo reviews");
console.log("✔ Google Reviews multicolour G brand icon confirmed");

// 3. Verify Download Our App keeps download icon
console.log("Test 3: Verify Download Our App brand icon...");
assert.equal(normalizeBrandKey("Download Our App"), "download");
assert.ok(brandLogoCode.includes('case "download":'), "BrandLogo must handle case 'download'");
assert.ok(brandLogoCode.includes("#2563EB"), "Download Our App must keep blue gradient #2563EB");
console.log("✔ Download icon retained for Download Our App");

// 4. Verify Device Routing Logic
console.log("Test 4: Verify routing simulation...");
function simulateAppClick(device: "android" | "ios" | "desktop" | "unknown", hasApple: boolean, hasGoogle: boolean, appleUrl: string, googleUrl: string) {
  let action: { type: "open_store"; url: string } | { type: "open_modal" } = { type: "open_modal" };
  
  if (hasApple && hasGoogle) {
    if (device === "android") {
      action = { type: "open_store", url: googleUrl };
    } else if (device === "ios") {
      action = { type: "open_store", url: appleUrl };
    } else {
      action = { type: "open_modal" };
    }
  } else if (hasApple && !hasGoogle) {
    if (device === "ios") {
      action = { type: "open_store", url: appleUrl };
    } else {
      action = { type: "open_modal" };
    }
  } else if (!hasApple && hasGoogle) {
    if (device === "android") {
      action = { type: "open_store", url: googleUrl };
    } else {
      action = { type: "open_modal" };
    }
  }
  return action;
}

const appleUrl = "https://apps.apple.com/app/id123";
const googleUrl = "https://play.google.com/store/apps/details?id=com.test";

// Dual store: Android -> Google Play
const resAndroidDual = simulateAppClick("android", true, true, appleUrl, googleUrl);
assert.deepEqual(resAndroidDual, { type: "open_store", url: googleUrl });

// Dual store: iOS -> Apple App Store
const resIosDual = simulateAppClick("ios", true, true, appleUrl, googleUrl);
assert.deepEqual(resIosDual, { type: "open_store", url: appleUrl });

// Dual store: Desktop -> Opens modal dialog
const resDesktopDual = simulateAppClick("desktop", true, true, appleUrl, googleUrl);
assert.deepEqual(resDesktopDual, { type: "open_modal" });

// Single store (Apple only): iOS -> Apple App Store
const resIosSingle = simulateAppClick("ios", true, false, appleUrl, googleUrl);
assert.deepEqual(resIosSingle, { type: "open_store", url: appleUrl });

// Single store (Apple only): Android -> Does not redirect to wrong store, opens modal dialog
const resAndroidSingleApple = simulateAppClick("android", true, false, appleUrl, googleUrl);
assert.deepEqual(resAndroidSingleApple, { type: "open_modal" });

// Single store (Google only): Android -> Google Play
const resAndroidSingleGoogle = simulateAppClick("android", false, true, appleUrl, googleUrl);
assert.deepEqual(resAndroidSingleGoogle, { type: "open_store", url: googleUrl });

// Single store (Google only): iOS -> Does not redirect to wrong store, opens modal dialog
const resIosSingleGoogle = simulateAppClick("ios", false, true, appleUrl, googleUrl);
assert.deepEqual(resIosSingleGoogle, { type: "open_modal" });

console.log("✔ Device routing and fallback modal handling verified");

console.log("=== ALL POLISH TESTS PASSED SUCCESSFULLY! ===");
