import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normalizeProfileThemePreference,
  resolveThemeTokens,
  resolveSimpleProfileTokens,
  PROFILE_THEME_PRESETS,
  getContrastRatio,
} from "../src/lib/themeTokens.ts";
import { cleanCardProfile } from "../src/lib/cards.ts";

test("1. normalizeProfileThemePreference handles all valid, legacy, and fallback values", () => {
  assert.equal(normalizeProfileThemePreference("dashboard"), "dashboard");
  assert.equal(normalizeProfileThemePreference("carbon_platinum"), "carbon_platinum");
  assert.equal(normalizeProfileThemePreference("carbon-platinum"), "carbon_platinum");
  assert.equal(normalizeProfileThemePreference("black_white"), "black_white");
  assert.equal(normalizeProfileThemePreference("mono-black"), "black_white");
  assert.equal(normalizeProfileThemePreference("white_black"), "white_black");
  assert.equal(normalizeProfileThemePreference("mono-white"), "white_black");

  // Fallbacks:
  assert.equal(normalizeProfileThemePreference(undefined), "dashboard");
  assert.equal(normalizeProfileThemePreference(null), "dashboard");
  assert.equal(normalizeProfileThemePreference(""), "dashboard");
  assert.equal(normalizeProfileThemePreference("invalid-theme"), "dashboard");
  assert.equal(normalizeProfileThemePreference(123), "dashboard");
});

test("2. cleanCardProfile validates and sanitizes profileThemePreference", () => {
  const cleanedDefault = cleanCardProfile({});
  assert.equal(cleanedDefault.profileThemePreference, "dashboard");

  const cleanedCarbon = cleanCardProfile({ profileThemePreference: "carbon_platinum" });
  assert.equal(cleanedCarbon.profileThemePreference, "carbon_platinum");

  const cleanedMonoBlack = cleanCardProfile({ profileThemePreference: "mono-black" });
  assert.equal(cleanedMonoBlack.profileThemePreference, "black_white");

  const cleanedMonoWhite = cleanCardProfile({ profileThemePreference: "mono-white" });
  assert.equal(cleanedMonoWhite.profileThemePreference, "white_black");

  const cleanedUnknown = cleanCardProfile({ profileThemePreference: "arbitrary-unknown" });
  assert.equal(cleanedUnknown.profileThemePreference, "dashboard");
});

test("3. resolveThemeTokens resolves the exact 4 profile themes with WCAG AA/AAA contrast", () => {
  const baseCard = {
    theme: "midnight-sapphire",
    profileBackground: "#050B14",
    profileAccent: "#0066FF",
    profileText: "#ffffff",
  };

  // 1. Dashboard Theme: dynamic inheritance
  const dashTokens = resolveThemeTokens({
    ...baseCard,
    profileThemePreference: "dashboard",
  });
  assert.equal(dashTokens.tokens.background, "#050B14");
  assert.equal(dashTokens.tokens.accent, "#0066FF");
  assert.ok(getContrastRatio(dashTokens.tokens.text, dashTokens.tokens.surface) >= 4.5);

  // 2. Carbon Platinum: fixed dark carbon and platinum
  const cpTokens = resolveThemeTokens({
    ...baseCard,
    profileThemePreference: "carbon_platinum",
  });
  assert.equal(cpTokens.tokens.background, "#101214");
  assert.equal(cpTokens.tokens.primary, "#B9C2CC");
  assert.equal(cpTokens.tokens.text, "#F5F7FA");
  const cpRatio = getContrastRatio(cpTokens.tokens.text, cpTokens.tokens.surface);
  assert.ok(cpRatio >= 7.0, `Carbon Platinum text contrast ${cpRatio} must be >= 7.0`);
  const cpBtnRatio = getContrastRatio(cpTokens.tokens.primaryText, cpTokens.tokens.primary);
  assert.ok(cpBtnRatio >= 7.0, `Carbon Platinum primary button contrast ${cpBtnRatio} must be >= 7.0`);

  // 3. Black & White: pure black profile
  const bwTokens = resolveThemeTokens({
    ...baseCard,
    profileThemePreference: "black_white",
  });
  assert.equal(bwTokens.tokens.background, "#000000");
  assert.equal(bwTokens.tokens.primary, "#FFFFFF");
  assert.equal(bwTokens.tokens.text, "#FFFFFF");
  const bwRatio = getContrastRatio(bwTokens.tokens.text, bwTokens.tokens.surface);
  assert.ok(bwRatio >= 7.0, `Black & White text contrast ${bwRatio} must be >= 7.0`);
  const bwBtnRatio = getContrastRatio(bwTokens.tokens.primaryText, bwTokens.tokens.primary);
  assert.ok(bwBtnRatio >= 7.0, `Black & White primary button contrast ${bwBtnRatio} must be >= 7.0`);

  // 4. White & Black: pure white profile
  const wbTokens = resolveThemeTokens({
    ...baseCard,
    profileThemePreference: "white_black",
  });
  assert.equal(wbTokens.tokens.background, "#FFFFFF");
  assert.equal(wbTokens.tokens.primary, "#09090B");
  assert.equal(wbTokens.tokens.text, "#09090B");
  const wbRatio = getContrastRatio(wbTokens.tokens.text, wbTokens.tokens.surface);
  assert.ok(wbRatio >= 7.0, `White & Black text contrast ${wbRatio} must be >= 7.0`);
  const wbBtnRatio = getContrastRatio(wbTokens.tokens.primaryText, wbTokens.tokens.primary);
  assert.ok(wbBtnRatio >= 7.0, `White & Black primary button contrast ${wbBtnRatio} must be >= 7.0`);
});

