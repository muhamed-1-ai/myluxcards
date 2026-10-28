import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isValidStoreUrl, cleanStoreUrl, cleanCardProfile, completeCardProfile, safePublicCard } from "../src/lib/cards";
import { resolveAppDownloadTile } from "../src/lib/appDownload";

console.log("=== RUNNING APP DOWNLOAD REFERRAL LINKS TEST SUITE ===");

// ---------------------------------------------------------------------------
// 1. Acceptance of Direct Store Links & Diverse Referral / App-Provider Links
// ---------------------------------------------------------------------------
console.log("Test 1: Direct store links and referral destinations acceptance...");

// Direct store links
assert.equal(isValidStoreUrl("https://apps.apple.com/us/app/my-app/id123456789", "apple"), true);
assert.equal(isValidStoreUrl("https://itunes.apple.com/app/id123456789", "apple"), true);
assert.equal(isValidStoreUrl("https://testflight.apple.com/join/vP2XYZ", "apple"), true);
assert.equal(isValidStoreUrl("https://play.google.com/store/apps/details?id=com.example.app&hl=en", "google"), true);
assert.equal(isValidStoreUrl("https://market.android.com/details?id=com.example.app", "google"), true);

// AppsFlyer OneLink with nested redirect, tracking params, and fragment
const appsFlyerApple = "https://mybrand.onelink.me/abc1?pid=affiliate&c=summer_2026&af_dp=myapp%3A%2F%2Fpromo%3Fcode%3D50&af_web_dp=https%3A%2F%2Fmybrand.com%2Fwelcome#details";
const appsFlyerGoogle = "https://mybrand.onelink.me/abc2?pid=google_ads&c=android_campaign&af_dp=myapp%3A%2F%2Fpromo#google_store";
assert.equal(isValidStoreUrl(appsFlyerApple, "apple"), true, "AppsFlyer OneLink must be valid for Apple");
assert.equal(isValidStoreUrl(appsFlyerGoogle, "google"), true, "AppsFlyer OneLink must be valid for Google");

// Branch.io links with encoded fallback URLs
const branchApple = "https://myapp.app.link/referral?campaign=winter2026&user_id=12345&$fallback_url=https%3A%2F%2Fapps.apple.com%2Fapp%2Fid999";
const branchGoogle = "https://myapp.app.link/referral?campaign=winter2026&user_id=12345&$fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps";
assert.equal(isValidStoreUrl(branchApple, "apple"), true, "Branch link must be valid for Apple");
assert.equal(isValidStoreUrl(branchGoogle, "google"), true, "Branch link must be valid for Google");

// Adjust deep links
const adjustLink = "https://app.adjust.com/cb01234?campaign=social_cards&fallback=https%3A%2F%2Fapps.apple.com";
assert.equal(isValidStoreUrl(adjustLink, "apple"), true, "Adjust link must be valid for Apple");
assert.equal(isValidStoreUrl(adjustLink, "google"), true, "Adjust link must be valid for Google");

// Firebase Dynamic Links with complex parameters
const firebaseLink = "https://customapp.page.link/?link=https%3A%2F%2Fexample.com%2Frefer%3Fuser%3D123&apn=com.example.android&isi=123456789#promo";
assert.equal(isValidStoreUrl(firebaseLink, "apple"), true, "Firebase dynamic link must be valid for Apple");
assert.equal(isValidStoreUrl(firebaseLink, "google"), true, "Firebase dynamic link must be valid for Google");

// Custom vanity / provider shortlinks
const vanityLink = "https://get.mybrand.com/download/app?ref=user_42";
assert.equal(isValidStoreUrl(vanityLink, "apple"), true, "Custom vanity domain must be valid for Apple");
assert.equal(isValidStoreUrl(vanityLink, "google"), true, "Custom vanity domain must be valid for Google");

// Cross-platform referral link (same link in both fields)
const universalReferral = "https://brand.onelink.me/universal?ref=partner99";
assert.equal(isValidStoreUrl(universalReferral, "apple"), true, "Cross-platform referral link must be allowed in Apple field");
assert.equal(isValidStoreUrl(universalReferral, "google"), true, "Cross-platform referral link must be allowed in Google field");

console.log("✔ Direct store and referral links accepted across platforms");

