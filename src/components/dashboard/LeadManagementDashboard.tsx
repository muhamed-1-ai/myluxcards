import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Users,
  UserCheck,
  Flame,
  Clock,
  Plus,
  AlertCircle,
  Phone,
  RefreshCw,
  CheckCircle2,
  Share2,
  ArrowUpRight,
  TrendingUp,
  Search,
  ChevronDown,
  SlidersHorizontal,
  LayoutGrid,
  Calendar,
  RotateCcw,
  AlertTriangle,
  DollarSign,
  BarChart2,
  IndianRupee,
  Layers,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  DashboardSummaryPayload,
  LeadStage,
  PipelineLeadCard,
  LostStageMetric,
  LeadKpis,
} from "@/lib/crm";
import { LeadLivePipeline } from "./LeadLivePipeline";
import { LeadGrowthChart } from "./LeadGrowthChart";
import { CompactDashboardCalendar } from "./CompactDashboardCalendar";
import { apiFetch } from "@/lib/apiClient";
import { isFeatureAllowed } from "@/lib/permissionsRegistry";
import {
  CustomizeDashboardDrawer,
  DEFAULT_DASHBOARD_CARDS,
  DEFAULT_DASHBOARD_SECTIONS,
  UserDashboardPreferences,
  ItemPreference,
} from "./CustomizeDashboardDrawer";

const CrmActivityCalendar = dynamic(
  () => import("./CrmActivityCalendar").then((mod) => mod.CrmActivityCalendar),
  { ssr: false }
);
const AddLeadModal = dynamic(
  () => import("./AddLeadModal").then((mod) => mod.AddLeadModal),
  { ssr: false }
);

interface LeadManagementDashboardProps {
  userName: string;
  identity?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    featurePermissions?: Record<string, boolean>;
  };
  onNavigateTab?: (tab: string) => void;
}

