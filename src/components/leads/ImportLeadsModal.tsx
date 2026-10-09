"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  FileUp,
  Info,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import "./import-modal.css";

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRefresh?: () => void;
}

type ImportStep = "SELECT_TEMPLATE_AND_UPLOAD" | "VALIDATING" | "PREVIEW" | "IMPORTING" | "SUCCESS";

export default function ImportLeadsModal({
  isOpen,
  onClose,
  onSuccessRefresh,
}: ImportLeadsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ImportStep>("SELECT_TEMPLATE_AND_UPLOAD");

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation State
  const [validating, setValidating] = useState(false);
  const [validationData, setValidationData] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Commit State
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Active Tab in Preview Mode: "ALL" | "ERRORS" | "WARNINGS"
  const [previewTab, setPreviewTab] = useState<"ALL" | "ERRORS" | "WARNINGS">("ALL");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep("SELECT_TEMPLATE_AND_UPLOAD");
      setSelectedFile(null);
      setValidationData(null);
      setValidationError(null);
      setCommitResult(null);
      setCommitError(null);
      setImportProgress(0);
    }
  }, [isOpen]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Trigger Template Download (.xlsx or .csv)
  const handleDownloadTemplate = (format: "xlsx" | "csv") => {
    const url = `/api/leads/import/template?format=${format}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `zappit_leads_import_template.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Process File Selection & Trigger Validation
  const handleFileSelected = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
      setValidationError("Unsupported file type. Please upload a .csv or .xlsx file.");
      return;
    }

    setSelectedFile(file);
    setValidationError(null);
    setValidating(true);
    setStep("VALIDATING");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/leads/import/validate", {
        method: "POST",
        body: formData,
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || resJson.message || "Failed to validate file.");
      }

      setValidationData(resJson);
      setStep("PREVIEW");
    } catch (err: any) {
      console.error("[Validation Failed]", err);
      setValidationError(err.message || "Failed to validate spreadsheet.");
      setStep("SELECT_TEMPLATE_AND_UPLOAD");
    } finally {
      setValidating(false);
    }
  };

  // Trigger Commit Import of Valid Rows
  const handleCommitImport = async () => {
    if (!validationData || !validationData.validRows || validationData.validRows.length === 0 || importing) return;

    setImporting(true);
    setCommitError(null);
    setStep("IMPORTING");
    setImportProgress(10);

    const progressTimer = setInterval(() => {
      setImportProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 200);

    try {
      const response = await fetch("/api/leads/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validRows: validationData.validRows,
        }),
      });

      clearInterval(progressTimer);
      setImportProgress(100);

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || resJson.message || "Failed to commit lead import.");
      }

      setCommitResult(resJson);
      setStep("SUCCESS");

      if (onSuccessRefresh) {
        onSuccessRefresh();
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error("[Commit Error]", err);
      setCommitError(err.message || "Unable to import leads. Please try again.");
      setStep("PREVIEW");
    } finally {
      setImporting(false);
    }
  };

  // Trigger Error Report Download
  const handleDownloadErrorReport = async () => {
    if (!validationData || !validationData.errors || validationData.errors.length === 0) return;

    try {
      const response = await fetch("/api/leads/import/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errors: validationData.errors,
          fileName: validationData.fileName || "leads_import",
        }),
      });

      if (!response.ok) throw new Error("Failed to generate error report.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `error_report_${validationData.fileName || "import"}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("[Error Report Export Failed]", err);
    }
  };

  const modalContent = (
    <div
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-leads-title"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !importing && !validating) onClose();
      }}
      className="zappit-import-overlay"
    >
      <div className="zappit-import-shell">
        
        {/* Header */}
        <div className="zappit-import-header flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 id="import-leads-title" className="text-[20px] font-bold leading-[28px] tracking-tight">
                Import Leads
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <FileUp className="w-3.5 h-3.5" />
                <span>Bulk Import Engine</span>
              </span>
            </div>
            <p className="text-[14px] leading-[20px] text-[var(--import-text-secondary)] mt-1">
              Import multiple leads at once using official Zappit templates (.xlsx or .csv).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing || validating}
            className="p-2 rounded-xl text-[var(--import-text-secondary)] hover:text-[var(--import-text-primary)] hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 shrink-0"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content by Step */}
        <div className="zappit-import-body space-y-6">

          {/* STEP 1 & 2: Template Download & File Upload */}
          {step === "SELECT_TEMPLATE_AND_UPLOAD" && (
            <div className="space-y-6">
              
              {/* Info Notice Banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <strong className="font-bold text-sm block">ALL LEAD FIELDS ARE OPTIONAL DURING BULK IMPORT</strong>
                  <p>
                    You can import a lead with any subset of available information (e.g. <strong>Lead Name only</strong>, <strong>Mobile Number only</strong>, <strong>Email only</strong>, <strong>Company Name only</strong>, or <strong>Dynamic Fields</strong>). Completely empty rows are automatically skipped.
                  </p>
                </div>
              </div>

              {/* Step 1: Download Templates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--import-text-secondary)]">
                    STEP 1: DOWNLOAD OFFICIAL TEMPLATE
                  </h3>
                  <span className="text-[11px] text-slate-500">Includes active Master Config Dynamic Fields</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate("xlsx")}
                    className="p-3.5 rounded-xl border border-[var(--import-card-border)] bg-[var(--import-card-bg)] hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all flex items-center justify-between group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--import-text-primary)] group-hover:text-emerald-600">
                          Excel Template (.xlsx)
                        </div>
                        <div className="text-xs text-[var(--import-text-secondary)]">Includes Instructions sheet</div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate("csv")}
                    className="p-3.5 rounded-xl border border-[var(--import-card-border)] bg-[var(--import-card-bg)] hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-all flex items-center justify-between group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--import-text-primary)] group-hover:text-blue-600">
                          CSV Template (.csv)
                        </div>
                        <div className="text-xs text-[var(--import-text-secondary)]">UTF-8 BOM formatted</div>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--import-text-secondary)]">
                  STEP 2: UPLOAD COMPLETED FILE
                </h3>

                {validationError && (
                  <div className="p-3 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{validationError}</span>
                  </div>
                )}

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`zappit-dropzone ${dragActive ? "border-blue-500 bg-blue-50/20" : ""}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-[var(--import-text-primary)] mb-1">
                    Click to upload or drag & drop spreadsheet
                  </div>
                  <div className="text-xs text-[var(--import-text-secondary)] max-w-sm">
                    Supports <strong>.xlsx</strong> and <strong>.csv</strong> files up to 10MB (max 5,000 leads per import).
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STEP: VALIDATING LOADER */}
          {step === "VALIDATING" && (
            <div className="py-16 text-center space-y-4 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center animate-spin">
                <Loader2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-base font-bold text-[var(--import-text-primary)]">
                  Validating Spreadsheet...
                </div>
                <div className="text-xs text-[var(--import-text-secondary)] mt-1">
                  Checking schema, data formats, assigned users, and Master Config dynamic fields.
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION SUMMARY */}
          {step === "PREVIEW" && validationData && (
            <div className="space-y-6">
              
              {/* Commit Error Banner */}
              {commitError && (
                <div className="p-3.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{commitError}</span>
                </div>
              )}

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
                  <div className="text-[11px] font-bold uppercase tracking-wider">VALID ROWS</div>
                  <div className="text-2xl font-extrabold mt-1">{validationData.validCount}</div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                  <div className="text-[11px] font-bold uppercase tracking-wider">WARNINGS</div>
                  <div className="text-2xl font-extrabold mt-1">{validationData.warningCount}</div>
                </div>

                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400">
                  <div className="text-[11px] font-bold uppercase tracking-wider">ERRORS</div>
                  <div className="text-2xl font-extrabold mt-1">{validationData.errorCount}</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">
                  <div className="text-[11px] font-bold uppercase tracking-wider">SKIPPED EMPTY</div>
                  <div className="text-2xl font-extrabold mt-1">{validationData.emptyCount}</div>
                </div>
              </div>

              {/* Sub-tabs for Data Preview vs Row Errors */}
              <div className="flex items-center justify-between border-b border-[var(--import-card-border)] pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("ALL")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      previewTab === "ALL"
                        ? "bg-blue-600 text-white"
                        : "text-[var(--import-text-secondary)] hover:bg-slate-200/50 dark:hover:bg-slate-800"
                    }`}
                  >
                    Data Preview ({validationData.previewRows.length})
                  </button>

                  {validationData.errors.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewTab("ERRORS")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                        previewTab === "ERRORS"
                          ? "bg-rose-600 text-white"
                          : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Row Errors ({validationData.errors.length})</span>
                    </button>
                  )}

                  {validationData.warnings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewTab("WARNINGS")}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                        previewTab === "WARNINGS"
                          ? "bg-amber-600 text-white"
                          : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Warnings ({validationData.warnings.length})</span>
                    </button>
                  )}
                </div>

                {validationData.errors.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrorReport}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Error Report (.csv)</span>
                  </button>
                )}
              </div>

              {/* Tab 1: Data Preview Table */}
              {previewTab === "ALL" && (
                <div className="zappit-preview-table-container max-h-[300px] overflow-y-auto">
                  <table className="zappit-preview-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>ROW</th>
                        <th>STATUS</th>
                        <th>LEAD NAME</th>
                        <th>MOBILE</th>
                        <th>EMAIL</th>
                        <th>STAGE</th>
                        <th>ASSIGNED TO</th>
                        <th>FOLLOW-UP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationData.previewRows.map((r: any) => (
                        <tr key={r.rowNumber} className={!r.isValid ? "bg-rose-500/5" : ""}>
                          <td className="font-bold text-slate-400">{r.rowNumber}</td>
                          <td>
                            {r.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 rounded-md">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>VALID</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 rounded-md">
                                <AlertCircle className="w-3 h-3" />
                                <span>REJECTED</span>
                              </span>
                            )}
                          </td>
                          <td className="font-medium">{r.leadName}</td>
                          <td className="font-mono text-xs">{r.contactNumber}</td>
                          <td className="text-xs text-slate-500">{r.email}</td>
                          <td className="font-semibold text-xs text-blue-600 dark:text-blue-400">{r.stage}</td>
                          <td className="text-xs">{r.assignedTo}</td>
                          <td className="text-xs text-slate-500">{r.nextFollowUpAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Row Errors List */}
              {previewTab === "ERRORS" && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto p-1">
                  {validationData.errors.map((e: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200"
                    >
                      <span className="font-bold px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-100 shrink-0">
                        Row {e.row}
                      </span>
                      <div className="flex-1 min-w-0">
                        <strong className="font-bold text-rose-700 dark:text-rose-300 mr-2">{e.field}:</strong>
                        <span>{e.message}</span>
                        {e.value != null && (
                          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 font-mono truncate">
                            Value: "{String(e.value)}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Warnings List */}
              {previewTab === "WARNINGS" && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto p-1">
                  {validationData.warnings.map((w: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200"
                    >
                      <span className="font-bold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-100 shrink-0">
                        Row {w.row}
                      </span>
                      <div className="flex-1 min-w-0">
                        <strong className="font-bold text-amber-700 dark:text-amber-300 mr-2">{w.field}:</strong>
                        <span>{w.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* STEP 4: IMPORTING PROGRESS BAR */}
          {step === "IMPORTING" && (
            <div className="py-16 text-center space-y-6 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center animate-spin">
                <Loader2 className="w-6 h-6" />
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs font-bold text-[var(--import-text-primary)]">
                  <span>Importing leads into All Leads...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-[var(--import-text-secondary)]">
                Creating lead records, dynamic field values, and scheduled follow-ups. Please wait...
              </p>
            </div>
          )}

          {/* STEP 5: SUCCESS REPORT */}
          {step === "SUCCESS" && commitResult && (
            <div className="py-8 text-center space-y-6 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-lg ring-8 ring-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-[var(--import-text-primary)]">
                  Import Completed Successfully!
                </h3>
                <p className="text-sm text-[var(--import-text-secondary)] mt-1 max-w-md mx-auto">
                  {commitResult.message || `Successfully imported ${commitResult.importedCount} leads.`}
                </p>
              </div>

              {/* Metrics Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">LEADS CREATED</div>
                  <div className="text-2xl font-extrabold text-[var(--import-text-primary)] mt-1">
                    {commitResult.importedCount || 0}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">DYNAMIC VALUES</div>
                  <div className="text-2xl font-extrabold text-[var(--import-text-primary)] mt-1">
                    {commitResult.dynamicValuesCount || 0}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/30">
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">FOLLOW-UPS</div>
                  <div className="text-2xl font-extrabold text-[var(--import-text-primary)] mt-1">
                    {commitResult.followUpsCount || 0}
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions by Step */}
        <div className="zappit-import-footer flex items-center justify-between gap-3 flex-wrap">
          
          {step === "SELECT_TEMPLATE_AND_UPLOAD" && (
            <>
              <div className="text-xs text-[var(--import-text-secondary)]">
                Need help? Contact support or read import documentation.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-[44px] min-h-[44px] px-5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {step === "PREVIEW" && validationData && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("SELECT_TEMPLATE_AND_UPLOAD")}
                  disabled={importing}
                  className="h-[44px] min-h-[44px] px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={importing}
                  className="h-[44px] min-h-[44px] px-5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={validationData.validCount === 0 || importing}
                  className="h-[44px] min-h-[44px] px-6 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span>Import {validationData.validCount} Valid Leads</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === "SUCCESS" && (
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={onClose}
                className="h-[44px] min-h-[44px] px-8 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-500/20 transition-all"
              >
                View All Leads
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null;
}