// ---------------------------------------------------------------------------
// 2. Strict Security: Reject Unsafe Schemes, Credentials, and Spoofing
// ---------------------------------------------------------------------------
console.log("Test 2: Security checks (unsafe schemes, credentials, malformed URLs, spoofing)...");

// Unsafe schemes must be rejected
assert.equal(isValidStoreUrl("javascript:alert('xss')", "apple"), false, "Reject javascript: scheme");
assert.equal(isValidStoreUrl("data:text/html;base64,PHNjcmlwdD4=", "google"), false, "Reject data: scheme");
assert.equal(isValidStoreUrl("file:///etc/passwd", "apple"), false, "Reject file: scheme");
assert.equal(isValidStoreUrl("ftp://files.example.com/app.apk", "google"), false, "Reject ftp: scheme");
assert.equal(cleanStoreUrl("javascript:alert(1)", "apple"), "", "Unsafe scheme cleans to empty string");

// Embedded credentials must be rejected
assert.equal(isValidStoreUrl("https://admin:secret123@mybrand.onelink.me/app", "apple"), false, "Reject username/password in URL");
assert.equal(isValidStoreUrl("https://user@adjust.com/tracker", "google"), false, "Reject username in URL");
assert.equal(cleanStoreUrl("https://user:pass@example.com/app", "apple"), "", "Credentials clean to empty string");

// Deceptive spoofing subdomains must be rejected
assert.equal(isValidStoreUrl("https://apps.apple.com.attacker.com/fake", "apple"), false, "Reject deceptive apple subdomain");
assert.equal(isValidStoreUrl("https://play.google.com.phishing.io/store", "google"), false, "Reject deceptive google subdomain");
assert.equal(isValidStoreUrl("https://itunes.apple.com.spoof.net/app", "apple"), false, "Reject deceptive itunes subdomain");
assert.equal(isValidStoreUrl("https://market.android.com.evil.org/app", "google"), false, "Reject deceptive market android subdomain");

// Generic homepages must be rejected
assert.equal(isValidStoreUrl("https://apple.com/app", "apple"), false, "Reject generic apple.com homepage");
assert.equal(isValidStoreUrl("https://google.com/store", "google"), false, "Reject generic google.com homepage");
assert.equal(isValidStoreUrl("https://apps.apple.com", "apple"), false, "Reject root apps.apple.com without path");
assert.equal(isValidStoreUrl("https://play.google.com", "google"), false, "Reject root play.google.com without path");

// Cross-store direct mismatches must be rejected
assert.equal(isValidStoreUrl("https://apps.apple.com/us/app/id123", "google"), false, "Direct Apple URL in Google field rejected");
assert.equal(isValidStoreUrl("https://play.google.com/store/apps/details?id=com.test", "apple"), false, "Direct Google URL in Apple field rejected");

// Malformed hostnames
assert.equal(isValidStoreUrl("https://.invalid.com/app", "apple"), false, "Reject leading dot");
assert.equal(isValidStoreUrl("https://invalid..com/app", "apple"), false, "Reject double dots");
assert.equal(isValidStoreUrl("https://invalid/app", "apple"), false, "Reject single label without TLD");

console.log("✔ Security checks properly reject unsafe schemes, credentials, and spoofing");

// ---------------------------------------------------------------------------
// 3. Complete Preservation: Parameters, Encoded Nested URLs, and Fragments
// ---------------------------------------------------------------------------
console.log("Test 3: URL preservation without parameter stripping or re-encoding...");

const complexAppleReferral = "https://mybrand.onelink.me/abc1?pid=affiliate&c=summer_2026&af_dp=myapp%3A%2F%2Fpromo%3Fcode%3D50&af_web_dp=https%3A%2F%2Fmybrand.com%2Fwelcome#details";
const cleanedApple = cleanStoreUrl(`  ${complexAppleReferral}  `, "apple");
assert.equal(cleanedApple, complexAppleReferral, "Surrounding whitespace trimmed while keeping full URL intact");

// Protocol-less input upgraded to HTTPS
const protocolLess = "mybrand.onelink.me/promo?code=VIP123";
assert.equal(cleanStoreUrl(protocolLess, "apple"), `https://${protocolLess}`, "Protocol-less upgraded to HTTPS");

