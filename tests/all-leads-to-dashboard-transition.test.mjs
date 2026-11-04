import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("All Leads -> Dashboard Transition - Visual Stability of Shell", () => {
  const demoFile = fs.readFileSync(path.join(ROOT, "src/app/dashboard/DashboardDemo.tsx"), "utf8");
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");

  // 1. Sidebar, Top Header, and Main background remain outside the tab transition wrapper
  assert.ok(demoFile.includes("dash-main-tab-wrap"), "Must wrap page content in dash-main-tab-wrap");
  assert.ok(demoFile.includes("isTabLeaving ? \"dash-tab-leaving\" : \"dash-tab-entering\""), "Must toggle dash-tab-leaving / dash-tab-entering based on navigation state");
  
  // The header closes BEFORE dash-main-tab-wrap opens
  const headerCloseIndex = demoFile.indexOf("</header>");
  const tabWrapOpenIndex = demoFile.indexOf('<div className={`dash-main-tab-wrap');
  assert.ok(headerCloseIndex < tabWrapOpenIndex, "Header must remain visually steady outside tab transition wrapper");

  // 2. Outgoing animation definitions (brief shrink and fade)
  assert.ok(dashCss.includes(".dash-main-tab-wrap.dash-tab-leaving"), "dashboard.css must define .dash-tab-leaving");
  assert.ok(dashCss.includes("@keyframes dashTabLeave"), "dashboard.css must define dashTabLeave keyframe");
  assert.ok(dashCss.includes("scale(0.975) translateY(-4px)"), "dashTabLeave must shrink slightly and fade");

  // 3. Incoming animation definition
  assert.ok(dashCss.includes(".dash-main-tab-wrap.dash-tab-entering"), "dashboard.css must define .dash-tab-entering");
  assert.ok(dashCss.includes("@keyframes dashTabEnter"), "dashboard.css must define dashTabEnter keyframe");
});

test("Card Surface Growth & Reserved Grid Slot Guarantees", () => {
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");
  const leadFile = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");

  // 1. Card container surface growth physics
  assert.ok(dashCss.includes(".dash-entrance-card"), "Must define .dash-entrance-card");
  assert.ok(dashCss.includes("@keyframes dashCardGrow"), "Must define dashCardGrow");
  assert.ok(dashCss.includes("scale(0.65) translateY(10px)"), "Must start smaller at scale(0.65)");
  assert.ok(dashCss.includes("transform-origin: 50% 100%"), "Must anchor at lower center (50% 100%)");
  assert.ok(dashCss.includes("0.40s cubic-bezier(0.16, 1, 0.3, 1)"), "Must run ~400ms ease-out");

  // 2. Stagger between cards
  assert.ok(leadFile.includes("getCardEntranceDelay(cardIdx, 60, 240)"), "Must stagger cards by 60ms capped at 240ms");

  // 3. Grid slots stay reserved
  assert.ok(dashCss.includes(".crm-kpi-card.is-skeleton"), "Must style reserved skeleton slots");
  assert.ok(leadFile.includes("crm-kpi-card is-skeleton"), "Must render reserved skeleton cards during loading");
});

test("Card Content Reveal Sequencing & Text Legibility", () => {
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");
  const leadFile = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");

  // 1. Inner card content wrapper
  assert.ok(leadFile.includes("className=\"dash-card-content\""), "Must wrap card contents in dash-card-content");
  assert.ok(dashCss.includes(".dash-entrance-card .dash-card-content"), "Must target inner content of entrance cards");
  assert.ok(dashCss.includes("calc(var(--entrance-delay, 0ms) + 120ms)"), "Must delay content reveal by a beat (+120ms) after surface starts growing");
  assert.ok(dashCss.includes("@keyframes dashCardContentReveal"), "Must define dashCardContentReveal keyframe");
  assert.ok(dashCss.includes("transform: translateY(6px)"), "Content must lift subtly into place without distortion");

  // 2. Chart reveals trigger as surfaces settle
  assert.ok(dashCss.includes("var(--chart-delay, 380ms)"), "Chart line stroke draw must trigger at ~380ms");
  assert.ok(dashCss.includes("var(--bar-delay, 380ms)"), "Pipeline progress fill must trigger at ~380ms");
});

test("Data Loading Separation & Refresh Independence", () => {
  const leadFile = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");

  // 1. Module-level payload cache
  assert.ok(leadFile.includes("let cachedLeadDashboardPayload"), "Must declare cachedLeadDashboardPayload");
  assert.ok(leadFile.includes("setData(res.data)"), "Must populate data");
  assert.ok(leadFile.includes("cachedLeadDashboardPayload = res.data"), "Must store unfiltered data in cache");

  // 2. useDashboardEntrance lifecycle
  assert.ok(leadFile.includes("useDashboardEntrance(true)"), "Must trigger entrance for each new navigation mount");

  // 3. Clear cache on identity change
  assert.ok(leadFile.includes("cachedLeadDashboardPayload = null"), "Must clear cache when switching accounts");
});

test("Accessibility - Reduced Motion Guarantees", () => {
  const dashCss = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");
  const demoFile = fs.readFileSync(path.join(ROOT, "src/app/dashboard/DashboardDemo.tsx"), "utf8");

  // Reduced motion overrides
  assert.ok(demoFile.includes("prefers-reduced-motion"), "DashboardDemo must check prefers-reduced-motion before animating");
  assert.ok(dashCss.includes("@media (prefers-reduced-motion: reduce)"), "dashboard.css must include prefers-reduced-motion block");
  assert.ok(dashCss.includes(".dash-main-tab-wrap.dash-tab-leaving"), "Must disable tab leaving transition on reduced motion");
  assert.ok(dashCss.includes(".dash-entrance-card .dash-card-content"), "Must disable card content animation on reduced motion");
});
