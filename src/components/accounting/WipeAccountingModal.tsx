"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Trash2, ShieldCheck, Loader2 } from "lucide-react";

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
  formatMoney: (minor: number) => string;
}

export default function WipeAccountingModal({
  isOpen,
  onClose,
  workspace,
  onSuccess,
  formatMoney,
}: WipeAccountingModalProps) {
  const [preview, setPreview] = useState<ResetPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [reason, setReason] = useState("");
  const [resetting, setResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setErrorMessage(null);
      fetchPreview();
    }
  }, [isOpen, fetchPreview]);

  if (!isOpen) return null;

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

  return (
    <div
      className="acc-modal-backdrop"
      onClick={() => {
        if (!resetting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wipe-accounting-modal-title"
    >
      <div
        className="acc-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "580px",
          width: "92vw",
          borderRadius: "var(--acc-radius-lg, 12px)",
          border: "1px solid rgba(239, 68, 68, 0.35)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(220, 38, 38, 0.2)",
        }}
      >
        {/* Modal Header */}
        <div
          className="acc-modal-header"
          style={{
            borderBottom: "1px solid var(--acc-border)",
            paddingBottom: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Trash2 size={20} color="#EF4444" />
            </div>
            <div>
              <h3
                id="wipe-accounting-modal-title"
                className="acc-modal-title"
                style={{ color: "#EF4444", fontSize: "1.125rem", fontWeight: 700, margin: 0 }}
              >
                Wipe Accounting Data
              </h3>
              <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                Workspace: <strong>{workspace?.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="acc-modal-close"
            onClick={() => {
              if (!resetting) onClose();
            }}
            disabled={resetting}
            aria-label="Close dialog"
            style={{ cursor: resetting ? "not-allowed" : "pointer" }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Warning Banner */}
          <div
            style={{
              padding: "0.875rem 1rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: "8px",
              color: "#EF4444",
              fontSize: "0.875rem",
              lineHeight: 1.45,
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <strong>Irreversible active ledger reset:</strong> All active financial transactions, invoices, journal entries, and account balances in <strong>{workspace?.name}</strong> will be wiped back to a clean zero-state.
            </div>
          </div>

          {/* Active Records Itemized List */}
          <div
            style={{
              fontSize: "0.8125rem",
              backgroundColor: "var(--acc-raised)",
              borderRadius: "8px",
              padding: "0.875rem 1rem",
              border: "1px solid var(--acc-border)",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--acc-text-main)", marginBottom: "0.5rem" }}>
              The following active records will be archived and removed:
            </div>
            {loadingPreview ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--acc-text-muted)", padding: "0.5rem 0" }}>
                <Loader2 size={16} className="acc-spin" />
                <span>Calculating active workspace ledger impact...</span>
              </div>
            ) : (
              <ul style={{ paddingLeft: "1.25rem", margin: 0, color: "var(--acc-text-muted)", lineHeight: 1.6 }}>
                <li>
                  <strong style={{ color: "var(--acc-text-main)" }}>
                    {preview ? preview.recordCounts.transactions : 0}
                  </strong>{" "}
                  Financial transactions & journal records
                </li>
                <li>
                  <strong style={{ color: "var(--acc-text-main)" }}>
                    {preview ? preview.recordCounts.invoices : 0}
                  </strong>{" "}
                  Invoices, sales, and payments
                </li>
                <li>
                  <strong style={{ color: "var(--acc-text-main)" }}>
                    {preview ? preview.recordCounts.loans : 0}
                  </strong>{" "}
                  Loans, EMI records & reminders
                </li>
                <li>
                  Account balances atomically reset to <strong style={{ color: "var(--acc-text-main)" }}>₹0.00</strong>
                </li>
                <li>
                  Default Chart of Accounts and categories will be re-seeded clean
                </li>
                <li style={{ color: "#10B981" }}>
                  <strong>100% Reversible:</strong> An immutable snapshot with 90-day retention is automatically preserved for one-click restoration.
                </li>
              </ul>
            )}
          </div>

          {/* Strict ZAPPIT Isolation Guarantee */}
          <div
            style={{
              padding: "0.875rem 1rem",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.28)",
              borderRadius: "8px",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
            }}
          >
            <ShieldCheck size={18} color="#10B981" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ fontWeight: 600, color: "#10B981", marginBottom: "0.25rem" }}>
                Strict ZAPPIT Isolation Guarantee
              </div>
              <div style={{ color: "var(--acc-text-main)", fontSize: "0.775rem", lineHeight: 1.5 }}>
                Reset strictly targets the <strong>Accounting</strong> module only. CRM leads, pipeline stages, follow-ups, user accounts, digital business cards, public profiles, NFC tags, QR codes, and SaaS subscriptions remain completely untouched.
              </div>
            </div>
          </div>

          {/* Optional Reason Input */}
          <div className="acc-form-group" style={{ margin: 0 }}>
            <label
              className="acc-form-label"
              htmlFor="wipe-reason-input"
              style={{ fontSize: "0.8125rem", marginBottom: "0.35rem" }}
            >
              Reset Reason <span style={{ color: "var(--acc-text-muted)" }}>(Optional note saved in recovery version)</span>
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
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid #EF4444",
                borderRadius: "6px",
                color: "#EF4444",
                fontSize: "0.8125rem",
                lineHeight: 1.4,
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Modal Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "0.5rem",
              paddingTop: "0.75rem",
              borderTop: "1px solid var(--acc-border)",
            }}
          >
            <button
              type="button"
              className="acc-btn acc-btn-outline"
              onClick={onClose}
              disabled={resetting}
              style={{ minWidth: "90px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="acc-wipe-data-btn"
              onClick={handleExecuteReset}
              disabled={resetting}
              style={{
                padding: "0.5rem 1.25rem",
                minHeight: "38px",
              }}
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
    </div>
  );
}
