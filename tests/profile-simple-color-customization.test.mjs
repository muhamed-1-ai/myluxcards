import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveSimpleProfileTokens,
  isLightColor,
  getContrastRatio,
  ensureReadableTextColor,
  PROFILE_THEME_PRESETS,
} from "../src/lib/themeTokens.ts";
import {
  cleanCardProfile,
  completeCardProfile,
  safePublicCard,
} from "../src/lib/cards.ts";

test("1. Screenshot Palette (#15110C / #FEF08A / #CECBC5): Exact values & high contrast button text", () => {
  const card = {
    profileBackground: "#15110C",
    profileAccent: "#FEF08A",
    profileText: "#CECBC5",
    profileFormat: "simple",
  };

  const tokens = resolveSimpleProfileTokens(card);

  // Background and Card Background match the selected value
  assert.equal(tokens.bg, "#15110C", "Background must match user selection #15110C");
  assert.equal(tokens.cardBg, "#15110C", "Card background must match user selection #15110C");
  assert.equal(tokens.bgIsLight, false, "Dark background must be identified as dark");

  // Accent and Button Fill match
  assert.equal(tokens.accent, "#FEF08A", "Accent must match user selection #FEF08A");
  assert.equal(tokens.primaryBtnBg, "#FEF08A", "Primary button fill must match accent #FEF08A");

  // Primary Text matches
  assert.equal(tokens.textPrimary, "#CECBC5", "Text primary must match user selection #CECBC5");

  // Button Text Contrast: Pale yellow (#FEF08A) requires a dark foreground
  assert.equal(tokens.primaryBtnText, "#0F172A", "Button text must resolve to dark foreground #0F172A on pale yellow");
  const buttonContrast = getContrastRatio(tokens.primaryBtnText, tokens.primaryBtnBg);
  assert.ok(buttonContrast >= 4.5, `Button contrast ratio ${buttonContrast} must be >= 4.5:1 (WCAG AA)`);
  assert.ok(buttonContrast >= 7.0, `Button contrast ratio ${buttonContrast} exceeds 7:1 (WCAG AAA)`);

  // General profile text must NOT be altered just to fix the button
  assert.equal(tokens.textPrimary, "#CECBC5", "General profile text remains #CECBC5, independent of button text");

  // CSS variables output
  assert.equal(tokens.styleObj["--simple-card-bg"], "#15110C");
  assert.equal(tokens.styleObj["--simple-accent"], "#FEF08A");
  assert.equal(tokens.styleObj["--simple-text-primary"], "#CECBC5");
  assert.equal(tokens.styleObj["--simple-primary-btn-bg"], "#FEF08A");
  assert.equal(tokens.styleObj["--simple-primary-btn-text"], "#0F172A");
});

test("2. Contrasting Light Palette (#FFFFFF / #0066FF / #0F172A): Correct resolution & button contrast", () => {
  const card = {
    profileBackground: "#FFFFFF",
    profileAccent: "#0066FF",
    profileText: "#0F172A",
    profileFormat: "simple",
  };

  const tokens = resolveSimpleProfileTokens(card);

  assert.equal(tokens.bg, "#FFFFFF");
  assert.equal(tokens.cardBg, "#FFFFFF");
  assert.equal(tokens.bgIsLight, true);
  assert.equal(tokens.accent, "#0066FF");
  assert.equal(tokens.textPrimary, "#0F172A");

  // On deep blue button, white foreground is chosen
  assert.equal(tokens.primaryBtnText, "#FFFFFF");
  const buttonContrast = getContrastRatio(tokens.primaryBtnText, tokens.primaryBtnBg);
  assert.ok(buttonContrast >= 4.5, `Button contrast ratio ${buttonContrast} must be >= 4.5:1`);

  assert.equal(tokens.styleObj["--simple-card-bg"], "#FFFFFF");
  assert.equal(tokens.styleObj["--simple-text-primary"], "#0F172A");
  assert.equal(tokens.styleObj["--simple-primary-btn-bg"], "#0066FF");
  assert.equal(tokens.styleObj["--simple-primary-btn-text"], "#FFFFFF");
});

test("3. Dedicated button text override & 3-character hex normalization", () => {
  // Test dedicated modernConfig.primaryBtnText override
  const cardWithBtnOverride = {
    profileBackground: "#15110C",
    profileAccent: "#FEF08A",
    profileText: "#CECBC5",
    modernConfig: {
      primaryBtnText: "#003366",
    },
  };
  const tokens = resolveSimpleProfileTokens(cardWithBtnOverride);
  assert.equal(tokens.primaryBtnText, "#003366", "Dedicated button text setting must be honored when provided");

  // Test 3-character hex normalization in cleanCardProfile
  const raw3Hex = {
    profileBackground: "#111",
    profileAccent: "#06f",
    profileText: "#eee",
  };
  const cleaned = cleanCardProfile(raw3Hex);
  assert.equal(cleaned.profileBackground, "#111111");
  assert.equal(cleaned.profileAccent, "#0066ff");
  assert.equal(cleaned.profileText, "#eeeeee");
});

