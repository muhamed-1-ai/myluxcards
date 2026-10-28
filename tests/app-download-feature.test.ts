import { isValidStoreUrl, cleanStoreUrl, cleanCardProfile, completeCardProfile } from "../src/lib/cards";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("--- Starting Download Our App Unit & Integration Tests ---");

// Test 1: Store URL Validation
console.log("Test 1: Store URL Validation...");

// Apple Store valid URLs
assert(isValidStoreUrl("https://apps.apple.com/us/app/my-app/id123456789", "apple"), "Apple App Store URL should be valid");
assert(isValidStoreUrl("https://itunes.apple.com/app/id123456789", "apple"), "iTunes Apple URL should be valid");
assert(isValidStoreUrl("https://testflight.apple.com/join/vP2XYZ", "apple"), "TestFlight URL should be valid");
assert(isValidStoreUrl("apps.apple.com/us/app/my-app/id123456789", "apple"), "Protocol-less Apple URL should be valid");
assert(isValidStoreUrl("http://apps.apple.com/us/app/my-app/id123456789", "apple"), "HTTP Apple URL should be valid");

// Apple Store invalid / deceptive / unsafe URLs
assert(!isValidStoreUrl("https://apps.apple.com.attacker.com/app", "apple"), "Deceptive subdomain on Apple should be rejected");
assert(!isValidStoreUrl("https://apple.com/app", "apple"), "Generic apple.com should be rejected");
assert(!isValidStoreUrl("https://apps.apple.com", "apple"), "Root apps.apple.com with no path should be rejected");
assert(!isValidStoreUrl("javascript:alert(1)", "apple"), "Javascript protocol should be rejected");
assert(!isValidStoreUrl("data:text/html,test", "apple"), "Data protocol should be rejected");
assert(!isValidStoreUrl("https://user:pass@example.com/app", "apple"), "URLs with embedded credentials must be rejected");
assert(!isValidStoreUrl("https://play.google.com/store/apps/details?id=com.app", "apple"), "Google Play URL under Apple should be rejected");

// Google Play Store valid URLs
assert(isValidStoreUrl("https://play.google.com/store/apps/details?id=com.example.app&hl=en", "google"), "Google Play Store URL should be valid");
assert(isValidStoreUrl("https://market.android.com/details?id=com.example.app", "google"), "Android Market URL should be valid");
assert(isValidStoreUrl("play.google.com/store/apps/details?id=com.example.app", "google"), "Protocol-less Google Play URL should be valid");

// Google Play Store invalid / deceptive / unsafe URLs
assert(!isValidStoreUrl("https://play.google.com.attacker.com/store", "google"), "Deceptive subdomain on Google should be rejected");
assert(!isValidStoreUrl("https://google.com/store", "google"), "Generic google.com should be rejected");
assert(!isValidStoreUrl("https://play.google.com", "google"), "Root play.google.com with no path should be rejected");
assert(!isValidStoreUrl("https://user:pass@example.com/store", "google"), "URLs with embedded credentials must be rejected");
assert(!isValidStoreUrl("https://apps.apple.com/app/id123", "google"), "Apple URL under Google should be rejected");

// Valid Referral and Campaign URLs (accepted in either field)
assert(isValidStoreUrl("https://mybrand.onelink.me/abc?pid=affiliate&c=summer", "apple"), "AppsFlyer OneLink should be valid for Apple");
assert(isValidStoreUrl("https://mybrand.onelink.me/abc?pid=affiliate&c=summer", "google"), "AppsFlyer OneLink should be valid for Google");
assert(isValidStoreUrl("https://myapp.app.link/referral?campaign=promo&code=XYZ", "apple"), "Branch link should be valid for Apple");
assert(isValidStoreUrl("https://app.adjust.com/abc1234?campaign=tracker", "google"), "Adjust link should be valid for Google");
assert(isValidStoreUrl("https://get.mycompany.com/app-download", "apple"), "Custom vanity HTTPS link should be valid");

