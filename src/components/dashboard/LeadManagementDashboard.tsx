"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserCheck,
  Flame,
  Clock,
  Trophy,
  Percent,
  Plus,
  AlertCircle,
  Phone,
  RefreshCw,
  CheckCircle2,
  Share2,
  ArrowUpRight,
  TrendingUp,
  Search,
  Calendar,
  ChevronDown,
} from "lucide-react";
import {
  DashboardSummaryPayload,
  LeadStage,
  PipelineLeadCard,
} from "@/lib/crm";
import { CrmActivityCalendar } from "./CrmActivityCalendar";
import { LeadLivePipeline } from "./LeadLivePipeline";
import { LeadGrowthChart } from "./LeadGrowthChart";
import { AddLeadModal } from "./AddLeadModal";

interface LeadManagementDashboardProps {
  userName: string;
  onNavigateTab?: (tab: string) => void;
}

export function LeadManagementDashboard({ userName, onNavigateTab }: LeadManagementDashboardProps) {
  const [data, setData] = useState<DashboardSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Modal States
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  // Schedule Follow-Up Modal State
  const [scheduleLead, setScheduleLead] = useState<PipelineLeadCard | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dashboard/lead-summary");
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(payload);
      } else {
        setError(payload.message || "Failed to load lead summary.");
      }
    } catch {
      setError("Network issue. Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  // Follow-Up Completion Handler
  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      const res = await fetch(`/api/leads/follow-ups/${followUpId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (res.ok) {
        await fetchDashboardData(true);
      }
    } catch (err) {
      console.error("Failed to complete follow up:", err);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleLead || !scheduleDate) return;
    setScheduling(true);

    try {
      const res = await fetch(`/api/leads/${scheduleLead.id}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: scheduleDate,
          note: scheduleNote,
        }),
      });

      if (res.ok) {
        setScheduleLead(null);
        setScheduleDate("");
        setScheduleNote("");
        await fetchDashboardData(true);
      } else {
        alert("Failed to schedule follow-up.");
      }
    } catch {
      alert("Network error scheduling follow-up.");
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="crm-dashboard-skeleton-container" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="crm-skeleton-header" style={{ height: 50, borderRadius: 14, background: "#12131A" }} />
        <div className="crm-skeleton-header" style={{ height: 45, borderRadius: 14, background: "#12131A" }} />
        <div className="crm-skeleton-grid" style={{ height: 165, borderRadius: 14, background: "#12131A" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="crm-dashboard-error-container" style={{ padding: 32, textAlign: "center", background: "#12131A", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 16 }}>
        <AlertCircle style={{ width: 40, height: 40, color: "#EF4444", margin: "0 auto 12px" }} />
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#FFF", marginBottom: 4 }}>Couldn't Load Lead Command Center</h3>
        <p style={{ fontSize: 13, color: "#8A909A", marginBottom: 16 }}>{error || "We couldn't load your lead summary data."}</p>
        <button type="button" onClick={() => fetchDashboardData()} className="crm-btn-add-lead">
          <RefreshCw style={{ width: 16, height: 16 }} /> Retry Loading
        </button>
      </div>
    );
  }

  const { kpis, attentionItems, pipelineCounts, todaysFollowUps, overdueFollowUps, recentActivity, sourceStats } = data;
  const totalDueFollowUps = todaysFollowUps.length + overdueFollowUps.length;

  return (
    <div className="crm-lead-dashboard">
      {/* 1. TOP UTILITY TOOLBAR (Matching Reference Header) */}
      <div className="crm-top-toolbar">
        <div className="crm-search-bar">
          <Search className="crm-search-icon" />
          <input
            type="text"
            placeholder="Search leads, users, configurations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="crm-search-input"
          />
          <span className="crm-kbd-badge">⌘K</span>
        </div>

        <div className="crm-top-actions">
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="crm-btn-icon-refresh"
            title="Refresh dashboard"
          >
            <RefreshCw style={{ width: 16, height: 16, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          </button>

          <button
            type="button"
            onClick={() => setAddLeadOpen(true)}
            className="crm-btn-add-lead"
          >
            <Plus style={{ width: 16, height: 16 }} />
            Add Lead
          </button>
        </div>
      </div>

      {/* 2. FILTER CONTROLS TOOLBAR (Matching Reference Filter Inputs) */}
      <div className="crm-filter-toolbar">
        <div className="crm-filter-grid">
          {/* Office Location */}
          <div className="crm-filter-control-wrap">
            <select
              value={officeFilter}
              onChange={(e) => setOfficeFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Office Location</option>
              <option value="main">Main Office</option>
              <option value="branch1">Branch Office</option>
            </select>
            <ChevronDown className="crm-filter-arrow" />
          </div>

          {/* User */}
          <div className="crm-filter-control-wrap">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">User</option>
              <option value="all">All Users</option>
              <option value="me">My Leads</option>
            </select>
            <ChevronDown className="crm-filter-arrow" />
          </div>

          {/* Lead Stage */}
          <div className="crm-filter-control-wrap">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Lead Stage</option>
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="INTERESTED">INTERESTED</option>
              <option value="FOLLOW_UP">FOLLOW_UP</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>
            <ChevronDown className="crm-filter-arrow" />
          </div>

          {/* Lead Source */}
          <div className="crm-filter-control-wrap">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Lead Source</option>
              <option value="NFC">NFC Tap</option>
              <option value="QR">QR Scan</option>
              <option value="Direct">Direct</option>
            </select>
            <ChevronDown className="crm-filter-arrow" />
          </div>

          {/* Status */}
          <div className="crm-filter-control-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
            <ChevronDown className="crm-filter-arrow" />
          </div>

          {/* Start Date */}
          <div className="crm-filter-control-wrap">
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="crm-filter-date"
            />
          </div>

          {/* End Date */}
          <div className="crm-filter-control-wrap">
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="crm-filter-date"
            />
          </div>
        </div>
      </div>

      {/* 3. COMPACT KPI CARDS GRID (Matching Reference Layout) */}
      <div className="crm-kpi-grid">
        {/* Card 1: Today's Leads */}
        <div className="crm-kpi-card">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">TODAY'S LEADS</span>
            <div className="crm-kpi-badge">
              <Flame style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div className="crm-kpi-value">{kpis.newLeads}</div>
          <div className="crm-kpi-sub">
            <TrendingUp style={{ width: 12, height: 12 }} /> Total leads
          </div>
        </div>

        {/* Card 2: Total Leads */}
        <div className="crm-kpi-card">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">TOTAL LEADS</span>
            <div className="crm-kpi-badge">
              <Users style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div className="crm-kpi-value">{kpis.totalLeads}</div>
          <div className="crm-kpi-sub" style={{ color: "#F87171" }}>
            <TrendingUp style={{ width: 12, height: 12, transform: "rotate(180deg)" }} /> All leads
          </div>
        </div>

        {/* Card 3: Closed Leads */}
        <div className="crm-kpi-card">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">CLOSED LEADS</span>
            <div className="crm-kpi-badge">
              <CheckCircle2 style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div className="crm-kpi-value">{kpis.wonLeads}</div>
          <div className="crm-kpi-sub">
            <TrendingUp style={{ width: 12, height: 12 }} /> Total closed leads
          </div>
        </div>

        {/* Card 4: Interested Leads */}
        <div className="crm-kpi-card">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">INTERESTED</span>
            <div className="crm-kpi-badge">
              <UserCheck style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div className="crm-kpi-value" style={{ color: "#0066FF" }}>{kpis.interestedLeads}</div>
          <div className="crm-kpi-sub">
            <TrendingUp style={{ width: 12, height: 12 }} /> High intent leads
          </div>
        </div>

        {/* Card 5: Follow-Ups */}
        <div className="crm-kpi-card">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">FOLLOW-UPS</span>
            <div className="crm-kpi-badge">
              <Clock style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div className="crm-kpi-value" style={{ color: "#0066FF" }}>{kpis.followUpLeads}</div>
          <div className="crm-kpi-sub">
            <TrendingUp style={{ width: 12, height: 12 }} /> Active follow-up stage
          </div>
        </div>

        {/* Card 6: Won Deals */}
        <div className="crm-kpi-card">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">WON DEALS</span>
            <div className="crm-kpi-badge">
              <Trophy style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div className="crm-kpi-value" style={{ color: "#10B981" }}>{kpis.wonLeads}</div>
          <div className="crm-kpi-sub">
            <TrendingUp style={{ width: 12, height: 12 }} /> Converted deals
          </div>
        </div>

        {/* Card 7: Conversion Rate */}
        <div className="crm-kpi-card">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">CONVERSION</span>
            <div className="crm-kpi-badge">
              <Percent style={{ width: 16, height: 16 }} />
            </div>
          </div>
          <div className="crm-kpi-value" style={{ color: "#3B82F6" }}>{kpis.conversionRate}%</div>
          <div className="crm-kpi-sub">
            <TrendingUp style={{ width: 12, height: 12 }} /> Won / Total leads
          </div>
        </div>
      </div>

      {/* 4. DAILY FOLLOW-UP CAPACITY STRIP (Matching Reference Card) */}
      <div className="crm-capacity-strip">
        <div className="crm-capacity-left">
          <div className="crm-capacity-icon-badge">
            <Calendar style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <h3 className="crm-capacity-title">Daily Follow-Up Capacity</h3>
            <p className="crm-capacity-sub">Daily follow-up limit is currently disabled.</p>
          </div>
        </div>

        <div className="crm-capacity-pill">
          <CheckCircle2 style={{ width: 14, height: 14 }} />
          Today's Follow-Ups: {totalDueFollowUps}
        </div>
      </div>

      {/* 5. MAIN ANALYTICS 2-COLUMN ROW (66% Lead Growth / 34% Pipeline Stages) */}
      <div className="crm-analytics-row">
        {/* Left 66%: Growth Velocity — Lead Acquisition */}
        <div className="crm-chart-card">
          <LeadGrowthChart
            growthTimeline={data.growthTimeline}
            recentActivity={recentActivity}
            totalLeads={kpis.totalLeads}
          />
        </div>

        {/* Right 34%: Pipeline Stages */}
        <div className="crm-pipeline-card">
          <LeadLivePipeline
            pipelineCounts={pipelineCounts}
            totalLeads={kpis.totalLeads}
            onSelectStage={() => onNavigateTab && onNavigateTab("cards")}
          />
        </div>
      </div>

      {/* 6. COMPACT CRM CALENDAR & TODAY'S FOLLOW-UPS (63% / 37%) */}
      <div className="crm-insights-row">
        {/* Left 63%: Compact CRM Calendar */}
        <div className="crm-calendar-card">
          <CrmActivityCalendar />
        </div>

        {/* Right 37%: Today's Follow-Ups Panel */}
        <div className="crm-followups-card">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>TASKS</span>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>Today's Follow-Ups</h2>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(0, 229, 255, 0.15)", color: "#0066FF", border: "1px solid rgba(0, 229, 255, 0.3)", padding: "2px 10px", borderRadius: 50 }}>
                {totalDueFollowUps} Due
              </span>
            </div>

            <div className="scrollbar-thin" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {/* Overdue Follow-Ups */}
              {overdueFollowUps.map((fu) => (
                <div key={fu.id} style={{ padding: 12, background: "#181924", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(239, 68, 68, 0.2)", color: "#F87171", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>OVERDUE</span>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#FFF", margin: "4px 0 0" }}>{fu.leadName}</h4>
                      {fu.companyName && <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>{fu.companyName}</p>}
                    </div>
                    <a href={`tel:${fu.contactNumber}`} style={{ fontSize: 12, color: "#0066FF", display: "flex", alignItems: "center", gap: 4 }}>
                      <Phone style={{ width: 12, height: 12 }} />
                      {fu.contactNumber}
                    </a>
                  </div>
                  {fu.note && <p style={{ fontSize: 12, color: "#CBD5E1", fontStyle: "italic", margin: "6px 0 8px" }}>"{fu.note}"</p>}
                  <button
                    type="button"
                    onClick={() => handleCompleteFollowUp(fu.id)}
                    style={{ width: "100%", padding: "6px 0", fontSize: 12, fontWeight: 700, background: "rgba(16, 185, 129, 0.2)", color: "#34D399", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <CheckCircle2 style={{ width: 14, height: 14 }} /> Complete Task
                  </button>
                </div>
              ))}

              {/* Today's Follow-Ups */}
              {todaysFollowUps.map((fu) => (
                <div key={fu.id} style={{ padding: 12, background: "#181924", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(245, 158, 11, 0.2)", color: "#FBBF24", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>TODAY</span>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#FFF", margin: "4px 0 0" }}>{fu.leadName}</h4>
                      {fu.companyName && <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>{fu.companyName}</p>}
                    </div>
                    <a href={`tel:${fu.contactNumber}`} style={{ fontSize: 12, color: "#0066FF", display: "flex", alignItems: "center", gap: 4 }}>
                      <Phone style={{ width: 12, height: 12 }} />
                      {fu.contactNumber}
                    </a>
                  </div>
                  {fu.note && <p style={{ fontSize: 12, color: "#CBD5E1", fontStyle: "italic", margin: "6px 0 8px" }}>"{fu.note}"</p>}
                  <button
                    type="button"
                    onClick={() => handleCompleteFollowUp(fu.id)}
                    style={{ width: "100%", padding: "6px 0", fontSize: 12, fontWeight: 700, background: "rgba(16, 185, 129, 0.2)", color: "#34D399", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <CheckCircle2 style={{ width: 14, height: 14 }} /> Complete Task
                  </button>
                </div>
              ))}

              {todaysFollowUps.length === 0 && overdueFollowUps.length === 0 && (
                <div style={{ textAlign: "center", padding: "36px 0", color: "#64748B" }}>
                  <CheckCircle2 style={{ width: 32, height: 32, color: "#10B981", margin: "0 auto 8px" }} />
                  <p style={{ fontWeight: 700, color: "#FFF", margin: 0 }}>You're all caught up!</p>
                  <span style={{ fontSize: 12 }}>No follow-ups scheduled for today.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Add Lead Modal */}
      <AddLeadModal
        isOpen={addLeadOpen}
        onClose={() => setAddLeadOpen(false)}
        onLeadAdded={() => fetchDashboardData(true)}
      />

      {/* Schedule Follow-Up Modal */}
      {scheduleLead && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setScheduleLead(null)}>
          <div style={{ width: "100%", maxWidth: 440, background: "#12131A", border: "1px solid rgba(0, 229, 255,0.3)", padding: 24, borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>SCHEDULE TASK</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#FFF", margin: "4px 0 0" }}>Schedule Follow-Up</h2>
            </div>

            <form onSubmit={handleScheduleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: "#CBD5E1", margin: 0 }}>
                Lead: <strong style={{ color: "#0066FF" }}>{scheduleLead.name}</strong>
              </p>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 4 }}>Date & Time *</label>
                <input
                  type="datetime-local"
                  style={{ width: "100%", padding: "10px 12px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 12, outline: "none" }}
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 4 }}>Note / Task Description</label>
                <textarea
                  style={{ width: "100%", padding: "10px 12px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 12, outline: "none", resize: "none" }}
                  placeholder="e.g. Call regarding pricing proposal"
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  rows={3}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setScheduleLead(null)}
                  style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, borderRadius: 8, background: "#181924", color: "#CBD5E1", border: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  style={{ padding: "8px 18px", fontSize: 12, fontWeight: 800, borderRadius: 8, background: "#0066FF", color: "#07080B", border: "none", cursor: "pointer" }}
                >
                  {scheduling ? "SCHEDULING..." : "SCHEDULE FOLLOW-UP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
