"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ArrowUpRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

import type { FollowUpItem } from "@/lib/crm";

interface CompactDashboardCalendarProps {
  onNavigateTab?: (tab: string) => void;
  todaysFollowUps?: FollowUpItem[];
  refreshTrigger?: any;
}

const getLocalDateString = (input: Date | string): string => {
  const d = typeof input === "string" ? new Date(input) : input;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function CompactDashboardCalendar({
  onNavigateTab,
  refreshTrigger,
}: CompactDashboardCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  const yearMonth = useMemo(
    () => `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`,
    [currentDate]
  );

  // Fetch authoritative calendar data from Master Config Calendar endpoint
  const fetchCalendarData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/dashboard/crm-calendar?month=${yearMonth}&ownership=MY`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.followUps)) {
        setFollowUps(data.followUps);
      } else if (!res.ok) {
        setLoadError(data.message || "Failed to load calendar data.");
      } else {
        setFollowUps([]);
      }
    } catch (err: any) {
      console.error("[Compact Calendar] Error loading data:", err);
      setLoadError("Unable to load calendar items.");
    } finally {
      setIsLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    void fetchCalendarData();
  }, [fetchCalendarData, refreshTrigger]);

  // Listen for real-time calendar updates across the app (schedule, complete, cancel, snooze, reschedule)
  useEffect(() => {
    const handleCalendarUpdated = () => {
      void fetchCalendarData();
    };
    window.addEventListener("zappit-calendar-updated", handleCalendarUpdated);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "zappit_last_reminder_action") {
        void fetchCalendarData();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("zappit-calendar-updated", handleCalendarUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchCalendarData]);

  // Aggregate pending items by local date
  // Rules:
  // 1. Only count actual scheduled items (status === "SCHEDULED").
  // 2. Exclude COMPLETED and CANCELLED according to existing rules.
  // 3. Group by user's configured local timezone.
  // 4. Prevent double counting via unique ID tracking.
  const pendingByDate = useMemo(() => {
    const map: Record<string, { total: number; tasks: number; calls: number; visits: number; meetings: number }> = {};
    if (!Array.isArray(followUps)) return map;

    const seenIds = new Set<string>();

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
  }, [followUps]);

  // Navigation handlers
  const prevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(getLocalDateString(now));
  };

  const handleOpenFullCalendar = (targetDate?: string) => {
    const dateToOpen = targetDate || selectedDateStr;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("crm_calendar_initial_date", dateToOpen);
    }
    if (onNavigateTab) {
      onNavigateTab("config-calendar");
    }
  };

  // Month grid geometry (Monday start, matching Master Config)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("en-US", { month: "long" });

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday fix for Monday-first week

  const selectedFormatted = useMemo(() => {
    if (!selectedDateStr) return "";
    const [y, m, d] = selectedDateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) return selectedDateStr;
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [selectedDateStr]);

  const selectedPendingInfo = pendingByDate[selectedDateStr] || { total: 0, tasks: 0, calls: 0, visits: 0, meetings: 0 };
  const selectedPendingCount = selectedPendingInfo.total;

  const summaryText = useMemo(() => {
    if (selectedPendingCount === 0) {
      return "No pending items for this date.";
    }
    if (selectedPendingCount === 1) {
      if (selectedPendingInfo.tasks === 1) return "1 pending task";
      if (selectedPendingInfo.visits === 1) return "1 pending visit";
      if (selectedPendingInfo.meetings === 1) return "1 pending meeting";
      return "1 pending follow-up";
    }
    if (selectedPendingInfo.tasks === selectedPendingCount) {
      return `${selectedPendingCount} pending tasks`;
    }
    return `${selectedPendingCount} pending follow-ups`;
  }, [selectedPendingCount, selectedPendingInfo]);

  return (
    <div className="crm-compact-calendar-container">
      {/* 1. Header Row */}
      <div className="crm-cal-header-row">
        <div className="crm-cal-title-wrap">
          <CalendarIcon className="crm-cal-header-icon" />
          <div>
            <h3 className="crm-cal-card-title">Calendar</h3>
            <span className="crm-cal-card-month">{monthName} {year}</span>
          </div>
        </div>

        <div className="crm-cal-nav-group">
          <button
            type="button"
            onClick={goToToday}
            className="crm-cal-today-btn"
            title="Jump to Today"
          >
            Today
          </button>
          <div className="crm-cal-arrows">
            <button type="button" onClick={prevMonth} className="crm-cal-arrow-btn" aria-label="Previous Month">
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>
            <button type="button" onClick={nextMonth} className="crm-cal-arrow-btn" aria-label="Next Month">
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      </div>

      <div className="crm-divider" style={{ margin: "14px 0" }} />

      {/* 2. 7-Column Weekday Header (Monday start matching Master Config) */}
      <div className="crm-cal-weekdays-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((dayLabel, idx) => (
          <div key={`wd-${idx}`} className="crm-cal-weekday-cell">
            {dayLabel}
          </div>
        ))}
      </div>

      {/* 3. Month Days Grid */}
      <div className="crm-cal-days-grid">
        {/* Blank Padding Days for Monday-start */}
        {Array.from({ length: startDayOfWeek }).map((_, idx) => (
          <div key={`blank-${idx}`} className="crm-cal-day-blank" />
        ))}

        {/* Days of Month */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const isToday = dStr === todayStr;
          const isSelected = dStr === selectedDateStr;
          const pendingCount = pendingByDate[dStr]?.total || 0;

          return (
            <button
              key={`day-${dStr}`}
              type="button"
              aria-label={`Day ${dayNum}${isToday ? ", today" : ""}${pendingCount > 0 ? `, ${pendingCount} pending items` : ""}`}
              onClick={() => {
                if (isSelected && pendingCount > 0) {
                  handleOpenFullCalendar(dStr);
                } else {
                  setSelectedDateStr(dStr);
                }
              }}
              className={`crm-cal-day-btn ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
            >
              <span className="crm-cal-day-text">{dayNum}</span>
              {pendingCount > 0 && (
                <span
                  className={`crm-cal-cell-badge ${isSelected ? "is-selected" : ""}`}
                  title={`${pendingCount} pending item${pendingCount > 1 ? "s" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDateStr(dStr);
                    handleOpenFullCalendar(dStr);
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="crm-divider" style={{ margin: "16px 0 14px" }} />

      {/* 4. Compact Selected Day Summary Section */}
      <div className="crm-cal-summary-card">
        {isLoading ? (
          <div className="crm-cal-summary-state">
            <Loader2 className="crm-cal-summary-spinner" style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
            <span>Loading calendar items...</span>
          </div>
        ) : loadError ? (
          <div className="crm-cal-summary-state is-error">
            <AlertCircle style={{ width: 16, height: 16, color: "#EF4444", flexShrink: 0 }} />
            <span style={{ color: "#EF4444", fontSize: 12 }}>{loadError}</span>
            <button
              type="button"
              onClick={() => void fetchCalendarData()}
              className="crm-cal-summary-retry-btn"
            >
              Retry
            </button>
          </div>
        ) : selectedPendingCount === 0 ? (
          <div className="crm-cal-summary-state is-empty">
            <CheckCircle2 style={{ width: 16, height: 16, color: "#168BFF", flexShrink: 0 }} />
            <span className="crm-cal-summary-empty-text">No pending items for {selectedFormatted}.</span>
          </div>
        ) : (
          <div
            className="crm-cal-summary-populated"
            role="button"
            tabIndex={0}
            onClick={() => handleOpenFullCalendar()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpenFullCalendar();
              }
            }}
            title="Open in Master Config Calendar"
          >
            <div className="crm-cal-summary-details">
              <span className="crm-cal-summary-count-badge">
                {selectedPendingCount}
              </span>
              <div className="crm-cal-summary-text-wrap">
                <span className="crm-cal-summary-main-text">
                  {summaryText}
                </span>
                <span className="crm-cal-summary-date-sub">
                  for {selectedFormatted}
                </span>
              </div>
            </div>
            <ArrowUpRight className="crm-cal-summary-arrow" style={{ width: 15, height: 15, color: "#168BFF" }} />
          </div>
        )}
      </div>

      {/* 5. View Full Calendar Link Button */}
      <button
        type="button"
        onClick={() => handleOpenFullCalendar()}
        className="crm-cal-view-full-btn"
      >
        <CalendarIcon style={{ width: 14, height: 14 }} />
        <span>View Full Calendar</span>
        <ArrowUpRight style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
