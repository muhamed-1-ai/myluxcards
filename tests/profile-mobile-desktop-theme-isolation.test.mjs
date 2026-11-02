import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveThemeTokens,
  resolveSimpleProfileTokens,
  PROFILE_THEME_PRESETS,
  normalizeProfileThemePreference,
  getContrastRatio,
  isLightColor,
} from "../src/lib/themeTokens.ts";

test("1. Profile theme preferences produce distinct palettes with intended light/dark foundation", () => {
  const baseCard = {
    name: "Sahid Cholayil",
    title: "Founder & Chairman",
    business: "Genius Group global",
    profileBackground: "#0B1914", // Forest Green background
    profileAccent: "#10B981",
    theme: "forest-green",
  };

  // 1. Dashboard Theme follows dashboard profile appearance (dark forest green)
  const dashTokens = resolveThemeTokens({ ...baseCard, profileThemePreference: "dashboard" });
  assert.equal(dashTokens.bgIsLight, false, "Dashboard theme with forest-green must be dark");
  assert.equal(dashTokens.tokens.background.toLowerCase(), "#0b1914");
  assert.equal(dashTokens.tokens.primary.toLowerCase(), "#22c55e");

  // 2. Carbon Platinum must be dark carbon & platinum
  const cpTokens = resolveThemeTokens({ ...baseCard, profileThemePreference: "carbon_platinum" });
  assert.equal(cpTokens.bgIsLight, false, "Carbon Platinum must be dark foundation");
  assert.equal(cpTokens.tokens.background.toLowerCase(), "#101214");
  assert.equal(cpTokens.tokens.primary.toLowerCase(), "#b9c2cc");
  assert.ok(!isLightColor(cpTokens.tokens.background), "Carbon Platinum background must not be light");

  // 3. Black & White must be pure black foundation
  const bwTokens = resolveThemeTokens({ ...baseCard, profileThemePreference: "black_white" });
  assert.equal(bwTokens.bgIsLight, false, "Black & White must be dark foundation");
  assert.equal(bwTokens.tokens.background.toLowerCase(), "#000000");
  assert.equal(bwTokens.tokens.primary.toLowerCase(), "#ffffff");
  assert.ok(!isLightColor(bwTokens.tokens.background), "Black & White background must not be light");

  // 4. White & Black must be pure white foundation
  const wbTokens = resolveThemeTokens({ ...baseCard, profileThemePreference: "white_black" });
  assert.equal(wbTokens.bgIsLight, true, "White & Black must be light foundation");
  assert.equal(wbTokens.tokens.background.toLowerCase(), "#ffffff");
  assert.equal(wbTokens.tokens.primary.toLowerCase(), "#09090b");
  assert.ok(isLightColor(wbTokens.tokens.background), "White & Black background must be light");
});

test("2. Save Contact primary button text has WCAG AA (>= 4.5:1) contrast across all 4 themes (no blank pill)", () => {
  const baseCard = {
    name: "muhammed febin",
    theme: "rose-prestige",
    profileBackground: "#180E14",
    profileAccent: "#F472B6",
  };

  const prefs = ["dashboard", "carbon_platinum", "black_white", "white_black"];

  for (const pref of prefs) {
    const { tokens } = resolveThemeTokens({ ...baseCard, profileThemePreference: pref });
    const ratio = getContrastRatio(tokens.primaryText, tokens.primary);
    assert.ok(
      ratio >= 4.5,
      `[${pref}] Save Contact button text (${tokens.primaryText}) on primary (${tokens.primary}) contrast is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
    );

    // Specific check for Black & White: primary button is #FFFFFF, text must NOT be white!
    if (pref === "black_white") {
      assert.notEqual(
        tokens.primaryText.toLowerCase(),
        "#ffffff",
        "Black & White button text must NOT be white on a white button"
      );
      assert.ok(
        ratio >= 7.0,
        `Black & White button contrast (${ratio.toFixed(2)}:1) should ideally be WCAG AAA (>= 7.0:1)`
      );
    }
  }
});

test("3. Profile Name maintains WCAG AA (>= 4.5:1) contrast across all themes and presets", () => {
  // Test across all 18 curated presets
  for (const preset of PROFILE_THEME_PRESETS) {
    const { tokens } = resolveThemeTokens({
      theme: preset.id,
      profileBackground: preset.background,
      profileAccent: preset.accent,
      profileText: preset.text,
      profileThemePreference: "dashboard",
    });

    const ratio = getContrastRatio(tokens.nameColor, tokens.surface);
    assert.ok(
      ratio >= 4.5,
      `[${preset.name}] Profile name (${tokens.nameColor}) on surface (${tokens.surface}) contrast is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
    );
  }

  // Test with user that had cyan or white explicit name on light presets
  const staleCyanOnLight = resolveThemeTokens({
    theme: "mono-white",
    profileBackground: "#FFFFFF",
    profileAccent: "#000000",
    modernConfig: { nameColor: "#00E5FF" }, // Cyan on white would be unreadable 1.4:1
    profileThemePreference: "dashboard",
  });
  const cyanRatio = getContrastRatio(staleCyanOnLight.tokens.nameColor, staleCyanOnLight.tokens.surface);
  assert.ok(
    cyanRatio >= 4.5,
    `Stale cyan name on light background safely adjusted to readable color: ${staleCyanOnLight.tokens.nameColor} (${cyanRatio.toFixed(2)}:1)`
  );
});

