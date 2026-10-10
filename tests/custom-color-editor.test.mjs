import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeTokens, PROFILE_THEME_PRESETS } from "../src/lib/themeTokens.ts";
import { cleanCardProfile, completeCardProfile } from "../src/lib/cards.ts";

test("1. All 16 preset themes exist and resolve valid tokens", () => {
  const expectedPresets = [
    "forest-green",
    "emerald-sovereign",
    "midnight-sapphire",
    "obsidian-luxe",
    "royal-noir",
    "ocean-meridian",
    "champagne-noir",
    "rose-prestige",
    "copper-atelier",
    "arctic-pearl",
    "ivory-estate",
    "carbon-platinum",
    "deep-garnet",
    "forest-reserve",
    "cobalt-signature",
    "sandstone-elite",
  ];

  assert.equal(PROFILE_THEME_PRESETS.length, 16, "Must contain all 16 presets");

  for (const presetId of expectedPresets) {
    const preset = PROFILE_THEME_PRESETS.find((p) => p.id === presetId);
    assert.ok(preset, `Preset ${presetId} must exist`);
    assert.match(preset.background, /^#[0-9a-f]{6}$/i);
    assert.match(preset.accent, /^#[0-9a-f]{6}$/i);
    assert.match(preset.text, /^#[0-9a-f]{6}$/i);

    const resolved = resolveThemeTokens({
      theme: preset.id,
      profileBackground: preset.background,
      profileAccent: preset.accent,
      profileText: preset.text,
    });

    assert.equal(resolved.tokens.background.toLowerCase(), preset.background.toLowerCase());
    assert.equal(resolved.tokens.accent.toLowerCase(), preset.accent.toLowerCase());
    assert.equal(resolved.tokens.text.toLowerCase(), preset.text.toLowerCase());
    assert.ok(resolved.tokens.primary, "Primary token must exist");
    assert.ok(resolved.tokens.surface, "Surface token must exist");
  }
});

test("2. Selecting a preset initializes custom colors, but custom colors override the preset", () => {
  // Select Midnight Sapphire
  const midnight = PROFILE_THEME_PRESETS.find((p) => p.id === "midnight-sapphire");
  assert.ok(midnight);

  const initialCard = {
    theme: midnight.id,
    profileBackground: midnight.background,
    profileAccent: midnight.accent,
    profileText: midnight.text,
  };

  const initialTokens = resolveThemeTokens(initialCard);
  assert.equal(initialTokens.tokens.background, midnight.background);
  assert.equal(initialTokens.tokens.accent, midnight.accent);
  assert.equal(initialTokens.tokens.text, midnight.text);

  // User customizes background to pure black #000000 while accent and text remain unchanged
  const customizedBgCard = {
    ...initialCard,
    theme: "custom",
    profileBackground: "#000000",
  };

  const customizedBgTokens = resolveThemeTokens(customizedBgCard);
  assert.equal(customizedBgTokens.tokens.background, "#000000", "Custom background must be #000000");
  assert.equal(customizedBgTokens.tokens.accent, midnight.accent, "Accent must remain unchanged");
  assert.equal(customizedBgTokens.tokens.text, midnight.text, "Text must remain unchanged");
  assert.equal(customizedBgTokens.cssVars["--profile-background"], "#000000");

  // User customizes accent to cyan #00FFFF
  const customizedAccentCard = {
    ...customizedBgCard,
    profileAccent: "#00FFFF",
  };

  const customizedAccentTokens = resolveThemeTokens(customizedAccentCard);
  assert.equal(customizedAccentTokens.tokens.background, "#000000");
  assert.equal(customizedAccentTokens.tokens.accent, "#00FFFF", "Custom accent must be #00FFFF");
  assert.equal(customizedAccentTokens.tokens.primary, "#00FFFF", "Primary token must update to custom accent #00FFFF");
  assert.equal(customizedAccentTokens.cssVars["--profile-accent"], "#00FFFF");
  assert.equal(customizedAccentTokens.cssVars["--profile-primary"], "#00FFFF");
  assert.equal(customizedAccentTokens.cssVars["--pc-accent"], "#00FFFF");
  assert.equal(customizedAccentTokens.cssVars["--mod-accent"], "#00FFFF");
});

test("3. Section 28 Acceptance Test: Full flow with independent color adjustments", () => {
  // Test starting state:
  // BACKGROUND: #101010
  // ACCENT: #00FFFF
  // TEXT: #FFFFFF
  const card = {
    theme: "custom",
    profileBackground: "#101010",
    profileAccent: "#00FFFF",
    profileText: "#FFFFFF",
  };

  const tokens1 = resolveThemeTokens(card);
  assert.equal(tokens1.tokens.background, "#101010");
  assert.equal(tokens1.tokens.accent, "#00FFFF");
  assert.equal(tokens1.tokens.text, "#FFFFFF");
  assert.equal(tokens1.tokens.primary, "#00FFFF");
  assert.equal(tokens1.cssVars["--profile-background"], "#101010");
  assert.equal(tokens1.cssVars["--profile-accent"], "#00FFFF");
  assert.equal(tokens1.cssVars["--profile-text"], "#FFFFFF");

  // Then change ONLY Background -> #FF0000
  const cardRedBg = { ...card, profileBackground: "#FF0000" };
  const tokens2 = resolveThemeTokens(cardRedBg);
  assert.equal(tokens2.tokens.background, "#FF0000", "Background must become #FF0000");
  assert.equal(tokens2.tokens.accent, "#00FFFF", "Accent must remain #00FFFF");
  assert.equal(tokens2.tokens.text, "#FFFFFF", "Text must remain #FFFFFF");

  // Then change ONLY Accent -> #00FF00
  const cardGreenAccent = { ...cardRedBg, profileAccent: "#00FF00" };
  const tokens3 = resolveThemeTokens(cardGreenAccent);
  assert.equal(tokens3.tokens.background, "#FF0000", "Background must remain #FF0000");
  assert.equal(tokens3.tokens.accent, "#00FF00", "Accent must become #00FF00");
  assert.equal(tokens3.tokens.primary, "#00FF00", "Primary must become #00FF00");
  assert.equal(tokens3.tokens.text, "#FFFFFF", "Text must remain #FFFFFF");

  // Then change ONLY Text -> #000000
  const cardBlackText = { ...cardGreenAccent, profileText: "#000000" };
  const tokens4 = resolveThemeTokens(cardBlackText);
  assert.equal(tokens4.tokens.background, "#FF0000", "Background must remain #FF0000");
  assert.equal(tokens4.tokens.accent, "#00FF00", "Accent must remain #00FF00");
  assert.equal(tokens4.tokens.text, "#000000", "Text must become #000000");
});

test("4. Reset to Obsidian Luxe works end-to-end", () => {
  const obsidian = PROFILE_THEME_PRESETS.find((p) => p.id === "obsidian-luxe");
  assert.ok(obsidian);

  const resetCard = {
    theme: "obsidian-luxe",
    profileBackground: obsidian.background,
    profileAccent: obsidian.accent,
    profileText: obsidian.text,
  };

  const tokens = resolveThemeTokens(resetCard);
  assert.equal(tokens.tokens.background, "#0B0D12");
  assert.equal(tokens.tokens.accent, "#D4AF62");
  assert.equal(tokens.tokens.text, "#F7F3EA");
  assert.equal(tokens.tokens.primary, "#D4AF62");
  assert.equal(tokens.cssVars["--profile-background"], "#0B0D12");
  assert.equal(tokens.cssVars["--profile-accent"], "#D4AF62");
  assert.equal(tokens.cssVars["--profile-text"], "#F7F3EA");
});

test("5. Database normalization preserves custom colors and Obsidian Luxe colors upon save and reload", () => {
  // Test saving custom colors
  const customSavePayload = {
    name: "Test User",
    slug: "test-user",
    theme: "custom",
    profileBackground: "#101010",
    profileAccent: "#00FFFF",
    profileText: "#FFFFFF",
  };

  const cleaned = cleanCardProfile(customSavePayload);
  assert.equal(cleaned.profileBackground, "#101010");
  assert.equal(cleaned.profileAccent, "#00FFFF");
  assert.equal(cleaned.profileText, "#FFFFFF");
  assert.equal(cleaned.theme, "custom");

  const completed = completeCardProfile(cleaned);
  assert.equal(completed.profileBackground, "#101010");
  assert.equal(completed.profileAccent, "#00FFFF");
  assert.equal(completed.profileText, "#FFFFFF");

  // Test saving Obsidian Luxe colors (must NOT be overwritten with legacy default #050B14/#0066FF)
  const obsidianSavePayload = {
    name: "Obsidian User",
    slug: "obsidian-user",
    theme: "obsidian-luxe",
    profileBackground: "#0B0D12",
    profileAccent: "#D4AF62",
    profileText: "#F7F3EA",
  };

  const cleanedObsidian = cleanCardProfile(obsidianSavePayload);
  assert.equal(cleanedObsidian.profileBackground, "#0B0D12");
  assert.equal(cleanedObsidian.profileAccent, "#D4AF62");
  assert.equal(cleanedObsidian.profileText, "#F7F3EA");

  const completedObsidian = completeCardProfile(cleanedObsidian);
  assert.equal(completedObsidian.profileBackground, "#0B0D12", "Obsidian Luxe background must not be overwritten");
  assert.equal(completedObsidian.profileAccent, "#D4AF62", "Obsidian Luxe accent must not be overwritten");
  assert.equal(completedObsidian.profileText, "#F7F3EA");
});
