"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Download,
  Star,
  Phone,
  MessageSquare,
  ArrowUpDown,
  MoreVertical,
  Eye,
  Trash2,
  Users
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
  const limit = 25;

  // UI State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [starredLeads, setStarredLeads] = useState<Record<string, boolean>>({});
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
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
  }, [page, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

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
      `"${(l.stage || l.status || "").replace(/"/g, '""')}"`,
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

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      fetchLeads();
    } catch (err) {
      console.error("Failed to delete lead", err);
    }
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
    <div className="leads-page-container flex flex-col min-h-screen w-full max-w-none space-y-6">

      {/* Native Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="crm-header-title">All Leads</h1>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            Total Count: <strong className="ml-1.5 text-[var(--text-primary,#0F172A)]">{total}</strong>
          </span>
        </div>

        {/* Top Control Actions */}
        <div className="flex items-center space-x-3">
          {leads.length > 0 && (
            <button onClick={handleExportCSV} className="crm-btn-secondary">
              <Download className="w-4 h-4 text-[var(--text-secondary,#64748B)]" />
              <span>Export CSV</span>
            </button>
          )}

          <button onClick={() => setIsAddOpen(true)} className="crm-btn-primary">
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ New Lead</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Row (Total Leads, Open Pipeline, Due Today) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Leads */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#10B981]" />
          <span className="kpi-label">TOTAL LEADS</span>
          <span className="kpi-value">{total}</span>
        </div>

        {/* Card 2: Open Pipeline */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#3B82F6]" />
          <span className="kpi-label">OPEN PIPELINE</span>
          <span className="kpi-value">{kpis.openPipeline}</span>
        </div>

        {/* Card 3: Due Today */}
        <div className="kpi-card">
          <div className="kpi-accent-bar bg-[#F97316]" />
          <span className="kpi-label">DUE TODAY</span>
          <span className="kpi-value">{kpis.dueToday}</span>
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
            No leads found in your pipeline.
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
                <span className={getStageBadgeClass(lead.stage || lead.status)}>
                  {lead.stage || lead.status || "NEW"}
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

      {/* Desktop Native Table View */}
      <div className="hidden md:block crm-table-card">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="w-[240px]">LEAD NAME</th>
                <th>COMPANY</th>
                <th>SOURCE</th>
                <th>STAGE</th>
                <th>ASSIGNED TO</th>
                <th
                  className="cursor-pointer hover:text-[var(--text-primary,#0F172A)] select-none"
                  onClick={() => { setSortBy("totalAmount"); setSortOrder(sortOrder === "asc" ? "desc" : "asc"); }}
                >
                  <div className="flex items-center space-x-1">
                    <span>TOTAL AMOUNT</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--text-secondary,#94A3B8)]" />
                  </div>
                </th>
                <th>CREATED DATE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center text-[var(--text-secondary,#94A3B8)] py-12">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading leads...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[var(--text-secondary,#94A3B8)]">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Users className="w-8 h-8 text-[var(--text-secondary,#94A3B8)] opacity-60" />
                      <div className="text-sm font-semibold">No leads found in your pipeline.</div>
                      <button onClick={() => setIsAddOpen(true)} className="crm-btn-primary mt-2">
                        <Plus className="w-4 h-4" />
                        <span>Create your first lead</span>
                      </button>
                    </div>
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
                              <div className="text-[11px] text-[var(--text-secondary,#94A3B8)]">
                                {lead.email}
                              </div>
                            )}

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

                      {/* COMPANY COLUMN */}
                      <td className="font-medium text-[var(--text-primary,#0F172A)]">
                        {lead.companyName || "—"}
                      </td>

                      {/* SOURCE COLUMN */}
                      <td>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--bg-secondary,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] text-xs font-semibold text-[var(--text-secondary,#64748B)]">
                          {lead.source || "DIRECT"}
                        </span>
                      </td>

                      {/* STAGE COLUMN */}
                      <td>
                        <span className={getStageBadgeClass(lead.stage || lead.status)}>
                          {lead.stage || lead.status || "NEW"}
                        </span>
                      </td>

                      {/* ASSIGNED TO COLUMN */}
                      <td>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--input-bg,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                            {(lead.assignedUserName || identity.name || "U").charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-xs text-[var(--text-primary,#0F172A)]">
                            {lead.assignedUserName || identity.name || "Unassigned"}
                          </span>
                        </div>
                      </td>

                      {/* TOTAL AMOUNT COLUMN */}
                      <td className="font-bold text-[var(--text-primary,#0F172A)]">
                        {lead.totalAmount ? formatCurrency(lead.totalAmount) : "₹0"}
                      </td>

                      {/* CREATED DATE COLUMN */}
                      <td className="text-[var(--text-secondary,#64748B)] text-xs font-medium">
                        {new Date(lead.createdAt || Date.now()).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </td>

                      {/* ACTIONS COLUMN */}
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => setActiveActionMenuId(activeActionMenuId === lead.id ? null : lead.id)}
                            className="p-1.5 rounded-lg hover:bg-[var(--border-color,#E2E8F0)]/40 text-[var(--text-secondary,#64748B)] transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeActionMenuId === lead.id && (
                            <div
                              className="absolute right-0 mt-1 w-36 bg-[var(--surface,#FFFFFF)] rounded-xl border border-[var(--border-color,#E2E8F0)] shadow-xl z-30 py-1 font-medium text-xs text-[var(--text-primary,#0F172A)]"
                              onClick={() => setActiveActionMenuId(null)}
                            >
                              <button
                                onClick={() => setSelectedLeadId(lead.id)}
                                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-secondary,#F8FAFC)] flex items-center space-x-2"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-500" />
                                <span>View Details</span>
                              </button>
                              <button
                                onClick={() => handleDeleteLead(lead.id)}
                                className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-500 flex items-center space-x-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Delete Lead</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawers */}
      <AddLeadDrawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => { setIsAddOpen(false); fetchLeads(); }}
        identity={identity}
      />

      {selectedLeadId && (
        <LeadDetailsDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdated={() => fetchLeads()}
        />
      )}
    </div>
  );
}
