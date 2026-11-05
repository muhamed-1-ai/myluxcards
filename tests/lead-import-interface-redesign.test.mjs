import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const importModalPath = path.join(rootDir, "src/components/leads/ImportLeadsModal.tsx");
const importCssPath = path.join(rootDir, "src/components/leads/import-modal.css");
const leadsWorkspacePath = path.join(rootDir, "src/components/leads/LeadsWorkspace.tsx");

const importModalCode = fs.readFileSync(importModalPath, "utf8");
const importCss = fs.readFileSync(importCssPath, "utf8");
const leadsWorkspaceCode = fs.readFileSync(leadsWorkspacePath, "utf8");

test("TEST 1: Layout & Proportions - Max-width 1240px and two-column balanced grid", () => {
  assert.ok(importCss.includes("max-width: 1240px"), "Should constrain workspace to max-width ~1240px");
  assert.ok(importCss.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"), "Should use 2 equal-width columns on desktop");
  assert.ok(importCss.includes("gap: 28px") || importCss.includes("gap: 32px"), "Should have ~28-32px gap between cards");
  assert.ok(importCss.includes("@media (max-width: 1023.98px)") && importCss.includes("grid-template-columns: 1fr"), "Should stack columns on narrower screens");
});

test("TEST 2: Header - Circular back button beside Bulk Lead Import heading and subtitle", () => {
  assert.ok(importModalCode.includes("zappit-import-back-btn"), "Should have dedicated back button class");
  assert.ok(importModalCode.includes("Bulk Lead Import"), "Should render Bulk Lead Import title");
  assert.ok(importModalCode.includes("Upload CSV or Excel files to import multiple leads at once."), "Should render specified subtitle");
  assert.ok(importCss.includes(".zappit-import-back-btn"), "Should style circular back button with hover and focus states");
});

test("TEST 3: Upload Data Card - Section label, dashed drop zone (~230-240px), and centered elements", () => {
  assert.ok(importModalCode.includes("UPLOAD DATA"), "Should label left card UPLOAD DATA");
  assert.ok(importCss.includes("min-height: 235px"), "Drop zone should have ~230-240px height on desktop");
  assert.ok(importCss.includes("border: 2px dashed"), "Drop zone should have dashed border");
  assert.ok(importModalCode.includes("Click to select") && importModalCode.includes("or drag and drop here"), "Should show primary drop prompt");
  assert.ok(importModalCode.includes("Accepts CSV or Excel (.xlsx) files (max 10 MB)"), "Should show format and 10MB limit hint");
});

test("TEST 4: Template Tiles - Side-by-side CSV and Excel download tiles with soft tints", () => {
  assert.ok(importModalCode.includes("zappit-template-grid"), "Should use side-by-side template grid");
  assert.ok(importModalCode.includes("Download CSV Template") || (importModalCode.includes("CSV Template") && importModalCode.includes("Download")), "Should have CSV template button");
  assert.ok(importModalCode.includes("Download Excel Template") || (importModalCode.includes("Excel Template") && importModalCode.includes("Download")), "Should have Excel template button");
  assert.ok(!importModalCode.includes("Numbers Template"), "Should only display CSV and Excel templates that the system actually generates");
  assert.ok(importCss.includes("--import-tile-csv-bg") && importCss.includes("--import-tile-excel-bg"), "Should have soft tint tokens for templates");
});

test("TEST 5: Rules & Primary Action - Compact optional note and lower-right Start Import Process button", () => {
  assert.ok(importModalCode.includes("All lead fields are optional during bulk import"), "Should display compact optional fields explanation");
  assert.ok(importModalCode.includes("Completely empty rows are automatically skipped"), "Should preserve empty row skip explanation");
  assert.ok(importModalCode.includes("Start Import Process") || importModalCode.includes("Start Import"), "Should have Start Import Process action button");
  assert.ok(importCss.includes(".zappit-import-card-footer") && importCss.includes("justify-content: flex-end"), "Primary action should be positioned at lower right");
});

test("TEST 6: Selected File State - Displays file name, size, type icon, replace, remove, and status", () => {
  assert.ok(importModalCode.includes("zappit-selected-file-box"), "Should have selected file display container");
  assert.ok(importModalCode.includes("selectedFile.name"), "Should display selected file name");
  assert.ok(importModalCode.includes("formatBytes(selectedFile.size)"), "Should format and display file size");
  assert.ok(importModalCode.includes("Replace") && importModalCode.includes("Remove"), "Should provide clear Replace and Remove actions");
  assert.ok(importModalCode.includes("handleClearFile"), "Should provide file clearing handler");
});

test("TEST 7: Recent Imports Card - Header, empty database icon state, and VIEW FULL HISTORY action", () => {
  assert.ok(importModalCode.includes("RECENT IMPORTS"), "Should label right card RECENT IMPORTS");
  assert.ok(importModalCode.includes("No past imports found."), "Should display reference empty state text");
  assert.ok(importModalCode.includes("VIEW FULL HISTORY"), "Should have VIEW FULL HISTORY button");
  assert.ok(importCss.includes(".zappit-recent-card-header") && importCss.includes("border-bottom: 1px solid"), "Should have header with divider");
  assert.ok(importCss.includes(".zappit-recent-card-footer") && importCss.includes("border-top: 1px solid"), "Should have footer with divider");
});

test("TEST 8: Dashboard Content Area Integration & Filter Preservation in LeadsWorkspace", () => {
  assert.ok(leadsWorkspaceCode.includes("if (isImportOpen)"), "LeadsWorkspace should conditionally render Import workspace inline in content area");
  assert.ok(leadsWorkspaceCode.includes("<ImportLeadsModal"), "Should render ImportLeadsModal");
  assert.ok(leadsWorkspaceCode.includes("inline={true}"), "Should pass inline=true for dashboard content area rendering");
  assert.ok(leadsWorkspaceCode.includes("onClose={() => setIsImportOpen(false)}"), "Closing import should restore LeadsWorkspace view with filters intact");
});

test("TEST 9: Theme Tokens - Dark and Light mode contrast and styling", () => {
  assert.ok(importCss.includes('[data-theme="dark"]') || importCss.includes('body.dark-mode'), "Should define dark mode theme tokens");
  assert.ok(importCss.includes("--import-accent: #10B981"), "Should use Zappit emerald green accent token");
  assert.ok(importCss.includes("--import-card-bg: #16171D") || importCss.includes("--import-card-bg: #141519"), "Should use dark card surface background in dark mode");
  assert.ok(importCss.includes("--import-drop-border: #34D399"), "Should use bright dashed drop border in light mode");
});

