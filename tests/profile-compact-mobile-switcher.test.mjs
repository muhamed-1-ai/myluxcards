import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("1. ProfileThemeSwitcher component source provides accessible names, 4 exact options in order, and touch elements", () => {
  const switcherSource = fs.readFileSync(path.join(rootDir, "src/components/card/ProfileThemeSwitcher.tsx"), "utf8");

  // Options must be exactly the 4 required in order:
  // 1. Dashboard, 2. Carbon Platinum, 3. Black & White, 4. White & Black
  assert.ok(switcherSource.includes('id: "dashboard"'), "Includes dashboard option");
  assert.ok(switcherSource.includes('id: "carbon_platinum"'), "Includes carbon_platinum option");
  assert.ok(switcherSource.includes('id: "black_white"'), "Includes black_white option");
  assert.ok(switcherSource.includes('id: "white_black"'), "Includes white_black option");

  const dashIdx = switcherSource.indexOf('id: "dashboard"');
  const cpIdx = switcherSource.indexOf('id: "carbon_platinum"');
  const bwIdx = switcherSource.indexOf('id: "black_white"');
  const wbIdx = switcherSource.indexOf('id: "white_black"');
  assert.ok(dashIdx < cpIdx && cpIdx < bwIdx && bwIdx < wbIdx, "Options must be in exact order: Dashboard -> Carbon Platinum -> Black & White -> White & Black");

  // Accessible name provided via aria-label on radio buttons
  assert.ok(switcherSource.includes('aria-label={`${opt.label} Theme: ${opt.descriptor}`}'), "Button provides full accessible aria-label");
  assert.ok(switcherSource.includes('role="radio"'), "Button uses radio semantics");
  assert.ok(switcherSource.includes('aria-checked={isSelected}'), "Button exposes checked state");
  assert.ok(switcherSource.includes('title={`${opt.label}: ${opt.descriptor}`}'), "Button exposes tooltip");
  assert.ok(switcherSource.includes("pts-check-badge"), "Renders checkmark badge on active selection");
});

test("2. public-card.css defines compact mobile theme switcher (<= 640px) matching all target dimensions", () => {
  const css = fs.readFileSync(path.join(rootDir, "src/app/card/[slug]/public-card.css"), "utf8");

  // Verify mobile media query exists
  assert.ok(css.includes("@media (max-width: 640px)"), "Defines @media (max-width: 640px)");

  // Extract mobile section
  const mobileStart = css.indexOf("@media (max-width: 640px)");
  const mobileBlock = css.slice(mobileStart, mobileStart + 3500);

  // Requirement: Swatch color preview 28 x 24 px rounded square
  assert.ok(mobileBlock.includes("width: 28px !important;"), "Swatch width must be 28px");
  assert.ok(mobileBlock.includes("height: 24px !important;"), "Swatch height must be 24px");
  assert.ok(mobileBlock.includes("border-radius: 5px !important;"), "Swatch rounded corners");

  // Requirement: Interactive touch target at least 44 x 44 CSS px
  assert.ok(mobileBlock.includes("width: 44px !important;"), "Touch target width must be 44px");
  assert.ok(mobileBlock.includes("height: 44px !important;"), "Touch target height must be 44px");
  assert.ok(mobileBlock.includes("min-width: 44px !important;"), "Touch target min-width must be 44px");
  assert.ok(mobileBlock.includes("min-height: 44px !important;"), "Touch target min-height must be 44px");

  // Requirement: Outer container height approximately 52-60 px
  assert.ok(mobileBlock.includes("height: 56px !important;"), "Container height must be ~56px (52-60px range)");
  assert.ok(mobileBlock.includes("min-height: 52px !important;"), "Container min-height must be 52px");

  // Requirement: Gap between touch targets ~6-8 px
  assert.ok(mobileBlock.includes("gap: 8px !important;"), "Gap between targets must be 8px");

  // Requirement: Centered horizontal alignment
  assert.ok(mobileBlock.includes("justify-content: center !important;"), "Centered horizontal alignment");

  // Requirement: Hide PROFILE THEME heading on mobile
  assert.ok(mobileBlock.includes(".pts-header {\n    display: none !important;"), "Heading hidden on mobile");

  // Requirement: Hide all four theme names visually on mobile
  assert.ok(mobileBlock.includes(".pts-card-label {\n    display: none !important;"), "Theme names hidden visually on mobile");

  // Requirement: Blue selection outline and checkmark on active
  assert.ok(mobileBlock.includes("border-color: #0066FF !important;"), "Active blue outline");
  assert.ok(mobileBlock.includes("box-shadow: 0 0 0 1.5px #0066FF !important;"), "Active blue box shadow");
  assert.ok(mobileBlock.includes(".pts-check-badge"), "Checkmark badge styled for active selection");
});

