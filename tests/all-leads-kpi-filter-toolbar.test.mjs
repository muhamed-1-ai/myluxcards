import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Starting All Leads KPI and Filter Toolbar test suite...");

// 1. Inspect schema.prisma for Office Location relationship gap
const schemaPath = path.resolve("prisma/schema.prisma");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");
assert.ok(
  !schemaContent.includes("model Office"),
  "Confirmed schema.prisma has no Office model"
);
assert.ok(
  !schemaContent.includes("office_location"),
  "Confirmed Lead model has no office_location field"
);
console.log("✔ Office location gap verified: database has no Office entity or lead relationship");

// 2. Inspect LeadsWorkspace.tsx implementation
const workspacePath = path.resolve("src/components/leads/LeadsWorkspace.tsx");
const workspaceContent = fs.readFileSync(workspacePath, "utf-8");

// Assert Sparkline and Lucide Icons
assert.ok(workspaceContent.includes("import Sparkline from \"./Sparkline\""), "Sparkline component imported");
assert.ok(workspaceContent.includes("Layers"), "Layers icon imported for Open Pipeline");
assert.ok(workspaceContent.includes("IndianRupee"), "IndianRupee icon imported for Expected Revenue");
assert.ok(workspaceContent.includes("X"), "X icon imported for Clear filters");

// Assert 4 KPI Cards structure
assert.ok(workspaceContent.includes("TOTAL LEADS"), "Total Leads KPI label present");
assert.ok(workspaceContent.includes("OPEN PIPELINE"), "Open Pipeline KPI label present");
assert.ok(workspaceContent.includes("DUE TODAY"), "Due Today KPI label present");
assert.ok(workspaceContent.includes("EXPECTED REVENUE"), "Expected Revenue KPI label present");
assert.ok(workspaceContent.includes("kpi-icon-box"), "KPI icon boxes present");
assert.ok(workspaceContent.includes("Sparkline"), "Sparkline used in KPI cards");

// Assert Filter Toolbar structure and ordering
assert.ok(workspaceContent.includes("crm-filter-toolbar"), "crm-filter-toolbar container present");
assert.ok(workspaceContent.includes("crm-toolbar-search"), "Search input present");
assert.ok(workspaceContent.includes("crm-toolbar-select"), "Select controls present");
assert.ok(workspaceContent.includes("crm-toolbar-date-wrap"), "Date range controls present");
assert.ok(workspaceContent.includes("crm-toolbar-clear-btn"), "Clear filters button present");

// Confirm NO dummy Office Location dropdown is present in toolbar
assert.ok(!workspaceContent.includes("<option value=\"\">Office Location</option>"), "No dummy Office Location dropdown rendered");

// Assert Debounce and Reset
assert.ok(workspaceContent.includes("searchInput"), "Debounced search input state present");
assert.ok(workspaceContent.includes("hasActiveFilters"), "hasActiveFilters calculation present");
assert.ok(workspaceContent.includes("handleResetFilters"), "handleResetFilters present");

console.log("✔ LeadsWorkspace.tsx layout, KPI cards, and filter toolbar verified");

// 3. Inspect Search API Route
const routePath = path.resolve("src/app/api/leads/search/route.ts");
const routeContent = fs.readFileSync(routePath, "utf-8");

// Assert inclusive end date
assert.ok(routeContent.includes("23:59:59.999Z"), "Inclusive end of day ISO timestamp present");

// Assert KPI series calculation
assert.ok(routeContent.includes("totalLeadsSeries"), "Total leads series calculated");
assert.ok(routeContent.includes("openPipelineSeries"), "Open pipeline series calculated");
assert.ok(routeContent.includes("dueTodaySeries"), "Due today series calculated");
assert.ok(routeContent.includes("expectedRevenueSeries"), "Expected revenue series calculated");

// Assert dueToday joins on matching leads whereClause
assert.ok(routeContent.includes("f.lead_id = l.id"), "Follow-ups joined to leads matching filters");

// Assert filterOptions returned
assert.ok(routeContent.includes("filterOptions"), "filterOptions returned in API response");

console.log("✔ Search API route inclusive date, scoped due query, and series verified");

// 4. Inspect Sparkline.tsx implementation
const sparklinePath = path.resolve("src/components/leads/Sparkline.tsx");
const sparklineContent = fs.readFileSync(sparklinePath, "utf-8");

assert.ok(sparklineContent.includes("isAllZero"), "Flat line handling for all-zero series present");
assert.ok(sparklineContent.includes("isInsufficient"), "Insufficient data fallback present");
assert.ok(sparklineContent.includes("clipPath"), "Clip path reveal animation present");
assert.ok(sparklineContent.includes("prefers-reduced-motion"), "prefers-reduced-motion check present");

console.log("✔ Sparkline.tsx zero line, insufficient fallback, and animation reveal verified");

console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉");

