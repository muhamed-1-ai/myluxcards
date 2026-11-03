import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const dashboardDemoPath = path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx");
const dashboardCssPath = path.join(rootDir, "src/app/dashboard/dashboard.css");

test("Animated Active Menu Highlight (Sorvo Reference) Test Suite", async (t) => {
  const demoCode = fs.readFileSync(dashboardDemoPath, "utf8");
  const cssCode = fs.readFileSync(dashboardCssPath, "utf8");

  await t.test("1. Moving Selection Highlight element exists inside nav scroll container", () => {
    assert.match(
      demoCode,
      /<div\s+className=\{`side-active-indicator\s+\$\{indicatorReady\s*\?\s*"is-ready"\s*:\s*""\}`\}/,
      "Renders .side-active-indicator inside navScrollRef"
    );
    assert.match(
      demoCode,
      /ref=\{navScrollRef\}/,
      "nav element binds navScrollRef container"
    );
    assert.match(
      demoCode,
      /transform:\s*`translate3d\(\$\{indicatorStyle\.left\}px,\s*\$\{indicatorStyle\.top\}px,\s*0\)`/,
      "Uses GPU-accelerated translate3d for smooth 60/120fps motion"
    );
    assert.match(
      demoCode,
      /aria-hidden="true"/,
      "Indicator is marked aria-hidden for screen readers"
    );
  });

  await t.test("2. CSS transitions coordinates and dimensions together with cubic-bezier easing", () => {
    assert.match(
      cssCode,
      /\.side-active-indicator\s*\{[\s\S]*?transition:\s*transform\s*300ms\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/,
      "Transitions transform in 300ms with cubic-bezier(0.4, 0, 0.2, 1)"
    );
    assert.match(
      cssCode,
      /\.side-active-indicator\s*\{[\s\S]*?width\s*300ms\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/,
      "Transitions width together with transform"
    );
    assert.match(
      cssCode,
      /\.side-active-indicator\s*\{[\s\S]*?height\s*300ms\s*cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/,
      "Transitions height together with transform"
    );
    assert.match(
      cssCode,
      /\.side-active-indicator\s*\{[\s\S]*?background:\s*#0066FF/,
      "Uses Zappit brand blue accent for the active pill background"
    );
  });

  await t.test("3. Initial load places indicator instantaneously without flying in", () => {
    assert.match(
      cssCode,
      /\.side-active-indicator:not\(\.is-ready\)\s*\{\s*transition:\s*none\s*!important;\s*opacity:\s*0\s*!important;\s*\}/,
      "Suppresses transition and hides indicator before initial measurement"
    );
    assert.match(
      demoCode,
      /updateActiveIndicator\(true\)/,
      "Calls updateActiveIndicator(true) on initial mount for immediate placement"
    );
  });

  await t.test("4. Navigation items set data-active-nav and aria-current='page'", () => {
    assert.match(
      demoCode,
      /data-active-nav=\{isOverviewActive\s*\?\s*"true"\s*:\s*undefined\}/,
      "Overview sets data-active-nav attribute"
    );
    assert.match(
      demoCode,
      /aria-current=\{isOverviewActive\s*\?\s*"page"\s*:\s*undefined\}/,
      "Overview sets aria-current='page'"
    );
    assert.match(
      demoCode,
      /data-active-nav=\{isLeadsActive\s*\?\s*"true"\s*:\s*undefined\}/,
      "All Leads sets data-active-nav attribute"
    );
    assert.match(
      demoCode,
      /data-active-nav=\{isSettingsActive\s*\?\s*"true"\s*:\s*undefined\}/,
      "Settings sets data-active-nav attribute"
    );
  });

  await t.test("5. Nested groups: child gets highlight when open, parent gets highlight when closed/rail", () => {
    assert.match(
      demoCode,
      /isAccountingParentActive\s*=\s*\(!accountingOpen\s*\|\|\s*desktopCollapsed\)\s*&&\s*isAccountingGroupActive/,
      "Accounting parent is active when collapsed or closed"
    );
    assert.match(
      demoCode,
      /isMasterConfigParentActive\s*=\s*\(!masterConfigOpen\s*\|\|\s*desktopCollapsed\)\s*&&\s*isMasterConfigGroupActive/,
      "Master Config parent is active when collapsed or closed"
    );
    assert.match(
      demoCode,
      /is-parent-expanded-active/,
      "Parent gets subtle expanded accent when child is active without competing highlight"
    );
    assert.match(
      cssCode,
      /\.side-parent-btn\.is-parent-expanded-active\s*\{\s*color:\s*#168BFF\s*!important;/,
      "Parent button has subtle text/icon color when group is expanded with active child"
    );
  });

  await t.test("6. Separate hover and focus from selection", () => {
    assert.match(
      cssCode,
      /\.side-nav-item:hover:not\(\[aria-current="page"\]\):not\(\.active\)/,
      "Hover background only applies to unselected items"
    );
    assert.match(
      cssCode,
      /\.side-nav-item:focus-visible[\s\S]*?outline:\s*2px solid #168BFF/,
      "Keyboard focus is visibly distinct with an outline ring"
    );
  });

  await t.test("7. Continuous alignment on resize, scrolling, and sidebar collapse/expand", () => {
    assert.match(
      demoCode,
      /ResizeObserver/,
      "Uses ResizeObserver to track dimension reflows"
    );
    assert.match(
      demoCode,
      /window\.addEventListener\("resize",\s*handleResize\)/,
      "Listens to window resize events dispatched during sidebar animations"
    );
    assert.match(
      cssCode,
      /\.side-nav-scroll\s*\{[\s\S]*?position:\s*relative\s*!important;/,
      "Nav container is relative so indicator scrolls natively with content"
    );
  });

  await t.test("8. Accessibility: respects prefers-reduced-motion and scoped page transition", () => {
    assert.match(
      cssCode,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.side-active-indicator/,
      "Respects prefers-reduced-motion for the active indicator"
    );
    assert.match(
      cssCode,
      /@keyframes\s+contentFadeIn/,
      "Scoped subtle content-area fade in"
    );
  });
});

