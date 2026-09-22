"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Columns
} from "lucide-react";
import AddLeadDrawer from "./AddLeadDrawer";
import LeadDetailsDrawer from "./LeadDetailsDrawer";
import "../../app/dashboard/leads/leads.css";

interface LeadsWorkspaceProps {
  identity: { id: string; name: string | null; email: string; role: string };
}

export default function LeadsWorkspace({ identity }: LeadsWorkspaceProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState({ openPipeline: 0, wonLeads: 0, dueToday: 0 });

  // Sorting & Pagination
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const limit = 50;

  // Filter States (Matching Reference Screenshot)
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // UI Selection State
  const [selectMode, setSelectMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Record<string, boolean>>({});
  const [includeArchived, setIncludeArchived] = useState(false);

  // Drawers & Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [starredLeads, setStarredLeads] = useState<Record<string, boolean>>({});
  const [actionMenuTarget, setActionMenuTarget] = useState<{ lead: any; top: number; left: number } | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      if (searchQuery) params.append("q", searchQuery);
      if (stageFilter) params.append("stage", stageFilter);
      if (userFilter && userFilter !== "all") params.append("userId", userFilter === "me" ? identity.id : userFilter);
      if (sourceFilter) params.append("source", sourceFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/leads/search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.pagination?.total || (data.leads ? data.leads.length : 0));
      if (data.kpis) {
        setKpis({
          openPipeline: data.kpis.openPipeline || 0,
          wonLeads: data.kpis.wonLeads || 0,
          dueToday: data.kpis.dueToday || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, searchQuery, stageFilter, userFilter, sourceFilter, statusFilter, startDate, endDate, identity.id]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Client Filtered Leads
  const displayedLeads = useMemo(() => {
    return leads.filter((l) => {
      if (scopeFilter === "mine" && l.ownerUserId && l.ownerUserId !== identity.id) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          (l.name && l.name.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.contactNumber && l.contactNumber.includes(q)) ||
          (l.companyName && l.companyName.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (stageFilter && (l.stage || l.status) !== stageFilter) return false;
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      return true;
    });
  }, [leads, scopeFilter, searchQuery, stageFilter, sourceFilter, statusFilter, identity.id]);

  // Expected Revenue Calculation
  const expectedRevenue = useMemo(() => {
    return displayedLeads.reduce((acc, l) => acc + (Number(l.totalAmount) || 0), 0);
  }, [displayedLeads]);

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
      fetchLeads();
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

  const getAvatarGradient = (name: string) => {
    const charCode = name.charCodeAt(0) || 65;
    if (charCode % 4 === 0) return "bg-emerald-500 text-white";
    if (charCode % 4 === 1) return "bg-purple-600 text-white";
    if (charCode % 4 === 2) return "bg-blue-600 text-white";
    return "bg-indigo-600 text-white";
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

      {/* 1. Header: Badge, Title, Count & Control Actions (Matching Reference) */}
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
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Columns</span>
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
                <span>+ New Lead</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 4 Stat Cards Row (Matching Reference Layout) */}
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

      {/* 3. Filter Leads Panel (Matching Reference Design) */}
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="crm-filter-input"
              />
            </div>

            {/* Stage Filter */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
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
              onChange={(e) => setUserFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Assigned User</option>
              <option value="all">All Users</option>
              <option value="me">My Leads</option>
            </select>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Source</option>
              <option value="NFC">NFC Tap</option>
              <option value="QR">QR Scan</option>
              <option value="DIRECT">Direct</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="crm-filter-select"
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Second Filter Row: Scope Filter */}
          <div className="crm-filter-row-secondary">
            {/* Scope Filter */}
            <div className="w-full sm:w-[200px]">
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
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

      {/* 4. Desktop Leads Table & Mobile Cards */}
      <div className="crm-table-card">
        {/* Desktop / Tablet View (>= 768px): Full Data Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                {selectMode && <th style={{ width: 40 }}><input type="checkbox" /></th>}
                <th style={{ minWidth: 220 }}>LEAD NAME</th>
                <th style={{ minWidth: 160 }}>NEXT FOLLOW-UP</th>
                <th style={{ minWidth: 170 }}>ASSIGNED TO</th>
                <th>STAGE</th>
                <th>LAST REMARK</th>
                <th
                  className="cursor-pointer hover:text-[var(--text-primary,#0F172A)] select-none"
                  onClick={() => { setSortBy("totalAmount"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
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
              {loading ? (
                <tr>
                  <td colSpan={selectMode ? 9 : 8} className="text-center text-[var(--text-secondary,#94A3B8)] py-12">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading leads...</span>
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
                  const leadName = lead.name || "Unnamed Lead";
                  const avatarLetter = leadName.charAt(0).toUpperCase();

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`cursor-pointer group ${isSelected ? "bg-emerald-500/5" : ""}`}
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
                        <div className="flex items-start space-x-3">
                          <div className={`w-9 h-9 rounded-full ${getAvatarGradient(leadName)} font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0 mt-0.5`}>
                            {avatarLetter}
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <Star
                                onClick={(e) => toggleStar(e, lead.id)}
                                className={`w-3.5 h-3.5 transition-colors cursor-pointer ${isStarred ? "text-amber-400 fill-amber-400" : "text-[var(--text-secondary,#94A3B8)] hover:text-amber-400"}`}
                              />
                              <span className="font-bold text-[var(--text-primary,#0F172A)] text-sm group-hover:text-emerald-500 transition-colors">
                                {leadName}
                              </span>
                            </div>

                            {lead.email && (
                              <div className="text-[11.5px] text-[var(--text-secondary,#94A3B8)]">
                                {lead.email}
                              </div>
                            )}

                            <div className="text-[11.5px] text-[var(--text-secondary,#94A3B8)] flex items-center space-x-1.5 pt-0.5">
                              <span>{lead.contactNumber || "No phone"}</span>
                              {lead.contactNumber && (
                                <>
                                  <a
                                    href={`https://wa.me/${lead.contactNumber.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="WhatsApp Message"
                                    className="text-emerald-500 hover:scale-110 transition-transform p-0.5"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 fill-emerald-500/20" />
                                  </a>
                                  <a
                                    href={`tel:${lead.contactNumber}`}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Call Lead"
                                    className="text-[var(--text-secondary,#94A3B8)] hover:text-emerald-500 transition-colors p-0.5"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* NEXT FOLLOW-UP COLUMN (Matching Reference Pill) */}
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

        {/* Mobile View (< 768px): Dedicated Responsive Lead Cards */}
        <div className="block md:hidden divide-y divide-[var(--border-color,#E2E8F0)] dark:divide-white/5">
          {loading ? (
            <div className="py-12 text-center text-[var(--text-secondary,#94A3B8)]">
              <div className="flex justify-center items-center space-x-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading leads...</span>
              </div>
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="crm-table-empty-cell text-center text-[var(--text-secondary,#94A3B8)]">
              <div className="flex flex-col items-center justify-center">
                <Users className="w-8 h-8 text-[var(--text-secondary,#94A3B8)] opacity-60 mb-2.5" />
                <div className="text-sm font-semibold mb-3.5">No leads found in this view.</div>
                <button onClick={handleResetFilters} className="crm-btn-secondary">
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            displayedLeads.map((lead) => {
              const isStarred = !!starredLeads[lead.id];
              const isSelected = !!selectedLeadIds[lead.id];
              const leadName = lead.name || "Unnamed Lead";
              const avatarLetter = leadName.charAt(0).toUpperCase();

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`p-4 flex flex-col gap-3 transition-colors cursor-pointer active:bg-[var(--surface-soft,#F8FAFC)] ${
                    isSelected ? "bg-emerald-500/5" : ""
                  }`}
                >
                  {/* Top Row: Select checkbox, Avatar, Name, Star, Stage Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {selectMode && (
                        <div onClick={(e) => toggleSelectLead(e, lead.id)} className="flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                      <div className={`w-9 h-9 rounded-full ${getAvatarGradient(leadName)} font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0`}>
                        {avatarLetter}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[var(--text-primary,#0F172A)] text-sm truncate">
                            {leadName}
                          </span>
                          <Star
                            onClick={(e) => toggleStar(e, lead.id)}
                            className={`w-3.5 h-3.5 flex-shrink-0 cursor-pointer ${
                              isStarred ? "text-amber-400 fill-amber-400" : "text-[var(--text-secondary,#94A3B8)]"
                            }`}
                          />
                        </div>
                        {lead.companyName && (
                          <div className="text-xs text-[var(--text-secondary,#64748B)] truncate">
                            {lead.companyName}
                          </div>
                        )}
                      </div>
                    </div>

                    <span className={`${getStageBadgeClass(lead.stage || lead.status)} flex-shrink-0 text-[10px]`}>
                      {lead.stage || lead.status || "NEW"}
                    </span>
                  </div>

                  {/* Contact & 1-Tap Quick Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-color,#E2E8F0)]/40 dark:border-white/5">
                    <div className="text-xs text-[var(--text-secondary,#64748B)] truncate">
                      {lead.email || lead.contactNumber || "No email"}
                    </div>

                    {lead.contactNumber && (
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`https://wa.me/${lead.contactNumber.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5 fill-emerald-500/20" />
                          <span>WhatsApp</span>
                        </a>
                        <a
                          href={`tel:${lead.contactNumber}`}
                          className="h-8 px-2.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 text-xs font-bold flex items-center gap-1.5"
                          title="Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Metadata Row: Next Follow-Up, Assigned To, Total Amount, Action Menu */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {/* Next Follow-Up Pill */}
                      <div
                        onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }}
                        className="crm-followup-pill-box !py-1 !px-2.5 !rounded-lg cursor-pointer"
                      >
                        <Calendar className="w-3 h-3 text-[var(--text-secondary,#64748B)] flex-shrink-0" />
                        <span className="font-bold text-[10.5px] uppercase text-[var(--text-primary,#0F172A)]">
                          {lead.nextFollowUpAt
                            ? new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                            : "NO FOLLOW-UP"}
                        </span>
                      </div>

                      {/* Total Amount */}
                      <span className="font-bold text-sm text-[var(--text-primary,#0F172A)]">
                        {lead.totalAmount ? formatCurrency(lead.totalAmount) : "₹0"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenActionMenu(e, lead)}
                        className="p-2 rounded-lg text-[var(--text-secondary,#64748B)] hover:text-[var(--text-primary,#0F172A)] hover:bg-[var(--border-color,#E2E8F0)]/40"
                        title="Actions menu"
                        aria-label="Actions menu"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
          onSuccess={() => { setEditingLead(null); fetchLeads(); }}
          identity={identity}
        />
      )}

      {selectedLeadId && (
        <LeadDetailsDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={() => fetchLeads()}
          onEditLead={(lead) => setEditingLead(lead)}
        />
      )}

      {/* PORTAL ACTIONS MENU (Collision-aware dropdown matching Screenshot 3) */}
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
