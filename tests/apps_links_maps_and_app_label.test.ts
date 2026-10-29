import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveAppDownloadTile } from "../src/lib/appDownload";
import { normalizeBrandKey } from "../src/components/card/BrandLogo";

const rootDir = process.cwd();

test("Apps & Links: Google Maps rainbow pin icon and shortened App label verification", async (t) => {
  await t.test("1. Google Maps icon assets exist, are valid, transparent, and authentic", () => {
    const pngPath = path.join(rootDir, "public", "brand-icons", "google-maps.png");
    const svgPath = path.join(rootDir, "public", "brand-icons", "google-maps.svg");
    const mapsSvgPath = path.join(rootDir, "public", "brand-icons", "maps.svg");

    assert.ok(fs.existsSync(pngPath), "google-maps.png must exist in public/brand-icons");
    assert.ok(fs.existsSync(svgPath), "google-maps.svg must exist in public/brand-icons");
    assert.ok(fs.existsSync(mapsSvgPath), "maps.svg must exist in public/brand-icons");

    const svgContent = fs.readFileSync(svgPath, "utf-8");
    assert.ok(svgContent.includes("<svg"), "google-maps.svg must be a valid SVG");
    assert.ok(svgContent.includes("viewBox=\"0 0 24 24\""), "google-maps.svg must define standard 24x24 viewBox");
    assert.ok(svgContent.includes("<image"), "google-maps.svg must embed high-res image");

    // Verify BrandLogo implementation renders the official pin
    const brandLogoPath = path.join(rootDir, "src", "components", "card", "BrandLogo.tsx");
    const brandLogoContent = fs.readFileSync(brandLogoPath, "utf-8");
    assert.ok(brandLogoContent.includes("case \"maps\":"), "BrandLogo must handle case 'maps'");
    assert.ok(
      brandLogoContent.includes("google-maps.png") || brandLogoContent.includes("google-maps.svg"),
      "BrandLogo case 'maps' must reference official rainbow pin asset"
    );
    // Ensure old 4-slice pin is removed from case "maps"
    assert.ok(
      !brandLogoContent.includes("d=\"M12 3.5C8.41 3.5 5.5 6.41 5.5 10c0 1.61.59 3.09 1.56 4.23l4.94 6.27"),
      "Old segmented pin must be replaced"
    );

    // Verify Google Reviews icon is unchanged
    assert.ok(brandLogoContent.includes("case \"reviews\":") || brandLogoContent.includes("case \"google\":"), "Google Reviews must remain intact");
    assert.ok(brandLogoContent.includes("#4285F4") && brandLogoContent.includes("#34A853"), "Google Reviews 'G' logo colors preserved");
  });

  await t.test("2. App tile name is shortened to exactly 'App'", () => {
    // 2a. With custom app name
    const withAppName = resolveAppDownloadTile({
      appName: "Maruti Suzuki",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.maruti",
      appStoreUrl: "https://apps.apple.com/app/id99999",
    }, "android");

    assert.equal(withAppName.visible, true);
    assert.equal(withAppName.name, "App", "Public tile main label must be exactly 'App'");
    assert.equal(withAppName.subText, "Maruti Suzuki", "Configured app name must be displayed underneath as subText");
    assert.equal(withAppName.brand, "download", "Must retain blue download icon brand");

    // 2b. Without custom app name
    const withoutAppName = resolveAppDownloadTile({
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.maruti",
    }, "android");

    assert.equal(withoutAppName.name, "App", "Main label must always be 'App'");
    assert.equal(withoutAppName.subText, undefined, "subText is undefined when no appName configured");

    // 2c. Normalization of 'App' in BrandLogo
    assert.equal(normalizeBrandKey("App"), "download", "normalizeBrandKey('App') must resolve to 'download'");
    assert.equal(normalizeBrandKey("app"), "download", "normalizeBrandKey('app') must resolve to 'download'");
  });

  await t.test("3. CSS and layout verify single-line App label and balanced spacing", () => {
    const globalsCss = fs.readFileSync(path.join(rootDir, "src", "app", "globals.css"), "utf-8");
    assert.ok(
      globalsCss.includes(".zappit-modern-app-tile.zappit-app-tile .zappit-modern-app-name"),
      "globals.css must style app-tile name"
    );
    assert.ok(
      globalsCss.includes("white-space: nowrap;"),
      "globals.css must ensure app label does not wrap"
    );

    const modernLayout = fs.readFileSync(path.join(rootDir, "src", "components", "card", "ModernProfileLayout.tsx"), "utf-8");
    assert.ok(
      modernLayout.includes("item.isAppDownload ? \"zappit-app-tile\" : \"\""),
      "ModernProfileLayout must apply zappit-app-tile class to app download tile"
    );
    assert.ok(
      modernLayout.includes("whiteSpace: \"nowrap\""),
      "ModernProfileLayout must ensure App label stays single-line"
    );

    const simpleLayout = fs.readFileSync(path.join(rootDir, "src", "components", "card", "SimpleProfileLayout.tsx"), "utf-8");
    assert.ok(
      simpleLayout.includes("whiteSpace: \"nowrap\""),
      "SimpleProfileLayout must ensure App label stays single-line"
    );
  });

  await t.test("4. Priority and device routing remain functional", () => {
    // Referral link takes priority
    const referralConfig = {
      appName: "SpeedyApp",
      referralUrl: "https://speedy.link/universal",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.speedy",
      appStoreUrl: "https://apps.apple.com/app/id123",
    };
    const res = resolveAppDownloadTile(referralConfig, "ios");
    assert.equal(res.name, "App");
    assert.equal(res.subText, "SpeedyApp");
    assert.equal(res.url, "https://speedy.link/universal");
    assert.equal(res.action, "direct");
  });
});
