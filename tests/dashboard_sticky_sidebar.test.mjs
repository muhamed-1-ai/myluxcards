import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Persistent Dashboard Sidebar and Layout Verification", async (t) => {
  const cssPath = path.resolve("src/app/dashboard/dashboard.css");
  const globalsPath = path.resolve("src/app/globals.css");
  const tsxPath = path.resolve("src/app/dashboard/DashboardDemo.tsx");

  const css = fs.readFileSync(cssPath, "utf-8");
  const globals = fs.readFileSync(globalsPath, "utf-8");
  const tsx = fs.readFileSync(tsxPath, "utf-8");

  await t.test("1. Ancestor overflow: html and body maintain visible vertical overflow when dash-shell is present", () => {
    assert.match(globals, /html:has\(\.dash-shell\),\s*body:has\(\.dash-shell\)\s*\{[\s\S]*?overflow:\s*visible\s*!important/);
    assert.match(globals, /html:has\(\.dash-shell\),\s*body:has\(\.dash-shell\)\s*\{[\s\S]*?overflow-y:\s*visible\s*!important/);
    assert.match(globals, /html:has\(\.dash-shell\),\s*body:has\(\.dash-shell\)\s*\{[\s\S]*?height:\s*auto\s*!important/);
  });

  await t.test("2. Shell configuration: .dash-shell enforces flex layout, aligns to top, and avoids clipping overflow", () => {
    assert.match(css, /\.dash-shell\s*\{[^}]*display:\s*flex\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*align-items:\s*flex-start\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*overflow:\s*visible\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*overflow-x:\s*visible\s*!important/);
    assert.match(css, /\.dash-shell\s*\{[^}]*overflow-y:\s*visible\s*!important/);
  });

  await t.test("3. Desktop sidebar: .dash-side uses position: sticky, 16px top offset, and 256px width", () => {
    assert.match(css, /\.dash-side\s*\{[^}]*position:\s*sticky\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*top:\s*16px\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*align-self:\s*flex-start\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*width:\s*256px\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*flex-shrink:\s*0\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*height:\s*calc\(100vh\s*-\s*32px\)\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*height:\s*calc\(100dvh\s*-\s*32px\)\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*margin:\s*16px 0 16px 16px\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*z-index:\s*40\s*!important/);
    assert.match(css, /\.dash-side\s*\{[^}]*overflow:\s*hidden\s*!important/);
  });

  await t.test("4. Independent menu scrolling: .side-nav-scroll enforces min-height: 0, flex: 1 1 auto, and overflow-y: auto", () => {
    assert.match(css, /\.side-nav-scroll\s*\{[^}]*flex:\s*1 1 auto\s*!important/);
    assert.match(css, /\.side-nav-scroll\s*\{[^}]*min-height:\s*0\s*!important/);
    assert.match(css, /\.side-nav-scroll\s*\{[^}]*overflow-y:\s*auto\s*!important/);
    assert.match(css, /\.side-nav-scroll\s*\{[^}]*overflow-x:\s*hidden\s*!important/);
    assert.match(css, /\.side-nav-scroll\s*\{[^}]*overscroll-behavior:\s*contain\s*!important/);
    assert.match(css, /\.side-nav-scroll\s*\{[^}]*scrollbar-width:\s*thin\s*!important/);
  });

  await t.test("5. Sidebar header and footer boundaries: .side-logo-wrap and .side-footer-badge never collapse", () => {
    assert.match(css, /\.side-logo-wrap\s*\{[^}]*flex-shrink:\s*0\s*!important/);
    assert.match(css, /\.side-footer-badge\s*\{[^}]*flex-shrink:\s*0\s*!important/);
    assert.match(css, /\.side-footer-badge\s*\{[^}]*margin-top:\s*auto\s*!important/);
  });

  await t.test("6. Legacy conflict elimination: early css rules do not define conflicting position: fixed or 244px width", () => {
    // Lines before 6800 must not declare position: fixed on .dash-side
    const earlyCss = css.slice(0, css.indexOf("/* ==================================================\n   SAASLU-INSPIRED FLOATING INSET SIDEBAR & SHELL"));
    assert.doesNotMatch(earlyCss, /\.dash-side\s*\{[^}]*position:\s*fixed/);
    assert.doesNotMatch(earlyCss, /\.dash-side\s*\{[^}]*width:\s*244px/);
  });

  await t.test("7. Mobile overlay preservation: @media (max-width: 1024px) retains fixed off-canvas drawer", () => {
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-side\s*\{[\s\S]*?position:\s*fixed\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-side\s*\{[\s\S]*?left:\s*-320px\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-side\s*\{[\s\S]*?margin:\s*0\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-side\.open\s*\{[\s\S]*?left:\s*0\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.dash-side\.open\s*\{[\s\S]*?transform:\s*translateX\(0\)\s*!important/);
    assert.match(css, /@media\s*\(max-width:\s*1024px\)[\s\S]*?\.side-scrim\s*\{[\s\S]*?z-index:\s*95\s*!important/);
  });

  await t.test("8. Markup structure: DashboardDemo has logo, nav scroll, and footer badge in aside.dash-side", () => {
    assert.match(tsx, /<aside\s+className=\{`dash-side\s+\$\{sidebar\s*\?\s*"open"\s*:\s*""\}`\}>/);
    assert.match(tsx, /<div className="side-logo-wrap">/);
    assert.match(tsx, /<nav className="side-nav-scroll scrollbar-thin">/);
    assert.match(tsx, /<div className="side-footer-badge">/);
    assert.match(tsx, /<main className="dash-main main-content">/);
  });
});