test("4. resolveSimpleProfileTokens handles all 4 themes for Simple Profile", () => {
  const baseCard = {
    theme: "midnight-sapphire",
    profileBackground: "#050B14",
    profileAccent: "#0066FF",
    profileText: "#ffffff",
  };

  const dashSimple = resolveSimpleProfileTokens({ ...baseCard, profileThemePreference: "dashboard" });
  assert.equal(dashSimple.bg, "#050B14");

  const cpSimple = resolveSimpleProfileTokens({ ...baseCard, profileThemePreference: "carbon_platinum" });
  assert.equal(cpSimple.bg, "#101214");
  assert.equal(cpSimple.accent, "#e2e8f0");
  assert.equal(cpSimple.primaryBtnBg, "#B9C2CC");

  const bwSimple = resolveSimpleProfileTokens({ ...baseCard, profileThemePreference: "black_white" });
  assert.equal(bwSimple.bg, "#000000");
  assert.equal(bwSimple.accent, "#FFFFFF");

  const wbSimple = resolveSimpleProfileTokens({ ...baseCard, profileThemePreference: "white_black" });
  assert.equal(wbSimple.bg, "#FFFFFF");
  assert.equal(wbSimple.accent, "#09090B");
});

test("5. ProfileThemeSwitcher component source code structure and criteria verification", () => {
  const switcherSource = fs.readFileSync(path.join(process.cwd(), "src/components/card/ProfileThemeSwitcher.tsx"), "utf8");

  // Exactly 4 options configured
  assert.ok(switcherSource.includes('"dashboard"'), 'Includes "dashboard"');
  assert.ok(switcherSource.includes('"carbon_platinum"'), 'Includes "carbon_platinum"');
  assert.ok(switcherSource.includes('"black_white"'), 'Includes "black_white"');
  assert.ok(switcherSource.includes('"white_black"'), 'Includes "white_black"');
  assert.ok(switcherSource.includes('"Dashboard"'), 'Includes Dashboard option');
  assert.ok(switcherSource.includes("Carbon Platinum"), "Includes Carbon Platinum label");
  assert.ok(switcherSource.includes("Black & White"), "Includes Black & White label");
  assert.ok(switcherSource.includes("White & Black"), "Includes White & Black label");

  // Two-color split swatches
  assert.ok(switcherSource.includes("pts-swatch-split"), "Includes pts-swatch-split");
  assert.ok(switcherSource.includes("pts-swatch-left"), "Includes pts-swatch-left");
  assert.ok(switcherSource.includes("pts-swatch-right"), "Includes pts-swatch-right");
  assert.ok(switcherSource.includes("pts-check-badge"), "Includes checkmark badge");

  // W3C ARIA radio group pattern
  assert.ok(switcherSource.includes('role="radiogroup"'), "Includes radiogroup role");
  assert.ok(switcherSource.includes('role="radio"'), "Includes radio role");
  assert.ok(switcherSource.includes("aria-checked"), "Includes aria-checked attribute");
  assert.ok(switcherSource.includes("handleKeyDown"), "Includes keyboard arrow navigation");
});

test("6. PublicCardClient mounts ProfileThemeSwitcher with owner permission guard", () => {
  const clientSource = fs.readFileSync(path.join(process.cwd(), "src/app/card/[slug]/PublicCardClient.tsx"), "utf8");

  assert.ok(clientSource.includes("<ProfileThemeSwitcher"), "PublicCardClient renders ProfileThemeSwitcher");
  assert.ok(clientSource.includes("canEditTheme"), "Guarded by canEditTheme");
  assert.ok(clientSource.includes("card?.isOwner"), "Checks card.isOwner");
  assert.ok(clientSource.includes("activeView === \"profile\""), "Only renders on Profile view");
  assert.ok(clientSource.includes("handleThemeChange"), "Wires handleThemeChange callback");
});

test("7. /api/cards/public/[slug] route includes PATCH handler with strict owner authorization", () => {
  const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/cards/public/[slug]/route.ts"), "utf8");

  assert.ok(routeSource.includes("export async function PATCH"), "Exports PATCH handler");
  assert.ok(routeSource.includes("currentIdentity"), "Authenticates with currentIdentity");
  assert.ok(routeSource.includes("identity.id === row.owner_id"), "Authorizes only the card owner or super admin");
  assert.ok(routeSource.includes("profileThemePreference"), "Updates profileThemePreference in JSONB");
  assert.ok(routeSource.includes("isOwner"), "GET handler returns isOwner flag");
});

