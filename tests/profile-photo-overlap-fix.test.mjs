import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

import {
  resolveAvatarDiameter,
  calculateAvatarSpacing,
} from "../src/lib/themeTokens.ts";

test("1. resolveAvatarDiameter: maps slider scale 65..185 to 70px..200px", () => {
  // Default fallback (100% / undefined)
  assert.equal(resolveAvatarDiameter(undefined), 108);
  assert.equal(resolveAvatarDiameter(null), 108);
  assert.equal(resolveAvatarDiameter(100), 108);

  // Minimum size: 65% maps to 70px
  assert.equal(resolveAvatarDiameter(65), 70);

  // Maximum size: 185% maps to 200px
  assert.equal(resolveAvatarDiameter(185), 200);

  // Clamping extremes
  assert.equal(resolveAvatarDiameter(20), 70);
  assert.equal(resolveAvatarDiameter(250), 200);

  // Intermediate values are monotonic
  const d80 = resolveAvatarDiameter(80);
  const d100 = resolveAvatarDiameter(100);
  const d140 = resolveAvatarDiameter(140);
  const d185 = resolveAvatarDiameter(185);

  assert.ok(d80 < d100, "80% scale diameter must be less than 100%");
  assert.ok(d100 < d140, "100% scale diameter must be less than 140%");
  assert.ok(d140 < d185, "140% scale diameter must be less than 185%");
  assert.equal(d185, 200, "185% scale diameter must reach 200px");
});

test("2. calculateAvatarSpacing: exact mathematical formula matches prompt specification", () => {
  // Spec example: "a 200 px avatar overlapping the cover by 80 px extends 120 px below it.
  // The name must start after that remaining space plus a comfortable gap."
  const maxSpacing = calculateAvatarSpacing(200, true);
  assert.equal(maxSpacing.diameter, 200);
  assert.equal(maxSpacing.overlap, 80); // 40% of 200 = 80px
  assert.equal(maxSpacing.spaceBelowCover, 120); // 200 - 80 = 120px
  assert.equal(maxSpacing.marginTop, -80);
  assert.equal(maxSpacing.gapBeforeName, 20); // 16px–24px comfortable gap

  // Standard avatar (108px)
  const defaultSpacing = calculateAvatarSpacing(108, true);
  assert.equal(defaultSpacing.diameter, 108);
  assert.equal(defaultSpacing.overlap, 43); // round(108 * 0.4) = 43px
  assert.equal(defaultSpacing.spaceBelowCover, 65); // 108 - 43 = 65px
  assert.equal(defaultSpacing.marginTop, -43);
  assert.equal(defaultSpacing.gapBeforeName, 20);

  // Minimum avatar (70px)
  const minSpacing = calculateAvatarSpacing(70, true);
  assert.equal(minSpacing.diameter, 70);
  assert.equal(minSpacing.overlap, 28); // round(70 * 0.4) = 28px
  assert.equal(minSpacing.spaceBelowCover, 42); // 70 - 28 = 42px
  assert.equal(minSpacing.marginTop, -28);
  assert.equal(minSpacing.gapBeforeName, 20);

  // Without cover (e.g. cover removed)
  const noCoverSpacing = calculateAvatarSpacing(108, false);
  assert.equal(noCoverSpacing.overlap, 0);
  assert.equal(noCoverSpacing.spaceBelowCover, 108);
  assert.equal(noCoverSpacing.marginTop, 16);
  assert.equal(noCoverSpacing.gapBeforeName, 20);
});

test("3. Document flow footprint: header is strictly pushed down as avatar grows", () => {
  // As avatar size increases, distance from cover bottom to header must increase monotonically
  const sizes = [70, 90, 108, 140, 175, 200];
  let previousHeaderOffset = 0;

  for (const size of sizes) {
    const spacing = calculateAvatarSpacing(size, true);
    // In normal document flow, the wrapper starts at cover bottom (0).
    // It has marginTop = -overlap. Its bottom edge in flow is at: 0 - overlap + diameter = spaceBelowCover.
    // The following sibling (header) starts at: spaceBelowCover + gapBeforeName.
    const headerOffsetFromCoverBottom = spacing.spaceBelowCover + spacing.gapBeforeName;
    assert.ok(
      headerOffsetFromCoverBottom > previousHeaderOffset,
      `Header offset (${headerOffsetFromCoverBottom}px) for size ${size}px must be greater than previous (${previousHeaderOffset}px)`
    );
    previousHeaderOffset = headerOffsetFromCoverBottom;
  }
});

test("4. CSS & Component integrity: ModernProfileLayout and SimpleProfileLayout", () => {
  const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf-8");
  const modernTsx = fs.readFileSync(path.join(rootDir, "src/components/card/ModernProfileLayout.tsx"), "utf-8");
  const simpleTsx = fs.readFileSync(path.join(rootDir, "src/components/card/SimpleProfileLayout.tsx"), "utf-8");
  const dashboardTsx = fs.readFileSync(path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx"), "utf-8");

  // globals.css must style both avatar-circle and avatar-ring with overflow: hidden and aspect-ratio
  assert.match(globalsCss, /\.zappit-modern-avatar-circle,\s*\.zappit-modern-avatar-ring/);
  assert.match(globalsCss, /overflow:\s*hidden/);
  assert.match(globalsCss, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(globalsCss, /max-width:\s*calc\(100%\s*-\s*32px\)/);

  // globals.css modern header margin-top must be 0 so gapBeforeName controls spacing
  assert.match(globalsCss, /\.zappit-modern-header\s*\{[^}]*margin-top:\s*0/);

  // ModernProfileLayout uses calculateAvatarSpacing
  assert.match(modernTsx, /calculateAvatarSpacing\(avatarDiameter/);
  assert.match(modernTsx, /marginTop:\s*`\$\{spacing\.marginTop\}px`/);
  assert.match(modernTsx, /marginBottom:\s*`\$\{spacing\.gapBeforeName\}px`/);
  assert.match(modernTsx, /width:\s*`\$\{spacing\.diameter\}px`/);

  // ModernProfileLayout inner img transform must use logoZoom (not logoScale)
  assert.match(modernTsx, /scale\(\$\{\(\(card\.logoZoom\s*\|\|\s*100\)\s*\/\s*100\)\}\)/);

  // SimpleProfileLayout inner img transform must also use logoZoom
  assert.match(simpleTsx, /scale\(\$\{\(\(card\.logoZoom\s*\|\|\s*100\)\s*\/\s*100\)\}\)/);

  // DashboardDemo Appearance controls must have separate size (70px-200px) and zoom sliders
  assert.match(dashboardTsx, /Size \(70px – 200px\)/);
  assert.match(dashboardTsx, /Image zoom \(100% – 200%\)/);
});
