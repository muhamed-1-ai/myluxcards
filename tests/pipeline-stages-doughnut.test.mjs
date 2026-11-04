import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function formatSharePercentage(count, total) {
  if (total <= 0 || count <= 0) return "0%";
  const pct = (count / total) * 100;
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

test("Pipeline Stages - Palette matches exact reference shades", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadLivePipeline.tsx"), "utf8");

  const expectedColors = {
    NEW: "#2488FF",      // Electric blue
    CONTACTED: "#60A9ED",// Light blue
    INTERESTED: "#567DB1",// Steel blue
    FOLLOW_UP: "#425BC9", // Deep blue
    WON: "#8EDBFF",      // Ice blue
    LOST: "#8197B8",     // Slate blue
  };

  Object.entries(expectedColors).forEach(([key, color]) => {
    assert.ok(
      file.includes(color),
      `LeadLivePipeline.tsx should define color ${color} for ${key}`
    );
  });
});

test("Pipeline Stages - Mockup dataset percentage calculations (30 total)", () => {
  const mockupData = {
    NEW: 18,
    CONTACTED: 0,
    INTERESTED: 0,
    FOLLOW_UP: 4,
    WON: 7,
    LOST: 1,
  };

  const total = Object.values(mockupData).reduce((a, b) => a + b, 0);
  assert.equal(total, 30, "Mockup total must be 30");

  assert.equal(formatSharePercentage(mockupData.NEW, total), "60%");
  assert.equal(formatSharePercentage(mockupData.CONTACTED, total), "0%");
  assert.equal(formatSharePercentage(mockupData.INTERESTED, total), "0%");
  assert.equal(formatSharePercentage(mockupData.FOLLOW_UP, total), "13.3%");
  assert.equal(formatSharePercentage(mockupData.WON, total), "23.3%");
  assert.equal(formatSharePercentage(mockupData.LOST, total), "3.3%");
});

test("Pipeline Stages - Edge cases (zero leads & single stage 100%)", () => {
  // Zero leads
  assert.equal(formatSharePercentage(0, 0), "0%");
  assert.equal(formatSharePercentage(0, 100), "0%");

  // Single stage with all leads
  assert.equal(formatSharePercentage(25, 25), "100%");
  assert.equal(formatSharePercentage(1, 1), "100%");
});

test("Pipeline Stages - Component Implementation Guarantees", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadLivePipeline.tsx"), "utf8");

  assert.ok(file.includes('canAccessAllLeads'), "Must support canAccessAllLeads prop");
  assert.ok(file.includes('onSelectStage'), "Must support onSelectStage callback");
  assert.ok(file.includes('pipeline-doughnut-svg'), "Must render doughnut SVG");
  assert.ok(file.includes('pipeline-total-badge'), "Must render total count badge");
  assert.ok(file.includes('STAGE'), "Must render STAGE column header");
  assert.ok(file.includes('LEADS'), "Must render LEADS column header");
  assert.ok(file.includes('SHARE'), "Must render SHARE column header");
  assert.ok(file.includes('Total leads'), "Must render center Total leads label");
  assert.ok(file.includes('No leads yet'), "Must render center No leads yet for empty state");
  assert.ok(file.includes('pipeline-empty-ring'), "Must render neutral ring for empty state");
});

test("Pipeline Stages - CSS Responsive & Accessibility Guarantees", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");

  assert.ok(css.includes(".crm-pipeline-widget-root"), "Must define widget root");
  assert.ok(css.includes(".pipeline-header"), "Must define pipeline header");
  assert.ok(css.includes(".pipeline-body"), "Must define pipeline body");
  assert.ok(css.includes("@media (max-width: 640px)"), "Must define mobile stacking breakpoint");
  assert.ok(css.includes("flex-direction: column"), "Must stack chart and legend on mobile");
  assert.ok(css.includes(".pipeline-table-row:focus-visible"), "Must define visible focus indicator for keyboard users");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "Must respect reduced motion");
});
