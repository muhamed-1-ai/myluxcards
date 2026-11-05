import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const accountingOverviewPath = path.join(rootDir, "src/components/accounting/AccountingOverview.tsx");
const sparklinePath = path.join(rootDir, "src/components/leads/Sparkline.tsx");
const leadGrowthChartPath = path.join(rootDir, "src/components/dashboard/LeadGrowthChart.tsx");

const accountingCode = fs.readFileSync(accountingOverviewPath, "utf8");
const sparklineCode = fs.readFileSync(sparklinePath, "utf8");
const leadGrowthCode = fs.readFileSync(leadGrowthChartPath, "utf8");

test("TEST 1: React Error #310 Fix - useDashboardEntrance is called ABOVE if (!activeWorkspace) early return", () => {
  const hookIndex = accountingCode.indexOf("useDashboardEntrance(");
  const earlyReturnIndex = accountingCode.search(/if\s*\(!activeWorkspace\)\s*\{\s*return\b/);

  assert.ok(hookIndex !== -1, "useDashboardEntrance hook must be present");
  assert.ok(earlyReturnIndex !== -1, "Early return for !activeWorkspace must be present");
  assert.ok(
    hookIndex < earlyReturnIndex,
    `useDashboardEntrance (at char ${hookIndex}) must be called BEFORE if (!activeWorkspace) early return (at char ${earlyReturnIndex}) to prevent React error #310`
  );
});

test("TEST 2: All hooks in AccountingOverview execute unconditionally before any top-level return", () => {
  const earlyReturnIndex = accountingCode.search(/if\s*\(!activeWorkspace\)\s*\{\s*return\b/);
  assert.ok(earlyReturnIndex !== -1, "Early return must be found");

  // Check that NO hook is called after earlyReturnIndex
  const afterEarlyReturn = accountingCode.slice(earlyReturnIndex);
  const hookRegex = /\b(useState|useEffect|useRef|useMemo|useCallback|useContext|useDashboardEntrance|useAccounting)\s*\(/g;
  const match = hookRegex.exec(afterEarlyReturn);
  assert.equal(
    match,
    null,
    `No hook should be called after early return! Found: ${match ? match[1] : ""}`
  );
});

test("TEST 3: Entrance animation remains active when activeWorkspace is loaded", () => {
  assert.ok(
    accountingCode.includes("useDashboardEntrance(!isLoadingInitial && hasData)"),
    "useDashboardEntrance condition should account for initial load and data availability"
  );
  assert.ok(
    accountingCode.includes("acc-entrance-header"),
    "Accounting header should still use acc-entrance-header when shouldAnimateEntrance is true"
  );
  assert.ok(
    accountingCode.includes("acc-entrance-card"),
    "Accounting cards should still use acc-entrance-card for entrance motion"
  );
});

test("TEST 4: Chart container measurement guards against zero/negative/infinite dimensions", () => {
  assert.ok(
    accountingCode.includes("Number.isFinite"),
    "Chart width calculation must check Number.isFinite"
  );
  assert.ok(
    accountingCode.includes("getBoundingClientRect().width"),
    "Chart measurement should inspect bounding client rect for real rendered width"
  );
});

test("TEST 5: Chart geometry rendering guarantees finite, non-negative plotWidth and plotHeight", () => {
  assert.ok(
    accountingCode.includes("rawPlotWidth") && accountingCode.includes("rawPlotHeight"),
    "Should compute raw plot width and height"
  );
  assert.ok(
    accountingCode.includes("if (!Number.isFinite(plotWidth) || !Number.isFinite(plotHeight) || plotWidth <= 0 || plotHeight <= 0)"),
    "Should only render chart geometry when plot dimensions are valid, finite, and positive"
  );
});

test("TEST 6: Slot width and <rect> width are strictly non-negative in AccountingOverview", () => {
  assert.ok(
    accountingCode.includes("const slotW = Math.max(0, Number.isFinite(rawSlotW) ? rawSlotW : 0)"),
    "slotW must be clamped to non-negative finite value"
  );
  assert.ok(
    accountingCode.includes("width={rectW}") && accountingCode.includes("const rectW = Math.max(0,"),
    "Interactive hover trigger <rect> width must be explicitly clamped to >= 0"
  );
});

test("TEST 7: Sparkline.tsx guards elapsed time and width attribute against negative values", () => {
  assert.ok(
    sparklineCode.includes("const elapsed = Math.max(0, now - start);"),
    "Sparkline must clamp elapsed time to >= 0 to prevent negative animation progress"
  );
  assert.ok(
    sparklineCode.includes("const p = Math.max(0, 1 - Math.pow(1 - t, 3));"),
    "Sparkline progress factor p must be non-negative"
  );
  assert.ok(
    sparklineCode.includes("const safeW = Math.max(0, p * Math.max(0, width));"),
    "Sparkline animated rect width must be strictly non-negative"
  );
  assert.ok(
    sparklineCode.includes("width={Math.max(0, isSettled ? width : 0)}"),
    "Sparkline clip rect initial width must be strictly non-negative"
  );
});

test("TEST 8: LeadGrowthChart.tsx animation and clip rect guard against negative widths", () => {
  assert.ok(
    leadGrowthCode.includes("const elapsed = Math.max(0, now - start);"),
    "LeadGrowthChart must clamp elapsed time to >= 0"
  );
  assert.ok(
    leadGrowthCode.includes("const currentW = Math.max(0, progress * safePlotWidth);"),
    "LeadGrowthChart animated width must be strictly non-negative"
  );
  assert.ok(
    leadGrowthCode.includes("width={Math.max(0, isSettled ? plotWidth : 0)}"),
    "LeadGrowthChart clip rect width must be strictly non-negative"
  );
});
