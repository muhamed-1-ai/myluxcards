"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  CheckCircle2,
  PauseCircle,
  Edit2,
  Trash2,
  Power,
  X,
  User,
  AlertTriangle,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

export interface LeadSourceItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  leadCount: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isSystem?: boolean;
}

const INITIAL_SOURCES: LeadSourceItem[] = [
  {
    id: "src-1",
    name: "NFC Tap",
    code: "NFC",
    description: "Leads captured via physical NFC business card tap",
    leadCount: 42,
    active: true,
    createdBy: "System",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-08-30T14:22:00.000Z",
    isSystem: true,
  },
  {
    id: "src-2",
    name: "QR Scan",
    code: "QR",
    description: "Leads captured via scanned digital QR code",
    leadCount: 28,
    active: true,
    createdBy: "System",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-08-29T18:10:00.000Z",
    isSystem: true,
  },
  {
    id: "src-3",
    name: "Direct Link",
    code: "DIRECT",
    description: "Direct URL visits to public card profile",
    leadCount: 15,
    active: true,
    createdBy: "System",
    createdAt: "2026-07-05T11:30:00.000Z",
    updatedAt: "2026-08-28T16:05:00.000Z",
    isSystem: true,
  },
  {
    id: "src-4",
    name: "Website Lead Form",
    code: "WEB",
    description: "Inbound submissions from corporate marketing site",
    leadCount: 9,
    active: true,
    createdBy: "Muhammed Febin",
    createdAt: "2026-07-12T14:15:00.000Z",
    updatedAt: "2026-08-25T11:40:00.000Z",
    isSystem: false,
  },
  {
    id: "src-5",
    name: "Client Referral",
    code: "REF",
    description: "Leads referred by existing VIP client accounts",
    leadCount: 6,
    active: true,
    createdBy: "Muhammed Febin",
    createdAt: "2026-07-20T16:45:00.000Z",
    updatedAt: "2026-08-24T09:15:00.000Z",
    isSystem: false,
  },
  {
    id: "src-6",
    name: "Social Media Campaign",
    code: "SOCIAL",
    description: "Leads generated from LinkedIn and Instagram ad campaigns",
    leadCount: 4,
    active: false,
    createdBy: "Muhammed Febin",
    createdAt: "2026-08-01T08:20:00.000Z",
    updatedAt: "2026-08-20T13:30:00.000Z",
    isSystem: false,
  },
];

const LOCAL_STORAGE_KEY = "myluxcards_lead_sources_data_v1";

