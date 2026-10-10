import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("Profile Defaults: CARD_PROFILE_DEFAULTS and cleanCardProfile default to 'modern'", async () => {
  const cardsTs = fs.readFileSync(path.join(rootDir, "src/lib/cards.ts"), "utf-8");

  // Verify CARD_PROFILE_DEFAULTS specifies profileFormat: "modern"
  assert.match(
    cardsTs,
    /CARD_PROFILE_DEFAULTS[\s\S]*?profileFormat:\s*"modern"/,
    "CARD_PROFILE_DEFAULTS must have profileFormat: 'modern'"
  );

  // Verify cleanCardProfile defaults profileFormat to "modern"
  assert.match(
    cardsTs,
    /output\.profileFormat\s*=\s*\["standard",\s*"modern"\]\.includes\(String\(value \|\| ""\)\.toLowerCase\(\)\)\s*\?\s*String\(value\)\.toLowerCase\(\)\s*:\s*"modern"/,
    "cleanCardProfile must default profileFormat to 'modern'"
  );

  // Verify completeCardProfile defaults missing/null profileFormat to "modern" while preserving explicit "standard"
  assert.match(
    cardsTs,
    /rawFormat\s*===\s*"standard"\s*\?\s*"standard"\s*:\s*"modern"/,
    "completeCardProfile must resolve missing profileFormat to 'modern'"
  );
});

test("ModernProfileLayout: No hardcoded dummy placeholders like 'Title – Company Name'", () => {
  const modernProfileLayoutTsx = fs.readFileSync(
    path.join(rootDir, "src/components/card/ModernProfileLayout.tsx"),
    "utf-8"
  );

  assert.doesNotMatch(
    modernProfileLayoutTsx,
    /Title\s*–\s*Company Name/,
    "ModernProfileLayout must not contain the fake placeholder 'Title – Company Name'"
  );

  assert.match(
    modernProfileLayoutTsx,
    /\{subtitle\s*&&\s*<p className="zappit-modern-subtitle">\{subtitle\}<\/p>\}/,
    "Subtitle must be conditionally rendered only when non-empty"
  );
});

test("PublicCardClient: Mode switcher bar is above the profile card", () => {
  const publicCardClientTsx = fs.readFileSync(
    path.join(rootDir, "src/app/card/[slug]/PublicCardClient.tsx"),
    "utf-8"
  );

  const switcherIndex = publicCardClientTsx.indexOf('className="pc-mode-switcher-bar"');
  const view3Index = publicCardClientTsx.indexOf('{/* ── VIEW 3: DIGITAL PROFILE ── */}');
  const view1Index = publicCardClientTsx.indexOf('{/* ── VIEW 1: VEHICLE CONNECT ── */}');

  assert.ok(switcherIndex > 0, "Switcher bar must exist");
  assert.ok(view1Index > switcherIndex, "Switcher bar must be rendered before vehicle view");
  assert.ok(view3Index > switcherIndex, "Switcher bar must be rendered before profile view");

  // Verify pc-hero is not at the root page level before the switcher bar
  const beforeSwitcher = publicCardClientTsx.substring(0, switcherIndex);
  assert.ok(
    !beforeSwitcher.includes('className="pc-hero"'),
    "pc-hero must NOT appear before the switcher bar"
  );

  // Verify standard pc-hero is only inside VIEW 3 standard branch
  const view3Section = publicCardClientTsx.substring(view3Index);
  assert.ok(
    view3Section.includes('className="pc-hero"'),
    "pc-hero must be present inside VIEW 3 standard branch"
  );
});

test("PublicCardClient: Active tab defaults to 'profile' and validates against feature permissions", () => {
  const publicCardClientTsx = fs.readFileSync(
    path.join(rootDir, "src/app/card/[slug]/PublicCardClient.tsx"),
    "utf-8"
  );

  assert.match(
    publicCardClientTsx,
    /const\s*\[activeView,\s*setActiveView\]\s*=\s*useState<PublicProfileView>\("profile"\)/,
    "activeView state must default to 'profile'"
  );

  assert.match(
    publicCardClientTsx,
    /prev\s*===\s*"vehicle"\s*&&\s*!vEnabled/,
    "Must fallback vehicle view to profile if vehicle feature is disabled"
  );
});

test("DashboardDemo: Cards created in dashboard default to modern layout", () => {
  const dashboardTsx = fs.readFileSync(
    path.join(rootDir, "src/app/dashboard/DashboardDemo.tsx"),
    "utf-8"
  );

  assert.match(
    dashboardTsx,
    /createBlankCard[\s\S]*?profileFormat:\s*"modern"/,
    "createBlankCard must set profileFormat to 'modern'"
  );

  assert.match(
    dashboardTsx,
    /normalizeCard[\s\S]*?profileFormat:\s*card\.profileFormat\s*===\s*"standard"\s*\?\s*"standard"\s*:\s*"modern"/,
    "normalizeCard must default profileFormat to 'modern'"
  );
});
