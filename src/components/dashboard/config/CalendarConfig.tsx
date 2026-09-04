"use client";

import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";

export interface LeadOption {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  stageKey: string;
  stageColor: string;
}

export interface FollowUpEvent {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany?: string;
  type: "CALL" | "VISIT" | "MEETING";
  scheduledAt: string; // ISO string
  description?: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  completedAt?: string;
  stageShortForm?: string;
  stageColor?: string;
  createdBy: string;
  createdAt: string;
}

const INITIAL_LEADS: LeadOption[] = [
  { id: "lead-101", name: "Rahul Nair", company: "Apex Technologies", phone: "+91 98765 43210", email: "rahul@apex.com", stageKey: "FOLLOW_UP", stageColor: "#F59E0B" },
  { id: "lead-102", name: "Ananya Sharma", company: "Vanguard Design", phone: "+91 98123 45678", email: "ananya@vanguard.in", stageKey: "INTERESTED", stageColor: "#EC4899" },
  { id: "lead-103", name: "Vikram Malhotra", company: "Luxury Living Ltd", phone: "+91 99887 76655", email: "vikram@luxliving.com", stageKey: "NEW", stageColor: "#0066FF" },
  { id: "lead-104", name: "Priya Patel", company: "Starlight Digital", phone: "+91 97654 32109", email: "priya@starlight.io", stageKey: "CONTACTED", stageColor: "#3B82F6" },
  { id: "lead-105", name: "Siddharth Rao", company: "Matrix Systems", phone: "+91 98989 89898", email: "siddharth@matrix.com", stageKey: "WON", stageColor: "#10B981" },
];

const INITIAL_FOLLOWUPS: FollowUpEvent[] = [
  {
    id: "fw-1",
    leadId: "lead-101",
    leadName: "Rahul Nair",
    leadCompany: "Apex Technologies",
    type: "CALL",
    scheduledAt: "2026-08-31T10:30:00.000Z",
    description: "Call regarding 24k Gold Executive Card bulk pricing",
    status: "SCHEDULED",
    stageShortForm: "FU",
    stageColor: "#F59E0B",
    createdBy: "Muhammed Febin",
    createdAt: "2026-08-25T09:00:00.000Z",
  },
  {
    id: "fw-2",
    leadId: "lead-102",
    leadName: "Ananya Sharma",
    leadCompany: "Vanguard Design",
    type: "MEETING",
    scheduledAt: "2026-08-31T14:00:00.000Z",
    description: "In-person product demo of Metal NFC Cards",
    status: "SCHEDULED",
    stageShortForm: "INT",
    stageColor: "#EC4899",
    createdBy: "Muhammed Febin",
    createdAt: "2026-08-26T11:20:00.000Z",
  },
  {
    id: "fw-3",
    leadId: "lead-104",
    leadName: "Priya Patel",
    leadCompany: "Starlight Digital",
    type: "VISIT",
    scheduledAt: "2026-08-28T11:00:00.000Z",
    description: "Office visit for sample card presentation",
    status: "COMPLETED",
    completedAt: "2026-08-28T11:45:00.000Z",
    stageShortForm: "CNT",
    stageColor: "#3B82F6",
    createdBy: "Muhammed Febin",
    createdAt: "2026-08-20T15:30:00.000Z",
  },
  {
    id: "fw-4",
    leadId: "lead-103",
    leadName: "Vikram Malhotra",
    leadCompany: "Luxury Living Ltd",
    type: "CALL",
    scheduledAt: "2026-08-25T16:30:00.000Z",
    description: "Follow up on initial NFC QR proposal",
    status: "SCHEDULED",
    stageShortForm: "NEW",
    stageColor: "#0066FF",
    createdBy: "System",
    createdAt: "2026-08-18T10:00:00.000Z",
  },
  {
    id: "fw-5",
    leadId: "lead-105",
    leadName: "Siddharth Rao",
    leadCompany: "Matrix Systems",
    type: "CALL",
    scheduledAt: "2026-09-02T11:30:00.000Z",
    description: "Post-onboarding check-in for digital profile activation",
    status: "SCHEDULED",
    stageShortForm: "WON",
    stageColor: "#10B981",
    createdBy: "Muhammed Febin",
    createdAt: "2026-08-29T14:00:00.000Z",
  },
];

