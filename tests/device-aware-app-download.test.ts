import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveAppDownloadTile } from "../src/lib/appDownload";
import { detectUserDevice } from "../src/lib/device";
import { normalizeBrandKey } from "../src/components/card/BrandLogo";

const rootDir = process.cwd();

console.log("=== RUNNING DEVICE-AWARE APP DOWNLOAD SUITE ===");

const validAppleUrl = "https://apps.apple.com/us/app/zappit-digital-business-card/id123456789";
const validGoogleUrl = "https://play.google.com/store/apps/details?id=com.zappit.app";

// -------------------------------------------------------------
// Test 1: Device Detection Simulation
// -------------------------------------------------------------
console.log("Test 1: Device Detection simulation...");

// Android user agent
const androidUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
assert.equal(detectUserDevice(androidUA), "android", "Should detect Android device");

// iPhone user agent
const iphoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
assert.equal(detectUserDevice(iphoneUA), "ios", "Should detect iPhone device");

// iPad user agent (classic)
const ipadUA = "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
assert.equal(detectUserDevice(ipadUA), "ios", "Should detect iPad device");

// Desktop Windows user agent
const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
assert.equal(detectUserDevice(desktopUA), "desktop", "Should detect Desktop device");

// Desktop Mac user agent
const macUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
assert.equal(detectUserDevice(macUA), "desktop", "Should detect Desktop Mac");

// Empty / Unknown UA
assert.equal(detectUserDevice(""), "unknown", "Empty UA should be unknown");
assert.equal(detectUserDevice("SomeRandomBot/1.0"), "unknown", "Unrecognized UA should be unknown");

console.log("✔ Device detection correctly handles Android, iPhone, iPad, Desktop, and unknown devices");

// -------------------------------------------------------------
// Test 2: Dual-Store Configurations
// -------------------------------------------------------------
console.log("Test 2: Dual-store configuration resolution...");

const dualConfig = {
  appName: "Zappit Business",
  appStoreUrl: validAppleUrl,
  playStoreUrl: validGoogleUrl,
};

// 2a. Android visitor -> Consistent blue download icon and direct Google Play URL
const androidDualRes = resolveAppDownloadTile(dualConfig, "android");
assert.equal(androidDualRes.visible, true);
assert.equal(androidDualRes.brand, "download", "Android must show consistent blue download brand");
assert.equal(androidDualRes.name, "Download Our App");
assert.equal(androidDualRes.subText, "Zappit Business");
assert.equal(androidDualRes.url, validGoogleUrl, "Android must link to Google Play URL");
assert.equal(androidDualRes.action, "direct");
assert.equal(androidDualRes.targetStore, "google");
assert.ok(androidDualRes.ariaLabel.includes("Download"));

// 2b. iOS visitor -> Consistent blue download icon and direct Apple URL
const iosDualRes = resolveAppDownloadTile(dualConfig, "ios");
assert.equal(iosDualRes.visible, true);
assert.equal(iosDualRes.brand, "download", "iOS must show consistent blue download brand");
assert.equal(iosDualRes.name, "Download Our App");
assert.equal(iosDualRes.subText, "Zappit Business");
assert.equal(iosDualRes.url, validAppleUrl, "iOS must link to Apple App Store URL");
assert.equal(iosDualRes.action, "direct");
assert.equal(iosDualRes.targetStore, "apple");
assert.ok(iosDualRes.ariaLabel.includes("Download"));

// 2c. Desktop visitor -> Consistent blue download icon, opens chooser modal
const desktopDualRes = resolveAppDownloadTile(dualConfig, "desktop");
assert.equal(desktopDualRes.visible, true);
assert.equal(desktopDualRes.brand, "download", "Desktop must show consistent blue download brand");
assert.equal(desktopDualRes.name, "Download Our App");
assert.equal(desktopDualRes.subText, "Zappit Business");
assert.equal(desktopDualRes.action, "chooser", "Desktop must trigger store chooser modal");

// 2d. Unknown device / SSR initial state -> Consistent blue download icon and chooser action
const unknownDualRes = resolveAppDownloadTile(dualConfig, "unknown");
assert.equal(unknownDualRes.visible, true);
assert.equal(unknownDualRes.brand, "download", "Unknown device must show consistent blue download brand");
assert.equal(unknownDualRes.name, "Download Our App");
assert.equal(unknownDualRes.action, "chooser");

console.log("✔ Dual-store configurations resolved correctly with consistent download brand for all device profiles");

// -------------------------------------------------------------
// Test 3: Apple Only Configuration
// -------------------------------------------------------------
console.log("Test 3: Apple-only store configuration...");

const appleOnlyConfig = {
  appName: "Zappit Pro",
  appStoreUrl: validAppleUrl,
  playStoreUrl: "",
};

