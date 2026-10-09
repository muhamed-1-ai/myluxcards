"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Search, FileSpreadsheet, FileText, Check, Loader2 } from "lucide-react";

export interface FieldItem {
  id: string;
  label: string;
  group: "basic" | "contact" | "pipeline" | "followup" | "revenue" | "dynamic";
  isRequired?: boolean;
  isDynamic?: boolean;
}

const DEFAULT_STANDARD_FIELDS: FieldItem[] = [
  // Basic Information
  { id: "name", label: "Lead Name", group: "basic", isRequired: true },
  { id: "companyName", label: "Company Name", group: "basic" },
  { id: "address", label: "Address", group: "basic" },
  { id: "createdAt", label: "Created Date", group: "basic" },
  { id: "updatedAt", label: "Updated Date", group: "basic" },

  // Contact Information
  { id: "contactNumber", label: "Mobile / Phone", group: "contact" },
  { id: "email", label: "Email Address", group: "contact" },

  // Pipeline & Assignment
  { id: "stage", label: "Current Lead Stage", group: "pipeline" },
  { id: "source", label: "Lead Source", group: "pipeline" },
  { id: "assignedUserName", label: "Assigned User", group: "pipeline" },
  { id: "createdByName", label: "Created By (Owner)", group: "pipeline" },

  // Follow-up Information
  { id: "nextFollowUpAt", label: "Follow-up Date", group: "followup" },
  { id: "nextFollowUpType", label: "Follow-up Type", group: "followup" },
  { id: "nextFollowUpNote", label: "Follow-up Note", group: "followup" },
  { id: "lastRemark", label: "Last Remark", group: "followup" },

  // Revenue & Financial
  { id: "totalAmount", label: "Total Amount", group: "revenue" },
  { id: "advanceAmount", label: "Advance Amount", group: "revenue" },
  { id: "balanceAmount", label: "Balance Amount", group: "revenue" },
  { id: "paymentInformation", label: "Payment Information", group: "revenue" },
  { id: "products", label: "Products", group: "revenue" },
];

const DEFAULT_SELECTED_KEYS = [
  "name",
  "companyName",
  "contactNumber",
  "email",
  "stage",
  "source",
  "assignedUserName",
];

interface LeadExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat?: "xlsx" | "csv";
  activeFilters?: Record<string, any>;
  totalCount?: number;
}