export function LeadSourcesConfig() {
  const [sources, setSources] = useState<LeadSourceItem[]>(INITIAL_SOURCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<LeadSourceItem | null>(null);
  const [deletingSource, setDeletingSource] = useState<LeadSourceItem | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    active: true,
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSources(parsed);
        }
      }
    } catch {
      // Fall back to initial sources
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when sources state changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sources));
    } catch {
      // Ignore storage errors
    }
  }, [sources, isLoaded]);

  // KPI Calculations
  const totalCount = sources.length;
  const activeCount = useMemo(() => sources.filter((s) => s.active).length, [sources]);
  const inactiveCount = useMemo(() => sources.filter((s) => !s.active).length, [sources]);

  // Filtered dataset
  const filteredSources = useMemo(() => {
    return sources.filter((src) => {
      // Status Filter
      if (statusFilter === "active" && !src.active) return false;
      if (statusFilter === "inactive" && src.active) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = src.name.toLowerCase().includes(q);
        const matchCode = src.code.toLowerCase().includes(q);
        const matchCreatedBy = src.createdBy.toLowerCase().includes(q);
        const matchDesc = src.description ? src.description.toLowerCase().includes(q) : false;
        return matchName || matchCode || matchCreatedBy || matchDesc;
      }

      return true;
    });
  }, [sources, statusFilter, searchQuery]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredSources.length / pageSize) || 1;
  const paginatedSources = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSources.slice(start, start + pageSize);
  }, [filteredSources, currentPage, pageSize]);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Handlers
  const handleOpenCreate = () => {
    setFormData({ name: "", code: "", description: "", active: true });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (src: LeadSourceItem) => {
    setEditingSource(src);
    setFormData({
      name: src.name,
      code: src.code,
      description: src.description || "",
      active: src.active,
    });
  };

  const handleToggleActive = (id: string) => {
    const now = new Date().toISOString();
    setSources((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, active: !item.active, updatedAt: now } : item
      )
    );
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const autoCode =
      formData.code.trim().toUpperCase() ||
      formData.name.trim().replaceAll(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase() ||
      "SRC";

    const now = new Date().toISOString();
    const newItem: LeadSourceItem = {
      id: `src-${Date.now()}`,
      name: formData.name.trim(),
      code: autoCode,
      description: formData.description.trim() || undefined,
      leadCount: 0,
      active: formData.active,
      createdBy: "Muhammed Febin",
      createdAt: now,
      updatedAt: now,
      isSystem: false,
    };

    setSources((prev) => [newItem, ...prev]);
    setIsCreateOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource || !formData.name.trim()) return;

    const now = new Date().toISOString();
    setSources((prev) =>
      prev.map((item) => {
        if (item.id !== editingSource.id) return item;
        return {
          ...item,
          name: formData.name.trim(),
          code: item.isSystem ? item.code : (formData.code.trim().toUpperCase() || item.code),
          description: formData.description.trim() || undefined,
          active: formData.active,
          updatedAt: now,
        };
      })
    );
    setEditingSource(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingSource) return;
    if (deletingSource.isSystem || deletingSource.leadCount > 0) {
      handleToggleActive(deletingSource.id);
      setDeletingSource(null);
      return;
    }

    setSources((prev) => prev.filter((item) => item.id !== deletingSource.id));
    setDeletingSource(null);
  };

  // Helper date formatters
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return isoStr;
    }
  };

  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return `${datePart} • ${timePart}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 1400, margin: "0 auto", paddingBottom: 40 }}>
      {/* 1. PAGE HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          padding: "24px 28px",
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            <span>MASTER CONFIGURATION</span>
            <span style={{ opacity: 0.5 }}>→</span>
            <span>LEAD SOURCES</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#FFF", margin: "4px 0 2px", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
            Lead Sources
          </h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
            Configure and manage Lead acquisition channels used across MyLuxCards.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 44,
            padding: "0 22px",
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
          Create Lead Source
        </button>
      </div>

      {/* 2. SUMMARY KPI CARDS (3 Equal Columns) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
        }}
      >
        {/* KPI 1: TOTAL LEAD SOURCES */}
        <div
          style={{
            background: "#12131A",
            border: "1px solid rgba(0, 229, 255, 0.18)",
            borderRadius: 16,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 110,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              TOTAL LEAD SOURCES
            </span>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#FFFFFF", marginTop: 4, fontFamily: "Inter, system-ui, sans-serif" }}>
              {totalCount}
            </div>
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(0, 229, 255, 0.12)",
              border: "1px solid rgba(0, 229, 255, 0.25)",
              color: "#0066FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GitBranch style={{ width: 22, height: 22 }} />
          </div>
        </div>

        {/* KPI 2: ACTIVE SOURCES */}
        <div
          style={{
            background: "#12131A",
            border: "1px solid rgba(0, 229, 255, 0.18)",
            borderRadius: 16,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 110,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ACTIVE SOURCES
            </span>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0066FF", marginTop: 4, fontFamily: "Inter, system-ui, sans-serif" }}>
              {activeCount}
            </div>
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "#10B981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 style={{ width: 22, height: 22 }} />
          </div>
        </div>

        {/* KPI 3: INACTIVE SOURCES */}
        <div
          style={{
            background: "#12131A",
            border: "1px solid rgba(0, 229, 255, 0.18)",
            borderRadius: 16,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 110,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              INACTIVE SOURCES
            </span>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#94A3B8", marginTop: 4, fontFamily: "Inter, system-ui, sans-serif" }}>
              {inactiveCount}
            </div>
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#94A3B8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PauseCircle style={{ width: 22, height: 22 }} />
          </div>
        </div>
      </div>

      {/* 3. MAIN MANAGEMENT CONTAINER */}
      <div
        style={{
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 8px 28px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* SEARCH & FILTER TOOLBAR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
            <Search
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 16,
                height: 16,
                color: "#0066FF",
              }}
            />
            <input
              type="text"
              placeholder="Search lead sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(0, 229, 255, 0.6)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.1)")}
            />
          </div>

          {/* Status Filter Segmented Control */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "#181924",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: 4,
              borderRadius: 12,
            }}
          >
            {(["all", "active", "inactive"] as const).map((filterKey) => {
              const label = filterKey === "all" ? "All" : filterKey === "active" ? "Active" : "Inactive";
              const isActive = statusFilter === filterKey;
              return (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setStatusFilter(filterKey)}
                  style={{
                    height: 34,
                    padding: "0 18px",
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 600,
                    fontFamily: "Inter, system-ui, sans-serif",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: isActive ? "#0066FF" : "transparent",
                    color: isActive ? "#08080A" : "#8E8EA0",
                    transition: "all 0.15s ease",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* DATA TABLE (Full Width Desktop) */}
        {filteredSources.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="lead-sources-desktop-table" style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 860 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", height: 48 }}>
                    <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      LEAD SOURCE NAME
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CODE
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CREATED BY
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      STATUS
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CREATED DATE
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      MODIFIED DATE
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSources.map((src) => (
                    <tr
                      key={src.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        height: 68,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Name & Description */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                              {src.name}
                            </div>
                            {src.description && (
                              <div style={{ fontSize: 11, color: "#8E8EA0", marginTop: 2 }}>
                                {src.description}
                              </div>
                            )}
                          </div>
                          {src.isSystem && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: "#0066FF",
                                background: "rgba(0, 229, 255, 0.12)",
                                border: "1px solid rgba(0, 229, 255, 0.25)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              SYSTEM
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Code Badge */}
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: "#0066FF",
                            background: "rgba(0, 229, 255, 0.1)",
                            border: "1px solid rgba(0, 229, 255, 0.25)",
                            padding: "3px 9px",
                            borderRadius: 6,
                            fontFamily: "monospace",
                          }}
                        >
                          {src.code}
                        </span>
                      </td>

                      {/* Created By */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#CBD5E1" }}>
                          <User style={{ width: 14, height: 14, color: "#94A3B8" }} />
                          <span>{src.createdBy}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 16px" }}>
                        {src.active ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: 20,
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              color: "#10B981",
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                            ACTIVE
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: 20,
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#94A3B8",
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94A3B8" }} />
                            INACTIVE
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#94A3B8" }}>
                        {formatDate(src.createdAt)}
                      </td>

                      {/* Modified Date */}
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "#94A3B8" }}>
                        {formatDateTime(src.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(src)}
                            title="Edit Lead Source"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#181924",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: 8,
                              color: "#E2E8F0",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)")}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)")}
                          >
                            <Edit2 style={{ width: 13, height: 13, color: "#0066FF" }} />
                            Edit
                          </button>

                          {/* Deactivate / Activate Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(src.id)}
                            title={src.active ? "Deactivate Lead Source" : "Activate Lead Source"}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: src.active ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                              border: src.active ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)",
                              borderRadius: 8,
                              color: src.active ? "#F87171" : "#34D399",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Power style={{ width: 13, height: 13 }} />
                            {src.active ? "Deactivate" : "Activate"}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeletingSource(src)}
                            title="Delete Lead Source"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 32,
                              height: 32,
                              background: "#181924",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: 8,
                              color: "#94A3B8",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#EF4444";
                              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#94A3B8";
                              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                            }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (Visible on screens < 768px) */}
            <div className="lead-sources-mobile-cards" style={{ display: "none", flexDirection: "column", gap: 14 }}>
              {paginatedSources.map((src) => (
                <div
                  key={`mobile-${src.id}`}
                  style={{
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 14,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{src.name}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", background: "rgba(0, 229, 255,0.1)", padding: "2px 6px", borderRadius: 4, marginTop: 4, display: "inline-block" }}>
                        CODE: {src.code}
                      </span>
                    </div>

                    {src.active ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#10B981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 20 }}>
                        ACTIVE
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "2px 8px", borderRadius: 20 }}>
                        INACTIVE
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    <div>Created by: <span style={{ color: "#E2E8F0" }}>{src.createdBy}</span></div>
                    <div>Created: <span style={{ color: "#E2E8F0" }}>{formatDate(src.createdAt)}</span></div>
                    <div>Modified: <span style={{ color: "#E2E8F0" }}>{formatDateTime(src.updatedAt)}</span></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(src)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#FFF", cursor: "pointer" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(src.id)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: src.active ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: "none", borderRadius: 8, color: src.active ? "#F87171" : "#34D399", cursor: "pointer" }}
                    >
                      {src.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSource(src)}
                      style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#EF4444", cursor: "pointer" }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255, 255, 255, 0.06)", fontSize: 12, color: "#94A3B8" }}>
                <div>
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredSources.length)} of {filteredSources.length} entries
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      color: currentPage === 1 ? "#475569" : "#E2E8F0",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    <ChevronLeft style={{ width: 14, height: 14 }} />
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      color: currentPage === totalPages ? "#475569" : "#E2E8F0",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    Next
                    <ChevronRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* SEARCH / FILTER EMPTY STATE */
          <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.2)", color: "#0066FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Filter style={{ width: 24, height: 24 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
              No Lead Sources Match Your Search
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, maxWidth: 380 }}>
              We couldn't find any lead sources matching your current filter criteria. Try clearing your filters or search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              style={{
                marginTop: 8,
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: 700,
                background: "#181924",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                borderRadius: 8,
                color: "#0066FF",
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            style={{ width: "100%", maxWidth: 460, background: "#12131A", border: "1px solid rgba(0, 229, 255,0.3)", padding: 26, borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>MASTER CONFIGURATION</span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>Create Lead Source</h2>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Lead Source Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Instagram Campaign"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: "11px 14px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 13, outline: "none" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. INSTA"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  style={{ width: "100%", padding: "11px 14px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Leads coming from bio link click"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: "100%", padding: "11px 14px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Initial Status</label>
                <select
                  value={formData.active ? "active" : "inactive"}
                  onChange={(e) => setFormData({ ...formData, active: e.target.value === "active" })}
                  style={{ width: "100%", padding: "11px 14px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 13, outline: "none" }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 12 }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, borderRadius: 9, background: "#181924", color: "#CBD5E1", border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: "10px 22px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#0066FF", color: "#07080B", border: "none", cursor: "pointer" }}>
                  Create Lead Source
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingSource && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setEditingSource(null)}
        >
          <div
            style={{ width: "100%", maxWidth: 460, background: "#12131A", border: "1px solid rgba(0, 229, 255,0.3)", padding: 26, borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>MASTER CONFIGURATION</span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>Edit Lead Source</h2>
              </div>
              <button type="button" onClick={() => setEditingSource(null)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Lead Source Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: "11px 14px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 13, outline: "none" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Code</label>
                <input
                  type="text"
                  value={formData.code}
                  disabled={editingSource.isSystem}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    background: editingSource.isSystem ? "#0E0F14" : "#181924",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    color: editingSource.isSystem ? "#94A3B8" : "#FFF",
                    fontSize: 13,
                    outline: "none",
                    cursor: editingSource.isSystem ? "not-allowed" : "text",
                  }}
                />
                {editingSource.isSystem && (
                  <span style={{ fontSize: 10, color: "#0066FF", marginTop: 4, display: "block" }}>
                    System source codes cannot be modified to preserve analytics attribution.
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: "100%", padding: "11px 14px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>Status</label>
                <select
                  value={formData.active ? "active" : "inactive"}
                  onChange={(e) => setFormData({ ...formData, active: e.target.value === "active" })}
                  style={{ width: "100%", padding: "11px 14px", background: "#181924", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#FFF", fontSize: 13, outline: "none" }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 12 }}>
                <button type="button" onClick={() => setEditingSource(null)} style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, borderRadius: 9, background: "#181924", color: "#CBD5E1", border: "none", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: "10px 22px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#0066FF", color: "#07080B", border: "none", cursor: "pointer" }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION / SAFETY MODAL */}
      {deletingSource && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setDeletingSource(null)}
        >
          <div
            style={{ width: "100%", maxWidth: 440, background: "#12131A", border: "1px solid rgba(239, 68, 68, 0.4)", padding: 26, borderRadius: 18, boxShadow: "0 20px 50px rgba(0,0,0,0.7)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#FFF", margin: 0 }}>
                  {deletingSource.isSystem || deletingSource.leadCount > 0 ? "Protected System Source" : "Delete Lead Source?"}
                </h3>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{deletingSource.name}</span>
              </div>
            </div>

            {deletingSource.isSystem || deletingSource.leadCount > 0 ? (
              <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 20px" }}>
                This Lead Source is a <strong>core system channel</strong> or has <strong>{deletingSource.leadCount} active leads</strong> attributed to it. To protect historical lead data integrity, deletion is restricted. You can <strong>Deactivate</strong> it instead to hide it from selection.
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 20px" }}>
                Are you sure you want to permanently remove <strong>"{deletingSource.name}"</strong>? This action cannot be undone.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingSource(null)}
                style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, borderRadius: 9, background: "#181924", color: "#CBD5E1", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>

              {deletingSource.isSystem || deletingSource.leadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#0066FF", color: "#07080B", border: "none", cursor: "pointer" }}
                >
                  Deactivate Source Instead
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#EF4444", color: "#FFF", border: "none", cursor: "pointer" }}
                >
                  Delete Lead Source
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
