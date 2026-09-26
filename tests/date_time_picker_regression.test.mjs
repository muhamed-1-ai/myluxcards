import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSafeDate,
  formatDate,
  formatDateWithWeekday,
  formatTime,
  formatDateTime,
  formatDetailedDateTime,
  toISODateString,
  toISOTimeString,
} from "../src/lib/dateTime.ts";

test("dateTime: parseSafeDate handles YYYY-MM-DD without timezone offset", () => {
  const d = parseSafeDate("2026-09-25");
  assert.notEqual(d, null);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8); // Sept is 8 (0-indexed)
  assert.equal(d.getDate(), 25);
});

test("dateTime: formatDate displays 17 Sep 2026", () => {
  const formatted = formatDate("2026-09-17");
  assert.equal(formatted, "17 Sep 2026");
});

test("dateTime: formatDateWithWeekday displays Thu, 17 Sep 2026", () => {
  const formatted = formatDateWithWeekday("2026-09-17");
  assert.equal(formatted, "Thu, 17 Sep 2026");
});

test("dateTime: formatTime converts 24-hr to 12-hr with AM/PM and no truncation", () => {
  assert.equal(formatTime("10:00"), "10:00 AM");
  assert.equal(formatTime("14:30"), "02:30 PM");
  assert.equal(formatTime("00:00"), "12:00 AM"); // Midnight
  assert.equal(formatTime("12:00"), "12:00 PM"); // Noon
  assert.equal(formatTime("10:03"), "10:03 AM"); // Arbitrary non-rounded minute
});

test("dateTime: formatDateTime & formatDetailedDateTime output standardized strings", () => {
  const dt = formatDateTime("2026-09-17T10:00:00");
  assert.equal(dt, "17 Sep 2026 · 10:00 AM");

  const detailed = formatDetailedDateTime("2026-09-17T14:30:00");
  assert.equal(detailed, "Thu, 17 Sep 2026 · 02:30 PM");
});

test("dateTime: handles null/empty/invalid input gracefully with fallback", () => {
  assert.equal(formatDate(null), "—");
  assert.equal(formatTime("invalid"), "—");
  assert.equal(formatDateTime(""), "—");
});
