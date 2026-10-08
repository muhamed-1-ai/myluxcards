"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Plus,
  Download,
  Upload,
  Star,
  Phone,
  MessageSquare,
  ArrowUpDown,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  Users,
  Calendar,
  SlidersHorizontal,
  TrendingUp,
  Search,
  RotateCcw,
  CheckSquare,
  Columns,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import AddLeadDrawer from "./AddLeadDrawer";
import LeadDetailsDrawer from "./LeadDetailsDrawer";
import LeadIdentityBlock from "./LeadIdentityBlock";
import LeadSourceBadge from "./LeadSourceBadge";
import "../../app/dashboard/leads/leads.css";

interface LeadsWorkspaceProps {
  identity: { id: string; name: string | null; email: string; role: string };
}

function LeadsWorkspaceContent({ identity }: LeadsWorkspaceProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState({ openPipeline: 0, wonLeads: 0, dueToday: 0, expectedRevenue: 0 });

  // Sorting & Pagination States (URL sync initialized)
  const [page, setPage] = useState<number>(() => {
    const p = parseInt(searchParams.get("page") || "1", 10);
    return isNaN(p) || p < 1 ? 1 : p;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const ps = parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "10", 10);
    return isNaN(ps) || ps < 1 ? 10 : Math.min(100, ps);
  });
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sortBy") || "created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">((searchParams.get("sortOrder") as "asc" | "desc") || "desc");

  // Filter States
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get("q") || searchParams.get("search") || "");
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get("stage") || "");
  const [userFilter, setUserFilter] = useState<string>(searchParams.get("userId") || searchParams.get("user") || "");
  const [sourceFilter, setSourceFilter] = useState<string>(searchParams.get("source") || "");
  const [officeFilter, setOfficeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "");
  const [scopeFilter, setScopeFilter] = useState<string>(searchParams.get("scope") || "all");
  const [startDate, setStartDate] = useState<string>(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState<string>(searchParams.get("endDate") || "");

  // Pagination Metadata
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [hasPreviousPage, setHasPreviousPage] = useState<boolean>(false);
  const [startRecord, setStartRecord] = useState<number>(0);
  const [endRecord, setEndRecord] = useState<number>(0);

  const requestIdRef = useRef(0);

  // UI Selection State
  const [selectMode, setSelectMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Record<string, boolean>>({});

  // Drawers & Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [starredLeads, setStarredLeads] = useState<Record<string, boolean>>({});
  const [actionMenuTarget, setActionMenuTarget] = useState<{ lead: any; top: number; left: number } | null>(null);

  // Helper to sync state changes to URL query parameters
  const updateUrl = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      Object.entries(updates).forEach(([key, val]) => {
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (key === "page" && val === 1) ||
          (key === "pageSize" && val === 10) ||
          (key === "scope" && val === "all")
        ) {
          current.delete(key);
        } else {
          current.set(key, String(val));
        }
      });

      const search = current.toString();
      const query = search ? `?${search}` : "";
      router.push(`${pathname}${query}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Sync state when searchParams change (e.g. browser Back / Forward navigation)
  useEffect(() => {
    const p = parseInt(searchParams.get("page") || "1", 10);
    const ps = parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "10", 10);
    const q = searchParams.get("q") || searchParams.get("search") || "";
    const stage = searchParams.get("stage") || "";
    const user = searchParams.get("userId") || searchParams.get("user") || "";
    const source = searchParams.get("source") || "";
    const status = searchParams.get("status") || "";
    const scope = searchParams.get("scope") || "all";
    const sBy = searchParams.get("sortBy") || "created_at";
    const sOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

    setPage(isNaN(p) || p < 1 ? 1 : p);
    setPageSize(isNaN(ps) || ps < 1 ? 10 : Math.min(100, ps));
    setSearchQuery(q);
    setStageFilter(stage);
    setUserFilter(user);
    setSourceFilter(source);
    setStatusFilter(status);
    setScopeFilter(scope);
    setSortBy(sBy);
    setSortOrder(sOrder);
  }, [searchParams]);

  // Server-side lead fetching with race-condition identity check
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const currentRequestId = ++requestIdRef.current;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        limit: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (searchQuery) params.append("q", searchQuery);
      if (stageFilter) params.append("stage", stageFilter);
      if (userFilter && userFilter !== "all") params.append("userId", userFilter === "me" ? identity.id : userFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (scopeFilter && scopeFilter !== "all") params.append("scope", scopeFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/leads/search?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.message || errorData.error || "Unable to load leads");
      }
      const data = await res.json();

      // Prevent race conditions: ignore response if a newer request was dispatched
      if (currentRequestId !== requestIdRef.current) return;

      const fetchedLeads = data.leads || [];
      const totalCount = data.pagination?.total ?? data.total ?? fetchedLeads.length;
      const fetchedPage = data.pagination?.page ?? page;
      const fetchedPageSize = data.pagination?.pageSize ?? pageSize;
      const computedTotalPages = data.pagination?.totalPages ?? (totalCount === 0 ? 1 : Math.ceil(totalCount / fetchedPageSize));

      setLeads(fetchedLeads);
      setTotal(totalCount);
      setTotalPages(computedTotalPages);
      setHasNextPage(data.pagination?.hasNextPage ?? (fetchedPage < computedTotalPages));
      setHasPreviousPage(data.pagination?.hasPreviousPage ?? (fetchedPage > 1));

      const compStart = totalCount === 0 ? 0 : data.pagination?.start ?? ((fetchedPage - 1) * fetchedPageSize + 1);
      const compEnd = totalCount === 0 ? 0 : data.pagination?.end ?? Math.min(fetchedPage * fetchedPageSize, totalCount);
      setStartRecord(compStart);
      setEndRecord(compEnd);

      if (fetchedPage !== page) {
        setPage(fetchedPage);
      }

      if (data.kpis) {
        setKpis({
          openPipeline: data.kpis.openPipeline || 0,
          wonLeads: data.kpis.wonLeads || 0,
          dueToday: data.kpis.dueToday || 0,
          expectedRevenue: data.kpis.expectedRevenue || 0,
        });
      }
    } catch (error: any) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error("Error fetching leads:", error);
      setFetchError(error.message || "Unable to load leads");
      setLeads([]);
      setTotal(0);
      setTotalPages(1);
      setStartRecord(0);
      setEndRecord(0);
      setHasNextPage(false);
      setHasPreviousPage(false);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, sortBy, sortOrder, searchQuery, stageFilter, userFilter, sourceFilter, statusFilter, scopeFilter, startDate, endDate, identity.id]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Server-side leads dataset
  const displayedLeads = leads;

  // Expected Revenue Calculation
  const expectedRevenue = useMemo(() => {
    if (kpis.expectedRevenue && kpis.expectedRevenue > 0) return kpis.expectedRevenue;
    return leads.reduce((acc, l) => acc + (Number(l.totalAmount) || 0), 0);
  }, [kpis.expectedRevenue, leads]);

  // Action Handlers (with mandatory page reset to 1 on filter/search/sort/pageSize change)
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
    updateUrl({ q: val, page: 1 });
  };

  const handleStageChange = (val: string) => {
    setStageFilter(val);
    setPage(1);
    updateUrl({ stage: val, page: 1 });
  };

  const handleUserChange = (val: string) => {
    setUserFilter(val);
    setPage(1);
    updateUrl({ userId: val, page: 1 });
  };

  const handleSourceChange = (val: string) => {
    setSourceFilter(val);
    setPage(1);
    updateUrl({ source: val, page: 1 });
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
    updateUrl({ status: val, page: 1 });
  };

  const handleScopeChange = (val: string) => {
    setScopeFilter(val);
    setPage(1);
    updateUrl({ scope: val, page: 1 });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    updateUrl({ pageSize: newSize, page: 1 });
  };

  const handleSortChange = (col: string) => {
    let newOrder: "asc" | "desc" = "asc";
    if (sortBy === col) {
      newOrder = sortOrder === "asc" ? "desc" : "asc";
    }
    setSortBy(col);
    setSortOrder(newOrder);
    setPage(1);
    updateUrl({ sortBy: col, sortOrder: newOrder, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    setPage(newPage);
    updateUrl({ page: newPage });
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStageFilter("");
    setUserFilter("");
    setSourceFilter("");
    setOfficeFilter("");
    setStatusFilter("");
    setScopeFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
    router.push(pathname, { scroll: false });
  };

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarredLeads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectLead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedLeadIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCSV = () => {
    if (!displayedLeads.length) return;
    const headers = ["Lead Name", "Company", "Contact Number", "Email", "Stage", "Source", "Assigned To", "Total Amount", "Advance Amount", "Created At"];
    const rows = displayedLeads.map((l) => [
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${(l.companyName || "").replace(/"/g, '""')}"`,
      `"${(l.contactNumber || "").replace(/"/g, '""')}"`,
      `"${(l.email || "").replace(/"/g, '""')}"`,
      `"${(l.stage || l.status || "").replace(/"/g, '""')}"`,
      `"${(l.source || "").replace(/"/g, '""')}"`,
      `"${(l.assignedUserName || "").replace(/"/g, '""')}"`,
      `"${l.totalAmount || 0}"`,
      `"${l.advanceAmount || 0}"`,
      `"${new Date(l.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `all_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (leads.length === 1 && page > 1) {
        const targetPage = page - 1;
        setPage(targetPage);
        updateUrl({ page: targetPage });
      } else {
        fetchLeads();
      }
    } catch (err) {
      console.error("Failed to delete lead", err);
    }
  };

  const handleOpenActionMenu = (e: React.MouseEvent<HTMLButtonElement>, lead: any) => {
    e.stopPropagation();
    if (actionMenuTarget && actionMenuTarget.lead.id === lead.id) {
      setActionMenuTarget(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 216;
    const menuHeight = 145;

    let top = rect.bottom + 6;
    let left = rect.right - menuWidth;

    if (top + menuHeight > window.innerHeight - 12) {
      top = rect.top - menuHeight - 6;
    }
    if (left < 12) {
      left = 12;
    }

    setActionMenuTarget({ lead, top, left });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const getStageBadgeClass = (stage?: string) => {
    const st = (stage || "").toUpperCase().trim();
    if (st === "WON" || st === "CLOSED_WON" || st === "CONVERTED") return "badge-stage-emerald";
    if (st === "PROPOSAL" || st === "INTERESTED") return "badge-stage-purple";
    if (st === "NEW" || st === "QUALIFIED") return "badge-stage-blue";
    if (st === "FOLLOW_UP" || st === "CONTACTED" || st === "MEETING_SCHEDULED" || st === "ACTIVE") return "badge-stage-amber";
    if (st === "LOST" || st === "CLOSED_LOST" || st === "INACTIVE") return "badge-stage-red";
    return "badge-stage-blue";
  };

  return (
    <div className="leads-page-container flex flex-col min-h-screen w-full max-w-none gap-6">

      {/* 1. Header: Badge, Title, Count & Control Actions */}
      <div className="flex flex-col">
        {/* Row 1: PIPELINE CONTROL ROOM Badge */}
        <div className="mb-3.5">
          <span className="crm-badge-control-room">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>PIPELINE CONTROL ROOM</span>
          </span>
        </div>

        {/* Row 2: Title/Count on Left, Action Groups on Right */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="crm-header-title">All Leads</h1>
            <span className="crm-header-count-pill">
              Total Count: <strong className="ml-1.5 text-[var(--text-primary,#0F172A)]">{total}</strong>
            </span>
          </div>

          {/* Control Actions Row Grouped Logically */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Action Group 1: View Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                className="crm-btn-secondary hidden sm:inline-flex"
                onClick={handleExportCSV}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`crm-btn-secondary ${showFilters ? "active" : ""}`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
            </div>

            {/* Action Group 2: Primary Action */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="crm-btn-primary"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>New Lead</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#10B981]" />
          <span className="kpi-label">TOTAL LEADS</span>
          <span className="kpi-value">{total}</span>
        </div>

        {/* Card 2: Open Pipeline */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#0066FF]" />
          <span className="kpi-label">OPEN PIPELINE</span>
          <span className="kpi-value">{kpis.openPipeline}</span>
        </div>

        {/* Card 3: Due Today */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#F97316]" />
          <span className="kpi-label">DUE TODAY</span>
          <span className="kpi-value">{kpis.dueToday}</span>
        </div>

        {/* Card 4: Expected Revenue */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#8B5CF6]" />
          <span className="kpi-label">EXPECTED REVENUE</span>
          <span className="kpi-value" style={{ color: "#8B5CF6" }}>{formatCurrency(expectedRevenue)}</span>
        </div>
      </div>

      {/* 3. Filter Leads Panel */}
      {showFilters && (
        <div className="crm-filter-panel">
          <div className="crm-filter-panel-header">
            <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
            <span>FILTER LEADS</span>
          </div>

          {/* First Filter Row: Search + Stage + Assigned User + Source + Status */}
          <div className="crm-filter-row-primary">
            {/* Search Input */}
            <div className="crm-filter-input-wrap">
              <Search className="crm-filter-icon" />
              <input
                type="text"
                placeholder="Search name, email, phone..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="crm-filter-input"
              />
            </div>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={(e) => handleStageChange(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Stage</option>
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="INTERESTED">INTERESTED</option>
              <option value="PROPOSAL">PROPOSAL</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
            </select>

            {/* Assigned User Filter */}
            <select
              value={userFilter}
              onChange={(e) => handleUserChange(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Assigned User</option>
              <option value="all">All Users</option>
              <option value="me">My Leads</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Source</option>
              <option value="NFC">NFC Tap</option>
              <option value="QR">QR Scan</option>
              <option value="DIRECT">Direct</option>
              <option value="MANUAL">Manual</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Second Filter Row: Scope Filter */}
          <div className="crm-filter-row-secondary">
            <div className="w-full sm:w-[200px]">
              <select
                value={scopeFilter}
                onChange={(e) => handleScopeChange(e.target.value)}
                className="crm-filter-select"
              >
                <option value="all">All Leads</option>
                <option value="mine">My Leads</option>
              </select>
            </div>
          </div>

          <div className="crm-filter-panel-footer">
            <span className="crm-filter-note">
              ★ Use filters to refine the pipeline view.
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="crm-filter-reset-btn"
            >
              <RotateCcw className="w-3 h-3 inline mr-1" />
              RESET FILTERS
            </button>
          </div>
        </div>
      )}

      {/* 4. Desktop Table (>= 768px) AND Dedicated Standalone Mobile Lead Cards (< 768px) */}
      <div className="w-full">
        {/* DESKTOP / TABLET VIEW (>= 768px): Preserved Standard Data Table Card */}
        <div className="hidden md:block crm-table-card relative overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  {selectMode && <th style={{ width: 40 }}><input type="checkbox" /></th>}
                  <th style={{ minWidth: 340, width: 360 }}>LEAD NAME</th>
                  <th style={{ minWidth: 160 }}>NEXT FOLLOW-UP</th>
                  <th style={{ minWidth: 170 }}>ASSIGNED TO</th>
                  <th>STAGE</th>
                  <th>SOURCE</th>
                  <th>LAST REMARK</th>
                  <th
                    className="cursor-pointer hover:text-[var(--text-primary,#0F172A)] select-none"
                    onClick={() => handleSortChange("totalAmount")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>TOTAL AMOUNT</span>
                      <ArrowUpDown className="w-3 h-3 text-[var(--text-secondary,#94A3B8)]" />
                    </div>
                  </th>
                  <th>ADVANCE AMOUNT</th>
                  <th className="text-right">ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {loading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={selectMode ? 9 : 8} className="text-center text-[var(--text-secondary,#94A3B8)] py-12">
                      <div className="flex justify-center items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading leads...</span>
                      </div>
                    </td>
                  </tr>
                ) : fetchError ? (
                  <tr>
                    <td colSpan={selectMode ? 9 : 8} className="crm-table-empty-cell text-center p-8">
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-rose-500 mb-2.5" />
                        <div className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">Unable to load leads</div>
                        <div className="text-xs text-[var(--text-secondary,#94A3B8)] mb-4">{fetchError}</div>
                        <button onClick={() => fetchLeads()} className="crm-btn-primary flex items-center gap-2">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : displayedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={selectMode ? 9 : 8} className="crm-table-empty-cell text-center text-[var(--text-secondary,#94A3B8)]">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="w-8 h-8 text-[var(--text-secondary,#94A3B8)] opacity-60 mb-2.5" />
                        <div className="text-sm font-semibold mb-3.5">No leads found in this view.</div>
                        <button onClick={handleResetFilters} className="crm-btn-secondary">
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedLeads.map((lead) => {
                    const isStarred = !!starredLeads[lead.id];
                    const isSelected = !!selectedLeadIds[lead.id];

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`cursor-pointer group transition-colors ${isSelected ? "bg-emerald-500/5" : ""}`}
                      >
                        {/* SELECT CHECKBOX */}
                        {selectMode && (
                          <td onClick={(e) => toggleSelectLead(e, lead.id)}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        )}

                        {/* LEAD NAME COLUMN */}
                        <td>
                          <LeadIdentityBlock
                            lead={lead}
                            isStarred={isStarred}
                            onToggleStar={toggleStar}
                          />
                        </td>

                        {/* NEXT FOLLOW-UP COLUMN */}
                        <td onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }}>
                          <div className="crm-followup-pill-box cursor-pointer">
                            <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary,#64748B)] flex-shrink-0" />
                            <div className="text-left">
                              <div className="font-bold text-[11px] uppercase tracking-wider text-[var(--text-primary,#0F172A)]">
                                {lead.nextFollowUpAt
                                  ? new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                                  : "NO FOLLOW-UP"}
                              </div>
                              <div className="text-[10px] text-[var(--text-secondary,#94A3B8)] truncate max-w-[120px]">
                                {lead.nextFollowUpNote || "Not scheduled"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ASSIGNED TO COLUMN */}
                        <td>
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-[var(--input-bg,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {(lead.assignedUserName || identity.name || "M").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-[var(--text-primary,#0F172A)]">
                                {lead.assignedUserName || identity.name || "Unassigned"}
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary,#94A3B8)] truncate max-w-[130px]">
                                {lead.assignedUserEmail || identity.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* STAGE COLUMN */}
                        <td>
                          <span className={getStageBadgeClass(lead.stage || lead.status)}>
                            {lead.stage || lead.status || "NEW"}
                          </span>
                        </td>

                        {/* SOURCE COLUMN */}
                        <td>
                          <LeadSourceBadge source={lead.source} />
                        </td>

                        {/* LAST REMARK COLUMN */}
                        <td className="text-[var(--text-secondary,#64748B)] text-xs font-medium">
                          {lead.lastRemark || "—"}
                        </td>

                        {/* TOTAL AMOUNT COLUMN */}
                        <td className="font-bold text-[var(--text-primary,#0F172A)]">
                          {lead.totalAmount ? formatCurrency(lead.totalAmount) : "₹0"}
                        </td>

                        {/* ADVANCE AMOUNT COLUMN */}
                        <td className="font-semibold text-[var(--text-secondary,#64748B)]">
                          {lead.advanceAmount ? formatCurrency(lead.advanceAmount) : "₹0"}
                        </td>

                        {/* ACTIONS COLUMN */}
                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleOpenActionMenu(e, lead)}
                            className="p-1.5 rounded-lg hover:bg-[var(--border-color,#E2E8F0)]/40 text-[var(--text-secondary,#64748B)] transition-colors focus:outline-none"
                            title="Actions menu"
                            aria-label="Actions menu"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOBILE VIEW (< 768px): Dedicated Standalone Lead Cards Collection */}
        <div className="block md:hidden">
          {loading && leads.length === 0 ? (
            /* Mobile Animated Skeletons */
            <div className="crm-mobile-leads-list">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="crm-mobile-lead-card animate-pulse flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                  <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="h-11 w-full bg-slate-200 dark:bg-slate-700 rounded-lg" />
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="crm-mobile-lead-card text-center p-6">
              <div className="flex flex-col items-center justify-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                <div className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">Unable to load leads</div>
                <div className="text-xs text-[var(--text-secondary,#94A3B8)] mb-4">{fetchError}</div>
                <button onClick={() => fetchLeads()} className="crm-btn-primary min-h-[44px] flex items-center gap-2 justify-center w-full">
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="crm-mobile-lead-card text-center p-8">
              <div className="flex flex-col items-center justify-center">
                <Users className="w-10 h-10 text-[var(--text-secondary,#94A3B8)] opacity-60 mb-3" />
                <div className="text-base font-bold text-[var(--text-primary,#0F172A)] mb-1">No leads found in this view</div>
                <div className="text-xs text-[var(--text-secondary,#64748B)] mb-4 max-w-xs">
                  Try adjusting your search terms or filters to find what you're looking for.
                </div>
                <div className="flex flex-col gap-2.5 w-full max-w-xs">
                  <button onClick={handleResetFilters} className="crm-btn-secondary min-h-[44px] justify-center w-full">
                    Clear filters
                  </button>
                  <button onClick={() => setIsAddOpen(true)} className="crm-btn-primary min-h-[44px] justify-center w-full">
                    <Plus className="w-4 h-4" />
                    <span>New Lead</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="crm-mobile-leads-list">
              {displayedLeads.map((lead) => {
                const isStarred = !!starredLeads[lead.id];
                const isSelected = !!selectedLeadIds[lead.id];
                const leadName = lead.name || "Unnamed Lead";
                const avatarLetter = leadName.charAt(0).toUpperCase();

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`crm-mobile-lead-card ${isSelected ? "ring-2 ring-emerald-500 bg-emerald-500/5" : ""}`}
                  >
                    {/* Header: Avatar, Name, Phone, Email, Company, Star, Actions Menu */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {selectMode && (
                          <div onClick={(e) => toggleSelectLead(e, lead.id)} className="pt-1 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </div>
                        )}

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-sm border border-emerald-400/20">
                          {avatarLetter}
                        </div>

                        {/* Lead Identity Details */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[15.5px] text-[var(--text-primary,#0F172A)] truncate leading-snug">
                            {leadName}
                          </div>

                          {lead.contactNumber && (
                            <div className="text-xs font-semibold text-[var(--text-secondary,#64748B)] dark:text-[#94A3B8] mt-0.5 flex items-center gap-1.5 truncate">
                              <Phone className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              <span>{lead.contactNumber}</span>
                            </div>
                          )}

                          {lead.email && (
                            <div className="text-xs text-[var(--text-secondary,#64748B)] truncate mt-0.5">
                              {lead.email}
                            </div>
                          )}

                          {lead.companyName && (
                            <div className="text-[11px] text-[var(--text-secondary,#94A3B8)] truncate mt-0.5 font-medium uppercase tracking-wider">
                              {lead.companyName}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Star & Actions Menu Buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => toggleStar(e, lead.id)}
                          className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-amber-400 hover:bg-amber-400/10 flex items-center justify-center transition-colors"
                          title={isStarred ? "Remove from favorites" : "Add to favorites"}
                          aria-label={isStarred ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star className={`w-4 h-4 ${isStarred ? "fill-amber-400 text-amber-400" : "text-slate-400"}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenActionMenu(e, lead)}
                          className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-[var(--text-secondary,#64748B)] hover:text-[var(--text-primary,#0F172A)] hover:bg-[var(--border-color,#E2E8F0)]/40 flex items-center justify-center transition-colors"
                          title="More actions"
                          aria-label="Open lead actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Badges & Total Amount Summary Row */}
                    <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-[var(--border-color,#E2E8F0)]/60 dark:border-white/5 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${getStageBadgeClass(lead.stage || lead.status)} px-2.5 py-1 text-[10.5px] font-bold rounded-md uppercase tracking-wider`}>
                          {lead.stage || lead.status || "NEW"}
                        </span>

                        <LeadSourceBadge source={lead.source} />
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[var(--text-secondary,#94A3B8)] block font-bold uppercase tracking-wider">Total</span>
                        <span className="font-extrabold text-sm text-[var(--text-primary,#0F172A)]">
                          {lead.totalAmount ? formatCurrency(lead.totalAmount) : "₹0"}
                        </span>
                      </div>
                    </div>

                    {/* Follow-Up Section Box */}
                    <div
                      onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }}
                      className="mt-3 p-2.5 rounded-xl bg-[var(--bg-secondary,#F8FAFC)] dark:bg-[#0B1528] border border-[var(--border-color,#E2E8F0)] dark:border-[#1E293B] flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-bold text-[11px] uppercase tracking-wider text-[var(--text-primary,#0F172A)] flex items-center gap-2 flex-wrap">
                            <span>
                              {lead.nextFollowUpAt
                                ? new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                                : "NO FOLLOW-UP"}
                            </span>
                            {lead.nextFollowUpType && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                                {lead.nextFollowUpType}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary,#64748B)] truncate max-w-[200px] mt-0.5">
                            {lead.nextFollowUpNote || "Not scheduled"}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0">
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Mobile Touch Quick Action Bar */}
                    <div className="grid grid-cols-3 gap-2.5 pt-3 mt-3 border-t border-[var(--border-color,#E2E8F0)]/60 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
                      {lead.contactNumber ? (
                        <a
                          href={`tel:${lead.contactNumber}`}
                          className="crm-mobile-btn-call"
                          title={`Call ${lead.contactNumber}`}
                          aria-label={`Call ${lead.name || "lead"}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      ) : (
                        <button disabled className="crm-mobile-btn-call opacity-40 cursor-not-allowed">
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </button>
                      )}

                      {lead.contactNumber ? (
                        <a
                          href={`https://wa.me/${lead.contactNumber.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="crm-mobile-btn-chat"
                          title="WhatsApp chat"
                          aria-label={`Message ${lead.name || "lead"} on WhatsApp`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </a>
                      ) : (
                        <button disabled className="crm-mobile-btn-chat opacity-40 cursor-not-allowed">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { setEditingLead(lead); setIsAddOpen(true); }}
                        className="crm-mobile-btn-edit"
                        title="Edit lead"
                        aria-label={`Edit ${lead.name || "lead"}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Production Pagination Footer */}
        <div className="crm-pagination-footer mt-4 md:mt-0">
          {/* Display Range */}
          <div className="crm-pagination-info">
            Showing <strong>{startRecord}–{endRecord}</strong> of <strong>{total}</strong>
          </div>

          {/* Controls: Rows per page & Navigation buttons */}
          <div className="crm-pagination-controls">
            {/* Rows per page select */}
            <div className="crm-pagination-rows">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                disabled={loading}
                className="crm-pagination-select"
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Navigation buttons */}
            <div className="crm-pagination-nav">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={loading || !hasPreviousPage || page <= 1}
                className="crm-pagination-btn"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="crm-pagination-btn-text">Previous</span>
              </button>

              <span className="crm-pagination-page-indicator">
                Page <strong>{total === 0 ? 1 : page}</strong> of <strong>{total === 0 ? 1 : totalPages}</strong>
              </span>

              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={loading || !hasNextPage || page >= totalPages || total === 0}
                className="crm-pagination-btn"
                aria-label="Next page"
              >
                <span className="crm-pagination-btn-text">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Drawers */}
      <AddLeadDrawer
        isOpen={isAddOpen}
        mode="create"
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => { setIsAddOpen(false); fetchLeads(); }}
        identity={identity}
      />

      {editingLead && (
        <AddLeadDrawer
          isOpen={!!editingLead}
          mode="edit"
          leadData={editingLead}
          onClose={() => setEditingLead(null)}
          onSuccess={() => {
            setEditingLead(null);
            fetchLeads();
            if (selectedLeadId) {
              const currentId = selectedLeadId;
              setSelectedLeadId(null);
              setTimeout(() => setSelectedLeadId(currentId), 50);
            }
          }}
          identity={identity}
        />
      )}

      {selectedLeadId && (
        <LeadDetailsDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={() => fetchLeads()}
          onEditLead={(lead) => {
            setSelectedLeadId(null);
            setEditingLead(lead);
          }}
        />
      )}

      {/* PORTAL ACTIONS MENU */}
      {actionMenuTarget && createPortal(
        <div
          className="fixed inset-0 z-[100] pointer-events-auto"
          onClick={() => setActionMenuTarget(null)}
        >
          <div
            style={{
              position: "fixed",
              top: `${actionMenuTarget.top}px`,
              left: `${actionMenuTarget.left}px`,
            }}
            className="w-[216px] bg-[#0B1528] border border-[#1E293B] shadow-2xl rounded-xl p-2 font-medium text-sm text-[#F1F5F9] animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                const id = actionMenuTarget.lead.id;
                setActionMenuTarget(null);
                setSelectedLeadId(id);
              }}
              className="w-full h-10 px-3 hover:bg-[#1E293B] rounded-lg flex items-center gap-3 text-left transition-colors text-[#F1F5F9] focus:outline-none focus:bg-[#1E293B]"
            >
              <Eye className="w-4 h-4 text-blue-400" />
              <span>View Details</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const leadToEdit = actionMenuTarget.lead;
                setActionMenuTarget(null);
                setEditingLead(leadToEdit);
              }}
              className="w-full h-10 px-3 hover:bg-[#1E293B] rounded-lg flex items-center gap-3 text-left transition-colors text-[#F1F5F9] focus:outline-none focus:bg-[#1E293B]"
            >
              <Edit2 className="w-4 h-4 text-emerald-400" />
              <span>Edit Lead</span>
            </button>
            <div className="my-1 border-t border-[#1E293B]" />
            <button
              type="button"
              onClick={() => {
                const idToDelete = actionMenuTarget.lead.id;
                setActionMenuTarget(null);
                handleDeleteLead(idToDelete);
              }}
              className="w-full h-10 px-3 hover:bg-red-500/10 rounded-lg flex items-center gap-3 text-left transition-colors text-red-400 focus:outline-none focus:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>Delete Lead</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function LeadsWorkspace(props: LeadsWorkspaceProps) {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-[var(--text-secondary,#94A3B8)]">
        <div className="flex justify-center items-center space-x-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading CRM Workspace...</span>
        </div>
      </div>
    }>
      <LeadsWorkspaceContent {...props} />
    </Suspense>
  );
}
