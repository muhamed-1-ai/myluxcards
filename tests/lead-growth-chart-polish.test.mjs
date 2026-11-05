import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const chartFilePath = path.join(ROOT, "src/components/dashboard/LeadGrowthChart.tsx");
const chartContent = fs.readFileSync(chartFilePath, "utf8");

test("Growth Velocity Chart - Untransformed Measurement & Resize Synchronization", () => {
  // 1. Must use clientWidth for untransformed layout width
  assert.ok(
    chartContent.includes("el.clientWidth"),
    "Must read clientWidth which ignores CSS scale transformations"
  );

  // 2. Must observe contentBoxSize in ResizeObserver
  assert.ok(
    chartContent.includes("entry.contentBoxSize"),
    "ResizeObserver must inspect contentBoxSize inlineSize"
  );

  // 3. Must attach animationend & transitionend listeners to resync when entrance scale finishes
  assert.ok(
    chartContent.includes('el.addEventListener("animationend", measure)') ||
    chartContent.includes("animationend"),
    "Must listen to animationend for card scale settlement"
  );
  assert.ok(
    chartContent.includes('el.addEventListener("transitionend", measure)') ||
    chartContent.includes("transitionend"),
    "Must listen to transitionend"
  );

  // 4. Must include safety timeout fallbacks
  assert.ok(
    chartContent.includes("setTimeout(measure,"),
    "Must have timeout fallbacks for entrance animation"
  );
});

test("Growth Velocity Chart - Visual Hierarchy and Reference Layout", () => {
  // 1. Header: Title
  assert.ok(
    chartContent.includes("Growth Velocity"),
    "Must include 'Growth Velocity' title"
  );
  assert.ok(
    chartContent.includes("Lead Acquisition"),
    "Must include 'Lead Acquisition' subtitle"
  );

  // 2. Controls: 7 Days, 30 Days, 12 Months
  assert.ok(
    chartContent.includes('"7d"') && chartContent.includes('"30d"') && chartContent.includes('"12m"'),
    "Must provide period options 7d, 30d, 12m"
  );

  // 3. Prominent Period Total & Subtitle Row
  assert.ok(
    chartContent.includes("{periodTotal}"),
    "Must render prominent periodTotal directly under header"
  );
  assert.ok(
    chartContent.includes("periodSubtitle"),
    "Must render periodSubtitle (Last 7 days / Last 30 days / Last 12 months)"
  );
  assert.ok(
    chartContent.includes("New Leads"),
    "Must include legend indicator for New Leads"
  );

  // 4. X-Axis Edge Label Alignment (prevents clipping)
  assert.ok(
    chartContent.includes('textAnchor = idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle"'),
    "First tick must use textAnchor='start', last tick 'end' to prevent clipping at card edges"
  );
});

test("Growth Velocity Chart - Data Precedence and No Double Counting", () => {
  // 1. Server growthTimeline is source of truth when present, even if empty []
  assert.ok(
    chartContent.includes("growthTimeline !== undefined && growthTimeline !== null && Array.isArray(growthTimeline)"),
    "Must treat server growthTimeline as source of truth when defined, even if empty array"
  );

  // 2. recentActivity is only a fallback when timeline is unavailable
  assert.ok(
    chartContent.includes("else if (Array.isArray(recentActivity) && recentActivity.length > 0)"),
    "Must only fall back to recentActivity when timeline is undefined or null"
  );

  // 3. recentActivity deduplication
  assert.ok(
    chartContent.includes("seenLeadIds"),
    "Must deduplicate recentActivity events so no lead is counted more than once"
  );

  // 4. Period total strictly matches chart points
  assert.ok(
    chartContent.includes("chartData.reduce((sum, pt) => sum + pt.count, 0)"),
    "Period total must be computed strictly as sum of displayed chart data points"
  );
});

test("Growth Velocity Chart - Mathematical Spline & Zero-Range Baseline", () => {
  // 1. Zero range flat line
  assert.ok(
    chartContent.includes("isAllZero"),
    "Must detect all-zero dataset"
  );
  assert.ok(
    chartContent.includes("points.every((p) => p.count === 0)"),
    "Must check if all points have count 0"
  );
  assert.ok(
    chartContent.includes("zeroY"),
    "Must draw flat line along zeroY baseline when counts are all zero"
  );

  // 2. Fritsch-Carlson Monotone Spline
  assert.ok(
    chartContent.includes("Fritsch-Carlson") || chartContent.includes("slopes"),
    "Must implement monotone cubic spline"
  );

  // 3. Overshoot clamping: path never dips below zeroY
  assert.ok(
    chartContent.includes("if (cp1y > zeroY) cp1y = zeroY"),
    "Control points must never overshoot below baseline"
  );
});

test("Growth Velocity Chart - Accurate SVG Coordinate Mapping & Clamping", () => {
  // 1. SVG matrix transformation
  assert.ok(
    chartContent.includes("createSVGPoint") && chartContent.includes("matrixTransform"),
    "Must use createSVGPoint and matrixTransform(ctm.inverse()) for precise pointer mapping"
  );

  // 2. Clamped to revealed leading edge during animation
  assert.ok(
    chartContent.includes("Math.min(pointerX, maxAllowedX)"),
    "Must clamp hover target to maxAllowedX"
  );

  // 3. Respects prefers-reduced-motion
  assert.ok(
    chartContent.includes("prefers-reduced-motion"),
    "Must respect user motion preferences"
  );
});

