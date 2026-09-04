"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Power,
  X,
  User,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Layers,
  FileText,
} from "lucide-react";

export interface LobReasonItem {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  usageCount: number;
  isSystem?: boolean;
}

const INITIAL_LOB_REASONS: LobReasonItem[] = [
  {
    id: "lob-1",
    name: "Price Too High",
    status: "ACTIVE",
    createdAt: "2026-07-28T10:15:00.000Z",
    updatedAt: "2026-08-30T12:00:00.000Z",
    createdBy: "Muhammed Febin",
    usageCount: 18,
    isSystem: true,
  },
  {
    id: "lob-2",
    name: "Not Interested",
    status: "ACTIVE",
    createdAt: "2026-07-11T14:30:00.000Z",
    updatedAt: "2026-08-28T16:20:00.000Z",
    createdBy: "Muhammed Febin",
    usageCount: 12,
    isSystem: true,
  },
  {
    id: "lob-3",
    name: "Competitor Selected",
    status: "ACTIVE",
    createdAt: "2026-07-05T09:45:00.000Z",
    updatedAt: "2026-08-25T11:10:00.000Z",
    createdBy: "Muhammed Febin",
    usageCount: 9,
    isSystem: false,
  },
  {
    id: "lob-4",
    name: "Budget Constraint",
    status: "ACTIVE",
    createdAt: "2026-06-20T16:00:00.000Z",
    updatedAt: "2026-08-20T14:05:00.000Z",
    createdBy: "System",
    usageCount: 5,
    isSystem: false,
  },
  {
    id: "lob-5",
    name: "Timing / Delayed Decision",
    status: "INACTIVE",
    createdAt: "2026-06-15T08:20:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
    createdBy: "System",
    usageCount: 2,
    isSystem: false,
  },
];

const LOCAL_STORAGE_KEY = "myluxcards_lob_reasons_catalog_v1";

