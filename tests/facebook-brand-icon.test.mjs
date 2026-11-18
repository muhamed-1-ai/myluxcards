import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeBrandKey } from "../src/components/card/BrandLogo.js";
import { resolveLinkTiles, resolveAllCardSocialTiles } from "../src/lib/socialLinks.js";

const rootDir = process.cwd();

test("1. Official Facebook vector and raster assets exist locally with Meta branding", () => {
  const brandIconsDir = path.join(rootDir, "public", "brand-icons");
  const svgPath = path.join(brandIconsDir, "facebook.svg");
  const pngPath = path.join(brandIconsDir, "facebook.png");

  assert.ok(fs.existsSync(svgPath), "public/brand-icons/facebook.svg must exist locally");
  assert.ok(fs.existsSync(pngPath), "public/brand-icons/facebook.png must exist locally");

  const svgContent = fs.readFileSync(svgPath, "utf-8");
  assert.ok(svgContent.includes("<svg"), "facebook.svg must be a valid SVG document");
  assert.ok(svgContent.includes("#0866FF"), "facebook.svg must use official Meta Facebook blue #0866FF");
  assert.ok(svgContent.includes("#FFFFFF") || svgContent.includes("#fff"), "facebook.svg must use white for the 'f' glyph");

  const pngStats = fs.statSync(pngPath);
  assert.ok(pngStats.size > 1000, "facebook.png must be a high-resolution raster asset (> 1KB)");
});

test("2. BrandLogo component handles Facebook normalization and authentic rendering", () => {
  const componentPath = path.join(rootDir, "src", "components", "card", "BrandLogo.tsx");
  assert.ok(fs.existsSync(componentPath), "BrandLogo.tsx must exist");
  const content = fs.readFileSync(componentPath, "utf-8");

  // Normalization checks
  assert.equal(normalizeBrandKey("facebook"), "facebook");
  assert.equal(normalizeBrandKey("Facebook"), "facebook");
  assert.equal(normalizeBrandKey("fb"), "facebook");
  assert.equal(normalizeBrandKey("FB"), "facebook");
  assert.equal(normalizeBrandKey("https://facebook.com/zappit"), "facebook");

  // JSX rendering checks
  assert.ok(content.includes('case "facebook":'), "BrandLogo must declare case 'facebook'");
  assert.ok(content.includes("#0866FF"), "BrandLogo must use official Meta Facebook blue #0866FF");
  assert.ok(content.includes("#FFFFFF") || content.includes("#fff"), "BrandLogo must render white 'f' glyph");
});

test("3. Multi-URL Facebook support preserves custom display names and URLs", () => {
  // Single link without custom name -> default "Facebook"
  const singleStandard = resolveLinkTiles("Facebook", [{ url: "https://facebook.com/zappit", name: "" }]);
  assert.equal(singleStandard.length, 1);
  assert.equal(singleStandard[0].name, "Facebook");
  assert.equal(singleStandard[0].brand, "facebook");

  // Single link with custom name -> uses custom name
  const singleCustom = resolveLinkTiles("Facebook", [{ url: "https://facebook.com/zappit", name: "Community Page" }]);
  assert.equal(singleCustom.length, 1);
  assert.equal(singleCustom[0].name, "Community Page");
  assert.equal(singleCustom[0].brand, "facebook");

  // Multiple links with an existing link and a second link with a custom name
  const socialAccounts = {
    Facebook: [
      { url: "https://facebook.com/officialzappit", name: "Official Page" },
      { url: "https://facebook.com/groups/zappitvip", name: "VIP Community Group" },
    ],
  };

  const tiles = resolveLinkTiles("Facebook", socialAccounts.Facebook);
  assert.equal(tiles.length, 2, "Must resolve both Facebook links");

  // Tile 1: standard link with custom label
  assert.equal(tiles[0].brand, "facebook", "First tile brand must be facebook");
  assert.equal(tiles[0].url, "https://facebook.com/officialzappit");
  assert.equal(tiles[0].name, "Official Page", "First tile must preserve custom display name");

  // Tile 2: custom named link
  assert.equal(tiles[1].brand, "facebook", "Second tile brand must be facebook");
  assert.equal(tiles[1].url, "https://facebook.com/groups/zappitvip");
  assert.equal(tiles[1].name, "VIP Community Group", "Second tile must preserve custom display name");

  // resolveAllCardSocialTiles integration
  const allExtracted = resolveAllCardSocialTiles({
    social: {},
    socialAccounts,
  });

  const fbExtracted = allExtracted.filter((item) => item.brand === "facebook");
  assert.equal(fbExtracted.length, 2, "resolveAllCardSocialTiles must yield both Facebook items");
  assert.equal(fbExtracted[0].name, "Official Page");
  assert.equal(fbExtracted[1].name, "VIP Community Group");
});

test("4. Extra circular backgrounds removed from stylesheets and layout components", () => {
  const globalsCss = fs.readFileSync(path.join(rootDir, "src", "app", "globals.css"), "utf-8");
  const simpleCss = fs.readFileSync(path.join(rootDir, "src", "app", "simple-profile.css"), "utf-8");
  const dashboardCss = fs.readFileSync(path.join(rootDir, "src", "app", "dashboard", "dashboard.css"), "utf-8");
  const publicClient = fs.readFileSync(path.join(rootDir, "src", "app", "card", "[slug]", "PublicCardClient.tsx"), "utf-8");

  assert.ok(
    globalsCss.includes(".zappit-modern-app-icon.facebook") && globalsCss.includes("background: transparent"),
    "globals.css must ensure .zappit-modern-app-icon.facebook has transparent background"
  );

  assert.ok(
    simpleCss.includes(".zappit-simple-social-icon.facebook") && simpleCss.includes("background: transparent"),
    "simple-profile.css must ensure .zappit-simple-social-icon.facebook has transparent background"
  );

  assert.ok(
    dashboardCss.includes(".social-preview-icon.facebook") && dashboardCss.includes("background: transparent"),
    "dashboard.css must ensure .social-preview-icon.facebook has transparent background"
  );

  assert.ok(
    publicClient.includes('Facebook: { subtitle: "Follow me", icon: <FacebookIcon />, iconBg: "transparent" }'),
    "PublicCardClient must use transparent iconBg for Facebook"
  );
});