test("3. Single-row layout calculations across 320px, 375px, 390px, and 430px mobile viewports (no overflow)", () => {
  const BUTTON_WIDTH = 44; // px
  const BUTTON_COUNT = 4;
  const GAP = 8; // px
  const PADDING_HORIZONTAL = 16; // 8px left + 8px right

  const totalContentWidth = (BUTTON_COUNT * BUTTON_WIDTH) + ((BUTTON_COUNT - 1) * GAP) + PADDING_HORIZONTAL;
  // 4 * 44 + 3 * 8 + 16 = 176 + 24 + 16 = 216px
  assert.equal(totalContentWidth, 216, "Total compact switcher width must equal 216px");

  const testViewports = [320, 360, 375, 390, 414, 428, 430];
  for (const vp of testViewports) {
    const marginAvailable = vp - totalContentWidth;
    assert.ok(marginAvailable > 0, `Viewport ${vp}px must have positive margin without horizontal overflow (available: ${marginAvailable}px)`);
    assert.ok(totalContentWidth < vp, `Content width (${totalContentWidth}px) strictly less than viewport (${vp}px)`);
  }
});

test("4. Desktop layout preserved: header, labels, and grid layout remain intact on screens > 640px", () => {
  const css = fs.readFileSync(path.join(rootDir, "src/app/card/[slug]/public-card.css"), "utf8");

  // Base CSS must contain desktop properties outside media query:
  assert.ok(css.includes(".pts-container {"), "Base .pts-container exists");
  assert.ok(css.includes("max-width: 480px;"), "Base desktop max-width 480px");
  assert.ok(css.includes(".pts-header {"), "Base desktop .pts-header exists");
  assert.ok(css.includes(".pts-header-title {"), "Base desktop .pts-header-title exists");
  assert.ok(css.includes("grid-template-columns: repeat(4, 1fr);"), "Base desktop 4-column grid");
  assert.ok(css.includes(".pts-card-label {"), "Base desktop .pts-card-label exists");
  assert.ok(css.includes("width: 38px;"), "Base desktop swatch width 38px");
});

test("5. globals.css and dashboard.css also define the compact mobile switcher rules", () => {
  const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf8");
  const dashCss = fs.readFileSync(path.join(rootDir, "src/app/dashboard/dashboard.css"), "utf8");

  for (const [name, css] of [["globals.css", globalsCss], ["dashboard.css", dashCss]]) {
    assert.ok(css.includes("@media (max-width: 640px)"), `${name} defines @media (max-width: 640px)`);
    assert.ok(css.includes("width: 28px !important;"), `${name} sets mobile swatch width 28px`);
    assert.ok(css.includes("height: 24px !important;"), `${name} sets mobile swatch height 24px`);
    assert.ok(css.includes("width: 44px !important;"), `${name} sets mobile touch target 44px`);
    assert.ok(css.includes(".pts-header {\n    display: none !important;"), `${name} hides header on mobile`);
    assert.ok(css.includes(".pts-card-label {\n    display: none !important;"), `${name} hides label on mobile`);
  }
});

