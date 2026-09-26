"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  User,
  Phone,
  Building,
  Mail,
  Filter,
  Check,
  RotateCcw,
  Sparkles,
  MapPin,
  Video,
  List,
  Grid,
  MoreHorizontal,
  CalendarDays,
  Loader2,
} from "lucide-react";

export interface LeadOption {
  id: string;
  name: string;
  companyName?: string | null;
  contactNumber?: string;
  email?: string | null;
  stageKey: string;
  stageColor: string;
}

export interface FollowUpEvent {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany?: string | null;
  contactNumber?: string | null;
  leadEmail?: string | null;
  type: "CALL" | "VISIT" | "MEETING";
  scheduledAt: string; // ISO string
  description?: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  completedAt?: string | null;
  stageShortForm?: string;
  stageColor?: string;
  createdBy: string;
  ownerUserId?: string;
  createdAt?: string;
}

// Stage color map helper
const getStageColor = (stage?: string): string => {
  switch (stage) {
    case "NEW":
      return "#0066FF";
    case "CONTACTED":
      return "#3B82F6";
    case "INTERESTED":
      return "#EC4899";
    case "FOLLOW_UP":
      return "#F59E0B";
    case "WON":
      return "#10B981";
    case "LOST":
      return "#EF4444";
    default:
      return "#0066FF";
  }
};

const getStageShortForm = (stage?: string): string => {
  switch (stage) {
    case "NEW":
      return "NEW";
    case "CONTACTED":
      return "CNT";
    case "INTERESTED":
      return "INT";
    case "FOLLOW_UP":
      return "FU";
    case "WON":
      return "WON";
    case "LOST":
      return "LST";
    default:
      return "LEAD";
  }
};