test("4. Persistence & Zero Data Loss Across Design Switching (Modern ↔ Simple)", () => {
  const initial = {
    name: "Muhammed Febin",
    title: "CEO",
    business: "3gzappit",
    about: "Hi bye",
    mobile: "9555555345",
    email: "muhammedfebincholayil@gmail.com",
    website: "https://3gzappit.com",
    profileBackground: "#15110C",
    profileAccent: "#FEF08A",
    profileText: "#CECBC5",
    profileFormat: "simple",
  };

  // 1. Clean and complete for Simple
  const completedSimple = completeCardProfile(initial);
  assert.equal(completedSimple.profileFormat, "simple");
  assert.equal(completedSimple.profileBackground, "#15110C");
  assert.equal(completedSimple.profileAccent, "#FEF08A");
  assert.equal(completedSimple.profileText, "#CECBC5");

  // 2. Switch to Modern
  const switchedToModern = completeCardProfile({
    ...completedSimple,
    profileFormat: "modern",
  });
  assert.equal(switchedToModern.profileFormat, "modern");
  assert.equal(switchedToModern.profileBackground, "#15110C");
  assert.equal(switchedToModern.profileAccent, "#FEF08A");
  assert.equal(switchedToModern.profileText, "#CECBC5");

  // 3. Switch back to Simple
  const switchedBackToSimple = completeCardProfile({
    ...switchedToModern,
    profileFormat: "simple",
  });
  assert.equal(switchedBackToSimple.profileFormat, "simple");
  assert.equal(switchedBackToSimple.profileBackground, "#15110C");
  assert.equal(switchedBackToSimple.profileAccent, "#FEF08A");
  assert.equal(switchedBackToSimple.profileText, "#CECBC5");
  assert.equal(switchedBackToSimple.name, "Muhammed Febin");
  assert.equal(switchedBackToSimple.about, "Hi bye");
});

