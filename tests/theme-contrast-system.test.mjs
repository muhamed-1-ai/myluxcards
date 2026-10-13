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

test("6. WCAG AA Contrast Audit across all 16 Profile Theme Presets", async () => {
  const { PROFILE_THEME_PRESETS, resolveThemeTokens } = await import("../src/lib/themeTokens.ts");

  assert.equal(PROFILE_THEME_PRESETS.length, 16, "Must audit all 16 profile presets");

  for (const preset of PROFILE_THEME_PRESETS) {
    const { tokens, cssVars } = resolveThemeTokens({
      theme: preset.id,
      profileBackground: preset.background,
      profileAccent: preset.accent,
      profileText: preset.text,
    });

    // 1. Navigation Unselected Tab Contrast >= 4.5:1
    const navUnselectedRatio = getContrastRatio(tokens.navText, tokens.navBg);
    assert.ok(
      navUnselectedRatio >= 4.5,
      `[${preset.name}] Nav unselected text (${tokens.navText}) on navBg (${tokens.navBg}) contrast is ${navUnselectedRatio.toFixed(2)}:1 (must be >= 4.5:1)`
    );

    // 2. Navigation Selected Tab Contrast >= 4.5:1
    const navSelectedRatio = getContrastRatio(tokens.navSelectedText, tokens.primary);
    assert.ok(
      navSelectedRatio >= 4.5,
      `[${preset.name}] Nav selected text (${tokens.navSelectedText}) on primary (${tokens.primary}) contrast is ${navSelectedRatio.toFixed(2)}:1 (must be >= 4.5:1)`
    );

    // 3. Profile Card Body Text Contrast >= 4.5:1
    const cardTextRatio = getContrastRatio(tokens.text, tokens.surface);
    assert.ok(
      cardTextRatio >= 4.5,
      `[${preset.name}] Card body text (${tokens.text}) on surface (${tokens.surface}) contrast is ${cardTextRatio.toFixed(2)}:1 (must be >= 4.5:1)`
    );

    // 4. Primary Button Text Contrast >= 4.5:1
    const primaryBtnRatio = getContrastRatio(tokens.primaryText, tokens.primary);
    assert.ok(
      primaryBtnRatio >= 4.5,
      `[${preset.name}] Primary button text (${tokens.primaryText}) on primary (${tokens.primary}) contrast is ${primaryBtnRatio.toFixed(2)}:1 (must be >= 4.5:1)`
    );

    // 5. Edit Button Text Contrast >= 4.5:1
    const editBtnRatio = getContrastRatio(tokens.editBtnText, tokens.surface);
    assert.ok(
      editBtnRatio >= 4.5,
      `[${preset.name}] Edit button text (${tokens.editBtnText}) on surface (${tokens.surface}) contrast is ${editBtnRatio.toFixed(2)}:1 (must be >= 4.5:1)`
    );

    // 6. Muted Text Contrast >= 4.5:1
    const mutedRatio = getContrastRatio(tokens.mutedText, tokens.surface);
    assert.ok(
      mutedRatio >= 4.5,
      `[${preset.name}] Muted text (${tokens.mutedText}) on surface (${tokens.surface}) contrast is ${mutedRatio.toFixed(2)}:1 (must be >= 4.5:1)`
    );

    // 7. Verify CSS variables exist
    assert.ok(cssVars["--pc-nav-bg"], `[${preset.name}] must export --pc-nav-bg`);
    assert.ok(cssVars["--pc-nav-text"], `[${preset.name}] must export --pc-nav-text`);
    assert.ok(cssVars["--pc-nav-selected-bg"], `[${preset.name}] must export --pc-nav-selected-bg`);
    assert.ok(cssVars["--pc-nav-selected-text"], `[${preset.name}] must export --pc-nav-selected-text`);
  }
});

test("7. Public Card CSS decouples navigation text from card body text and eliminates hardcoded #00E5FF", () => {
  const publicCssPath = path.resolve(process.cwd(), "src/app/card/[slug]/public-card.css");
  const publicCss = fs.readFileSync(publicCssPath, "utf-8");

  // Ensure .pc-mode-switch-btn uses --pc-nav-text and not var(--pc-text)
  const modeBtnMatch = publicCss.match(/\.pc-mode-switch-btn\s*\{([^}]+)\}/);
  assert.ok(modeBtnMatch, ".pc-mode-switch-btn rule must exist");
  assert.ok(
    !modeBtnMatch[1].includes("var(--pc-text"),
    ".pc-mode-switch-btn must NOT mix with var(--pc-text)"
  );

  // Ensure .pc-mode-switch-btn.active uses --pc-nav-selected-text
  assert.ok(
    publicCss.includes("color: var(--pc-nav-selected-text,"),
    ".pc-mode-switch-btn.active must use var(--pc-nav-selected-text)"
  );

  // Ensure .zappit-profile-edit-btn does NOT hardcode color: #00E5FF
  assert.ok(
    !publicCss.includes("color: #00E5FF;"),
    ".zappit-profile-edit-btn must not hardcode color: #00E5FF"
  );

  // Ensure .pc-action-btn:hover does not mix black text over arbitrary accents
  assert.ok(
    !publicCss.includes("color: color-mix(in srgb, var(--pc-bg, #0a0a0a) 20%, #000);"),
    ".pc-action-btn:hover must not mix black text over accents"
  );
});
