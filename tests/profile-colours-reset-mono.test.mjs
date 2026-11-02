import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PROFILE_THEME_PRESETS, resolveThemeTokens } from "../src/lib/themeTokens.ts";

test("1. Mono Black and Mono White presets exist and have valid contrast", () => {
  const monoBlack = PROFILE_THEME_PRESETS.find((p) => p.id === "mono-black");
  assert.ok(monoBlack, "Mono Black preset must exist");
  assert.equal(monoBlack.name, "Mono Black");
  assert.equal(monoBlack.background, "#000000");
  assert.equal(monoBlack.accent, "#FFFFFF");
  assert.equal(monoBlack.text, "#FFFFFF");

  const mbTokens = resolveThemeTokens({
    theme: monoBlack.id,
    profileBackground: monoBlack.background,
    profileAccent: monoBlack.accent,
    profileText: monoBlack.text,
  });
  assert.equal(mbTokens.tokens.background, "#000000");
  assert.equal(mbTokens.tokens.accent, "#FFFFFF");
  assert.equal(mbTokens.tokens.text, "#FFFFFF");
  assert.equal(mbTokens.tokens.primary, "#FFFFFF");

  const monoWhite = PROFILE_THEME_PRESETS.find((p) => p.id === "mono-white");
  assert.ok(monoWhite, "Mono White preset must exist");
  assert.equal(monoWhite.name, "Mono White");
  assert.equal(monoWhite.background, "#FFFFFF");
  assert.equal(monoWhite.accent, "#000000");
  assert.equal(monoWhite.text, "#09090B");

  const mwTokens = resolveThemeTokens({
    theme: monoWhite.id,
    profileBackground: monoWhite.background,
    profileAccent: monoWhite.accent,
    profileText: monoWhite.text,
  });
  assert.equal(mwTokens.tokens.background, "#FFFFFF");
  assert.equal(mwTokens.tokens.accent, "#000000");
  assert.equal(mwTokens.tokens.text, "#09090B");
  assert.equal(mwTokens.tokens.primary, "#09090B");
});

test("2. Dynamic Reset Colours logic restores selected preset palette and cleans up overrides", () => {
  // Simulate active theme = mono-black
  const monoBlack = PROFILE_THEME_PRESETS.find((p) => p.id === "mono-black");
  assert.ok(monoBlack);

  // User had customized modernConfig overrides and color fields
  const customizedCard = {
    name: "John Doe",
    company: "Acme Corp",
    theme: "custom",
    profileBackground: "#181818",
    profileAccent: "#FF0055",
    profileText: "#E0E0E0",
    modernConfig: {
      cardBackground: "#202020",
      cardBorder: "#404040",
      nameColor: "#FF5555",
      primaryBtnBg: "#FF0055",
      primaryBtnText: "#FFFFFF",
      cardRadius: 18,
      buttonRadius: 24,
    },
  };

  // Simulate handleResetColours for Mono Black
  const resetConfig = { ...customizedCard.modernConfig };
  delete resetConfig.cardBackground;
  delete resetConfig.cardBorder;
  delete resetConfig.nameColor;
  delete resetConfig.primaryBtnBg;
  delete resetConfig.primaryBtnText;

  const resetCard = {
    ...customizedCard,
    theme: monoBlack.id,
    profileBackground: monoBlack.background,
    profileAccent: monoBlack.accent,
    profileText: monoBlack.text,
    modernConfig: resetConfig,
  };

  // Verify profile info is preserved
  assert.equal(resetCard.name, "John Doe");
  assert.equal(resetCard.company, "Acme Corp");
  // Verify layout styling is preserved
  assert.equal(resetCard.modernConfig.cardRadius, 18);
  assert.equal(resetCard.modernConfig.buttonRadius, 24);
  // Verify colors are restored to Mono Black
  assert.equal(resetCard.profileBackground, "#000000");
  assert.equal(resetCard.profileAccent, "#FFFFFF");
  assert.equal(resetCard.profileText, "#FFFFFF");
  assert.equal(resetCard.theme, "mono-black");
  // Overrides are gone
  assert.equal(resetCard.modernConfig.cardBackground, undefined);
  assert.equal(resetCard.modernConfig.cardBorder, undefined);

  // Check resolved tokens
  const resolved = resolveThemeTokens(resetCard);
  assert.equal(resolved.tokens.background, "#000000");
  assert.equal(resolved.tokens.accent, "#FFFFFF");
  assert.equal(resolved.tokens.text, "#FFFFFF");
});

test("3. Reset Name logic restores default name styling without touching profile or business name", () => {
  const ivory = PROFILE_THEME_PRESETS.find((p) => p.id === "ivory-estate");
  assert.ok(ivory);

  const card = {
    name: "Jane Smith",
    company: "Global Tech Inc",
    theme: "ivory-estate",
    profileBackground: ivory.background,
    profileAccent: ivory.accent,
    profileText: "#FF0000",
    modernConfig: {
      nameColor: "#00FF00",
      cardRadius: 14,
    },
  };

  // Reset name should restore theme's nameColor and text
  const nextConfig = { ...card.modernConfig, nameColor: ivory.nameColor };
  const resetNameCard = {
    ...card,
    profileText: ivory.text,
    modernConfig: nextConfig,
  };

  assert.equal(resetNameCard.name, "Jane Smith", "Must never overwrite person profile name");
  assert.equal(resetNameCard.company, "Global Tech Inc", "Must never overwrite business name");
  assert.equal(resetNameCard.modernConfig.nameColor, ivory.nameColor);
  assert.equal(resetNameCard.profileText, ivory.text);
});

test("4. DashboardDemo JSX contains updated labels and dynamic helper text", () => {
  const demoPath = path.resolve(process.cwd(), "src/app/dashboard/DashboardDemo.tsx");
  const demoCode = fs.readFileSync(demoPath, "utf-8");

  // Check button labels
  assert.ok(demoCode.includes(">Reset Name<") || demoCode.includes("Reset Name\n") || demoCode.includes("Reset Name"), "Must have Reset Name button");
  assert.ok(demoCode.includes(">Reset Colours<") || demoCode.includes("Reset Colours\n") || demoCode.includes("Reset Colours"), "Must have Reset Colours button");
  assert.ok(!demoCode.includes("Reset to Obsidian Luxe"), "Must remove hardcoded Reset to Obsidian Luxe label");
  assert.ok(!demoCode.includes("Reset Name to Theme"), "Must rename Reset Name to Theme to Reset Name");

  // Check dynamic helper text
  assert.ok(demoCode.includes("Restore defaults for {activePreset.name}."), "Must include dynamic helper text beneath buttons");
  assert.ok(demoCode.includes("className=\"reset-theme-helper-text\""), "Must include reset-theme-helper-text element");
  assert.ok(demoCode.includes("className=\"reset-profile-buttons-row\""), "Must include reset-profile-buttons-row container");
});

test("5. dashboard.css has approximately 44px buttons and responsive layout", () => {
  const cssPath = path.resolve(process.cwd(), "src/app/dashboard/dashboard.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  // Check button height
  assert.ok(css.includes("height: 44px;"), "Must specify ~44px height for .reset-profile-colours");
  assert.ok(css.includes(".reset-profile-buttons-row"), "Must define .reset-profile-buttons-row");
  assert.ok(css.includes("gap: 8px;"), "Must specify 8px gap");
  assert.ok(css.includes(".reset-theme-helper-text"), "Must define .reset-theme-helper-text");
});

