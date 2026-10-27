"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccounting } from "./AccountingContext";
import {
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  Clock,
  ArrowRight,
  Database,
  RefreshCw,
  Info,
  Lock,
} from "lucide-react";

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

interface RecoveryVersionItem {
  id: string;
  versionNumber: number;
  name: string;
  reason: string;
  status: string;
  recordCounts: any;
  financialSummary: any;
  createdAt: string;
  expiresAt: string;
  restoredAt: string | null;
  isExpired: boolean;
}

interface RestorePreviewData {
  targetVersion: {
    id: string;
    versionNumber: number;
    name: string;
    reason: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    recordCounts: any;
    financialSummary: any;
    isExpired: boolean;
    isCorrupted: boolean;
  };
  currentActiveState: {
    recordCounts: any;
    financialSummary: any;
    hasActiveActivity: boolean;
  };
  willCreatePreRestoreBackup: boolean;
  canRestore: boolean;
  blockReason?: string;
}

export default function DataManagementView() {
  const {
    activeWorkspace,
    userRole,
    triggerRefresh,
    refreshKey,
    formatMoney,
  } = useAccounting();

  const isOwner = userRole === "OWNER";

  // Data states
  const [resetPreview, setResetPreview] = useState<ResetPreviewData | null>(null);
  const [loadingResetPreview, setLoadingResetPreview] = useState(false);
  const [recoveryVersions, setRecoveryVersions] = useState<RecoveryVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Restore modal states
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restorePreview, setRestorePreview] = useState<RestorePreviewData | null>(null);
  const [loadingRestorePreview, setLoadingRestorePreview] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);
  const [restoreErrorMessage, setRestoreErrorMessage] = useState<string | null>(null);

  // Fetch reset preview
  const fetchResetPreview = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoadingResetPreview(true);
    try {
      const res = await fetch(`/api/accounting/reset/preview?workspaceId=${activeWorkspace.id}`);
      const data = await res.json();
      if (res.ok && data.preview) {
        setResetPreview(data.preview);
      }
    } catch (err) {
      console.error("Failed to load reset preview:", err);
    } finally {
      setLoadingResetPreview(false);
    }
  }, [activeWorkspace]);

  // Fetch recovery versions list
  const fetchRecoveryVersions = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/accounting/recovery-versions?workspaceId=${activeWorkspace.id}`);
      const data = await res.json();
      if (res.ok && data.versions) {
        setRecoveryVersions(data.versions);
      }
    } catch (err) {
      console.error("Failed to load recovery versions:", err);
    } finally {
      setLoadingVersions(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchResetPreview();
    fetchRecoveryVersions();
  }, [fetchResetPreview, fetchRecoveryVersions, refreshKey]);

  // Handle open restore preview
  const handleOpenRestoreModal = async (versionId: string) => {
    if (!activeWorkspace) return;
    setSelectedVersionId(versionId);
    setRestoreConfirmed(false);
    setRestoreErrorMessage(null);
    setRestoreModalOpen(true);
    setLoadingRestorePreview(true);

    try {
      const res = await fetch(
        `/api/accounting/recovery-versions/${versionId}/preview?workspaceId=${activeWorkspace.id}`
      );
      const data = await res.json();
      if (res.ok && data.preview) {
        setRestorePreview(data.preview);
      } else {
        setRestoreErrorMessage(data.message || "Failed to fetch version preview");
      }
    } catch (err: any) {
      setRestoreErrorMessage(err.message || "Network error fetching restore preview");
    } finally {
      setLoadingRestorePreview(false);
    }
  };

  // Handle execute restore
  const handleExecuteRestore = async () => {
    if (!activeWorkspace || !selectedVersionId) return;
    setRestoring(true);
    setRestoreErrorMessage(null);

    try {
      const res = await fetch(
        `/api/accounting/recovery-versions/${selectedVersionId}/restore`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": activeWorkspace.id,
          },
          body: JSON.stringify({
            workspaceId: activeWorkspace.id,
            confirmed: true,
          }),
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        setRestoreSuccessMessage(
          "Historical accounting state restored successfully! All ledger balances, invoices, and transactions have been reactivated."
        );
        setRestoreModalOpen(false);
        triggerRefresh();
        fetchResetPreview();
        fetchRecoveryVersions();
        setTimeout(() => setRestoreSuccessMessage(null), 8000);
      } else {
        setRestoreErrorMessage(data.message || data.error || "Failed to restore accounting version");
      }
    } catch (err: any) {
      setRestoreErrorMessage(err.message || "Network error restoring accounting version");
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const calculateDaysRemaining = (isoExpiresAt: string) => {
    try {
      const diffMs = new Date(isoExpiresAt).getTime() - Date.now();
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 0;
    } catch {
      return 0;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Global Success / Notice Banners */}

      {restoreSuccessMessage && (
        <div
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            border: "1px solid var(--acc-blue, #3B82F6)",
            borderRadius: "8px",
            color: "var(--acc-blue, #3B82F6)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontWeight: 500,
            fontSize: "0.875rem",
          }}
        >
          <RotateCcw size={20} />
          <span>{restoreSuccessMessage}</span>
        </div>
      )}

      {/* SECTION 1: Complete Accounting Reset Card */}
      <div className="acc-card" style={{ borderLeft: "4px solid #EF4444" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
              <Trash2 size={20} color="#EF4444" />
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                Complete Accounting Reset
              </h3>
              <span
                style={{
                  fontSize: "0.6875rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "#10B981",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                100% Reversible
              </span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--acc-text-muted)", margin: "0 0 1rem 0", maxWidth: "680px" }}>
              Safely reset your active Accounting ledger to a clean, empty state with zero balances.
              Before any data is wiped, a complete, immutable recovery version is automatically archived with a 90-day retention period.
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0.875rem",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "6px",
              color: "#EF4444",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            <Trash2 size={15} />
            <span>Wipe button moved to Accounting Home header</span>
          </div>
        </div>

        {!isOwner && (
          <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--acc-text-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lock size={14} />
            <span>Administrator permission required: Only workspace <strong>OWNER</strong> can perform a reset.</span>
          </div>
        )}

        {/* Current Active Data Metrics Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "var(--acc-raised)",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Active Net Balance</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {resetPreview ? formatMoney(resetPreview.financialSummary.netBalanceMinor) : "..."}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Transactions</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {resetPreview ? resetPreview.recordCounts.transactions : "..."}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Invoices</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {resetPreview ? resetPreview.recordCounts.invoices : "..."}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Journal Entries</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {resetPreview ? resetPreview.recordCounts.journalEntries : "..."}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Chart Accounts</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {resetPreview ? resetPreview.recordCounts.financialAccounts : "..."}
            </div>
          </div>
        </div>

        {/* Isolation Guarantee Banner */}
        <div
          style={{
            marginTop: "1rem",
            padding: "0.875rem 1rem",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "8px",
            fontSize: "0.8125rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
          }}
        >
          <ShieldCheck size={18} color="#10B981" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong style={{ color: "#10B981" }}>Strict Zappit Isolation Guarantee:</strong>
            <span style={{ color: "var(--acc-text-main)", marginLeft: "0.5rem" }}>
              Reset strictly targets the Accounting module only. CRM leads, pipeline stages, follow-ups, user accounts,
              credentials, digital business cards/profiles, NFC/QR records, and SaaS subscriptions remain completely untouched.
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Restore Previous Accounting Data Card */}
      <div className="acc-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
              <RotateCcw size={20} color="var(--acc-blue, #3B82F6)" />
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                Restore Previous Accounting Data
              </h3>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--acc-text-muted)", margin: 0 }}>
              Permanent data management archive. Select any verified historical version to preview its financial state and restore your ledger.
            </p>
          </div>

          <button
            type="button"
            className="acc-btn acc-btn-outline acc-btn-sm"
            onClick={fetchRecoveryVersions}
            disabled={loadingVersions}
          >
            <RefreshCw size={14} className={loadingVersions ? "acc-spin" : ""} />
            Refresh Versions
          </button>
        </div>

        {/* Retention Policy Banner */}
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "var(--acc-raised)",
            borderRadius: "8px",
            fontSize: "0.8125rem",
            color: "var(--acc-text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            marginBottom: "1.25rem",
          }}
        >
          <Info size={16} color="var(--acc-blue, #3B82F6)" />
          <span>
            <strong>Recovery Retention Policy:</strong> Snapshots are securely stored with SHA-256 cryptographic verification for 90 days from creation.
            Restoration is impossible once purged after expiry.
          </span>
        </div>

        {/* Versions Table / List */}
        {loadingVersions ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--acc-text-muted)" }}>
            Loading recovery versions...
          </div>
        ) : recoveryVersions.length === 0 ? (
          <div
            style={{
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              backgroundColor: "var(--acc-raised)",
              borderRadius: "8px",
              color: "var(--acc-text-muted)",
            }}
          >
            <Database size={36} style={{ margin: "0 auto 0.75rem auto", opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
              No Accounting Recovery Versions Found
            </div>
            <div style={{ fontSize: "0.8125rem" }}>
              When you perform an Accounting reset, a verified snapshot will automatically appear here for one-click recovery.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="acc-table" style={{ width: "100%", fontSize: "0.8125rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Version</th>
                  <th style={{ textAlign: "left" }}>Type / Reason</th>
                  <th style={{ textAlign: "left" }}>Created</th>
                  <th style={{ textAlign: "left" }}>Record Breakdown</th>
                  <th style={{ textAlign: "right" }}>Net Balance</th>
                  <th style={{ textAlign: "center" }}>Retention Expiry</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recoveryVersions.map((v) => {
                  const daysLeft = calculateDaysRemaining(v.expiresAt);
                  const isAvailable = v.status === "AVAILABLE" && !v.isExpired;

                  return (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div>v{v.versionNumber}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", fontWeight: 400 }}>
                          {v.name}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            backgroundColor:
                              v.reason === "PRE_RESET"
                                ? "rgba(239, 68, 68, 0.12)"
                                : v.reason === "PRE_RESTORE"
                                ? "rgba(139, 92, 246, 0.12)"
                                : "rgba(59, 130, 246, 0.12)",
                            color:
                              v.reason === "PRE_RESET"
                                ? "#EF4444"
                                : v.reason === "PRE_RESTORE"
                                ? "#8B5CF6"
                                : "#3B82F6",
                          }}
                        >
                          {v.reason === "PRE_RESET"
                            ? "Pre-Reset"
                            : v.reason === "PRE_RESTORE"
                            ? "Auto-Backup"
                            : "Manual"}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {formatDate(v.createdAt)}
                      </td>
                      <td>
                        <span style={{ color: "var(--acc-text-main)" }}>
                          {v.recordCounts?.transactions || 0} txs · {v.recordCounts?.invoices || 0} invs · {v.recordCounts?.financialAccounts || 0} accts
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {formatMoney(v.financialSummary?.netBalanceMinor || 0)}
                      </td>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        {v.isExpired ? (
                          <span style={{ color: "var(--acc-text-muted)" }}>Expired</span>
                        ) : (
                          <span style={{ color: daysLeft <= 7 ? "#F59E0B" : "var(--acc-text-main)" }}>
                            {daysLeft} days left
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            backgroundColor:
                              v.isExpired
                                ? "rgba(107, 114, 128, 0.15)"
                                : v.status === "RESTORED"
                                ? "rgba(59, 130, 246, 0.15)"
                                : "rgba(16, 185, 129, 0.15)",
                            color:
                              v.isExpired
                                ? "#6B7280"
                                : v.status === "RESTORED"
                                ? "#3B82F6"
                                : "#10B981",
                          }}
                        >
                          {v.isExpired ? "EXPIRED" : v.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="acc-btn acc-btn-outline acc-btn-sm"
                          onClick={() => handleOpenRestoreModal(v.id)}
                          disabled={!isOwner || !isAvailable}
                          title={
                            !isOwner
                              ? "Only workspace OWNER can restore"
                              : !isAvailable
                              ? "Version cannot be restored"
                              : undefined
                          }
                          style={{
                            opacity: isOwner && isAvailable ? 1 : 0.5,
                            cursor: isOwner && isAvailable ? "pointer" : "not-allowed",
                          }}
                        >
                          <RotateCcw size={12} />
                          Preview & Restore
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 2: Restore Preview & Confirmation Modal */}
      {restoreModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => !restoring && setRestoreModalOpen(false)}>
          <div
            className="acc-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="acc-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <RotateCcw size={20} color="var(--acc-blue, #3B82F6)" />
                <h3 className="acc-modal-title">
                  Restore Accounting Version {restorePreview?.targetVersion ? `v${restorePreview.targetVersion.versionNumber}` : ""}
                </h3>
              </div>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => !restoring && setRestoreModalOpen(false)}
                disabled={restoring}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "0 0 1rem 0" }}>
              {loadingRestorePreview ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "var(--acc-text-muted)" }}>
                  Analyzing recovery version and validating cryptographic checksum...
                </div>
              ) : restorePreview ? (
                <>
                  {/* Financial state comparison preview */}
                  <div style={{ marginBottom: "1.25rem" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Financial State to be Restored:
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "0.75rem",
                        padding: "0.875rem",
                        backgroundColor: "var(--acc-raised)",
                        borderRadius: "8px",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Net Ledger Balance</div>
                        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--acc-blue, #3B82F6)" }}>
                          {formatMoney(restorePreview.targetVersion.financialSummary?.netBalanceMinor || 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Total Inflow / Revenue</div>
                        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#10B981" }}>
                          {formatMoney(restorePreview.targetVersion.financialSummary?.totalInflowMinor || 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Accounts Receivable</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                          {formatMoney(restorePreview.targetVersion.financialSummary?.receivableMinor || 0)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Accounts Payable</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                          {formatMoney(restorePreview.targetVersion.financialSummary?.payableMinor || 0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Record counts preview */}
                  <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1.25rem" }}>
                    <strong>Restored Entities: </strong>
                    {restorePreview.targetVersion.recordCounts?.transactions || 0} Transactions,{" "}
                    {restorePreview.targetVersion.recordCounts?.invoices || 0} Invoices,{" "}
                    {restorePreview.targetVersion.recordCounts?.journalEntries || 0} Journal Entries,{" "}
                    {restorePreview.targetVersion.recordCounts?.financialAccounts || 0} Accounts,{" "}
                    {restorePreview.targetVersion.recordCounts?.categories || 0} Categories.
                  </div>

                  {/* Post-reset activity notice / pre-restore backup notice */}
                  {restorePreview.willCreatePreRestoreBackup ? (
                    <div
                      style={{
                        padding: "0.875rem",
                        backgroundColor: "rgba(139, 92, 246, 0.1)",
                        border: "1px solid rgba(139, 92, 246, 0.3)",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        marginBottom: "1.25rem",
                      }}
                    >
                      <strong style={{ color: "#8B5CF6" }}>⚠️ Post-Reset Activity Detected:</strong>
                      <div style={{ color: "var(--acc-text-main)", marginTop: "0.25rem", lineHeight: "1.4" }}>
                        Your current active ledger has recorded activity. Before restoring, the system will
                        <strong> automatically create a Pre-Restore Recovery Version</strong> of your current data.
                        No records will be merged or permanently lost.
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "0.75rem 0.875rem",
                        backgroundColor: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.25)",
                        borderRadius: "8px",
                        fontSize: "0.8125rem",
                        marginBottom: "1.25rem",
                        color: "#10B981",
                      }}
                    >
                      ✓ Clean State: Current ledger has 0 active transactions. Restoration will smoothly reactivate this historical snapshot.
                    </div>
                  )}

                  {/* Explicit confirmation checkbox */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.625rem",
                      marginBottom: "1.25rem",
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                    }}
                    onClick={() => setRestoreConfirmed(!restoreConfirmed)}
                  >
                    <input
                      type="checkbox"
                      id="confirm-restore-checkbox"
                      checked={restoreConfirmed}
                      onChange={(e) => setRestoreConfirmed(e.target.checked)}
                      disabled={restoring}
                      style={{ marginTop: "2px", cursor: "pointer" }}
                    />
                    <label htmlFor="confirm-restore-checkbox" style={{ cursor: "pointer", color: "var(--acc-text-main)" }}>
                      I confirm that I want to restore Accounting version <strong>v{restorePreview.targetVersion.versionNumber}</strong>.
                      I understand this will reactivate this verified financial state in the active dashboard.
                    </label>
                  </div>

                  {restoreErrorMessage && (
                    <div
                      style={{
                        padding: "0.75rem",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid #EF4444",
                        borderRadius: "6px",
                        color: "#EF4444",
                        fontSize: "0.8125rem",
                        marginBottom: "1rem",
                      }}
                    >
                      {restoreErrorMessage}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setRestoreModalOpen(false)}
                      disabled={restoring}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="acc-btn acc-btn-primary"
                      style={{ flex: 1.5 }}
                      onClick={handleExecuteRestore}
                      disabled={!restoreConfirmed || restoring || !restorePreview.canRestore}
                    >
                      {restoring ? "Restoring Ledger State..." : "Confirm & Restore Version"}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ color: "#EF4444", fontSize: "0.875rem" }}>
                  {restoreErrorMessage || "Could not load version details"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