// HTTP upgraded to HTTPS
const httpUrl = "http://mybrand.onelink.me/promo?code=VIP123";
assert.equal(cleanStoreUrl(httpUrl, "google"), `https://${protocolLess}`, "HTTP upgraded to HTTPS");

console.log("✔ URL cleaning preserves nested encoded URLs, query params, and fragments");

// ---------------------------------------------------------------------------
// 4. Persistence & Serialization Roundtrip (cleanCardProfile & safePublicCard)
// ---------------------------------------------------------------------------
console.log("Test 4: Persistence, serialization, and public profile roundtrip...");

const savePayload = {
  appDownload: {
    appName: "FitTrack Pro",
    appStoreUrl: "  https://fit.app.link/ios?referrer=card_user_99&campaign=launch#install  ",
    playStoreUrl: "https://fit.app.link/android?referrer=card_user_99&campaign=launch#install",
  },
};

const cleanedProfile = cleanCardProfile(savePayload);
const appDownloadCleaned = cleanedProfile.appDownload as any;
assert.equal(appDownloadCleaned.appName, "FitTrack Pro");
assert.equal(appDownloadCleaned.appStoreUrl, "https://fit.app.link/ios?referrer=card_user_99&campaign=launch#install");
assert.equal(appDownloadCleaned.playStoreUrl, "https://fit.app.link/android?referrer=card_user_99&campaign=launch#install");

// Roundtrip through completeCardProfile
const completed = completeCardProfile(cleanedProfile);
const adCompleted = completed.appDownload as any;
assert.equal(adCompleted.appName, "FitTrack Pro");
assert.equal(adCompleted.appStoreUrl, "https://fit.app.link/ios?referrer=card_user_99&campaign=launch#install");
assert.equal(adCompleted.playStoreUrl, "https://fit.app.link/android?referrer=card_user_99&campaign=launch#install");

// Roundtrip through safePublicCard (signed-out public profile representation)
const publicCard = safePublicCard({
  id: "card-12345",
  slug: "fittrack",
  owner_id: "user-789",
  profile: cleanedProfile,
  active: true,
});
const adPublic = publicCard.appDownload as any;
assert.equal(adPublic.appName, "FitTrack Pro");
assert.equal(adPublic.appStoreUrl, "https://fit.app.link/ios?referrer=card_user_99&campaign=launch#install");
assert.equal(adPublic.playStoreUrl, "https://fit.app.link/android?referrer=card_user_99&campaign=launch#install");

console.log("✔ Profile persistence, completion, and public card serialization verified");

// ---------------------------------------------------------------------------
// 5. Device-Based Routing and Icon Selection (Preserve Apple / Android Brand)
// ---------------------------------------------------------------------------
console.log("Test 5: Device-based routing and platform icon selection...");

// 5a. Both stores configured with referral links
const referralAppDownload = {
  appName: "FitTrack Pro",
  appStoreUrl: "https://fit.app.link/ios?ref=123",
  playStoreUrl: "https://fit.app.link/android?ref=123",
};

// iOS visitor -> Consistent blue download icon + opens saved Apple referral URL
const iosTile = resolveAppDownloadTile(referralAppDownload, "ios");
assert.equal(iosTile.visible, true);
assert.equal(iosTile.brand, "download", "iOS visitor must see consistent download icon");
assert.equal(iosTile.name, "Download Our App");
assert.equal(iosTile.url, "https://fit.app.link/ios?ref=123", "iOS visitor receives configured Apple destination");
assert.equal(iosTile.action, "direct");
assert.equal(iosTile.targetStore, "apple");

// Android visitor -> Consistent blue download icon + opens saved Android referral URL
const androidTile = resolveAppDownloadTile(referralAppDownload, "android");
assert.equal(androidTile.visible, true);
assert.equal(androidTile.brand, "download", "Android visitor must see consistent download icon");
assert.equal(androidTile.name, "Download Our App");
assert.equal(androidTile.url, "https://fit.app.link/android?ref=123", "Android visitor receives configured Google destination");
assert.equal(androidTile.action, "direct");
assert.equal(androidTile.targetStore, "google");

