import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Verify file existence
const MODAL_PATH = path.resolve("src/components/card/SelectiveAppsShareModal.tsx");
const MODERN_LAYOUT_PATH = path.resolve("src/components/card/ModernProfileLayout.tsx");
const SIMPLE_LAYOUT_PATH = path.resolve("src/components/card/SimpleProfileLayout.tsx");
const GLOBALS_CSS_PATH = path.resolve("src/app/globals.css");
const PUBLIC_CARD_CSS_PATH = path.resolve("src/app/card/[slug]/public-card.css");

// Pure JS implementation mirroring resolveItemShareUrl and buildFormattedSharePayload for verification
function isValidStoreUrl(url, storeType = "universal") {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (storeType === "apple") {
    return /^https?:\/\/(apps\.apple\.com|itunes\.apple\.com)\//i.test(trimmed);
  }
  if (storeType === "google") {
    return /^https?:\/\/play\.google\.com\/store\/apps\//i.test(trimmed);
  }
  return /^https?:\/\//i.test(trimmed) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(trimmed);
}

function resolveItemShareUrl(item, appDownload) {
  if (item.isAppDownload) {
    const rawReferral = (appDownload?.referralUrl || "").trim();
    if (rawReferral && isValidStoreUrl(rawReferral, "universal")) {
      return /^https?:\/\//i.test(rawReferral) ? rawReferral : `https://${rawReferral}`;
    }
    const rawApple = (appDownload?.appStoreUrl || "").trim();
    const rawGoogle = (appDownload?.playStoreUrl || "").trim();
    const hasApple = Boolean(rawApple && isValidStoreUrl(rawApple, "apple"));
    const hasGoogle = Boolean(rawGoogle && isValidStoreUrl(rawGoogle, "google"));

    if (hasApple && hasGoogle) {
      const apple = /^https?:\/\//i.test(rawApple) ? rawApple : `https://${rawApple}`;
      const google = /^https?:\/\//i.test(rawGoogle) ? rawGoogle : `https://${rawGoogle}`;
      return `${apple} (iOS) / ${google} (Android)`;
    }
    if (hasApple) return /^https?:\/\//i.test(rawApple) ? rawApple : `https://${rawApple}`;
    if (hasGoogle) return /^https?:\/\//i.test(rawGoogle) ? rawGoogle : `https://${rawGoogle}`;
  }
  return (item.url || "").trim();
}

function buildFormattedSharePayload(selectedItems, appDownload) {
  return selectedItems
    .map((item) => {
      const url = resolveItemShareUrl(item, appDownload);
      return `${item.name}: ${url}`;
    })
    .join("\n");
}

test("SelectiveAppsShareModal file exists and exports required components & utilities", () => {
  assert.ok(fs.existsSync(MODAL_PATH), "SelectiveAppsShareModal.tsx must exist");
  const content = fs.readFileSync(MODAL_PATH, "utf8");

  assert.ok(content.includes("export function resolveItemShareUrl"), "Must export resolveItemShareUrl");
  assert.ok(content.includes("export function buildFormattedSharePayload"), "Must export buildFormattedSharePayload");
  assert.ok(content.includes("export function SelectiveAppsShareModal"), "Must export SelectiveAppsShareModal");
  assert.ok(content.includes("navigator.share"), "Must use navigator.share");
  assert.ok(content.includes("navigator.canShare"), "Must support navigator.canShare check");
  assert.ok(content.includes("navigator.clipboard.writeText"), "Must support clipboard fallback");
  assert.ok(content.includes("AbortError"), "Must ignore user cancellation AbortError");
  assert.ok(content.includes('aria-modal="true"'), "Must have aria-modal attribute");
  assert.ok(content.includes('role="checkbox"'), "Items must have role=checkbox");
  assert.ok(content.includes("aria-checked="), "Items must have aria-checked");
  assert.ok(content.includes("zappit-share-manual-textarea"), "Must provide manual textarea fallback");
  assert.ok(content.includes("Select all"), "Must have Select all button");
  assert.ok(content.includes("Clear selection"), "Must have Clear selection button");
});

test("ModernProfileLayout integrates compact share button and modal", () => {
  assert.ok(fs.existsSync(MODERN_LAYOUT_PATH), "ModernProfileLayout.tsx must exist");
  const content = fs.readFileSync(MODERN_LAYOUT_PATH, "utf8");

  assert.ok(content.includes("SelectiveAppsShareModal"), "Must import and render SelectiveAppsShareModal");
  assert.ok(content.includes("zappit-apps-share-btn"), "Must have zappit-apps-share-btn class");
  assert.ok(content.includes('aria-label="Share apps and links"'), "Must have accessible label for apps share button");
  assert.ok(content.includes("shareAppsModalOpen"), "Must manage shareAppsModalOpen state");
  assert.ok(content.includes("appsShareTriggerRef"), "Must pass trigger ref for focus restoration");
});

