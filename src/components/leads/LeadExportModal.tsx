"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Search, FileSpreadsheet, FileText, Check, Loader2 } from "lucide-react";

export interface FieldItem {
  id: string;
  label: string;
  group: "standard" | "followup" | "financial" | "dynamic";
  isDynamic?: boolean;
}

const DEFAULT_STANDARD_FIELDS: FieldItem[] = [
  { id: "name", label: "Lead Name", group: "standard" },
  { id: "contactNumber", label: "Mobile / Phone", group: "standard" },
  { id: "email", label: "Email Address", group: "standard" },
  { id: "companyName", label: "Company Name", group: "standard" },
  { id: "address", label: "Address", group: "standard" },
  { id: "stage", label: "Stage / Status", group: "standard" },
  { id: "source", label: "Lead Source", group: "standard" },
  { id: "assignedUserName", label: "Assigned To", group: "standard" },
  { id: "createdByName", label: "Created By (Owner)", group: "standard" },
  { id: "createdAt", label: "Created Date", group: "standard" },
  { id: "updatedAt", label: "Updated Date", group: "standard" },

  // Follow-up
  { id: "nextFollowUpAt", label: "Follow-up Date", group: "followup" },
  { id: "nextFollowUpType", label: "Follow-up Type", group: "followup" },
  { id: "nextFollowUpNote", label: "Follow-up Note", group: "followup" },
  { id: "lastRemark", label: "Last Remark", group: "followup" },

  // Financial
  { id: "totalAmount", label: "Total Amount", group: "financial" },
  { id: "advanceAmount", label: "Advance Amount", group: "financial" },
  { id: "balanceAmount", label: "Balance Amount", group: "financial" },
  { id: "paymentInformation", label: "Payment Information", group: "financial" },
  { id: "products", label: "Products", group: "financial" },
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
    const std = filteredFields.filter((f) => f.group === "standard");
    const followup = filteredFields.filter((f) => f.group === "followup");
    const fin = filteredFields.filter((f) => f.group === "financial");
    const dyn = filteredFields.filter((f) => f.group === "dynamic");
    return { std, followup, fin, dyn };
  }, [filteredFields]);

  if (!isOpen) return null;

  const toggleField = (id: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
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
    setSelectedFields(new Set());
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

  return (
    <div
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-leads-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !exporting) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-[var(--surface,#FFFFFF)] border border-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color,#E2E8F0)] bg-[var(--surface-subtle,#F8FAFC)]">
          <div>
            <h2 id="export-leads-title" className="text-xl font-bold tracking-tight text-[var(--text-primary,#0F172A)]">
              Export Leads
            </h2>
            <p className="text-xs text-[var(--text-secondary,#64748B)] mt-0.5">
              Choose format and fields to export.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="p-2 rounded-lg text-[var(--text-secondary,#64748B)] hover:text-[var(--text-primary,#0F172A)] hover:bg-[var(--border-color,#E2E8F0)] transition-colors disabled:opacity-50"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Error Banner */}
          {exportError && (
            <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl">
              {exportError}
            </div>
          )}

          {/* 1. Format Selector Cards */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary,#64748B)] mb-2.5">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  format === "xlsx"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500 font-bold"
                    : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] hover:border-emerald-300"
                }`}
              >
                <div className={`p-2 rounded-lg ${format === "xlsx" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Excel (.xlsx)</div>
                  <div className="text-xs opacity-75">Microsoft Excel Spreadsheet</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  format === "csv"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500 font-bold"
                    : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] hover:border-emerald-300"
                }`}
              >
                <div className={`p-2 rounded-lg ${format === "csv" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">CSV (.csv)</div>
                  <div className="text-xs opacity-75">Comma-Separated Values</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Field Controls & Search */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary,#64748B)]">
                Fields Selection
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary,#94A3B8)]" />
              <input
                type="text"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--background,#F8FAFC)] border border-[var(--border-color,#E2E8F0)] rounded-xl text-[var(--text-primary,#0F172A)] placeholder-[var(--text-secondary,#94A3B8)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* 3. Field Groups Container */}
          <div className="space-y-5 max-h-[300px] overflow-y-auto pr-1">
            
            {/* Standard Fields */}
            {groupedFields.std.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2">
                  Standard Lead Fields
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupedFields.std.map((f) => (
                    <label
                      key={f.id}
                      onClick={() => toggleField(f.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-all min-h-[40px] ${
                        selectedFields.has(f.id)
                          ? "border-emerald-500/40 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium"
                          : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.has(f.id)}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-sm">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-Up Fields */}
            {groupedFields.followup.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2">
                  Follow-up Fields
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupedFields.followup.map((f) => (
                    <label
                      key={f.id}
                      onClick={() => toggleField(f.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-all min-h-[40px] ${
                        selectedFields.has(f.id)
                          ? "border-emerald-500/40 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium"
                          : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.has(f.id)}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-sm">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Fields */}
            {groupedFields.fin.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider mb-2">
                  Financial Fields
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupedFields.fin.map((f) => (
                    <label
                      key={f.id}
                      onClick={() => toggleField(f.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-all min-h-[40px] ${
                        selectedFields.has(f.id)
                          ? "border-emerald-500/40 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium"
                          : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.has(f.id)}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-sm">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] uppercase tracking-wider">
                  Dynamic Fields (Master Configuration)
                </h3>
                {loadingFields && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
              </div>

              {groupedFields.dyn.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupedFields.dyn.map((f) => (
                    <label
                      key={f.id}
                      onClick={() => toggleField(f.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer select-none transition-all min-h-[40px] ${
                        selectedFields.has(f.id)
                          ? "border-emerald-500/40 bg-emerald-500/5 text-[var(--text-primary,#0F172A)] font-medium"
                          : "border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-secondary,#64748B)] hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.has(f.id)}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{f.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-[var(--text-secondary,#94A3B8)] bg-[var(--background,#F8FAFC)] border border-dashed border-[var(--border-color,#E2E8F0)] rounded-xl">
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

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border-color,#E2E8F0)] bg-[var(--surface-subtle,#F8FAFC)] flex-wrap gap-3">
          <div className="text-xs font-semibold text-[var(--text-secondary,#64748B)]">
            Selected: <strong className="text-emerald-600 text-sm font-bold">{selectedFields.size}</strong> {selectedFields.size === 1 ? "field" : "fields"}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50"
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
                <span>Export Leads</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
