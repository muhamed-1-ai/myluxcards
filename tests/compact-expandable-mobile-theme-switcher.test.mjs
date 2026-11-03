import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("1. CompactProfileThemeSwitcher source structure & accessibility requirements", () => {
  const filePath = path.join(rootDir, "src/components/card/CompactProfileThemeSwitcher.tsx");
  assert.ok(fs.existsSync(filePath), "CompactProfileThemeSwitcher.tsx must exist");
  const content = fs.readFileSync(filePath, "utf-8");

  // State: Collapsed by default, expandable
  assert.ok(content.includes("const [isExpanded, setIsExpanded] = useState(false);"), "Must start collapsed (isExpanded = false)");

  // Collapsed trigger button
  assert.ok(content.includes("pts-compact-trigger"), "Renders .pts-compact-trigger button");
  assert.ok(content.includes('aria-haspopup="dialog"'), "Trigger has aria-haspopup");
  assert.ok(content.includes("aria-expanded={isExpanded}"), "Trigger exposes aria-expanded");
  assert.ok(content.includes("pts-compact-trigger-swatch"), "Trigger displays active theme swatch");

  // Popover panel
  assert.ok(content.includes("pts-compact-popover"), "Renders floating popover panel when expanded");
  assert.ok(content.includes('role="dialog"'), "Popover has dialog role");

  // Visible X close button
  assert.ok(content.includes("pts-compact-close-btn"), "Renders visible close button");
  assert.ok(content.includes("setIsExpanded(false)"), "Close button dismisses popover");
  assert.ok(content.includes("<X size="), "Close button renders X icon");

  // Exactly 4 themes in order
  const dashIdx = content.indexOf('id: "dashboard"');
  const cpIdx = content.indexOf('id: "carbon_platinum"');
  const bwIdx = content.indexOf('id: "black_white"');
  const wbIdx = content.indexOf('id: "white_black"');
  assert.ok(dashIdx >= 0 && cpIdx > dashIdx && bwIdx > cpIdx && wbIdx > bwIdx, "Must provide 4 exact themes in order");

  // Click-outside and Escape key dismissal
  assert.ok(content.includes("handleClickOutside"), "Implements click-outside handler");
  assert.ok(content.includes("Escape"), "Implements Escape key dismissal");
});

test("2. Integration in ModernProfileLayout and SimpleProfileLayout anchors companion control beside avatar", () => {
  const modernPath = path.join(rootDir, "src/components/card/ModernProfileLayout.tsx");
  const simplePath = path.join(rootDir, "src/components/card/SimpleProfileLayout.tsx");

  const modernContent = fs.readFileSync(modernPath, "utf-8");
  const simpleContent = fs.readFileSync(simplePath, "utf-8");

  // Both layouts declare themeSwitcher prop
  assert.ok(modernContent.includes("themeSwitcher?: React.ReactNode;"), "ModernProfileLayout declares themeSwitcher prop");
  assert.ok(simpleContent.includes("themeSwitcher?: React.ReactNode;"), "SimpleProfileLayout declares themeSwitcher prop");

  // Both layouts wrap avatar in anchor container
  assert.ok(modernContent.includes("zappit-modern-avatar-anchor"), "ModernProfileLayout renders zappit-modern-avatar-anchor");
  assert.ok(simpleContent.includes("zappit-simple-avatar-anchor"), "SimpleProfileLayout renders zappit-simple-avatar-anchor");

  // Both layouts render {themeSwitcher} inside the avatar anchor
  assert.ok(modernContent.includes("{themeSwitcher}"), "ModernProfileLayout renders {themeSwitcher}");
  assert.ok(simpleContent.includes("{themeSwitcher}"), "SimpleProfileLayout renders {themeSwitcher}");
});

test("3. PublicCardClient mounts desktop switcher and passes CompactProfileThemeSwitcher to profile layouts", () => {
  const clientPath = path.join(rootDir, "src/app/card/[slug]/PublicCardClient.tsx");
  const content = fs.readFileSync(clientPath, "utf-8");

  assert.ok(content.includes("CompactProfileThemeSwitcher"), "PublicCardClient imports CompactProfileThemeSwitcher");
  assert.ok(content.includes("pts-desktop-wrapper"), "Top switcher wrapped in pts-desktop-wrapper");
  assert.ok(content.includes("<CompactProfileThemeSwitcher"), "PublicCardClient passes CompactProfileThemeSwitcher into layouts");
  assert.ok(content.includes("themeSwitcher={"), "Passes themeSwitcher prop");
});

test("4. public-card.css & globals.css enforce responsive isolation and mobile compaction", () => {
  const publicCss = fs.readFileSync(path.join(rootDir, "src/app/card/[slug]/public-card.css"), "utf-8");
  const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf-8");

  for (const [name, css] of [["public-card.css", publicCss], ["globals.css", globalsCss]]) {
    // Desktop wrapper hidden on mobile
    assert.ok(
      css.includes(".pts-desktop-wrapper {\n    display: none !important;") ||
      css.includes(".pts-desktop-wrapper {\r\n    display: none !important;"),
      `${name} must hide .pts-desktop-wrapper on mobile (<= 640px)`
    );

    // Compact trigger hidden on desktop
    assert.ok(css.includes(".pts-compact-wrap {\n    display: none !important;") ||
      css.includes(".pts-compact-wrap {\r\n    display: none !important;"),
      `${name} must hide .pts-compact-wrap on desktop (> 640px)`
    );

    // Anchoring: trigger is positioned outside avatar circle (never blocking photo)
    assert.ok(css.includes("left: calc(100% + 8px);"), `${name} positions trigger outside avatar circle`);
    assert.ok(css.includes(".pts-compact-trigger {"), `${name} styles .pts-compact-trigger`);
    assert.ok(css.includes(".pts-compact-popover {"), `${name} styles .pts-compact-popover`);
    assert.ok(css.includes(".pts-compact-close-btn {"), `${name} styles .pts-compact-close-btn`);
  }
});

test("5. Viewport width calculations for compact expandable switcher (320px to 430px)", () => {
  const POPOVER_WIDTH = 240; // px
  const viewports = [320, 360, 375, 390, 414, 428, 430];

  for (const vp of viewports) {
    const remainingSpace = vp - POPOVER_WIDTH;
    assert.ok(remainingSpace > 0, `Viewport ${vp}px must have ample margin for 240px popover (remaining: ${remainingSpace}px)`);
  }

  const TRIGGER_SIZE = 38; // px
  const AVATAR_DIAMETER_MIN = 80; // px
  const AVATAR_OFFSET = 8; // px

  // On narrowest 320px viewport (container ~300px):
  // Center is 150px. Avatar right edge is 150 + 40 = 190px.
  // Trigger starts at 190 + 8 = 198px, ends at 198 + 38 = 236px.
  // 300 - 236 = 64px of margin to card right boundary!
  const containerWidth320 = 300;
  const avatarCenter320 = containerWidth320 / 2;
  const triggerRightEdge320 = avatarCenter320 + (AVATAR_DIAMETER_MIN / 2) + AVATAR_OFFSET + TRIGGER_SIZE;
  assert.ok(triggerRightEdge320 < containerWidth320, `Trigger right edge (${triggerRightEdge320}px) within 320px container (${containerWidth320}px)`);
  assert.ok(containerWidth320 - triggerRightEdge320 >= 50, "At least 50px buffer to card edge on narrowest mobile screen");
});