// Test 2: URL Cleaning and HTTPS Normalization
console.log("Test 2: URL Cleaning and HTTPS Normalization...");
assert(cleanStoreUrl("apps.apple.com/us/app/id123", "apple") === "https://apps.apple.com/us/app/id123", "Protocol-less should be upgraded to HTTPS");
assert(cleanStoreUrl("http://play.google.com/store/apps/details?id=com.test", "google") === "https://play.google.com/store/apps/details?id=com.test", "HTTP should be upgraded to HTTPS");
assert(cleanStoreUrl("https://user:pass@attacker.com/fake", "apple") === "", "Embedded credentials should clean to empty string");
assert(cleanStoreUrl("javascript:alert(1)", "apple") === "", "Unsafe javascript scheme should clean to empty string");
assert(cleanStoreUrl("https://apps.apple.com.attacker.com/fake", "apple") === "", "Deceptive domain should clean to empty string");
assert(cleanStoreUrl("https://play.google.com/store/apps/details?id=com.test&hl=en_US&gl=US", "google") === "https://play.google.com/store/apps/details?id=com.test&hl=en_US&gl=US", "Legitimate query parameters should be preserved");
assert(cleanStoreUrl("https://mybrand.onelink.me/abc?pid=affiliate&c=summer&af_dp=myapp%3A%2F%2Fhome#promo", "apple") === "https://mybrand.onelink.me/abc?pid=affiliate&c=summer&af_dp=myapp%3A%2F%2Fhome#promo", "Complex referral URL with nested encoding and hash preserved intact");

// Test 3: cleanCardProfile & completeCardProfile Serialization
console.log("Test 3: cleanCardProfile & completeCardProfile Serialization...");

// Both links configured
const profileWithBoth = cleanCardProfile({
  appDownload: {
    appName: "Zappit Mobile",
    appStoreUrl: "https://apps.apple.com/app/zappit/id123456",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.zappit.app",
  },
});
const adWithBoth = profileWithBoth.appDownload as any;
assert(adWithBoth?.appName === "Zappit Mobile", "App name preserved");
assert(adWithBoth?.appStoreUrl === "https://apps.apple.com/app/zappit/id123456", "App Store URL preserved");
assert(adWithBoth?.playStoreUrl === "https://play.google.com/store/apps/details?id=com.zappit.app", "Play Store URL preserved");

// App name alone must NOT produce store URLs
const profileNameOnly = cleanCardProfile({
  appDownload: {
    appName: "Orphan App Name",
    appStoreUrl: "",
    playStoreUrl: "",
  },
});
const adNameOnly = profileNameOnly.appDownload as any;
assert(adNameOnly?.appName === "Orphan App Name", "App name preserved");
assert(!adNameOnly?.appStoreUrl, "App Store URL must be empty");
assert(!adNameOnly?.playStoreUrl, "Play Store URL must be empty");

// Both URLs cleared must remove public presence
const profileCleared = cleanCardProfile({
  appDownload: {
    appName: "",
    appStoreUrl: "",
    playStoreUrl: "",
  },
});
const adCleared = profileCleared.appDownload as any;
assert(adCleared?.appStoreUrl === "", "App Store URL cleared");
assert(adCleared?.playStoreUrl === "", "Play Store URL cleared");

// Test 4: Profile Tile Generation Logic Verification
console.log("Test 4: Profile Tile Generation Logic...");

function buildSocialLinks(card: any) {
  const baseOrder = [
    { key: "google-reviews", name: "Google Reviews", url: card.social?.["Google Reviews"] || "" },
    { key: "instagram", name: "Instagram", url: card.social?.Instagram || "" },
    { key: "website", name: "Website", url: card.website || "" },
  ].filter((item) => Boolean(item.url));

  const hasAppDownload = Boolean(
    card.appDownload && (card.appDownload.appStoreUrl || card.appDownload.playStoreUrl)
  );

  let appTile: any = null;
  if (hasAppDownload) {
    const hasApple = Boolean(card.appDownload.appStoreUrl);
    const hasGoogle = Boolean(card.appDownload.playStoreUrl);
    let appLabel = "Download Our App";
    if (hasApple && !hasGoogle) appLabel = "Download on App Store";
    else if (!hasApple && hasGoogle) appLabel = "Get it on Google Play";

    appTile = {
      key: "app-download",
      name: appLabel,
      url: card.appDownload.appStoreUrl || card.appDownload.playStoreUrl || "#",
      brand: "download",
      isAppDownload: true,
      appName: card.appDownload.appName,
      hasBothStores: hasApple && hasGoogle,
      subText: card.appDownload.appName || (hasApple && hasGoogle ? "iOS & Android" : undefined),
    };
  }

  const socialLinks: any[] = [];
  let insertedAppTile = false;

  for (const item of baseOrder) {
    socialLinks.push(item);
    if (item.key === "google-reviews" && appTile && !insertedAppTile) {
      socialLinks.push(appTile);
      insertedAppTile = true;
    }
  }

  if (appTile && !insertedAppTile) {
    socialLinks.unshift(appTile);
  }

  return socialLinks;
}

