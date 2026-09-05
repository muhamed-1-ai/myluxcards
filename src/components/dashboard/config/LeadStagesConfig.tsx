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
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Calendar as CalendarIcon,
  ShieldCheck,
  Tag,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export interface SubstageItem {
  id: string;
  name: string;
}

export interface StageConfigItem {
  id: string;
  key: string;
  name: string;
  shortForm: string;
  description?: string;
  color: string;
  stageOrder: number;
  showInCalendar: boolean;
  approvalRequired: boolean;
  isLob: boolean;
  isClosed: boolean;
  active: boolean;
  substages: SubstageItem[];
  attachedRules: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
  isSystem?: boolean;
}

const INITIAL_LEAD_STAGES: StageConfigItem[] = [
  {
    id: "stg-1",
    key: "NEW",
    name: "New Lead",
    shortForm: "NEW",
    description: "Newly captured lead via NFC tap, QR scan, or inbound web form",
    color: "#0066FF",
    stageOrder: 1,
    showInCalendar: true,
    approvalRequired: false,
    isLob: false,
    isClosed: false,
    active: true,
    substages: [
      { id: "sub-1", name: "Unassigned" },
      { id: "sub-2", name: "Pending Review" },
    ],
    attachedRules: ["Auto-assign Lead Owner"],
    createdBy: "System",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-08-30T14:22:00.000Z",
    leadCount: 15,
    isSystem: true,
  },
  {
    id: "stg-2",
    key: "CONTACTED",
    name: "Contacted",
    shortForm: "CNT",
    description: "Initial communication initiated via call, WhatsApp, or email",
    color: "#3B82F6",
    stageOrder: 2,
    showInCalendar: true,
    approvalRequired: false,
    isLob: false,
    isClosed: false,
    active: true,
    substages: [
      { id: "sub-3", name: "Call Attempted" },
      { id: "sub-4", name: "WhatsApp Sent" },
    ],
    attachedRules: ["Require Contact Note"],
    createdBy: "System",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-08-29T18:10:00.000Z",
    leadCount: 24,
    isSystem: true,
  },
  {
    id: "stg-3",
    key: "INTERESTED",
    name: "Interested",
    shortForm: "INT",
    description: "High-intent lead expressing active interest in cards or solutions",
    color: "#EC4899",
    stageOrder: 3,
    showInCalendar: true,
    approvalRequired: false,
    isLob: false,
    isClosed: false,
    active: true,
    substages: [
      { id: "sub-5", name: "Sample Requested" },
      { id: "sub-6", name: "Pricing Shared" },
    ],
    attachedRules: ["Notify Account Owner"],
    createdBy: "System",
    createdAt: "2026-07-05T11:30:00.000Z",
    updatedAt: "2026-08-28T16:05:00.000Z",
    leadCount: 18,
    isSystem: true,
  },
  {
    id: "stg-4",
    key: "FOLLOW_UP",
    name: "Follow-up",
    shortForm: "FU",
    description: "Active task or call scheduled for further discussion",
    color: "#F59E0B",
    stageOrder: 4,
    showInCalendar: true,
    approvalRequired: false,
    isLob: false,
    isClosed: false,
    active: true,
    substages: [
      { id: "sub-7", name: "Meeting Fixed" },
      { id: "sub-8", name: "Proposal Under Review" },
    ],
    attachedRules: ["Auto-schedule Calendar Reminder"],
    createdBy: "System",
    createdAt: "2026-07-12T14:15:00.000Z",
    updatedAt: "2026-08-25T11:40:00.000Z",
    leadCount: 12,
    isSystem: true,
  },
  {
    id: "stg-5",
    key: "DEMO_SCHEDULED",
    name: "Demo Scheduled",
    shortForm: "DMO",
    description: "Product demonstration or meeting booked with sales engineer",
    color: "#8B5CF6",
    stageOrder: 5,
    showInCalendar: true,
    approvalRequired: false,
    isLob: false,
    isClosed: false,
    active: true,
    substages: [{ id: "sub-9", name: "Demo Confirmed" }],
    attachedRules: ["Calendar Invite Sent"],
    createdBy: "System",
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-08-24T12:00:00.000Z",
    leadCount: 8,
    isSystem: false,
  },
  {
    id: "stg-6",
    key: "PAYMENT_PENDING",
    name: "Payment Pending",
    shortForm: "PAY",
    description: "Order invoice or payment link generated awaiting customer payment",
    color: "#06B6D4",
    stageOrder: 6,
    showInCalendar: false,
    approvalRequired: false,
    isLob: false,
    isClosed: false,
    active: true,
    substages: [{ id: "sub-10", name: "Invoice Sent" }],
    attachedRules: ["Payment Link Active"],
    createdBy: "System",
    createdAt: "2026-07-18T14:00:00.000Z",
    updatedAt: "2026-08-23T16:00:00.000Z",
    leadCount: 6,
    isSystem: false,
  },
  {
    id: "stg-7",
    key: "WON",
    name: "Converted",
    shortForm: "WON",
    description: "Successfully converted deal / closed lead",
    color: "#10B981",
    stageOrder: 7,
    showInCalendar: false,
    approvalRequired: true,
    isLob: false,
    isClosed: true,
    active: true,
    substages: [{ id: "sub-11", name: "Order Created" }],
    attachedRules: ["Trigger Welcome Email"],
    createdBy: "System",
    createdAt: "2026-07-20T16:45:00.000Z",
    updatedAt: "2026-08-24T09:15:00.000Z",
    leadCount: 35,
    isSystem: true,
  },
  {
    id: "stg-8",
    key: "LOST",
    name: "Lost",
    shortForm: "LST",
    description: "Unresponsive or deal lost due to LOB reason",
    color: "#EF4444",
    stageOrder: 8,
    showInCalendar: false,
    approvalRequired: false,
    isLob: true,
    isClosed: true,
    active: true,
    substages: [{ id: "sub-12", name: "Reason Logged" }],
    attachedRules: ["Require LOB Reason"],
    createdBy: "System",
    createdAt: "2026-08-01T08:20:00.000Z",
    updatedAt: "2026-08-20T13:30:00.000Z",
    leadCount: 8,
    isSystem: true,
  },
];

