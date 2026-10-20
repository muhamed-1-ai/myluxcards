import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse24to12, format12to24 } from "../src/lib/dateTime.ts";

const timePickerCode = readFileSync("src/components/ui/TimePicker.tsx", "utf8");
const datePickerCode = readFileSync("src/components/ui/DatePicker.tsx", "utf8");
const calendarConfigCode = readFileSync("src/components/dashboard/config/CalendarConfig.tsx", "utf8");

test("TEST 1: 12-hour / 24-hour conversion, noon, midnight, and arbitrary minutes", () => {
  // Midnight: 12:00 AM -> 00:00 and 00:00 -> 12:00 AM
  assert.deepEqual(parse24to12("00:00"), { hour: "12", minute: "00", period: "AM" });
  assert.equal(format12to24("12", "00", "AM"), "00:00");

  // Noon: 12:00 PM -> 12:00 and 12:00 -> 12:00 PM
  assert.deepEqual(parse24to12("12:00"), { hour: "12", minute: "00", period: "PM" });
  assert.equal(format12to24("12", "00", "PM"), "12:00");

  // Morning standard: 10:00 AM -> 10:00
  assert.deepEqual(parse24to12("10:00"), { hour: "10", minute: "00", period: "AM" });
  assert.equal(format12to24("10", "00", "AM"), "10:00");

  // Afternoon standard: 02:30 PM -> 14:30
  assert.deepEqual(parse24to12("14:30"), { hour: "02", minute: "30", period: "PM" });
  assert.equal(format12to24("02", "30", "PM"), "14:30");

  // Arbitrary unrounded minute: 10:03 AM -> 10:03 and 10:03 -> 10:03 AM
  assert.deepEqual(parse24to12("10:03"), { hour: "10", minute: "03", period: "AM" });
  assert.equal(format12to24("10", "03", "AM"), "10:03");

  // Evening late: 11:59 PM -> 23:59
  assert.deepEqual(parse24to12("23:59"), { hour: "11", minute: "59", period: "PM" });
  assert.equal(format12to24("11", "59", "PM"), "23:59");
});

test("TEST 2: TimePicker supports all 60 minutes and clean 3-part layout", () => {
  // Supports every valid minute
  assert.ok(timePickerCode.includes("ALL_MINUTES = Array.from({ length: 60 }"));
  assert.ok(timePickerCode.includes("TIME_PRESETS"));

  // Done button is type="button" to prevent accidental form submission
  assert.ok(timePickerCode.includes('type="button"'));
  assert.ok(timePickerCode.includes("handleDone"));
  assert.ok(timePickerCode.includes("Done"));

  // Structure contains Heading, Quick Presets, Hour, Minute, AM/PM
  assert.ok(timePickerCode.includes("SELECT TIME"));
  assert.ok(timePickerCode.includes("Quick Presets"));
  assert.ok(timePickerCode.includes("Hour"));
  assert.ok(timePickerCode.includes("Minute"));
  assert.ok(timePickerCode.includes("AM/PM"));

  // Uses createPortal to escape modal clipping
  assert.ok(timePickerCode.includes("createPortal("));
  assert.ok(timePickerCode.includes("document.body"));

  // Escape stops propagation and restores focus
  assert.ok(timePickerCode.includes('e.key === "Escape"'));
  assert.ok(timePickerCode.includes("e.stopPropagation()"));
  assert.ok(timePickerCode.includes("triggerRef.current?.focus()"));

  // Mutual exclusivity event
  assert.ok(timePickerCode.includes("zappit-picker-opened"));
});

test("TEST 3: DatePicker uses portal rendering, collision positioning, and preserves themes", () => {
  // Uses createPortal to escape modal clipping
  assert.ok(datePickerCode.includes("createPortal("));
  assert.ok(datePickerCode.includes("document.body"));

  // Dimensions & theme regression tokens
  assert.ok(datePickerCode.includes("h-[42px]"));
  assert.ok(datePickerCode.includes("rounded-[10px]"));
  assert.ok(datePickerCode.includes("crm-datepicker-trigger"));
  assert.ok(datePickerCode.includes("crm-filter-date"));
  assert.ok(datePickerCode.includes("crm-datepicker-popover"));

  // 7-column calendar grid
  assert.ok(datePickerCode.includes('WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'));

  // Escape stops propagation and restores focus
  assert.ok(datePickerCode.includes('e.key === "Escape"'));
  assert.ok(datePickerCode.includes("e.stopPropagation()"));
  assert.ok(datePickerCode.includes("triggerRef.current?.focus()"));

  // Mutual exclusivity event
  assert.ok(datePickerCode.includes("zappit-picker-opened"));
});

test("TEST 4: Schedule Follow-Up modal has bounded viewport height, internal scrolling, and proper spacing", () => {
  // Modal container: centered, max-width 640px, bounded height
  assert.ok(calendarConfigCode.includes("maxWidth: 640"));
  assert.ok(calendarConfigCode.includes('maxHeight: "calc(100dvh - 32px)"'));

  // Form body: scrollable with 20-24px gap between field groups
  assert.ok(calendarConfigCode.includes("gap: 22"));
  assert.ok(calendarConfigCode.includes('overflowY: "auto"'));

  // Field labels: 8px spacing
  assert.ok(calendarConfigCode.includes("marginBottom: 8"));

  // Control heights: 46px consistent height
  assert.ok(calendarConfigCode.includes("height: 46"));

  // Scheduled Date & Time: 16px gap, side by side with flex wrap
  assert.ok(calendarConfigCode.includes("gap: 16"));
  assert.ok(calendarConfigCode.includes("flexWrap: \"wrap\""));

  // Lead search results: comfortable padding and aligned badges
  assert.ok(calendarConfigCode.includes('padding: "10px 14px"'));
});
