import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveThemeTokens, getContrastRatio } from "../src/lib/themeTokens.ts";

test("1. Navigation Tokens resolve correctly for Black & White theme", () => {
  const result = resolveThemeTokens({
    profileThemePreference: "black_white",
  });

  const { tokens, styleObj } = result;

  assert.equal(tokens.navBg, "#000000", "navBg must be pure black");
  assert.equal(tokens.navSelectedBg, "#FFFFFF", "navSelectedBg must be white");
  assert.equal(tokens.navSelectedText, "#000000", "navSelectedText must be pure black");

  const selectedContrast = getContrastRatio(tokens.navSelectedText, tokens.navSelectedBg);
  assert.ok(selectedContrast >= 15, `Selected tab contrast must be >= 15:1 (got ${selectedContrast}:1)`);

  const unselectedContrast = getContrastRatio(tokens.navText, tokens.navBg);
  assert.ok(unselectedContrast >= 4.5, `Unselected tab contrast must be >= 4.5:1 (got ${unselectedContrast}:1)`);

  assert.equal(styleObj["--profile-nav-bg"], "#000000");
  assert.equal(styleObj["--profile-nav-selected-bg"], "#FFFFFF");
  assert.equal(styleObj["--profile-nav-selected-text"], "#000000");
  assert.equal(styleObj["--pc-nav-selected-bg"], "#FFFFFF");
  assert.equal(styleObj["--pc-nav-selected-text"], "#000000");
});

test("2. Navigation Tokens resolve correctly for White & Black theme", () => {
  const result = resolveThemeTokens({
    profileThemePreference: "white_black",
  });

  const { tokens, styleObj } = result;

  assert.equal(tokens.navBg, "#FFFFFF", "navBg must be pure white");
  assert.equal(tokens.navSelectedBg, "#09090B", "navSelectedBg must be black/zinc");
  assert.equal(tokens.navSelectedText, "#FFFFFF", "navSelectedText must be white");

  const selectedContrast = getContrastRatio(tokens.navSelectedText, tokens.navSelectedBg);
  assert.ok(selectedContrast >= 15, `Selected tab contrast must be >= 15:1 (got ${selectedContrast}:1)`);

  const unselectedContrast = getContrastRatio(tokens.navText, tokens.navBg);
  assert.ok(unselectedContrast >= 4.5, `Unselected tab contrast must be >= 4.5:1 (got ${unselectedContrast}:1)`);

  assert.equal(styleObj["--profile-nav-bg"], "#FFFFFF");
  assert.equal(styleObj["--profile-nav-selected-bg"], "#09090B");
  assert.equal(styleObj["--profile-nav-selected-text"], "#FFFFFF");
});

test("3. Navigation Tokens resolve correctly for Carbon Platinum theme", () => {
  const result = resolveThemeTokens({
    profileThemePreference: "carbon_platinum",
  });

  const { tokens, styleObj } = result;

  assert.equal(tokens.navBg, "#14171A", "navBg must be carbon charcoal");
  assert.equal(tokens.navSelectedBg, "#B9C2CC", "navSelectedBg must be platinum");
  assert.equal(tokens.navSelectedText, "#0F1216", "navSelectedText must be dark charcoal");

  const selectedContrast = getContrastRatio(tokens.navSelectedText, tokens.navSelectedBg);
  assert.ok(selectedContrast >= 7.0, `Selected tab contrast must be >= 7:1 (got ${selectedContrast}:1)`);

  const unselectedContrast = getContrastRatio(tokens.navText, tokens.navBg);
  assert.ok(unselectedContrast >= 4.5, `Unselected tab contrast must be >= 4.5:1 (got ${unselectedContrast}:1)`);

  assert.equal(styleObj["--profile-nav-bg"], "#14171A");
  assert.equal(styleObj["--profile-nav-selected-bg"], "#B9C2CC");
  assert.equal(styleObj["--profile-nav-selected-text"], "#0F1216");
});

test("4. Navigation Tokens dynamically derive from Dashboard Theme appearance", () => {
  const result = resolveThemeTokens({
    profileThemePreference: "dashboard",
    profileBackground: "#0A192F",
    profileAccent: "#00E5FF",
  });

  const { tokens, styleObj } = result;

  assert.ok(tokens.navBg, "Dashboard theme must provide navBg");
  assert.ok(tokens.navSelectedBg, "Dashboard theme must provide navSelectedBg");
  assert.ok(tokens.navSelectedText, "Dashboard theme must provide navSelectedText");

  const selectedContrast = getContrastRatio(tokens.navSelectedText, tokens.navSelectedBg);
  assert.ok(selectedContrast >= 4.5, `Selected tab contrast must be >= 4.5:1 (got ${selectedContrast}:1)`);

  const unselectedContrast = getContrastRatio(tokens.navText, tokens.navBg);
  assert.ok(unselectedContrast >= 4.5, `Unselected tab contrast must be >= 4.5:1 (got ${unselectedContrast}:1)`);
});

test("5. PublicCardClient replaces raw emojis with accessible SVG icons", () => {
  const filePath = path.resolve(process.cwd(), "src/app/card/[slug]/PublicCardClient.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  // Check icon imports
  assert.ok(content.includes("User"), "PublicCardClient must import User icon");
  assert.ok(content.includes("Car"), "PublicCardClient must import Car icon");
  assert.ok(content.includes("Tag"), "PublicCardClient must import Tag icon");

  // Check switcher bar no longer hardcodes emojis
  const navBarSnippet = content.substring(
    content.indexOf('className="pc-mode-switcher-bar"'),
    content.indexOf('activeView === "vehicle" &&')
  );
  assert.ok(!navBarSnippet.includes("🚗"), "Navigation bar must NOT contain raw 🚗 emoji");
  assert.ok(!navBarSnippet.includes("🏷️"), "Navigation bar must NOT contain raw 🏷️ emoji");
  assert.ok(navBarSnippet.includes("pc-mode-tab-icon"), "Tab buttons must render pc-mode-tab-icon");
});

test("6. API GET route passes incoming request to currentIdentity for cookie/auth resolution", () => {
  const routePath = path.resolve(process.cwd(), "src/app/api/cards/public/[slug]/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  assert.ok(
    content.includes("export async function GET(request: Request"),
    "GET signature must accept request: Request"
  );
  assert.ok(
    content.includes("currentIdentity(request)"),
    "currentIdentity must receive request parameter"
  );
});

test("7. public-card.css styles navigation tabs to adopt theme variables and icon inheritance", () => {
  const cssPath = path.resolve(process.cwd(), "src/app/card/[slug]/public-card.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  assert.ok(css.includes(".pc-mode-tab-icon"), ".pc-mode-tab-icon rule must exist");
  assert.ok(css.includes("stroke: currentColor;"), ".pc-mode-tab-icon must inherit stroke color");
  assert.ok(css.includes("color: inherit;"), ".pc-mode-tab-icon must inherit color");
  assert.ok(css.includes("var(--profile-nav-bg"), "Navbar background must use --profile-nav-bg");
  assert.ok(css.includes("var(--pc-nav-selected-bg"), "Navbar active button must use selected bg");
  assert.ok(css.includes("var(--pc-nav-selected-text,"), "Navbar active button must use selected text");
});

