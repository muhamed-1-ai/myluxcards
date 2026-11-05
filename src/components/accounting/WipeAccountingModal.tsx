"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, ShieldCheck, Loader2, X } from "lucide-react";

interface ResetPreviewData {
  workspace: { id: string; name: string; currency: string; type: string };
  recordCounts: {
    financialAccounts: number;
    categories: number;
    contacts: number;
    products: number;
    journalEntries: number;
    journalLines: number;
    invoices: number;
    invoiceLines: number;
    sales: number;
    payments: number;
    transactions: number;
    loans: number;
    budgets: number;
    recurringRules: number;
    reminders: number;
  };
  financialSummary: {
    accountsCount: number;
    netBalanceMinor: number;
    totalInflowMinor: number;
    totalOutflowMinor: number;
    receivableMinor: number;
    payableMinor: number;
    unpaidInvoicesCount: number;
    currency: string;
  };
  hasActiveData: boolean;
  retentionDays: number;
  unaffectedModules: string[];
}

interface WipeAccountingModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: { id: string; name: string; currency?: string; type?: string } | null;
  onSuccess: (versionNumber: number) => void;
  formatMoney?: (minor: number) => string;
}

export default function WipeAccountingModal({
  isOpen,
  onClose,
  workspace,
  onSuccess,
  formatMoney,
}: WipeAccountingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [preview, setPreview] = useState<ResetPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [reason, setReason] = useState("");
  const [resetting, setResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!workspace) return;
    setLoadingPreview(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/accounting/reset/preview?workspaceId=${workspace.id}`);
      const data = await res.json();
      if (res.ok && data.preview) {
        setPreview(data.preview);
      } else {
        setErrorMessage(data.message || data.error || "Failed to load workspace preview");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error loading preview");
    } finally {
      setLoadingPreview(false);
    }
  }, [workspace]);

  // Load preview data when opened
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setErrorMessage(null);
      fetchPreview();
    }
  }, [isOpen, fetchPreview]);

  // Background Scroll Lock (prevents layout shift and background scrolling)
  useEffect(() => {
    if (!isOpen || !mounted) return;

    if (document.activeElement instanceof HTMLElement) {
      previouslyFocusedElementRef.current = document.activeElement;
    }

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      if (previouslyFocusedElementRef.current && typeof previouslyFocusedElementRef.current.focus === "function") {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, mounted]);

  // Keyboard navigation: Escape to close, Tab focus trapping
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!resetting) {
          e.preventDefault();
          onClose();
        }
      } else if (e.key === "Tab") {
        if (!containerRef.current) return;
        const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, mounted, resetting, onClose]);

  if (!isOpen || !mounted) return null;

  const handleExecuteReset = async () => {
    if (!workspace) return;
    setResetting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/accounting/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspace.id,
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          confirmed: true,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.versionNumber);
      } else {
        setErrorMessage(data.message || data.error || "Failed to execute accounting reset");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error executing accounting reset");
    } finally {
      setResetting(false);
    }
  };

  const formattedZero = formatMoney ? formatMoney(0) : "₹0.00";

  const modalMarkup = (
    <div
      className="acc-wipe-modal-backdrop"
      onClick={() => {
        if (!resetting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wipe-accounting-modal-title"
    >
      <div
        ref={containerRef}
        className="acc-wipe-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header: NEVER scrolls away */}
        <div className="acc-wipe-modal-header">
          <div className="acc-wipe-modal-header-info">
            <div className="acc-wipe-modal-icon-badge">
              <Trash2 size={20} color="#EF4444" />
            </div>
            <div>
              <h3 id="wipe-accounting-modal-title" className="acc-wipe-modal-title">
                Wipe Accounting Data
              </h3>
              <p className="acc-wipe-modal-subtitle">
                Workspace: <strong>{workspace?.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="acc-wipe-modal-close"
            onClick={() => {
              if (!resetting) onClose();
            }}
            disabled={resetting}
            aria-label="Close dialog"
            style={{ cursor: resetting ? "not-allowed" : "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Bounded Scrollable Body: Single scrollable area */}
        <div className="acc-wipe-modal-body">
          {/* Warning Banner */}
          <div className="acc-wipe-warning-banner">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>Irreversible active ledger reset:</strong> All active financial transactions, invoices, journal entries, and account balances in <strong>{workspace?.name}</strong> will be wiped back to a clean zero-state.
            </div>
          </div>

          {/* Active Records Itemized List with High-Contrast Tokens */}
          <div className="acc-wipe-records-box">
            <div className="acc-wipe-records-title">
              The following active records will be archived and removed:
            </div>
            {loadingPreview ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--acc-text-muted)", padding: "0.5rem 0" }}>
                <Loader2 size={16} className="acc-spin" />
                <span>Calculating active workspace ledger impact...</span>
              </div>
            ) : (
              <ul className="acc-wipe-records-list">
                <li>
                  <strong>
                    {preview ? preview.recordCounts.transactions : 0}
                  </strong>{" "}
                  Financial transactions & journal records
                </li>
                <li>
                  <strong>
                    {preview ? preview.recordCounts.invoices : 0}
                  </strong>{" "}
                  Invoices, sales, and payments
                </li>
                <li>
                  <strong>
                    {preview ? preview.recordCounts.loans : 0}
                  </strong>{" "}
                  Loans, EMI records & reminders
                </li>
                <li>
                  Account balances atomically reset to <strong>{formattedZero}</strong>
                </li>
                <li>
                  Default Chart of Accounts and categories will be re-seeded clean
                </li>
                <li className="acc-wipe-reversible-tag">
                  <strong>100% Reversible:</strong> An immutable snapshot with {preview?.retentionDays || 90}-day retention is automatically preserved for one-click restoration.
                </li>
              </ul>
            )}
          </div>

          {/* Strict ZAPPIT Isolation Guarantee */}
          <div className="acc-wipe-isolation-box">
            <ShieldCheck size={18} color="#10B981" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div className="acc-wipe-isolation-title">
                Strict ZAPPIT Isolation Guarantee
              </div>
              <div className="acc-wipe-isolation-text">
                Reset strictly targets the <strong>Accounting</strong> module only. CRM leads, pipeline stages, follow-ups, user accounts, digital business cards, public profiles, NFC tags, QR codes, and SaaS subscriptions remain completely untouched.
              </div>
            </div>
          </div>

          {/* Optional Reason Input */}
          <div className="acc-form-group" style={{ margin: 0 }}>
            <label
              className="acc-wipe-reason-label"
              htmlFor="wipe-reason-input"
            >
              Reset Reason <span className="acc-wipe-reason-sub">(Optional note saved in recovery version)</span>
            </label>
            <input
              id="wipe-reason-input"
              type="text"
              className="acc-form-input"
              placeholder="e.g., Starting fresh financial year bookkeeping"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={resetting}
              style={{ fontSize: "0.8125rem" }}
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="acc-wipe-error-banner">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Sticky Footer: NEVER scrolls away, responsive button layout */}
        <div className="acc-wipe-modal-footer">
          <button
            type="button"
            className="acc-btn acc-btn-outline acc-wipe-cancel-btn"
            onClick={onClose}
            disabled={resetting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="acc-wipe-data-btn acc-wipe-confirm-btn"
            onClick={handleExecuteReset}
            disabled={resetting}
          >
            {resetting ? (
              <>
                <Loader2 size={16} className="acc-spin" />
                <span>Archiving & Wiping...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} strokeWidth={2.2} />
                <span>Continue & Wipe Accounting</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
