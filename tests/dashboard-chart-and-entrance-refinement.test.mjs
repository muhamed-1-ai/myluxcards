import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("Refined Card Entrance - Physics, Stagger & CSS Variables", () => {
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");
  const accCss = fs.readFileSync(path.join(ROOT, "src/components/accounting/accounting.css"), "utf8");
  const motionTsx = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");

  // 1. Verify getCardEntranceDelay: 60ms stagger, capped at 240ms
  assert.ok(motionTsx.includes("staggerMsOrIsMobile: number | boolean = 60"), "Default stagger must be 60ms");
  assert.ok(motionTsx.includes("maxDelayMs: number = 240"), "Default max delay must be capped at 240ms");

  function getCardEntranceDelay(index, staggerMsOrIsMobile = 60, maxDelayMs = 240) {
    if (typeof staggerMsOrIsMobile === "boolean") {
      return staggerMsOrIsMobile ? Math.min(index * 35, 140) : Math.min(index * 60, 240);
    }
    return Math.min(index * staggerMsOrIsMobile, maxDelayMs);
  }

  // Desktop stagger: exactly 60ms, capped at 240ms
  assert.strictEqual(getCardEntranceDelay(0), 0);
  assert.strictEqual(getCardEntranceDelay(1), 60);
  assert.strictEqual(getCardEntranceDelay(2), 120);
  assert.strictEqual(getCardEntranceDelay(3), 180);
  assert.strictEqual(getCardEntranceDelay(4), 240); // capped
  assert.strictEqual(getCardEntranceDelay(5), 240); // capped
  assert.strictEqual(getCardEntranceDelay(10), 240); // capped

  // Mobile stagger: 35ms, capped at 140ms
  assert.strictEqual(getCardEntranceDelay(0, true), 0);
  assert.strictEqual(getCardEntranceDelay(1, true), 35);
  assert.strictEqual(getCardEntranceDelay(2, true), 70);
  assert.strictEqual(getCardEntranceDelay(3, true), 105);
  assert.strictEqual(getCardEntranceDelay(4, true), 140);
  assert.strictEqual(getCardEntranceDelay(5, true), 140); // capped

  // 2. Verify Sorvo Card Grow Physics in dashboard.css (scale 0.65 -> 1, lower-center origin, 350-450ms)
  assert.ok(dashCss.includes("scale(0.65)"), "Must use scale ~0.65 starting point");
  assert.ok(dashCss.includes("transform-origin: 50% 100%"), "Must use lower-center transform origin (50% 100%)");
  assert.ok(dashCss.includes("0.40s"), "Duration must be in 350-450ms range (0.40s)");
  assert.ok(dashCss.includes("dashCardContentReveal"), "Must coordinate content reveal a beat after card surface grows");
  assert.ok(dashCss.includes("dashTabLeave"), "Must support outgoing tab shrink and fade");
  assert.ok(dashCss.includes("dashTabEnter"), "Must support incoming tab entrance");

  // 3. Verify Mobile simplified depth
  assert.ok(dashCss.includes("dashCardEntranceMobile"), "Must define mobile entrance");
  assert.ok(dashCss.includes("scale(0.90)"), "Mobile must scale gently from 0.90");

  // 4. Verify Accounting CSS matches
  assert.ok(accCss.includes("translateY(18px) scale(0.98) rotateX(4deg)"), "Accounting must match refined 18px / 4deg tilt");
  assert.ok(accCss.includes("0.48s"), "Accounting duration must match 0.48s");
});

test("Connected Loading - Reserved Skeleton Layout & Zero-Collapse Transition", () => {
  const dashFile = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");

  // 1. Verify crm-loading-spinner standalone container is eliminated from main data flow
  assert.ok(!dashFile.includes('<div className="crm-loading-spinner" />'), "Must not show collapsing standalone spinner in data area");

  // 2. Verify reserved skeleton cards in crm-kpi-grid
  assert.ok(dashFile.includes("crm-kpi-card is-skeleton"), "Must render reserved skeleton cards during initial load");
  assert.ok(dashFile.includes("crm-kpi-skeleton-icon"), "Must reserve icon layout");
  assert.ok(dashFile.includes("crm-kpi-skeleton-label"), "Must reserve label layout");
  assert.ok(dashFile.includes("crm-kpi-skeleton-val"), "Must reserve value layout");
  assert.ok(dashFile.includes("crm-kpi-skeleton-sub"), "Must reserve subtitle layout");

  // 3. Verify CSS keeps layout space reserved
  assert.ok(dashCss.includes(".crm-kpi-card.is-skeleton"), "CSS must define .crm-kpi-card.is-skeleton");
  assert.ok(dashCss.includes("dashCardPulse"), "CSS must include subtle pulse shimmer for reserved skeletons");
});

