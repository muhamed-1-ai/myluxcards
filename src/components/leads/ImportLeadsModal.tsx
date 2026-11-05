"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  UploadCloud,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RotateCcw,
  X,
  Trash2,
  ArrowRight,
  Clock,
  Check,
} from "lucide-react";
import "./import-modal.css";

export interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRefresh?: () => void;
  inline?: boolean;
}

export interface RecentImportRecord {
  id: string;
  fileName: string;
  fileSize: number;
  importedCount: number;
  failedCount: number;
  skippedCount: number;
  timestamp: string;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
}

type ImportStep = "UPLOAD" | "PREVIEW" | "IMPORTING" | "SUCCESS";

const RECENT_IMPORTS_STORAGE_KEY = "zappit_lead_imports_history";

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function ImportLeadsModal({
  isOpen,
  onClose,
  onSuccessRefresh,
  inline = true,
}: ImportLeadsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<ImportStep>("UPLOAD");

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

  // Template Download State
  const [downloadingTemplate, setDownloadingTemplate] = useState<"xlsx" | "csv" | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Active Tab in Preview Mode: "ALL" | "ERRORS" | "WARNINGS"
  const [previewTab, setPreviewTab] = useState<"ALL" | "ERRORS" | "WARNINGS">("ALL");

  // Recent Imports History
  const [recentImports, setRecentImports] = useState<RecentImportRecord[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(RECENT_IMPORTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentImports(parsed);
        }
      }
    } catch (e) {
      console.warn("[Recent Imports] Could not read local history", e);
    }
  }, []);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setStep("UPLOAD");
      setSelectedFile(null);
      setValidationData(null);
      setValidationError(null);
      setCommitResult(null);
      setCommitError(null);
      setImportProgress(0);
      setPreviewTab("ALL");
      setIsHistoryDrawerOpen(false);
      setDownloadingTemplate(null);
      setTemplateError(null);
    }
  }, [isOpen]);

  // Lock body scroll only when modal dialog mode (inline === false) is active
  useEffect(() => {
    if (!isOpen || inline) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, inline]);

  if (!isOpen || !mounted) return null;

  // Trigger Template Download (.xlsx or .csv)
  const handleDownloadTemplate = async (format: "xlsx" | "csv") => {
    if (downloadingTemplate) return;
    setDownloadingTemplate(format);
    setTemplateError(null);
    let blobUrl: string | null = null;

    try {
      const response = await fetch(`/api/leads/import/template?format=${format}`, {
        method: "GET",
        headers: {
          Accept:
            format === "xlsx"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream"
              : "text/csv, text/plain, */*",
        },
      });

      if (!response.ok) {
        let errorMsg = `Download failed (${response.status} ${response.statusText})`;
        try {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await response.json();
            errorMsg = data.message || data.error || errorMsg;
          } else {
            const text = await response.text();
            if (text && text.length < 200) {
              errorMsg = text;
            }
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get("content-type") || "";
      if (format === "xlsx" && !contentType.includes("spreadsheetml") && !contentType.includes("octet-stream")) {
        throw new Error("Received unexpected response format instead of Excel spreadsheet.");
      }
      if (format === "csv" && !contentType.includes("csv") && !contentType.includes("plain") && !contentType.includes("octet-stream")) {
        throw new Error("Received unexpected response format instead of CSV file.");
      }

      const blob = await response.blob();
      blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `zappit_leads_import_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error("[Template Download Error]", err);
      setTemplateError(err.message || "Failed to download template. Please try again.");
    } finally {
      setDownloadingTemplate(null);
      if (blobUrl) {
        setTimeout(() => {
          if (blobUrl) window.URL.revokeObjectURL(blobUrl);
        }, 1500);
      }
    }
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
      setSelectedFile(null);
      setValidationData(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setValidationError("File exceeds maximum allowed size of 10 MB.");
      setSelectedFile(null);
      setValidationData(null);
      return;
    }

    setSelectedFile(file);
    setValidationError(null);
    setValidating(true);
    setCommitError(null);

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
    } catch (err: any) {
      console.error("[Validation Failed]", err);
      setValidationError(err.message || "Failed to validate spreadsheet.");
      setValidationData(null);
    } finally {
      setValidating(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setValidationData(null);
    setValidationError(null);
    setCommitError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Advance to Preview Step
  const handleStartImportProcess = () => {
    if (!validationData || validationData.validCount === 0) return;
    setStep("PREVIEW");
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

      // Record to Recent Imports history
      const newRecord: RecentImportRecord = {
        id: `imp_${Date.now()}`,
        fileName: selectedFile?.name || "leads_import",
        fileSize: selectedFile?.size || 0,
        importedCount: resJson.importedCount || validationData.validCount || 0,
        failedCount: validationData?.errorCount || 0,
        skippedCount: validationData?.emptyCount || 0,
        timestamp: new Date().toISOString(),
        status: validationData?.errorCount > 0 ? "PARTIAL" : "COMPLETED",
      };

      const updatedHistory = [newRecord, ...recentImports].slice(0, 25);
      setRecentImports(updatedHistory);
      try {
        localStorage.setItem(RECENT_IMPORTS_STORAGE_KEY, JSON.stringify(updatedHistory));
      } catch (err) {
        console.warn("[Recent Imports] Storage write failed", err);
      }

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
          fileName: validationData.fileName || selectedFile?.name || "leads_import",
        }),
      });

      if (!response.ok) throw new Error("Failed to generate error report.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `error_report_${validationData.fileName || "leads"}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("[Error Report Export Failed]", err);
    }
  };

  const handleClearHistory = () => {
    setRecentImports([]);
    try {
      localStorage.removeItem(RECENT_IMPORTS_STORAGE_KEY);
    } catch { }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !importing && !validating) {
      if (step === "PREVIEW") {
        setStep("UPLOAD");
      } else {
        onClose();
      }
    }
  };

  /* ------------------------------------------------------------- */
  /* Main Workspace Content (Rendered both inline or inside modal) */
  /* ------------------------------------------------------------- */
  const workspaceContent = (
    <div
      className="zappit-import-workspace dash-entrance-panel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Bulk Lead Import Workspace"
    >
      {/* 1. TOP HEADER */}
      <div className="zappit-import-header">
        <button
          type="button"
          onClick={() => {
            if (step === "PREVIEW") {
              setStep("UPLOAD");
            } else {
              onClose();
            }
          }}
          disabled={importing || validating}
          className="zappit-import-back-btn"
          aria-label={step === "PREVIEW" ? "Back to file upload" : "Back to All Leads"}
          title={step === "PREVIEW" ? "Back to file upload" : "Back to All Leads"}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="zappit-import-title-group">
          <h1 className="zappit-import-title">
            {step === "PREVIEW" ? "Review & Validate Leads" : "Bulk Lead Import"}
          </h1>
          <p className="zappit-import-subtitle">
            {step === "PREVIEW"
              ? selectedFile
                ? `${selectedFile.name} (${formatBytes(selectedFile.size)}) — Ready for import confirmation`
                : "Review parsed leads and row validations before committing."
              : "Upload CSV or Excel files to import multiple leads at once."}
          </p>
        </div>
      </div>

      {/* 2. BODY CONTENT BY STEP */}

      {/* STEP: UPLOAD (The balanced 2-column layout matching reference) */}
      {step === "UPLOAD" && (
        <div className="zappit-import-grid">

          {/* LEFT CARD: UPLOAD DATA */}
          <div className="zappit-import-card">
            <div className="zappit-import-card-inner">

              {/* Card Label */}
              <div className="zappit-import-card-label">
                <UploadCloud />
                <span>UPLOAD DATA</span>
              </div>

              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => {
                  if (!selectedFile) {
                    fileInputRef.current?.click();
                  }
                }}
                className={`zappit-dropzone ${dragActive ? "drag-active" : ""}`}
                role="button"
                tabIndex={0}
                aria-label="File upload dropzone"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  tabIndex={-1}
                />

                {!selectedFile ? (
                  <>
                    <UploadCloud className="zappit-drop-icon" strokeWidth={1.5} />
                    <div className="zappit-drop-prompt">
                      <span className="zappit-drop-prompt-accent">Click to select</span> or drag and drop here
                    </div>
                    <div className="zappit-drop-hint">
                      Accepts CSV or Excel (.xlsx) files (max 10 MB)
                    </div>
                  </>
                ) : (
                  <div className="zappit-selected-file-box">
                    <div className="zappit-selected-file-icon">
                      {selectedFile.name.endsWith(".xlsx") ? (
                        <FileSpreadsheet className="w-6 h-6" />
                      ) : (
                        <FileText className="w-6 h-6" />
                      )}
                    </div>
                    <div className="zappit-selected-file-name" title={selectedFile.name}>
                      {selectedFile.name}
                    </div>
                    <div className="zappit-selected-file-meta">
                      {formatBytes(selectedFile.size)}
                    </div>

                    {validating && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Validating spreadsheet rows...</span>
                      </div>
                    )}

                    {validationData && !validating && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{validationData.validCount} valid leads ready</span>
                      </div>
                    )}

                    {validationError && !validating && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 max-w-sm">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{validationError}</span>
                      </div>
                    )}

                    <div className="zappit-selected-file-actions">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearFile();
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Template Buttons Side-by-Side */}
              <div className="zappit-template-grid">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("csv")}
                  disabled={downloadingTemplate !== null}
                  className="zappit-template-tile tile-csv"
                  aria-label="Download CSV Template"
                >
                  {downloadingTemplate === "csv" ? (
                    <Loader2 className="zappit-template-icon-csv animate-spin" />
                  ) : (
                    <Download className="zappit-template-icon-csv" />
                  )}
                  <div>
                    <div className="zappit-template-sub-csv">
                      {downloadingTemplate === "csv" ? "Downloading..." : "Download"}
                    </div>
                    <div className="zappit-template-main-csv">CSV Template</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("xlsx")}
                  disabled={downloadingTemplate !== null}
                  className="zappit-template-tile tile-excel"
                  aria-label="Download Excel Template"
                >
                  {downloadingTemplate === "xlsx" ? (
                    <Loader2 className="zappit-template-icon-excel animate-spin" />
                  ) : (
                    <Download className="zappit-template-icon-excel" />
                  )}
                  <div>
                    <div className="zappit-template-sub-excel">
                      {downloadingTemplate === "xlsx" ? "Downloading..." : "Download"}
                    </div>
                    <div className="zappit-template-main-excel">Excel Template</div>
                  </div>
                </button>
              </div>

              {/* Template Download Error Message */}
              {templateError && (
                <div className="zappit-template-error" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-xs font-medium">{templateError}</span>
                  <button
                    type="button"
                    onClick={() => setTemplateError(null)}
                    className="zappit-template-error-dismiss"
                    aria-label="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Compact Information Block */}
              <div className="zappit-import-info-block">
                All lead fields are optional during bulk import. You can import with any subset of fields (e.g. Lead Name, Mobile, Email, or Dynamic Fields). Completely empty rows are automatically skipped.
              </div>

              {/* Action Footer (Lower right) */}
              <div className="zappit-import-card-footer">
                <button
                  type="button"
                  onClick={handleStartImportProcess}
                  disabled={!selectedFile || validating || !validationData || validationData.validCount === 0}
                  className="zappit-import-primary-btn"
                >
                  <UploadCloud className="w-4 h-4 mr-1.5" />
                  <span>
                    {validating
                      ? "Validating File..."
                      : validationData && validationData.validCount > 0
                        ? `Start Import (${validationData.validCount} Leads)`
                        : "Start Import Process"}
                  </span>
                </button>
              </div>

            </div>
          </div>

          {/* RIGHT CARD: RECENT IMPORTS */}
          <div className="zappit-import-card">

            {/* Header */}
            <div className="zappit-recent-card-header">
              <Database />
              <span>RECENT IMPORTS</span>
            </div>

            {/* Content Area */}
            <div className="zappit-recent-card-body">
              {recentImports.length === 0 ? (
                <>
                  <Database className="zappit-recent-empty-icon" strokeWidth={1.25} />
                  <div className="zappit-recent-empty-text">No past imports found.</div>
                </>
              ) : (
                <div className="zappit-recent-imports-list">
                  {recentImports.slice(0, 4).map((record) => (
                    <div key={record.id} className="zappit-recent-import-item">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          {record.fileName.endsWith(".xlsx") ? (
                            <FileSpreadsheet className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[var(--import-title)] truncate">
                            {record.fileName}
                          </div>
                          <div className="text-xs text-[var(--import-subtitle)] flex items-center gap-2 mt-0.5">
                            <span>{formatTimestamp(record.timestamp)}</span>
                            <span>•</span>
                            <span>{record.importedCount} leads</span>
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        {record.status === "COMPLETED" ? "Success" : record.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="zappit-recent-card-footer">
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(true)}
                className="zappit-history-action-btn"
              >
                VIEW FULL HISTORY
              </button>
            </div>

          </div>

        </div>
      )}

      {/* STEP: PREVIEW (Review validated leads before commit) */}
      {step === "PREVIEW" && validationData && (
        <div className="space-y-6">

          {/* Commit Error Banner */}
          {commitError && (
            <div className="p-4 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{commitError}</span>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
              <div className="text-[11px] font-bold uppercase tracking-wider">VALID ROWS</div>
              <div className="text-2xl font-extrabold mt-1">{validationData.validCount}</div>
            </div>

            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
              <div className="text-[11px] font-bold uppercase tracking-wider">WARNINGS</div>
              <div className="text-2xl font-extrabold mt-1">{validationData.warningCount}</div>
            </div>

            <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
              <div className="text-[11px] font-bold uppercase tracking-wider">ERRORS</div>
              <div className="text-2xl font-extrabold mt-1">{validationData.errorCount}</div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--import-card-border)] bg-[var(--import-card-bg)] text-[var(--import-subtitle)]">
              <div className="text-[11px] font-bold uppercase tracking-wider">SKIPPED EMPTY</div>
              <div className="text-2xl font-extrabold mt-1 text-[var(--import-title)]">{validationData.emptyCount}</div>
            </div>
          </div>

          {/* Sub-tabs for Data Preview vs Row Errors */}
          <div className="flex items-center justify-between border-b border-[var(--import-card-border)] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewTab("ALL")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${previewTab === "ALL"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-[var(--import-subtitle)] hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                Data Preview ({validationData.previewRows.length})
              </button>

              {validationData.errors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewTab("ERRORS")}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${previewTab === "ERRORS"
                    ? "bg-rose-600 text-white shadow-sm"
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
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${previewTab === "WARNINGS"
                    ? "bg-amber-600 text-white shadow-sm"
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
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Error Report (.csv)</span>
              </button>
            )}
          </div>

          {/* Tab 1: Data Preview Table */}
          {previewTab === "ALL" && (
            <div className="zappit-preview-table-container max-h-[360px] overflow-y-auto">
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
                      <td className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">{r.stage}</td>
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
            <div className="space-y-2 max-h-[360px] overflow-y-auto p-1">
              {validationData.errors.map((e: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200"
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
            <div className="space-y-2 max-h-[360px] overflow-y-auto p-1">
              {validationData.warnings.map((w: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200"
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

          {/* Footer Action Bar */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[var(--import-card-border)] flex-wrap">
            <button
              type="button"
              onClick={() => setStep("UPLOAD")}
              disabled={importing}
              className="h-[44px] px-4 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Choose Another File</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="h-[44px] px-5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCommitImport}
                disabled={validationData.validCount === 0 || importing}
                className="h-[44px] px-6 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>Import {validationData.validCount} Valid Leads</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* STEP: IMPORTING PROGRESS BAR */}
      {step === "IMPORTING" && (
        <div className="zappit-import-card p-12 sm:p-16 text-center space-y-6 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-spin">
            <Loader2 className="w-7 h-7" />
          </div>

          <div className="w-full max-w-md space-y-3">
            <div className="flex justify-between text-xs font-bold text-[var(--import-title)]">
              <span>Importing leads into All Leads...</span>
              <span>{importProgress}%</span>
            </div>
            <div className="zappit-progress-track">
              <div
                className="zappit-progress-bar"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-[var(--import-subtitle)] max-w-sm">
            Creating lead records, dynamic field values, and scheduled follow-ups. Please wait...
          </p>
        </div>
      )}

      {/* STEP: SUCCESS REPORT */}
      {step === "SUCCESS" && commitResult && (
        <div className="zappit-import-card p-10 sm:p-14 text-center space-y-6 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-lg ring-8 ring-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[var(--import-title)]">
              Import Completed Successfully!
            </h2>
            <p className="text-sm text-[var(--import-subtitle)] mt-1.5 max-w-md mx-auto">
              {commitResult.message || `Successfully imported ${commitResult.importedCount} leads.`}
            </p>
          </div>

          {/* Metrics Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-lg">
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/30">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">LEADS CREATED</div>
              <div className="text-2xl font-extrabold text-[var(--import-title)] mt-1">
                {commitResult.importedCount || 0}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30">
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400">DYNAMIC VALUES</div>
              <div className="text-2xl font-extrabold text-[var(--import-title)] mt-1">
                {commitResult.dynamicValuesCount || 0}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/30">
              <div className="text-xs font-bold text-purple-600 dark:text-purple-400">FOLLOW-UPS</div>
              <div className="text-2xl font-extrabold text-[var(--import-title)] mt-1">
                {commitResult.followUpsCount || 0}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (onSuccessRefresh) onSuccessRefresh();
                onClose();
              }}
              className="h-[44px] px-8 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-md shadow-emerald-500/20 transition-all inline-flex items-center gap-2"
            >
              <span>View All Leads</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. HISTORY DRAWER / MODAL */}
      {isHistoryDrawerOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsHistoryDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[var(--import-card-bg)] border border-[var(--import-card-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-[var(--import-card-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-500" />
                <h3 className="text-base font-bold text-[var(--import-title)]">Import History</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {recentImports.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No import history recorded yet.
                </div>
              ) : (
                recentImports.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl border border-[var(--import-card-border)] bg-[var(--import-drop-bg)] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[var(--import-title)] truncate">
                        {rec.fileName}
                      </div>
                      <div className="text-[11px] text-[var(--import-subtitle)] mt-0.5 flex items-center gap-2">
                        <span>{formatTimestamp(rec.timestamp)}</span>
                        <span>•</span>
                        <span>{formatBytes(rec.fileSize)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {rec.importedCount} imported
                      </div>
                      {rec.failedCount > 0 && (
                        <div className="text-[11px] text-rose-500">
                          {rec.failedCount} errors
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[var(--import-card-border)] bg-[var(--import-table-header-bg)] flex items-center justify-between text-xs">
              <span className="text-[var(--import-subtitle)]">
                Local browser import activity
              </span>
              {recentImports.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ------------------------------------------------------------- */
  /* If inline === true, render directly into the dashboard content */
  /* Otherwise, render inside a bounded, centered modal dialog     */
  /* ------------------------------------------------------------- */
  if (inline) {
    return workspaceContent;
  }

  const modalOverlay = (
    <div
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-leads-title"
      onKeyDown={handleKeyDown}
      className="zappit-import-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing && !validating) {
          onClose();
        }
      }}
    >
      <div className="zappit-import-dialog-shell" onClick={(e) => e.stopPropagation()}>
        {workspaceContent}
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(modalOverlay, document.body) : null;
}
