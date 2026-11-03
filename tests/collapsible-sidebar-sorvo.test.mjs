import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const dashboardDemoPath = path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx");
const dashboardCssPath = path.join(rootDir, "src/app/dashboard/dashboard.css");
const layoutPath = path.join(rootDir, "src/app/layout.tsx");

test("Collapsible Sidebar (Sorvo Reference) Architecture Suite", async (t) => {
  const demoCode = fs.readFileSync(dashboardDemoPath, "utf8");
  const cssCode = fs.readFileSync(dashboardCssPath, "utf8");
  const layoutCode = fs.readFileSync(layoutPath, "utf8");

  await t.test("1. Pre-paint inline script prevents wide sidebar flash on reload", () => {
    assert.match(
      layoutCode,
      /zappit_sidebar_collapsed/,
      "layout.tsx must check zappit_sidebar_collapsed before first paint"
    );
    assert.match(
      layoutCode,
      /root\.classList\.add\("is-rail"\)/,
      "layout.tsx must pre-apply is-rail class when saved preference is collapsed"
    );
  });

  await t.test("2. Shared layout and coordinated CSS variables for desktop expand/collapse", () => {
    assert.match(cssCode, /--dash-sidebar-w:\s*260px/, "dashboard.css defines expanded sidebar width");
    assert.match(cssCode, /--dash-rail-w:\s*80px/, "dashboard.css defines collapsed rail width");
    assert.match(
      cssCode,
      /\.dash-shell\.is-rail \.dash-side[\s\S]*?width:\s*var\(--dash-rail-w\)/,
      "Collapsed rail contracts to var(--dash-rail-w)"
    );
    assert.match(
      cssCode,
      /\.dash-main[\s\S]*?flex:\s*1 1 0%/,
      "Main content is a flex sibling that fluidly coordinates width with the sidebar"
    );
  });

  await t.test("3. Explicit transitions and reduced motion support", () => {
    assert.match(
      cssCode,
      /transition:\s*width 0\.32s cubic-bezier\(0\.4, 0, 0\.2, 1\)/,
      "Sidebar uses explicit cubic-bezier(0.4, 0, 0.2, 1) transition matching Sorvo"
    );
    assert.match(
      cssCode,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?transition:\s*none !important/i,
      "Respects user preference for reduced motion"
    );
  });

  await t.test("4. Proportional single canonical brand logo and centered collapse button in rail mode", () => {
    assert.match(demoCode, /side-collapse-btn/, "Includes collapse toggle button");
    assert.match(demoCode, /aria-keyshortcuts="\["/, "Includes [ keyboard shortcut for sidebar toggle");
    assert.match(demoCode, /zappit-logo-transparent\.png/, "Includes canonical transparent logo");
    assert.doesNotMatch(
      demoCode.slice(demoCode.indexOf("side-logo-wrap"), demoCode.indexOf("side-collapse-btn")),
      /zappit-mark\.png/,
      "No duplicate compact logo in expanded sidebar header"
    );
    assert.match(
      cssCode,
      /\.dash-shell\.is-rail \.side-collapse-icon[\s\S]*?transform:\s*scaleX\(-1\)/,
      "Collapse button flips in rail mode to indicate expand direction"
    );
    assert.match(
      cssCode,
      /\.side-rail-footer\s*\{\s*display:\s*none !important;/,
      "Bottom user avatar is hidden in expanded mode"
    );
  });

  await t.test("5. Anchored Flyout Popover for nested items in rail mode", () => {
    assert.match(demoCode, /rail-flyout-popover/, "Renders anchored flyout popover in rail mode");
    assert.match(demoCode, /railFlyout\.group === "accounting"/, "Accounting group has anchored flyout destinations");
    assert.match(demoCode, /railFlyout\.group === "master-config"/, "Master Config has anchored flyout destinations");
    assert.match(demoCode, /railFlyout\.group === "card-profile"/, "Card & Profile has anchored flyout destinations");
    assert.match(demoCode, /e\.key === "Escape"/, "Escape key closes the rail flyout and tooltips");
  });

  await t.test("6. Accessible floating tooltips for rail items", () => {
    assert.match(demoCode, /rail-floating-tooltip/, "Renders floating tooltip for rail icons on hover/focus");
    assert.match(cssCode, /\.rail-floating-tooltip/, "Styles floating tooltip with dark glass appearance");
  });

  await t.test("7. Bottom Account Controls with user avatar and cloud status indicator", () => {
    assert.match(demoCode, /side-rail-footer/, "Renders compact user avatar at bottom of rail");
    assert.match(demoCode, /rail-user-avatar-btn/, "User avatar button with initials and pulse dot");
    assert.match(cssCode, /\.rail-user-status-dot/, "Pulse online status indicator at bottom");
  });

  await t.test("8. Mobile Drawer Isolation: preserves independent overlay on screens <= 1024px", () => {
    assert.match(
      cssCode,
      /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-shell\.is-rail \.dash-side[\s\S]*?width:\s*280px !important/,
      "Mobile screen sizes override rail width and keep full drawer width"
    );
    assert.match(
      cssCode,
      /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.side-collapse-btn[\s\S]*?display:\s*none !important/,
      "Desktop collapse toggle is hidden on mobile screens"
    );
  });
});

