import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test("Apps & Links: local SVG brand assets exist and contain authentic colors", () => {
  const brandIconsDir = path.join(rootDir, "public", "brand-icons");
  assert.ok(fs.existsSync(brandIconsDir), "public/brand-icons directory must exist");

  const expectedAssets = [
    "instagram.svg",
    "facebook.svg",
    "youtube.svg",
    "linkedin.svg",
    "x.svg",
    "twitter.svg",
    "whatsapp.svg",
    "google-maps.svg",
    "google.svg",
    "github.svg",
    "website.svg",
  ];

  for (const assetName of expectedAssets) {
    const assetPath = path.join(brandIconsDir, assetName);
    assert.ok(fs.existsSync(assetPath), `Official asset ${assetName} must exist locally`);
    const content = fs.readFileSync(assetPath, "utf-8");
    assert.ok(content.includes("<svg"), `${assetName} must be a valid SVG`);
  }

  // Check Instagram authentic gradient stops and camera geometry
  const igContent = fs.readFileSync(path.join(brandIconsDir, "instagram.svg"), "utf-8");
  assert.ok(igContent.includes("#FFD600"), "Instagram must include official yellow stop");
  assert.ok(igContent.includes("#FF0069") || igContent.includes("#FF7A00"), "Instagram must include official pink/orange stop");
  assert.ok(igContent.includes("#D300C5") || igContent.includes("#7638FA"), "Instagram must include official purple/violet stop");
  assert.ok(!igContent.includes("stroke-white"), "Instagram must not rely on unbranded stroke-white class");

  // Check Facebook official blue
  const fbContent = fs.readFileSync(path.join(brandIconsDir, "facebook.svg"), "utf-8");
  assert.ok(fbContent.includes("#1877F2"), "Facebook must use official Meta blue #1877F2");

  // Check YouTube official red
  const ytContent = fs.readFileSync(path.join(brandIconsDir, "youtube.svg"), "utf-8");
  assert.ok(ytContent.includes("#FF0000"), "YouTube must use official red #FF0000");

  // Check LinkedIn official blue
  const liContent = fs.readFileSync(path.join(brandIconsDir, "linkedin.svg"), "utf-8");
  assert.ok(liContent.includes("#0A66C2"), "LinkedIn must use official blue #0A66C2");

  // Check WhatsApp official green
  const waContent = fs.readFileSync(path.join(brandIconsDir, "whatsapp.svg"), "utf-8");
  assert.ok(waContent.includes("#25D366"), "WhatsApp must use official green #25D366");
});

test("BrandLogo component handles platform normalizations and authentic SVG rendering", () => {
  const componentPath = path.join(rootDir, "src", "components", "card", "BrandLogo.tsx");
  assert.ok(fs.existsSync(componentPath), "BrandLogo.tsx must exist");
  const content = fs.readFileSync(componentPath, "utf-8");

  // Check exports
  assert.ok(content.includes("export function BrandLogo"), "BrandLogo must be exported");
  assert.ok(content.includes("normalizeBrandKey"), "normalizeBrandKey must be defined");

  // Check key platform cases
  const supportedBrands = [
    "instagram",
    "facebook",
    "youtube",
    "linkedin",
    "x",
    "twitter",
    "whatsapp",
    "maps",
    "google",
    "github",
    "website",
  ];

  for (const b of supportedBrands) {
    assert.ok(content.includes(`case "${b}":`) || content.includes(`key === "${b}"`), `BrandLogo must handle case "${b}"`);
  }

  // Ensure Instagram renders authentic gradient
  assert.ok(content.includes("#FFD600"), "BrandLogo Instagram must have #FFD600");
  assert.ok(content.includes("#FF0069"), "BrandLogo Instagram must have #FF0069");
  assert.ok(content.includes("#D300C5"), "BrandLogo Instagram must have #D300C5");

  // Ensure no generic stroke-white or unstyled icon in Instagram case
  assert.ok(!content.includes('className="w-5 h-5 fill-none stroke-white"'), "Must remove washed-out stroke-white icon");

  // Ensure custom uploaded icons are supported
  assert.ok(content.includes("customIcon") || content.includes("isCustomUrl"), "Must preserve custom uploaded icons");
});

test("Profile layouts integrate BrandLogo and protect against theme overrides", () => {
  const modernLayoutPath = path.join(rootDir, "src", "components", "card", "ModernProfileLayout.tsx");
  const simpleLayoutPath = path.join(rootDir, "src", "components", "card", "SimpleProfileLayout.tsx");
  const globalsCssPath = path.join(rootDir, "src", "app", "globals.css");
  const simpleCssPath = path.join(rootDir, "src", "app", "simple-profile.css");

  const modernContent = fs.readFileSync(modernLayoutPath, "utf-8");
  assert.ok(modernContent.includes("BrandLogo"), "ModernProfileLayout must use BrandLogo");
  assert.ok(!modernContent.includes("stroke-white"), "ModernProfileLayout must not use stroke-white on brand icons");

  const simpleContent = fs.readFileSync(simpleLayoutPath, "utf-8");
  assert.ok(simpleContent.includes("BrandLogo"), "SimpleProfileLayout must use BrandLogo");
  assert.ok(!simpleContent.includes("stroke-currentColor"), "SimpleProfileLayout must not use stroke-currentColor on brand icons");

  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");
  assert.ok(globalsCss.includes(".zappit-modern-app-icon"), "globals.css must configure .zappit-modern-app-icon");
  assert.ok(globalsCss.includes("filter: none !important"), "globals.css must protect brand logos from filters");

  const simpleCss = fs.readFileSync(simpleCssPath, "utf-8");
  assert.ok(simpleCss.includes(".zappit-simple-social-icon"), "simple-profile.css must configure .zappit-simple-social-icon");
});
