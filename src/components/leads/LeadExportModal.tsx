"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Search, FileSpreadsheet, FileText, Check, Loader2, Lock } from "lucide-react";

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

const DEFAULT_SELECTED_KEYS = new Set([
  "name",
  "contactNumber",
  "email",
  "companyName",
  "stage",
  "source",
  "assignedUserName",
]);

interface LeadExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilters?: Record<string, any>;
}

export default function LeadExportModal({ isOpen, onClose, activeFilters = {} }: LeadExportModalProps) {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [searchQuery, setSearchQuery] = useState("");
  const [dynamicFields, setDynamicFields] = useState<FieldItem[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_SELECTED_KEYS));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Prevent background page scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Fetch active dynamic fields on modal open
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

  // Field Groups for rendering
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

  const toggleField = (field: FieldItem) => {
    if (field.isRequired) return; // Lead Name is mandatory
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field.id)) {
        next.delete(field.id);
      } else {
        next.add(field.id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set(selectedFields);
    filteredFields.forEach((f) => next.add(f.id));
    setSelectedFields(next);
  };

  const handleClearAll = () => {
    // Keep mandatory required fields selected
    const next = new Set<string>();
    allFields.forEach((f) => {
      if (f.isRequired) next.add(f.id);
    });
    setSelectedFields(next);
  };

  const handleExport = async () => {
    if (selectedFields.size === 0 || exporting) return;
    setExporting(true);
    setExportError(null);

    // Maintain requested column order matching allFields definition
    const orderedSelectedFields = allFields
      .filter((f) => selectedFields.has(f.id))
      .map((f) => f.id);

    try {
      const response = await fetch("/api/leads/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          fields: orderedSelectedFields,
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
      <div className="relative w-full max-w-2xl bg-[var(--surface,#FFFFFF)] border border-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] rounded-2xl shadow-2xl flex flex-col h-full max-h-[90vh] sm:max-h-[85vh] overflow-hidden transition-all duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[var(--border-color,#E2E8F0)] bg-[var(--surface-subtle,#F8FAFC)] shrink-0">
          <div>
            <h2 id="export-leads-title" className="text-xl font-bold tracking-tight text-[var(--text-primary,#0F172A)]">
              Export Leads
            </h2>
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

        {/* Modal Body - Independent Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Error Banner */}
          {exportError && (
            <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
              {exportError}
            </div>
          )}

          {/* 1. Format Selector Cards */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary,#64748B)] mb-2.5">
              Export Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Excel Card */}
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`relative flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all ${
                  format === "xlsx"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/40 font-bold shadow-xs"
                    : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] hover:border-emerald-400"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${format === "xlsx" ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>Excel (.xlsx)</span>
                    {format === "xlsx" && <Check className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="text-xs opacity-75 font-normal">Microsoft Excel Workbook</div>
                </div>
              </button>

              {/* CSV Card */}
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`relative flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all ${
                  format === "csv"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/40 font-bold shadow-xs"
                    : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] hover:border-emerald-400"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${format === "csv" ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>CSV (.csv)</span>
                    {format === "csv" && <Check className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="text-xs opacity-75 font-normal">Comma-Separated Values</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Controls Header: Search + Select All / Clear All */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary,#64748B)]">
                Fields Selection
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary,#94A3B8)]" />
              <input
                type="text"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9.5 pr-3.5 py-2.5 text-sm bg-[var(--background,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] rounded-xl text-[var(--text-primary,#0F172A)] placeholder-[var(--text-secondary,#94A3B8)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* 3. Categorized Field Card Sections */}
          <div className="space-y-5 pr-1">
            
            {/* Section 1: Basic Information */}
            {groupedFields.basic.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2.5">
                  BASIC INFORMATION
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupedFields.basic.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[44px] ${
                          isChecked
                            ? "border-emerald-500/50 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        } ${f.isRequired ? "cursor-not-allowed opacity-90" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={f.isRequired}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="text-sm font-medium">{f.label}</span>
                        </div>
                        {f.isRequired && (
                          <span className="px-2 py-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md tracking-wider uppercase">
                            REQUIRED
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Contact Information */}
            {groupedFields.contact.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2.5">
                  CONTACT INFORMATION
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupedFields.contact.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[44px] ${
                          isChecked
                            ? "border-emerald-500/50 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm font-medium">{f.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Pipeline & Assignment */}
            {groupedFields.pipeline.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2.5">
                  PIPELINE & ASSIGNMENT
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupedFields.pipeline.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[44px] ${
                          isChecked
                            ? "border-emerald-500/50 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm font-medium">{f.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 4: Follow-Up */}
            {groupedFields.followup.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2.5">
                  FOLLOW-UP
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupedFields.followup.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[44px] ${
                          isChecked
                            ? "border-emerald-500/50 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm font-medium">{f.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 5: Revenue & Financial */}
            {groupedFields.revenue.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2.5">
                  REVENUE & FINANCIAL
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupedFields.revenue.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[44px] ${
                          isChecked
                            ? "border-emerald-500/50 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm font-medium">{f.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 6: Dynamic Fields */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider">
                  DYNAMIC FIELDS (MASTER CONFIGURATION)
                </h3>
                {loadingFields && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
              </div>

              {groupedFields.dyn.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {groupedFields.dyn.map((f) => {
                    const isChecked = selectedFields.has(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleField(f)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all min-h-[44px] ${
                          isChecked
                            ? "border-emerald-500/50 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium shadow-2xs"
                            : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{f.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3.5 text-center text-xs text-[var(--text-secondary,#94A3B8)] bg-[var(--background,#F8FAFC)] border border-dashed border-[var(--border-color,#E2E8F0)] rounded-xl">
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

        {/* Modal Footer - Sticky Bottom Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color,#E2E8F0)] bg-[var(--surface-subtle,#F8FAFC)] shrink-0 flex-wrap gap-3">
          <div className="text-xs font-semibold text-[var(--text-secondary,#64748B)]">
            Selected: <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">{selectedFields.size}</strong> {selectedFields.size === 1 ? "field" : "fields"}
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
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
