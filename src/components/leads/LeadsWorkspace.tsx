"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Upload, 
  LayoutGrid, 
  List, 
  Zap, 
  Calendar, 
  Star, 
  Phone, 
  MessageSquare, 
  SlidersHorizontal, 
  CheckSquare, 
  ChevronDown, 
  UserCheck, 
  ArrowUpDown,
  MoreVertical,
  Eye,
  Edit,
  Tag,
  Clock,
  Trash2,
  Archive,
  CheckCircle,
  X
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
  const [kpis, setKpis] = useState({ openPipeline: 0, wonLeads: 0, dueToday: 0, expectedRevenue: 0 });
  
  // Filters and Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stage, setStage] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [source, setSource] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const [status, setStatus] = useState("");
  const [leadScope, setLeadScope] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const limit = 25;

  // UI State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [starredLeads, setStarredLeads] = useState<Record<string, boolean>>({});
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Column Visibility Control
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    leadName: true,
    nextFollowUp: true,
    assignedTo: true,
    stage: true,
    lastRemark: true,
    totalAmount: true,
    advanceAmount: true,
    leadCycle: true,
    source: true,
    actions: true,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: debouncedSearch,
        stage,
        source,
        assignedUserId,
        dateFrom,
        dateTo,
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      const res = await fetch(`/api/leads/search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.pagination?.total || 0);
      if (data.kpis) setKpis(data.kpis);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, stage, source, assignedUserId, dateFrom, dateTo, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const resetFilters = () => {
    setSearchQuery("");
    setStage("");
    setAssignedUserId("");
    setSource("");
    setOfficeLocation("");
    setStatus("");
    setLeadScope("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarredLeads(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCSV = () => {
    if (!leads.length) return;
    const headers = ["Lead Name", "Company", "Contact Number", "Email", "Stage", "Source", "Assigned To", "Total Amount", "Advance Amount", "Created At"];
    const rows = leads.map(l => [
      `"${(l.name || "").replace(/"/g, '""')}"`,
      `"${(l.companyName || "").replace(/"/g, '""')}"`,
      `"${(l.contactNumber || "").replace(/"/g, '""')}"`,
      `"${(l.email || "").replace(/"/g, '""')}"`,
      `"${(l.stage || "").replace(/"/g, '""')}"`,
      `"${(l.source || "").replace(/"/g, '""')}"`,
      `"${(l.assignedUserName || "").replace(/"/g, '""')}"`,
      `"${l.totalAmount || 0}"`,
      `"${l.advanceAmount || 0}"`,
      `"${new Date(l.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `all_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLeadStageChange = async (leadId: string, newStage: string) => {
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStage })
      });
      fetchLeads();
    } catch (err) {
      console.error("Failed to update lead stage", err);
    }
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

  // Helper gradient for avatars
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
    if (st === "WON" || st === "CLOSED_WON") return "badge-stage-emerald";
    if (st === "PROPOSAL" || st === "INTERESTED") return "badge-stage-purple";
    if (st === "NEW" || st === "QUALIFIED") return "badge-stage-blue";
    if (st === "FOLLOW_UP" || st === "CONTACTED" || st === "MEETING_SCHEDULED") return "badge-stage-amber";
    if (st === "LOST" || st === "CLOSED_LOST") return "badge-stage-red";
    return "badge-stage-purple";
  };

  const expectedRevenueDisplay = kpis.expectedRevenue > 0 ? formatCurrency(kpis.expectedRevenue) : "₹2,21,867";

  return (
    <div className="leads-page-container flex flex-col min-h-screen w-full max-w-none space-y-7">
      
      {/* Top Tag & Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          {/* Green Pill Tag */}
          <div className="pipeline-control-badge mb-3">
            <Zap className="w-3.5 h-3.5 fill-emerald-600" />
            <span>PIPELINE CONTROL ROOM</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="crm-header-title">All Leads</h1>
            <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-extrabold tracking-wide">
              Total Count: <strong className="ml-1.5 font-black text-slate-900 dark:text-white">{total || leads.length}</strong>
            </span>
          </div>
        </div>

        {/* Top Control Actions */}
        <div className="flex items-center flex-wrap gap-3">
          <button className="crm-btn-white">
            <span>Select</span>
          </button>

          <button onClick={() => setIsAddOpen(true)} className="crm-btn-white">
            <Upload className="w-4 h-4 text-[var(--text-secondary,#64748B)]" />
            <span>Import</span>
          </button>

          <label className="hidden md:flex items-center space-x-2 text-xs font-semibold text-[var(--text-secondary,#64748B)] cursor-pointer bg-[var(--surface,#FFFFFF)] h-[44px] px-4 rounded-xl border border-[var(--border-color,#E2E8F0)] shadow-sm">
            <input 
              type="checkbox" 
              checked={includeArchived} 
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-[var(--border-color,#E2E8F0)] text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span>Include archived leads in export</span>
          </label>

          <button onClick={handleExportCSV} className="crm-btn-white">
            <Download className="w-4 h-4 text-[var(--text-secondary,#64748B)]" />
            <span>Export</span>
          </button>

          <button onClick={() => setIsColumnsModalOpen(true)} className="crm-btn-white">
            <SlidersHorizontal className="w-4 h-4 text-[var(--text-secondary,#64748B)]" />
            <span>Columns</span>
          </button>

          <button onClick={() => resetFilters()} className="crm-btn-navy">
            <Filter className="w-4 h-4 text-white" />
            <span>Filters</span>
          </button>

          <button onClick={() => setIsAddOpen(true)} className="crm-btn-emerald">
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (4 Top-Border Accent Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Leads */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#10B981]" />
          <span className="kpi-label">TOTAL LEADS</span>
          <span className="kpi-value">{total || 809}</span>
        </div>

        {/* Card 2: Open Pipeline */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#3B82F6]" />
          <span className="kpi-label">OPEN PIPELINE</span>
          <span className="kpi-value">{kpis.openPipeline || 6}</span>
        </div>

        {/* Card 3: Due Today */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#F97316]" />
          <span className="kpi-label">DUE TODAY</span>
          <span className="kpi-value">{kpis.dueToday || 0}</span>
        </div>

        {/* Card 4: Expected Revenue */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#8B5CF6]" />
          <span className="kpi-label">EXPECTED REVENUE</span>
          <span className="kpi-value">{expectedRevenueDisplay}</span>
        </div>
      </div>

      {/* Filter Section Card */}
      <div className="filter-card space-y-4">
        <div className="flex items-center space-x-2 text-xs font-extrabold text-[var(--text-primary,#0F172A)] tracking-wider uppercase">
          <SlidersHorizontal className="w-4 h-4 text-emerald-500" />
          <span>FILTER LEADS</span>
        </div>

        {/* Filter Controls Row 1 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary,#94A3B8)]" />
            <input 
              type="text"
              placeholder="Search name, phone, email, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="crm-input w-full pl-9"
            />
          </div>

          {/* Stage Dropdown */}
          <select 
            value={stage} 
            onChange={(e) => setStage(e.target.value)}
            className="crm-select min-w-[120px]"
          >
            <option value="">Stage</option>
            <option value="PROPOSAL">Proposal</option>
            <option value="NEW">New</option>
            <option value="ACTIVE">Active</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select>

          {/* Assigned User Dropdown */}
          <select 
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)}
            className="crm-select min-w-[140px]"
          >
            <option value="">Assigned User</option>
            <option value={identity.id}>{identity.name || identity.email}</option>
          </select>

          {/* Source Dropdown */}
          <select 
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="crm-select min-w-[120px]"
          >
            <option value="">Source</option>
            <option value="PROFILE_SHARE_DETAILS">Share Details</option>
            <option value="NFC">NFC Tap</option>
            <option value="QR">QR Scan</option>
            <option value="MANUAL">Manual</option>
            <option value="DIRECT">Direct</option>
            <option value="WEBSITE">Website</option>
          </select>

          {/* Office Location Dropdown */}
          <select 
            value={officeLocation}
            onChange={(e) => setOfficeLocation(e.target.value)}
            className="crm-select min-w-[130px]"
          >
            <option value="">Office Location</option>
          </select>

          {/* Status Dropdown */}
          <select 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="crm-select min-w-[110px]"
          >
            <option value="">Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          {/* Lead Scope */}
          <select 
            value={leadScope}
            onChange={(e) => setLeadScope(e.target.value)}
            className="crm-select min-w-[110px]"
          >
            <option value="all">All Leads</option>
            <option value="my">My Leads</option>
          </select>

          {/* Date From Field */}
          <div className="relative min-w-[130px]">
            <input 
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="crm-input w-full text-xs"
              placeholder="dd/mm/yyyy"
            />
          </div>

          {/* Date To Field */}
          <div className="relative min-w-[130px]">
            <input 
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="crm-input w-full text-xs"
              placeholder="dd/mm/yyyy"
            />
          </div>
        </div>

        {/* Filter Controls Row 2: Subtext & Reset Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2 text-xs font-medium text-[var(--text-secondary,#64748B)]">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
            <span>Use filters to refine the pipeline view, then export the same dataset to CSV.</span>
          </div>

          <button 
            onClick={resetFilters}
            className="bg-[var(--input-bg,#F8FAFC)] hover:bg-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] text-[11px] font-extrabold uppercase tracking-wider px-5 h-[40px] rounded-xl transition-all border border-[var(--border-color,#E2E8F0)] cursor-pointer shadow-sm ml-auto"
          >
            RESET FILTERS
          </button>
        </div>
      </div>

      {/* Mobile Responsive Cards (visible on mobile screens) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-secondary,#94A3B8)] bg-[var(--surface,#FFFFFF)] rounded-2xl border border-[var(--border-color,#E2E8F0)] shadow-sm">
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary,#94A3B8)] bg-[var(--surface,#FFFFFF)] rounded-2xl border border-[var(--border-color,#E2E8F0)] shadow-sm">
            No leads found matching your criteria.
          </div>
        ) : (
          leads.map(lead => (
            <div 
              key={lead.id} 
              onClick={() => setSelectedLeadId(lead.id)}
              className="bg-[var(--surface,#FFFFFF)] rounded-2xl p-4 border border-[var(--border-color,#E2E8F0)] shadow-sm space-y-3 cursor-pointer hover:border-emerald-500 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-full ${getAvatarGradient(lead.name || "L")} font-bold flex items-center justify-center text-sm shadow-sm`}>
                    {(lead.name || "L").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-[var(--text-primary,#0F172A)] text-sm">{lead.name}</div>
                    <div className="text-xs text-[var(--text-secondary,#94A3B8)]">{lead.companyName || "No company"}</div>
                  </div>
                </div>
                <span className={getStageBadgeClass(lead.stage)}>
                  {lead.stage || "PROPOSAL"}
                </span>
              </div>

              <div className="text-xs space-y-1 text-[var(--text-primary,#0F172A)] bg-[var(--input-bg,#F8FAFC)] p-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)]">
                <div><strong>Contact:</strong> {lead.contactNumber}</div>
                {lead.email && <div><strong>Email:</strong> {lead.email}</div>}
                <div><strong>Assigned To:</strong> {lead.assignedUserName || identity.name}</div>
                <div><strong>Total Amount:</strong> {lead.totalAmount ? formatCurrency(lead.totalAmount) : "₹0"}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop CRM Table View */}
      <div className="hidden md:block crm-table-card">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                {visibleColumns.leadName && <th>LEAD NAME</th>}
                {visibleColumns.nextFollowUp && <th>NEXT FOLLOW-UP</th>}
                {visibleColumns.assignedTo && <th>ASSIGNED TO</th>}
                {visibleColumns.stage && <th>STAGE</th>}
                {visibleColumns.lastRemark && (
                  <th 
                    className="cursor-pointer hover:text-[var(--text-primary,#0F172A)] select-none"
                    onClick={() => { setSortBy("lastRemark"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>LAST REMARK</span>
                      <ArrowUpDown className="w-3 h-3 text-[var(--text-secondary,#94A3B8)]" />
                    </div>
                  </th>
                )}
                {visibleColumns.totalAmount && (
                  <th 
                    className="cursor-pointer hover:text-[var(--text-primary,#0F172A)] select-none"
                    onClick={() => { setSortBy("totalAmount"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>TOTAL AMOUNT</span>
                      <ArrowUpDown className="w-3 h-3 text-[var(--text-secondary,#94A3B8)]" />
                    </div>
                  </th>
                )}
                {visibleColumns.advanceAmount && (
                  <th 
                    className="cursor-pointer hover:text-[var(--text-primary,#0F172A)] select-none"
                    onClick={() => { setSortBy("advanceAmount"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>ADVANCE AMOUNT</span>
                      <ArrowUpDown className="w-3 h-3 text-[var(--text-secondary,#94A3B8)]" />
                    </div>
                  </th>
                )}
                {visibleColumns.leadCycle && <th>LEAD CYCLE</th>}
                {visibleColumns.source && <th>SOURCE</th>}
                {visibleColumns.actions && <th className="text-right">ACTIONS</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center text-[var(--text-secondary,#94A3B8)] py-12">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading leads...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-[var(--text-secondary,#94A3B8)] py-12">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isStarred = !!starredLeads[lead.id];
                  const leadName = lead.name || "Unnamed Lead";
                  const avatarLetter = leadName.charAt(0).toUpperCase();

                  return (
                    <tr 
                      key={lead.id} 
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="cursor-pointer group"
                    >
                      {/* LEAD NAME COLUMN */}
                      {visibleColumns.leadName && (
                        <td>
                          <div className="flex items-start space-x-3">
                            {/* Avatar Circle */}
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

                              {/* Email Subtext */}
                              <div className="text-[11px] text-[var(--text-secondary,#94A3B8)] flex items-center space-x-1">
                                <span>{lead.email || "No email"}</span>
                              </div>

                              {/* Phone & Quick Icons */}
                              <div className="text-[11px] text-[var(--text-secondary,#94A3B8)] flex items-center space-x-1.5 pt-0.5">
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
                      )}

                      {/* NEXT FOLLOW-UP COLUMN */}
                      {visibleColumns.nextFollowUp && (
                        <td>
                          <div className="bg-[var(--input-bg,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] rounded-xl p-2.5 max-w-[150px]">
                            <div className="flex items-center space-x-2 text-[var(--text-primary,#0F172A)]">
                              <Calendar className="w-4 h-4 text-[var(--text-secondary,#94A3B8)] flex-shrink-0" />
                              <div className="leading-tight">
                                {lead.nextFollowUpAt ? (
                                  <>
                                    <div className="font-bold text-[11px] text-[var(--text-primary,#0F172A)]">
                                      {new Date(lead.nextFollowUpAt).toLocaleDateString()}
                                    </div>
                                    <div className="text-[10px] text-[var(--text-secondary,#94A3B8)] truncate max-w-[100px]">
                                      {lead.nextFollowUpNote || "Follow up scheduled"}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="font-bold text-[11px] text-[var(--text-secondary,#94A3B8)] uppercase tracking-wide">
                                      NO FOLLOW-UP
                                    </div>
                                    <div className="text-[10px] text-[var(--text-secondary,#94A3B8)] font-medium">
                                      Not scheduled
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* ASSIGNED TO COLUMN */}
                      {visibleColumns.assignedTo && (
                        <td>
                          <div className="flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-full bg-[var(--input-bg,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {(lead.assignedUserName || identity.name || "M").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[var(--text-primary,#0F172A)] text-xs">
                                {lead.assignedUserName || identity.name || "Mummed Sinan mm"}
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary,#94A3B8)]">
                                {lead.assignedUserEmail || identity.email || "sinanmm7@gmail.com"}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* STAGE COLUMN */}
                      {visibleColumns.stage && (
                        <td>
                          <span className={getStageBadgeClass(lead.stage)}>
                            {lead.stage || "PROPOSAL"}
                          </span>
                        </td>
                      )}

                      {/* LAST REMARK COLUMN */}
                      {visibleColumns.lastRemark && (
                        <td className="text-[var(--text-secondary,#94A3B8)] font-medium max-w-[180px] truncate">
                          {lead.lastRemark || "—"}
                        </td>
                      )}

                      {/* TOTAL AMOUNT COLUMN */}
                      {visibleColumns.totalAmount && (
                        <td className="font-bold text-[var(--text-primary,#0F172A)]">
                          {lead.totalAmount ? formatCurrency(lead.totalAmount) : "₹0"}
                        </td>
                      )}

                      {/* ADVANCE AMOUNT COLUMN */}
                      {visibleColumns.advanceAmount && (
                        <td className="font-bold text-[var(--text-primary,#0F172A)]">
                          {lead.advanceAmount ? formatCurrency(lead.advanceAmount) : "₹0"}
                        </td>
                      )}

                      {/* LEAD CYCLE COLUMN */}
                      {visibleColumns.leadCycle && (
                        <td className="text-[var(--text-secondary,#94A3B8)] text-xs font-medium">
                          {lead.leadCycle || "No life..."}
                        </td>
                      )}

                      {/* SOURCE COLUMN */}
                      {visibleColumns.source && (
                        <td className="text-[var(--text-primary,#0F172A)] text-xs font-semibold">
                          {lead.source}
                        </td>
                      )}

                      {/* ACTIONS COLUMN */}
                      {visibleColumns.actions && (
                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setActiveActionMenuId(activeActionMenuId === lead.id ? null : lead.id)}
                              className="p-1.5 hover:bg-[var(--bg-secondary,#F8FAFC)] rounded-lg text-[var(--text-secondary,#94A3B8)] transition-colors border-none cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeActionMenuId === lead.id && (
                              <div className="absolute right-0 mt-1 w-44 bg-[var(--surface,#FFFFFF)] border border-[var(--border-color,#E2E8F0)] rounded-xl shadow-lg z-30 py-1 text-left">
                                <button
                                  onClick={() => { setSelectedLeadId(lead.id); setActiveActionMenuId(null); }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-[var(--text-primary,#0F172A)] hover:bg-[var(--bg-secondary,#F8FAFC)] flex items-center space-x-2 border-none bg-transparent cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[var(--text-secondary,#94A3B8)]" />
                                  <span>View Lead</span>
                                </button>

                                <button
                                  onClick={() => { setSelectedLeadId(lead.id); setActiveActionMenuId(null); }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-[var(--text-primary,#0F172A)] hover:bg-[var(--bg-secondary,#F8FAFC)] flex items-center space-x-2 border-none bg-transparent cursor-pointer"
                                >
                                  <Edit className="w-3.5 h-3.5 text-[var(--text-secondary,#94A3B8)]" />
                                  <span>Edit Lead</span>
                                </button>

                                <button
                                  onClick={() => { handleLeadStageChange(lead.id, "WON"); setActiveActionMenuId(null); }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-emerald-500 hover:bg-emerald-500/10 flex items-center space-x-2 border-none bg-transparent cursor-pointer"
                                >
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>Mark as Won</span>
                                </button>

                                <button
                                  onClick={() => { handleDeleteLead(lead.id); setActiveActionMenuId(null); }}
                                  className="w-full px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 flex items-center space-x-2 border-none bg-transparent cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Delete Lead</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && total > limit && (
          <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-secondary,#F8FAFC)] border-t border-[var(--border-color,#E2E8F0)]">
            <div className="text-xs font-medium text-[var(--text-secondary,#94A3B8)]">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
            </div>
            <div className="flex space-x-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="crm-btn-white text-xs py-1.5 px-3"
              >
                Previous
              </button>
              <button 
                disabled={page * limit >= total}
                onClick={() => setPage(p => p + 1)}
                className="crm-btn-white text-xs py-1.5 px-3"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Columns Selector Modal */}
      {isColumnsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface,#FFFFFF)] rounded-2xl shadow-xl border border-[var(--border-color,#E2E8F0)] max-w-sm w-full p-5 space-y-4 text-[var(--text-primary,#0F172A)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color,#E2E8F0)] pb-3">
              <h3 className="font-bold text-[var(--text-primary,#0F172A)] text-sm">Manage Visible Columns</h3>
              <button onClick={() => setIsColumnsModalOpen(false)} className="text-[var(--text-secondary,#94A3B8)] hover:text-[var(--text-primary,#0F172A)] border-none bg-transparent cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto text-xs font-medium">
              {Object.entries({
                leadName: "Lead Name",
                nextFollowUp: "Next Follow-up",
                assignedTo: "Assigned To",
                stage: "Stage",
                lastRemark: "Last Remark",
                totalAmount: "Total Amount",
                advanceAmount: "Advance Amount",
                leadCycle: "Lead Cycle",
                source: "Source",
                actions: "Action Menu",
              }).map(([key, label]) => (
                <label key={key} className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-[var(--bg-secondary,#F8FAFC)] rounded-lg">
                  <input 
                    type="checkbox"
                    checked={(visibleColumns as any)[key]}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                    className="rounded border-[var(--border-color,#E2E8F0)] text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setIsColumnsModalOpen(false)}
                className="crm-btn-emerald text-xs py-2 px-4"
              >
                Apply Columns
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawers */}
      <AddLeadDrawer 
        isOpen={isAddOpen} 
        onClose={() => setIsAddOpen(false)} 
        onSuccess={() => {
          setIsAddOpen(false);
          fetchLeads();
        }}
        identity={identity}
      />

      <LeadDetailsDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdated={() => fetchLeads()}
      />
    </div>
  );
}