const LOCAL_STORAGE_KEY = "myluxcards_calendar_followups_v1";

export function CalendarConfig() {
  const [followUps, setFollowUps] = useState<FollowUpEvent[]>(INITIAL_FOLLOWUPS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Active Date / View State (Default to August 2026 for demonstration matching prompt)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)); // August 2026
  const [activeView, setActiveView] = useState<"MONTH" | "WEEK" | "DAY" | "LIST">("MONTH");
  const [eventTypeFilter, setEventTypeFilter] = useState<"ALL" | "FOLLOWUPS" | "ENTRIES" | "COMPLETED" | "OVERDUE">("FOLLOWUPS");
  const [ownershipFilter, setOwnershipFilter] = useState<"MY" | "ALL">("MY");

  // Modal & Form States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: FollowUpEvent[] } | null>(null);
  const [activeEventDetail, setActiveEventDetail] = useState<FollowUpEvent | null>(null);

  // Form Fields State
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [followUpType, setFollowUpType] = useState<"CALL" | "VISIT" | "MEETING">("CALL");
  const [scheduledDateStr, setScheduledDateStr] = useState("2026-08-31");
  const [scheduledTimeStr, setScheduledTimeStr] = useState("10:30");
  const [descriptionText, setDescriptionText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFollowUps(parsed);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when followups change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(followUps));
    } catch {
      // Ignore storage errors
    }
  }, [followUps, isLoaded]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 7, 31)); // Aug 31, 2026
  };

  // Month & Year Label
  const monthYearLabel = useMemo(() => {
    return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentDate]);

  // Filtered Follow-Ups based on event type & ownership
  const filteredEvents = useMemo(() => {
    const nowIso = "2026-08-31T23:59:59.000Z";
    return followUps.filter((item) => {
      // Ownership filter
      if (ownershipFilter === "MY" && item.createdBy !== "Muhammed Febin" && item.createdBy !== "System") {
        return false;
      }

      // Event Type filter
      if (eventTypeFilter === "FOLLOWUPS" && item.status === "CANCELLED") return false;
      if (eventTypeFilter === "COMPLETED" && item.status !== "COMPLETED") return false;
      if (eventTypeFilter === "OVERDUE") {
        const isOverdue = item.status === "SCHEDULED" && item.scheduledAt < nowIso && !item.scheduledAt.startsWith("2026-08-31");
        if (!isOverdue) return false;
      }
      if (eventTypeFilter === "ENTRIES") {
        if (item.type !== "VISIT" && item.type !== "MEETING") return false;
      }

      return true;
    });
  }, [followUps, eventTypeFilter, ownershipFilter]);

  // Dynamic KPI Metrics for selected month view
  const metrics = useMemo(() => {
    const activeYear = currentDate.getFullYear();
    const activeMonth = currentDate.getMonth();

    const monthEvents = filteredEvents.filter((e) => {
      const d = new Date(e.scheduledAt);
      return d.getFullYear() === activeYear && d.getMonth() === activeMonth;
    });

    const stageFollowUps = monthEvents.filter((e) => e.status === "SCHEDULED").length;
    const stageEntries = monthEvents.length;
    const overdueCount = followUps.filter(
      (e) => e.status === "SCHEDULED" && e.scheduledAt < "2026-08-31T00:00:00.000Z"
    ).length;
    const completedCount = followUps.filter((e) => e.status === "COMPLETED").length;
    const totalFinished = completedCount + overdueCount;
    const delayRate = totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 94;

    return {
      stageFollowUps,
      stageEntries,
      overdueCount,
      delayRate: `${delayRate}% On-time`,
    };
  }, [currentDate, filteredEvents, followUps]);

  // Calendar Grid Days Calculation
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Get day of week for 1st of month (Monday = 0, Sunday = 6)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday fix

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];

    // Previous month padding days
    for (let i = startDayOfWeek; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      const isoDate = d.toISOString().split("T")[0];
      days.push({ date: d, dateStr: isoDate, isCurrentMonth: false, isToday: false });
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const isToday = isoDate === "2026-08-31";
      days.push({ date: d, dateStr: isoDate, isCurrentMonth: true, isToday });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const isoDate = d.toISOString().split("T")[0];
      days.push({ date: d, dateStr: isoDate, isCurrentMonth: false, isToday: false });
    }

    return days;
  }, [currentDate]);

  // Map events by dateStr
  const eventsByDate = useMemo(() => {
    const map: Record<string, FollowUpEvent[]> = {};
    for (const ev of filteredEvents) {
      const datePart = ev.scheduledAt.split("T")[0];
      if (!map[datePart]) map[datePart] = [];
      map[datePart].push(ev);
    }
    return map;
  }, [filteredEvents]);

  // Search Lead Options
  const filteredLeadOptions = useMemo(() => {
    if (!leadSearchQuery.trim()) return INITIAL_LEADS;
    const q = leadSearchQuery.toLowerCase().trim();
    return INITIAL_LEADS.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q))
    );
  }, [leadSearchQuery]);

  // Handlers
  const handleOpenScheduleModal = (datePrefill?: string) => {
    setSelectedLead(null);
    setLeadSearchQuery("");
    setFollowUpType("CALL");
    if (datePrefill) {
      setScheduledDateStr(datePrefill);
    } else {
      setScheduledDateStr("2026-08-31");
    }
    setScheduledTimeStr("10:30");
    setDescriptionText("");
    setFormError("");
    setIsCreateModalOpen(true);
  };

  const handleSaveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedLead) {
      setFormError("Please select a Lead.");
      return;
    }

    if (!scheduledDateStr || !scheduledTimeStr) {
      setFormError("Please choose a valid Date and Time.");
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      const isoScheduled = `${scheduledDateStr}T${scheduledTimeStr}:00.000Z`;
      const nowIso = new Date().toISOString();

      const newEvent: FollowUpEvent = {
        id: `fw-${Date.now()}`,
        leadId: selectedLead.id,
        leadName: selectedLead.name,
        leadCompany: selectedLead.company,
        type: followUpType,
        scheduledAt: isoScheduled,
        description: descriptionText.trim() || undefined,
        status: "SCHEDULED",
        stageShortForm: selectedLead.stageKey === "NEW" ? "NEW" : selectedLead.stageKey === "CONTACTED" ? "CNT" : "FU",
        stageColor: selectedLead.stageColor || "#0066FF",
        createdBy: "Muhammed Febin",
        createdAt: nowIso,
      };

      setFollowUps((prev) => [newEvent, ...prev]);
      setIsSaving(false);
      setIsCreateModalOpen(false);
    }, 200);
  };

  const handleCompleteEvent = (eventId: string) => {
    const nowIso = new Date().toISOString();
    setFollowUps((prev) =>
      prev.map((item) =>
        item.id === eventId
          ? { ...item, status: "COMPLETED", completedAt: nowIso }
          : item
      )
    );
    setActiveEventDetail(null);
  };

  const handleCancelEvent = (eventId: string) => {
    setFollowUps((prev) =>
      prev.map((item) =>
        item.id === eventId
          ? { ...item, status: "CANCELLED" }
          : item
      )
    );
    setActiveEventDetail(null);
  };

  const formatTimeStr = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      return "10:30 AM";
    }
  };

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
          background: "#12131A",
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
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#FFF", margin: "2px 0 0", fontFamily: "Inter, system-ui, sans-serif" }}>
              {monthYearLabel}
            </h1>
            <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>
              Track pending and completed Follow-Ups with a calendar-first workflow.
            </p>
          </div>

          {/* Today & Arrows */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#181924", border: "1px solid rgba(255, 255, 255, 0.08)", padding: 4, borderRadius: 10 }}>
            <button
              type="button"
              onClick={handleToday}
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
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                border: "none",
                background: "transparent",
                color: "#FFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                border: "none",
                background: "transparent",
                color: "#FFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Right Controls: View Switcher, Filters & Action Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* View Selector (Month, Week, Day, List) */}
          <div style={{ display: "flex", gap: 3, background: "#181924", padding: 3, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
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
              background: "#181924",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 9,
              color: "#FFF",
              fontSize: 12,
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="FOLLOWUPS">Follow-Ups</option>
            <option value="ALL">All Activities</option>
            <option value="ENTRIES">Lead Stage Entries</option>
            <option value="COMPLETED">Completed Follow-Ups</option>
            <option value="OVERDUE">Overdue Tasks</option>
          </select>

          {/* Ownership Filter */}
          <select
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value as any)}
            style={{
              height: 38,
              padding: "0 12px",
              background: "#181924",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 9,
              color: "#FFF",
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#E6C200";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#0066FF";
              e.currentTarget.style.transform = "translateY(0)";
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
            background: "#12131A",
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
            <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              STAGE FOLLOW-UPS
            </span>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#FFFFFF", marginTop: 2, fontFamily: "Inter, system-ui, sans-serif" }}>
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
            background: "#12131A",
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
            <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
            background: "#12131A",
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
            <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
            background: "#12131A",
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
            <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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

      {/* 3. MONTH CALENDAR GRID */}
      <div
        style={{
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          borderRadius: 18,
          padding: 20,
          boxShadow: "0 8px 28px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* DAY HEADERS (MON, TUE, WED, THU, FRI, SAT, SUN) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 8, textAlign: "center" }}>
          {(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const).map((dayName) => (
            <div key={dayName} style={{ padding: "10px 0", fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em" }}>
              {dayName}
            </div>
          ))}
        </div>

        {/* 7-COLUMN MONTH GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {calendarGrid.map((dayItem) => {
            const dayEvents = eventsByDate[dayItem.dateStr] || [];
            const isToday = dayItem.isToday;

            return (
              <div
                key={dayItem.dateStr}
                style={{
                  minHeight: 140,
                  background: dayItem.isCurrentMonth ? "#181924" : "rgba(18, 19, 26, 0.5)",
                  border: isToday ? "2px solid #0066FF" : "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 12,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (dayEvents.length > 0) {
                    setSelectedDayEvents({ date: dayItem.dateStr, events: dayEvents });
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
                {/* Date Cell Top Number */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                    }}
                  >
                    {dayItem.date.getDate()}
                  </span>

                  {dayEvents.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", background: "rgba(0, 229, 255,0.15)", padding: "1px 6px", borderRadius: 10 }}>
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Event Chips (Up to 3) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "6px 0", flex: 1, overflow: "hidden" }}>
                  {dayEvents.slice(0, 3).map((ev) => {
                    const isOverdue = ev.status === "SCHEDULED" && ev.scheduledAt < "2026-08-31T00:00:00.000Z";
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
                          color: "#FFF",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", whiteSpace: "nowrap" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ev.stageColor || "#0066FF", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ev.stageShortForm ? `${ev.stageShortForm} ` : ""}{ev.type} - {ev.leadName}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>
                          {formatTimeStr(ev.scheduledAt)}
                        </span>
                      </div>
                    );
                  })}

                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textAlign: "center", padding: "2px 0" }}>
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>

                {/* Date Cell Bottom Plus hint */}
                <div style={{ fontSize: 10, color: "#64748B", textAlign: "right", opacity: 0.6 }}>
                  + Add task
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE FOLLOW-UP MODAL (Matching Reference Layout) */}
      {isCreateModalOpen && (
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
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 660,
              background: "#12131A",
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
                padding: "22px 28px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#161722",
              }}
            >
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  CRM SCHEDULING
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>
                  Create Follow-Up
                </h2>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0" }}>
                  Schedule a new call, visit, or meeting for a Lead.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  background: "#181924",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  color: "#94A3B8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Modal Form */}
            <form
              id="createFollowUpForm"
              onSubmit={handleSaveFollowUp}
              style={{
                padding: "26px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Error Banner */}
              {formError && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#F87171", fontSize: 12, fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              {/* FIELD 1: LEAD (Searchable Selector) */}
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
                      background: "#181924",
                      border: "1px solid #0066FF",
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#FFF" }}>{selectedLead.name}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{selectedLead.company || selectedLead.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLead(null)}
                      style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
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
                          background: "#181924",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: 10,
                          color: "#FFFFFF",
                          fontSize: 13,
                          outline: "none",
                        }}
                      />
                    </div>

                    <div style={{ maxHeight: 150, overflowY: "auto", background: "#181924", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 10, padding: 4 }}>
                      {filteredLeadOptions.map((l) => (
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
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{l.name}</span>
                            <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 8 }}>{l.company}</span>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: l.stageColor, background: `${l.stageColor}20`, padding: "2px 6px", borderRadius: 4 }}>
                            {l.stageKey}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, display: "block" }}>
                  Pick the Lead by name, email, or phone. The system will submit the correct Lead ID automatically.
                </span>
              </div>

              {/* FIELD 2: TYPE (Dropdown: Call, Visit, Meeting) */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  TYPE *
                </label>
                <select
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value as any)}
                  style={{
                    width: "100%",
                    height: 46,
                    padding: "0 14px",
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    fontSize: 13,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="CALL">Call</option>
                  <option value="VISIT">Visit</option>
                  <option value="MEETING">Meeting</option>
                </select>
              </div>

              {/* FIELD 3: SCHEDULED AT (Date & Time) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    SCHEDULED DATE *
                  </label>
                  <input
                    type="date"
                    value={scheduledDateStr}
                    onChange={(e) => setScheduledDateStr(e.target.value)}
                    style={{
                      width: "100%",
                      height: 46,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 13,
                      outline: "none",
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    SCHEDULED TIME *
                  </label>
                  <input
                    type="time"
                    value={scheduledTimeStr}
                    onChange={(e) => setScheduledTimeStr(e.target.value)}
                    style={{
                      width: "100%",
                      height: 46,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 13,
                      outline: "none",
                    }}
                    required
                  />
                </div>
              </div>

              {/* FIELD 4: DESCRIPTION */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  DESCRIPTION
                </label>
                <textarea
                  rows={3}
                  placeholder="Add context for the upcoming interaction"
                  value={descriptionText}
                  onChange={(e) => setDescriptionText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    color: "#FFFFFF",
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
                padding: "18px 28px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#161722",
              }}
            >
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 9,
                  background: "#181924",
                  color: "#CBD5E1",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="createFollowUpForm"
                disabled={isSaving}
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
                  cursor: isSaving ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(0, 229, 255, 0.25)",
                }}
              >
                <CalendarIcon style={{ width: 16, height: 16 }} />
                {isSaving ? "Scheduling..." : "Schedule Follow-Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT DETAIL / COMPLETE MODAL */}
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
          onClick={() => setActiveEventDetail(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#12131A",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              padding: 24,
              borderRadius: 18,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase" }}>
                  {activeEventDetail.type} TASK
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>
                  {activeEventDetail.leadName}
                </h3>
                {activeEventDetail.leadCompany && (
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{activeEventDetail.leadCompany}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveEventDetail(null)}
                style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "#181924", borderRadius: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#CBD5E1" }}>
                <strong>Scheduled:</strong> {new Date(activeEventDetail.scheduledAt).toLocaleString()}
              </div>
              {activeEventDetail.description && (
                <div style={{ fontSize: 12, color: "#94A3B8" }}>
                  <strong>Notes:</strong> {activeEventDetail.description}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#CBD5E1" }}>
                <strong>Status:</strong>{" "}
                <span style={{ color: activeEventDetail.status === "COMPLETED" ? "#10B981" : "#0066FF", fontWeight: 700 }}>
                  {activeEventDetail.status}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => handleCancelEvent(activeEventDetail.id)}
                style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "#181924", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 8, color: "#EF4444", cursor: "pointer" }}
              >
                Cancel Task
              </button>
              {activeEventDetail.status !== "COMPLETED" && (
                <button
                  type="button"
                  onClick={() => handleCompleteEvent(activeEventDetail.id)}
                  style={{ padding: "8px 18px", fontSize: 12, fontWeight: 800, background: "#10B981", color: "#FFF", border: "none", borderRadius: 8, cursor: "pointer" }}
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