export function LobReasonsConfig() {
  const [reasons, setReasons] = useState<LobReasonItem[]>(INITIAL_LOB_REASONS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Action Menu Dropdown State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modal & Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<LobReasonItem | null>(null);
  const [deletingReason, setDeletingReason] = useState<LobReasonItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form Fields State
  const [formData, setFormData] = useState({
    name: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReasons(parsed);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when reasons change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reasons));
    } catch {
      // Ignore storage errors
    }
  }, [reasons, isLoaded]);

  // Debounce search query (~300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Close active dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenuId && !(e.target as HTMLElement).closest(".lob-action-menu-container")) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuId]);

  // Dynamic Metrics
  const totalConfiguredCount = reasons.length;

  // Filtered dataset
  const filteredReasons = useMemo(() => {
    return reasons.filter((item) => {
      // Status Filter
      if (statusFilter === "ACTIVE" && item.status !== "ACTIVE") return false;
      if (statusFilter === "INACTIVE" && item.status !== "INACTIVE") return false;

      // Search Query Filter
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCreator = item.createdBy.toLowerCase().includes(q);
        return matchName || matchCreator;
      }

      return true;
    });
  }, [reasons, statusFilter, debouncedSearch]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingReason(null);
    setFormData({
      name: "",
      status: "ACTIVE",
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: LobReasonItem) => {
    setEditingReason(item);
    setFormData({
      name: item.name,
      status: item.status,
    });
    setFormError("");
    setActiveMenuId(null);
    setIsFormOpen(true);
  };

  const handleToggleStatus = (id: string) => {
    const now = new Date().toISOString();
    setReasons((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
              updatedAt: now,
            }
          : item
      )
    );
    setActiveMenuId(null);
  };

  const handleSaveReason = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError("Reason Name is required.");
      return;
    }

    // Case-insensitive duplicate detection
    const isDuplicate = reasons.some(
      (r) =>
        r.name.toLowerCase() === trimmedName.toLowerCase() &&
        (!editingReason || r.id !== editingReason.id)
    );

    if (isDuplicate) {
      setFormError(`A reason with the name "${trimmedName}" already exists.`);
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      const now = new Date().toISOString();

      if (editingReason) {
        // Edit existing reason
        setReasons((prev) =>
          prev.map((item) =>
            item.id === editingReason.id
              ? {
                  ...item,
                  name: trimmedName,
                  status: formData.status,
                  updatedAt: now,
                }
              : item
          )
        );
      } else {
        // Create new reason
        const newReason: LobReasonItem = {
          id: `lob-${Date.now()}`,
          name: trimmedName,
          status: formData.status,
          createdAt: now,
          updatedAt: now,
          createdBy: "Muhammed Febin",
          usageCount: 0,
          isSystem: false,
        };

        setReasons((prev) => [newReason, ...prev]);
      }

      setIsSaving(false);
      setIsFormOpen(false);
    }, 200);
  };

  const handleConfirmDelete = () => {
    if (!deletingReason) return;
    if (deletingReason.isSystem || deletingReason.usageCount > 0) {
      // Safe fallback: Deactivate instead
      handleToggleStatus(deletingReason.id);
      setDeletingReason(null);
      return;
    }

    setReasons((prev) => prev.filter((item) => item.id !== deletingReason.id));
    setDeletingReason(null);
  };

  // Helper date formatter
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            LOSS OF BUSINESS
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#FFF", margin: "4px 0 2px", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
            LOB Reasons
          </h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
            Configure standardized loss-of-business reasons used during Lead stage exits and downstream analysis.
          </p>
        </div>
      </div>

      {/* 2. TOP ACTION BAR (Search, Status Filter, Create Reason) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          padding: "16px 24px",
          borderRadius: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
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
              placeholder="Search reasons"
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

          {/* Status Filter Select */}
          <div style={{ width: 170 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                width: "100%",
                height: 44,
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
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Filter Status Badge / Reset */}
          {(debouncedSearch.trim() || statusFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#0066FF",
                background: "rgba(0, 229, 255, 0.1)",
                border: "1px solid rgba(0, 229, 255, 0.25)",
                padding: "8px 14px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Create Reason Action Button */}
        <button
          type="button"
          onClick={handleOpenAdd}
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
          Create Reason
        </button>
      </div>

      {/* 3. LOB REASON REGISTRY CARD */}
      <div
        style={{
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 8px 28px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Card Header & Badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 20,
            marginBottom: 20,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#FFF", margin: 0, fontFamily: "Inter, system-ui, sans-serif" }}>
              LOB Reason Registry
            </h2>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: "2px 0 0" }}>
              Keep exit reasons clean for Lead workflows, audit trails, and LOB analytics.
            </p>
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#0066FF",
              background: "rgba(0, 229, 255, 0.12)",
              border: "1px solid rgba(0, 229, 255, 0.25)",
              padding: "4px 14px",
              borderRadius: 20,
            }}
          >
            {totalConfiguredCount} configured
          </div>
        </div>

        {/* LOB REASONS DATA TABLE */}
        {filteredReasons.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="lob-reasons-desktop-table" style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", height: 48, background: "#181924" }}>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      REASON NAME
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      STATUS
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CREATED DATE
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CREATED BY
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReasons.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        height: 68,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Reason Name */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
                          {item.name}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {item.status === "ACTIVE" ? (
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
                            Active
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
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: "14px 18px", fontSize: 13, color: "#94A3B8" }}>
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Created By */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#CBD5E1" }}>
                          <User style={{ width: 14, height: 14, color: "#94A3B8" }} />
                          <span>{item.createdBy}</span>
                        </div>
                      </td>

                      {/* Actions (Compact More Dropdown) */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div className="lob-action-menu-container" style={{ position: "relative", display: "inline-block" }}>
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                            title="More Actions"
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              background: "#181924",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "#94A3B8",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)")}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)")}
                          >
                            <MoreVertical style={{ width: 16, height: 16 }} />
                          </button>

                          {/* Dropdown Menu Overlay */}
                          {activeMenuId === item.id && (
                            <div
                              style={{
                                position: "absolute",
                                right: 0,
                                top: 40,
                                zIndex: 30,
                                width: 160,
                                background: "#181924",
                                border: "1px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: 12,
                                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                                padding: 6,
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "100%",
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#FFF",
                                  background: "transparent",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <Edit2 style={{ width: 14, height: 14, color: "#0066FF" }} />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(item.id)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "100%",
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: item.status === "ACTIVE" ? "#F87171" : "#34D399",
                                  background: "transparent",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <Power style={{ width: 14, height: 14 }} />
                                {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingReason(item);
                                  setActiveMenuId(null);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  width: "100%",
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#EF4444",
                                  background: "transparent",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <Trash2 style={{ width: 14, height: 14 }} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (<768px) */}
            <div className="lob-reasons-mobile-cards" style={{ display: "none", flexDirection: "column", gap: 14 }}>
              {filteredReasons.map((item) => (
                <div
                  key={`mobile-${item.id}`}
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
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{item.name}</div>
                    {item.status === "ACTIVE" ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#10B981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 20 }}>
                        Active
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "2px 8px", borderRadius: 20 }}>
                        Inactive
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: "#94A3B8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>Created: <span style={{ color: "#E2E8F0" }}>{formatDate(item.createdAt)}</span></div>
                    <div>By: <span style={{ color: "#E2E8F0" }}>{item.createdBy}</span></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#FFF", cursor: "pointer" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item.id)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: item.status === "ACTIVE" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: "none", borderRadius: 8, color: item.status === "ACTIVE" ? "#F87171" : "#34D399", cursor: "pointer" }}
                    >
                      {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingReason(item)}
                      style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#EF4444", cursor: "pointer" }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* EMPTY STATE */
          <div style={{ padding: "50px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.2)", color: "#0066FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText style={{ width: 22, height: 22 }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
              No LOB Reasons Match Your Search
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, maxWidth: 360 }}>
              We couldn't find any loss-of-business reasons matching your criteria. Try adjusting your search query or status filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              style={{
                marginTop: 6,
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

      {/* CREATE / EDIT LOB REASON MODAL (Matching Reference Layout) */}
      {isFormOpen && (
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
          onClick={() => setIsFormOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
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
                  CREATE LOB REASON
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>
                  {editingReason ? "Edit LOB Reason" : "Add LOB Reason"}
                </h2>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0" }}>
                  Maintain structured loss-of-business reasons so Lead exits stay consistent, auditable, and ready for analysis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
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

            {/* Modal Body */}
            <form
              id="lobReasonForm"
              onSubmit={handleSaveReason}
              style={{
                padding: "26px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 22,
              }}
            >
              {/* Validation Error Banner */}
              {formError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#F87171",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {formError}
                </div>
              )}

              {/* REASON NAME FIELD */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  Reason Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Price Too High"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "0 16px",
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    fontSize: 14,
                    outline: "none",
                  }}
                  required
                />
              </div>

              {/* STATUS CONTROL (Segmented Radio matching reference) */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  STATUS
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  {/* Active Selector Option */}
                  <div
                    onClick={() => setFormData({ ...formData, status: "ACTIVE" })}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 16px",
                      background: formData.status === "ACTIVE" ? "rgba(0, 229, 255, 0.12)" : "#181924",
                      border: formData.status === "ACTIVE" ? "1px solid #0066FF" : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: formData.status === "ACTIVE" ? "5px solid #0066FF" : "2px solid #94A3B8",
                        background: formData.status === "ACTIVE" ? "#08080A" : "transparent",
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: formData.status === "ACTIVE" ? "#FFF" : "#94A3B8" }}>
                      Active
                    </span>
                  </div>

                  {/* Inactive Selector Option */}
                  <div
                    onClick={() => setFormData({ ...formData, status: "INACTIVE" })}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 16px",
                      background: formData.status === "INACTIVE" ? "rgba(255, 255, 255, 0.08)" : "#181924",
                      border: formData.status === "INACTIVE" ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: formData.status === "INACTIVE" ? "5px solid #FFF" : "2px solid #94A3B8",
                        background: formData.status === "INACTIVE" ? "#08080A" : "transparent",
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: formData.status === "INACTIVE" ? "#FFF" : "#94A3B8" }}>
                      Inactive
                    </span>
                  </div>
                </div>
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
                onClick={() => setIsFormOpen(false)}
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
                form="lobReasonForm"
                disabled={isSaving}
                style={{
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
                {isSaving ? "Creating..." : editingReason ? "Save Changes" : "Create Reason"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingReason && (
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
          onClick={() => setDeletingReason(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#12131A",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              padding: 26,
              borderRadius: 18,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#FFF", margin: 0 }}>
                  {deletingReason.isSystem || deletingReason.usageCount > 0 ? "Protected LOB Reason" : "Delete LOB Reason?"}
                </h3>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{deletingReason.name}</span>
              </div>
            </div>

            {deletingReason.isSystem || deletingReason.usageCount > 0 ? (
              <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 20px" }}>
                This LOB Reason is currently referenced by <strong>{deletingReason.usageCount} lost Lead records</strong>. To preserve historical audit trails, deletion is restricted. You can <strong>Deactivate</strong> it instead.
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 20px" }}>
                Are you sure you want to permanently remove <strong>"{deletingReason.name}"</strong>? This action cannot be undone.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingReason(null)}
                style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, borderRadius: 9, background: "#181924", color: "#CBD5E1", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>

              {deletingReason.isSystem || deletingReason.usageCount > 0 ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#0066FF", color: "#07080B", border: "none", cursor: "pointer" }}
                >
                  Deactivate Reason Instead
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#EF4444", color: "#FFF", border: "none", cursor: "pointer" }}
                >
                  Delete Reason
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Mobile Responsiveness */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .lob-reasons-desktop-table {
            display: none !important;
          }
          .lob-reasons-mobile-cards {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
