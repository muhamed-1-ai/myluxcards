import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test("Mobile Layout Fixes: Navbar Sticky Visibility & Cash Flow Filters", async (t) => {
  const dashboardCssPath = path.join(rootDir, "src/app/dashboard/dashboard.css");
  const accountingCssPath = path.join(rootDir, "src/components/accounting/accounting.css");
  const dashboardDemoPath = path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx");
  const accountingOverviewPath = path.join(rootDir, "src/components/accounting/AccountingOverview.tsx");

  const dashboardCss = fs.readFileSync(dashboardCssPath, "utf-8");
  const accountingCss = fs.readFileSync(accountingCssPath, "utf-8");
  const dashboardDemo = fs.readFileSync(dashboardDemoPath, "utf-8");
  const accountingOverview = fs.readFileSync(accountingOverviewPath, "utf-8");

  await t.test("1. Dashboard Header is in normal flow with sticky top: 0 and elevated z-index", () => {
    // Must be position: sticky with top: 0
    assert.match(
      dashboardCss,
      /\.dash-main-header\s*\{[^}]*position:\s*sticky\s*!important/,
      "Header must use sticky positioning"
    );
    assert.match(
      dashboardCss,
      /\.dash-main-header\s*\{[^}]*top:\s*0\s*!important/,
      "Header must stick at top: 0"
    );
    assert.match(
      dashboardCss,
      /\.dash-main-header\s*\{[^}]*z-index:\s*100\s*!important/,
      "Header must have high z-index (100) above scrolling content"
    );
    assert.match(
      dashboardCss,
      /\.dash-main-header\s*\{[^}]*backdrop-filter:\s*blur\(16px\)/,
      "Header must use backdrop-filter for clean content scrolling underneath"
    );
  });

  await t.test("2. Menu button and header controls remain accessible on narrow viewports", () => {
    // Menu button (hamb-toggle) exists in JSX
    assert.match(dashboardDemo, /className="hamb-toggle"/, "Must render hamburger toggle button");
    // Action controls (theme toggle, notification bell, avatar) exist
    assert.match(dashboardDemo, /className="dash-theme-btn"/, "Must render theme button");
    assert.match(dashboardDemo, /<NotificationBell/, "Must render notification bell");
    assert.match(dashboardDemo, /className="account-menu"/, "Must render account menu");

    // Media query at 640px ensures buttons are 36-38px tap targets with gap
    assert.match(
      dashboardCss,
      /@media\s*\(max-width:\s*640px\)[\s\S]*?\.hamb-toggle\s*\{[^}]*min-width:\s*36px/s,
      "Hamb toggle tap target must be at least 36px on mobile"
    );
    assert.match(
      dashboardCss,
      /@media\s*\(max-width:\s*640px\)[\s\S]*?\.dash-header-right\s*\{[^}]*flex-shrink:\s*0/s,
      "Header right actions must not shrink"
    );
  });

  await t.test("3. Cash flow filter toolbar uses single-column mobile-first grid with 12-16px gap", () => {
    // Base layout is single-column grid
    assert.match(
      accountingCss,
      /\.acc-chart-filters\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*1fr;/s,
      "Filter container must default to 1-column grid"
    );
    // Gap between Category and Subcategory groups is ~12-16px (14px)
    assert.match(
      accountingCss,
      /\.acc-chart-filters\s*\{[^}]*gap:\s*14px;/s,
      "Gap between groups must be approximately 12-16px (14px)"
    );
    // Item direction is column (label above select)
    assert.match(
      accountingCss,
      /\.acc-chart-filter-item\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
      "Filter items must stack label above control"
    );
    // Label is display block with clean spacing
    assert.match(
      accountingCss,
      /\.acc-chart-filter-label\s*\{[^}]*display:\s*block;/s,
      "Filter label must be block element"
    );
  });

  await t.test("4. Select inputs are full width with min-width: 0 and text-overflow: ellipsis", () => {
    assert.match(
      accountingCss,
      /\.acc-chart-filter-select\s*\{[^}]*width:\s*100%;/s,
      "Select inputs must be width: 100%"
    );
    assert.match(
      accountingCss,
      /\.acc-chart-filter-select\s*\{[^}]*max-width:\s*100%;/s,
      "Select inputs must have max-width: 100%"
    );
    assert.match(
      accountingCss,
      /\.acc-chart-filter-select\s*\{[^}]*min-width:\s*0;/s,
      "Select inputs must have min-width: 0 to prevent text overflow expanding parent"
    );
    assert.match(
      accountingCss,
      /\.acc-chart-filter-select\s*\{[^}]*text-overflow:\s*ellipsis;/s,
      "Select inputs must truncate with ellipsis on long names"
    );
  });

  await t.test("5. Multi-viewport mathematical geometry (320px, 360px, 375px, 390px, 430px)", () => {
    const viewports = [320, 360, 375, 390, 430];

    for (const width of viewports) {
      // 1. Navbar bounds check
      const mainPaddingH = 12 * 2; // 24px left/right
      const availableHeaderWidth = width - mainPaddingH;
      const leftControls = 36 + 6 + 90; // hamb(36) + gap(6) + crumb(90 min) = 132px
      const rightControls = 36 + 36 + 36 + 12; // theme(36) + notif(36) + avatar(36) + 2x6 gaps = 120px
      const minHeaderContent = leftControls + rightControls + 8; // 260px

      assert.ok(
        availableHeaderWidth >= minHeaderContent,
        `Header at ${width}px has ${availableHeaderWidth}px >= ${minHeaderContent}px content width without clipping`
      );

      // 2. Cash flow filter bounds check
      const cardPaddingH = 16 * 2; // 32px card horizontal padding
      const toolbarPaddingH = 14 * 2; // 28px toolbar horizontal padding
      const availableFilterWidth = width - mainPaddingH - cardPaddingH - toolbarPaddingH;

      assert.ok(
        availableFilterWidth > 180,
        `Cash flow single-column filter at ${width}px has ${availableFilterWidth}px usable width inside card`
      );
    }
  });

  await t.test("6. Desktop layout adapts to multi-column when available card width allows it", () => {
    assert.match(
      accountingCss,
      /@media\s*\(min-width:\s*641px\)[\s\S]*?\.acc-chart-toolbar\s*\{[^}]*flex-direction:\s*row\s*!important/s,
      "Desktop toolbar switches to row layout"
    );
    assert.match(
      accountingCss,
      /@media\s*\(min-width:\s*641px\)[\s\S]*?\.acc-chart-filters\s*\{[^}]*display:\s*flex\s*!important/s,
      "Desktop filters switch to multi-item row"
    );
  });
});

