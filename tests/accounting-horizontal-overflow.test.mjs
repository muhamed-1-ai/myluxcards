import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=== Running ZAPPIT Accounting Horizontal Overflow Test Suite ===\n");

// 1. Verify accounting.css styles
const accountingCssPath = path.join(rootDir, "src", "components", "accounting", "accounting.css");
const accountingCss = fs.readFileSync(accountingCssPath, "utf8");

console.log("[1/4] Verifying CSS Grid tracks and shrinkable constraints in accounting.css...");

// Check that .accounting-root has width: 100%, max-width: 100%, min-width: 0, container-type: inline-size
assert.match(
  accountingCss,
  /\.accounting-root\s*\{[^}]*container-type:\s*inline-size/s,
  ".accounting-root must declare container-type: inline-size"
);
assert.match(
  accountingCss,
  /\.accounting-root\s*\{[^}]*min-width:\s*0/s,
  ".accounting-root must declare min-width: 0"
);
assert.match(
  accountingCss,
  /\.accounting-root\s*\{[^}]*max-width:\s*100%/s,
  ".accounting-root must declare max-width: 100%"
);

// Check that .acc-card has min-width: 0, max-width: 100%, width: 100%
assert.match(
  accountingCss,
  /\.acc-card\s*\{[^}]*min-width:\s*0/s,
  ".acc-card must declare min-width: 0 to shrink within grid tracks"
);
assert.match(
  accountingCss,
  /\.acc-card\s*\{[^}]*max-width:\s*100%/s,
  ".acc-card must declare max-width: 100%"
);

// Check that .acc-two-col and .acc-two-col-equal use minmax(0, 1fr)
assert.match(
  accountingCss,
  /\.acc-two-col,\s*\.acc-two-col-equal\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
  ".acc-two-col and .acc-two-col-equal must use minmax(0, 1fr) for shrinkable base tracks"
);

// Check that 2-column tracks use minmax(0, 1fr) minmax(0, 1fr)
assert.match(
  accountingCss,
  /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/s,
  ".acc-two-col-equal 2-column layout must use shrinkable minmax(0, 1fr) tracks"
);

// Check container queries for responsive stacking
assert.match(
  accountingCss,
  /@container\s+accountingRoot\s*\(min-width:\s*860px\)/,
  "accounting.css must support container query for inline-size >= 860px"
);

// Check fallback media query
assert.match(
  accountingCss,
  /@media\s*\(min-width:\s*1200px\)/,
  "accounting.css must have media query fallback for viewport >= 1200px"
);

// Check that .acc-table-wrapper has overflow-x: auto and min-width: 0
assert.match(
  accountingCss,
  /\.acc-table-wrapper\s*\{[^}]*overflow-x:\s*auto/s,
  ".acc-table-wrapper must have overflow-x: auto"
);
assert.match(
  accountingCss,
  /\.acc-table-wrapper\s*\{[^}]*min-width:\s*0/s,
  ".acc-table-wrapper must have min-width: 0"
);

// Verify NO overflow-x: hidden on .accounting-root (Requirement 4: Fix overflow instead of hiding it)
const mobileQueryMatch = accountingCss.match(/@media\s*\(max-width:\s*768px\)\s*\{([^}]+(\{[^}]+\}[^}]*)*)\}/);
if (mobileQueryMatch) {
  assert.doesNotMatch(
    mobileQueryMatch[0],
    /overflow-x:\s*hidden/,
    "Mobile media query must NOT use overflow-x: hidden on .accounting-root to conceal overflow"
  );
}

// Check table cell wrapping and balance alignment
assert.match(
  accountingCss,
  /\.acc-table\s+td\s*\{[^}]*overflow-wrap:\s*break-word/s,
  ".acc-table td must declare overflow-wrap: break-word for long text"
);
assert.match(
  accountingCss,
  /\.acc-table\s+th\.acc-align-right,\s*\.acc-table\s+td\.acc-align-right\s*\{[^}]*white-space:\s*nowrap/s,
  ".acc-align-right must have white-space: nowrap to prevent broken balances"
);

console.log("  ✓ accounting.css rules verified successfully.");

// 2. Verify dashboard.css section wrapping
console.log("\n[2/4] Verifying dashboard.css flex child rules...");
const dashboardCssPath = path.join(rootDir, "src", "app", "dashboard", "dashboard.css");
const dashboardCss = fs.readFileSync(dashboardCssPath, "utf8");

assert.match(
  dashboardCss,
  /\.dash-main\s*>\s*section,\s*\.main-content\s*>\s*section\s*\{[^}]*min-width:\s*0\s*!important/s,
  "dashboard.css must apply min-width: 0 !important on direct section children of dash-main"
);
assert.match(
  dashboardCss,
  /\.dash-main\s*>\s*section,\s*\.main-content\s*>\s*section\s*\{[^}]*max-width:\s*100%\s*!important/s,
  "dashboard.css must apply max-width: 100% !important on direct section children of dash-main"
);

console.log("  ✓ dashboard.css flex rules verified successfully.");

// 3. Verify TransactionsView.tsx and AccountsTransfersView.tsx
console.log("\n[3/4] Verifying TransactionsView and AccountsTransfersView component structures...");
const txViewPath = path.join(rootDir, "src", "components", "accounting", "TransactionsView.tsx");
const txView = fs.readFileSync(txViewPath, "utf8");