export default function LeadExportModal({
  isOpen,
  onClose,
  initialFormat = "xlsx",
  activeFilters = {},
  totalCount,
}: LeadExportModalProps) {
  const [format, setFormat] = useState<"xlsx" | "csv">(initialFormat);
  const [searchQuery, setSearchQuery] = useState("");
  const [dynamicFields, setDynamicFields] = useState<FieldItem[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Field selection set & position ordering dictionary { fieldId: positionNumber }
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => new Set(DEFAULT_SELECTED_KEYS));
  const [fieldPositions, setFieldPositions] = useState<Record<string, number>>(() => {
    const initialPos: Record<string, number> = {};
    DEFAULT_SELECTED_KEYS.forEach((key, idx) => {
      initialPos[key] = idx + 1;
    });
    return initialPos;
  });

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Keep format synced with initialFormat when opened
  useEffect(() => {
    if (isOpen) {
      setFormat(initialFormat || "xlsx");
    }
  }, [isOpen, initialFormat]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Fetch active dynamic fields from Master Configuration
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoadingFields(true);
    setExportError(null);

    fetch("/api/dynamic-fields?status=ACTIVE")
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && (data.fields || data.data)) {
          const list = data.fields || data.data || [];
          const formatted: FieldItem[] = list.map((f: any) => ({
            id: `dynamic:${f.id}`,
            label: f.name || f.fieldName || "Custom Field",
            group: "dynamic",
            isDynamic: true,
          }));
          setDynamicFields(formatted);
        }
      })
      .catch((err) => {
        console.error("Failed to load dynamic fields for export modal", err);
      })
      .finally(() => {
        if (isMounted) setLoadingFields(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Combine standard + dynamic fields
  const allFields = useMemo(() => {
    return [...DEFAULT_STANDARD_FIELDS, ...dynamicFields];
  }, [dynamicFields]);

  // Search filter
  const filteredFields = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allFields;
    return allFields.filter(
      (f) => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
    );
  }, [allFields, searchQuery]);

  // Group fields for grid layout
  const groupedFields = useMemo(() => {
    const basic = filteredFields.filter((f) => f.group === "basic");
    const contact = filteredFields.filter((f) => f.group === "contact");
    const pipeline = filteredFields.filter((f) => f.group === "pipeline");
    const followup = filteredFields.filter((f) => f.group === "followup");
    const revenue = filteredFields.filter((f) => f.group === "revenue");
    const dyn = filteredFields.filter((f) => f.group === "dynamic");
    return { basic, contact, pipeline, followup, revenue, dyn };
  }, [filteredFields]);

  if (!isOpen) return null;

  // Helper to get selected fields ordered by position
  const getOrderedSelectedFields = (): string[] => {
    const selectedList = Array.from(selectedFields);
    selectedList.sort((a, b) => (fieldPositions[a] || 999) - (fieldPositions[b] || 999));
    return selectedList;
  };

  // Re-index field positions to maintain contiguous 1..N order
  const reindexPositions = (newSelectedSet: Set<string>, currentPositions: Record<string, number>): Record<string, number> => {
    const ordered = Array.from(newSelectedSet).sort(
      (a, b) => (currentPositions[a] || 999) - (currentPositions[b] || 999)
    );
    const updated: Record<string, number> = {};
    ordered.forEach((id, idx) => {
      updated[id] = idx + 1;
    });
    return updated;
  };

  // Toggle field selection
  const toggleField = (field: FieldItem) => {
    if (field.isRequired) return; // Lead Name is required
    setSelectedFields((prevSelected) => {
      const nextSelected = new Set(prevSelected);
      let nextPos = { ...fieldPositions };

      if (nextSelected.has(field.id)) {
        nextSelected.delete(field.id);
        delete nextPos[field.id];
      } else {
        nextSelected.add(field.id);
        nextPos[field.id] = nextSelected.size;
      }

      nextPos = reindexPositions(nextSelected, nextPos);
      setFieldPositions(nextPos);
      return nextSelected;
    });
  };

  // Update specific column position number
  const handlePositionChange = (fieldId: string, newPosInput: number) => {
    const ordered = getOrderedSelectedFields();
    const currIndex = ordered.indexOf(fieldId);
    if (currIndex === -1) return;

    const totalSelected = ordered.length;
    const targetPos = Math.max(1, Math.min(totalSelected, newPosInput));
    const targetIndex = targetPos - 1;
    if (currIndex === targetIndex) return;

    const reordered = [...ordered];
    const [moved] = reordered.splice(currIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updatedPos: Record<string, number> = {};
    reordered.forEach((id, idx) => {
      updatedPos[id] = idx + 1;
    });
    setFieldPositions(updatedPos);
  };

  // Select All / Select Matching
  const handleSelectAll = () => {
    const nextSelected = new Set(selectedFields);
    filteredFields.forEach((f) => nextSelected.add(f.id));
    const nextPos = reindexPositions(nextSelected, fieldPositions);
    setSelectedFields(nextSelected);
    setFieldPositions(nextPos);
  };

  // Clear All / Clear Matching
  const handleClearAll = () => {
    const nextSelected = new Set<string>();
    allFields.forEach((f) => {
      if (f.isRequired) {
        nextSelected.add(f.id);
      } else if (searchQuery.trim() !== "" && !filteredFields.some((match) => match.id === f.id)) {
        // Keep selected fields that are not part of the active search filter
        if (selectedFields.has(f.id)) nextSelected.add(f.id);
      }
    });
    const nextPos = reindexPositions(nextSelected, fieldPositions);
    setSelectedFields(nextSelected);
    setFieldPositions(nextPos);
  };

  // Trigger file download
  const handleExport = async () => {
    if (selectedFields.size === 0 || exporting) return;
    setExporting(true);
    setExportError(null);

    const orderedSelected = getOrderedSelectedFields();

    try {
      const response = await fetch("/api/leads/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          fields: orderedSelected,
          ...activeFilters,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || "Failed to export leads.");
      }

      const blob = await response.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `zappit_leads_${dateStr}.${format}`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      onClose();
    } catch (err: any) {
      console.error("[Export Error]", err);
      setExportError(err.message || "Unable to export leads. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const exportBtnLabel = format === "xlsx" ? "Export Excel" : "Export CSV";
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-leads-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !exporting) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-[var(--surface,#FFFFFF)] border border-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] rounded-2xl shadow-2xl flex flex-col h-full max-h-[92vh] sm:max-h-[88vh] overflow-hidden transition-all duration-200">
        
        {/* Header (Matching Screenshot 3) */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[var(--border-color,#E2E8F0)] bg-[var(--surface-subtle,#F8FAFC)] shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 id="export-leads-title" className="text-xl font-bold tracking-tight text-[var(--text-primary,#0F172A)]">
                Export Leads
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {format === "xlsx" ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{format === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"}</span>
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary,#64748B)] mt-0.5">
              Select the fields you want to include in the exported file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="p-2 rounded-xl text-[var(--text-secondary,#64748B)] hover:text-[var(--text-primary,#0F172A)] hover:bg-[var(--border-color,#E2E8F0)] transition-colors disabled:opacity-50"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search Left, Select All | Clear All Right */}
        <div className="px-6 py-3.5 border-b border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary,#94A3B8)]" />
            <input
              type="text"
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-3.5 py-2 text-sm bg-[var(--background,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] rounded-xl text-[var(--text-primary,#0F172A)] placeholder-[var(--text-secondary,#94A3B8)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors"
            >
              {isSearching ? "Select matching" : "Select All"}
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isSearching ? "Clear matching" : "Clear All"}
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Error Banner */}
          {exportError && (
            <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
              {exportError}
            </div>
          )}

          {/* Categorized Field Card Sections (3 Columns on Desktop) */}
          <div className="space-y-6">
            
            {/* 1. BASIC INFORMATION */}
            {groupedFields.basic.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-3">
                  BASIC INFORMATION
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedFields.basic.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    const pos = fieldPositions[f.id];
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[48px] ${
                          isChecked
                            ? "border-blue-500/50 bg-blue-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs ring-1 ring-blue-500/20"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        } ${f.isRequired ? "cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={f.isRequired}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer disabled:cursor-not-allowed shrink-0"
                          />
                          <span className="text-sm font-medium truncate">{f.label}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {f.isRequired && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded tracking-wider uppercase">
                              REQUIRED
                            </span>
                          )}
                          {isChecked && (
                            <input
                              type="number"
                              min={1}
                              max={selectedFields.size}
                              value={pos || ""}
                              onChange={(e) => handlePositionChange(f.id, parseInt(e.target.value, 10))}
                              aria-label={`Column position for ${f.label}`}
                              className="w-9 h-7 px-1 text-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. CONTACT INFORMATION */}
            {groupedFields.contact.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-3">
                  CONTACT INFORMATION
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedFields.contact.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    const pos = fieldPositions[f.id];
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[48px] ${
                          isChecked
                            ? "border-blue-500/50 bg-blue-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs ring-1 ring-blue-500/20"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                          />
                          <span className="text-sm font-medium truncate">{f.label}</span>
                        </div>

                        {isChecked && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min={1}
                              max={selectedFields.size}
                              value={pos || ""}
                              onChange={(e) => handlePositionChange(f.id, parseInt(e.target.value, 10))}
                              aria-label={`Column position for ${f.label}`}
                              className="w-9 h-7 px-1 text-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. PIPELINE & ASSIGNMENT */}
            {groupedFields.pipeline.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-3">
                  PIPELINE & ASSIGNMENT
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedFields.pipeline.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    const pos = fieldPositions[f.id];
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[48px] ${
                          isChecked
                            ? "border-blue-500/50 bg-blue-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs ring-1 ring-blue-500/20"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                          />
                          <span className="text-sm font-medium truncate">{f.label}</span>
                        </div>

                        {isChecked && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min={1}
                              max={selectedFields.size}
                              value={pos || ""}
                              onChange={(e) => handlePositionChange(f.id, parseInt(e.target.value, 10))}
                              aria-label={`Column position for ${f.label}`}
                              className="w-9 h-7 px-1 text-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. FOLLOW-UP */}
            {groupedFields.followup.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-3">
                  FOLLOW-UP
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedFields.followup.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    const pos = fieldPositions[f.id];
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[48px] ${
                          isChecked
                            ? "border-blue-500/50 bg-blue-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs ring-1 ring-blue-500/20"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                          />
                          <span className="text-sm font-medium truncate">{f.label}</span>
                        </div>

                        {isChecked && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min={1}
                              max={selectedFields.size}
                              value={pos || ""}
                              onChange={(e) => handlePositionChange(f.id, parseInt(e.target.value, 10))}
                              aria-label={`Column position for ${f.label}`}
                              className="w-9 h-7 px-1 text-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. REVENUE & FINANCIAL */}
            {groupedFields.revenue.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-3">
                  REVENUE & FINANCIAL
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedFields.revenue.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    const pos = fieldPositions[f.id];
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[48px] ${
                          isChecked
                            ? "border-blue-500/50 bg-blue-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs ring-1 ring-blue-500/20"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                          />
                          <span className="text-sm font-medium truncate">{f.label}</span>
                        </div>

                        {isChecked && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min={1}
                              max={selectedFields.size}
                              value={pos || ""}
                              onChange={(e) => handlePositionChange(f.id, parseInt(e.target.value, 10))}
                              aria-label={`Column position for ${f.label}`}
                              className="w-9 h-7 px-1 text-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. DYNAMIC FIELDS (MASTER CONFIGURATION) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider">
                  DYNAMIC FIELDS (MASTER CONFIGURATION)
                </h3>
                {loadingFields && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
              </div>

              {groupedFields.dyn.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupedFields.dyn.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    const pos = fieldPositions[f.id];
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[48px] ${
                          isChecked
                            ? "border-blue-500/50 bg-blue-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs ring-1 ring-blue-500/20"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                          />
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 truncate">{f.label}</span>
                        </div>

                        {isChecked && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min={1}
                              max={selectedFields.size}
                              value={pos || ""}
                              onChange={(e) => handlePositionChange(f.id, parseInt(e.target.value, 10))}
                              aria-label={`Column position for ${f.label}`}
                              className="w-9 h-7 px-1 text-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[var(--text-secondary,#94A3B8)] bg-[var(--background,#F8FAFC)] border border-dashed border-[var(--border-color,#E2E8F0)] rounded-xl">
                  {loadingFields
                    ? "Loading dynamic fields..."
                    : searchQuery
                    ? "No matching dynamic fields found."
                    : "No active dynamic fields configured in Master Configuration."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer (Matching Screenshot 3) */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color,#E2E8F0)] bg-[var(--surface-subtle,#F8FAFC)] shrink-0 flex-wrap gap-3">
          <div className="text-xs font-semibold text-[var(--text-secondary,#64748B)]">
            Selected: <strong className="text-blue-600 dark:text-blue-400 text-sm font-bold">{selectedFields.size}</strong> {selectedFields.size === 1 ? "field" : "fields"}
            {totalCount != null && totalCount > 0 && (
              <span className="ml-1 text-slate-400 font-normal">({totalCount} {totalCount === 1 ? "lead" : "leads"})</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={selectedFields.size === 0 || exporting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <span>{exportBtnLabel}</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
