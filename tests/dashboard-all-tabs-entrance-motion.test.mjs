import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("CSS Entrance Motion Architecture - dashboard.css", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/dashboard/dashboard.css"), "utf8");

  // Classes
  assert.ok(css.includes(".dash-entrance-header"), "dashboard.css must define .dash-entrance-header");
  assert.ok(css.includes(".dash-entrance-card"), "dashboard.css must define .dash-entrance-card");
  assert.ok(css.includes(".dash-entrance-panel"), "dashboard.css must define .dash-entrance-panel");

  // Keyframes
  assert.ok(css.includes("@keyframes dashHeaderEntrance"), "dashboard.css must define dashHeaderEntrance");
  assert.ok(css.includes("@keyframes dashCardGrow"), "dashboard.css must define dashCardGrow");
  assert.ok(css.includes("@keyframes dashPanelEntrance"), "dashboard.css must define dashPanelEntrance");

  // Transform release at 100% to preserve fixed modals and tooltips
  assert.ok(css.includes("dashHeaderEntrance {\n  0% {\n    opacity: 0;\n    transform: translateY(-6px);\n  }\n  100% {\n    opacity: 1;\n    transform: none;"), "dashHeaderEntrance must release transform at 100%");
  assert.ok(css.includes("dashPanelEntrance {\n  0% {\n    opacity: 0;\n    transform: translateY(12px);\n  }\n  100% {\n    opacity: 1;\n    transform: none;"), "dashPanelEntrance must release transform at 100%");

  // Reduced motion support
  assert.ok(css.includes(".dash-entrance-panel,"), "prefers-reduced-motion must override .dash-entrance-panel");
});

test("CSS Entrance Motion Architecture - accounting.css", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/components/accounting/accounting.css"), "utf8");

  // Classes
  assert.ok(css.includes(".acc-entrance-header"), "accounting.css must define .acc-entrance-header");
  assert.ok(css.includes(".acc-entrance-card"), "accounting.css must define .acc-entrance-card");
  assert.ok(css.includes(".acc-entrance-panel"), "accounting.css must define .acc-entrance-panel");

  // Keyframes
  assert.ok(css.includes("@keyframes accHeaderEntrance"), "accounting.css must define accHeaderEntrance");
  assert.ok(css.includes("@keyframes accCardEntrance"), "accounting.css must define accCardEntrance");
  assert.ok(css.includes("@keyframes accPanelEntrance"), "accounting.css must define accPanelEntrance");

  // Transform release at 100%
  assert.ok(css.includes("accHeaderEntrance {\n  0% {\n    opacity: 0;\n    transform: translateY(-6px);\n  }\n  100% {\n    opacity: 1;\n    transform: none;"), "accHeaderEntrance must release transform at 100%");
  assert.ok(css.includes("accPanelEntrance {\n  0% {\n    opacity: 0;\n    transform: translateY(12px);\n  }\n  100% {\n    opacity: 1;\n    transform: none;"), "accPanelEntrance must release transform at 100%");

  // Reduced motion support
  assert.ok(css.includes(".acc-entrance-panel,"), "prefers-reduced-motion must override .acc-entrance-panel");
});

test("Dashboard & CRM Entrance Motion Integration", () => {
  const overviewFile = fs.readFileSync(path.join(ROOT, "src/components/dashboard/LeadManagementDashboard.tsx"), "utf8");
  const leadsFile = fs.readFileSync(path.join(ROOT, "src/components/leads/LeadsWorkspace.tsx"), "utf8");

  // Overview
  assert.ok(overviewFile.includes("useDashboardEntrance(true)"), "Overview must use useDashboardEntrance hook");
  assert.ok(overviewFile.includes("dash-entrance-card"), "Overview must animate stat and chart cards");

  // All Leads
  assert.ok(leadsFile.includes("useDashboardEntrance(true)"), "LeadsWorkspace must use useDashboardEntrance hook");
  assert.ok(leadsFile.includes("dash-entrance-header"), "LeadsWorkspace must animate header");
  assert.ok(leadsFile.includes("dash-entrance-card"), "LeadsWorkspace must animate KPI stat cards with grow motion");
  assert.ok(leadsFile.includes("dash-entrance-panel"), "LeadsWorkspace must animate table panel with gentle lift");
  assert.ok(leadsFile.includes("getCardEntranceDelay(0, 60, 240)"), "LeadsWorkspace must stagger KPI cards");
});

