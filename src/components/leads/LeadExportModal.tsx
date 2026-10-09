"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Search, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import "./export-modal.css";

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

/**
 * Cleanly resolves field labels, preventing raw UUID strings from being displayed
 */
function resolveFieldLabel(field: any): string {
  const raw = (field.name || field.fieldName || field.label || field.title || field.displayName || "").trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!raw || uuidRegex.test(raw)) {
    if (field.key && !uuidRegex.test(field.key)) return String(field.key);
    if (field.fieldKey && !uuidRegex.test(field.fieldKey)) return String(field.fieldKey);
    if (field.label && !uuidRegex.test(field.label)) return String(field.label);
    if (field.name && !uuidRegex.test(field.name)) return String(field.name);
    if (raw && uuidRegex.test(raw)) {
      return `Custom Field (${raw.substring(0, 8)})`;
    }
    return "Custom Field";
  }
  return raw;
}

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
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
            label: resolveFieldLabel(f),
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

  if (!isOpen || !mounted) return null;

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
    if (field.isRequired) return; // Lead Name is mandatory
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
        // Keep selected fields that are not part of active search filter
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

  const renderCardGroup = (title: string, fields: FieldItem[], isDynamicGroup = false) => {
    if (fields.length === 0 && !isDynamicGroup) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-semibold leading-[16px] text-[var(--export-text-secondary)] uppercase tracking-wider">
            {title}
          </h3>
          {isDynamicGroup && loadingFields && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}
        </div>

        {fields.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fields.map((f) => {
              const isChecked = selectedFields.has(f.id);
              const pos = fieldPositions[f.id];
              return (
                <div
                  key={f.id}
                  onClick={() => toggleField(f)}
                  className={`zappit-field-card ${isChecked ? "selected" : ""} ${f.isRequired ? "cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1 pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={f.isRequired}
                      onChange={() => {}}
                      className="w-[18px] h-[18px] rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed shrink-0 mt-0.5"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={`text-[14px] leading-[20px] font-medium break-words ${f.isDynamic ? "text-blue-600 dark:text-blue-400 font-semibold" : ""}`}>
                        {f.label}
                      </span>
                      {f.isRequired && (
                        <span className="inline-block mt-1.5 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded tracking-wider uppercase w-max">
                          REQUIRED
                        </span>
                      )}
                    </div>
                  </div>

                  {isChecked && (
                    <div className="shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min={1}
                        max={selectedFields.size}
                        value={pos || ""}
                        onChange={(e) => handlePositionChange(f.id, parseInt(e.target.value, 10))}
                        aria-label={`Column position for ${f.label}`}
                        className="zappit-position-input"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : isDynamicGroup ? (
          <div className="p-4 text-center text-xs text-[var(--export-text-secondary)] bg-[var(--export-card-bg)] border border-dashed border-[var(--export-card-border)] rounded-xl">
            {loadingFields
              ? "Loading dynamic fields..."
              : searchQuery
              ? "No matching dynamic fields found."
              : "No active dynamic fields configured in Master Configuration."}
          </div>
        ) : null}
      </div>
    );
  };

  const exportBtnLabel = format === "xlsx" ? "Export Excel" : "Export CSV";
  const isSearching = searchQuery.trim().length > 0;

  const modalContent = (
    <div
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-leads-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !exporting) onClose();
      }}
      className="zappit-export-overlay"
    >
      <div className="zappit-export-shell">
        
        {/* Header (24px horizontal padding, themed background) */}
        <div className="zappit-export-header flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 id="export-leads-title" className="text-[20px] font-semibold leading-[28px] tracking-tight">
                Export Leads
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                {format === "xlsx" ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{format === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"}</span>
              </span>
            </div>
            <p className="text-[14px] leading-[20px] text-[var(--export-text-secondary)] mt-1.5">
              Select the fields you want to include in the exported file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="p-2 rounded-xl text-[var(--export-text-secondary)] hover:text-[var(--export-text-primary)] hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar (24px horizontal padding, 16px vertical) */}
        <div className="zappit-export-toolbar flex items-center justify-between gap-4 flex-wrap">
          <div className="zappit-search-wrapper">
            <Search className="zappit-search-icon" />
            <input
              type="text"
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="zappit-search-input"
            />
          </div>

          <div className="flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors whitespace-nowrap"
            >
              {isSearching ? "Select matching" : "Select All"}
            </button>
            <span className="text-slate-300 dark:text-slate-700 select-none">|</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              {isSearching ? "Clear matching" : "Clear All"}
            </button>
          </div>
        </div>

        {/* Scrollable Body (24px padding, 32px group spacing) */}
        <div className="zappit-export-body space-y-8">
          {exportError && (
            <div className="p-3.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
              {exportError}
            </div>
          )}

          {renderCardGroup("BASIC INFORMATION", groupedFields.basic)}
          {renderCardGroup("CONTACT INFORMATION", groupedFields.contact)}
          {renderCardGroup("PIPELINE & ASSIGNMENT", groupedFields.pipeline)}
          {renderCardGroup("FOLLOW-UP", groupedFields.followup)}
          {renderCardGroup("REVENUE & FINANCIAL", groupedFields.revenue)}
          {renderCardGroup("DYNAMIC FIELDS (MASTER CONFIGURATION)", groupedFields.dyn, true)}
        </div>

        {/* Footer (24px horizontal padding, 16px vertical, 44px buttons) */}
        <div className="zappit-export-footer flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-semibold text-[var(--export-text-secondary)]">
            Selected: <strong className="text-blue-600 dark:text-blue-400 text-sm font-bold">{selectedFields.size}</strong> {selectedFields.size === 1 ? "field" : "fields"}
            {totalCount != null && totalCount > 0 && (
              <span className="ml-1.5 text-slate-500 dark:text-slate-400 font-normal">({totalCount} {totalCount === 1 ? "lead" : "leads"})</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="h-[44px] min-h-[44px] px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={selectedFields.size === 0 || exporting}
              className="h-[44px] min-h-[44px] px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

  return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null;
}