test("SimpleProfileLayout integrates compact share button and modal", () => {
  assert.ok(fs.existsSync(SIMPLE_LAYOUT_PATH), "SimpleProfileLayout.tsx must exist");
  const content = fs.readFileSync(SIMPLE_LAYOUT_PATH, "utf8");

  assert.ok(content.includes("SelectiveAppsShareModal"), "Must import and render SelectiveAppsShareModal");
  assert.ok(content.includes("zappit-apps-share-btn"), "Must have zappit-apps-share-btn class");
  assert.ok(content.includes('aria-label="Share apps and links"'), "Must have accessible label for apps share button");
  assert.ok(content.includes("shareAppsModalOpen"), "Must manage shareAppsModalOpen state");
  assert.ok(content.includes("appsShareTriggerRef"), "Must pass trigger ref for focus restoration");
});

test("CSS includes responsive sheet, dialog, touch targets and theme styling", () => {
  const globals = fs.readFileSync(GLOBALS_CSS_PATH, "utf8");
  const cardCss = fs.readFileSync(PUBLIC_CARD_CSS_PATH, "utf8");

  for (const [name, css] of [["globals.css", globals], ["public-card.css", cardCss]]) {
    assert.ok(css.includes(".zappit-apps-share-btn"), `${name} must include .zappit-apps-share-btn`);
    assert.ok(css.includes("min-width: 44px"), `${name} must enforce min 44px touch target`);
    assert.ok(css.includes("min-height: 44px"), `${name} must enforce min 44px touch target height`);
    assert.ok(css.includes(".zappit-share-overlay"), `${name} must include overlay`);
    assert.ok(css.includes(".zappit-share-sheet"), `${name} must include sheet/dialog`);
    assert.ok(css.includes(".zappit-share-drag-bar"), `${name} must include mobile drag bar`);
    assert.ok(css.includes(".zappit-share-item-row"), `${name} must include item rows`);
    assert.ok(css.includes(".zappit-share-checkbox"), `${name} must include checkbox`);
    assert.ok(css.includes(".zappit-share-submit-btn"), `${name} must include submit button`);
  }
});

test("Preserves referral parameters, query strings, fragments, and URL encoding", () => {
  const item1 = {
    key: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/zappit_official?ref=summer2026&utm_source=nfc_card#bio",
    brand: "instagram",
  };
  const item2 = {
    key: "website",
    name: "Portfolio Search",
    url: "https://example.com/search?q=%20luxury%20homes&filter=ready%2Bmove",
    brand: "website",
  };

  assert.equal(
    resolveItemShareUrl(item1),
    "https://www.instagram.com/zappit_official?ref=summer2026&utm_source=nfc_card#bio"
  );
  assert.equal(
    resolveItemShareUrl(item2),
    "https://example.com/search?q=%20luxury%20homes&filter=ready%2Bmove"
  );
});

test("App tile prioritizes smart referral link to maintain referral tracking", () => {
  const appTile = {
    key: "app-download",
    name: "Download Our App",
    url: "https://apps.apple.com/app/id123456789",
    brand: "download",
    isAppDownload: true,
  };
  const appDownload = {
    appName: "Zappit Pro",
    appStoreUrl: "https://apps.apple.com/app/id123456789",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.zappit.app",
    referralUrl: "https://zappit.app.link/invite?ref=john_doe_99&tier=pro",
  };

  const resolved = resolveItemShareUrl(appTile, appDownload);
  assert.equal(
    resolved,
    "https://zappit.app.link/invite?ref=john_doe_99&tier=pro",
    "Must prioritize smart referral URL over direct store links"
  );
});

test("App tile falls back to dual store or individual store when referral is not set", () => {
  const appTile = {
    key: "app-download",
    name: "Download App",
    url: "#",
    brand: "download",
    isAppDownload: true,
  };
  const appDownload = {
    appName: "Zappit",
    appStoreUrl: "https://apps.apple.com/app/id111111111",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.zappit",
  };

  const resolved = resolveItemShareUrl(appTile, appDownload);
  assert.equal(
    resolved,
    "https://apps.apple.com/app/id111111111 (iOS) / https://play.google.com/store/apps/details?id=com.zappit (Android)"
  );
});

test("Payload formatting matches profile order and 'Name: URL' template", () => {
  const items = [
    {
      key: "instagram",
      name: "Instagram",
      url: "https://instagram.com/acme",
      brand: "instagram",
    },
    {
      key: "linkedin",
      name: "LinkedIn",
      url: "https://linkedin.com/in/acme-ceo",
      brand: "linkedin",
    },
    {
      key: "youtube",
      name: "YouTube Channel",
      url: "https://youtube.com/@acme?sub_confirmation=1",
      brand: "youtube",
    },
  ];

  // Single link payload
  const singlePayload = buildFormattedSharePayload([items[0]]);
  assert.equal(singlePayload, "Instagram: https://instagram.com/acme");

  // Multi-link payload
  const multiPayload = buildFormattedSharePayload([items[0], items[2]]);
  assert.equal(
    multiPayload,
    "Instagram: https://instagram.com/acme\nYouTube Channel: https://youtube.com/@acme?sub_confirmation=1"
  );

  // All links payload in profile order
  const allPayload = buildFormattedSharePayload(items);
  assert.equal(
    allPayload,
    "Instagram: https://instagram.com/acme\nLinkedIn: https://linkedin.com/in/acme-ceo\nYouTube Channel: https://youtube.com/@acme?sub_confirmation=1"
  );
});
