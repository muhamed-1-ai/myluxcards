import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_THEME_PRESETS,
  resolveThemeTokens,
  resolveSimpleProfileTokens,
  getContrastRatio,
} from "../src/lib/themeTokens.ts";

test("PROFILE THEME NAME 1: Contrast verification against light backgrounds and surfaces", () => {
  const arctic = PROFILE_THEME_PRESETS.find((p) => p.id === "arctic-pearl");
  assert.ok(arctic, "arctic-pearl preset must exist");
  assert.equal(arctic.nameColor, "#245B80");

  const arcticBgRatio = getContrastRatio(arctic.nameColor, arctic.background);
  const arcticSurfaceRatio = getContrastRatio(arctic.nameColor, arctic.surface || "#FFFFFF");
  assert.ok(
    arcticBgRatio >= 4.5,
    `Arctic Pearl name color contrast on background (${arcticBgRatio.toFixed(2)}:1) must be >= 4.5:1`
  );
  assert.ok(
    arcticSurfaceRatio >= 4.5,
    `Arctic Pearl name color contrast on surface (${arcticSurfaceRatio.toFixed(2)}:1) must be >= 4.5:1`
  );

  const ivory = PROFILE_THEME_PRESETS.find((p) => p.id === "ivory-estate");
  assert.ok(ivory, "ivory-estate preset must exist");
  assert.equal(ivory.nameColor, "#604622");

  const ivoryBgRatio = getContrastRatio(ivory.nameColor, ivory.background);
  const ivorySurfaceRatio = getContrastRatio(ivory.nameColor, ivory.surface || "#FFFFFF");
  assert.ok(
    ivoryBgRatio >= 4.5,
    `Ivory Estate name color contrast on background (${ivoryBgRatio.toFixed(2)}:1) must be >= 4.5:1`
  );
  assert.ok(
    ivorySurfaceRatio >= 4.5,
    `Ivory Estate name color contrast on surface (${ivorySurfaceRatio.toFixed(2)}:1) must be >= 4.5:1`
  );
});

test("PROFILE THEME NAME 2: Stale #ffffff default on Arctic Pearl safely resolves to readable blue #245B80", () => {
  // Existing cards in DB often have profileText="#ffffff" from dark theme initialization
  const cardWithStaleWhite = {
    theme: "arctic-pearl",
    profileBackground: "#EEF3F7",
    profileAccent: "#0284c7",
    profileText: "#ffffff",
  };

  const { tokens, cssVars } = resolveThemeTokens(cardWithStaleWhite);

  assert.equal(tokens.nameColor, "#245B80");
  assert.equal(cssVars["--profile-name-color"], "#245B80");
  assert.equal(cssVars["--mod-name-color"], "#245B80");
  assert.equal(cssVars["--pc-name-color"], "#245B80");
  // Body text must also not remain unreadable white on white
  assert.notEqual(tokens.text.toLowerCase(), "#ffffff");
  assert.ok(getContrastRatio(tokens.text, tokens.surface) >= 4.5);
});

test("PROFILE THEME NAME 3: Stale #ffffff default on Ivory Estate safely resolves to deep warm brown #604622", () => {
  const cardWithStaleWhite = {
    theme: "ivory-estate",
    profileBackground: "#F5F0E7",
    profileAccent: "#d97706",
    profileText: "#ffffff",
  };

  const { tokens, cssVars } = resolveThemeTokens(cardWithStaleWhite);

  assert.equal(tokens.nameColor, "#604622");
  assert.equal(cssVars["--profile-name-color"], "#604622");
  assert.equal(cssVars["--mod-name-color"], "#604622");
  assert.equal(cssVars["--pc-name-color"], "#604622");
  assert.notEqual(tokens.text.toLowerCase(), "#ffffff");
  assert.ok(getContrastRatio(tokens.text, tokens.surface) >= 4.5);
});

test("PROFILE THEME NAME 4: Switching between Arctic Pearl and Ivory Estate updates default name color immediately", () => {
  const arcticDraft = {
    theme: "arctic-pearl",
    profileBackground: "#EEF3F7",
    profileAccent: "#0284c7",
    profileText: "#101820",
  };
  const arcticResult = resolveThemeTokens(arcticDraft);
  assert.equal(arcticResult.tokens.nameColor, "#245B80");

  const ivoryDraft = {
    theme: "ivory-estate",
    profileBackground: "#F5F0E7",
    profileAccent: "#d97706",
    profileText: "#17130E",
  };
  const ivoryResult = resolveThemeTokens(ivoryDraft);
  assert.equal(ivoryResult.tokens.nameColor, "#604622");
});

test("PROFILE THEME NAME 5: Explicit intentional user-customized name color is preserved", () => {
  const customColorCard = {
    theme: "arctic-pearl",
    profileBackground: "#EEF3F7",
    profileAccent: "#0284c7",
    profileText: "#101820",
    modernConfig: {
      nameColor: "#7c3aed", // Explicit custom purple
    },
  };
  const { tokens, cssVars } = resolveThemeTokens(customColorCard);
  assert.equal(tokens.nameColor, "#7c3aed");
  assert.equal(cssVars["--profile-name-color"], "#7c3aed");
});

test("PROFILE THEME NAME 6: Other dark themes remain unaffected", () => {
  const obsidianCard = {
    theme: "obsidian-luxe",
    profileBackground: "#0B0D12",
    profileAccent: "#D4AF62",
    profileText: "#F7F3EA",
  };
  const { tokens } = resolveThemeTokens(obsidianCard);
  assert.equal(tokens.nameColor, "#F7F3EA");
  assert.equal(tokens.text, "#F7F3EA");

  const forestCard = {
    theme: "forest-green",
    profileBackground: "#07150f",
    profileAccent: "#84cc16",
    profileText: "#ffffff",
  };
  const forestResult = resolveThemeTokens(forestCard);
  assert.equal(forestResult.tokens.nameColor, "#ffffff");
});

test("PROFILE THEME NAME 7: SimpleProfileLayout tokens also resolve theme name colors", () => {
  const arcticSimple = resolveSimpleProfileTokens({
    theme: "arctic-pearl",
    profileBackground: "#EEF3F7",
    profileAccent: "#0284c7",
  });
  assert.equal(arcticSimple.nameColor, "#245B80");
  assert.equal(arcticSimple.styleObj["--simple-name-color"], "#245B80");

  const ivorySimple = resolveSimpleProfileTokens({
    theme: "ivory-estate",
    profileBackground: "#F5F0E7",
    profileAccent: "#d97706",
  });
  assert.equal(ivorySimple.nameColor, "#604622");
  assert.equal(ivorySimple.styleObj["--simple-name-color"], "#604622");
});
