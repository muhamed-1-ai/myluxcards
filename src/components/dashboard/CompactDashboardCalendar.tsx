"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

import type { FollowUpItem } from "@/lib/crm";

interface CompactDashboardCalendarProps {
  onNavigateTab?: (tab: string) => void;
  todaysFollowUps?: FollowUpItem[];
}

export function CompactDashboardCalendar({
  onNavigateTab,
  todaysFollowUps = [],
}: CompactDashboardCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  const [monthEvents, setMonthEvents] = useState<Record<string, number>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [dayAgenda, setDayAgenda] = useState<FollowUpItem[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  const yearMonth = useMemo(
    () => `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`,
    [currentDate]
  );

  // Fetch month activity counts
  useEffect(() => {
    let active = true;
    const fetchMonthData = async () => {
      setLoadingMonth(true);
      try {
        const res = await fetch(`/api/dashboard/crm-calendar?month=${yearMonth}`);
        const data = await res.json().catch(() => ({}));
        if (active && res.ok && data.eventsByDate) {
          const countsMap: Record<string, number> = {};
          Object.entries(data.eventsByDate).forEach(([dStr, evts]: [string, any]) => {
            if (typeof evts === "object" && evts !== null) {
              const total = Object.values(evts as Record<string, number>).reduce((a, b) => a + b, 0);
              countsMap[dStr] = total;
            }
          });
          setMonthEvents(countsMap);
        }
      } catch (err) {
        console.error("Failed to load compact calendar month events:", err);
      } finally {
        if (active) setLoadingMonth(false);
      }
    };
    void fetchMonthData();
    return () => {
      active = false;
    };
  }, [yearMonth]);

  // Fetch agenda items when selected date changes
  useEffect(() => {
    if (!selectedDateStr) return;
    let active = true;
    const fetchAgenda = async () => {
      setLoadingAgenda(true);
      try {
        const res = await fetch(`/api/dashboard/crm-calendar?month=${yearMonth}&date=${selectedDateStr}`);
        const data = await res.json().catch(() => ({}));
        if (active && res.ok && Array.isArray(data.dayDetails)) {
          const mapped: FollowUpItem[] = data.dayDetails.map((item: any) => ({
            id: item.id || `evt-${Math.random()}`,
            leadId: item.leadId,
            leadName: item.leadName || "Lead Contact",
            scheduledAt: item.occurredAt || item.scheduledAt || selectedDateStr,
            note: item.description || item.note || item.type?.replace(/_/g, " "),
            type: item.type,
            status: item.status || "SCHEDULED",
          }));
          setDayAgenda(mapped);
        } else if (active && selectedDateStr === todayStr && todaysFollowUps.length > 0) {
          setDayAgenda(todaysFollowUps);
        } else if (active) {
          setDayAgenda([]);
        }
      } catch {
        if (active && selectedDateStr === todayStr && todaysFollowUps.length > 0) {
          setDayAgenda(todaysFollowUps);
        } else if (active) {
          setDayAgenda([]);
        }
      } finally {
        if (active) setLoadingAgenda(false);
      }
    };
    void fetchAgenda();
    return () => {
      active = false;
    };
  }, [selectedDateStr, yearMonth, todayStr, todaysFollowUps]);

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
    setSelectedDateStr(now.toISOString().slice(0, 10));
  };

  // Month grid geometry
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("en-US", { month: "long" });

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const selectedFormatted = useMemo(() => {
    if (!selectedDateStr) return "";
    const d = new Date(selectedDateStr);
    if (isNaN(d.getTime())) return selectedDateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [selectedDateStr]);

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

      {/* 2. 7-Column Weekday Header */}
      <div className="crm-cal-weekdays-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, idx) => (
          <div key={`wd-${idx}`} className="crm-cal-weekday-cell">
            {dayLabel}
          </div>
        ))}
      </div>

      {/* 3. Month Days Grid */}
      <div className="crm-cal-days-grid">
        {/* Blank Padding Days */}
        {Array.from({ length: firstDayIndex }).map((_, idx) => (
          <div key={`blank-${idx}`} className="crm-cal-day-blank" />
        ))}

        {/* Days of Month */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const isToday = dStr === todayStr;
          const isSelected = dStr === selectedDateStr;
          const eventCount = monthEvents[dStr] || 0;

          return (
            <button
              key={`day-${dStr}`}
              type="button"
              aria-label={`Day ${dayNum}${isToday ? ", today" : ""}${eventCount > 0 ? `, ${eventCount} activities` : ""}`}
              onClick={() => setSelectedDateStr(dStr)}
              className={`crm-cal-day-btn ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
            >
              <span className="crm-cal-day-text">{dayNum}</span>
              {eventCount > 0 && <span className="crm-cal-dot" title={`${eventCount} activities`} />}
            </button>
          );
        })}
      </div>

      <div className="crm-divider" style={{ margin: "16px 0 14px" }} />

      {/* 4. Selected Day Agenda Section */}
      <div className="crm-cal-agenda-section">
        <div className="crm-cal-agenda-header">
          <span className="crm-cal-agenda-title">Agenda — {selectedFormatted}</span>
          {dayAgenda.length > 0 && (
            <span className="crm-cal-agenda-badge">{dayAgenda.length} follow-up{dayAgenda.length > 1 ? "s" : ""}</span>
          )}
        </div>

        <div className="crm-cal-agenda-list">
          {loadingAgenda ? (
            <div className="crm-cal-empty-state">Loading agenda...</div>
          ) : dayAgenda.length === 0 ? (
            <div className="crm-cal-empty-state">
              <CheckCircle2 style={{ width: 22, height: 22, color: "#00E5FF", margin: "0 auto 4px" }} />
              <span>No follow-ups for {selectedFormatted}</span>
            </div>
          ) : (
            dayAgenda.slice(0, 3).map((item) => (
              <div key={item.id} className="crm-cal-agenda-item">
                <div className="crm-cal-agenda-item-left">
                  <div className="crm-cal-agenda-time">
                    <Clock style={{ width: 12, height: 12, color: "#00E5FF" }} />
                    <span>
                      {new Date(item.scheduledAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h4 className="crm-cal-agenda-lead">{item.leadName}</h4>
                  <p className="crm-cal-agenda-note">{item.note || "Scheduled Follow-Up"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. View Full Calendar Link Button */}
      <button
        type="button"
        onClick={() => onNavigateTab && onNavigateTab("config-calendar")}
        className="crm-cal-view-full-btn"
      >
        <CalendarIcon style={{ width: 14, height: 14 }} />
        <span>View Full Calendar</span>
        <ArrowUpRight style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