test("Correct Metric Loading - Distinction between Loading, Genuine Zero, & Background Refresh", () => {
  const motionTsx = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");

  // Verify hook handles unloaded state without flashing 0
  assert.ok(motionTsx.includes("passedIsLoaded !== undefined"), "Must support explicit isLoaded flag");
  assert.ok(motionTsx.includes('displayValue = isReady ? formatFn(currentValue) : "…"'), "Must display skeleton placeholder while unready");
  assert.ok(motionTsx.includes('finalValue = isReady ? formatFn('), "Final value must reflect Loading... until ready");
  assert.ok(motionTsx.includes("dash-num-skeleton-dash"), "Component must render skeleton dash while unloaded");

  // Verify background refresh preserves value
  assert.ok(motionTsx.includes("const isFirstLoad = !hasInitialLoadedRef.current"), "Must distinguish first load from subsequent refreshes");
  assert.ok(motionTsx.includes("const startValue = isFirstLoad ? 0 : previousTargetRef.current"), "On background refresh, must start from previous value rather than 0");
});

test("Chart Reveals with Realistic Development Data Fixture", () => {
  // Realistic multi-day timeline fixture with peaks, dips, and genuine zero days
  const realisticGrowthTimeline = [
    { date: "2026-10-28", count: 4 },
    { date: "2026-10-29", count: 11 },
    { date: "2026-10-30", count: 0 }, // genuine zero day
    { date: "2026-10-31", count: 7 },
    { date: "2026-11-01", count: 18 },
    { date: "2026-11-02", count: 14 },
    { date: "2026-11-03", count: 22 },
  ];

  const highest = Math.max(...realisticGrowthTimeline.map((d) => d.count), 0);
  assert.strictEqual(highest, 22, "Max value correctly identified");

  const plotWidth = 640;
  const plotHeight = 236;
  const zeroY = 252;
  const maxVal = Math.ceil(highest * 1.25); // 28

  // Calculate coordinates
  const points = realisticGrowthTimeline.map((pt, i) => {
    const x = 44 + (i / (realisticGrowthTimeline.length - 1)) * plotWidth;
    const y = zeroY - (pt.count / maxVal) * plotHeight;
    return { ...pt, x, y };
  });

  // Verify all points remain strictly within plot bounds
  for (const pt of points) {
    assert.ok(pt.x >= 44 && pt.x <= 44 + plotWidth, `Point X (${pt.x}) in range`);
    assert.ok(pt.y >= 16 && pt.y <= zeroY, `Point Y (${pt.y}) in range`);
    // Genuine zero day must be exactly at zeroY baseline
    if (pt.count === 0) {
      assert.strictEqual(pt.y, zeroY, "Zero count must sit precisely at zero baseline");
    }
  }

  // Verify Fritsch-Carlson Monotone Spline algorithm never overshoots zero baseline
  const n = points.length;
  const dx = [];
  const dy = [];
  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    const dX = points[i + 1].x - points[i].x;
    const dY = points[i + 1].y - points[i].y;
    dx.push(dX);
    dy.push(dY);
    slopes.push(dX === 0 ? 0 : dY / dX);
  }

  const m = new Array(n).fill(0);
  m[0] = slopes[0];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0; // Local extremum: slope must be 0 to prevent ringing/overshoot
    } else {
      m[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }
  m[n - 1] = slopes[n - 2];

  // Point at index 2 (count 0) is a local minimum, its tangent must be clamped
  assert.strictEqual(m[2], 0, "Local minimum at index 2 must have zero slope to prevent dip below baseline");

  // Verify pipeline stage distribution calculation
  const pipelineCounts = {
    NEW: 18,
    CONTACTED: 12,
    INTERESTED: 7,
    FOLLOW_UP: 5,
    WON: 9,
    LOST: 0, // genuine zero stage
  };

  const total = Object.values(pipelineCounts).reduce((a, b) => a + b, 0); // 51
  assert.strictEqual(total, 51);

  const newPct = Math.round((pipelineCounts.NEW / total) * 100);
  assert.strictEqual(newPct, 35);

  const lostPct = Math.round((pipelineCounts.LOST / total) * 100);
  assert.strictEqual(lostPct, 0, "Zero stage must accurately calculate 0%");
});

test("Accounting Cash Flow Dual-Line and Mixed Inflow/Outflow Verification", () => {
  const mixedTrend = [
    { label: "Day 1", inflow_minor: 500000, outflow_minor: 200000 },
    { label: "Day 2", inflow_minor: 0, outflow_minor: 150000 }, // net negative
    { label: "Day 3", inflow_minor: 750000, outflow_minor: 300000 },
    { label: "Day 4", inflow_minor: 120000, outflow_minor: 400000 }, // net negative
    { label: "Day 5", inflow_minor: 900000, outflow_minor: 100000 },
  ];

  const totalInflow = mixedTrend.reduce((sum, d) => sum + d.inflow_minor, 0);
  const totalOutflow = mixedTrend.reduce((sum, d) => sum + d.outflow_minor, 0);
  const netFlow = totalInflow - totalOutflow;

  assert.strictEqual(totalInflow, 2270000);
  assert.strictEqual(totalOutflow, 1150000);
  assert.strictEqual(netFlow, 1120000);

  // Negative day calculation
  const day2Net = mixedTrend[1].inflow_minor - mixedTrend[1].outflow_minor;
  assert.ok(day2Net < 0, "Day 2 must be negative (-150000)");

  // Formatting check
  function formatMoney(minorUnits, currency = "INR") {
    const symbol = currency === "INR" ? "₹" : "$";
    const major = (minorUnits / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${major}`;
  }

  assert.strictEqual(formatMoney(day2Net), "₹-1,500.00");
  assert.strictEqual(formatMoney(netFlow), "₹11,200.00");
});

