"use client";

import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
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
  const pickerId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  // Parse currently selected date
  const selectedDate = parseSafeDate(value);

  // Internal state for currently viewed month & year in calendar popover
  const [viewDate, setViewDate] = useState<Date>(() => {
    return selectedDate || new Date();
  });

  // Positioning coordinates for fixed portaled popover
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 336,
    maxHeight: 400,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync theme with document element and body
  useEffect(() => {
    const checkTheme = () => {
      const rootTheme = document.documentElement.getAttribute("data-theme");
      const hasLightClass =
        document.documentElement.classList.contains("light") ||
        document.documentElement.classList.contains("light-mode") ||
        document.body.classList.contains("light-mode");
      setIsLightMode(rootTheme === "light" || hasLightClass);
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  // Mount tracking for portal and responsive sheet
  useEffect(() => {
    setMounted(true);
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 480);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Sync viewDate to selected value when value changes
  useEffect(() => {
    const parsed = parseSafeDate(value);
    if (parsed) {
      setViewDate(parsed);
    }
  }, [value]);

  // Compute position with intelligent collision detection
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(336, window.innerWidth - 32);
    const popoverHeight = 370; // Standard calendar popover height
    const gap = 8;
    const padding = 16;

    // Vertical placement & flip logic
    const spaceBelow = window.innerHeight - rect.bottom - gap - padding;
    const spaceAbove = rect.top - gap - padding;

    let top: number;
    let availableHeight: number;

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      // Flip ABOVE trigger
      availableHeight = Math.min(popoverHeight, spaceAbove);
      top = Math.max(padding, rect.top - availableHeight - gap);
    } else {
      // Place BELOW trigger
      availableHeight = Math.min(popoverHeight, spaceBelow);
      top = rect.bottom + gap;
    }

    // Horizontal placement: Prefer aligning left edge to trigger's left edge
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - popoverWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: popoverWidth,
      maxHeight: Math.max(280, Math.round(availableHeight)),
    });
  }, [isMobile]);

  // When opening popover, ensure viewDate shows month/year of selected value
  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      const parsed = parseSafeDate(value);
      setViewDate(parsed || new Date());
      updatePosition();
      // Announce picker open to automatically close other open pickers
      window.dispatchEvent(new CustomEvent("zappit-picker-opened", { detail: { id: pickerId } }));
    }
    setIsOpen(!isOpen);
  };

  // Close when another picker opens
  useEffect(() => {
    const handleOtherPickerOpened = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id && customEvent.detail.id !== pickerId) {
        setIsOpen(false);
      }
    };

    window.addEventListener("zappit-picker-opened", handleOtherPickerOpened);
    return () => window.removeEventListener("zappit-picker-opened", handleOtherPickerOpened);
  }, [pickerId]);

  // Recalculate position on scroll or resize while open
  useEffect(() => {
    if (!isOpen || isMobile) return;

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updatePosition);
      window.visualViewport.addEventListener("scroll", updatePosition);
    }

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updatePosition);
        window.visualViewport.removeEventListener("scroll", updatePosition);
      }
    };
  }, [isOpen, isMobile, updatePosition]);

  // Outside click handling (checks both trigger and portaled popover)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
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

  // Calculate days matrix for viewDate
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

  // Calendar popover body
  const popoverContent = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Calendar date picker"
      className="crm-datepicker-popover"
      onClick={(e) => e.stopPropagation()}
      style={
        isMobile
          ? {
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 100000,
              maxHeight: "85dvh",
              colorScheme: isLightMode ? "light" : "dark",
              backgroundColor: isLightMode ? "#FFFFFF" : "#0B172A",
              borderTop: isLightMode ? "1px solid #E2E8F0" : "1px solid #1E293B",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              padding: "16px 20px calc(16px + env(safe-area-inset-bottom, 0px))",
              color: isLightMode ? "#0F172A" : "#FFFFFF",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            }
          : {
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 100000,
              colorScheme: isLightMode ? "light" : "dark",
              backgroundColor: isLightMode ? "#FFFFFF" : "#0B172A",
              borderColor: isLightMode ? "#E2E8F0" : "#1E293B",
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: "16px",
              boxShadow: isLightMode
                ? "0 18px 40px -4px rgba(0, 0, 0, 0.15), 0 0 1px 1px rgba(0, 0, 0, 0.06)"
                : "0 24px 50px -8px rgba(0, 0, 0, 0.8), 0 0 1px 1px #1E293B",
              display: "flex",
              flexDirection: "column",
              padding: "16px",
              color: isLightMode ? "#0F172A" : "#FFFFFF",
              overflow: "hidden",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            }
      }
    >
      {/* Mobile Handle */}
      {isMobile && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: isLightMode ? "#CBD5E1" : "#4A4D57",
            }}
          />
        </div>
      )}

      {/* Header: Month & Year Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: isLightMode ? "1px solid #E2E8F0" : "1px solid #1E293B",
          flexShrink: 0,
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handlePrevMonth}
          style={{
            padding: "8px",
            borderRadius: 10,
            border: isLightMode ? "1px solid #E2E8F0" : "1px solid #1E293B",
            backgroundColor: isLightMode ? "#F8FAFC" : "#142033",
            color: isLightMode ? "#475569" : "#B5B8C2",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Previous month"
        >
          <ChevronLeft style={{ width: 16, height: 16 }} />
        </button>

        {/* Quick Month & Year Selectors */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <select
            value={month}
            onChange={handleMonthChange}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 8,
              outline: "none",
              cursor: "pointer",
              border: isLightMode ? "1px solid #E2E8F0" : "1px solid #1E293B",
              backgroundColor: isLightMode ? "#F8FAFC" : "#142033",
              color: isLightMode ? "#0F172A" : "#FFFFFF",
              fontFamily: "inherit",
            }}
          >
            {MONTH_NAMES.map((mName, idx) => (
              <option
                key={mName}
                value={idx}
                style={{
                  backgroundColor: isLightMode ? "#FFFFFF" : "#0B172A",
                  color: isLightMode ? "#0F172A" : "#FFFFFF",
                }}
              >
                {mName}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={handleYearChange}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "6px 10px",
              borderRadius: 8,
              outline: "none",
              cursor: "pointer",
              border: isLightMode ? "1px solid #E2E8F0" : "1px solid #1E293B",
              backgroundColor: isLightMode ? "#F8FAFC" : "#142033",
              color: isLightMode ? "#0F172A" : "#FFFFFF",
              fontFamily: "inherit",
            }}
          >
            {yearOptions.map((y) => (
              <option
                key={y}
                value={y}
                style={{
                  backgroundColor: isLightMode ? "#FFFFFF" : "#0B172A",
                  color: isLightMode ? "#0F172A" : "#FFFFFF",
                }}
              >
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          style={{
            padding: "8px",
            borderRadius: 10,
            border: isLightMode ? "1px solid #E2E8F0" : "1px solid #1E293B",
            backgroundColor: isLightMode ? "#F8FAFC" : "#142033",
            color: isLightMode ? "#475569" : "#B5B8C2",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Next month"
        >
          <ChevronRight style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* 7 Equal Weekday Columns: Sun, Mon, Tue, Wed, Thu, Fri, Sat */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        {WEEKDAYS.map((dayName) => (
          <div
            key={dayName}
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "4px 0",
              color: isLightMode ? "#64748B" : "#94A3B8",
            }}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Date Grid (42 Cells) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          textAlign: "center",
          flex: 1,
          minHeight: 0,
        }}
      >
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

          let cellStyle: React.CSSProperties = {
            height: 36,
            width: "100%",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: isSelected ? 800 : isToday ? 700 : 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isDisabled ? "not-allowed" : "pointer",
            position: "relative",
            border: "none",
            outline: "none",
            transition: "all 0.15s ease",
          };

          if (isSelected) {
            cellStyle.backgroundColor = "#0967D2";
            cellStyle.color = "#FFFFFF";
            cellStyle.boxShadow = "0 2px 8px rgba(9, 103, 210, 0.4)";
          } else if (isToday) {
            cellStyle.border = isLightMode ? "1px solid #0066FF" : "1px solid #38BDF8";
            cellStyle.color = isLightMode ? "#0066FF" : "#38BDF8";
            cellStyle.backgroundColor = isLightMode ? "rgba(0, 102, 255, 0.08)" : "#14263A";
          } else if (!cell.isCurrentMonth) {
            cellStyle.color = isLightMode ? "#94A3B8" : "#969CA8";
            cellStyle.opacity = 0.4;
            cellStyle.backgroundColor = "transparent";
          } else if (isDisabled) {
            cellStyle.color = isLightMode ? "#CBD5E1" : "#4A4D57";
            cellStyle.opacity = 0.3;
            cellStyle.backgroundColor = "transparent";
          } else {
            cellStyle.color = isLightMode ? "#0F172A" : "#FFFFFF";
            cellStyle.backgroundColor = isLightMode ? "#F8FAFC" : "#142033";
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isDisabled}
              onClick={() => handleCellClick(cell)}
              style={cellStyle}
            >
              {cell.day}
              {isToday && !isSelected && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 3,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: isLightMode ? "#0066FF" : "#38BDF8",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: isLightMode ? "1px solid #E2E8F0" : "1px solid #1E293B",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleSelectToday}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            backgroundColor: isLightMode ? "rgba(0, 102, 255, 0.1)" : "#14263A",
            color: isLightMode ? "#0066FF" : "#38BDF8",
          }}
        >
          <RotateCcw style={{ width: 14, height: 14 }} />
          Today
        </button>

        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 12,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: isLightMode ? "#64748B" : "#94A3B8",
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative inline-block w-full min-w-[180px] ${className}`}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: isLightMode ? "#475569" : "#CBD5E1",
            marginBottom: 8,
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger Button / Input (Standard 44px-48px height matching adjacent inputs) */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggleOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`crm-datepicker-trigger crm-filter-date w-full h-[42px] px-3 rounded-[10px] flex items-center justify-between gap-2 border text-left transition-all duration-150 text-xs font-semibold cursor-pointer select-none outline-none ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#111216]/50 border-slate-300 dark:border-[#343740] text-slate-400 dark:text-[#969CA8]"
            : error
            ? "border-rose-500/60 bg-rose-50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/30"
            : isOpen
            ? "border-[#168BFF] ring-2 ring-[#168BFF]/20"
            : "border-[#CBD5E1] dark:border-[#343740]"
        }`}
        style={{
          height: 46,
          backgroundColor: isLightMode ? "#FFFFFF" : "#071426",
          borderColor: isOpen ? "#168BFF" : isLightMode ? "#CBD5E1" : "#343740",
          color: isLightMode ? "#0F172A" : "#FFFFFF",
          boxShadow: isOpen
            ? isLightMode
              ? "0 0 0 2px rgba(0, 102, 255, 0.15)"
              : "0 0 0 2px rgba(22, 139, 255, 0.25)"
            : "none",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          <CalendarIcon
            className="w-4 h-4 flex-shrink-0 transition-colors"
            style={{ color: isLightMode ? "#0066FF" : "#38BDF8" }}
          />
          <span
            className="truncate font-semibold text-xs"
            style={{
              color: displayFormatted
                ? isLightMode
                  ? "#0F172A"
                  : "#FFFFFF"
                : isLightMode
                ? "#94A3B8"
                : "#969CA8",
            }}
          >
            {displayFormatted || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 rounded-md transition-colors"
              style={{
                color: isLightMode ? "#64748B" : "#969CA8",
              }}
              title="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            style={{
              color: isOpen
                ? isLightMode
                  ? "#0066FF"
                  : "#38BDF8"
                : isLightMode
                ? "#64748B"
                : "#969CA8",
            }}
          />
        </div>
      </button>

      {/* Render via Portal to body to prevent ANY container clipping */}
      {isOpen &&
        mounted &&
        createPortal(
          isMobile ? (
            <>
              {/* Dimmed mobile backdrop */}
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 99999,
                  backgroundColor: "rgba(0, 0, 0, 0.65)",
                  backdropFilter: "blur(4px)",
                }}
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
              />
              {popoverContent}
            </>
          ) : (
            popoverContent
          ),
          document.body
        )}
    </div>
  );
}
