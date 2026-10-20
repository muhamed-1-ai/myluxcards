"use client";

import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { Clock, ChevronDown, Check, X } from "lucide-react";

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

// All 60 minutes supported so any arbitrary minute can be selected or viewed
const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Quick time presets
const TIME_PRESETS = [
  { label: "09:00 AM", value: "09:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "02:00 PM", value: "14:00" },
  { label: "05:00 PM", value: "17:00" },
];

import { parse24to12, format12to24 } from "@/lib/dateTime";
export { parse24to12, format12to24 };

export function TimePicker({
  value = "10:00",
  onChange,
  placeholder = "10:00 AM",
  disabled = false,
  className = "",
  error = false,
  label,
}: TimePickerProps) {
  const pickerId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  // Parse internal 12-hr states
  const { hour: initHour, minute: initMinute, period: initPeriod } = parse24to12(value);
  const [selectedHour, setSelectedHour] = useState(initHour);
  const [selectedMinute, setSelectedMinute] = useState(initMinute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(initPeriod);

  // Positioning coordinates for fixed portaled popover
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 320,
    maxHeight: 380,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // Sync internal states whenever external `value` changes
  useEffect(() => {
    const parsed = parse24to12(value);
    setSelectedHour(parsed.hour);
    setSelectedMinute(parsed.minute);
    setSelectedPeriod(parsed.period);
  }, [value]);

  // Mount tracking for portal
  useEffect(() => {
    setMounted(true);
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 480);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

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

  // Compute position with intelligent collision detection
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(320, window.innerWidth - 32);
    const popoverHeight = 360; // Estimated height for collision checks
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

    // Horizontal placement: Prefer aligning right edge to trigger's right edge
    let left = rect.right - popoverWidth;
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
      maxHeight: Math.max(260, Math.round(availableHeight)),
    });
  }, [isMobile]);

  // Handle open toggle and mutual exclusivity
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
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

  // Escape key handling
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

  // Scroll active hour and minute into view when popover opens
  useEffect(() => {
    if (!isOpen) return;

    const scrollSelected = () => {
      if (hourListRef.current) {
        const activeHourBtn = hourListRef.current.querySelector('[data-selected="true"]');
        if (activeHourBtn) {
          (activeHourBtn as HTMLElement).scrollIntoView({ block: "nearest" });
        }
      }
      if (minuteListRef.current) {
        const activeMinuteBtn = minuteListRef.current.querySelector('[data-selected="true"]');
        if (activeMinuteBtn) {
          (activeMinuteBtn as HTMLElement).scrollIntoView({ block: "nearest" });
        }
      }
    };

    // Timeout ensures DOM layout is computed
    const t = setTimeout(scrollSelected, 30);
    return () => clearTimeout(t);
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
  };

  const handleDone = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const displayFormatted = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;

  // Popover panel content
  const popoverContent = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Time picker"
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
              backgroundColor: isLightMode ? "#FFFFFF" : "#1B1C21",
              borderTop: isLightMode ? "1px solid #CBD5E1" : "1px solid #343740",
              borderRadius: "20px 20px 0 0",
              boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              padding: "16px 20px calc(16px + env(safe-area-inset-bottom, 0px))",
              color: isLightMode ? "#0F172A" : "#F5F6F8",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            }
          : {
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 100000,
              backgroundColor: isLightMode ? "#FFFFFF" : "#1B1C21",
              border: isLightMode ? "1px solid #CBD5E1" : "1px solid #343740",
              borderRadius: "16px",
              boxShadow: isLightMode
                ? "0 18px 40px -4px rgba(0, 0, 0, 0.15), 0 0 1px 1px rgba(0, 0, 0, 0.06)"
                : "0 24px 50px -8px rgba(0, 0, 0, 0.8), 0 0 1px 1px #343740",
              display: "flex",
              flexDirection: "column",
              padding: "16px",
              color: isLightMode ? "#0F172A" : "#F5F6F8",
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

      {/* 1. Header: Subtitle, Large Formatted Time, and Prominent Done Button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: isLightMode ? "1px solid #E2E8F0" : "1px solid #343740",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: isLightMode ? "#0066FF" : "#168BFF",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            SELECT TIME
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: isLightMode ? "#0F172A" : "#F5F6F8",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Clock style={{ width: 17, height: 17, color: isLightMode ? "#0066FF" : "#168BFF" }} />
            <span>{displayFormatted}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDone}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            borderRadius: 10,
            background: isLightMode ? "#0066FF" : "#0967D2",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0, 102, 255, 0.3)",
          }}
        >
          <Check style={{ width: 15, height: 15 }} />
          <span>Done</span>
        </button>
      </div>

      {/* 2. Quick-Time Presets in a Wrapping Grid (never overflows) */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: isLightMode ? "#64748B" : "#969CA8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          Quick Presets
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
          }}
        >
          {TIME_PRESETS.map((preset) => {
            const isPresetActive = value === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePresetSelect(preset.value)}
                style={{
                  padding: "6px 2px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  border: isPresetActive
                    ? isLightMode
                      ? "1px solid #0066FF"
                      : "1px solid #168BFF"
                    : isLightMode
                    ? "1px solid #E2E8F0"
                    : "1px solid #343740",
                  backgroundColor: isPresetActive
                    ? isLightMode
                      ? "rgba(0, 102, 255, 0.1)"
                      : "#14263A"
                    : isLightMode
                    ? "#F8FAFC"
                    : "#141519",
                  color: isPresetActive
                    ? isLightMode
                      ? "#0066FF"
                      : "#168BFF"
                    : isLightMode
                    ? "#475569"
                    : "#B5B8C2",
                  cursor: "pointer",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Labeled Hour, Minute, and AM/PM Controls */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 64px",
          gap: 8,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Hour Column */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: isLightMode ? "#64748B" : "#969CA8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Hour
          </div>
          <div
            ref={hourListRef}
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: 4,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: isMobile ? 180 : 150,
            }}
          >
            {HOURS_12.map((h) => {
              const isSelected = selectedHour === h;
              return (
                <button
                  key={h}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleHourSelect(h)}
                  style={{
                    padding: "7px 4px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isSelected ? 800 : 600,
                    backgroundColor: isSelected
                      ? isLightMode
                        ? "#0066FF"
                        : "#0967D2"
                      : isLightMode
                      ? "#F8FAFC"
                      : "#141519",
                    color: isSelected ? "#FFFFFF" : isLightMode ? "#0F172A" : "#F5F6F8",
                    border: isSelected
                      ? "none"
                      : isLightMode
                      ? "1px solid #E2E8F0"
                      : "1px solid #343740",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        {/* Minute Column (All 60 minutes supported) */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: isLightMode ? "#64748B" : "#969CA8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Minute
          </div>
          <div
            ref={minuteListRef}
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: 4,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: isMobile ? 180 : 150,
            }}
          >
            {ALL_MINUTES.map((m) => {
              const isSelected = selectedMinute === m;
              return (
                <button
                  key={m}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => handleMinuteSelect(m)}
                  style={{
                    padding: "7px 4px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isSelected ? 800 : 600,
                    backgroundColor: isSelected
                      ? isLightMode
                        ? "#0066FF"
                        : "#0967D2"
                      : isLightMode
                      ? "#F8FAFC"
                      : "#141519",
                    color: isSelected ? "#FFFFFF" : isLightMode ? "#0F172A" : "#F5F6F8",
                    border: isSelected
                      ? "none"
                      : isLightMode
                      ? "1px solid #E2E8F0"
                      : "1px solid #343740",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        {/* AM / PM Segmented Controls */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: isLightMode ? "#64748B" : "#969CA8",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            AM/PM
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(["AM", "PM"] as const).map((p) => {
              const isSelected = selectedPeriod === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodSelect(p)}
                  style={{
                    padding: "10px 4px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isSelected ? 800 : 700,
                    backgroundColor: isSelected
                      ? isLightMode
                        ? "#0066FF"
                        : "#0967D2"
                      : isLightMode
                      ? "#F8FAFC"
                      : "#141519",
                    color: isSelected ? "#FFFFFF" : isLightMode ? "#64748B" : "#969CA8",
                    border: isSelected
                      ? "none"
                      : isLightMode
                      ? "1px solid #E2E8F0"
                      : "1px solid #343740",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative inline-block w-full min-w-[150px] ${className}`}>
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

      {/* Trigger Button (Standard 44px-48px height matching adjacent inputs) */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          height: 46,
          padding: "0 14px",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          border: isOpen
            ? isLightMode
              ? "1px solid #0066FF"
              : "1px solid #168BFF"
            : error
            ? "1px solid rgba(239, 68, 68, 0.6)"
            : isLightMode
            ? "1px solid #CBD5E1"
            : "1px solid #343740",
          backgroundColor: isLightMode ? "#FFFFFF" : "#111216",
          color: isLightMode ? "#0F172A" : "#F5F6F8",
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          boxShadow: isOpen
            ? isLightMode
              ? "0 0 0 2px rgba(0, 102, 255, 0.15)"
              : "0 0 0 2px rgba(22, 139, 255, 0.25)"
            : "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <Clock
            style={{
              width: 16,
              height: 16,
              color: isLightMode ? "#0066FF" : "#168BFF",
              flexShrink: 0,
            }}
          />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayFormatted || placeholder}
          </span>
        </div>

        <ChevronDown
          style={{
            width: 16,
            height: 16,
            color: isLightMode ? "#64748B" : "#969CA8",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
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
