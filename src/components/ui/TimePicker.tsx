"use client";

import React, { useState, useEffect, useRef } from "react";
import { Clock, ChevronDown, X, Check } from "lucide-react";

export interface TimePickerProps {
  value?: string; // "HH:mm" 24-hour format e.g. "10:00" or "14:30"
  onChange: (time24: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  label?: string;
}

const HOURS_12 = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const COMMON_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

// Convert 24-hr "HH:mm" string -> 12-hr { hour, minute, period }
function parse24to12(time24Str?: string): { hour: string; minute: string; period: "AM" | "PM" } {
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
  if (isNaN(mVal)) mVal = 0;
  const minutePadded = String(mVal).padStart(2, "0");

  return {
    hour: String(h12).padStart(2, "0"),
    minute: minutePadded,
    period,
  };
}

// Convert 12-hr { hour, minute, period } -> 24-hr "HH:mm" string
function format12to24(hour: string, minute: string, period: "AM" | "PM"): string {
  let h12 = parseInt(hour, 10);
  if (isNaN(h12)) h12 = 12;

  let h24 = h12;
  if (period === "PM" && h12 < 12) {
    h24 += 12;
  } else if (period === "AM" && h12 === 12) {
    h24 = 0;
  }

  const mClean = String(parseInt(minute, 10) || 0).padStart(2, "0");
  return `${String(h24).padStart(2, "0")}:${mClean}`;
}

export function TimePicker({
  value = "10:00",
  onChange,
  placeholder = "10:00 AM",
  disabled = false,
  className = "",
  error = false,
  label,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse internal 12-hr states
  const { hour: initHour, minute: initMinute, period: initPeriod } = parse24to12(value);
  const [selectedHour, setSelectedHour] = useState(initHour);
  const [selectedMinute, setSelectedMinute] = useState(initMinute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(initPeriod);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync internal states whenever external `value` changes (NEVER silently round exact minutes like 10:03!)
  useEffect(() => {
    const parsed = parse24to12(value);
    setSelectedHour(parsed.hour);
    setSelectedMinute(parsed.minute);
    setSelectedPeriod(parsed.period);
  }, [value]);

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

  // Keyboard navigation for Escape
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

  const handleHourSelect = (h: string) => {
    setSelectedHour(h);
    const new24 = format12to24(h, selectedMinute, selectedPeriod);
    onChange(new24);
  };

  const handleMinuteSelect = (m: string) => {
    setSelectedMinute(m);
    const new24 = format12to24(selectedHour, m, selectedPeriod);
    onChange(new24);
  };

  const handleCustomMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (raw.length > 2) raw = raw.slice(0, 2);
    let val = parseInt(raw, 10);
    if (isNaN(val)) val = 0;
    if (val > 59) val = 59;
    const mStr = String(val).padStart(2, "0");
    setSelectedMinute(mStr);
    const new24 = format12to24(selectedHour, mStr, selectedPeriod);
    onChange(new24);
  };

  const handlePeriodSelect = (p: "AM" | "PM") => {
    setSelectedPeriod(p);
    const new24 = format12to24(selectedHour, selectedMinute, p);
    onChange(new24);
  };

  const handlePresetSelect = (preset24: string) => {
    const parsed = parse24to12(preset24);
    setSelectedHour(parsed.hour);
    setSelectedMinute(parsed.minute);
    setSelectedPeriod(parsed.period);
    onChange(preset24);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  // Formatted display e.g. "10:00 AM" (No double colons or truncation)
  const displayFormatted = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;

  return (
    <div ref={containerRef} className={`relative inline-block w-full min-w-[160px] ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-300 dark:text-slate-200 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button / Input (Standard 44px height, full time display, dedicated arrow space) */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`w-full h-11 px-3.5 rounded-xl flex items-center justify-between gap-2 border text-left transition-all duration-150 text-sm cursor-pointer select-none outline-none ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-900/20 border-[#343740] text-slate-500"
            : error
            ? "border-rose-500/60 bg-rose-500/5 text-rose-300 ring-1 ring-rose-500/30"
            : isOpen
            ? "border-[#168BFF] ring-2 ring-[#168BFF]/25 bg-[#111216] text-[#F5F6F8]"
            : "border-[#343740] bg-[#111216] text-[#F5F6F8] hover:border-[#168BFF]/50 hover:bg-[#1B1C21]"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
          <Clock className="w-4 h-4 text-[#168BFF] flex-shrink-0" />
          <span className="truncate font-semibold text-[#F5F6F8] tracking-wide">
            {displayFormatted || placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-[#969CA8] transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180 text-[#168BFF]" : ""
          }`}
        />
      </button>

      {/* Redesigned Time Picker Dropdown Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Time picker"
          className="absolute right-0 sm:right-auto sm:left-0 mt-2 z-50 w-72 sm:w-80 p-4 rounded-2xl border border-[#343740] bg-[#23252C] shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: "top left" }}
        >
          {/* Header: Title & Selected Preview */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#343740]">
            <div>
              <div className="text-[11px] font-bold text-[#969CA8] uppercase tracking-wider">Select Time</div>
              <div className="text-base font-black text-[#F5F6F8] tracking-wide flex items-center gap-1.5 mt-0.5">
                <Clock className="w-4 h-4 text-[#168BFF]" />
                {displayFormatted}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-[#0967D2] hover:bg-[#075BBE] text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
          </div>

          {/* Quick Presets Row */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
            {[
              { label: "09:00 AM", value: "09:00" },
              { label: "10:00 AM", value: "10:00" },
              { label: "02:00 PM", value: "14:00" },
              { label: "05:00 PM", value: "17:00" },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetSelect(preset.value)}
                className="px-2.5 py-1 rounded-lg border border-[#343740] bg-[#141519] hover:border-[#168BFF] hover:bg-[#14263A] text-[#B5B8C2] hover:text-[#168BFF] text-[11px] font-semibold flex-shrink-0 transition-all cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* 2 Main Columns: Hour & Minute */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Hour Column */}
            <div>
              <div className="text-[10px] font-bold text-[#969CA8] uppercase tracking-wider text-center mb-1.5">
                Hour
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-[#343740]">
                {HOURS_12.map((h) => {
                  const isSelected = selectedHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourSelect(h)}
                      className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#0967D2] text-white shadow-sm scale-[1.02]"
                          : "bg-[#141519] text-[#B5B8C2] hover:bg-[#1B1C21] hover:text-[#F5F6F8] border border-[#343740]"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minute Column */}
            <div>
              <div className="text-[10px] font-bold text-[#969CA8] uppercase tracking-wider text-center mb-1.5">
                Minute
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-[#343740]">
                {COMMON_MINUTES.map((m) => {
                  const isSelected = selectedMinute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteSelect(m)}
                      className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#0967D2] text-white shadow-sm scale-[1.02]"
                          : "bg-[#141519] text-[#B5B8C2] hover:bg-[#1B1C21] hover:text-[#F5F6F8] border border-[#343740]"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Horizontal AM / PM Segmented Control Below Hour/Minute Columns */}
          <div className="pt-2 border-t border-[#343740]">
            <div className="text-[10px] font-bold text-[#969CA8] uppercase tracking-wider mb-1.5 text-center">
              Period
            </div>
            <div className="grid grid-cols-2 gap-2 bg-[#141519] p-1 rounded-xl border border-[#343740]">
              {(["AM", "PM"] as const).map((p) => {
                const isSelected = selectedPeriod === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePeriodSelect(p)}
                    className={`py-2 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#0967D2] text-white shadow-sm"
                        : "text-[#969CA8] hover:text-[#F5F6F8]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
