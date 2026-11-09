import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanSocialAccounts,
  resolveLinkTiles,
  resolveAllCardSocialTiles,
  ORDERED_LINK_TYPES,
  SOCIAL_LINK_DEFINITIONS,
  MAX_URLS_PER_TYPE,
  canonicalDedupeKey,
  isValidSocialUrl,
  extractRecognizableHandleOrDestination,
  normalizeSocialUrl,
} from "../src/lib/socialLinks.js";
import { cleanCardProfile, completeCardProfile } from "../src/lib/cards.js";
import {
  buildFormattedSharePayload,
} from "../src/components/card/SelectiveAppsShareModal.js";

test("1. Link types configuration and 3-URL limit enforcement", () => {
  assert.equal(MAX_URLS_PER_TYPE, 3);
  const expectedTypes = [
    "Instagram",
    "Facebook",
    "YouTube",
    "LinkedIn",
    "Twitter",
    "Google Business",
    "Google Maps",
    "Google Reviews",
    "Website",
  ];
  for (const t of expectedTypes) {
    assert.ok(ORDERED_LINK_TYPES.includes(t), `Must include ${t}`);
    assert.ok(SOCIAL_LINK_DEFINITIONS[t], `Must have definition for ${t}`);
  }

  // Enforces maximum of 3 URLs per link type
  const rawFacebook = [
    { url: "https://facebook.com/page1", name: "Page 1" },
    { url: "https://facebook.com/page2", name: "Page 2" },
    { url: "https://facebook.com/page3", name: "Page 3" },
    { url: "https://facebook.com/page4", name: "Page 4 - should be blocked" },
  ];
  const cleaned = cleanSocialAccounts({ Facebook: rawFacebook });
  assert.equal(cleaned.Facebook.length, 3, "Fourth URL must be blocked");
  assert.equal(cleaned.Facebook[0].name, "Page 1");
  assert.equal(cleaned.Facebook[1].name, "Page 2");
  assert.equal(cleaned.Facebook[2].name, "Page 3");
});

test("2. Duplicate URL detection and rejection per link type", () => {
  // Facebook duplicate rejection (even with slight URL variation like trailing slash)
  const fbList = [
    { url: "https://facebook.com/zappit", name: "Official Page" },
    { url: "https://facebook.com/zappit/", name: "Duplicate Official Page" },
    { url: "https://facebook.com/zappitcareers", name: "Careers" },
  ];
  const cleanedFb = cleanSocialAccounts({ Facebook: fbList });
  assert.equal(cleanedFb.Facebook.length, 2, "Duplicate Facebook URL must be rejected");
  assert.equal(cleanedFb.Facebook[0].url, "https://facebook.com/zappit");
  assert.equal(cleanedFb.Facebook[1].url, "https://facebook.com/zappitcareers");

  // Website duplicate rejection
  const webList = [
    { url: "https://3gzappit.com", name: "Main Website" },
    { url: "https://www.3gzappit.com/", name: "Duplicate Website" },
    { url: "https://shop.3gzappit.com", name: "Shop" },
  ];
  const cleanedWeb = cleanSocialAccounts({ Website: webList });
  assert.equal(cleanedWeb.Website.length, 2, "Duplicate Website URL must be rejected");

  // Google Maps duplicate rejection
  const mapsList = [
    { url: "https://maps.google.com/?q=New+York", name: "NY Office" },
    { url: "https://maps.google.com/?q=New+York", name: "Duplicate NY Office" },
    { url: "https://maps.google.com/?q=London", name: "London Office" },
  ];
  const cleanedMaps = cleanSocialAccounts({ "Google Maps": mapsList });
  assert.equal(cleanedMaps["Google Maps"].length, 2, "Duplicate Maps URL must be rejected");
});

test("3. Single URL appearance: no custom name preserves exact legacy appearance", () => {
  // Single Facebook without custom name -> "Facebook"
  const fbTiles = resolveLinkTiles("Facebook", [{ url: "https://facebook.com/zappit", name: "" }]);
  assert.equal(fbTiles.length, 1);
  assert.equal(fbTiles[0].name, "Facebook");
  assert.equal(fbTiles[0].subText, undefined);
  assert.equal(fbTiles[0].brand, "facebook");

  // Single Website without custom name -> "Website"
  const webTiles = resolveLinkTiles("Website", [{ url: "https://3gzappit.com", name: "" }]);
  assert.equal(webTiles.length, 1);
  assert.equal(webTiles[0].name, "Website");
  assert.equal(webTiles[0].subText, undefined);
  assert.equal(webTiles[0].brand, "website");

  // Single Google Maps without custom name -> "Google Maps"
  const mapTiles = resolveLinkTiles("Google Maps", [{ url: "https://maps.google.com/?q=HQ", name: "" }]);
  assert.equal(mapTiles.length, 1);
  assert.equal(mapTiles[0].name, "Google Maps");
  assert.equal(mapTiles[0].subText, undefined);
  assert.equal(mapTiles[0].brand, "maps");
});

test("4. Single URL with custom display name", () => {
  // Single Website with custom name -> "Official Store"
  const webTiles = resolveLinkTiles("Website", [{ url: "https://3gzappit.com", name: "Official Store" }]);
  assert.equal(webTiles.length, 1);
  assert.equal(webTiles[0].name, "Official Store");
  assert.equal(webTiles[0].subText, undefined);

  // Single Facebook with custom name -> "Community Hub"
  const fbTiles = resolveLinkTiles("Facebook", [{ url: "https://facebook.com/zappit", name: "Community Hub" }]);
  assert.equal(fbTiles.length, 1);
  assert.equal(fbTiles[0].name, "Community Hub");
  assert.equal(fbTiles[0].subText, undefined);
});

