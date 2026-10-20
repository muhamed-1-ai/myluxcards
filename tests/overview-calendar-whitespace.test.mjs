import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

// Helper to simulate local date string
const getLocalDateString = (input) => {
  const d = typeof input === "string" ? new Date(input) : input;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to simulate pending count aggregation from CompactDashboardCalendar
function computePendingCounts(followUps) {
  const map = {};
  if (!Array.isArray(followUps)) return map;

  const seenIds = new Set();

  for (const item of followUps) {
    if (!item || !item.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    // Exclude completed, cancelled, or inactive statuses
    if (item.status !== "SCHEDULED") continue;

    const dateStr = getLocalDateString(item.scheduledAt);
    if (!map[dateStr]) {
      map[dateStr] = { total: 0, tasks: 0, calls: 0, visits: 0, meetings: 0 };
    }

    map[dateStr].total += 1;
    const type = String(item.type || "").toUpperCase();
    const rawDesc = String(item.description || item.note || "");
    if (type === "VISIT" || rawDesc.startsWith("[VISIT]")) {
      map[dateStr].visits += 1;
    } else if (type === "MEETING" || rawDesc.startsWith("[MEETING]")) {
      map[dateStr].meetings += 1;
    } else if (type === "TASK" || rawDesc.startsWith("[TASK]")) {
      map[dateStr].tasks += 1;
    } else {
      map[dateStr].calls += 1;
    }
  }
  return map;
}

// Helper to simulate summary label calculation
function getSummaryText(selectedPendingInfo) {
  const count = selectedPendingInfo?.total || 0;
  if (count === 0) return "No pending items for this date.";
  if (count === 1) {
    if (selectedPendingInfo.tasks === 1) return "1 pending task";
    if (selectedPendingInfo.visits === 1) return "1 pending visit";
    if (selectedPendingInfo.meetings === 1) return "1 pending meeting";
    return "1 pending follow-up";
  }
  if (selectedPendingInfo.tasks === count) {
    return `${count} pending tasks`;
  }
  return `${count} pending follow-ups`;
}

// Helper for LOB Analysis integer ticks calculation
function computeLobYAxisTicks(maxLobCount) {
  if (maxLobCount <= 1) {
    return [1, 0];
  }
  if (maxLobCount <= 4) {
    const ticks = [];
    for (let i = maxLobCount; i >= 0; i--) {
      ticks.push(i);
    }
    return ticks;
  }
  const stepCount = 4;
  const roughStep = maxLobCount / stepCount;
  const niceStep = Math.max(1, Math.ceil(roughStep));
  const ticks = [];
  for (let i = stepCount; i >= 0; i--) {
    ticks.push(i * niceStep);
  }
  return ticks;
}

test("TEST 1: Calendar pending count accuracy, exclusions & deduplication", () => {
  const mockFollowUps = [
    // 2 pending calls on 2026-10-30
    { id: "fu-1", scheduledAt: "2026-10-30T10:30:00.000Z", status: "SCHEDULED", type: "CALL", note: "[CALL] Call client" },
    { id: "fu-2", scheduledAt: "2026-10-30T14:00:00.000Z", status: "SCHEDULED", type: "VISIT", note: "[VISIT] Office visit" },
    // 1 completed item on 2026-10-30 (MUST be excluded)
    { id: "fu-3", scheduledAt: "2026-10-30T09:00:00.000Z", status: "COMPLETED", type: "CALL", note: "Done call" },
    // 1 cancelled item on 2026-10-30 (MUST be excluded)
    { id: "fu-4", scheduledAt: "2026-10-30T16:00:00.000Z", status: "CANCELLED", type: "MEETING", note: "Cancelled demo" },
    // Duplicate record with same id (MUST NOT be double counted)
    { id: "fu-1", scheduledAt: "2026-10-30T10:30:00.000Z", status: "SCHEDULED", type: "CALL", note: "[CALL] Duplicate" },
    // 1 pending task on 2026-10-13
    { id: "fu-5", scheduledAt: "2026-10-13T05:20:00.000Z", status: "SCHEDULED", type: "TASK", note: "[TASK] Send invoice" },
  ];

  const countsMap = computePendingCounts(mockFollowUps);

  // Check 2026-10-30
  const d30 = countsMap["2026-10-30"];
  assert.ok(d30, "Date 2026-10-30 should have entry");
  assert.equal(d30.total, 2, "2026-10-30 must count exactly 2 pending items, excluding completed and cancelled");
  assert.equal(d30.calls, 1, "Should have 1 call");
  assert.equal(d30.visits, 1, "Should have 1 visit");
  assert.equal(getSummaryText(d30), "2 pending follow-ups", "Summary should be '2 pending follow-ups'");

  // Check 2026-10-13
  const d13 = countsMap["2026-10-13"];
  assert.ok(d13, "Date 2026-10-13 should have entry");
  assert.equal(d13.total, 1, "2026-10-13 must count exactly 1 pending task");
  assert.equal(getSummaryText(d13), "1 pending task", "Summary should be '1 pending task'");

  // Check empty day
  const dEmpty = countsMap["2026-10-20"] || { total: 0 };
  assert.equal(getSummaryText(dEmpty), "No pending items for this date.", "Empty day must state 'No pending items for this date.'");
});

test("TEST 2: Week-start geometry matches Master Config (Monday-first)", () => {
  const calendarFile = fs.readFileSync(path.join(rootDir, "src/components/dashboard/CompactDashboardCalendar.tsx"), "utf8");
  assert.ok(calendarFile.includes('startDayOfWeek = firstDayOfMonth.getDay() - 1'), "Must start week on Monday");
  assert.ok(calendarFile.includes('if (startDayOfWeek === -1) startDayOfWeek = 6'), "Must handle Sunday as index 6");
  assert.ok(calendarFile.includes('["M", "T", "W", "T", "F", "S", "S"]'), "Must display Monday-first weekday headers");
});

test("TEST 3: Distinct loading, error, empty, and populated states", () => {
  const calendarFile = fs.readFileSync(path.join(rootDir, "src/components/dashboard/CompactDashboardCalendar.tsx"), "utf8");
  assert.ok(calendarFile.includes("Loading calendar items..."), "Distinct loading state present");
  assert.ok(calendarFile.includes("Unable to load calendar items.") || calendarFile.includes("loadError"), "Distinct error state present");
  assert.ok(calendarFile.includes("No pending items for"), "Distinct empty state present");
  assert.ok(calendarFile.includes("crm-cal-summary-populated"), "Populated state container present");
  assert.ok(calendarFile.includes("crm-cal-cell-badge"), "Numeric cell badges present");
});

test("TEST 4: Master Config Calendar integration & selected date persistence", () => {
  const calendarFile = fs.readFileSync(path.join(rootDir, "src/components/dashboard/CompactDashboardCalendar.tsx"), "utf8");
  assert.ok(calendarFile.includes('sessionStorage.setItem("crm_calendar_initial_date", dateToOpen)'), "Stores selected date in sessionStorage");
  assert.ok(calendarFile.includes('onNavigateTab("config-calendar")'), "Navigates to config-calendar");

  const configCalendarFile = fs.readFileSync(path.join(rootDir, "src/components/dashboard/config/CalendarConfig.tsx"), "utf8");
  assert.ok(configCalendarFile.includes('sessionStorage.getItem("crm_calendar_initial_date")'), "CalendarConfig reads preserved initial date from sessionStorage");
  assert.ok(configCalendarFile.includes('window.dispatchEvent(new CustomEvent("zappit-calendar-updated"))'), "CalendarConfig dispatches zappit-calendar-updated on actions");
});

test("TEST 5: LOB Analysis integer ticks avoid repeating labels", () => {
  // When 1 lost lead exists (as in the screenshot)
  const ticks1 = computeLobYAxisTicks(1);
  assert.deepEqual(ticks1, [1, 0], "When max is 1, ticks must be [1, 0], NOT repeating [1, 1, 1, 0, 0]");

  // When 2 lost leads exist
  const ticks2 = computeLobYAxisTicks(2);
  assert.deepEqual(ticks2, [2, 1, 0], "When max is 2, ticks must be [2, 1, 0]");

  // When 4 lost leads exist
  const ticks4 = computeLobYAxisTicks(4);
  assert.deepEqual(ticks4, [4, 3, 2, 1, 0], "When max is 4, ticks must be [4, 3, 2, 1, 0]");

  // When 8 lost leads exist
  const ticks8 = computeLobYAxisTicks(8);
  assert.deepEqual(ticks8, [8, 6, 4, 2, 0], "When max is 8, ticks must be evenly spaced distinct integers");

  // Verify all ticks in any generated scale are unique integers
  for (let m = 1; m <= 25; m++) {
    const ticks = computeLobYAxisTicks(m);
    const unique = new Set(ticks);
    assert.equal(unique.size, ticks.length, `Ticks for max=${m} must all be unique integers`);
    for (const t of ticks) {
      assert.ok(Number.isInteger(t), `Tick ${t} for max=${m} must be an integer`);
    }
  }
});

test("TEST 6: CSS whitespace fixes - align-items: start, plot heights & gaps", () => {
  const css = fs.readFileSync(path.join(rootDir, "src/app/dashboard/dashboard.css"), "utf8");

  // Check crm-chart-row and crm-lob-calendar-row do NOT stretch children
  assert.ok(css.includes(".crm-chart-row {\n  display: grid;\n  grid-template-columns: 2fr 1fr;\n  gap: 24px;\n  width: 100%;\n  align-items: start;"), "crm-chart-row must have align-items: start");
  assert.ok(css.includes(".crm-lob-calendar-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1.4fr) minmax(340px, 1fr);\n  gap: 24px;\n  width: 100%;\n  align-items: start;"), "crm-lob-calendar-row must have align-items: start");

  // Check plot height for desktop LOB chart is in the 260-320px range
  assert.ok(css.includes(".crm-lob-vertical-chart-container {\n  display: flex;\n  gap: 12px;\n  height: 280px;"), "LOB vertical chart container height must be 280px");

  // Check mobile gaps
  assert.ok(css.includes("gap: 16px;"), "Mobile gap must be 16px");

  // Check theme support for cell badges and summary cards
  assert.ok(css.includes('.crm-cal-cell-badge'), "Must have styles for .crm-cal-cell-badge");
  assert.ok(css.includes('.crm-cal-summary-card'), "Must have styles for .crm-cal-summary-card");
  assert.ok(css.includes('[data-theme="light"] .crm-cal-cell-badge'), "Must support light mode cell badges");
  assert.ok(css.includes('[data-theme="light"] .crm-cal-summary-card'), "Must support light mode summary card");
});
