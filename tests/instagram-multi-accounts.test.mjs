import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractInstagramHandle,
  isValidInstagramUrl,
  normalizeInstagramUrl,
  cleanInstagramAccounts,
  resolveInstagramTiles,
  MAX_INSTAGRAM_ACCOUNTS,
} from "../src/lib/instagram.js";
import { cleanCardProfile, completeCardProfile } from "../src/lib/cards.js";
import {
  buildFormattedSharePayload,
  resolveItemShareUrl,
} from "../src/components/card/SelectiveAppsShareModal.js";

test("1. Instagram handle extraction and URL validation", () => {
  // Standard URLs
  assert.equal(extractInstagramHandle("https://instagram.com/alex_tech"), "alex_tech");
  assert.equal(extractInstagramHandle("https://www.instagram.com/alex_tech/"), "alex_tech");
  assert.equal(extractInstagramHandle("http://instagram.com/alex_tech?igshid=123&utm_source=qr"), "alex_tech");
  assert.equal(extractInstagramHandle("https://instagr.am/alex_tech"), "alex_tech");
  assert.equal(extractInstagramHandle("instagram.com/alex_tech"), "alex_tech");
  assert.equal(extractInstagramHandle("@alex_tech"), "alex_tech");

  // Normalized URLs
  assert.equal(normalizeInstagramUrl("https://www.instagram.com/alex_tech/"), "https://instagram.com/alex_tech");
  assert.equal(normalizeInstagramUrl("@alex_tech"), "https://instagram.com/alex_tech");

  // Invalid URLs (non-IG domains, reserved paths, empty handles)
  assert.equal(extractInstagramHandle("https://facebook.com/alex_tech"), null);
  assert.equal(extractInstagramHandle("https://twitter.com/alex_tech"), null);
  assert.equal(extractInstagramHandle("https://instagram.com/"), null);
  assert.equal(extractInstagramHandle("https://instagram.com/p/Cxyz123"), null);
  assert.equal(extractInstagramHandle("https://instagram.com/reel/Cxyz123"), null);
  assert.equal(extractInstagramHandle("https://instagram.com/explore"), null);
  assert.equal(extractInstagramHandle("https://instagram.com/accounts"), null);
  assert.equal(extractInstagramHandle("https://instagram.com/a_handle_that_is_far_too_long_for_an_instagram_username"), null);

  assert.equal(isValidInstagramUrl("https://instagram.com/alex"), true);
  assert.equal(isValidInstagramUrl("https://example.com/alex"), false);
});

test("2. Sanitization, duplicate handle rejection, and 3-account limit", () => {
  assert.equal(MAX_INSTAGRAM_ACCOUNTS, 3);

  const rawList = [
    { url: "https://instagram.com/alex_personal", name: "  Personal Profile  " },
    { url: "https://www.instagram.com/alex_personal/", name: "Duplicate should be rejected" },
    { url: "https://instagram.com/alex_shop", name: "Shop" },
    { url: "", name: "" }, // completely blank row
    { url: "https://instagram.com/alex_portfolio", name: "Portfolio" },
    { url: "https://instagram.com/alex_fourth", name: "Fourth Account" }, // 4th should be capped
  ];

  const cleaned = cleanInstagramAccounts(rawList);
  assert.equal(cleaned.length, 3, "Must enforce maximum 3 accounts");
  assert.equal(cleaned[0].url, "https://instagram.com/alex_personal");
  assert.equal(cleaned[0].name, "Personal Profile", "Display name must be trimmed");
  assert.equal(cleaned[1].url, "https://instagram.com/alex_shop");
  assert.equal(cleaned[1].name, "Shop");
  assert.equal(cleaned[2].url, "https://instagram.com/alex_portfolio");
  assert.equal(cleaned[2].name, "Portfolio");
});

test("3. Backward compatibility: legacy single-account cards", () => {
  // Legacy card with social.Instagram
  const legacyProfile = {
    name: "Alex Morgan",
    social: {
      Instagram: "https://instagram.com/alex_legacy",
      LinkedIn: "https://linkedin.com/in/alex",
    },
  };

  const completed = completeCardProfile(legacyProfile);
  assert.ok(Array.isArray(completed.instagramAccounts), "Must return instagramAccounts array");
  assert.equal(completed.instagramAccounts.length, 1);
  assert.equal(completed.instagramAccounts[0].url, "https://instagram.com/alex_legacy");
  assert.equal(completed.instagramAccounts[0].name, "");
  assert.equal(completed.social.Instagram, "https://instagram.com/alex_legacy");

  // Editing another field preserves Instagram accounts
  const editedProfile = {
    ...completed,
    about: "Updated bio description",
  };
  const reCleaned = cleanCardProfile(editedProfile);
  assert.equal(reCleaned.instagramAccounts.length, 1);
  assert.equal(reCleaned.instagramAccounts[0].url, "https://instagram.com/alex_legacy");
  assert.equal(reCleaned.social.Instagram, "https://instagram.com/alex_legacy");
});