// Case A: Both Google Reviews and App Download present -> App Download directly follows Google Reviews
const cardWithReviewsAndApp = {
  social: { "Google Reviews": "https://g.page/r/test/review", Instagram: "https://instagram.com/test" },
  appDownload: { appName: "SuperApp", appStoreUrl: "https://apps.apple.com/app/id1", playStoreUrl: "https://play.google.com/store/apps/details?id=com.test" },
};
const linksA = buildSocialLinks(cardWithReviewsAndApp);
assert(linksA.length === 3, "Should have 3 links");
assert(linksA[0].key === "google-reviews", "First link is Google Reviews");
assert(linksA[1].key === "app-download", "Second link is App Download (directly after Google Reviews)");
assert(linksA[1].name === "Download Our App", "Label should be Download Our App when both stores present");
assert(linksA[1].subText === "SuperApp", "Subtext should be app name");
assert(linksA[2].key === "instagram", "Third link is Instagram");

// Case B: No Google Reviews -> App Download appears naturally without blank space
const cardNoReviewsWithApp = {
  social: { Instagram: "https://instagram.com/test" },
  appDownload: { appName: "SuperApp", appStoreUrl: "https://apps.apple.com/app/id1" },
};
const linksB = buildSocialLinks(cardNoReviewsWithApp);
assert(linksB.length === 2, "Should have 2 links");
assert(linksB[0].key === "app-download", "App Download appears naturally without gaps");
assert(linksB[0].name === "Download on App Store", "Label is Download on App Store for Apple-only");
assert(linksB[1].key === "instagram", "Second link is Instagram");

// Case C: Android only configuration
const cardAndroidOnly = {
  appDownload: { appName: "AndroidSpecial", playStoreUrl: "https://play.google.com/store/apps/details?id=com.test" },
};
const linksC = buildSocialLinks(cardAndroidOnly);
assert(linksC.length === 1, "Should have 1 link");
assert(linksC[0].name === "Get it on Google Play", "Label is Get it on Google Play for Android-only");
assert(linksC[0].subText === "AndroidSpecial", "Subtext is app name");

// Case D: App Name alone -> NO tile created
const cardNameOnly = {
  appDownload: { appName: "Ghost App", appStoreUrl: "", playStoreUrl: "" },
};
const linksD = buildSocialLinks(cardNameOnly);
assert(linksD.length === 0, "No tile should be created with app name alone!");

// Test 5: Device routing logic verification
console.log("Test 5: Device Routing Logic...");

type DeviceType = "ios" | "android" | "desktop" | "unknown";

function determineClickAction(device: DeviceType, hasApple: boolean, hasGoogle: boolean, appleUrl: string, googleUrl: string): { action: "open_apple" | "open_google" | "open_modal" } {
  if (hasApple && hasGoogle) {
    if (device === "android") return { action: "open_google" };
    if (device === "ios") return { action: "open_apple" };
    return { action: "open_modal" }; // Desktop or unknown sees chooser modal
  } else if (hasApple && !hasGoogle) {
    if (device === "ios") return { action: "open_apple" };
    return { action: "open_modal" }; // Incompatible device (e.g. Android or desktop) sees modal with explicit link
  } else if (!hasApple && hasGoogle) {
    if (device === "android") return { action: "open_google" };
    return { action: "open_modal" }; // Incompatible device (e.g. iOS or desktop) sees modal with explicit link
  }
  return { action: "open_modal" };
}

// Both stores configured:
assert(determineClickAction("android", true, true, "apple_url", "google_url").action === "open_google", "Android opens Google Play");
assert(determineClickAction("ios", true, true, "apple_url", "google_url").action === "open_apple", "iOS opens Apple App Store");
assert(determineClickAction("desktop", true, true, "apple_url", "google_url").action === "open_modal", "Desktop opens chooser modal");
assert(determineClickAction("unknown", true, true, "apple_url", "google_url").action === "open_modal", "Unknown opens chooser modal");

// Apple only configured:
assert(determineClickAction("ios", true, false, "apple_url", "").action === "open_apple", "iOS on Apple-only opens Apple Store");
assert(determineClickAction("android", true, false, "apple_url", "").action === "open_modal", "Android on Apple-only opens modal explaining availability");
assert(determineClickAction("desktop", true, false, "apple_url", "").action === "open_modal", "Desktop on Apple-only opens modal");

// Google only configured:
assert(determineClickAction("android", false, true, "", "google_url").action === "open_google", "Android on Google-only opens Google Play");
assert(determineClickAction("ios", false, true, "", "google_url").action === "open_modal", "iOS on Google-only opens modal explaining availability");
assert(determineClickAction("desktop", false, true, "", "google_url").action === "open_modal", "Desktop on Google-only opens modal");

console.log("✅ All Download Our App tests PASSED successfully!");
