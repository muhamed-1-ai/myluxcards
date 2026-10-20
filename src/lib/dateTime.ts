/**
 * Shared Human-Readable Date & Time Utilities for ZAPPIT
 * Guarantees safe parsing, zero timezone-shift for date-only strings,
 * and consistent formatting across the application.
 */

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

/**
 * Safely parse date input into Date object without timezone shift bugs for "YYYY-MM-DD" date-only strings.
 */
export function parseSafeDate(input?: Date | string | number | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();
  if (!str) return null;

  // Handles "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  // Handles ISO or other date strings
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format: "17 Sep 2026"
 */
export function formatDate(input?: Date | string | number | null, fallback = "—"): string {
  const d = parseSafeDate(input);
  if (!d) return fallback;
  const day = d.getDate();
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format: "Thu, 17 Sep 2026"
 */
export function formatDateWithWeekday(input?: Date | string | number | null, fallback = "—"): string {
  const d = parseSafeDate(input);
  if (!d) return fallback;
  const weekday = WEEKDAY_NAMES_SHORT[d.getDay()];
  const day = d.getDate();
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/**
 * Format 24-hr "HH:mm" or ISO timestamp -> 12-hr "10:00 AM" or "02:05 PM"
 * Guarantees zero truncation and single space before AM/PM.
 */
export function formatTime(input?: Date | string | null, fallback = "—"): string {
  if (!input) return fallback;

  if (typeof input === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(input.trim())) {
    const parts = input.trim().split(":");
    let h24 = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h24)) return fallback;

    const period = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    const h12Str = String(h12).padStart(2, "0");

    return `${h12Str}:${m} ${period}`;
  }

  const d = parseSafeDate(input);
  if (!d) return fallback;

  let h24 = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const h12Str = String(h12).padStart(2, "0");

  return `${h12Str}:${m} ${period}`;
}

/**
 * Format: "17 Sep 2026 · 10:00 AM"
 */
export function formatDateTime(input?: Date | string | number | null, fallback = "—"): string {
  const d = parseSafeDate(input);
  if (!d) return fallback;
  const datePart = formatDate(d);
  const timePart = formatTime(d);
  return `${datePart} · ${timePart}`;
}

/**
 * Format: "Thu, 17 Sep 2026 · 10:00 AM"
 */
export function formatDetailedDateTime(input?: Date | string | number | null, fallback = "—"): string {
  const d = parseSafeDate(input);
  if (!d) return fallback;
  const datePart = formatDateWithWeekday(d);
  const timePart = formatTime(d);
  return `${datePart} · ${timePart}`;
}

/**
 * Format Date to "YYYY-MM-DD"
 */
export function toISODateString(input?: Date | string | null): string {
  const d = parseSafeDate(input);
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format Date to "HH:mm" (24-hour)
 */
export function toISOTimeString(input?: Date | string | null): string {
  if (typeof input === "string" && /^\d{1,2}:\d{2}$/.test(input.trim())) {
    const [h, m] = input.trim().split(":");
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const d = parseSafeDate(input);
  if (!d) return "10:00";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Convert 24-hr "HH:mm" string -> 12-hr { hour, minute, period }
 */
export function parse24to12(time24Str?: string): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!time24Str || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time24Str.trim())) {
    return { hour: "10", minute: "00", period: "AM" };
  }

  const [hStr, mStr] = time24Str.trim().split(":");
  let h24 = parseInt(hStr, 10);
  if (isNaN(h24)) h24 = 10;

  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  let mVal = parseInt(mStr, 10);
  if (isNaN(mVal) || mVal < 0 || mVal > 59) mVal = 0;
  const minutePadded = String(mVal).padStart(2, "0");

  return {
    hour: String(h12).padStart(2, "0"),
    minute: minutePadded,
    period,
  };
}

/**
 * Convert 12-hr { hour, minute, period } -> 24-hr "HH:mm" string
 */
export function format12to24(hour: string, minute: string, period: "AM" | "PM"): string {
  let h12 = parseInt(hour, 10);
  if (isNaN(h12) || h12 < 1 || h12 > 12) h12 = 12;

  let h24 = h12;
  if (period === "PM" && h12 < 12) {
    h24 += 12;
  } else if (period === "AM" && h12 === 12) {
    h24 = 0; // Midnight = 12:00 AM = 00:00
  }

  const mClean = String(Math.min(59, Math.max(0, parseInt(minute, 10) || 0))).padStart(2, "0");
  return `${String(h24).padStart(2, "0")}:${mClean}`;
}