test("5. Component CSS & Code Integrity: Scope, SVG contrast, headings & bio mapping", () => {
  const css = fs.readFileSync(path.resolve("src/app/simple-profile.css"), "utf8");
  const layout = fs.readFileSync(path.resolve("src/components/card/SimpleProfileLayout.tsx"), "utf8");

  // SimpleProfileLayout must use resolveSimpleProfileTokens
  assert.match(layout, /resolveSimpleProfileTokens/, "SimpleProfileLayout must import and invoke resolveSimpleProfileTokens");
  assert.match(layout, /style=\{tokens\.styleObj\b/, "SimpleProfileLayout must bind tokens.styleObj to wrapper style");

  // Button text & icon must have high contrast rules
  assert.match(css, /\.zappit-simple-btn-primary\s+svg/, "CSS must have rule for primary button icon stroke");
  assert.match(css, /var\(--simple-primary-btn-text\)/, "Primary button icon must inherit var(--simple-primary-btn-text)");

  // Bio and section titles must use var(--simple-text-primary)
  assert.match(css, /\.zappit-simple-bio\s*\{[^}]*color:\s*var\(--simple-text-primary\)/, "Bio must use var(--simple-text-primary)");
  assert.match(css, /\.zappit-simple-section-title\s*\{[^}]*color:\s*var\(--simple-text-primary\)/, "Section headings must use var(--simple-text-primary)");
});

test("6. Facebook-style Cover Photo Layout & Fallback Banner Tokens", () => {
  const cardWithCover = {
    profileBackground: "#15110C",
    profileAccent: "#FEF08A",
    profileText: "#CECBC5",
    cover: "https://example.com/cover.jpg",
    simpleConfig: {
      coverScale: 120,
      coverRotation: 0,
      coverX: 50,
      coverY: 30,
    },
  };

  const tokens = resolveSimpleProfileTokens(cardWithCover);
  assert.ok(tokens.coverFallback, "Must provide a cover fallback token");
  assert.equal(tokens.styleObj["--simple-cover-fallback"], tokens.coverFallback);

  // Fallback token without cover should be a subtle solid color suited to palette
  const cardNoCover = {
    profileBackground: "#15110C",
    profileAccent: "#FEF08A",
    profileText: "#CECBC5",
  };
  const tokensNoCover = resolveSimpleProfileTokens(cardNoCover);
  assert.ok(tokensNoCover.coverFallback, "Must provide solid fallback when no cover");
  assert.notEqual(tokensNoCover.coverFallback, "#0066FF", "Fallback must not use generic blue");

  // Verify CSS contains cover layout and overlapping avatar styles
  const css = fs.readFileSync(path.resolve("src/app/simple-profile.css"), "utf8");
  assert.match(css, /\.zappit-simple-cover-wrap/, "Must define .zappit-simple-cover-wrap");
  assert.match(css, /\.zappit-simple-cover-img/, "Must define .zappit-simple-cover-img");
  assert.match(css, /\.zappit-simple-cover-fallback/, "Must define .zappit-simple-cover-fallback");
  assert.match(css, /\.zappit-simple-body/, "Must define .zappit-simple-body below cover");
  assert.match(css, /\.zappit-simple-photo-wrap\s*\{[^}]*margin-top:\s*-52px/, "Avatar must overlap bottom edge of cover");
  assert.match(css, /\.zappit-simple-photo-ring\s*\{[^}]*border:\s*4px\s+solid\s+var\(--simple-card-bg\)/, "Avatar ring must have solid separation border");
});

test("7. Contrast Protection: Inaudible / unreadable user text automatically adjusted to >= 4.5:1", () => {
  // Case A: User intentionally or accidentally picks unreadable dark text on dark background
  const unreadableDark = {
    profileBackground: "#15110C",
    profileAccent: "#FEF08A",
    profileText: "#181410", // Virtually invisible on #15110C (contrast ~1.05:1)
  };
  const tokensDark = resolveSimpleProfileTokens(unreadableDark);
  assert.equal(tokensDark.textReadabilityAdjusted, true, "Must flag readability adjusted");
  const resolvedContrastDark = getContrastRatio(tokensDark.textPrimary, tokensDark.bg);
  assert.ok(resolvedContrastDark >= 4.5, `Adjusted text contrast ${resolvedContrastDark} must be >= 4.5:1`);

  // Case B: User picks white text on white background
  const unreadableLight = {
    profileBackground: "#FFFFFF",
    profileAccent: "#0066FF",
    profileText: "#FFFFFF", // Invisible on white
  };
  const tokensLight = resolveSimpleProfileTokens(unreadableLight);
  assert.equal(tokensLight.textReadabilityAdjusted, true, "Must flag readability adjusted on light background");
  const resolvedContrastLight = getContrastRatio(tokensLight.textPrimary, tokensLight.bg);
  assert.ok(resolvedContrastLight >= 4.5, `Adjusted text contrast ${resolvedContrastLight} must be >= 4.5:1`);

  // Case C: User picks readable text (#CECBC5 on #15110C) - contrast is ~11.8:1
  const readable = {
    profileBackground: "#15110C",
    profileAccent: "#FEF08A",
    profileText: "#CECBC5",
  };
  const tokensReadable = resolveSimpleProfileTokens(readable);
  assert.equal(tokensReadable.textReadabilityAdjusted, false, "Must not adjust text when user selection is already readable");
  assert.equal(tokensReadable.textPrimary, "#CECBC5", "Must respect user's requested color when readable");
});

test("8. Design-Specific Crop Settings: Simple and Modern have independent crop coordinates", () => {
  const cardProfile = {
    name: "Alex Designer",
    cover: "https://example.com/banner.jpg",
    coverScale: 150,
    coverRotation: 15,
    coverX: 30,
    coverY: 80,
    simpleConfig: {
      coverScale: 110,
      coverRotation: 0,
      coverX: 50,
      coverY: 20,
    },
    profileFormat: "simple",
  };

  const cleaned = cleanCardProfile(cardProfile);
  assert.deepEqual(cleaned.simpleConfig, {
    coverScale: 110,
    coverRotation: 0,
    coverX: 50,
    coverY: 20,
  }, "simpleConfig must be preserved in cleanCardProfile");

  // Modern cover coordinates remain separate and intact
  assert.equal(cleaned.coverScale, 150);
  assert.equal(cleaned.coverRotation, 15);
  assert.equal(cleaned.coverX, 30);
  assert.equal(cleaned.coverY, 80);

  // Complete card profile preserves both
  const completed = completeCardProfile(cleaned);
  assert.equal(completed.simpleConfig.coverY, 20);
  assert.equal(completed.coverY, 80);
});

test("9. Dashboard AppearanceForm Cover Controls Verification", () => {
  const demoCode = fs.readFileSync(path.resolve("src/app/dashboard/DashboardDemo.tsx"), "utf8");

  // Cover Photo label and upload/replace/remove
  assert.match(demoCode, /Cover photo/, "Must label section Cover photo");
  assert.match(demoCode, /Replace cover photo/, "Must provide replace cover photo option");
  assert.match(demoCode, /Remove cover/, "Must provide remove cover option");

  // Quick alignment and touch support
  assert.match(demoCode, /Quick align:/, "Must provide quick alignment options for touch & mobile");
  assert.match(demoCode, /Reset cover crop/, "Must provide reset crop option");

  // SimpleConfig crop binding
  assert.match(demoCode, /draft\.simpleConfig/, "Must read from simpleConfig for Simple profile design");
  assert.match(demoCode, /update\("simpleConfig",/, "Must update simpleConfig when previewing Simple design");

  // Readability explanation note in AppearanceForm
  assert.match(demoCode, /profile-readability-notice/, "Must render readability safeguard notice in editor");
});

