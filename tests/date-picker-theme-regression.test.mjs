import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const datePickerCode = readFileSync("src/components/ui/DatePicker.tsx", "utf8");
const leadsCss = readFileSync("src/app/dashboard/leads/leads.css", "utf8");
const dashboardCss = readFileSync("src/app/dashboard/dashboard.css", "utf8");
const leadDashboardCode = readFileSync("src/components/dashboard/LeadManagementDashboard.tsx", "utf8");

test("TEST 1: DatePicker trigger dimensions and styling match adjacent dashboard filters", () => {
  // Height must be exactly 42px matching .crm-filter-select and other filter inputs
  assert.ok(datePickerCode.includes("h-[42px]"), "DatePicker trigger must have h-[42px] matching adjacent filters");
  assert.ok(datePickerCode.includes("rounded-[10px]"), "DatePicker trigger must have rounded-[10px]");

  // Must have dedicated styling classes
  assert.ok(datePickerCode.includes("crm-datepicker-trigger"), "Trigger must have crm-datepicker-trigger class");
  assert.ok(datePickerCode.includes("crm-filter-date"), "Trigger must have crm-filter-date class");

  // Icon color must be brand blue (#0066FF in light mode, #38BDF8 in dark mode), NOT emerald green
  assert.ok(!datePickerCode.includes("text-emerald-400"), "Emerald green hardcoded color must be removed");
  assert.ok(datePickerCode.includes('isLightMode ? "#0066FF" : "#38BDF8"'), "Calendar icon must use electric blue theme tokens");

  // Dynamic inline style fallback for surface and text
  assert.ok(datePickerCode.includes('backgroundColor: isLightMode ? "#FFFFFF" : "#071426"'));
  assert.ok(datePickerCode.includes('color: isLightMode ? "#0F172A" : "#FFFFFF"'));
});

test("TEST 2: DatePicker dynamically observes theme changes on documentElement and body", () => {
  // Must use MutationObserver to reactively update without full unmount
  assert.ok(datePickerCode.includes("new MutationObserver(checkTheme)"));
  assert.ok(datePickerCode.includes('attributeFilter: ["data-theme", "class"]'));
  assert.ok(datePickerCode.includes('rootTheme === "light" || hasLightClass'));
});

test("TEST 3: DatePicker calendar popover is completely themed for both light and dark modes", () => {
  // Popover container class
  assert.ok(datePickerCode.includes("crm-datepicker-popover"));

  // Native color-scheme set for scrollbars and popover controls
  assert.ok(datePickerCode.includes('colorScheme: isLightMode ? "light" : "dark"'));

  // Popover surface colors
  assert.ok(datePickerCode.includes('backgroundColor: isLightMode ? "#FFFFFF" : "#0B172A"'));
  assert.ok(datePickerCode.includes('borderColor: isLightMode ? "#E2E8F0" : "#1E293B"'));
  assert.ok(datePickerCode.includes('color: isLightMode ? "#0F172A" : "#FFFFFF"'));

  // Navigation arrows, Month/Year dropdowns, Weekday labels, and Action buttons themed
  assert.ok(datePickerCode.includes("WEEKDAYS = [\"Sun\", \"Mon\", \"Tue\", \"Wed\", \"Thu\", \"Fri\", \"Sat\"]"));
  assert.ok(datePickerCode.includes("handleSelectToday"));
  assert.ok(datePickerCode.includes("handleClear"));
});

test("TEST 4: leads.css and dashboard.css contain light and dark rules for DatePicker controls", () => {
  // leads.css light theme rules
  assert.ok(leadsCss.includes('[data-theme="light"] .crm-datepicker-trigger'));
  assert.ok(leadsCss.includes('body.light-mode .crm-datepicker-trigger'));
  assert.ok(leadsCss.includes('[data-theme="light"] .crm-datepicker-popover'));
  assert.ok(leadsCss.includes('body.light-mode .crm-datepicker-popover'));

  // leads.css dark theme rules
  assert.ok(leadsCss.includes('[data-theme="dark"] .crm-datepicker-trigger'));
  assert.ok(leadsCss.includes('body.dark-mode .crm-datepicker-trigger'));
  assert.ok(leadsCss.includes('[data-theme="dark"] .crm-datepicker-popover'));
  assert.ok(leadsCss.includes('body.dark-mode .crm-datepicker-popover'));

  // dashboard.css light and dark theme rules
  assert.ok(dashboardCss.includes('[data-theme="light"] .crm-datepicker-trigger'));
  assert.ok(dashboardCss.includes('body.light-mode .crm-datepicker-trigger'));
  assert.ok(dashboardCss.includes('[data-theme="dark"] .crm-datepicker-trigger'));
  assert.ok(dashboardCss.includes('body.dark-mode .crm-datepicker-trigger'));
});

test("TEST 5: LeadManagementDashboard integrates DatePicker with date-range cross validation", () => {
  // Start date should restrict maxDate to endDateFilter
  assert.ok(leadDashboardCode.includes("maxDate={endDateFilter || undefined}"));

  // End date should restrict minDate to startDateFilter
  assert.ok(leadDashboardCode.includes("minDate={startDateFilter || undefined}"));

  // State handlers preserve selected values and do not trigger unexpected submit
  assert.ok(leadDashboardCode.includes("setStartDateFilter(dateStr)"));
  assert.ok(leadDashboardCode.includes("setEndDateFilter(dateStr)"));
});