// 3a. iOS visitor -> Download brand, "Download Our App", direct link
const iosAppleOnly = resolveAppDownloadTile(appleOnlyConfig, "ios");
assert.equal(iosAppleOnly.visible, true);
assert.equal(iosAppleOnly.brand, "download");
assert.equal(iosAppleOnly.name, "Download Our App");
assert.equal(iosAppleOnly.url, validAppleUrl);
assert.equal(iosAppleOnly.action, "direct");
assert.equal(iosAppleOnly.targetStore, "apple");

// 3b. Android visitor -> Download brand, "Download Our App", opens chooser modal (no wrong store redirect!)
const androidAppleOnly = resolveAppDownloadTile(appleOnlyConfig, "android");
assert.equal(androidAppleOnly.visible, true);
assert.equal(androidAppleOnly.brand, "download");
assert.equal(androidAppleOnly.name, "Download Our App");
assert.equal(androidAppleOnly.action, "chooser", "Android visitor on Apple-only app must NOT be sent to wrong store");

// 3c. Desktop visitor -> Download brand, opens chooser modal
const desktopAppleOnly = resolveAppDownloadTile(appleOnlyConfig, "desktop");
assert.equal(desktopAppleOnly.visible, true);
assert.equal(desktopAppleOnly.brand, "download");
assert.equal(desktopAppleOnly.action, "chooser");

console.log("✔ Apple-only configuration correctly protects incompatible devices and resolves consistent download branding");

// -------------------------------------------------------------
// Test 4: Google Play Only Configuration
// -------------------------------------------------------------
console.log("Test 4: Google Play-only store configuration...");

const googleOnlyConfig = {
  appName: "Zappit Pro",
  appStoreUrl: "",
  playStoreUrl: validGoogleUrl,
};

// 4a. Android visitor -> Download brand, "Download Our App", direct link
const androidGoogleOnly = resolveAppDownloadTile(googleOnlyConfig, "android");
assert.equal(androidGoogleOnly.visible, true);
assert.equal(androidGoogleOnly.brand, "download");
assert.equal(androidGoogleOnly.name, "Download Our App");
assert.equal(androidGoogleOnly.url, validGoogleUrl);
assert.equal(androidGoogleOnly.action, "direct");
assert.equal(androidGoogleOnly.targetStore, "google");

// 4b. iOS visitor -> Download brand, "Download Our App", opens chooser modal (no wrong store redirect!)
const iosGoogleOnly = resolveAppDownloadTile(googleOnlyConfig, "ios");
assert.equal(iosGoogleOnly.visible, true);
assert.equal(iosGoogleOnly.brand, "download");
assert.equal(iosGoogleOnly.name, "Download Our App");
assert.equal(iosGoogleOnly.action, "chooser", "iOS visitor on Google-only app must NOT be sent to wrong store");

// 4c. Desktop visitor -> Download brand, opens chooser modal
const desktopGoogleOnly = resolveAppDownloadTile(googleOnlyConfig, "desktop");
assert.equal(desktopGoogleOnly.visible, true);
assert.equal(desktopGoogleOnly.brand, "download");
assert.equal(desktopGoogleOnly.action, "chooser");

console.log("✔ Google Play-only configuration correctly protects incompatible devices and resolves consistent download branding");

// -------------------------------------------------------------
// Test 5: Unconfigured / Empty Configurations
// -------------------------------------------------------------
console.log("Test 5: Unconfigured and missing links handling...");

// Neither store configured but appName present -> must hide tile
const emptyStoresWithName = resolveAppDownloadTile({ appName: "Orphan Name", appStoreUrl: "", playStoreUrl: "" }, "ios");
assert.equal(emptyStoresWithName.visible, false, "Must hide tile if neither store URL is configured, even if appName exists");

// Undefined appDownload
const undefinedStores = resolveAppDownloadTile(undefined, "android");
assert.equal(undefinedStores.visible, false, "Must hide tile if appDownload is undefined");

// Invalid store URLs (unsafe schemes and embedded credentials)
const invalidUrls = resolveAppDownloadTile({
  appName: "Bad URLs",
  appStoreUrl: "javascript:alert(1)",
  playStoreUrl: "https://user:pass@example.com/not-google",
}, "ios");
assert.equal(invalidUrls.visible, false, "Must hide tile if URLs are invalid (unsafe schemes or embedded credentials)");

console.log("✔ Empty, invalid, and partial configurations hidden safely");

// -------------------------------------------------------------
// Test 6: BrandLogo and SVG Assets Verification
// -------------------------------------------------------------
console.log("Test 6: BrandLogo normalization and SVG assets...");

