"use client";

import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  X,
  Trophy,
  AlertTriangle,
  ArrowRightLeft,
  UserPlus,
} from "lucide-react";
import { CrmActivityItem } from "@/lib/crm";

interface CrmActivityCalendarProps {
  onSelectLead?: (leadId: string) => void;
}

export function CrmActivityCalendar({ onSelectLead }: CrmActivityCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventsByDate, setEventsByDate] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);

  // Selected Day Drawer State
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<CrmActivityItem[]>([]);
  const [loadingDayDetails, setLoadingDayDetails] = useState(false);

  const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    let active = true;
    const fetchMonthData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/crm-calendar?month=${yearMonth}`);
        const data = await res.json().catch(() => ({}));
        if (active && res.ok && data.eventsByDate) {
          setEventsByDate(data.eventsByDate);
        }
      } catch (err) {
        console.error("Failed to load CRM calendar events:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchMonthData();
    return () => {
      active = false;
    };
  }, [yearMonth]);

  const handleDateClick = async (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setLoadingDayDetails(true);
    try {
      const res = await fetch(`/api/dashboard/crm-calendar?month=${yearMonth}&date=${dateStr}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.dayDetails)) {
        setDayDetails(data.dayDetails);
      } else {
        setDayDetails([]);
      }
    } catch {
      setDayDetails([]);
    } finally {
      setLoadingDayDetails(false);
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const todayStr = today.toISOString().slice(0, 10);
    void handleDateClick(todayStr);
  };

  // Generate Month Grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayStr = new Date().toISOString().slice(0, 10);

  const getActivityIcon = (type: string) => {
    if (type === "LEAD_CREATED") return <UserPlus style={{ width: 16, height: 16, color: "#0066FF" }} />;
    if (type === "LEAD_WON") return <Trophy style={{ width: 16, height: 16, color: "#10B981" }} />;
    if (type === "LEAD_LOST") return <AlertTriangle style={{ width: 16, height: 16, color: "#EF4444" }} />;
    if (type.includes("FOLLOW_UP")) return <Clock style={{ width: 16, height: 16, color: "#F59E0B" }} />;
    return <ArrowRightLeft style={{ width: 16, height: 16, color: "#3B82F6" }} />;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF", margin: 0 }}>CRM Calendar</h2>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>Activity timeline & schedule</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={goToToday}
            style={{ padding: "4px 10px", fontSize: 12, fontWeight: 700, borderRadius: 8, background: "#181924", color: "#0066FF", border: "1px solid rgba(0, 229, 255,0.3)", cursor: "pointer" }}
          >
            Today
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#181924", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 8 }}>
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous Month"
              style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 2 }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FFF", padding: "0 4px" }}>
              {monthName} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next Month"
              style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 2 }}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Weekdays */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94A3B8", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 6, marginBottom: 6 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Grid Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, flex: 1 }}>
        {Array.from({ length: adjustedFirstDay }).map((_, idx) => (
          <div key={`empty-${idx}`} style={{ background: "rgba(11,12,16,0.4)", borderRadius: 6, minHeight: 44 }} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDateStr;
          const dayEvents = eventsByDate[dateStr] || {};
          const eventTypes = Object.keys(dayEvents);
          const totalEvents = eventTypes.reduce((acc, k) => acc + dayEvents[k], 0);

          return (
            <button
              key={`day-${dateStr}-${idx}`}
              type="button"
              onClick={() => handleDateClick(dateStr)}
              style={{
                padding: 6,
                borderRadius: 8,
                border: isToday
                  ? "1px solid #0066FF"
                  : isSelected
                  ? "1px solid rgba(0, 229, 255,0.6)"
                  : "1px solid rgba(255,255,255,0.05)",
                background: isToday
                  ? "rgba(0, 229, 255,0.15)"
                  : isSelected
                  ? "#181924"
                  : "#12131A",
                color: "#FFFFFF",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 46,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: isToday ? "#0066FF" : "#FFF" }}>{dayNum}</span>
                {totalEvents > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(0, 229, 255,0.2)", color: "#0066FF", padding: "1px 5px", borderRadius: 50, border: "1px solid rgba(0, 229, 255,0.4)" }}>
                    {totalEvents}
                  </span>
                )}
              </div>

              {/* Indicator Dots */}
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                {eventTypes.slice(0, 3).map((type) => (
                  <span
                    key={type}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: type === "LEAD_CREATED"
                        ? "#0066FF"
                        : type === "LEAD_WON"
                        ? "#10B981"
                        : type === "LEAD_LOST"
                        ? "#EF4444"
                        : type.includes("FOLLOW_UP")
                        ? "#F59E0B"
                        : "#3B82F6",
                    }}
                    title={`${type.replace("_", " ")} (${dayEvents[type]})`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Activity Slide-Out Drawer */}
      {selectedDateStr && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }} onClick={() => setSelectedDateStr(null)}>
          <div
            style={{ width: "100%", maxWidth: 440, background: "#12131A", borderLeft: "1px solid rgba(0, 229, 255,0.3)", height: "100%", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "-10px 0 40px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>DAY TIMELINE ACTIVITY</span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#FFF", margin: "4px 0 0" }}>
                  {new Date(selectedDateStr).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", padding: 4 }}
                onClick={() => setSelectedDateStr(null)}
                aria-label="Close day panel"
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div className="scrollbar-thin" style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
              {loadingDayDetails ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8", fontSize: 13 }}>Loading timeline activities...</div>
              ) : dayDetails.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#64748B" }}>
                  <CalendarIcon style={{ width: 32, height: 32, color: "#475569", margin: "0 auto 8px" }} />
                  <p style={{ fontWeight: 700, color: "#FFF", margin: 0 }}>No activity logged on this date.</p>
                  <span style={{ fontSize: 12, color: "#64748B" }}>Activities automatically record when leads are created or follow-ups occur.</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {dayDetails.map((evt) => (
                    <div key={evt.id} style={{ padding: 12, background: "#181924", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", gap: 12 }}>
                      <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.04)", height: "fit-content" }}>{getActivityIcon(evt.type)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(0, 229, 255,0.15)", color: "#0066FF", border: "1px solid rgba(0, 229, 255,0.3)" }}>
                            {evt.type.replace(/_/g, " ")}
                          </span>
                          <span style={{ fontSize: 11, color: "#64748B" }}>
                            {new Date(evt.occurredAt).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: "#FFF", margin: 0 }}>
                          {onSelectLead ? (
                            <button
                              type="button"
                              onClick={() => onSelectLead(evt.leadId)}
                              style={{ background: "none", border: "none", color: "#0066FF", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                            >
                              {evt.leadName}
                            </button>
                          ) : (
                            evt.leadName
                          )}
                        </h4>
                        {evt.description && <p style={{ fontSize: 12, color: "#CBD5E1", margin: "4px 0 0" }}>{evt.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
