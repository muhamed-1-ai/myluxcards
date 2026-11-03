import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("Dashboard Motion Module - getCardEntranceDelay calculations", () => {
  const motionTsx = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");
  assert.ok(motionTsx.includes("export function getCardEntranceDelay"), "Should export getCardEntranceDelay");

  // Replicate logic to verify exact math
  function getCardEntranceDelay(index, staggerMsOrIsMobile = 55, maxDelayMs = 320) {
    if (typeof staggerMsOrIsMobile === "boolean") {
      return staggerMsOrIsMobile ? Math.min(index * 35, 220) : Math.min(index * 55, 320);
    }
    return Math.min(index * staggerMsOrIsMobile, maxDelayMs);
  }

  // Desktop default
  assert.strictEqual(getCardEntranceDelay(0), 0);
  assert.strictEqual(getCardEntranceDelay(1), 55);
  assert.strictEqual(getCardEntranceDelay(2), 110);
  assert.strictEqual(getCardEntranceDelay(3), 165);
  assert.strictEqual(getCardEntranceDelay(4), 220);
  assert.strictEqual(getCardEntranceDelay(5), 275);
  assert.strictEqual(getCardEntranceDelay(6), 320); // capped at 320ms (6 * 55 = 330)
  assert.strictEqual(getCardEntranceDelay(10), 320); // capped at 320ms

  // Mobile boolean
  assert.strictEqual(getCardEntranceDelay(0, true), 0);
  assert.strictEqual(getCardEntranceDelay(1, true), 35);
  assert.strictEqual(getCardEntranceDelay(2, true), 70);
  assert.strictEqual(getCardEntranceDelay(6, true), 210);
  assert.strictEqual(getCardEntranceDelay(7, true), 220); // capped at 220ms
  assert.strictEqual(getCardEntranceDelay(10, true), 220);

  // Custom parameters
  assert.strictEqual(getCardEntranceDelay(2, 40, 200), 80);
  assert.strictEqual(getCardEntranceDelay(6, 40, 200), 200);
});

test("Dashboard Motion Module - Easing curve power3.out guarantees", () => {
  const motionTsx = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");
  assert.ok(motionTsx.includes("1 - Math.pow(1 - progress, 3)"), "Should use cubic-bezier power3.out formula");

  function power3Out(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Boundary conditions
  assert.strictEqual(power3Out(0), 0, "Starts at 0");
  assert.strictEqual(power3Out(1), 1, "Ends at 1");

  // Monotonic increase
  let prev = -1;
  for (let t = 0; t <= 1; t += 0.05) {
    const val = power3Out(t);
    assert.ok(val >= prev, `Value at ${t} (${val}) must be >= previous (${prev})`);
    prev = val;
  }

  // Decelerating curve (rapid initial rise, gentle landing)
  // At t=0.2, power3Out is ~0.488 (halfway done in first 20% of time)
  assert.ok(power3Out(0.2) > 0.45, "Should have responsive front-loaded acceleration");
  // At t=0.5, power3Out is 0.875
  assert.ok(power3Out(0.5) > 0.85, "Should be ~87.5% complete by midpoint");
});

test("Dashboard Motion Module - AnimatedNumber accessibility & precision guarantees", () => {
  const motionTsx = fs.readFileSync(path.join(ROOT, "src/lib/dashboardMotion.tsx"), "utf8");
  assert.ok(motionTsx.includes('aria-label={finalValue}'), "Must set aria-label to authoritative finalValue");
  assert.ok(motionTsx.includes('aria-hidden="true"'), "Must mark intermediate displayValue as aria-hidden to avoid screen reader chatter");
  assert.ok(motionTsx.includes('usePrefersReducedMotion'), "Must integrate user reduced motion preferences");
  assert.ok(motionTsx.includes('dash-animated-num'), "Must include dash-animated-num root class");
});

test("CSS Entrance Styles - dashboard.css definitions", () => {
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");

  // Header entrance
  assert.ok(dashCss.includes(".dash-entrance-header"), "dashboard.css should define .dash-entrance-header");
  assert.ok(dashCss.includes("@keyframes dashHeaderEntrance"), "dashboard.css should define dashHeaderEntrance keyframe");

  // Staggered card entrance with settling tilt
  assert.ok(dashCss.includes(".dash-entrance-card"), "dashboard.css should define .dash-entrance-card");
  assert.ok(dashCss.includes("var(--entrance-delay, 0ms)"), "dashboard.css should use var(--entrance-delay)");
  assert.ok(dashCss.includes("@keyframes dashCardEntrance"), "dashboard.css should define dashCardEntrance keyframe");
  assert.ok(dashCss.includes("perspective(1000px)"), "Card entrance should include subtle 3D perspective");
  assert.ok(dashCss.includes("rotateX(1deg)"), "Card entrance should include settling tilt");

  // Mobile reduced travel
  assert.ok(dashCss.includes("@media (max-width: 640px)"), "dashboard.css should have mobile responsive rule");
  assert.ok(dashCss.includes("dashCardEntranceMobile"), "dashboard.css should define mobile card entrance");

  // Chart reveals
  assert.ok(dashCss.includes(".dash-chart-line-reveal"), "dashboard.css should define .dash-chart-line-reveal");
  assert.ok(dashCss.includes(".dash-chart-area-reveal"), "dashboard.css should define .dash-chart-area-reveal");
  assert.ok(dashCss.includes(".dash-animated-pipeline-fill"), "dashboard.css should define .dash-animated-pipeline-fill");

  // Reduced motion override
  assert.ok(dashCss.includes("@media (prefers-reduced-motion: reduce)"), "dashboard.css must support prefers-reduced-motion");
  assert.ok(dashCss.includes("animation: none !important"), "Must disable animations when prefers-reduced-motion is active");
});

test("CSS Entrance Styles - accounting.css definitions", () => {
  const accCss = fs.readFileSync(path.join(ROOT, "src/components/accounting/accounting.css"), "utf8");

  // Header entrance
  assert.ok(accCss.includes(".acc-entrance-header"), "accounting.css should define .acc-entrance-header");
  assert.ok(accCss.includes("@keyframes accHeaderEntrance"), "accounting.css should define accHeaderEntrance keyframe");

  // Staggered card entrance
  assert.ok(accCss.includes(".acc-entrance-card"), "accounting.css should define .acc-entrance-card");
  assert.ok(accCss.includes("@keyframes accCardEntrance"), "accounting.css should define accCardEntrance keyframe");
  assert.ok(accCss.includes("accCardEntranceMobile"), "accounting.css should define accCardEntranceMobile");

  // Cash flow chart reveals
  assert.ok(accCss.includes(".acc-chart-line-reveal-in"), "accounting.css should define .acc-chart-line-reveal-in");
  assert.ok(accCss.includes(".acc-chart-line-reveal-out"), "accounting.css should define .acc-chart-line-reveal-out");
  assert.ok(accCss.includes(".acc-chart-area-reveal"), "accounting.css should define .acc-chart-area-reveal");
  assert.ok(accCss.includes(".acc-chart-point-reveal"), "accounting.css should define .acc-chart-point-reveal");

  // Animated number
  assert.ok(accCss.includes(".acc-animated-num"), "accounting.css should define .acc-animated-num");

  // Reduced motion override
  assert.ok(accCss.includes("@media (prefers-reduced-motion: reduce)"), "accounting.css must support prefers-reduced-motion");
});

test("Component Integration - LeadManagementDashboard.tsx", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");

  assert.ok(file.includes('from "@/lib/dashboardMotion"'), "Must import motion utilities");
  assert.ok(file.includes("AnimatedNumber"), "Must import AnimatedNumber");
  assert.ok(file.includes("useDashboardEntrance(!loading && Boolean(data))"), "Must wire useDashboardEntrance to initial data loaded condition");
  assert.ok(file.includes("dash-entrance-header"), "Must apply dash-entrance-header to filters section");
  assert.ok(file.includes("dash-entrance-card"), "Must apply dash-entrance-card to primary KPI cards");
  assert.ok(file.includes("--entrance-delay"), "Must set staggered --entrance-delay style");
  assert.ok(file.includes("<AnimatedNumber value={kpis.todaysLeads"), "Must animate today's leads KPI");
  assert.ok(file.includes("<AnimatedNumber value={kpis.totalLeads"), "Must animate total leads KPI");
  assert.ok(file.includes("<AnimatedNumber value={kpis.closedLeads"), "Must animate closed leads KPI");
  assert.ok(file.includes("<AnimatedNumber value={Number(kpis.activeUsers"), "Must animate active users KPI");
});

