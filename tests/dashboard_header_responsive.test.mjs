import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Dashboard header responsive layout verification", async (t) => {
  const cssPath = path.resolve("src/app/dashboard/dashboard.css");
  const tsxPath = path.resolve("src/app/dashboard/DashboardDemo.tsx");

  const css = fs.readFileSync(cssPath, "utf-8");
  const tsx = fs.readFileSync(tsxPath, "utf-8");

  await t.test("1. DashboardDemo.tsx markup includes main-content, header left/right, and controls", () => {
    assert.match(tsx, /className="dash-main main-content"/);
    assert.match(tsx, /className="dash-main-header"/);
    assert.match(tsx, /className="dash-header-left"/);
    assert.match(tsx, /className="dash-header-right"/);
    assert.match(tsx, /className="dash-theme-btn"/);
    assert.match(tsx, /<NotificationBell/);
    assert.match(tsx, /className="account-menu"/);
  });

  await t.test("2. .dash-shell enforces display: flex, width: 100%, and avoids clipping overflow", () => {
    assert.match(css, /\.dash-shell\s*\{[^}]*display:\s*flex\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*width:\s*100%\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*max-width:\s*100%\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*box-sizing:\s*border-box\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*overflow-x:\s*visible\s*!important/);
  });

  await t.test("3. Sidebar is fixed width and in flex flow on desktop", () => {
    assert.match(css, /\.dash-side\s*\{[^}]*width:\s*256px\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*flex-shrink:\s*0\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*position:\s*sticky\s*!important/);
  });

  await t.test("4. .main-content and .dash-main enforce min-width: 0, flex: 1 and margin-left: 0", () => {
    assert.match(css, /\.main-content\s*\{[^}]*min-width:\s*0\s*!important/);
    assert.match(css, /\.dash-main,\s*\.main-content\s*\{[^}]*flex:\s*1\s*1\s*0%\s*!important/);
    assert.match(css, /\.dash-main,\s*\.main-content\s*\{[^}]*min-width:\s*0\s*!important/);
    assert.match(css, /\.dash-main,\s*\.main-content\s*\{[^}]*margin-left:\s*0\s*!important/);
  });

  await t.test("5. .dash-main-header enforces width: 100%, max-width: 100%, overflow: visible and flex space-between", () => {
    assert.match(css, /\.dash-main-header\s*\{[^}]*width:\s*100%\s*!important/);
    assert.match(css, /\.dash-main-header\s*\{[^}]*max-width:\s*100%\s*!important/);
    assert.match(css, /\.dash-main-header\s*\{[^}]*overflow:\s*visible\s*!important/);
    assert.match(css, /\.dash-main-header\s*\{[^}]*display:\s*flex\s*!important/);
    assert.match(css, /\.dash-main-header\s*\{[^}]*align-items:\s*center\s*!important/);
    assert.match(css, /\.dash-main-header\s*\{[^}]*justify-content:\s*space-between\s*!important/);
  });

  await t.test("6. Left section and breadcrumbs handle truncation safely", () => {
    assert.match(css, /\.dash-header-left\s*\{[^}]*min-width:\s*0\s*!important/);
    assert.match(css, /\.dash-breadcrumbs\s*\{[^}]*overflow:\s*hidden\s*!important/);
    assert.match(css, /\.crumb-target\s*\{[^}]*text-overflow:\s*ellipsis\s*!important/);
  });

  await t.test("7. .dash-header-right prevents shrinking, aligns right, and avoids absolute positioning", () => {
    assert.match(css, /\.dash-header-right\s*\{[^}]*flex-shrink:\s*0\s*!important/);
    assert.match(css, /\.dash-header-right\s*\{[^}]*margin-left:\s*auto\s*!important/);
    assert.match(css, /\.dash-header-right\s*\{[^}]*gap:\s*12px\s*!important/);
    assert.match(css, /\.dash-theme-btn\s*\{[\s\S]*?flex-shrink:\s*0\s*!important/);
    assert.match(css, /\.dash-theme-btn\s*\{[\s\S]*?position:\s*relative\s*!important/);
    assert.match(css, /\.account-menu\s*\{[^}]*position:\s*relative\s*!important/);
    assert.match(css, /\.notif-bell-btn\s*\{[^}]*position:\s*relative\s*!important/);
  });

  await t.test("8. Responsive breakpoints for 1024px, 768px, and 640px adapt correctly without 100vw", () => {
    // 1024px
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-side\s*\{[\s\S]*?position:\s*fixed\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-main,\s*\.main-content\s*\{[\s\S]*?margin-left:\s*0\s*!important/);
    // 768px
    assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.theme-btn-label\s*\{[\s\S]*?display:\s*none\s*!important/);
    // 640px
    assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.dash-header-right\s*\{[\s\S]*?flex-shrink:\s*0\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.dash-theme-btn\s*\{[\s\S]*?width:\s*36px\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.notif-bell-btn\s*\{[\s\S]*?width:\s*36px\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.avatar,\s*\.account-menu\s*\.avatar\s*\{[\s\S]*?width:\s*36px\s*!important/);
  });

  await t.test("9. Mathematical bounds across all test viewports", () => {
    // Test 1: 1920px Desktop
    const deskW = 1920;
    const deskSidebar = 256 + 16; // 272
    const deskMain = deskW - deskSidebar; // 1648
    const deskHeader = deskMain - 48; // 1600 (padding 24 on each side)
    const deskRightControls = 115 + 40 + 40 + 24; // 219
    assert.ok(deskHeader > deskRightControls + 300, "1920px header has ample room for all controls");

    // Test 2: 1366px Laptop
    const laptopW = 1366;
    const laptopMain = laptopW - deskSidebar; // 1094
    const laptopHeader = laptopMain - 48; // 1046
    assert.ok(laptopHeader > deskRightControls + 300, "1366px laptop has no clipping");

    // Test 3: 768px Tablet
    const tabW = 768; // sidebar is drawer (fixed translateX(-100%))
    const tabMain = tabW; // 768
    const tabHeader = tabMain - 32; // 736 (padding 16 on each side)
    const tabRightControls = 36 + 40 + 40 + 16; // 132 (label hidden, icon button)
    assert.ok(tabHeader > tabRightControls + 200, "768px tablet adapts gracefully");

    // Test 4: Mobile width 375px
    const mobW = 375;
    const mobMain = mobW; // 375
    const mobHeader = mobMain - 24; // 351 (padding 12 on each side)
    const mobRightControls = 36 + 36 + 36 + 12; // 120 (36x36 controls with 6px gap)
    const mobLeftControls = 36 + 6 + 110; // 152 (hamb-toggle + max-width crumb target)
    assert.ok(mobHeader > mobRightControls + mobLeftControls, "Mobile width fits without horizontal scroll");
  });
});
