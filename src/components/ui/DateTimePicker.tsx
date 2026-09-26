"use client";

import React from "react";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";
import { parseSafeDate, toISODateString, toISOTimeString } from "@/lib/dateTime";

export interface DateTimePickerProps {
  value?: string; // ISO String or "YYYY-MM-DDTHH:mm"
  onChange: (isoString: string) => void;
  datePlaceholder?: string;
  timePlaceholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  label?: string;
}

export function DateTimePicker({
  value = "",
  onChange,
  datePlaceholder = "Select date",
  timePlaceholder = "10:00 AM",
  disabled = false,
  className = "",
  error = false,
  label,
}: DateTimePickerProps) {
  // Parse incoming value into date & time parts
  let datePart = "";
  let timePart = "10:00";

  if (value) {
    if (value.includes("T")) {
      const [d, t] = value.split("T");
      datePart = d;
      timePart = t ? t.slice(0, 5) : "10:00";
    } else if (value.includes(" ")) {
      const [d, t] = value.split(" ");
      datePart = d;
      timePart = t ? t.slice(0, 5) : "10:00";
    } else {
      datePart = value;
    }
  }

  const handleDateChange = (newDate: string) => {
    if (!newDate) {
      onChange("");
      return;
    }
    const d = new Date(`${newDate}T${timePart || "10:00"}:00`);
    if (!isNaN(d.getTime())) {
      onChange(d.toISOString());
    } else {
      onChange(`${newDate}T${timePart || "10:00"}:00`);
    }
  };

  const handleTimeChange = (newTime: string) => {
    const activeDate = datePart || toISODateString(new Date());
    const d = new Date(`${activeDate}T${newTime}:00`);
    if (!isNaN(d.getTime())) {
      onChange(d.toISOString());
    } else {
      onChange(`${activeDate}T${newTime}:00`);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-300 dark:text-slate-200 mb-1.5">
          {label}
        </label>
      )}

      {/* Grid container: Date (200-240px min) + Time (160-180px min) with 12px-16px gap, responsive flex-wrap */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[190px]">
          <DatePicker
            value={datePart}
            onChange={handleDateChange}
            placeholder={datePlaceholder}
            disabled={disabled}
            error={error}
          />
        </div>
        <div className="w-full sm:w-[170px] min-w-[150px]">
          <TimePicker
            value={timePart}
            onChange={handleTimeChange}
            placeholder={timePlaceholder}
            disabled={disabled}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