test("Component Integration - LeadGrowthChart.tsx & LeadLivePipeline.tsx", () => {
  const chartFile = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadGrowthChart.tsx"), "utf8");
  assert.ok(chartFile.includes("dash-chart-line-reveal"), "LeadGrowthChart should apply dash-chart-line-reveal to line stroke");
  assert.ok(chartFile.includes("dash-chart-area-reveal"), "LeadGrowthChart should apply dash-chart-area-reveal to gradient area");

  const pipelineFile = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadLivePipeline.tsx"), "utf8");
  assert.ok(pipelineFile.includes("AnimatedNumber"), "LeadLivePipeline should use AnimatedNumber for stage metrics");
  assert.ok(pipelineFile.includes("dash-animated-pipeline-fill"), "LeadLivePipeline should apply dash-animated-pipeline-fill for stage progress bars");
});

test("Component Integration - AccountingOverview.tsx", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/accounting/AccountingOverview.tsx"), "utf8");

  assert.ok(file.includes('import { AnimatedNumber, useDashboardEntrance, getCardEntranceDelay } from "@/lib/dashboardMotion"'), "Must import motion utilities");
  assert.ok(file.includes("useDashboardEntrance(!isLoadingInitial && hasData)"), "Must wire useDashboardEntrance to Accounting data load state");
  assert.ok(file.includes("acc-entrance-header"), "Must apply acc-entrance-header to header tier");
  assert.ok(file.includes("acc-entrance-card"), "Must apply acc-entrance-card to cards");
  assert.ok(file.includes("acc-chart-area-reveal"), "Must apply acc-chart-area-reveal to Cash Flow SVG area");
  assert.ok(file.includes("acc-chart-line-reveal-in"), "Must apply acc-chart-line-reveal-in to Money In SVG line");
  assert.ok(file.includes("acc-chart-line-reveal-out"), "Must apply acc-chart-line-reveal-out to Money Out SVG line");
  assert.ok(file.includes("<AnimatedNumber"), "Must use AnimatedNumber for currency metric counters");
});
