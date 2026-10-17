import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function parseHex(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrast(hex1, hex2) {
  const l1 = getLuminance(parseHex(hex1));
  const l2 = getLuminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Calendar Light Mode Visibility & Theme Regression Tests", () => {
  const calendarConfigPath = path.resolve(process.cwd(), "src/components/dashboard/config/CalendarConfig.tsx");
  const globalsCssPath = path.resolve(process.cwd(), "src/app/globals.css");
  const dashboardCssPath = path.resolve(process.cwd(), "src/app/dashboard/dashboard.css");

  const calendarConfigContent = fs.readFileSync(calendarConfigPath, "utf-8");
  const globalsCssContent = fs.readFileSync(globalsCssPath, "utf-8");
  const dashboardCssContent = fs.readFileSync(dashboardCssPath, "utf-8");

  test("1. No hardcoded white current-month text in CalendarConfig.tsx", () => {
    assert.strictEqual(
      calendarConfigContent.includes('dayItem.isCurrentMonth ? "#FFFFFF"'),
      false,
      "Hardcoded white current-month text #FFFFFF must not be present"
    );
  });

  test("2. No cell-wide opacity in mobile month grid in CalendarConfig.tsx", () => {
    assert.strictEqual(
      calendarConfigContent.includes("opacity: dayItem.isCurrentMonth ? 1 : 0.45"),
      false,
      "Mobile cell opacity must not be present to avoid fading text and controls"
    );
  });

  test("3. No faint 0.6 opacity on + Add task button", () => {
    assert.strictEqual(
      calendarConfigContent.includes('style={{ fontSize: 10, color: "#64748B", textAlign: "right", opacity: 0.6 }}'),
      false,
      "+ Add task text must not have opacity: 0.6"
    );
    assert.ok(
      calendarConfigContent.includes("cal-config-add-task-btn"),
      "Add task button must use semantic cal-config-add-task-btn class"
    );
  });

  test("4. Semantic calendar tokens exist in globals.css for both light and dark themes", () => {
    assert.ok(globalsCssContent.includes("--calendar-bg"), "Must define --calendar-bg in globals.css");
    assert.ok(globalsCssContent.includes("--calendar-cell-bg"), "Must define --calendar-cell-bg in globals.css");
    assert.ok(globalsCssContent.includes("--calendar-date-primary: #0F172A"), "Light mode must use #0F172A for date primary");
    assert.ok(globalsCssContent.includes("--calendar-add-task-text: #475569"), "Light mode must use #475569 for add task text");
    assert.ok(globalsCssContent.includes("--calendar-date-muted: #64748B"), "Light mode must use #64748B for adjacent date text");
  });

  test("5. Calendar CSS rules exist in dashboard.css", () => {
    assert.ok(dashboardCssContent.includes(".cal-config-grid-cell"), "Must include .cal-config-grid-cell in dashboard.css");
    assert.ok(dashboardCssContent.includes(".cal-config-date-num"), "Must include .cal-config-date-num in dashboard.css");
    assert.ok(dashboardCssContent.includes(".cal-config-add-task-btn"), "Must include .cal-config-add-task-btn in dashboard.css");
    assert.ok(dashboardCssContent.includes(".cal-config-mobile-cell"), "Must include .cal-config-mobile-cell in dashboard.css");
    assert.ok(dashboardCssContent.includes('[data-theme="light"] .crm-cal-day-btn'), "Must include light mode rules for mini-calendar");
  });

  test("6. Light mode WCAG AA / AAA contrast validation", () => {
    // Current-month date #0F172A on cell background #F1F5F9
    const currentDateContrast = getContrast("#0F172A", "#F1F5F9");
    assert.ok(currentDateContrast >= 7.0, `Current date contrast (${currentDateContrast.toFixed(2)}:1) should exceed WCAG AAA 7:1`);

    // Add task label #475569 on cell background #F1F5F9
    const addTaskContrast = getContrast("#475569", "#F1F5F9");
    assert.ok(addTaskContrast >= 4.5, `Add task contrast (${addTaskContrast.toFixed(2)}:1) should meet WCAG AA 4.5:1`);

    // Adjacent-month date #64748B on subtle background #F8FAFC
    const adjacentDateContrast = getContrast("#64748B", "#F8FAFC");
    assert.ok(adjacentDateContrast >= 4.5, `Adjacent date contrast (${adjacentDateContrast.toFixed(2)}:1) should meet WCAG AA 4.5:1`);

    // Weekday headers #0066FF on white #FFFFFF
    const weekdayContrast = getContrast("#0066FF", "#FFFFFF");
    assert.ok(weekdayContrast >= 4.5, `Weekday heading contrast (${weekdayContrast.toFixed(2)}:1) should meet WCAG AA 4.5:1`);
  });
});