test("4. Removing accounts: removing last account cannot be resurrected by legacy data", () => {
  // Card has existing account, user deletes it (sends empty instagramAccounts array)
  const clearedInput = {
    name: "Alex Morgan",
    instagramAccounts: [],
    social: {
      Instagram: "https://instagram.com/old_resurrect_attempt", // Even if old social key is merged
    },
  };

  const cleaned = cleanCardProfile(clearedInput);
  assert.deepEqual(cleaned.instagramAccounts, [], "instagramAccounts must stay empty");
  assert.equal(cleaned.social.Instagram, "", "social.Instagram must be cleared to prevent resurrection");

  // Roundtrip through completeCardProfile
  const completed = completeCardProfile(cleaned);
  assert.deepEqual(completed.instagramAccounts, [], "Must remain empty after reload");
  assert.equal(completed.social.Instagram, "");
});

test("5. Removing one account leaves remaining accounts and names intact", () => {
  const threeAccounts = [
    { url: "https://instagram.com/alpha", name: "Alpha Store" },
    { url: "https://instagram.com/beta", name: "Beta Lab" },
    { url: "https://instagram.com/gamma", name: "Gamma Studio" },
  ];

  const cleaned3 = cleanCardProfile({ instagramAccounts: threeAccounts });
  assert.equal(cleaned3.instagramAccounts.length, 3);

  // Remove middle account (beta)
  const afterRemove = [cleaned3.instagramAccounts[0], cleaned3.instagramAccounts[2]];
  const cleaned2 = cleanCardProfile({ instagramAccounts: afterRemove });

  assert.equal(cleaned2.instagramAccounts.length, 2);
  assert.equal(cleaned2.instagramAccounts[0].url, "https://instagram.com/alpha");
  assert.equal(cleaned2.instagramAccounts[0].name, "Alpha Store");
  assert.equal(cleaned2.instagramAccounts[1].url, "https://instagram.com/gamma");
  assert.equal(cleaned2.instagramAccounts[1].name, "Gamma Studio");
});

test("6. Public card and preview tile resolution rules", () => {
  // Case A: Single account, NO custom name
  const tilesA = resolveInstagramTiles([{ url: "https://instagram.com/alex_design", name: "" }]);
  assert.equal(tilesA.length, 1);
  assert.equal(tilesA[0].name, "Instagram", "Single account without custom name must have 'Instagram' label");
  assert.equal(tilesA[0].subText, undefined, "Single account without custom name has no subText");
  assert.equal(tilesA[0].url, "https://instagram.com/alex_design");
  assert.ok(tilesA[0].ariaLabel.includes("@alex_design"));

  // Case B: Single account, WITH custom name
  const tilesB = resolveInstagramTiles([{ url: "https://instagram.com/alex_design", name: "My Portfolio" }]);
  assert.equal(tilesB.length, 1);
  assert.equal(tilesB[0].name, "My Portfolio", "Single account with custom name must show custom name under icon");
  assert.equal(tilesB[0].subText, undefined);
  assert.equal(tilesB[0].url, "https://instagram.com/alex_design");
  assert.equal(tilesB[0].ariaLabel, "My Portfolio (@alex_design) on Instagram");

  // Case C: Multiple accounts (mix of custom name and no custom name)
  const tilesC = resolveInstagramTiles([
    { url: "https://instagram.com/alex_personal", name: "" }, // no custom name -> @username as main label
    { url: "https://instagram.com/alex_shop", name: "Boutique" }, // custom name -> custom name as main label, @username subText
    { url: "https://instagram.com/alex_tech", name: "Tech Lab" },
  ]);
  assert.equal(tilesC.length, 3);

  // Account 1 (no custom name): main label is @username
  assert.equal(tilesC[0].name, "@alex_personal");
  assert.equal(tilesC[0].subText, undefined);
  assert.equal(tilesC[0].url, "https://instagram.com/alex_personal");
  assert.equal(tilesC[0].ariaLabel, "@alex_personal on Instagram");

  // Account 2 (with custom name): main label is custom name, subText is @username
  assert.equal(tilesC[1].name, "Boutique");
  assert.equal(tilesC[1].subText, "@alex_shop");
  assert.equal(tilesC[1].url, "https://instagram.com/alex_shop");
  assert.equal(tilesC[1].ariaLabel, "Boutique (@alex_shop) on Instagram");

  // Account 3
  assert.equal(tilesC[2].name, "Tech Lab");
  assert.equal(tilesC[2].subText, "@alex_tech");
  assert.equal(tilesC[2].url, "https://instagram.com/alex_tech");
  assert.equal(tilesC[2].ariaLabel, "Tech Lab (@alex_tech) on Instagram");
});

test("7. Apps & Links Share Picker includes each Instagram account with name and handle", () => {
  const tiles = resolveInstagramTiles([
    { url: "https://instagram.com/alex_personal", name: "Personal" },
    { url: "https://instagram.com/alex_shop", name: "Store" },
  ]);

  const shareItems = tiles.map((t) => ({
    key: t.key,
    name: t.name,
    subText: t.subText,
    url: t.url,
    brand: "instagram",
    ariaLabel: t.ariaLabel,
  }));

  assert.equal(shareItems.length, 2);
  assert.equal(shareItems[0].name, "Personal");
  assert.equal(shareItems[0].subText, "@alex_personal");
  assert.equal(shareItems[1].name, "Store");
  assert.equal(shareItems[1].subText, "@alex_shop");

  const payload = buildFormattedSharePayload(shareItems);
  assert.ok(payload.includes("Personal (@alex_personal): https://instagram.com/alex_personal"));
  assert.ok(payload.includes("Store (@alex_shop): https://instagram.com/alex_shop"));
});