assert.equal(normalizeBrandKey("appstore"), "appstore");
assert.equal(normalizeBrandKey("App Store"), "appstore");
assert.equal(normalizeBrandKey("playstore"), "playstore");
assert.equal(normalizeBrandKey("Google Play"), "playstore");
assert.equal(normalizeBrandKey("dual_store"), "dual_store");
assert.equal(normalizeBrandKey("dual"), "dual_store");
assert.equal(normalizeBrandKey("Download Our App"), "download", "Must preserve 'download' key for Download Our App");

const brandLogoCode = fs.readFileSync(path.join(rootDir, "src/components/card/BrandLogo.tsx"), "utf-8");

// App Store symbol (not plain Apple fruit logo)
assert.ok(brandLogoCode.includes('case "appstore":'), "BrandLogo must support case 'appstore'");
assert.ok(brandLogoCode.includes("#0066D6"), "App Store icon must use Apple blue background #0066D6");
assert.ok(brandLogoCode.includes("Authentic Apple App Store interlocking tools 'A' mark"), "App Store must use authentic interlocking tools symbol");

// Google Play icon (multicolour brand triangle)
assert.ok(brandLogoCode.includes('case "playstore":'), "BrandLogo must support case 'playstore'");
assert.ok(brandLogoCode.includes("#4285F4") && brandLogoCode.includes("#34A853") && brandLogoCode.includes("#EA4335") && brandLogoCode.includes("#FBBC04"), "Google Play icon must contain 4 official brand colours");

// Dual Store side-by-side icon for desktop
assert.ok(brandLogoCode.includes('case "dual_store":'), "BrandLogo must support case 'dual_store'");
assert.ok(brandLogoCode.includes("viewBox=\"0 0 48 22\""), "dual_store must render side-by-side icons in 48x22 viewBox");

// Download icon (neutral download arrow)
assert.ok(brandLogoCode.includes('case "download":'), "BrandLogo must retain case 'download'");
assert.ok(brandLogoCode.includes("#2563EB"), "Download icon uses blue gradient #2563EB");

// Google Reviews independence
assert.ok(brandLogoCode.includes('case "reviews":'), "BrandLogo must keep case 'reviews' independent");

console.log("✔ BrandLogo keys and visual symbols verified");

// -------------------------------------------------------------
// Test 7: UI & Cleanliness Verification
// -------------------------------------------------------------
console.log("Test 7: Layout, preview controls, and cleanliness verification...");

const modernCode = fs.readFileSync(path.join(rootDir, "src/components/card/ModernProfileLayout.tsx"), "utf-8");
const simpleCode = fs.readFileSync(path.join(rootDir, "src/components/card/SimpleProfileLayout.tsx"), "utf-8");
const modalCode = fs.readFileSync(path.join(rootDir, "src/components/card/AppStoreChooserModal.tsx"), "utf-8");
const dashboardCode = fs.readFileSync(path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx"), "utf-8");

// Neither profile layout should have "Choose store" text or legacy classes
assert.ok(!modernCode.includes("Choose store"), "Modern layout must not restore 'Choose store' text");
assert.ok(!simpleCode.includes("Choose store"), "Simple layout must not restore 'Choose store' text");
assert.ok(!modernCode.includes("zappit-choose-store-action"), "Modern layout must not use 'zappit-choose-store-action'");
assert.ok(!simpleCode.includes("zappit-choose-store-action"), "Simple layout must not use 'zappit-choose-store-action'");

// Both layouts use resolveAppDownloadTile and simulatedDevice
assert.ok(modernCode.includes("resolveAppDownloadTile"), "ModernProfileLayout must use resolveAppDownloadTile");
assert.ok(simpleCode.includes("resolveAppDownloadTile"), "SimpleProfileLayout must use resolveAppDownloadTile");
assert.ok(modernCode.includes("simulatedDevice"), "ModernProfileLayout must accept simulatedDevice prop");
assert.ok(simpleCode.includes("simulatedDevice"), "SimpleProfileLayout must accept simulatedDevice prop");

// Editor Preview Controls in DashboardDemo
assert.ok(dashboardCode.includes("zappit-preview-device-toggle"), "DashboardDemo must include zappit-preview-device-toggle selector");
assert.ok(dashboardCode.includes("previewDevice"), "DashboardDemo must manage previewDevice state");

// AppStoreChooserModal uses BrandLogo and isValidStoreUrl
assert.ok(modalCode.includes('BrandLogo brand="appstore"'), "Modal must use BrandLogo appstore symbol instead of Apple fruit");
assert.ok(modalCode.includes('BrandLogo brand="playstore"'), "Modal must use BrandLogo playstore");
assert.ok(modalCode.includes("isValidStoreUrl"), "Modal must validate store URLs");

console.log("✔ Cleanliness, layout integration, and preview controls verified");

console.log("\n=== ALL DEVICE-AWARE APP DOWNLOAD TESTS PASSED SUCCESSFULLY! ===");