export function LeadManagementDashboard({ userName, identity, onNavigateTab }: LeadManagementDashboardProps) {
  const [data, setData] = useState<DashboardSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Customization Preferences State
  const [userPrefs, setUserPrefs] = useState<UserDashboardPreferences>(() => ({
    version: 1,
    cards: DEFAULT_DASHBOARD_CARDS,
    sections: DEFAULT_DASHBOARD_SECTIONS,
  }));
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeTab, setCustomizeTab] = useState<"cards" | "sections">("cards");

  // Permission evaluation for Customize Dashboard (requires Lead Management "all_leads" permission)
  const canCustomize = useMemo(() => {
    if (!identity || !identity.featurePermissions) return false;
    return isFeatureAllowed(identity.featurePermissions, "all_leads", identity.role);
  }, [identity]);

  // Immediately close drawer if permission is revoked
  useEffect(() => {
    if (!canCustomize && customizeOpen) {
      setCustomizeOpen(false);
    }
  }, [canCustomize, customizeOpen]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const [retryAttempt, setRetryAttempt] = useState(0);
  const inFlightRef = useRef(false);
  const latestRequestIdRef = useRef(0);

  // Clear private statistics when logging out or switching accounts
  useEffect(() => {
    setData(null);
    setError("");
  }, [identity?.id]);

  // Debounce search query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Dashboard Customization Preferences (only when Lead Management is enabled)
  useEffect(() => {
    if (!canCustomize) return;

    const storageKey = identity?.id ? `zappit_dashboard_prefs_${identity.id}` : "zappit_dashboard_prefs_guest";
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.cards) && Array.isArray(parsed.sections)) {
          setUserPrefs(parsed);
        }
      }
    } catch {}

    let active = true;
    fetch("/api/user/dashboard-preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (active && resData?.preferences) {
          setUserPrefs(resData.preferences);
          try {
            localStorage.setItem(storageKey, JSON.stringify(resData.preferences));
          } catch {}
        }
      })
      .catch((err) => console.error("Failed to load user dashboard preferences:", err));

    return () => {
      active = false;
    };
  }, [identity?.id, canCustomize]);

  const handleSaveCustomization = async (newPrefs: UserDashboardPreferences) => {
    if (!canCustomize) {
      throw new Error("Lead Management permission is required to customize the dashboard.");
    }

    const storageKey = identity?.id ? `zappit_dashboard_prefs_${identity.id}` : "zappit_dashboard_prefs_guest";
    setUserPrefs(newPrefs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPrefs));
    } catch {}

    const res = await fetch("/api/user/dashboard-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: newPrefs }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.message || "Failed to save dashboard customization.");
    }
  };

  const fetchDashboardData = useCallback(
    async (isRefresh = false, signal?: AbortSignal) => {
      const requestId = ++latestRequestIdRef.current;
      inFlightRef.current = true;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      setRetryAttempt(0);

      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [1000, 2000, 5000];

      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.set("search", debouncedSearch);
        if (officeFilter) queryParams.set("office", officeFilter);
        if (userFilter) queryParams.set("user", userFilter);
        if (stageFilter) queryParams.set("stage", stageFilter);
        if (sourceFilter) queryParams.set("source", sourceFilter);
        if (statusFilter) queryParams.set("status", statusFilter);
        if (startDateFilter) queryParams.set("startDate", startDateFilter);
        if (endDateFilter) queryParams.set("endDate", endDateFilter);

        const queryString = queryParams.toString();
        const endpoint = `/api/dashboard/lead-summary${queryString ? `?${queryString}` : ""}`;

        let lastError = "";
        let success = false;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (signal?.aborted || requestId !== latestRequestIdRef.current) break;

          if (attempt > 0) {
            setRetryAttempt(attempt);
            const delay = RETRY_DELAYS[attempt - 1] || 2000;
            await new Promise((resolve) => setTimeout(resolve, delay));
            if (signal?.aborted || requestId !== latestRequestIdRef.current) break;
          }

          const res = await apiFetch<DashboardSummaryPayload>(endpoint, { signal });
          if (requestId !== latestRequestIdRef.current) {
            return;
          }

          if (res.ok && res.data) {
            setData(res.data);
            success = true;
            break;
          } else if (res.error === "Request aborted") {
            break;
          } else {
            lastError = res.error || "Failed to load lead summary.";
          }
        }

        if (!success && !signal?.aborted && requestId === latestRequestIdRef.current) {
          setError(lastError || "Network issue. Failed to load dashboard data.");
        }
      } catch (err: any) {
        if (!signal?.aborted && requestId === latestRequestIdRef.current) {
          setError(err?.message || "Network issue. Failed to load dashboard data.");
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          inFlightRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      debouncedSearch,
      officeFilter,
      userFilter,
      stageFilter,
      sourceFilter,
      statusFilter,
      startDateFilter,
      endDateFilter,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchDashboardData(false, controller.signal);
    return () => controller.abort();
  }, [fetchDashboardData]);

  const hasActiveFilters = Boolean(
    searchQuery || officeFilter || userFilter || stageFilter || sourceFilter || statusFilter || startDateFilter || endDateFilter
  );

  const clearAllFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setOfficeFilter("");
    setUserFilter("");
    setStageFilter("");
    setSourceFilter("");
    setStatusFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
  };

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

  // Normalized LOB Analysis Data from backend summary
  const lobAnalysisData: LostStageMetric[] = useMemo(() => {
    return data?.lostLeadsByStage || [];
  }, [data?.lostLeadsByStage]);

  const totalLostCount = useMemo(() => {
    return lobAnalysisData.reduce((sum, item) => sum + item.count, 0);
  }, [lobAnalysisData]);

  const maxLobCount = useMemo(() => {
    if (!lobAnalysisData || lobAnalysisData.length === 0) return 1;
    const max = Math.max(...lobAnalysisData.map((d) => d.count), 0);
    return max > 0 ? max : 1;
  }, [lobAnalysisData]);

  // Generates clean, non-repeating integer tick marks for integer lead counts
  const lobYAxisTicks = useMemo(() => {
    if (maxLobCount <= 1) {
      return [1, 0];
    }
    if (maxLobCount <= 4) {
      const ticks: number[] = [];
      for (let i = maxLobCount; i >= 0; i--) {
        ticks.push(i);
      }
      return ticks;
    }
    const stepCount = 4;
    const roughStep = maxLobCount / stepCount;
    const niceStep = Math.max(1, Math.ceil(roughStep));
    const ticks: number[] = [];
    for (let i = stepCount; i >= 0; i--) {
      ticks.push(i * niceStep);
    }
    return ticks;
  }, [maxLobCount]);

  const lobTopVal = useMemo(() => {
    return Math.max(lobYAxisTicks[0] || 1, 1);
  }, [lobYAxisTicks]);


  // Individual Widget Feature Permission Evaluator
  const isWidgetFeatureAllowed = useCallback(
    (widgetId: string): boolean => {
      if (!identity?.featurePermissions) return true;
      const role = identity.role;
      const perms = identity.featurePermissions;

      if (role === "SUPER_ADMIN" || role === "ADMIN") return true;

      switch (widgetId) {
        case "lob_analysis":
          return isFeatureAllowed(perms, "lob_reasons", role);
        case "calendar_companion":
          return isFeatureAllowed(perms, "calendar", role);
        case "todays_leads":
        case "total_leads":
        case "closed_leads":
        case "active_users":
        case "daily_capacity":
        case "growth_pipeline":
          return isFeatureAllowed(perms, "all_leads", role);
        default:
          return true;
      }
    },
    [identity]
  );

  // Ordered & Visible KPI Cards (Filtered by user preferences AND feature permissions)
  const visibleCards = useMemo(() => {
    const saved = userPrefs.cards || DEFAULT_DASHBOARD_CARDS;
    const result: ItemPreference[] = [];

    saved.forEach((item) => {
      const def = DEFAULT_DASHBOARD_CARDS.find((d) => d.id === item.id);
      if (def && item.visible !== false && isWidgetFeatureAllowed(item.id)) {
        result.push({
          ...item,
          defaultTitle: def.defaultTitle,
        });
      }
    });

    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [userPrefs.cards, isWidgetFeatureAllowed]);

  // Ordered & Visible Sections (Filtered by user preferences AND feature permissions)
  const visibleSections = useMemo(() => {
    const saved = userPrefs.sections || DEFAULT_DASHBOARD_SECTIONS;
    const result: ItemPreference[] = [];

    saved.forEach((item) => {
      const def = DEFAULT_DASHBOARD_SECTIONS.find((d) => d.id === item.id);
      if (def && item.visible !== false && isWidgetFeatureAllowed(item.id)) {
        result.push({
          ...item,
          defaultTitle: def.defaultTitle,
        });
      }
    });

    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [userPrefs.sections, isWidgetFeatureAllowed]);

  // NOTE: We intentionally do NOT early-return on loading/error.
  // The top bar controls (Add Lead, Refresh, Customize) must always be rendered
  // and interactive — even while dashboard data is still loading.
  // Loading/error states are shown inline below the top bar.

  const DEFAULT_KPIS: LeadKpis = {
    totalLeads: 0,
    newLeads: 0,
    todaysLeads: 0,
    contactedLeads: 0,
    interestedLeads: 0,
    followUpLeads: 0,
    wonLeads: 0,
    closedLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    activeUsers: 1,
  };

  const kpis = data?.kpis || DEFAULT_KPIS;

  const todaysFollowUps = data?.todaysFollowUps || [];
  const DEFAULT_PIPELINE_COUNTS: Record<LeadStage, number> = {
    NEW: 0,
    CONTACTED: 0,
    INTERESTED: 0,
    FOLLOW_UP: 0,
    WON: 0,
    LOST: 0,
  };
  const pipelineCounts = data?.pipelineCounts || DEFAULT_PIPELINE_COUNTS;
  const recentActivity = data?.recentActivity || [];

  const activeUsersVal = String(kpis.activeUsers ?? data?.activeUsers ?? 1);

  const renderSectionItem = (secPref: ItemPreference) => {
    const title = secPref.displayName || secPref.defaultTitle;
    switch (secPref.id) {
      case "daily_capacity":
        return (
          <div key="daily_capacity" className="crm-capacity-card">
            <div className="crm-capacity-header">
              <div className="crm-capacity-icon-wrap">
                <Calendar style={{ width: 20, height: 20, color: "var(--accent-blue, #168BFF)" }} />
              </div>
              <div>
                <h3 className="crm-capacity-title">{title}</h3>
                <p className="crm-capacity-status">Daily follow-up limit is currently disabled.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab && onNavigateTab("leads")}
              className="crm-capacity-badge-btn"
            >
              <CheckCircle2 style={{ width: 16, height: 16 }} />
              Today's Follow-Ups: {todaysFollowUps.length}
            </button>
          </div>
        );

      case "growth_pipeline":
        return (
          <div key="growth_pipeline" className="crm-chart-row">
            <div className="crm-chart-card">
              <LeadGrowthChart
                growthTimeline={data?.growthTimeline}
                recentActivity={recentActivity}
                totalLeads={kpis.totalLeads}
              />
            </div>

            <div className="crm-pipeline-card">
              <LeadLivePipeline
                pipelineCounts={pipelineCounts}
                totalLeads={kpis.totalLeads}
                onSelectStage={() => onNavigateTab && onNavigateTab("cards")}
              />
            </div>
          </div>
        );


      case "lob_analysis":
      case "calendar_companion":
        // Handled by rendering combined row or single full-width card
        return null;

      default:
        return null;
    }
  };

  const isLobVisible = visibleSections.some((s) => s.id === "lob_analysis");
  const isCalendarVisible = visibleSections.some((s) => s.id === "calendar_companion");

  const lobPref = visibleSections.find((s) => s.id === "lob_analysis");
  const calendarPref = visibleSections.find((s) => s.id === "calendar_companion");

  return (
    <div className="crm-dashboard-root">
      {/* Top Controls Header */}
      <div className="crm-top-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="crm-btn-refresh"
            title="Refresh dashboard data"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} style={{ width: 14, height: 14 }} />
            {refreshing ? "Refreshing..." : "Refresh"}
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

      {/* DASHBOARD FILTERS CARD */}
      <div className="crm-filter-card">
        <div className="crm-filter-card-header">
          <div>
            <span className="crm-filter-label-title">DASHBOARD FILTERS</span>
            <p className="crm-filter-subtitle">
              Metrics refresh for every selected reporting filter.
            </p>
          </div>
          {canCustomize ? (
            <div className="crm-filter-btn-group">
              {/* Primary Customize Button */}
              <button
                type="button"
                onClick={() => {
                  if (!canCustomize) return;
                  setCustomizeTab("cards");
                  setCustomizeOpen(true);
                }}
                className="crm-btn-customize-primary"
              >
                <SlidersHorizontal style={{ width: 16, height: 16 }} />
                Customize Dashboard
              </button>
              <div className="crm-filter-btn-secondary-row">
                <button
                  type="button"
                  onClick={() => {
                    if (!canCustomize) return;
                    setCustomizeTab("sections");
                    setCustomizeOpen(true);
                  }}
                  className="crm-btn-manage-secondary"
                >
                  <LayoutGrid style={{ width: 15, height: 15 }} />
                  Manage Sections
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="crm-btn-clear-secondary"
                  >
                    <RotateCcw style={{ width: 14, height: 14 }} />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            hasActiveFilters && (
              <div className="crm-filter-btn-group">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="crm-btn-clear-secondary"
                >
                  <RotateCcw style={{ width: 14, height: 14 }} />
                  Clear Filters
                </button>
              </div>
            )
          )}
        </div>

        {/* Vertical Stacked Filter Inputs */}
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
              <option value="SHARE">Share</option>
              <option value="PROFILE_SHARE_DETAILS">Profile Share</option>
              <option value="MANUAL">Manual</option>
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
            <DatePicker
              value={startDateFilter}
              onChange={(dateStr) => setStartDateFilter(dateStr)}
              placeholder="Start Date"
              maxDate={endDateFilter || undefined}
            />
          </div>

          {/* End Date */}
          <div className="crm-filter-control-wrap">
            <DatePicker
              value={endDateFilter}
              onChange={(dateStr) => setEndDateFilter(dateStr)}
              placeholder="End Date"
              minDate={startDateFilter || undefined}
            />
          </div>
        </div>
      </div>

      {/* INLINE LOADING STATE — shown in data area while top bar remains interactive */}
      {loading && !data && (
        <div className="crm-loading-container">
          <div className="crm-loading-spinner" />
          <p className="crm-loading-text">
            {retryAttempt > 0
              ? `Initializing Lead Command Center... Retrying (Attempt ${retryAttempt}/3)...`
              : "Loading dashboard analytics..."}
          </p>
        </div>
      )}

      {/* INLINE ERROR STATE — shown in data area while top bar remains interactive */}
      {error && !data && !loading && (
        <div className="crm-error-container">
          <AlertCircle className="crm-error-icon" />
          <h3 className="crm-error-title">Unable to load dashboard</h3>
          <p className="crm-error-msg">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            className="crm-btn-primary"
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
            Try Again
          </button>
        </div>
      )}

      {/* EMPTY DASHBOARD STATE — only shown when loaded and genuinely empty */}
      {!loading && !error && visibleCards.length === 0 && visibleSections.length === 0 && (
        <div
          style={{
            padding: "60px 24px",
            background: "var(--surface)",
            border: "1px dashed var(--border-color)",
            borderRadius: 16,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            margin: "30px 0",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(0, 102, 255, 0.12)",
              color: "#0066FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LayoutGrid style={{ width: 32, height: 32 }} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 6px" }}>
              Your dashboard is currently empty
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, maxWidth: 420 }}>
              {canCustomize
                ? "You have hidden all dashboard cards and sections in your customization settings. Click below to customize your view."
                : "No dashboard cards or sections are currently visible."}
            </p>
          </div>
          {canCustomize && (
            <button
              type="button"
              onClick={() => {
                if (!canCustomize) return;
                setCustomizeTab("cards");
                setCustomizeOpen(true);
              }}
              className="crm-btn-customize-primary"
              style={{ padding: "10px 24px" }}
            >
              <SlidersHorizontal style={{ width: 16, height: 16 }} />
              Customize Dashboard
            </button>
          )}
        </div>
      )}

      {/* PRIMARY METRIC CARDS — only rendered after data loads */}
      {(!loading || data) && visibleCards.length > 0 && (
        <div className="crm-kpi-grid">
          {visibleCards.map((cardPref) => {
            const label = (cardPref.displayName || cardPref.defaultTitle).toUpperCase();
            switch (cardPref.id) {
              case "todays_leads":
                return (
                  <div key="todays_leads" className="crm-kpi-card">
                    <div className="crm-kpi-icon-wrap" style={{ background: "rgba(0, 102, 255, 0.12)", color: "#0066FF" }}>
                      <Flame style={{ width: 20, height: 20 }} />
                    </div>
                    <span className="crm-kpi-label">{label}</span>
                    <div className="crm-kpi-value">{kpis.todaysLeads ?? kpis.newLeads ?? 0}</div>
                    <div className="crm-kpi-sub-link">
                      <TrendingUp style={{ width: 14, height: 14, color: "var(--accent-blue, #168BFF)" }} /> Total leads
                    </div>
                  </div>
                );
              case "total_leads":
                return (
                  <div key="total_leads" className="crm-kpi-card">
                    <div className="crm-kpi-icon-wrap" style={{ background: "rgba(0, 102, 255, 0.12)", color: "#0066FF" }}>
                      <Users style={{ width: 20, height: 20 }} />
                    </div>
                    <span className="crm-kpi-label">{label}</span>
                    <div className="crm-kpi-value">{kpis.totalLeads ?? 0}</div>
                    <div className="crm-kpi-sub-link">
                      <TrendingUp style={{ width: 14, height: 14, color: "var(--accent-blue, #168BFF)" }} /> All leads
                    </div>
                  </div>
                );
              case "closed_leads":
                return (
                  <div key="closed_leads" className="crm-kpi-card">
                    <div className="crm-kpi-icon-wrap" style={{ background: "rgba(0, 102, 255, 0.12)", color: "#0066FF" }}>
                      <CheckCircle2 style={{ width: 20, height: 20 }} />
                    </div>
                    <span className="crm-kpi-label">{label}</span>
                    <div className="crm-kpi-value">{kpis.closedLeads ?? kpis.wonLeads ?? 0}</div>
                    <div className="crm-kpi-sub-link">
                      <TrendingUp style={{ width: 14, height: 14, color: "var(--accent-blue, #168BFF)" }} /> Total closed deals
                    </div>
                  </div>
                );

              case "active_users":
                return (
                  <div key="active_users" className="crm-kpi-card">
                    <div className="crm-kpi-icon-wrap" style={{ background: "rgba(0, 102, 255, 0.12)", color: "#0066FF" }}>
                      <TrendingUp style={{ width: 20, height: 20 }} />
                    </div>
                    <span className="crm-kpi-label">{label}</span>
                    <div className="crm-kpi-value">{activeUsersVal}</div>
                    <div className="crm-kpi-sub-link">
                      <TrendingUp style={{ width: 14, height: 14, color: "var(--accent-blue, #168BFF)" }} /> Total active users
                    </div>
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
      )}

      {/* DASHBOARD SECTIONS — only rendered after data loads */}
      {(!loading || data) && visibleSections.map((secPref) => {
        if (secPref.id === "lob_analysis" || secPref.id === "calendar_companion") {
          // Render combined or individual LOB/Calendar row only once when encountering the first one
          const firstLobOrCal = visibleSections.find(
            (s) => s.id === "lob_analysis" || s.id === "calendar_companion"
          );
          if (secPref.id !== firstLobOrCal?.id) return null;

          return (
            <div key="lob_calendar_combined_row" className="crm-lob-calendar-row">
              {isLobVisible && (
                <div className="crm-lob-card" style={{ flex: isCalendarVisible ? undefined : 1 }}>
                  <div className="crm-card-header-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="crm-kpi-icon-wrap" style={{ background: "rgba(0, 102, 255, 0.12)", color: "#0066FF" }}>
                        <AlertTriangle style={{ width: 18, height: 18 }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                          {lobPref?.displayName || "LOB Analysis"}
                        </h3>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                          LOST LEADS BY STAGE
                        </span>
                      </div>
                    </div>
                    {data && (
                      <span className="crm-lob-total-badge">
                        {totalLostCount} {totalLostCount === 1 ? "Lead" : "Leads"}
                      </span>
                    )}
                  </div>
                  <div className="crm-divider" style={{ margin: "16px 0 20px" }} />

                  {/* Loading Skeleton */}
                  {loading && !data && (
                    <div className="crm-lob-skeleton">
                      <div className="crm-lob-skeleton-row" />
                      <div className="crm-lob-skeleton-row" />
                      <div className="crm-lob-skeleton-row" />
                      <div className="crm-lob-skeleton-row" />
                    </div>
                  )}

                  {/* Error State */}
                  {error && !data && (
                    <div className="crm-lob-error-state">
                      <p>{error}</p>
                      <button
                        type="button"
                        onClick={() => void fetchDashboardData(true)}
                        className="crm-lob-retry-btn"
                      >
                        <RefreshCw style={{ width: 14, height: 14 }} />
                        <span>Retry</span>
                      </button>
                    </div>
                  )}

                  {/* Genuine Empty State */}
                  {!loading && data && totalLostCount === 0 && (
                    <div className="crm-lob-empty-state">
                      <p className="crm-lob-empty-title">No lost leads in this period</p>
                      <span className="crm-lob-empty-sub">
                        Leads that transition to Lost within active filters will appear here by stage.
                      </span>
                    </div>
                  )}

                  {/* Render Data Chart */}
                  {data && totalLostCount > 0 && (
                    <>
                      {/* Desktop: Vertical Bar Chart */}
                      <div className="crm-lob-desktop-chart">
                        <div className="crm-lob-vertical-chart-container">
                          <div className="crm-lob-y-axis">
                            {lobYAxisTicks.map((val, idx) => (
                              <div key={`lob-step-${val}-${idx}`} className="crm-lob-y-step">
                                <span className="crm-lob-y-label">{val}</span>
                                <div className="crm-lob-y-line" />
                              </div>
                            ))}
                          </div>

                          <div className="crm-lob-bars-area">
                            {lobAnalysisData.map((item) => {
                              const pct = totalLostCount > 0 ? Math.round((item.count / totalLostCount) * 100) : 0;
                              const heightPct = lobTopVal > 0 && item.count > 0 ? Math.min(100, Math.max(6, (item.count / lobTopVal) * 100)) : 0;
                              return (
                                <div key={item.stageId} className="crm-lob-bar-col">
                                  <div className="crm-lob-bar-wrapper">
                                    <div
                                      className="crm-lob-bar-fill"
                                      style={{ height: `${heightPct}%` }}
                                      aria-label={`${item.label}: ${item.count} leads (${pct}%)`}
                                    >
                                      <div className="crm-lob-bar-tooltip">
                                        <strong>{item.count} Leads</strong> ({pct}%)
                                      </div>
                                    </div>
                                  </div>
                                  <span className="crm-lob-x-label" title={item.label}>{item.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Mobile: Horizontal Bar Chart */}
                      <div className="crm-lob-mobile-chart">
                        <div className="crm-lob-horizontal-chart-container">
                          {lobAnalysisData.map((item) => {
                            const pct = totalLostCount > 0 ? Math.round((item.count / totalLostCount) * 100) : 0;
                            const widthPct = lobTopVal > 0 && item.count > 0 ? Math.min(100, Math.max(2, (item.count / lobTopVal) * 100)) : 0;
                            return (
                              <div
                                key={item.stageId}
                                className="crm-lob-hbar-row"
                                aria-label={`${item.label}: ${item.count} leads (${pct}%)`}
                              >
                                <div className="crm-lob-hbar-header">
                                  <span className="crm-lob-hbar-label" title={item.label}>
                                    {item.label}
                                  </span>
                                  <span className="crm-lob-hbar-val">
                                    {item.count}{" "}
                                    <span className="crm-lob-hbar-unit">
                                      ({pct}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="crm-lob-hbar-track">
                                  <div
                                    className="crm-lob-hbar-fill"
                                    style={{ width: `${widthPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isCalendarVisible && (
                <div className="crm-calendar-widget-card" style={{ flex: isLobVisible ? undefined : 1 }}>
                  <CompactDashboardCalendar
                    onNavigateTab={onNavigateTab}
                    todaysFollowUps={todaysFollowUps}
                    refreshTrigger={refreshing}
                  />
                </div>
              )}
            </div>
          );
        }

        return renderSectionItem(secPref);
      })}

      {/* CUSTOMIZE DASHBOARD DRAWER */}
      {canCustomize && (
        <CustomizeDashboardDrawer
          isOpen={customizeOpen}
          onClose={() => setCustomizeOpen(false)}
          currentPrefs={userPrefs}
          onSave={handleSaveCustomization}
          activeTab={customizeTab}
        />
      )}

      {/* Manual Add Lead Modal */}
      <AddLeadModal
        isOpen={addLeadOpen}
        onClose={() => setAddLeadOpen(false)}
        onLeadAdded={() => fetchDashboardData(true)}
        identity={identity}
      />

      {/* Schedule Follow-Up Modal */}
      {scheduleLead && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setScheduleLead(null)}>
          <div style={{ width: "100%", maxWidth: 440, background: "var(--surface)", border: "1px solid rgba(0, 229, 255,0.3)", padding: 24, borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>SCHEDULE TASK</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 0" }}>Schedule Follow-Up</h2>
            </div>

            <form onSubmit={handleScheduleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13, color: "#CBD5E1", margin: 0 }}>
                Lead: <strong style={{ color: "#0066FF" }}>{scheduleLead.name}</strong>
              </p>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Date & Time *</label>
                <input
                  type="datetime-local"
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, outline: "none" }}
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>Note / Task Description</label>
                <textarea
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, outline: "none", resize: "none" }}
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
                  style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  style={{ padding: "8px 18px", fontSize: 12, fontWeight: 800, borderRadius: 8, background: "#0066FF", color: "#FFFFFF", border: "none", cursor: "pointer" }}
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