test("Master Config Screens Entrance Motion Integration", () => {
  const sources = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LeadSourcesConfig.tsx"), "utf8");
  const stages = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LeadStagesConfig.tsx"), "utf8");
  const products = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/ProductsConfig.tsx"), "utf8");
  const calendar = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/CalendarConfig.tsx"), "utf8");
  const reasons = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LobReasonsConfig.tsx"), "utf8");
  const dynamic = fs.readFileSync(path.join(ROOT, "src/components/dashboard/config/LeadDynamicsConfig.tsx"), "utf8");

  // Sources
  assert.ok(sources.includes("dash-entrance-header"), "LeadSourcesConfig must animate header");
  assert.ok(sources.includes("dash-entrance-card"), "LeadSourcesConfig must animate KPI cards");
  assert.ok(sources.includes("dash-entrance-panel"), "LeadSourcesConfig must animate table container");

  // Stages
  assert.ok(stages.includes("dash-entrance-header"), "LeadStagesConfig must animate header");
  assert.ok(stages.includes("dash-entrance-card"), "LeadStagesConfig must animate KPI cards");
  assert.ok(stages.includes("dash-entrance-panel"), "LeadStagesConfig must animate pipeline/table container");

  // Products
  assert.ok(products.includes("dash-entrance-header"), "ProductsConfig must animate header");
  assert.ok(products.includes("dash-entrance-panel"), "ProductsConfig must animate products management panel");

  // Calendar
  assert.ok(calendar.includes("dash-entrance-header"), "CalendarConfig must animate header");
  assert.ok(calendar.includes("dash-entrance-card"), "CalendarConfig must animate metric cards");
  assert.ok(calendar.includes("dash-entrance-panel"), "CalendarConfig must animate calendar workspace panel");

  // LOB Reasons
  assert.ok(reasons.includes("dash-entrance-header"), "LobReasonsConfig must animate header");
  assert.ok(reasons.includes("dash-entrance-panel"), "LobReasonsConfig must animate action bar and table panel");

  // Dynamic Fields
  assert.ok(dynamic.includes("dash-entrance-header"), "LeadDynamicsConfig must animate header");
  assert.ok(dynamic.includes("dash-entrance-card"), "LeadDynamicsConfig must animate stat cards");
  assert.ok(dynamic.includes("dash-entrance-panel"), "LeadDynamicsConfig must animate table container");
});

test("Accounting Pages & Internal Tabs Entrance Motion Integration", () => {
  const txView = fs.readFileSync(path.join(ROOT, "src/components/accounting/TransactionsView.tsx"), "utf8");
  const peopleView = fs.readFileSync(path.join(ROOT, "src/components/accounting/PeopleView.tsx"), "utf8");
  const salesView = fs.readFileSync(path.join(ROOT, "src/components/accounting/SalesInvoicesView.tsx"), "utf8");
  const reportsView = fs.readFileSync(path.join(ROOT, "src/components/accounting/ReportsView.tsx"), "utf8");
  const moreView = fs.readFileSync(path.join(ROOT, "src/components/accounting/MoreView.tsx"), "utf8");
  const prodView = fs.readFileSync(path.join(ROOT, "src/components/accounting/ProductsView.tsx"), "utf8");
  const catView = fs.readFileSync(path.join(ROOT, "src/components/accounting/CategoriesView.tsx"), "utf8");

  // TransactionsView & internal subtabs
  assert.ok(txView.includes("acc-entrance-header"), "TransactionsView must animate header");
  assert.ok(txView.includes("key={subtab}"), "TransactionsView must key subtabs for internal tab entrance");
  assert.ok(txView.includes("acc-entrance-panel"), "TransactionsView must animate active subtab content");

  // PeopleView & internal subtabs
  assert.ok(peopleView.includes("acc-entrance-header"), "PeopleView must animate header");
  assert.ok(peopleView.includes("key={subtab}"), "PeopleView must key subtabs for internal tab entrance");
  assert.ok(peopleView.includes("acc-entrance-panel"), "PeopleView must animate active subtab content");

  // SalesInvoicesView & internal tabs
  assert.ok(salesView.includes("acc-entrance-header"), "SalesInvoicesView must animate header");
  assert.ok(salesView.includes("key={activeTab}"), "SalesInvoicesView must key activeTab for internal tab entrance");
  assert.ok(salesView.includes("acc-entrance-panel"), "SalesInvoicesView must animate activeTab content");

  // ReportsView & internal report types
  assert.ok(reportsView.includes("acc-entrance-header"), "ReportsView must animate header");
  assert.ok(reportsView.includes("key={reportType}"), "ReportsView must key reportType for internal report switch entrance");
  assert.ok(reportsView.includes("acc-entrance-panel"), "ReportsView must animate report output");

  // MoreView & tool drilldowns
  assert.ok(moreView.includes("acc-entrance-header"), "MoreView must animate header");
  assert.ok(moreView.includes("acc-entrance-card"), "MoreView must animate tool cards");
  assert.ok(moreView.includes("key={activeTool"), "MoreView must key active tool container for drilldown and back entrance");
  assert.ok(moreView.includes("acc-entrance-panel"), "MoreView must animate active tool panel");

  // ProductsView & CategoriesView
  assert.ok(prodView.includes("acc-entrance-header"), "ProductsView must animate header");
  assert.ok(prodView.includes("acc-entrance-panel"), "ProductsView must animate products panel");
  assert.ok(catView.includes("acc-entrance-header"), "CategoriesView must animate header");
  assert.ok(catView.includes("acc-entrance-panel"), "CategoriesView must animate categories panel");
});

test("Card and Account Screens Entrance Motion Integration", () => {
  const demoFile = fs.readFileSync(path.join(ROOT, "src/app/dashboard/DashboardDemo.tsx"), "utf8");
  const settingsFile = fs.readFileSync(path.join(ROOT, "src/components/settings/GlobalAccountSettingsView.tsx"), "utf8");

  // Card edit screens
  assert.ok(demoFile.includes("page-heading edit-heading dash-entrance-header"), "Card edit heading must have dash-entrance-header");
  assert.ok(demoFile.includes("edit-layout dash-entrance-panel"), "Card edit layout must have dash-entrance-panel");

  // My Cards
  assert.ok(demoFile.includes("page-heading dash-entrance-header"), "My Cards heading must have dash-entrance-header");
  assert.ok(demoFile.includes("table-card dash-entrance-panel"), "My Cards table card must have dash-entrance-panel");

  // Settings & Security
  assert.ok(settingsFile.includes("acc-entrance-header"), "GlobalAccountSettingsView must animate header");
  assert.ok(settingsFile.includes("acc-entrance-panel"), "GlobalAccountSettingsView must animate setting panels");
});

