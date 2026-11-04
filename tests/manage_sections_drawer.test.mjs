import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_DASHBOARD_CARDS,
  DEFAULT_DASHBOARD_SECTIONS,
  normalizeDashboardSections,
  normalizeDashboardCards,
  normalizeDashboardPreferences,
} from "../src/components/dashboard/CustomizeDashboardDrawer.tsx";

const drawerSource = readFileSync(
  new URL("../src/components/dashboard/CustomizeDashboardDrawer.tsx", import.meta.url),
  "utf8"
);
const dashboardSource = readFileSync(
  new URL("../src/components/dashboard/LeadManagementDashboard.tsx", import.meta.url),
  "utf8"
);

test("1. Viewport-level portal and safe area positioning", () => {
  // Uses createPortal mounting to document.body
  assert.match(drawerSource, /createPortal\(drawerContent,\s*document\.body\)/);
  assert.match(drawerSource, /zIndex:\s*99999/);
  assert.match(drawerSource, /position:\s*"fixed"/);
  assert.match(drawerSource, /inset:\s*0/);

  // Mobile fit and safe-area inset on footer
  assert.match(drawerSource, /height:\s*"100dvh"/);
  assert.match(drawerSource, /maxHeight:\s*"100dvh"/);
  assert.match(drawerSource, /env\(safe-area-inset-bottom/);
});

test("2. Pinned header, pinned footer, scrollable body, and scroll lock", () => {
  // Scroll lock and restoration logic
  assert.match(drawerSource, /window\.scrollY\s*\|\|\s*document\.documentElement\.scrollTop/);
  assert.match(drawerSource, /document\.body\.style\.position\s*=\s*"fixed"/);
  assert.match(drawerSource, /document\.body\.style\.overflow\s*=\s*"hidden"/);
  assert.match(drawerSource, /window\.scrollTo\(0,\s*scrollY\)/);

  // Drawer container overflow hidden so only body scrolls
  assert.match(drawerSource, /flexShrink:\s*0[\s\S]*Manage Sections/);
  assert.match(drawerSource, /flex:\s*"1 1 0%"[\s\S]*overflowY:\s*"auto"/);

  // Close button and Save Changes in pinned sections
  assert.match(drawerSource, /aria-label="Close drawer"/);
  assert.match(drawerSource, /Save Changes/);
  assert.match(drawerSource, /Cancel/);
  assert.match(drawerSource, /Reset to Default/);
});

test("3. Open Manage Sections directly without scrollIntoView jumps", () => {
  // No scrollIntoView on document or window
  assert.doesNotMatch(drawerSource, /scrollIntoView/);

  // Direct tab navigation for sections and cards
  assert.match(drawerSource, /currentTab === "sections"/);
  assert.match(drawerSource, /setCurrentTab\(activeTab\s*\|\|\s*"cards"\)/);
  assert.match(drawerSource, /setCurrentTab\("sections"\)/);
});

test("4. Separate switches for Growth Velocity and Pipeline Stages, carrying over legacy setting", () => {
  // 5 canonical sections present in DEFAULT_DASHBOARD_SECTIONS
  assert.equal(DEFAULT_DASHBOARD_SECTIONS.length, 5);
  const ids = DEFAULT_DASHBOARD_SECTIONS.map((s) => s.id);
  assert.deepEqual(ids, [
    "daily_capacity",
    "growth_velocity",
    "pipeline_stages",
    "lob_analysis",
    "calendar_companion",
  ]);

  // Case A: Legacy preferences with growth_pipeline = visible: true
  const legacyVisible = [
    { id: "daily_capacity", visible: true, order: 0 },
    { id: "growth_pipeline", visible: true, order: 1, displayName: "Combined Growth" },
    { id: "lob_analysis", visible: true, order: 2 },
  ];
  const migratedVisible = normalizeDashboardSections(legacyVisible);
  const gvVis = migratedVisible.find((s) => s.id === "growth_velocity");
  const psVis = migratedVisible.find((s) => s.id === "pipeline_stages");
  assert.ok(gvVis, "growth_velocity must be present");
  assert.ok(psVis, "pipeline_stages must be present");
  assert.equal(gvVis.visible, true);
  assert.equal(psVis.visible, true);

  // Case B: Legacy preferences with growth_pipeline = visible: false
  const legacyHidden = [
    { id: "daily_capacity", visible: true, order: 0 },
    { id: "growth_pipeline", visible: false, order: 1 },
    { id: "lob_analysis", visible: false, order: 2 },
  ];
  const migratedHidden = normalizeDashboardSections(legacyHidden);
  const gvHid = migratedHidden.find((s) => s.id === "growth_velocity");
  const psHid = migratedHidden.find((s) => s.id === "pipeline_stages");
  const lobHid = migratedHidden.find((s) => s.id === "lob_analysis");
  assert.equal(gvHid.visible, false);
  assert.equal(psHid.visible, false);
  assert.equal(lobHid.visible, false);

  // Case C: Explicit 'Show on dashboard' switch markup
  assert.match(drawerSource, /Show on dashboard/);
  assert.match(drawerSource, /role="switch"/);
  assert.match(drawerSource, /aria-checked=\{item\.visible\}/);
});

test("5. LOB Analysis and widgets close layout gaps when hidden, remaining listed in drawer", () => {
  // In dashboard component: hidden sections are removed from layout
  assert.match(dashboardSource, /const isLobVisible = visibleSections\.some\(\(s\) => s\.id === "lob_analysis"\)/);
  assert.match(dashboardSource, /const isGrowthVelocityVisible = visibleSections\.some\(\(s\) => s\.id === "growth_velocity"\)/);
  assert.match(dashboardSource, /const isPipelineStagesVisible = visibleSections\.some\(\(s\) => s\.id === "pipeline_stages"\)/);

  // Atomic save in LeadManagementDashboard: only updates state after res.ok
  assert.match(dashboardSource, /const res = await fetch\("\/api\/user\/dashboard-preferences"/);
  assert.match(dashboardSource, /if \(!res\.ok\)[\s\S]*throw new Error/);
  assert.match(dashboardSource, /setUserPrefs\(newPrefs\);[\s\S]*localStorage\.setItem/);

  // Verify normalizeDashboardSections keeps hidden items in the array (visible: false)
  const prefsWithHiddenLob = [
    { id: "daily_capacity", visible: true, order: 0 },
    { id: "growth_velocity", visible: true, order: 1 },
    { id: "pipeline_stages", visible: true, order: 2 },
    { id: "lob_analysis", visible: false, order: 3 },
    { id: "calendar_companion", visible: true, order: 4 },
  ];
  const normalized = normalizeDashboardSections(prefsWithHiddenLob);
  assert.equal(normalized.length, 5);
  const lobItem = normalized.find((s) => s.id === "lob_analysis");
  assert.ok(lobItem, "Hidden LOB section must remain in normalized list for drawer display");
  assert.equal(lobItem.visible, false);

  // Turning back on
  lobItem.visible = true;
  const reEnabled = normalizeDashboardSections(normalized);
  assert.equal(reEnabled.find((s) => s.id === "lob_analysis").visible, true);
});

