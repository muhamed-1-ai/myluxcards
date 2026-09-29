import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Dashboard header responsive layout verification", async (t) => {
  const cssPath = path.resolve("src/app/dashboard/dashboard.css");
  const tsxPath = path.resolve("src/app/dashboard/DashboardDemo.tsx");

  const css = fs.readFileSync(cssPath, "utf-8");
  const tsx = fs.readFileSync(tsxPath, "utf-8");

  await t.test("1. DashboardDemo.tsx markup includes main-content and theme-btn-icon/label", () => {
    assert.match(tsx, /className="dash-main main-content"/);
    assert.match(tsx, /className="theme-btn-icon"/);
    assert.match(tsx, /className="theme-btn-label"/);
  });

  await t.test("2. .dash-shell enforces width, max-width, box-sizing and overflow-x containment", () => {
    assert.match(css, /\.dash-shell\s*\{[^}]*width:\s*100%\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*max-width:\s*100%\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*box-sizing:\s*border-box\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*overflow-x:\s*clip\s*!important/);
  });

  await t.test("3. .main-content and .dash-main enforce min-width: 0 and flex: 1 bounds", () => {
    assert.match(css, /\.main-content\s*\{[^}]*min-width:\s*0\s*!important/);
    assert.match(css, /\.dash-main,\s*\.main-content\s*\{[^}]*flex:\s*1\s*1\s*0%\s*!important/);
    assert.match(css, /\.dash-main,\s*\.main-content\s*\{[^}]*min-width:\s*0\s*!important/);
    assert.match(css, /\.dash-main,\s*\.main-content\s*\{[^}]*max-width:\s*calc\(100%\s*-\s*288px\)\s*!important/);
  });

  await t.test("4. .dash-main-header enforces width: 100%, max-width: 100% and overflow: visible", () => {
    assert.match(css, /\.dash-main-header\s*\{[^}]*width:\s*100%\s*!important/);
    assert.match(css, /\.dash-main-header\s*\{[^}]*max-width:\s*100%\s*!important/);
    assert.match(css, /\.dash-main-header\s*\{[^}]*overflow:\s*visible\s*!important/);
  });

  await t.test("5. Left section and breadcrumbs handle truncation safely", () => {
    assert.match(css, /\.dash-header-left\s*\{[^}]*min-width:\s*0\s*!important/);
    assert.match(css, /\.dash-breadcrumbs\s*\{[^}]*overflow:\s*hidden\s*!important/);
    assert.match(css, /\.crumb-target\s*\{[^}]*text-overflow:\s*ellipsis\s*!important/);
  });

  await t.test("6. .dash-header-right prevents shrinking and secures controls inside viewport", () => {
    assert.match(css, /\.dash-header-right\s*\{[^}]*flex-shrink:\s*0\s*!important/);
    assert.match(css, /\.dash-header-right\s*\{[^}]*margin-left:\s*auto\s*!important/);
    assert.match(css, /\.dash-header-right\s*\{[^}]*gap:\s*12px\s*!important/);
  });

  await t.test("7. Responsive breakpoints for 1024px, 768px, and 640px adapt correctly", () => {
    // 1024px
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-main,\s*\.main-content\s*\{[\s\S]*?margin-left:\s*0\s*!important/);
    // 768px
    assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.theme-btn-label\s*\{[\s\S]*?display:\s*none\s*!important/);
    // 640px
    assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*?\.dash-header-right\s*\{[\s\S]*?flex-shrink:\s*0\s*!important/);
  });
});
