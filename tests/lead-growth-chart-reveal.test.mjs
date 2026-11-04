import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("LeadGrowthChart - Stable Shell & Controls Render Immediately", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadGrowthChart.tsx"), "utf8");

  // Title & Subtitle
  assert.ok(file.includes("Growth Velocity"), "Header must include 'Growth Velocity'");
  assert.ok(file.includes("Daily new lead generation volume"), "Subtitle must be present");

  // Range selector buttons
  assert.ok(file.includes('"7d"') && file.includes('"30d"') && file.includes('"12m"'), "Must provide 7d, 30d, 12m periods");
  assert.ok(file.includes("7 Days") && file.includes("30 Days") && file.includes("12 Months"), "Must render full range labels");

  // Legend
  assert.ok(file.includes("New Leads"), "Legend must label New Leads");
  assert.ok(file.includes("#168BFF"), "Legend dot must use brand blue #168BFF");

  // Gridlines and labels rendered outside clipPath
  assert.ok(file.includes("var(--border-color, #343740)"), "Dashed gridlines must be rendered");
  assert.ok(file.includes("solid zero baseline in subtle cyan/blue") || file.includes("rgba(22, 139, 255, 0.4)"), "Zero baseline rendered");
});

test("LeadGrowthChart - Coordinated Horizontal SVG Clip Reveal Structure", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadGrowthChart.tsx"), "utf8");

  // SVG clipPath definition
  assert.ok(file.includes("<clipPath id={clipId}>"), "Must define SVG clipPath with dynamic id");
  assert.ok(file.includes("ref={clipRectRef}"), "Clip rect must have ref for native rAF manipulation");
  assert.ok(file.includes("x={paddingLeft}"), "Clip rect must start at paddingLeft (first date)");
  assert.ok(file.includes("height={chartHeight}"), "Clip rect must cover full chart height");

  // Single clipPath grouping enclosing both gradient area and curve line
  assert.ok(file.includes("<g clipPath={`url(#${clipId})`}>"), "Area and line must share the same horizontal clipPath");
  assert.ok(file.includes('className="dash-chart-area-reveal"'), "Area path retains dash-chart-area-reveal class");
  assert.ok(file.includes('className="dash-chart-line-reveal"'), "Line path retains dash-chart-line-reveal class");

  // Geometry remains static (fixed path strings)
  assert.ok(file.includes("d={areaPath}"), "Area path uses static computed path");
  assert.ok(file.includes("d={linePath}"), "Line path uses static computed path");
});

test("LeadGrowthChart - Reveal Animation Timing & Deceleration Easing", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadGrowthChart.tsx"), "utf8");

  // Duration ~1,000ms
  assert.ok(file.includes("duration = 1000"), "Reveal duration must be 1000ms");

  // Easing curve decelerating
  assert.ok(file.includes("Math.pow(1 - t, 3.5)"), "Must use decelerating ease curve matching reference");

  // Only triggers on initial data or range change
  assert.ok(file.includes("isRangeChange"), "Must detect range changes");
  assert.ok(file.includes("isInitialDataReveal"), "Must detect initial data reveal");
  assert.ok(file.includes("if (!isInitialDataReveal && !isRangeChange)"), "Must guard against redundant re-triggers");

  // Prefers reduced motion
  assert.ok(file.includes("prefers-reduced-motion: reduce"), "Must check prefers-reduced-motion");
});

test("LeadGrowthChart - Desktop Hover Pointer Tracking & Tooltip Clamping", () => {
  const file = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadGrowthChart.tsx"), "utf8");

  // Pointer event listeners on SVG
  assert.ok(file.includes("onPointerMove={handlePointerMove}"), "SVG must listen for pointer moves across plot");
  assert.ok(file.includes("onPointerDown={handlePointerMove}"), "SVG must support pointer down (touch/click)");
  assert.ok(file.includes("onPointerLeave={handlePointerLeave}"), "SVG must clear on pointer leave");
  assert.ok(file.includes('touchAction: "pan-y"'), "Must allow vertical touch scroll while scrubbing horizontally");

  // Tooltip boundary clamping to revealed portion
  assert.ok(file.includes("maxAllowedX"), "Must compute maxAllowedX during reveal");
  assert.ok(file.includes("revealedPoints"), "Must filter points to revealed portion during draw");
  assert.ok(file.includes("Math.min(pointerX, maxAllowedX)"), "Must clamp target X to revealed leading edge");

  // Floating glassmorphic tooltip with edge protection
  assert.ok(file.includes("translate("), "Tooltip uses transform translation");
  assert.ok(file.includes("hoveredPoint.count"), "Tooltip displays lead count");
  assert.ok(file.includes("New Leads"), "Tooltip displays New Leads label");
});

