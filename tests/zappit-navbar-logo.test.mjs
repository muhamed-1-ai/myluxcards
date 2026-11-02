import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test("1. Canonical and navbar logo assets exist with valid dimensions and transparency", () => {
  const canonicalPath = path.join(rootDir, "public/brand/zappit-logo-transparent.png");
  const navbarPngPath = path.join(rootDir, "public/brand/zappit-logo-navbar.png");
  const navbarSvgPath = path.join(rootDir, "public/brand/zappit-logo-navbar.svg");

  assert.ok(fs.existsSync(canonicalPath), "Canonical asset must exist");
  assert.ok(fs.existsSync(navbarPngPath), "Navbar PNG asset must exist");
  assert.ok(fs.existsSync(navbarSvgPath), "Navbar SVG asset must exist");

  // Check PNG dimensions from IHDR chunk (bytes 16-23)
  const navBuf = fs.readFileSync(navbarPngPath);
  const width = navBuf.readUInt32BE(16);
  const height = navBuf.readUInt32BE(20);
  const colorType = navBuf.readUInt8(25); // 6 = RGBA

  assert.equal(width, 850, "Navbar logo width must be tightly cropped to 850px");
  assert.equal(height, 396, "Navbar logo height must be tightly cropped to 396px");
  assert.equal(colorType, 6, "Navbar logo must have an RGBA alpha channel");

  // Check SVG contains viewBox
  const svgContent = fs.readFileSync(navbarSvgPath, "utf-8");
  assert.match(svgContent, /viewBox="0 0 850 396"/, "SVG must preserve 850x396 viewBox");
});

test("2. Landing page HTML displays logo directly on navbar without rounded pill container", () => {
  const pageHtml = fs.readFileSync(path.join(rootDir, "src/app/page.tsx"), "utf-8");

  // Must NOT wrap the logo in logo-capsule
  assert.doesNotMatch(
    pageHtml,
    /<div class="logo-capsule">\s*<a href="\/" class="logo logo-img-link"/,
    "Navbar logo must NOT be wrapped inside a separate logo-capsule"
  );

  // Logo must be directly in navbar-container
  assert.match(
    pageHtml,
    /<a href="\/" class="logo logo-img-link" aria-label="Zappit Home">/,
    "Logo link must be directly placed with accessible label 'Zappit Home'"
  );

  // Logo img must have explicit dimensions and navbar asset
  assert.match(
    pageHtml,
    /<img src="\/brand\/zappit-logo-navbar\.png" alt="Zappit" class="brand-logo" width="118" height="55"/,
    "Logo image must use tightly cropped asset with explicit 118x55 dimensions"
  );
});

test("3. LegacyPage portals BrandLogo with header variant and tight navbar asset", () => {
  const legacyTsx = fs.readFileSync(path.join(rootDir, "src/components/layout/LegacyPage.tsx"), "utf-8");

  assert.match(
    legacyTsx,
    /<BrandLogo[\s\S]*?variant="header"/,
    "Must use header variant"
  );
  assert.match(
    legacyTsx,
    /src="\/brand\/zappit-logo-navbar\.png"/,
    "Must pass navbar logo source"
  );
  assert.match(
    legacyTsx,
    /width=\{118\}/,
    "Must specify width 118"
  );
  assert.match(
    legacyTsx,
    /height=\{55\}/,
    "Must specify height 55"
  );
});

test("4. Landing CSS removes pill capsule and styles logo for desktop, tablet, and mobile", () => {
  const landingCss = fs.readFileSync(path.join(rootDir, "src/app/landing.css"), "utf-8");

  // Capsule reset
  assert.match(
    landingCss,
    /\.landing-page \.logo-capsule\s*\{[^}]*display:\s*contents\s*!important/,
    "Capsule must be reset to display: contents"
  );

  // Desktop dimensions (110-130px visible wordmark target)
  assert.match(
    landingCss,
    /width:\s*118px\s*!important/,
    "Desktop logo width must be within 110-130px (118px)"
  );
  assert.match(
    landingCss,
    /height:\s*55px\s*!important/,
    "Desktop logo height must be 55px"
  );
  assert.match(
    landingCss,
    /aspect-ratio:\s*850\s*\/\s*396\s*!important/,
    "Logo must specify 850 / 396 aspect ratio"
  );
  assert.match(
    landingCss,
    /object-fit:\s*contain\s*!important/,
    "Logo must specify object-fit: contain"
  );

  // Focus visible keyboard navigation
  assert.match(
    landingCss,
    /\.landing-page \.logo\.logo-img-link:focus-visible\s*\{[^}]*outline:/,
    "Logo link must have visible focus state"
  );

  // Tablet dimensions
  assert.match(
    landingCss,
    /width:\s*112px\s*!important/,
    "Tablet logo width must be ~112px"
  );

  // Mobile dimensions (90-110px visible wordmark target)
  assert.match(
    landingCss,
    /width:\s*96px\s*!important/,
    "Mobile logo width must be within 90-110px (96px)"
  );
  assert.match(
    landingCss,
    /height:\s*45px\s*!important/,
    "Mobile logo height must be 45px"
  );
});