test("8. public-card.css defines compact, touch-friendly, responsive switcher styles", () => {
  const cssSource = fs.readFileSync(path.join(process.cwd(), "src/app/card/[slug]/public-card.css"), "utf8");

  assert.ok(cssSource.includes(".pts-container"), "Defines .pts-container");
  assert.ok(cssSource.includes(".pts-card"), "Defines .pts-card");
  assert.ok(cssSource.includes(".pts-swatch-split"), "Defines .pts-swatch-split");
  assert.ok(cssSource.includes(".pts-check-badge"), "Defines .pts-check-badge");
  assert.ok(cssSource.includes("prefers-reduced-motion"), "Respects reduced-motion preference");
});

test("9. dashboard.css and globals.css define complete .pts-* styles with light mode support", () => {
  const dashCss = fs.readFileSync(path.join(process.cwd(), "src/app/dashboard/dashboard.css"), "utf8");
  const globalsCss = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

  for (const css of [dashCss, globalsCss]) {
    assert.ok(css.includes(".pts-container"), "Includes .pts-container");
    assert.ok(css.includes(".pts-options-grid"), "Includes .pts-options-grid");
    assert.ok(css.includes(".pts-card"), "Includes .pts-card");
    assert.ok(css.includes(".pts-card.selected"), "Includes .pts-card.selected");
    assert.ok(css.includes(".pts-swatch-split"), "Includes .pts-swatch-split");
    assert.ok(css.includes(".pts-check-badge"), "Includes .pts-check-badge");
    assert.ok(css.includes(".pts-card-label"), "Includes .pts-card-label");
    assert.ok(css.includes('[data-theme="light"] .pts-card'), "Includes light mode card style");
  }
});

test("10. State & theme synchronization: Dashboard Theme dynamic inheritance vs manual override (Test A, B, C)", () => {
  // Test A: When preference is 'dashboard', changing presets immediately updates preview tokens
  const rpPreset = PROFILE_THEME_PRESETS.find(p => p.id === "rose-prestige");
  const fgPreset = PROFILE_THEME_PRESETS.find(p => p.id === "forest-green");
  const olPreset = PROFILE_THEME_PRESETS.find(p => p.id === "obsidian-luxe");
  assert.ok(rpPreset && fgPreset && olPreset);

  // 1. User selects Rose Prestige in Dashboard appearance
  const rpTokens = resolveThemeTokens({
    theme: "rose-prestige",
    profileBackground: rpPreset.background,
    profileAccent: rpPreset.accent,
    profileText: rpPreset.text,
    profileThemePreference: "dashboard",
  });
  assert.equal(rpTokens.tokens.background.toLowerCase(), rpPreset.background.toLowerCase());
  assert.equal(rpTokens.tokens.accent.toLowerCase(), rpPreset.accent.toLowerCase());

  // 2. User selects Forest Green in Dashboard appearance
  const fgTokens = resolveThemeTokens({
    theme: "forest-green",
    profileBackground: fgPreset.background,
    profileAccent: fgPreset.accent,
    profileText: fgPreset.text,
    profileThemePreference: "dashboard",
  });
  assert.equal(fgTokens.tokens.background.toLowerCase(), fgPreset.background.toLowerCase());
  assert.equal(fgTokens.tokens.accent.toLowerCase(), fgPreset.accent.toLowerCase());

  // Test B & C: When manual override is selected (e.g. white_black), it remains active even if dashboard appearance changes
  const wbOverrideTokens = resolveThemeTokens({
    theme: "rose-prestige",
    profileBackground: rpPreset.background,
    profileAccent: rpPreset.accent,
    profileText: rpPreset.text,
    profileThemePreference: "white_black",
  });
  assert.equal(wbOverrideTokens.tokens.background, "#FFFFFF");
  assert.equal(wbOverrideTokens.tokens.primary, "#09090B");

  // Changing dashboard appearance to Obsidian Luxe while override is active preserves the override
  const olWithWbOverride = resolveThemeTokens({
    theme: "obsidian-luxe",
    profileBackground: olPreset.background,
    profileAccent: olPreset.accent,
    profileText: olPreset.text,
    profileThemePreference: "white_black",
  });
  assert.equal(olWithWbOverride.tokens.background, "#FFFFFF");
  assert.equal(olWithWbOverride.tokens.primary, "#09090B");

  // Returning to 'dashboard' immediately restores the latest dashboard appearance (Obsidian Luxe)
  const restoredDashTokens = resolveThemeTokens({
    theme: "obsidian-luxe",
    profileBackground: olPreset.background,
    profileAccent: olPreset.accent,
    profileText: olPreset.text,
    profileThemePreference: "dashboard",
  });
  assert.equal(restoredDashTokens.tokens.background.toLowerCase(), olPreset.background.toLowerCase());
  assert.equal(restoredDashTokens.tokens.accent.toLowerCase(), olPreset.accent.toLowerCase());
});