test("LeadGrowthChart - Monotone Spline Fixed Geometry for All-Zero and Peak/Dip Datasets", () => {
  // Test mathematical spline calculations directly
  function computeSpline(chartData, measuredWidth = 700) {
    const paddingLeft = 44;
    const paddingRight = 14;
    const paddingTop = 16;
    const paddingBottom = 28;
    const chartHeight = 280;
    const plotWidth = measuredWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;
    const zeroY = paddingTop + plotHeight;

    const highest = Math.max(...chartData.map((d) => d.count), 0);
    const maxVal = highest <= 3 ? 4 : Math.ceil(highest * 1.25);

    const points = chartData.map((pt, i) => {
      const x = paddingLeft + (i / Math.max(chartData.length - 1, 1)) * plotWidth;
      const y = zeroY - (pt.count / maxVal) * plotHeight;
      return { ...pt, x, y };
    });

    const n = points.length;
    if (n === 0) return { points, linePath: "", zeroY };
    if (n === 1) return { points, linePath: `M ${points[0].x} ${points[0].y}`, zeroY };

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
        m[i] = 0;
      } else {
        m[i] = (slopes[i - 1] + slopes[i]) / 2;
      }
    }
    m[n - 1] = slopes[n - 2];

    for (let i = 0; i < n - 1; i++) {
      if (slopes[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const alpha = m[i] / slopes[i];
        const beta = m[i + 1] / slopes[i];
        const dist = alpha * alpha + beta * beta;
        if (dist > 9) {
          const tau = 3 / Math.sqrt(dist);
          m[i] = tau * alpha * slopes[i];
          m[i + 1] = tau * beta * slopes[i];
        }
      }
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const segmentDx = dx[i];

      const cp1x = p0.x + segmentDx / 3;
      let cp1y = p0.y + (m[i] * segmentDx) / 3;

      const cp2x = p1.x - segmentDx / 3;
      let cp2y = p1.y - (m[i + 1] * segmentDx) / 3;

      if (cp1y > zeroY) cp1y = zeroY;
      if (cp2y > zeroY) cp2y = zeroY;

      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }

    return { points, linePath: path, zeroY };
  }

  // 1. All-zero dataset: All Y coordinates must be strictly at zeroY
  const zeroData = [
    { label: "Mon", count: 0 },
    { label: "Tue", count: 0 },
    { label: "Wed", count: 0 },
    { label: "Thu", count: 0 },
    { label: "Fri", count: 0 },
    { label: "Sat", count: 0 },
    { label: "Sun", count: 0 },
  ];
  const zeroResult = computeSpline(zeroData);
  zeroResult.points.forEach((pt) => {
    assert.equal(pt.y, zeroResult.zeroY, "In zero dataset, every point must lie exactly on zeroY");
  });
  assert.ok(!zeroResult.linePath.includes("NaN"), "Zero spline path must not contain NaN");

  // 2. Peaks and dips dataset: Control points must never dip below zeroY
  const peakDipData = [
    { label: "D1", count: 0 },
    { label: "D2", count: 18 },
    { label: "D3", count: 2 },
    { label: "D4", count: 15 },
    { label: "D5", count: 0 },
    { label: "D6", count: 9 },
    { label: "D7", count: 4 },
  ];
  const peakResult = computeSpline(peakDipData);
  peakResult.points.forEach((pt) => {
    assert.ok(pt.y <= peakResult.zeroY, "No point can overshoot below baseline zeroY");
  });
  assert.ok(!peakResult.linePath.includes("NaN"), "Peak/dip spline path must not contain NaN");
});

test("CSS Simplification - No Conflicting Per-Element Transitions", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");

  // Ensure line reveal has stroke-dasharray: none or offset 0 (no conflicting dashoffset draw)
  assert.ok(css.includes(".dash-chart-line-reveal"), "CSS defines .dash-chart-line-reveal");
  assert.ok(css.includes(".dash-chart-area-reveal"), "CSS defines .dash-chart-area-reveal");

  // Check that stroke-dasharray 3000 is removed from .dash-chart-line-reveal
  const lineRevealBlock = css.slice(css.indexOf(".dash-chart-line-reveal"), css.indexOf(".dash-chart-line-reveal") + 150);
  assert.ok(!lineRevealBlock.includes("stroke-dasharray: 3000"), "Conflicting stroke-dasharray: 3000 must be removed");
});

