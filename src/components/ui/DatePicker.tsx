"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, RotateCcw, ChevronDown } from "lucide-react";
import { parseSafeDate, toISODateString, formatDate } from "@/lib/dateTime";

export interface DatePickerProps {
  value?: string; // "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  placeholder?: string;
  minDate?: string; // "YYYY-MM-DD"
  maxDate?: string; // "YYYY-MM-DD"
  disabled?: boolean;
  className?: string;
  error?: boolean;
  label?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Standardized 3-letter weekday labels
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarCell {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  dateStr: string;
}

export function DatePicker({
  value = "",
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  disabled = false,
  className = "",
  error = false,
  label,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse currently selected date
  const selectedDate = parseSafeDate(value);

  // Internal state for currently viewed month & year in calendar popover
  const [viewDate, setViewDate] = useState<Date>(() => {
    return selectedDate || new Date();
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync viewDate to selected value when reopening popover or when value changes
  useEffect(() => {
    const parsed = parseSafeDate(value);
    if (parsed) {
      setViewDate(parsed);
    }
  }, [value]);

  // When opening popover, ensure viewDate shows month/year of selected value (or current date if empty)
  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      const parsed = parseSafeDate(value);
      setViewDate(parsed || new Date());
    }
    setIsOpen(!isOpen);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation for Escape & focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen]);

  // Month navigation (ONLY changes viewDate, DOES NOT change saved value)
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = Number(e.target.value);
    setViewDate(new Date(viewDate.getFullYear(), newMonth, 1));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = Number(e.target.value);
    setViewDate(new Date(newYear, viewDate.getMonth(), 1));
  };

  // Quick Today selection
  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const todayStr = toISODateString(today);
    setViewDate(today);
    onChange(todayStr);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Calculate days matrix for viewDate (336px to 360px wide 7-column grid)
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarCells: CalendarCell[] = [];

  // Previous month overflow cells
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const d = new Date(prevYear, prevMonth, prevDay);
    calendarCells.push({
      day: prevDay,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      dateStr: toISODateString(d),
    });
  }

  // Current month cells
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    calendarCells.push({
      day: i,
      month,
      year,
      isCurrentMonth: true,
      dateStr: toISODateString(d),
    });
  }

  // Next month overflow cells to complete 42 cells grid
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const d = new Date(nextYear, nextMonth, i);
    calendarCells.push({
      day: i,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
      dateStr: toISODateString(d),
    });
  }

  // Today reference
  const todayStr = toISODateString(new Date());

  const parsedMin = parseSafeDate(minDate);
  const parsedMax = parseSafeDate(maxDate);

  const handleCellClick = (cell: CalendarCell) => {
    if (disabled) return;
    const targetDate = new Date(cell.year, cell.month, cell.day);

    if (parsedMin && targetDate < new Date(parsedMin.getFullYear(), parsedMin.getMonth(), parsedMin.getDate())) {
      return;
    }
    if (parsedMax && targetDate > new Date(parsedMax.getFullYear(), parsedMax.getMonth(), parsedMax.getDate())) {
      return;
    }

    onChange(cell.dateStr);
    setViewDate(targetDate);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const displayFormatted = value ? formatDate(value) : "";

  // Year range options for quick dropdown
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 10; y <= currentYear + 10; y++) {
    yearOptions.push(y);
  }

  return (
    <div ref={containerRef} className={`relative inline-block w-full min-w-[200px] ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-300 dark:text-slate-200 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button / Input (Standard 44px height, dedicated right-hand space for clear/arrow) */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggleOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`w-full h-11 px-3.5 rounded-xl flex items-center justify-between gap-2 border text-left transition-all duration-150 text-sm cursor-pointer select-none outline-none ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-900/20 border-slate-800 text-slate-500"
            : error
            ? "border-rose-500/60 bg-rose-500/5 text-rose-300 ring-1 ring-rose-500/30"
            : isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/25 bg-[#071426] text-white"
            : "border-slate-800 dark:border-slate-700 bg-[#071426] text-white hover:border-slate-700 hover:bg-slate-900/80"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          <CalendarIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className={`truncate font-medium ${displayFormatted ? "text-white" : "text-slate-400"}`}>
            {displayFormatted || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
              title="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-emerald-400" : ""}`} />
        </div>
      </button>

      {/* Redesigned Calendar Dropdown Popover (336px-360px Desktop Width) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Calendar date picker"
          className="absolute left-0 mt-2 z-50 w-[336px] sm:w-[350px] p-4 rounded-2xl border border-slate-800 bg-[#0B172A] shadow-2xl shadow-black/90 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: "top left" }}
        >
          {/* Header: Month & Year Controls */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800/80 gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Quick Month & Year Selectors */}
            <div className="flex items-center gap-1.5">
              <select
                value={month}
                onChange={handleMonthChange}
                className="bg-slate-900/90 border border-slate-800 text-white text-xs font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-slate-700"
              >
                {MONTH_NAMES.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={handleYearChange}
                className="bg-slate-900/90 border border-slate-800 text-white text-xs font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:border-slate-700"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 7 Equal Weekday Columns: Sun, Mon, Tue, Wed, Thu, Fri, Sat */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {WEEKDAYS.map((dayName) => (
              <div key={dayName} className="text-[11px] font-bold text-slate-400 py-1 uppercase tracking-wider">
                {dayName}
              </div>
            ))}
          </div>

          {/* Date Grid (42 Cells) */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((cell, idx) => {
              const isSelected = value === cell.dateStr;
              const isToday = cell.dateStr === todayStr;

              let isDisabled = false;
              const cellDate = new Date(cell.year, cell.month, cell.day);
              if (parsedMin && cellDate < new Date(parsedMin.getFullYear(), parsedMin.getMonth(), parsedMin.getDate())) {
                isDisabled = true;
              }
              if (parsedMax && cellDate > new Date(parsedMax.getFullYear(), parsedMax.getMonth(), parsedMax.getDate())) {
                isDisabled = true;
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleCellClick(cell)}
                  className={`h-9 w-full rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer relative outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isSelected
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-md shadow-emerald-500/25 scale-105"
                      : isToday
                      ? "border border-emerald-500/70 text-emerald-400 bg-emerald-500/10 font-bold"
                      : !cell.isCurrentMonth
                      ? "text-slate-600 hover:text-slate-400 hover:bg-slate-900/30 opacity-40"
                      : isDisabled
                      ? "text-slate-700 cursor-not-allowed opacity-25"
                      : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  {cell.day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Today
            </button>

            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 font-semibold transition-all cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