test("5. Multiple URLs: custom names show destination subtext, unnamed links show recognizable destination/handle or numbered fallback", () => {
  // Multiple Facebook URLs
  const fbAccounts = [
    { url: "https://facebook.com/zappit", name: "Main Brand" },
    { url: "https://facebook.com/zappitdevs", name: "" },
  ];
  const fbTiles = resolveLinkTiles("Facebook", fbAccounts);
  assert.equal(fbTiles.length, 2);
  // With custom name: name is custom name, subtext is recognizable handle
  assert.equal(fbTiles[0].name, "Main Brand");
  assert.equal(fbTiles[0].subText, "@zappit");
  // Without custom name: name is recognizable handle
  assert.equal(fbTiles[1].name, "@zappitdevs");
  assert.equal(fbTiles[1].subText, undefined);

  // Multiple Website URLs
  const webAccounts = [
    { url: "https://3gzappit.com", name: "Corporate" },
    { url: "https://shop.3gzappit.com", name: "" },
  ];
  const webTiles = resolveLinkTiles("Website", webAccounts);
  assert.equal(webTiles.length, 2);
  assert.equal(webTiles[0].name, "Corporate");
  assert.equal(webTiles[0].subText, "3gzappit.com");
  assert.equal(webTiles[1].name, "shop.3gzappit.com");

  // Multiple Google Maps URLs with numbered fallback
  const mapAccounts = [
    { url: "https://maps.google.com/1", name: "" },
    { url: "https://maps.google.com/2", name: "" },
  ];
  const mapTiles = resolveLinkTiles("Google Maps", mapAccounts);
  assert.equal(mapTiles.length, 2);
  assert.equal(mapTiles[0].name, "Google Maps 1");
  assert.equal(mapTiles[1].name, "Google Maps 2");
});

test("6. Backward compatibility: existing single URLs and Instagram rows", () => {
  const legacyCard = {
    name: "Alex Morgan",
    website: "https://example.com",
    social: {
      Facebook: "https://facebook.com/alex",
      YouTube: "https://youtube.com/@alex",
      LinkedIn: "https://linkedin.com/in/alex",
    },
    instagramAccounts: [
      { url: "https://instagram.com/alex_pro", name: "Pro" },
      { url: "https://instagram.com/alex_personal", name: "Personal" },
    ],
  };

  const completed = completeCardProfile(legacyCard);
  assert.ok(completed.socialAccounts, "Must have socialAccounts");
  assert.equal(completed.socialAccounts.Website.length, 1);
  assert.equal(completed.socialAccounts.Website[0].url, "https://example.com");
  assert.equal(completed.socialAccounts.Facebook.length, 1);
  assert.equal(completed.socialAccounts.Facebook[0].url, "https://facebook.com/alex");
  assert.equal(completed.socialAccounts.Instagram.length, 2);
  assert.equal(completed.socialAccounts.Instagram[0].url, "https://instagram.com/alex_pro");
  assert.equal(completed.socialAccounts.Instagram[0].name, "Pro");
});

test("7. Deleted links stay deleted after save/reload", () => {
  const cardWithLinks = {
    name: "Alex Morgan",
    socialAccounts: {
      Facebook: [], // User removed all Facebook links
      Website: [],  // User removed Website
      Instagram: [{ url: "https://instagram.com/alex", name: "" }],
    },
    social: {
      Facebook: "https://facebook.com/old",
    },
    website: "https://old-website.com",
  };

  const cleaned = cleanCardProfile(cardWithLinks);
  assert.deepEqual(cleaned.socialAccounts.Facebook, []);
  assert.equal(cleaned.social.Facebook, "");
  assert.deepEqual(cleaned.socialAccounts.Website, []);
  assert.equal(cleaned.website, "");
  assert.equal(cleaned.socialAccounts.Instagram.length, 1);

  // Reloading the cleaned profile does not resurrect deleted links
  const reloaded = completeCardProfile(cleaned);
  assert.deepEqual(reloaded.socialAccounts.Facebook, []);
  assert.equal(reloaded.social.Facebook, "");
  assert.deepEqual(reloaded.socialAccounts.Website, []);
  assert.equal(reloaded.website, "");
});

test("8. Selective Apps Share Modal formatting across link types", () => {
  const card = {
    socialAccounts: {
      Instagram: [{ url: "https://instagram.com/alex_pro", name: "Pro Shop" }],
      Facebook: [{ url: "https://facebook.com/alex", name: "" }],
      Website: [
        { url: "https://3gzappit.com", name: "Main Store" },
        { url: "https://docs.3gzappit.com", name: "" },
      ],
      "Google Maps": [
        { url: "https://maps.google.com/1", name: "Headquarters" },
        { url: "https://maps.google.com/2", name: "" },
      ],
    },
  };

  const tiles = resolveAllCardSocialTiles(card);
  const sharePayload = buildFormattedSharePayload(tiles);

  assert.ok(sharePayload.includes("Pro Shop: https://instagram.com/alex_pro"));
  assert.ok(sharePayload.includes("Facebook: https://facebook.com/alex"));
  assert.ok(sharePayload.includes("Main Store (3gzappit.com): https://3gzappit.com"));
  assert.ok(sharePayload.includes("docs.3gzappit.com: https://docs.3gzappit.com"));
  assert.ok(sharePayload.includes("Headquarters (Google Maps 1): https://maps.google.com/1"));
  assert.ok(sharePayload.includes("Google Maps 2: https://maps.google.com/2"));
});
