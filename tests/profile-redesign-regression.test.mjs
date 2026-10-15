import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("1. Typography: Clean sans-serif font family enforced across profile name, headings, and details", () => {
  const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf-8");
  const modernProfileTsx = fs.readFileSync(
    path.join(rootDir, "src/components/card/ModernProfileLayout.tsx"),
    "utf-8"
  );

  // Verify .zappit-modern-wrapper enforces Inter / sans-serif
  assert.match(
    globalsCss,
    /\.zappit-modern-wrapper\s*\{[\s\S]*?font-family:\s*var\(--mod-font-family,\s*'Inter',[^}]*sans-serif\);/,
    ".zappit-modern-wrapper must enforce sans-serif font-family"
  );

  // Verify .zappit-modern-name explicitly overrides serif Instrument Serif leak
  assert.match(
    globalsCss,
    /\.zappit-modern-name\s*\{[\s\S]*?font-family:\s*var\(--mod-font-family,\s*'Inter',[^}]*sans-serif\)\s*!important;/,
    ".zappit-modern-name must explicitly override serif with sans-serif font-family"
  );

  // Verify name is rendered as h1 with .zappit-modern-name
  assert.match(
    modernProfileTsx,
    /<h1 className="zappit-modern-name">\{name\}<\/h1>/,
    "ModernProfileLayout must render owner name inside h1.zappit-modern-name"
  );
});

test("2. Layout Preservation: Original positions, avatar, buttons, contact boxes, and services preserved", () => {
  const modernProfileTsx = fs.readFileSync(
    path.join(rootDir, "src/components/card/ModernProfileLayout.tsx"),
    "utf-8"
  );
  const profileActionsTsx = fs.readFileSync(
    path.join(rootDir, "src/components/card/ProfileActions.tsx"),
    "utf-8"
  );
  const publicCardClientTsx = fs.readFileSync(
    path.join(rootDir, "src/app/card/[slug]/PublicCardClient.tsx"),
    "utf-8"
  );

  // Mode switcher preserves original labels and emoji icons
  assert.match(
    publicCardClientTsx,
    /🚗 Vehicle/,
    "Mode switcher must preserve '🚗 Vehicle'"
  );
  assert.match(
    publicCardClientTsx,
    /🏷️ Lost &amp; Found/,
    "Mode switcher must preserve '🏷️ Lost & Found'"
  );

  // Action buttons preserve 3-button row with original labels
  assert.match(
    profileActionsTsx,
    /<span>Save Contact<\/span>/,
    "Action buttons must preserve 'Save Contact'"
  );
  assert.match(
    profileActionsTsx,
    /<span>Share Your Contacts<\/span>/,
    "Action buttons must preserve 'Share Your Contacts'"
  );
  assert.match(
    profileActionsTsx,
    /<span>Share<\/span>/,
    "Action buttons must preserve 'Share'"
  );

  // Contact details preserve individual contact boxes
  assert.match(
    modernProfileTsx,
    /<div className="zappit-modern-contact-list">[\s\S]*?<div className="zappit-modern-contact-row">/,
    "Contact details must preserve individual contact row boxes"
  );

  // Services preserve 'BUSINESS INFORMATION', 'Services / Products', and '01' numbering
  assert.match(
    modernProfileTsx,
    /BUSINESS INFORMATION/,
    "Services card must preserve 'BUSINESS INFORMATION' header label"
  );
  assert.match(
    modernProfileTsx,
    /Services \/ Products/,
    "Services card must preserve 'Services / Products' header"
  );
  assert.match(
    modernProfileTsx,
    /zappit-modern-service-num/,
    "Services card must preserve '01' service number container"
  );
});

test("3. Softened Colors: Normal solid blue #2563EB, neutral secondary controls, and understated borders", () => {
  const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf-8");
  const themeTokensTs = fs.readFileSync(path.join(rootDir, "src/lib/themeTokens.ts"), "utf-8");
  const publicCardCss = fs.readFileSync(path.join(rootDir, "src/app/card/[slug]/public-card.css"), "utf-8");

  // Primary button: normal solid blue #2563EB
  assert.match(
    globalsCss,
    /\.zappit-modern-btn-primary\s*\{[\s\S]*?background:\s*var\(--profile-primary,\s*#2563EB\)\s*!important;/,
    "Primary button must have normal solid blue #2563EB background"
  );

  // Secondary buttons: neutral surface and understated border
  assert.match(
    globalsCss,
    /\.zappit-modern-btn-glass\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\)\s*!important;[\s\S]*?border:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.12\)\s*!important;/,
    "Secondary controls must have neutral dark surface and understated border"
  );

  // Mode switcher active button uses #2563EB and no neon glow
  assert.match(
    publicCardCss,
    /\.pc-mode-switch-btn\.active\s*\{[\s\S]*?background:\s*var\(--profile-primary,\s*#2563EB\);/,
    "Active mode button must have normal solid blue #2563EB"
  );
  assert.doesNotMatch(
    publicCardCss,
    /\.pc-mode-switch-btn\.active[\s\S]*?box-shadow:\s*0\s*0\s*18px/,
    "Active mode button must not have neon glowing box shadow"
  );

  // Theme tokens compute understated border and normal primary
  assert.match(
    themeTokensTs,
    /accent === "#0066FF" \? "#2563EB" : accent/,
    "Theme resolver must resolve default blue accent to #2563EB"
  );
});

test("4. Theme Support: Full light and dark mode support", () => {
  const globalsCss = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf-8");

  // Dark mode surface
  assert.match(
    globalsCss,
    /\.zappit-modern-container\s*\{[\s\S]*?background:\s*var\(--profile-surface,\s*#080F1E\);/,
    "Dark mode container surface must be #080F1E"
  );

  // Light mode overrides
  assert.match(
    globalsCss,
    /\[data-theme="light"\]\s*\.zappit-modern-container[\s\S]*?background:\s*#FFFFFF\s*!important;[\s\S]*?border-color:\s*#E2E8F0\s*!important;[\s\S]*?color:\s*#0F172A\s*!important;/,
    "Light mode must have white surface, soft gray border, and charcoal text"
  );
  assert.match(
    globalsCss,
    /\[data-theme="light"\]\s*\.zappit-modern-card[\s\S]*?background:\s*#F8FAFC\s*!important;[\s\S]*?border-color:\s*#E2E8F0\s*!important;/,
    "Light mode card must have light gray surface and soft gray border"
  );
});
