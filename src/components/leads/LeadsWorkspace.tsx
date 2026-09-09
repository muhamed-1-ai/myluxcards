"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Download, Upload, LayoutGrid, List } from "lucide-react";
import AddLeadDrawer from "./AddLeadDrawer";
import LeadDetailsDrawer from "./LeadDetailsDrawer";

interface LeadsWorkspaceProps {
  identity: { id: string; name: string | null; email: string; role: string };
}

export default function LeadsWorkspace({ identity }: LeadsWorkspaceProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState({ openPipeline: 0, wonLeads: 0, dueToday: 0 });
  
  // Filters and Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const limit = 25;

  // UI State
  const [viewMode, setViewMode] = useState<"table" | "pipeline">("table");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: debouncedSearch,
        stage,
        source,
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
  }, [debouncedSearch, stage, source, page, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const getStageColor = (s: string) => {
    switch (s) {
      case "NEW": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "CONTACTED": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "INTERESTED": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "FOLLOW_UP": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "WON": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "LOST": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] theme-transition">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
        <h1 className="text-2xl font-semibold tracking-tight">All Leads</h1>
        <div className="flex items-center space-x-3">
          <button className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--hover-bg)] transition-colors">
            <Upload className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--hover-bg)] transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Lead
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
            <div className="text-sm text-[var(--text-muted)] mb-1">Total Leads</div>
            <div className="text-2xl font-bold">{total}</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
            <div className="text-sm text-[var(--text-muted)] mb-1">Open Pipeline</div>
            <div className="text-2xl font-bold text-blue-500">{kpis.openPipeline}</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
            <div className="text-sm text-[var(--text-muted)] mb-1">Won Leads</div>
            <div className="text-2xl font-bold text-green-500">{kpis.wonLeads}</div>
          </div>
          <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
            <div className="text-sm text-[var(--text-muted)] mb-1">Due Today</div>
            <div className="text-2xl font-bold text-orange-500">{kpis.dueToday}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
          <div className="flex w-full md:w-auto items-center relative">
            <Search className="w-5 h-5 absolute left-3 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search name, phone, email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-80 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-color)] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            <select 
              value={stage} 
              onChange={(e) => setStage(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-sm"
            >
              <option value="">All Stages</option>
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="INTERESTED">Interested</option>
              <option value="FOLLOW_UP">Follow Up</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
            </select>
            <div className="flex border border-[var(--border-color)] rounded-lg overflow-hidden">
              <button 
                onClick={() => setViewMode("table")}
                className={`p-2 ${viewMode === "table" ? "bg-[var(--hover-bg)]" : ""}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("pipeline")}
                className={`p-2 border-l border-[var(--border-color)] ${viewMode === "pipeline" ? "bg-[var(--hover-bg)]" : ""}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        {viewMode === "table" && (
          <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--card-bg)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-sm text-[var(--text-muted)] bg-[var(--table-header-bg)]">
                    {[
                      { key: "name", label: "Lead Name" },
                      { key: "company", label: "Company" },
                      { key: "contact", label: "Contact" },
                      { key: "stage", label: "Stage" },
                      { key: "assigned", label: "Assigned To" },
                      { key: "source", label: "Source" },
                    ].map((col) => (
                      <th 
                        key={col.key}
                        onClick={() => {
                          if (sortBy === col.key) {
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          } else {
                            setSortBy(col.key);
                            setSortOrder("asc");
                          }
                        }}
                        className="px-6 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-[var(--hover-bg)] select-none"
                      >
                        <div className="flex items-center space-x-1">
                          <span>{col.label}</span>
                          {sortBy === col.key && (
                            <span className="text-blue-500 text-xs">
                              {sortOrder === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-muted)]">
                        Loading leads...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[var(--text-muted)]">
                        No leads found.
                      </td>
                    </tr>
                  ) : (
                    leads.map(lead => (
                      <tr 
                        key={lead.id} 
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="hover:bg-[var(--hover-bg)] transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            {lead.profileImage ? (
                              <img src={lead.profileImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                {lead.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-[var(--text-color)] group-hover:text-blue-400 transition-colors">{lead.name}</div>
                              <div className="text-xs text-[var(--text-muted)]">{new Date(lead.createdAt).toLocaleDateString()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">{lead.companyName || '-'}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm">{lead.contactNumber}</div>
                          {lead.email && <div className="text-xs text-[var(--text-muted)]">{lead.email}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStageColor(lead.stage)}`}>
                            {lead.stage}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{lead.assignedUserName || '-'}</td>
                        <td className="px-6 py-4 text-sm">{lead.source}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Footer */}
            {!loading && total > limit && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)]">
                <div className="text-sm text-[var(--text-muted)]">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
                </div>
                <div className="flex space-x-2">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1 border border-[var(--border-color)] rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={page * limit >= total}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1 border border-[var(--border-color)] rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === "pipeline" && (
          <div className="flex items-center justify-center h-64 border border-[var(--border-color)] rounded-xl border-dashed">
            <div className="text-[var(--text-muted)]">Pipeline view coming soon...</div>
          </div>
        )}

      </div>

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