const LOCAL_STORAGE_KEY = "myluxcards_lead_stages_catalog_v1";

const AVAILABLE_STAGE_RULES = [
  "Auto-assign Lead Owner",
  "Require Contact Note",
  "Notify Account Owner",
  "Auto-schedule Calendar Reminder",
  "Trigger Welcome Email",
  "Require LOB Reason",
];

export function LeadStagesConfig() {
  const [stages, setStages] = useState<StageConfigItem[]>(INITIAL_LEAD_STAGES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal & Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<StageConfigItem | null>(null);
  const [deletingStage, setDeletingStage] = useState<StageConfigItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Substage Input State
  const [newSubstageText, setNewSubstageText] = useState("");

  // Form Fields State
  const [formData, setFormData] = useState({
    name: "",
    shortForm: "",
    description: "",
    color: "#0066FF",
    stageOrder: 1,
    showInCalendar: true,
    approvalRequired: false,
    isLob: false,
    isClosed: false,
    active: true,
    substages: [] as SubstageItem[],
    attachedRules: [] as string[],
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStages(parsed);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when stages change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stages));
    } catch {
      // Ignore storage errors
    }
  }, [stages, isLoaded]);

  // Debounce search query (250ms–350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // KPI Calculations
  const totalCount = stages.length;
  const activeCount = useMemo(() => stages.filter((s) => s.active).length, [stages]);
  const inactiveCount = useMemo(() => stages.filter((s) => !s.active).length, [stages]);

  // Pipeline Order list (sorted by stageOrder ASC)
  const orderedActiveStages = useMemo(() => {
    return [...stages]
      .filter((s) => s.active)
      .sort((a, b) => a.stageOrder - b.stageOrder);
  }, [stages]);

  // Filtered dataset sorted by stageOrder
  const filteredStages = useMemo(() => {
    return [...stages]
      .filter((stg) => {
        // Status Filter
        if (statusFilter === "ACTIVE" && !stg.active) return false;
        if (statusFilter === "INACTIVE" && stg.active) return false;

        // Search Query
        if (debouncedSearch.trim()) {
          const q = debouncedSearch.toLowerCase().trim();
          const matchName = stg.name.toLowerCase().includes(q);
          const matchShort = stg.shortForm.toLowerCase().includes(q);
          const matchKey = stg.key.toLowerCase().includes(q);
          const matchDesc = stg.description ? stg.description.toLowerCase().includes(q) : false;
          return matchName || matchShort || matchKey || matchDesc;
        }

        return true;
      })
      .sort((a, b) => a.stageOrder - b.stageOrder);
  }, [stages, statusFilter, debouncedSearch]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredStages.length / pageSize) || 1;
  const paginatedStages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStages.slice(start, start + pageSize);
  }, [filteredStages, currentPage, pageSize]);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingStage(null);
    const nextOrder = Math.max(...stages.map((s) => s.stageOrder), 0) + 1;
    setFormData({
      name: "",
      shortForm: "",
      description: "",
      color: "#0066FF",
      stageOrder: nextOrder,
      showInCalendar: true,
      approvalRequired: false,
      isLob: false,
      isClosed: false,
      active: true,
      substages: [],
      attachedRules: [],
    });
    setNewSubstageText("");
    setFormError("");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (stg: StageConfigItem) => {
    setEditingStage(stg);
    setFormData({
      name: stg.name,
      shortForm: stg.shortForm || "",
      description: stg.description || "",
      color: stg.color || "#0066FF",
      stageOrder: stg.stageOrder || 1,
      showInCalendar: stg.showInCalendar ?? true,
      approvalRequired: stg.approvalRequired ?? false,
      isLob: stg.isLob ?? false,
      isClosed: stg.isClosed ?? false,
      active: stg.active ?? true,
      substages: stg.substages || [],
      attachedRules: stg.attachedRules || [],
    });
    setNewSubstageText("");
    setFormError("");
    setIsFormOpen(true);
  };

  const handleToggleActive = (id: string) => {
    const now = new Date().toISOString();
    setStages((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, active: !item.active, updatedAt: now } : item
      )
    );
  };

  const handleAddSubstage = () => {
    const trimmed = newSubstageText.trim();
    if (!trimmed) return;

    if (formData.substages.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setFormError(`Substage "${trimmed}" already exists in this stage.`);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      substages: [...prev.substages, { id: `sub-${Date.now()}`, name: trimmed }],
    }));
    setNewSubstageText("");
    setFormError("");
  };

  const handleRemoveSubstage = (subId: string) => {
    setFormData((prev) => ({
      ...prev,
      substages: prev.substages.filter((s) => s.id !== subId),
    }));
  };

  const handleToggleRule = (ruleName: string) => {
    setFormData((prev) => {
      const exists = prev.attachedRules.includes(ruleName);
      return {
        ...prev,
        attachedRules: exists
          ? prev.attachedRules.filter((r) => r !== ruleName)
          : [...prev.attachedRules, ruleName],
      };
    });
  };

  const handleSaveStage = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError("Lead Stage Name is required.");
      return;
    }

    const trimmedShort = String(formData.shortForm || "").trim().toUpperCase().replaceAll(/[^A-Z0-9]/g, "").slice(0, 10);
    if (!trimmedShort) {
      setFormError("Stage Short Form is required (up to 10 alphanumeric characters).");
      return;
    }

    // Semantic validation: Cannot be both LOB (Loss) and Closed (Won) simultaneously
    if (formData.isLob && formData.isClosed) {
      setFormError("A stage cannot be marked as both 'Is LOB' (Loss) and 'Closed Status' (Won) simultaneously.");
      return;
    }

    setIsSaving(true);

    setTimeout(() => {
      const now = new Date().toISOString();

      if (editingStage) {
        // Edit existing stage
        setStages((prev) =>
          prev.map((s) => {
            if (s.id !== editingStage.id) return s;
            return {
              ...s,
              name: trimmedName,
              shortForm: trimmedShort,
              description: formData.description.trim() || undefined,
              color: formData.color,
              stageOrder: Number(formData.stageOrder) || s.stageOrder,
              showInCalendar: formData.showInCalendar,
              approvalRequired: formData.approvalRequired,
              isLob: formData.isLob,
              isClosed: formData.isClosed,
              active: formData.active,
              substages: formData.substages,
              attachedRules: formData.attachedRules,
              updatedAt: now,
            };
          })
        );
      } else {
        // Create new stage
        const keyGenerated = trimmedName.replaceAll(/[^a-zA-Z0-9]/g, "_").toUpperCase().slice(0, 15);
        const newStage: StageConfigItem = {
          id: `stg-${Date.now()}`,
          key: keyGenerated,
          name: trimmedName,
          shortForm: trimmedShort,
          description: formData.description.trim() || undefined,
          color: formData.color,
          stageOrder: Number(formData.stageOrder) || 1,
          showInCalendar: formData.showInCalendar,
          approvalRequired: formData.approvalRequired,
          isLob: formData.isLob,
          isClosed: formData.isClosed,
          active: formData.active,
          substages: formData.substages,
          attachedRules: formData.attachedRules,
          createdBy: "Muhammed Febin",
          createdAt: now,
          updatedAt: now,
          leadCount: 0,
          isSystem: false,
        };

        setStages((prev) => [...prev, newStage]);
      }

      setIsSaving(false);
      setIsFormOpen(false);
    }, 200);
  };

  const handleConfirmDelete = () => {
    if (!deletingStage) return;
    if (deletingStage.isSystem || deletingStage.leadCount > 0) {
      // Safe fallback: Deactivate instead
      handleToggleActive(deletingStage.id);
      setDeletingStage(null);
      return;
    }

    setStages((prev) => prev.filter((item) => item.id !== deletingStage.id));
    setDeletingStage(null);
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
            <span>LEAD STAGES</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#FFF", margin: "4px 0 2px", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
            Lead Stages
          </h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
            Configure pipeline stages that drive sales progression and reporting flow.
          </p>
        </div>

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
          Create Lead Stage
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
        {/* KPI 1: TOTAL STAGES */}
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
              TOTAL STAGES
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
            <Layers style={{ width: 22, height: 22 }} />
          </div>
        </div>

        {/* KPI 2: ACTIVE STAGES */}
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
              ACTIVE STAGES
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

        {/* KPI 3: INACTIVE STAGES */}
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
              INACTIVE STAGES
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

      {/* 3. PIPELINE ORDER STRIP */}
      <div
        style={{
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          borderRadius: 16,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          PIPELINE ORDER:
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 }}>
          {orderedActiveStages.map((stg, idx) => (
            <React.Fragment key={stg.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#181924",
                  border: `1px solid ${stg.color}40`,
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#FFF",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stg.color }} />
                <span>{stg.stageOrder}. {stg.name}</span>
                <span style={{ fontSize: 10, color: "#94A3B8", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>
                  {stg.shortForm}
                </span>
              </div>
              {idx < orderedActiveStages.length - 1 && (
                <ArrowRight style={{ width: 14, height: 14, color: "#64748B" }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 4. MAIN MANAGEMENT CONTAINER */}
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
              placeholder="Search lead stages..."
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
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filterKey) => {
              const label = filterKey === "ALL" ? "All" : filterKey === "ACTIVE" ? "Active" : "Inactive";
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

        {/* LEAD STAGES DATA TABLE */}
        {filteredStages.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="lead-stages-desktop-table" style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 980 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", height: 48, background: "#181924" }}>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      LEAD STAGE NAME
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      SHORT FORM
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CREATED BY
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      IS CLOSED
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      APPROVAL REQUIRED
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      IS LOB
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      STATUS
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CREATED DATE
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      MODIFIED DATE
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStages.map((stg) => (
                    <tr
                      key={stg.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        height: 68,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Name, Color, Order */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: stg.color, flexShrink: 0 }} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                                {stg.name}
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", background: "#181924", padding: "1px 6px", borderRadius: 4 }}>
                                #{stg.stageOrder}
                              </span>
                              {stg.isSystem && (
                                <span style={{ fontSize: 9, fontWeight: 800, color: "#0066FF", background: "rgba(0, 229, 255,0.12)", border: "1px solid rgba(0, 229, 255,0.25)", padding: "1px 5px", borderRadius: 4 }}>
                                  SYSTEM
                                </span>
                              )}
                            </div>
                            {stg.description && (
                              <div style={{ fontSize: 11, color: "#8E8EA0", marginTop: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {stg.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Short Form */}
                      <td style={{ padding: "14px 18px" }}>
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
                          {stg.shortForm}
                        </span>
                      </td>

                      {/* Created By */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#CBD5E1" }}>
                          <User style={{ width: 14, height: 14, color: "#94A3B8" }} />
                          <span>{stg.createdBy}</span>
                        </div>
                      </td>

                      {/* Is Closed */}
                      <td style={{ padding: "14px 18px" }}>
                        {stg.isClosed ? (
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#10B981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", padding: "2px 8px", borderRadius: 6 }}>
                            CLOSED
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>
                            OPEN
                          </span>
                        )}
                      </td>

                      {/* Approval Required */}
                      <td style={{ padding: "14px 18px" }}>
                        {stg.approvalRequired ? (
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", padding: "2px 8px", borderRadius: 6 }}>
                            REQUIRED
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#64748B" }}>
                            NOT REQUIRED
                          </span>
                        )}
                      </td>

                      {/* Is LOB */}
                      <td style={{ padding: "14px 18px" }}>
                        {stg.isLob ? (
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#EF4444", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", padding: "2px 8px", borderRadius: 6 }}>
                            LOB
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#64748B" }}>
                            NORMAL
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {stg.active ? (
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
                      <td style={{ padding: "14px 18px", fontSize: 12, color: "#94A3B8" }}>
                        {formatDate(stg.createdAt)}
                      </td>

                      {/* Modified Date */}
                      <td style={{ padding: "14px 18px", fontSize: 12, color: "#94A3B8" }}>
                        {formatDateTime(stg.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(stg)}
                            title="Edit Lead Stage"
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
                            onClick={() => handleToggleActive(stg.id)}
                            title={stg.active ? "Deactivate Lead Stage" : "Activate Lead Stage"}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: stg.active ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                              border: stg.active ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)",
                              borderRadius: 8,
                              color: stg.active ? "#F87171" : "#34D399",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Power style={{ width: 13, height: 13 }} />
                            {stg.active ? "Deactivate" : "Activate"}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeletingStage(stg)}
                            title="Delete Lead Stage"
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

            {/* Mobile Responsive Cards (<768px) */}
            <div className="lead-stages-mobile-cards" style={{ display: "none", flexDirection: "column", gap: 14 }}>
              {paginatedStages.map((stg) => (
                <div
                  key={`mobile-${stg.id}`}
                  style={{
                    background: "#181924",
                    border: `1px solid ${stg.color}40`,
                    borderRadius: 14,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: stg.color }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{stg.name}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", background: "rgba(0, 229, 255,0.1)", padding: "2px 6px", borderRadius: 4 }}>
                        {stg.shortForm}
                      </span>
                    </div>

                    {stg.active ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#10B981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 20 }}>
                        ACTIVE
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "2px 8px", borderRadius: 20 }}>
                        INACTIVE
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: "#94A3B8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>Order: <span style={{ color: "#E2E8F0", fontWeight: 700 }}>#{stg.stageOrder}</span></div>
                    <div>Leads: <span style={{ color: "#0066FF", fontWeight: 800 }}>{stg.leadCount}</span></div>
                    <div>Outcome: <span style={{ color: stg.isClosed ? "#10B981" : "#E2E8F0" }}>{stg.isClosed ? (stg.isLob ? "Loss (LOB)" : "Won") : "Open"}</span></div>
                    <div>Calendar: <span style={{ color: "#E2E8F0" }}>{stg.showInCalendar ? "Yes" : "No"}</span></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(stg)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#FFF", cursor: "pointer" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(stg.id)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: stg.active ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: "none", borderRadius: 8, color: stg.active ? "#F87171" : "#34D399", cursor: "pointer" }}
                    >
                      {stg.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingStage(stg)}
                      style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#EF4444", cursor: "pointer" }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255, 255, 255, 0.06)", fontSize: 12, color: "#94A3B8" }}>
              <div>
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredStages.length)} of {filteredStages.length}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 14px",
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
                  Prev
                </button>

                <span style={{ fontSize: 12, fontWeight: 700, color: "#0066FF", padding: "0 4px" }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 14px",
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
          </>
        ) : (
          /* EMPTY STATE */
          <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.2)", color: "#0066FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Filter style={{ width: 24, height: 24 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
              No Lead Stages Match Your Search
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, maxWidth: 380 }}>
              We couldn't find any lead stages matching your current filter criteria. Try clearing your search query or status filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
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

      {/* CREATE / EDIT LEAD STAGE MODAL (Matching Reference Layout) */}
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
              maxWidth: 780,
              maxHeight: "88vh",
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
                flexShrink: 0,
              }}
            >
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  PIPELINE CONFIGURATION
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>
                  {editingStage ? "Edit Lead Stage" : "Add Lead Stage"}
                </h2>
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

            {/* Scrollable Modal Content */}
            <form
              id="leadStageForm"
              onSubmit={handleSaveStage}
              style={{
                padding: "26px 28px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 22,
                flex: 1,
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

              {/* FIELD 1: LEAD STAGE NAME */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  LEAD STAGE NAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Proposal Sent"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

              {/* FIELD 2: STAGE SHORT FORM */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 4 }}>
                  STAGE SHORT FORM *
                </label>
                <input
                  type="text"
                  placeholder="e.g., QLF"
                  maxLength={10}
                  value={formData.shortForm}
                  onChange={(e) => setFormData({ ...formData, shortForm: e.target.value.toUpperCase() })}
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
                    fontFamily: "monospace",
                    letterSpacing: "0.05em",
                  }}
                  required
                />
                <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, display: "block" }}>
                  Up to 10 characters, letters and numbers only. Used in Calendar chips and compact Lead views.
                </span>
              </div>

              {/* SHOW IN CALENDAR TOGGLE */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#181924",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "14px 18px",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>Show In Calendar</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    Display this stage short form on Follow-Up and Lead Calendar views.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, showInCalendar: !formData.showInCalendar })}
                  style={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    background: formData.showInCalendar ? "#0066FF" : "rgba(255,255,255,0.15)",
                    border: "none",
                    position: "relative",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: formData.showInCalendar ? 25 : 3,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: formData.showInCalendar ? "#07080B" : "#FFF",
                      transition: "all 0.2s ease",
                    }}
                  />
                </button>
              </div>

              {/* STAGE COLOR & STAGE ORDER GRID */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                {/* Stage Color Picker */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    STAGE COLOR PICKER
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      style={{
                        width: 46,
                        height: 46,
                        border: "none",
                        borderRadius: 10,
                        background: "none",
                        cursor: "pointer",
                      }}
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      style={{
                        flex: 1,
                        height: 46,
                        padding: "0 14px",
                        background: "#181924",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 10,
                        color: "#FFFFFF",
                        fontSize: 13,
                        outline: "none",
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                </div>

                {/* Stage Order */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    STAGE ORDER
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.stageOrder}
                    onChange={(e) => setFormData({ ...formData, stageOrder: Number(e.target.value) })}
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

              {/* 3 BOOLEAN CONFIGURATION CARDS */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                {/* 1. Approval Required */}
                <div
                  style={{
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#FFF" }}>APPROVAL REQUIRED</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                      Require review before Lead enters this stage.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, approvalRequired: !formData.approvalRequired })}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: formData.approvalRequired ? "#0066FF" : "rgba(255,255,255,0.15)",
                      border: "none",
                      position: "relative",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: formData.approvalRequired ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: formData.approvalRequired ? "#07080B" : "#FFF",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </button>
                </div>

                {/* 2. Is LOB */}
                <div
                  style={{
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#FFF" }}>IS LOB</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                      Mark as loss-of-business (Lost).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLob = !formData.isLob;
                      setFormData({
                        ...formData,
                        isLob: nextLob,
                        // Mutually exclusive: if isLob set to true, clear isClosed won
                        isClosed: nextLob ? false : formData.isClosed,
                      });
                    }}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: formData.isLob ? "#EF4444" : "rgba(255,255,255,0.15)",
                      border: "none",
                      position: "relative",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: formData.isLob ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#FFF",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </button>
                </div>

                {/* 3. Closed Status */}
                <div
                  style={{
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#FFF" }}>CLOSED STATUS</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                      Mark as successful outcome (Won).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextClosed = !formData.isClosed;
                      setFormData({
                        ...formData,
                        isClosed: nextClosed,
                        // Mutually exclusive: if isClosed set to true, clear isLob loss
                        isLob: nextClosed ? false : formData.isLob,
                      });
                    }}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: formData.isClosed ? "#10B981" : "rgba(255,255,255,0.15)",
                      border: "none",
                      position: "relative",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: formData.isClosed ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#FFF",
                        transition: "all 0.2s ease",
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* SUBSTAGES SECTION */}
              <div
                style={{
                  background: "#161722",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#FFF" }}>Substages</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    Add optional substages under this Lead Stage. These substages appear in Lead workflows.
                  </div>
                </div>

                {/* Substage Add Input */}
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    placeholder="Enter substage name..."
                    value={newSubstageText}
                    onChange={(e) => setNewSubstageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubstage();
                      }
                    }}
                    style={{
                      flex: 1,
                      height: 42,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      color: "#FFFFFF",
                      fontSize: 12,
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSubstage}
                    style={{
                      padding: "0 18px",
                      height: 42,
                      fontSize: 12,
                      fontWeight: 800,
                      background: "#0066FF",
                      color: "#07080B",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Plus style={{ width: 14, height: 14 }} />
                    Add
                  </button>
                </div>

                {/* Substage Chips List */}
                {formData.substages.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {formData.substages.map((sub) => (
                      <span
                        key={sub.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#181924",
                          border: "1px solid rgba(0, 229, 255, 0.3)",
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          color: "#FFF",
                          fontWeight: 600,
                        }}
                      >
                        {sub.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveSubstage(sub.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#94A3B8",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* STAGE RULES SECTION */}
              <div
                style={{
                  background: "#161722",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    STAGE RULES
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF", marginTop: 2 }}>
                    CONNECT EXISTING RULES TO THIS STAGE
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    Select automation and validation rules to attach to this lead stage.
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {AVAILABLE_STAGE_RULES.map((ruleName) => {
                    const isSelected = formData.attachedRules.includes(ruleName);
                    return (
                      <button
                        key={ruleName}
                        type="button"
                        onClick={() => handleToggleRule(ruleName)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          border: isSelected ? "1px solid rgba(0, 229, 255, 0.6)" : "1px solid rgba(255, 255, 255, 0.1)",
                          background: isSelected ? "rgba(0, 229, 255, 0.15)" : "#181924",
                          color: isSelected ? "#0066FF" : "#94A3B8",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isSelected ? <CheckCircle2 style={{ width: 13, height: 13 }} /> : <Sparkles style={{ width: 13, height: 13 }} />}
                        {ruleName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STATUS SECTION */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>STATUS</span>
                <div style={{ display: "flex", gap: 6, background: "#181924", padding: 3, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: true })}
                    style={{
                      padding: "6px 16px",
                      fontSize: 12,
                      fontWeight: formData.active ? 700 : 500,
                      borderRadius: 8,
                      border: "none",
                      background: formData.active ? "#0066FF" : "transparent",
                      color: formData.active ? "#07080B" : "#94A3B8",
                      cursor: "pointer",
                    }}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: false })}
                    style={{
                      padding: "6px 16px",
                      fontSize: 12,
                      fontWeight: !formData.active ? 700 : 500,
                      borderRadius: 8,
                      border: "none",
                      background: !formData.active ? "#12131A" : "transparent",
                      color: !formData.active ? "#FFF" : "#94A3B8",
                      cursor: "pointer",
                    }}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </form>

            {/* Sticky Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                padding: "16px 28px",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#161722",
                flexShrink: 0,
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
                form="leadStageForm"
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
                {isSaving ? "Saving..." : editingStage ? "Save Changes" : "Create Lead Stage"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingStage && (
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
          onClick={() => setDeletingStage(null)}
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
                  {deletingStage.isSystem || deletingStage.leadCount > 0 ? "Protected Lead Stage" : "Delete Lead Stage?"}
                </h3>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{deletingStage.name}</span>
              </div>
            </div>

            {deletingStage.isSystem || deletingStage.leadCount > 0 ? (
              <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 20px" }}>
                This Lead Stage is a <strong>core pipeline stage</strong> or has <strong>{deletingStage.leadCount} active leads</strong> referencing it. To protect historical pipeline data, deletion is restricted. You can <strong>Deactivate</strong> it instead.
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 20px" }}>
                Are you sure you want to permanently remove <strong>"{deletingStage.name}"</strong>? This action cannot be undone.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingStage(null)}
                style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, borderRadius: 9, background: "#181924", color: "#CBD5E1", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>

              {deletingStage.isSystem || deletingStage.leadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#0066FF", color: "#07080B", border: "none", cursor: "pointer" }}
                >
                  Deactivate Stage Instead
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#EF4444", color: "#FFF", border: "none", cursor: "pointer" }}
                >
                  Delete Lead Stage
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Mobile Responsiveness */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .lead-stages-desktop-table {
            display: none !important;
          }
          .lead-stages-mobile-cards {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
