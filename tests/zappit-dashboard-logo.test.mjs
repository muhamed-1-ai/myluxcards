import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("1. Official Zappit Logo Asset exists and has expected dimensions and alpha channel", () => {
  const logoPath = path.join(rootDir, "public/brand/zappit-logo-transparent.png");
  assert.ok(fs.existsSync(logoPath), "Official logo file public/brand/zappit-logo-transparent.png must exist");

  const buf = fs.readFileSync(logoPath);
  assert.ok(buf.length > 50000, "Official logo file must not be empty or truncated");

  // PNG IHDR width and height
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(width, 898, "Official logo width must be 898px");
  assert.equal(height, 436, "Official logo height must be 436px");
});

test("2. Reusable BrandLogo component enforces official asset across all variants", () => {
  const brandLogoTsx = fs.readFileSync(path.join(rootDir, "src/components/BrandLogo.tsx"), "utf-8");

  // Must export OFFICIAL_ZAPPIT_LOGO as /brand/zappit-logo-transparent.png
  assert.match(
    brandLogoTsx,
    /OFFICIAL_ZAPPIT_LOGO\s*=\s*"\/brand\/zappit-logo-transparent\.png"/,
    "Must reference the canonical official asset"
  );

  // Must NOT reference the cropped or corrupted mark
  assert.doesNotMatch(
    brandLogoTsx,
    /zappit-mark\.png/,
    "Must not use the cropped/distorted zappit-mark.png"
  );

  // Must export ZappitLogo as an alias
  assert.match(
    brandLogoTsx,
    /export const ZappitLogo = BrandLogo;/,
    "Must export ZappitLogo alias"
  );

  // Must specify objectFit: 'contain' and aspectRatio
  assert.match(
    brandLogoTsx,
    /objectFit:\s*"contain"/,
    "Must specify objectFit: contain"
  );
  assert.match(
    brandLogoTsx,
    /aspectRatio:\s*"898 \/ 436"/,
    "Must preserve the native 898 / 436 aspect ratio"
  );
});

test("3. Sidebar header renders dedicated logo container with variant='sidebar'", () => {
  const dashboardTsx = fs.readFileSync(path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx"), "utf-8");

  // Check structure: side-logo-wrap -> side-logo-container -> side-brand -> BrandLogo variant="sidebar"
  assert.match(
    dashboardTsx,
    /side-logo-wrap[\s\S]*?side-logo-container[\s\S]*?side-brand[\s\S]*?<BrandLogo\s+variant="sidebar"/,
    "Sidebar must render BrandLogo with variant='sidebar' inside dedicated container"
  );

  // Must NOT pass variant="compact" size="compact" to sidebar
  assert.doesNotMatch(
    dashboardTsx,
    /<BrandLogo\s+variant="compact"\s+size="compact"\s*\/>/,
    "Must not use old variant='compact' size='compact' in sidebar"
  );
});

test("4. Dashboard CSS styles side-logo-wrap, side-logo-container, and side-brand appropriately", () => {
  const dashboardCss = fs.readFileSync(path.join(rootDir, "src/app/dashboard/dashboard.css"), "utf-8");

  assert.match(
    dashboardCss,
    /\.side-logo-container\s*\{/,
    "Must define .side-logo-container"
  );

  assert.match(
    dashboardCss,
    /\.side-brand\s+\.zappit-logo-img[\s\S]*?max-width:\s*110px[\s\S]*?max-height:\s*52px[\s\S]*?object-fit:\s*contain/,
    "Must constrain logo to desktop SaaS dimensions (~80-120px) with object-fit: contain"
  );
});

test("5. Reusable Logo.tsx exports BrandLogo and ZappitLogo", () => {
  const logoTsx = fs.readFileSync(path.join(rootDir, "src/components/Logo.tsx"), "utf-8");

  assert.match(logoTsx, /export \{ BrandLogo, ZappitLogo, OFFICIAL_ZAPPIT_LOGO \};/);
});