// Local timezone helpers
const getLocalDateString = (input: Date | string): string => {
  const d = typeof input === "string" ? new Date(input) : input;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatLocalTime = (input: Date | string): string => {
  try {
    const d = typeof input === "string" ? new Date(input) : input;
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "10:30 AM";
  }
};

const createISOFromLocal = (dateStr: string, timeStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return localDate.toISOString();
};

export function CalendarConfig() {
  // Navigation & Date State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<"MONTH" | "WEEK" | "DAY" | "LIST">("MONTH");
  const [eventTypeFilter, setEventTypeFilter] = useState<"ALL" | "SCHEDULED" | "COMPLETED" | "OVERDUE" | "CALL" | "VISIT" | "MEETING">("ALL");
  const [ownershipFilter, setOwnershipFilter] = useState<"MY" | "ALL">("MY");

  // Data States
  const [followUps, setFollowUps] = useState<FollowUpEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  // Modal States
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeEventDetail, setActiveEventDetail] = useState<FollowUpEvent | null>(null);

  // Reschedule Form State
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  // Schedule Modal Form States
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [isSearchingLeads, setIsSearchingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [followUpType, setFollowUpType] = useState<"CALL" | "VISIT" | "MEETING">("CALL");
  const [scheduledDateStr, setScheduledDateStr] = useState(getLocalDateString(new Date()));
  const [scheduledTimeStr, setScheduledTimeStr] = useState("10:30");
  const [descriptionText, setDescriptionText] = useState("");
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [formError, setFormError] = useState("");

  // List View Search
  const [listSearchQuery, setListSearchQuery] = useState("");

  const yearMonthStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`;

  // Fetch Calendar Data from DB API
  const fetchCalendarEvents = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/dashboard/crm-calendar?month=${yearMonthStr}&ownership=${ownershipFilter}`);
      const data = await res.json().catch(() => ({}));

      if (res.ok && Array.isArray(data.followUps)) {
        const parsed: FollowUpEvent[] = data.followUps.map((item: any) => {
          const rawDesc = String(item.description || item.note || "");
          let type: "CALL" | "VISIT" | "MEETING" = "CALL";
          let cleanDesc = rawDesc;

          if (rawDesc.startsWith("[VISIT]")) {
            type = "VISIT";
            cleanDesc = rawDesc.replace(/^\[VISIT\]\s*/, "");
          } else if (rawDesc.startsWith("[MEETING]")) {
            type = "MEETING";
            cleanDesc = rawDesc.replace(/^\[MEETING\]\s*/, "");
          } else if (rawDesc.startsWith("[CALL]")) {
            type = "CALL";
            cleanDesc = rawDesc.replace(/^\[CALL\]\s*/, "");
          }

          const stage = item.leadStage || "NEW";
          return {
            id: item.id,
            leadId: item.leadId,
            leadName: item.leadName,
            leadCompany: item.leadCompany,
            contactNumber: item.contactNumber,
            leadEmail: item.leadEmail,
            type,
            scheduledAt: item.scheduledAt,
            description: cleanDesc,
            status: item.status || "SCHEDULED",
            completedAt: item.completedAt,
            stageShortForm: getStageShortForm(stage),
            stageColor: getStageColor(stage),
            createdBy: item.createdBy || "User",
            ownerUserId: item.ownerUserId,
            createdAt: item.createdAt,
          };
        });
        setFollowUps(parsed);
      } else {
        setFollowUps([]);
      }
    } catch (err: any) {
      console.error("[Calendar] Error loading data:", err);
      setLoadError("Failed to connect to follow-up database.");
      setFollowUps([]);
    } finally {
      setIsLoading(false);
    }
  }, [yearMonthStr, ownershipFilter]);

  useEffect(() => {
    void fetchCalendarEvents();
  }, [fetchCalendarEvents]);

  // Live Lead Search for Schedule Follow-Up Modal
  useEffect(() => {
    if (!isScheduleModalOpen) return;
    let active = true;

    const searchLeadsApi = async () => {
      setIsSearchingLeads(true);
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(leadSearchQuery)}&limit=15`);
        const data = await res.json().catch(() => ({}));
        if (active && res.ok && Array.isArray(data.leads)) {
          const mapped: LeadOption[] = data.leads.map((l: any) => ({
            id: l.id,
            name: l.name,
            companyName: l.companyName,
            contactNumber: l.contactNumber,
            email: l.email,
            stageKey: l.stage || "NEW",
            stageColor: getStageColor(l.stage),
          }));
          setLeadOptions(mapped);
        }
      } catch {
        if (active) setLeadOptions([]);
      } finally {
        if (active) setIsSearchingLeads(false);
      }
    };

    const timer = setTimeout(() => {
      void searchLeadsApi();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [leadSearchQuery, isScheduleModalOpen]);

  // Navigation Handlers
  const handlePrev = () => {
    setSelectedDate((prev) => {
      const copy = new Date(prev);
      if (activeView === "MONTH" || activeView === "LIST") {
        copy.setMonth(copy.getMonth() - 1);
      } else if (activeView === "WEEK") {
        copy.setDate(copy.getDate() - 7);
      } else if (activeView === "DAY") {
        copy.setDate(copy.getDate() - 1);
      }
      return copy;
    });
  };

  const handleNext = () => {
    setSelectedDate((prev) => {
      const copy = new Date(prev);
      if (activeView === "MONTH" || activeView === "LIST") {
        copy.setMonth(copy.getMonth() + 1);
      } else if (activeView === "WEEK") {
        copy.setDate(copy.getDate() + 7);
      } else if (activeView === "DAY") {
        copy.setDate(copy.getDate() + 1);
      }
      return copy;
    });
  };

  const handleGoToToday = () => {
    setSelectedDate(new Date());
  };

  // Title Label based on View
  const titleHeaderLabel = useMemo(() => {
    if (activeView === "MONTH" || activeView === "LIST") {
      return selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (activeView === "DAY") {
      return selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    } else {
      // WEEK View: calculate week range Mon - Sun
      const dayOfWeek = selectedDate.getDay();
      const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monDate = new Date(selectedDate);
      monDate.setDate(selectedDate.getDate() - startOffset);
      const sunDate = new Date(monDate);
      sunDate.setDate(monDate.getDate() + 6);

      const monStr = monDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const sunStr = sunDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${monStr} – ${sunStr}`;
    }
  }, [selectedDate, activeView]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const nowIso = new Date().toISOString();
    return followUps.filter((item) => {
      // Status & Type Filter
      if (eventTypeFilter === "SCHEDULED" && item.status !== "SCHEDULED") return false;
      if (eventTypeFilter === "COMPLETED" && item.status !== "COMPLETED") return false;
      if (eventTypeFilter === "OVERDUE") {
        const isOverdue = item.status === "SCHEDULED" && item.scheduledAt < nowIso;
        if (!isOverdue) return false;
      }
      if (eventTypeFilter === "CALL" && item.type !== "CALL") return false;
      if (eventTypeFilter === "VISIT" && item.type !== "VISIT") return false;
      if (eventTypeFilter === "MEETING" && item.type !== "MEETING") return false;

      return true;
    });
  }, [followUps, eventTypeFilter]);

  // Dynamic KPI Metrics
  const metrics = useMemo(() => {
    const nowIso = new Date().toISOString();
    const activeYear = selectedDate.getFullYear();
    const activeMonth = selectedDate.getMonth();

    const monthEvents = filteredEvents.filter((e) => {
      const d = new Date(e.scheduledAt);
      return d.getFullYear() === activeYear && d.getMonth() === activeMonth;
    });

    const stageFollowUps = monthEvents.filter((e) => e.status === "SCHEDULED").length;
    const stageEntries = monthEvents.length;
    const overdueCount = followUps.filter((e) => e.status === "SCHEDULED" && e.scheduledAt < nowIso).length;
    const completedCount = followUps.filter((e) => e.status === "COMPLETED").length;
    const totalFinished = completedCount + overdueCount;
    const delayRate = totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 100;

    return {
      stageFollowUps,
      stageEntries,
      overdueCount,
      delayRate: `${delayRate}% On-time`,
    };
  }, [selectedDate, filteredEvents, followUps]);

  // Month Grid Days Calculation (Monday start)
  const calendarGrid = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday fix

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = getLocalDateString(new Date());

    // Previous month padding days
    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      const isoDate = getLocalDateString(d);
      days.push({ date: d, dateStr: isoDate, isCurrentMonth: false, isToday: isoDate === todayStr });
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const isoDate = getLocalDateString(d);
      days.push({ date: d, dateStr: isoDate, isCurrentMonth: true, isToday: isoDate === todayStr });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const isoDate = getLocalDateString(d);
      days.push({ date: d, dateStr: isoDate, isCurrentMonth: false, isToday: isoDate === todayStr });
    }

    return days;
  }, [selectedDate]);

  // Map events by dateStr
  const eventsByDate = useMemo(() => {
    const map: Record<string, FollowUpEvent[]> = {};
    for (const ev of filteredEvents) {
      const datePart = getLocalDateString(ev.scheduledAt);
      if (!map[datePart]) map[datePart] = [];
      map[datePart].push(ev);
    }
    return map;
  }, [filteredEvents]);

  // Week Grid Days Calculation
  const weekGridDays = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monDate = new Date(selectedDate);
    monDate.setDate(selectedDate.getDate() - startOffset);

    const todayStr = getLocalDateString(new Date());
    const days: { date: Date; dateStr: string; dayName: string; isToday: boolean }[] = [];
    const dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monDate);
      d.setDate(monDate.getDate() + i);
      const dateStr = getLocalDateString(d);
      days.push({ date: d, dateStr, dayName: dayNames[i], isToday: dateStr === todayStr });
    }
    return days;
  }, [selectedDate]);

  // Open Schedule Modal Handler
  const handleOpenScheduleModal = (datePrefill?: string) => {
    setSelectedLead(null);
    setLeadSearchQuery("");
    setFollowUpType("CALL");
    setScheduledDateStr(datePrefill || getLocalDateString(selectedDate));
    setScheduledTimeStr("10:30");
    setDescriptionText("");
    setFormError("");
    setIsScheduleModalOpen(true);
  };

  // Submit Schedule Follow-Up Form to DB API
  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedLead) {
      setFormError("Please select a Lead.");
      return;
    }

    if (!scheduledDateStr || !scheduledTimeStr) {
      setFormError("Please enter a valid Date and Time.");
      return;
    }

    setIsSavingFollowUp(true);

    try {
      const isoScheduled = createISOFromLocal(scheduledDateStr, scheduledTimeStr);
      const fullNote = `[${followUpType}] ${descriptionText.trim()}`;

      const res = await fetch(`/api/leads/${selectedLead.id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: isoScheduled,
          note: fullNote,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setIsScheduleModalOpen(false);
        await fetchCalendarEvents();
      } else {
        setFormError(data.message || "Failed to schedule follow-up.");
      }
    } catch (err: any) {
      console.error("[Schedule Follow-Up] Submit Error:", err);
      setFormError("Network error. Please try again.");
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  // Action: Mark Complete
  const handleCompleteEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/leads/follow-ups/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        setActiveEventDetail(null);
        await fetchCalendarEvents();
      }
    } catch (err) {
      console.error("Failed to complete event:", err);
    }
  };

  // Action: Cancel Event
  const handleCancelEvent = async (eventId: string) => {
    try {
      const res = await fetch(`/api/leads/follow-ups/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (res.ok) {
        setActiveEventDetail(null);
        await fetchCalendarEvents();
      }
    } catch (err) {
      console.error("Failed to cancel event:", err);
    }
  };

  // Action: Reschedule Event
  const handleRescheduleEvent = async (eventId: string) => {
    if (!rescheduleDate || !rescheduleTime) return;
    try {
      const isoScheduled = createISOFromLocal(rescheduleDate, rescheduleTime);
      const res = await fetch(`/api/leads/follow-ups/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reschedule", scheduledAt: isoScheduled }),
      });
      if (res.ok) {
        setIsRescheduling(false);
        setActiveEventDetail(null);
        await fetchCalendarEvents();
      }
    } catch (err) {
      console.error("Failed to reschedule event:", err);
    }
  };

  // Filtered List View Events
  const listViewEvents = useMemo(() => {
    if (!listSearchQuery.trim()) return filteredEvents;
    const q = listSearchQuery.toLowerCase().trim();
    return filteredEvents.filter(
      (e) =>
        e.leadName.toLowerCase().includes(q) ||
        (e.leadCompany && e.leadCompany.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q))
    );
  }, [filteredEvents, listSearchQuery]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 1400, margin: "0 auto", paddingBottom: 40 }}>
      {/* 1. PAGE CONTROL HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "var(--surface)",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          padding: "20px 24px",
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Left: Title & Month Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              CALENDAR LEADS VIEW
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0", fontFamily: "Inter, system-ui, sans-serif" }}>
              {titleHeaderLabel}
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
              Track pending and completed Follow-Ups with a calendar-first workflow.
            </p>
          </div>

          {/* Nav Controls: < August 2026 > + Month Button */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", padding: 4, borderRadius: 10 }}>
            <button
              type="button"
              onClick={handleGoToToday}
              style={{
                height: 32,
                padding: "0 14px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 7,
                border: "none",
                background: "#0066FF",
                color: "#08080A",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Go to Current Month"
            >
              Month
            </button>
            <button
              type="button"
              onClick={handlePrev}
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Previous"
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Next"
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Right Controls: View Switcher, Filters & Action Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* View Selector (Month, Week, Day, List) */}
          <div style={{ display: "flex", gap: 3, background: "var(--bg-secondary)", padding: 3, borderRadius: 10, border: "1px solid var(--border-color)" }}>
            {(["MONTH", "WEEK", "DAY", "LIST"] as const).map((view) => {
              const label = view === "MONTH" ? "Month" : view === "WEEK" ? "Week" : view === "DAY" ? "Day" : "List";
              const isActive = activeView === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => setActiveView(view)}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 600,
                    borderRadius: 7,
                    border: "none",
                    background: isActive ? "#0066FF" : "transparent",
                    color: isActive ? "#08080A" : "#8E8EA0",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Event Type Filter */}
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value as any)}
            style={{
              height: 38,
              padding: "0 12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 9,
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Follow-Ups</option>
            <option value="SCHEDULED">Scheduled Only</option>
            <option value="COMPLETED">Completed Only</option>
            <option value="OVERDUE">Overdue Tasks</option>
            <option value="CALL">Calls Only</option>
            <option value="VISIT">Visits Only</option>
            <option value="MEETING">Meetings Only</option>
          </select>

          {/* Ownership Filter */}
          <select
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value as any)}
            style={{
              height: 38,
              padding: "0 12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 9,
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="MY">My Follow-Ups</option>
            <option value="ALL">All Team Follow-Ups</option>
          </select>

          {/* Schedule Follow-Up CTA */}
          <button
            type="button"
            onClick={() => handleOpenScheduleModal()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 42,
              padding: "0 20px",
              fontSize: 13,
              fontWeight: 800,
              color: "#07080B",
              background: "#0066FF",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(0, 229, 255, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            <Plus style={{ width: 18, height: 18, strokeWidth: 3 }} />
            Schedule Follow-Up
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRICS STRIP (4 Compact Equal Columns) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {/* Metric 1: STAGE FOLLOW-UPS */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0, 229, 255, 0.18)",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 90,
          }}
        >
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              STAGE FOLLOW-UPS
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", marginTop: 2, fontFamily: "Inter, system-ui, sans-serif" }}>
              {metrics.stageFollowUps}
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.25)", color: "#0066FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CalendarIcon style={{ width: 18, height: 18 }} />
          </div>
        </div>

        {/* Metric 2: STAGE LEAD ENTRIES */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0, 229, 255, 0.18)",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 90,
          }}
        >
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              STAGE LEAD ENTRIES
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#3B82F6", marginTop: 2, fontFamily: "Inter, system-ui, sans-serif" }}>
              {metrics.stageEntries}
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(59, 130, 246, 0.12)", border: "1px solid rgba(59, 130, 246, 0.25)", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock style={{ width: 18, height: 18 }} />
          </div>
        </div>

        {/* Metric 3: OVERDUE HISTORY */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0, 229, 255, 0.18)",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 90,
          }}
        >
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              OVERDUE HISTORY
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#EF4444", marginTop: 2, fontFamily: "Inter, system-ui, sans-serif" }}>
              {metrics.overdueCount}
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle style={{ width: 18, height: 18 }} />
          </div>
        </div>

        {/* Metric 4: DELAY ANALYTICS */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(0, 229, 255, 0.18)",
            borderRadius: 14,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 90,
          }}
        >
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              DELAY ANALYTICS
            </span>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#10B981", marginTop: 4, fontFamily: "Inter, system-ui, sans-serif" }}>
              {metrics.delayRate}
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 style={{ width: 18, height: 18 }} />
          </div>
        </div>
      </div>

      {/* 3. CALENDAR CONTENT CONTAINER */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 8px 28px rgba(0, 0, 0, 0.35)",
          position: "relative",
          minHeight: 500,
        }}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              background: "rgba(18, 19, 26, 0.6)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#0066FF", fontWeight: 700, fontSize: 14 }}>
              <Loader2 className="animate-spin" style={{ width: 22, height: 22 }} />
              Loading follow-ups...
            </div>
          </div>
        )}

        {/* VIEW 1: MONTH GRID VIEW */}
        {activeView === "MONTH" && (
          <div>
            {/* WEEKDAY HEADERS (MON, TUE, WED, THU, FRI, SAT, SUN) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, marginBottom: 8, textAlign: "center", width: "100%" }}>
              {(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const).map((dayName) => (
                <div key={dayName} style={{ padding: "10px 0", fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", minWidth: 0 }}>
                  {dayName}
                </div>
              ))}
            </div>

            {/* 7-COLUMN MONTH GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, width: "100%" }}>
              {calendarGrid.map((dayItem, gridIdx) => {
                const dayEvents = eventsByDate[dayItem.dateStr] || [];
                const isToday = dayItem.isToday;
                const nowIso = new Date().toISOString();

                return (
                  <div
                    key={`cell-${dayItem.dateStr}-${gridIdx}`}
                    style={{
                      minHeight: 140,
                      minWidth: 0,
                      background: dayItem.isCurrentMonth ? "var(--bg-secondary)" : "rgba(18, 19, 26, 0.4)",
                      border: isToday ? "2px solid #0066FF" : "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: 12,
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        setSelectedDate(dayItem.date);
                        setActiveView("DAY");
                      } else {
                        handleOpenScheduleModal(dayItem.dateStr);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (dayItem.isCurrentMonth) e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      if (dayItem.isCurrentMonth && !isToday) e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                    }}
                  >
                    {/* Date Cell Top Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isToday ? 900 : 700,
                          color: isToday ? "#0066FF" : dayItem.isCurrentMonth ? "#FFFFFF" : "#64748B",
                          background: isToday ? "rgba(0, 229, 255, 0.15)" : "transparent",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {dayItem.date.getDate()}
                      </span>

                      {dayEvents.length > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", background: "rgba(0, 229, 255,0.15)", padding: "1px 6px", borderRadius: 10, flexShrink: 0 }}>
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Event Chips (Up to 3 visible) */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "6px 0", flex: 1, overflow: "hidden", minWidth: 0 }}>
                      {dayEvents.slice(0, 3).map((ev) => {
                        const isOverdue = ev.status === "SCHEDULED" && ev.scheduledAt < nowIso;
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveEventDetail(ev);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 6,
                              background: ev.status === "COMPLETED" ? "rgba(16,185,129,0.15)" : isOverdue ? "rgba(239,68,68,0.15)" : "rgba(0, 229, 255,0.12)",
                              border: `1px solid ${ev.stageColor || "#0066FF"}40`,
                              padding: "4px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              minWidth: 0,
                              overflow: "hidden",
                            }}
                            title={`${ev.type}: ${ev.leadName} (${formatLocalTime(ev.scheduledAt)})`}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ev.stageColor || "#0066FF", flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                                {ev.type} · {ev.leadName}
                              </span>
                            </div>
                            <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                              {formatLocalTime(ev.scheduledAt)}
                            </span>
                          </div>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(dayItem.date);
                            setActiveView("DAY");
                          }}
                          style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textAlign: "center", padding: "2px 0", cursor: "pointer" }}
                        >
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>

                    {/* Date Cell Bottom Plus Hint */}
                    <div
                      style={{ fontSize: 10, color: "#64748B", textAlign: "right", opacity: 0.6 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenScheduleModal(dayItem.dateStr);
                      }}
                    >
                      + Add task
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: WEEK VIEW */}
        {activeView === "WEEK" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10, width: "100%" }}>
              {weekGridDays.map((wDay) => {
                const dayEvents = eventsByDate[wDay.dateStr] || [];
                const nowIso = new Date().toISOString();

                return (
                  <div
                    key={wDay.dateStr}
                    style={{
                      background: "var(--bg-secondary)",
                      border: wDay.isToday ? "2px solid #0066FF" : "1px solid var(--border-color)",
                      borderRadius: 14,
                      padding: 12,
                      minHeight: 450,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    {/* Header for Day in Week */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: wDay.isToday ? "#0066FF" : "#94A3B8" }}>{wDay.dayName}</span>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{wDay.date.getDate()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenScheduleModal(wDay.dateStr)}
                        style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(0, 229, 255, 0.15)", border: "none", color: "#0066FF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Plus style={{ width: 14, height: 14 }} />
                      </button>
                    </div>

                    {/* Events List for Day */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
                      {dayEvents.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#64748B", textAlign: "center", marginTop: 20 }}>No tasks scheduled</div>
                      ) : (
                        dayEvents.map((ev) => {
                          const isOverdue = ev.status === "SCHEDULED" && ev.scheduledAt < nowIso;
                          return (
                            <div
                              key={ev.id}
                              onClick={() => setActiveEventDetail(ev)}
                              style={{
                                background: "rgba(18, 19, 26, 0.7)",
                                border: `1px solid ${ev.stageColor || "#0066FF"}40`,
                                borderRadius: 8,
                                padding: 10,
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: ev.stageColor || "#0066FF", background: `${ev.stageColor || "#0066FF"}20`, padding: "2px 6px", borderRadius: 4 }}>
                                  {ev.type}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatLocalTime(ev.scheduledAt)}</span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {ev.leadName}
                              </div>
                              {ev.leadCompany && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ev.leadCompany}</div>}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: ev.status === "COMPLETED" ? "#10B981" : isOverdue ? "#EF4444" : "#0066FF" }}>
                                  {isOverdue ? "OVERDUE" : ev.status}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: DAY VIEW */}
        {activeView === "DAY" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)", padding: 16, borderRadius: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase" }}>DAY SCHEDULE</span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0" }}>
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => handleOpenScheduleModal(getLocalDateString(selectedDate))}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#0066FF", color: "#08080A", fontWeight: 800, borderRadius: 8, border: "none", cursor: "pointer" }}
              >
                <Plus style={{ width: 16, height: 16 }} />
                Add Follow-Up
              </button>
            </div>

            {/* Day Events List */}
            {(() => {
              const dayStr = getLocalDateString(selectedDate);
              const dayEvents = eventsByDate[dayStr] || [];
              const nowIso = new Date().toISOString();

              if (dayEvents.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                    <CalendarIcon style={{ width: 40, height: 40, color: "#64748B", margin: "0 auto 12px" }} />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>No follow-ups scheduled for this day</h3>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Click "Add Follow-Up" to schedule a new call, visit, or meeting.</p>
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {dayEvents.map((ev) => {
                    const isOverdue = ev.status === "SCHEDULED" && ev.scheduledAt < nowIso;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setActiveEventDetail(ev)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: 16,
                          background: "var(--bg-secondary)",
                          border: `1px solid ${ev.stageColor || "#0066FF"}40`,
                          borderRadius: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 10,
                              background: `${ev.stageColor || "#0066FF"}20`,
                              border: `1px solid ${ev.stageColor || "#0066FF"}40`,
                              color: ev.stageColor || "#0066FF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: 12,
                            }}
                          >
                            {ev.type === "CALL" ? <Phone style={{ width: 20, height: 20 }} /> : ev.type === "VISIT" ? <MapPin style={{ width: 20, height: 20 }} /> : <Video style={{ width: 20, height: 20 }} />}
                          </div>

                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{ev.leadName}</h3>
                              <span style={{ fontSize: 10, fontWeight: 800, color: ev.stageColor || "#0066FF", background: `${ev.stageColor || "#0066FF"}20`, padding: "2px 8px", borderRadius: 4 }}>
                                {ev.stageShortForm}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                              {ev.leadCompany ? `${ev.leadCompany} · ` : ""}{ev.description || "No description added"}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{formatLocalTime(ev.scheduledAt)}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: ev.status === "COMPLETED" ? "#10B981" : isOverdue ? "#EF4444" : "#0066FF" }}>
                            {isOverdue ? "OVERDUE" : ev.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW 4: LIST VIEW */}
        {activeView === "LIST" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* List Search Bar */}
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#0066FF" }} />
              <input
                type="text"
                placeholder="Filter follow-ups by lead name, company, or note..."
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 42,
                  paddingLeft: 42,
                  paddingRight: 16,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  color: "var(--text-primary)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {/* List Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "#0066FF", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 14px" }}>Date & Time</th>
                    <th style={{ padding: "12px 14px" }}>Lead Name</th>
                    <th style={{ padding: "12px 14px" }}>Type</th>
                    <th style={{ padding: "12px 14px" }}>Stage</th>
                    <th style={{ padding: "12px 14px" }}>Status</th>
                    <th style={{ padding: "12px 14px" }}>Created By</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listViewEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        No follow-ups matching the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    listViewEvents.map((ev) => {
                      const nowIso = new Date().toISOString();
                      const isOverdue = ev.status === "SCHEDULED" && ev.scheduledAt < nowIso;

                      return (
                        <tr
                          key={ev.id}
                          style={{ borderBottom: "1px solid var(--border-color)", cursor: "pointer" }}
                          onClick={() => setActiveEventDetail(ev)}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0, 229, 255, 0.05)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "14px", color: "var(--text-primary)", fontWeight: 700 }}>
                            {new Date(ev.scheduledAt).toLocaleDateString()} {formatLocalTime(ev.scheduledAt)}
                          </td>
                          <td style={{ padding: "14px" }}>
                            <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{ev.leadName}</div>
                            {ev.leadCompany && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ev.leadCompany}</div>}
                          </td>
                          <td style={{ padding: "14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-primary)", background: "var(--border-color)", padding: "4px 8px", borderRadius: 6 }}>
                              {ev.type}
                            </span>
                          </td>
                          <td style={{ padding: "14px" }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: ev.stageColor || "#0066FF", background: `${ev.stageColor || "#0066FF"}20`, padding: "3px 8px", borderRadius: 4 }}>
                              {ev.stageShortForm}
                            </span>
                          </td>
                          <td style={{ padding: "14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: ev.status === "COMPLETED" ? "#10B981" : isOverdue ? "#EF4444" : "#0066FF" }}>
                              {isOverdue ? "OVERDUE" : ev.status}
                            </span>
                          </td>
                          <td style={{ padding: "14px", color: "var(--text-muted)" }}>{ev.createdBy}</td>
                          <td style={{ padding: "14px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                            {ev.status !== "COMPLETED" && (
                              <button
                                type="button"
                                onClick={() => handleCompleteEvent(ev.id)}
                                style={{ padding: "6px 12px", fontSize: 11, fontWeight: 800, background: "#10B981", color: "var(--text-primary)", border: "none", borderRadius: 6, cursor: "pointer" }}
                              >
                                Complete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CREATE FOLLOW-UP MODAL */}
      {isScheduleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0, 0, 0, 0.82)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsScheduleModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              background: "var(--surface)",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              borderRadius: 18,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid var(--border-color)",
                background: "#161722",
              }}
            >
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  CRM SCHEDULING
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0" }}>
                  Schedule Follow-Up
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, width: 32, height: 32, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Modal Form */}
            <form
              id="createFollowUpForm"
              onSubmit={handleSaveFollowUp}
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {formError && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#F87171", fontSize: 12, fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              {/* FIELD 1: LEAD SELECTOR */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  LEAD *
                </label>
                {selectedLead ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 16px",
                      background: "var(--bg-secondary)",
                      border: "1px solid #0066FF",
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{selectedLead.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{selectedLead.companyName || selectedLead.email || selectedLead.contactNumber}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLead(null)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      <X style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#0066FF" }} />
                      <input
                        type="text"
                        placeholder="Search lead by name, email, or phone..."
                        value={leadSearchQuery}
                        onChange={(e) => setLeadSearchQuery(e.target.value)}
                        style={{
                          width: "100%",
                          height: 44,
                          paddingLeft: 42,
                          paddingRight: 16,
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: 10,
                          color: "var(--text-primary)",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                      {isSearchingLeads && (
                        <Loader2 className="animate-spin" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#0066FF" }} />
                      )}
                    </div>

                    <div style={{ maxHeight: 160, overflowY: "auto", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 4 }}>
                      {leadOptions.length === 0 ? (
                        <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                          {isSearchingLeads ? "Searching leads..." : "No leads found. Type a name to search."}
                        </div>
                      ) : (
                        leadOptions.map((l) => (
                          <div
                            key={l.id}
                            onClick={() => setSelectedLead(l)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 6,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0, 229, 255, 0.15)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{l.name}</span>
                              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{l.companyName}</span>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 800, color: l.stageColor, background: `${l.stageColor}20`, padding: "2px 6px", borderRadius: 4 }}>
                              {l.stageKey}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* FIELD 2: TYPE */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  FOLLOW-UP TYPE *
                </label>
                <select
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value as any)}
                  style={{
                    width: "100%",
                    height: 44,
                    padding: "0 14px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 10,
                    color: "var(--text-primary)",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="CALL">Phone Call</option>
                  <option value="VISIT">Office / Field Visit</option>
                  <option value="MEETING">Video / In-person Meeting</option>
                </select>
              </div>

              {/* FIELD 3: SCHEDULED DATE & TIME */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                <div style={{ flex: "1 1 180px" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    SCHEDULED DATE *
                  </label>
                  <DatePicker
                    value={scheduledDateStr}
                    onChange={(dateStr) => setScheduledDateStr(dateStr)}
                    placeholder="Select Date"
                  />
                </div>

                <div style={{ flex: "1 1 150px" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    SCHEDULED TIME *
                  </label>
                  <TimePicker
                    value={scheduledTimeStr}
                    onChange={(timeStr) => setScheduledTimeStr(timeStr)}
                    placeholder="Select Time"
                  />
                </div>
              </div>

              {/* FIELD 4: DESCRIPTION */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  REMARKS / NOTES
                </label>
                <textarea
                  rows={3}
                  placeholder="Context, agenda, or notes for the follow-up..."
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 10,
                    color: "var(--text-primary)",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>
            </form>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                padding: "16px 24px",
                borderTop: "1px solid var(--border-color)",
                background: "#161722",
              }}
            >
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 9,
                  background: "var(--bg-secondary)",
                  color: "#CBD5E1",
                  border: "1px solid var(--border-color)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="createFollowUpForm"
                disabled={isSavingFollowUp}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 9,
                  background: "#0066FF",
                  color: "#07080B",
                  border: "none",
                  cursor: isSavingFollowUp ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(0, 229, 255, 0.25)",
                }}
              >
                {isSavingFollowUp ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />
                    Saving...
                  </>
                ) : (
                  <>
                    <CalendarIcon style={{ width: 16, height: 16 }} />
                    Schedule Follow-Up
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT DETAIL & ACTION MODAL */}
      {activeEventDetail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            setActiveEventDetail(null);
            setIsRescheduling(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: "var(--surface)",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              padding: 24,
              borderRadius: 18,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: activeEventDetail.stageColor || "#0066FF", textTransform: "uppercase" }}>
                  {activeEventDetail.type} TASK
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0" }}>
                  {activeEventDetail.leadName}
                </h3>
                {activeEventDetail.leadCompany && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{activeEventDetail.leadCompany}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveEventDetail(null);
                  setIsRescheduling(false);
                }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, background: "var(--bg-secondary)", borderRadius: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#CBD5E1" }}>
                <strong>Scheduled:</strong> {new Date(activeEventDetail.scheduledAt).toLocaleDateString()} at {formatLocalTime(activeEventDetail.scheduledAt)}
              </div>
              {activeEventDetail.contactNumber && (
                <div style={{ fontSize: 12, color: "#CBD5E1" }}>
                  <strong>Phone:</strong> {activeEventDetail.contactNumber}
                </div>
              )}
              {activeEventDetail.description && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  <strong>Notes:</strong> {activeEventDetail.description}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#CBD5E1" }}>
                <strong>Status:</strong>{" "}
                <span style={{ color: activeEventDetail.status === "COMPLETED" ? "#10B981" : activeEventDetail.status === "CANCELLED" ? "#EF4444" : "#0066FF", fontWeight: 800 }}>
                  {activeEventDetail.status}
                </span>
              </div>
            </div>

            {/* Reschedule Form Box */}
            {isRescheduling ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-secondary)", padding: 14, borderRadius: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0066FF" }}>Pick New Date & Time</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ flex: "1 1 160px" }}>
                    <DatePicker
                      value={rescheduleDate}
                      onChange={(dateStr) => setRescheduleDate(dateStr)}
                      placeholder="Select Date"
                    />
                  </div>
                  <div style={{ flex: "1 1 140px" }}>
                    <TimePicker
                      value={rescheduleTime}
                      onChange={(timeStr) => setRescheduleTime(timeStr)}
                      placeholder="Select Time"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setIsRescheduling(false)}
                    style={{ padding: "6px 12px", fontSize: 12, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRescheduleEvent(activeEventDetail.id)}
                    style={{ padding: "6px 14px", fontSize: 12, fontWeight: 800, background: "#0066FF", color: "#08080A", border: "none", borderRadius: 6, cursor: "pointer" }}
                  >
                    Confirm Reschedule
                  </button>
                </div>
              </div>
            ) : null}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              {activeEventDetail.status === "SCHEDULED" && !isRescheduling && (
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleDate(getLocalDateString(activeEventDetail.scheduledAt));
                    setRescheduleTime("10:30");
                    setIsRescheduling(true);
                  }}
                  style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", cursor: "pointer" }}
                >
                  Reschedule
                </button>
              )}

              {activeEventDetail.status === "SCHEDULED" && (
                <button
                  type="button"
                  onClick={() => handleCancelEvent(activeEventDetail.id)}
                  style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, background: "var(--bg-secondary)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, color: "#EF4444", cursor: "pointer" }}
                >
                  Cancel Task
                </button>
              )}

              {activeEventDetail.status !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={() => handleCompleteEvent(activeEventDetail.id)}
                  style={{ padding: "8px 18px", fontSize: 12, fontWeight: 800, background: "#10B981", color: "var(--text-primary)", border: "none", borderRadius: 8, cursor: "pointer" }}
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