test("4. globals.css is free of rogue !important overrides that break theme isolation", () => {
  const globalsPath = path.resolve(process.cwd(), "src/app/globals.css");
  const globalsCss = fs.readFileSync(globalsPath, "utf-8");

  // 1. .zappit-modern-btn-primary must not have hardcoded color: #FFFFFF !important
  assert.ok(
    !globalsCss.includes(".zappit-modern-btn-primary {\n  flex: 1 1 auto;\n  min-width: 110px;\n  height: 42px;\n  border-radius: 9999px;\n  background: var(--profile-primary, #2563EB) !important;\n  border: none;\n  color: #FFFFFF !important;"),
    ".zappit-modern-btn-primary must NOT have hardcoded color: #FFFFFF !important"
  );
  assert.ok(
    globalsCss.includes("color: var(--profile-primary-text"),
    ".zappit-modern-btn-primary must bind color to var(--profile-primary-text)"
  );

  // 2. globals.css must NOT have [data-theme='light'] .zappit-modern-container { background: #FFFFFF !important; }
  assert.ok(
    !globalsCss.includes('[data-theme="light"] .zappit-modern-container,\nbody.light-mode .zappit-modern-container,\n.light-mode .zappit-modern-container {\n  background: #FFFFFF !important;'),
    "globals.css must NOT forcibly override .zappit-modern-container to #FFFFFF !important in light mode"
  );

  // 3. .pc-page .pts-container must be protected against global light-mode
  assert.ok(
    globalsCss.includes(".pc-page .pts-container"),
    "globals.css must protect .pc-page .pts-container for public card theme isolation"
  );
});

test("5. public-card.css provides page background synchronization and clean nav tokens", () => {
  const publicCssPath = path.resolve(process.cwd(), "src/app/card/[slug]/public-card.css");
  const publicCss = fs.readFileSync(publicCssPath, "utf-8");

  // 1. .pc-page binds to --profile-background
  assert.ok(
    publicCss.includes("background: var(--profile-background, var(--pc-bg, #0a0a0a));"),
    ".pc-page must bind to var(--profile-background)"
  );

  // 2. body:has(.pc-page) synchronizes full-screen overscroll
  assert.ok(
    publicCss.includes("body:has(.pc-page)"),
    "body:has(.pc-page) must synchronize document body background"
  );

  // 3. public-card.css must NOT have [data-theme='light'] .pc-mode-switcher-bar overrides
  assert.ok(
    !publicCss.includes('[data-theme="light"] .pc-mode-switcher-bar'),
    "public-card.css must NOT force .pc-mode-switcher-bar to white in light mode"
  );
});

test("6. ProfileActions and ModernProfileLayout components maintain accessible icons and theme classes", () => {
  const actionsPath = path.resolve(process.cwd(), "src/components/card/ProfileActions.tsx");
  const actionsContent = fs.readFileSync(actionsPath, "utf-8");

  // <UserPlus> icon inside Save Contact uses currentColor / inherit
  assert.ok(
    actionsContent.includes('UserPlus className="w-4 h-4 flex-shrink-0" style={{ color: "inherit", stroke: "currentColor" }}'),
    "ProfileActions must style UserPlus icon with inherit/currentColor"
  );

  const modernLayoutPath = path.resolve(process.cwd(), "src/components/card/ModernProfileLayout.tsx");
  const modernContent = fs.readFileSync(modernLayoutPath, "utf-8");

  // ModernProfileLayout sets themeClass
  assert.ok(
    modernContent.includes("zappit-modern-theme-light") && modernContent.includes("zappit-modern-theme-dark"),
    "ModernProfileLayout must apply theme-aware classes based on tokens.bgIsLight"
  );
});
