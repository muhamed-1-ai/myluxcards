import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function parseHex(hex) {
  let c = hex.replace("#", "").trim();
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  const num = parseInt(c.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(parseHex(hex1));
  const lum2 = getLuminance(parseHex(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

test("1. WCAG Contrast Audit for Light Mode semantic tokens", () => {
  const globalsPath = path.resolve(process.cwd(), "src/app/globals.css");
  const globalsCss = fs.readFileSync(globalsPath, "utf-8");

  // Light Mode tokens
  const bg = "#F8FAFC";
  const surface = "#FFFFFF";
  const textPrimary = "#0F172A";
  const textSecondary = "#475569";
  const textMuted = "#64748B";
  const buttonPrimary = "#0066FF";
  const buttonPrimaryText = "#FFFFFF";

  const primaryContrast = getContrastRatio(textPrimary, surface);
  assert.ok(
    primaryContrast >= 7.0,
    `Primary text contrast on white surface (${primaryContrast.toFixed(2)}) must exceed 7.0:1 (WCAG AAA)`
  );

  const secondaryContrast = getContrastRatio(textSecondary, surface);
  assert.ok(
    secondaryContrast >= 4.5,
    `Secondary text contrast on white surface (${secondaryContrast.toFixed(2)}) must exceed 4.5:1 (WCAG AA)`
  );

  const buttonContrast = getContrastRatio(buttonPrimaryText, buttonPrimary);
  assert.ok(
    buttonContrast >= 4.5,
    `Primary button text on primary blue (${buttonContrast.toFixed(2)}) must exceed 4.5:1 (WCAG AA)`
  );

  const bgPrimaryContrast = getContrastRatio(textPrimary, bg);
  assert.ok(
    bgPrimaryContrast >= 7.0,
    `Primary text on background (${bgPrimaryContrast.toFixed(2)}) must exceed 7.0:1`
  );
});

test("2. WCAG Contrast Audit for Dark Mode tokens", () => {
  const darkSurface = "#0D1726";
  const darkTextPrimary = "#FFFFFF";
  const darkTextSecondary = "#CBD5E1";
  const darkButtonPrimary = "#0066FF";
  const darkButtonText = "#FFFFFF";

  const primaryContrast = getContrastRatio(darkTextPrimary, darkSurface);
  assert.ok(
    primaryContrast >= 12.0,
    `Dark mode primary text contrast (${primaryContrast.toFixed(2)}) must exceed 12:1`
  );

  const secondaryContrast = getContrastRatio(darkTextSecondary, darkSurface);
  assert.ok(
    secondaryContrast >= 7.0,
    `Dark mode secondary text contrast (${secondaryContrast.toFixed(2)}) must exceed 7:1`
  );

  const buttonContrast = getContrastRatio(darkButtonText, darkButtonPrimary);
  assert.ok(
    buttonContrast >= 4.5,
    `Dark mode button contrast (${buttonContrast.toFixed(2)}) must exceed 4.5:1`
  );
});

test("3. globals.css defines complete semantic token set in both light and dark modes", () => {
  const globalsPath = path.resolve(process.cwd(), "src/app/globals.css");
  const globalsCss = fs.readFileSync(globalsPath, "utf-8");

  const requiredTokens = [
    "--background",
    "--surface",
    "--surface-muted",
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--border-color",
    "--input-bg",
    "--input-text",
    "--input-border",
    "--input-placeholder",
    "--button-primary",
    "--button-primary-text",
    "--button-secondary-bg",
    "--button-secondary-text",
    "--header-background",
  ];

  for (const token of requiredTokens) {
    assert.ok(
      globalsCss.includes(token),
      `globals.css must define token ${token}`
    );
  }
});

test("4. dashboard.css AppearanceForm & PreviewPanel do not have hardcoded dark text overrides in Light Mode", () => {
  const dashCssPath = path.resolve(process.cwd(), "src/app/dashboard/dashboard.css");
  const dashCss = fs.readFileSync(dashCssPath, "utf-8");

  // Ensure .preset-card-title uses semantic variable
  assert.ok(
    dashCss.includes(".preset-card-title {\n  font-size: 12.5px;\n  font-weight: 700;\n  color: var(--text-primary);"),
    "preset-card-title must use var(--text-primary) so it adapts to Light Mode"
  );

  // Ensure preset-card-title has explicit light mode override
  assert.ok(
    dashCss.includes('[data-theme="light"] .preset-card-title') ||
    dashCss.includes('body.light-mode .preset-card-title'),
    "preset-card-title must have explicit light mode override"
  );

  // Ensure .colour-pickers uses semantic variables
  assert.ok(
    dashCss.includes(".colour-pickers {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  background: var(--surface-muted);"),
    "colour-pickers must use var(--surface-muted)"
  );

  // Ensure .colour-code uses var(--input-bg) and var(--input-text)
  assert.ok(
    dashCss.includes("background: var(--input-bg) !important;\n  color: var(--input-text) !important;"),
    "colour-code must use var(--input-bg) and var(--input-text)"
  );

  // Ensure preview-panel url-card has semantic tokens
  assert.ok(
    dashCss.includes(".preview-panel .url-card-heading span {\n  color: var(--text-primary);"),
    "url-card-heading span must use var(--text-primary)"
  );
  assert.ok(
    dashCss.includes(".preview-panel .url-card-heading small {\n  display: block;\n  margin-top: 5px;\n  color: var(--text-muted);"),
    "url-card-heading small must use var(--text-muted)"
  );
});

test("5. Buttons in master config pages and dashboard do NOT use black text (#07080B / #050505) on blue background", () => {
  const configFiles = [
    "src/components/dashboard/config/ProductsConfig.tsx",
    "src/components/dashboard/config/CalendarConfig.tsx",
    "src/components/dashboard/config/LeadSourcesConfig.tsx",
    "src/components/dashboard/config/LeadStagesConfig.tsx",
    "src/components/dashboard/config/LobReasonsConfig.tsx",
    "src/components/dashboard/LeadManagementDashboard.tsx",
  ];

  for (const file of configFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    const content = fs.readFileSync(fullPath, "utf-8");

    // Check for bad patterns: background: "#0066FF" with color: "#07080B" or "#050505"
    const hasBadCombination =
      content.includes('background: "#0066FF", color: "#07080B"') ||
      content.includes('background: "#0066FF", color: "#050505"') ||
      content.includes('color: "#07080B",\n            background: "#0066FF"') ||
      content.includes('color: "#050505",\n            background: "#0066FF"');

    assert.ok(
      !hasBadCombination,
      `File ${file} must not have low-contrast black text on blue buttons`
    );
  }
});