// Desktop visitor -> Consistent blue download icon + opens chooser dialog
const desktopTile = resolveAppDownloadTile(referralAppDownload, "desktop");
assert.equal(desktopTile.visible, true);
assert.equal(desktopTile.brand, "download", "Desktop visitor must see consistent download icon");
assert.equal(desktopTile.name, "Download Our App");
assert.equal(desktopTile.action, "chooser");

// 5b. Cross-platform referral link in both fields
const crossPlatformDownload = {
  appName: "CrossPlatform App",
  appStoreUrl: "https://mybrand.onelink.me/share?code=PROMO",
  playStoreUrl: "https://mybrand.onelink.me/share?code=PROMO",
};
const iosCrossTile = resolveAppDownloadTile(crossPlatformDownload, "ios");
assert.equal(iosCrossTile.brand, "download");
assert.equal(iosCrossTile.name, "Download Our App");
assert.equal(iosCrossTile.url, "https://mybrand.onelink.me/share?code=PROMO");

const androidCrossTile = resolveAppDownloadTile(crossPlatformDownload, "android");
assert.equal(androidCrossTile.brand, "download");
assert.equal(androidCrossTile.name, "Download Our App");
assert.equal(androidCrossTile.url, "https://mybrand.onelink.me/share?code=PROMO");

// 5c. Apple-only referral link
const appleOnlyDownload = {
  appName: "iOS Only App",
  appStoreUrl: "https://fit.app.link/ios-exclusive?ref=123",
};
const iosOnlyTile = resolveAppDownloadTile(appleOnlyDownload, "ios");
assert.equal(iosOnlyTile.visible, true);
assert.equal(iosOnlyTile.brand, "download");
assert.equal(iosOnlyTile.name, "Download Our App");
assert.equal(iosOnlyTile.action, "direct");
assert.equal(iosOnlyTile.url, "https://fit.app.link/ios-exclusive?ref=123");

const androidIncompatTile = resolveAppDownloadTile(appleOnlyDownload, "android");
assert.equal(androidIncompatTile.visible, true);
assert.equal(androidIncompatTile.brand, "download");
assert.equal(androidIncompatTile.name, "Download Our App");
assert.equal(androidIncompatTile.action, "chooser", "Incompatible device opens modal showing single store availability");

console.log("✔ Device routing verified with consistent download brand across all devices");

// ---------------------------------------------------------------------------
// 6. UI Form Verification: Helper text present and no "Choose store" regression
// ---------------------------------------------------------------------------
console.log("Test 6: UI Form helper text and label verification...");

const dashboardCode = fs.readFileSync(path.join(process.cwd(), "src/app/dashboard/DashboardDemo.tsx"), "utf8");
const helperText = "Paste a direct store link or a referral link intended for this platform.";

// Verify helper text is included in both fields
const appleFieldIndex = dashboardCode.indexOf('label="Apple App Store URL"');
const googleFieldIndex = dashboardCode.indexOf('label="Google Play Store URL"');
assert.ok(appleFieldIndex !== -1, "Apple App Store URL field must exist");
assert.ok(googleFieldIndex !== -1, "Google Play Store URL field must exist");

const appleSnippet = dashboardCode.slice(appleFieldIndex, appleFieldIndex + 300);
const googleSnippet = dashboardCode.slice(googleFieldIndex, googleFieldIndex + 300);

assert.ok(appleSnippet.includes(helperText), "Apple field must contain exact helper text");
assert.ok(googleSnippet.includes(helperText), "Google field must contain exact helper text");

// Verify separate "Choose store" text is NOT present below tile
const modernLayoutCode = fs.readFileSync(path.join(process.cwd(), "src/components/card/ModernProfileLayout.tsx"), "utf8");
const simpleLayoutCode = fs.readFileSync(path.join(process.cwd(), "src/components/card/SimpleProfileLayout.tsx"), "utf8");
assert.ok(!modernLayoutCode.includes("Choose store"), "ModernProfileLayout must not contain separate 'Choose store' text");
assert.ok(!simpleLayoutCode.includes("Choose store"), "SimpleProfileLayout must not contain separate 'Choose store' text");

console.log("✔ UI helper text verified and 'Choose store' text absent");

console.log("\n=== ALL APP DOWNLOAD REFERRAL LINKS TESTS PASSED! ===");