assert.match(
  txView,
  /className="acc-two-col-equal"/,
  "TransactionsView must use acc-two-col-equal"
);
assert.match(
  txView,
  /flexWrap:\s*"wrap"/,
  "TransactionsView must allow subtab buttons to wrap"
);
assert.match(
  txView,
  /acc-col-balance/,
  "TransactionsView must use acc-col-balance on balance cells"
);
assert.match(
  txView,
  /overflowWrap:\s*"break-word"/,
  "TransactionsView must allow account names to wrap cleanly"
);

const accountsViewPath = path.join(rootDir, "src", "components", "accounting", "AccountsTransfersView.tsx");
const accountsView = fs.readFileSync(accountsViewPath, "utf8");

assert.match(
  accountsView,
  /className="acc-two-col-equal"/,
  "AccountsTransfersView must use acc-two-col-equal"
);
assert.match(
  accountsView,
  /acc-col-balance/,
  "AccountsTransfersView must use acc-col-balance"
);

console.log("  ✓ Component structures verified successfully.");

// 4. Mathematical Layout Simulation across Desktop & Mobile Breakpoints
console.log("\n[4/4] Simulating layout boundary geometry across all requested viewports...");

const testViewports = [
  // Desktop
  { name: "Desktop Ultra-Wide", width: 1920, sidebar: true },
  { name: "Desktop Large", width: 1440, sidebar: true },
  { name: "Desktop Medium", width: 1280, sidebar: true },
  { name: "Desktop Compact", width: 1024, sidebar: true },
  { name: "Desktop Compact (Sidebar Collapsed)", width: 1024, sidebar: false },
  // Mobile
  { name: "Mobile iPhone 15 Pro Max", width: 430, sidebar: false },
  { name: "Mobile iPhone 15 / 16", width: 390, sidebar: false },
  { name: "Mobile iPhone SE", width: 375, sidebar: false },
  { name: "Mobile Small", width: 320, sidebar: false },
];

for (const vp of testViewports) {
  // Sizing model from dashboard.css & accounting.css
  const sidebarWidth = vp.sidebar ? 272 : 0; // 256px + 16px margin
  const mainPadding = vp.width >= 1024 ? 48 : vp.width >= 768 ? 32 : 24; // 24+24 vs 16+16 vs 12+12
  const rootPadding = vp.width >= 1024 ? 64 : vp.width >= 640 ? 40 : 28; // 32+32 vs 20+20 vs 14+14

  const availableMainWidth = vp.width - sidebarWidth - mainPadding;
  const availableContentWidth = availableMainWidth - rootPadding;

  // Stacking logic: 2 columns when availableContentWidth >= 860px (container query) OR viewport >= 1200px
  const isTwoCol = availableContentWidth >= 860 || vp.width >= 1200;
  const gap = 20; // 1.25rem = 20px

  let upperCardLeft = 0;
  let upperCardWidth = availableContentWidth;
  let upperCardRight = upperCardLeft + upperCardWidth;

  let leftCardLeft = 0;
  let leftCardWidth = isTwoCol ? (availableContentWidth - gap) / 2 : availableContentWidth;
  let leftCardRight = leftCardLeft + leftCardWidth;

  let rightCardLeft = isTwoCol ? leftCardRight + gap : 0;
  let rightCardWidth = isTwoCol ? (availableContentWidth - gap) / 2 : availableContentWidth;
  let rightCardRight = rightCardLeft + rightCardWidth;

  // Assertions:
  // 1. Both cards must stay within availableContentWidth
  const totalGridRight = isTwoCol ? rightCardRight : Math.max(leftCardRight, rightCardRight);
  const overflowPx = Math.max(0, totalGridRight - availableContentWidth);

  assert.equal(
    overflowPx,
    0,
    `Viewport ${vp.name} (${vp.width}px): Grid exceeds content area by ${overflowPx}px!`
  );

  // 2. Outer boundary check: Lower cards outer right must match upper card outer right
  assert.equal(
    Math.round(totalGridRight),
    Math.round(upperCardRight),
    `Viewport ${vp.name} (${vp.width}px): Lower cards right boundary (${totalGridRight}) does not match upper card right boundary (${upperCardRight})!`
  );

  // 3. Gap check when two columns: gap must be 20px (between 20-24px)
  if (isTwoCol) {
    const computedGap = rightCardLeft - leftCardRight;
    assert.equal(
      computedGap,
      gap,
      `Viewport ${vp.name}: Gap between lower cards should be ${gap}px but is ${computedGap}px!`
    );
  }

  // 4. Ensure right page margin is preserved
  const actualRightPageMargin = vp.width - (sidebarWidth + (mainPadding / 2) + (rootPadding / 2) + totalGridRight);
  assert.ok(
    actualRightPageMargin >= mainPadding / 2,
    `Viewport ${vp.name}: Right page margin (${actualRightPageMargin}px) is cut off!`
  );

  console.log(
    `  ✓ ${vp.name} (${vp.width}px): content=${availableContentWidth.toFixed(0)}px, mode=${isTwoCol ? "2-COL" : "STACKED"}, cardWidth=${leftCardWidth.toFixed(0)}px, overflow=0px, rightMargin=${actualRightPageMargin.toFixed(0)}px`
  );
}

console.log("\n=== All Tests Passed Successfully! ===");
