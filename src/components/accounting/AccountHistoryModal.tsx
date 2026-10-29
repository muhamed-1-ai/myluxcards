"use client";

import React, { useState, useEffect } from "react";
import type { FinancialAccount } from "./AccountingContext";
import type { AccountHistoryItem } from "@/lib/accounting/types";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";

export interface AccountHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: FinancialAccount | null;
  availableAccounts: FinancialAccount[];
  currency?: string;
  canMutate?: boolean;
  formatMoney: (amountMinor: number, currency?: string) => string;
  onUpdated: () => void;
}

function formatVoidDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function AccountHistoryModal({
  isOpen,
  onClose,
  account,
  availableAccounts,
  currency = "INR",
  canMutate = false,
  formatMoney,
  onUpdated,
}: AccountHistoryModalProps) {
  const [historyItems, setHistoryItems] = useState<AccountHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Correction state
  const [correctingEntry, setCorrectingEntry] = useState<AccountHistoryItem | null>(null);
  const [correctAmountStr, setCorrectAmountStr] = useState("");
  const [correctTargetAccountId, setCorrectTargetAccountId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Reversal state
  const [reversingEntry, setReversingEntry] = useState<AccountHistoryItem | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [submittingReversal, setSubmittingReversal] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadHistory = async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/accounts/${account.id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.history || []);
      } else {
        const err = await res.json();
        setError(err.error || "Failed to load account history");
      }
    } catch {
      setError("Network error loading account history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && account) {
      loadHistory();
      setToastMsg(null);
      setCorrectingEntry(null);
      setReversingEntry(null);
    }
  }, [isOpen, account?.id]);

  if (!isOpen || !account) return null;

  const handleStartCorrection = (entry: AccountHistoryItem) => {
    setCorrectingEntry(entry);
    setCorrectAmountStr((entry.amountMinor / 100).toString());
    setCorrectTargetAccountId(account.id);
    setCorrectionReason("");
    setCorrectionError(null);
  };

  const handleConfirmCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingEntry) return;
    const amt = parseFloat(correctAmountStr);
    if (isNaN(amt) || amt <= 0) {
      setCorrectionError("Please enter a valid positive amount.");
      return;
    }
    if (!correctTargetAccountId) {
      setCorrectionError("Please choose a destination account.");
      return;
    }
    if (!correctionReason.trim()) {
      setCorrectionError("Please provide a reason for the correction.");
      return;
    }

    setSubmittingCorrection(true);
    setCorrectionError(null);
    try {
      const res = await fetch("/api/accounting/accounts/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: correctingEntry.id,
          correctAmountMinor: Math.round(amt * 100),
          correctAccountId: correctTargetAccountId,
          reason: correctionReason.trim(),
        }),
      });

      if (res.ok) {
        setCorrectingEntry(null);
        setToastMsg("Funding entry corrected successfully.");
        loadHistory();
        onUpdated();
      } else {
        const err = await res.json();
        setCorrectionError(err.error || "Failed to correct entry");
      }
    } catch {
      setCorrectionError("Network error while submitting correction.");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const handleStartReversal = (entry: AccountHistoryItem) => {
    setReversingEntry(entry);
    setReversalReason("");
    setReversalError(null);
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingEntry) return;

    setSubmittingReversal(true);
    setReversalError(null);
    try {
      const res = await fetch("/api/accounting/accounts/reversal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: reversingEntry.id,
          reason: reversalReason.trim() || "User requested entry reversal",
        }),
      });

      if (res.ok) {
        setReversingEntry(null);
        setToastMsg("Entry reversed successfully. Balance effect has been undone.");
        loadHistory();
        onUpdated();
      } else {
        const err = await res.json();
        setReversalError(err.error || "Failed to reverse entry");
      }
    } catch {
      setReversalError("Network error while submitting reversal.");
    } finally {
      setSubmittingReversal(false);
    }
  };

  return (
    <>
      <div className="acc-modal-backdrop" onClick={onClose}>
        <div
          className="acc-modal-content acc-history-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="acc-history-modal-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 className="acc-modal-title" style={{ margin: 0 }}>
                  Account Balance History
                </h3>
                <span className="acc-badge acc-badge-primary">
                  {account.name}
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--acc-text-muted)",
                  margin: "0.25rem 0 0 0",
                }}
              >
                Immutable audit trail of journal movements, opening balances, and corrections.
              </p>
            </div>
            <button
              type="button"
              className="acc-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {toastMsg && (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                margin: "0.5rem 1rem",
                borderRadius: "6px",
                backgroundColor: "var(--acc-success-soft, rgba(34, 197, 94, 0.1))",
                color: "var(--acc-success, #22c55e)",
                fontSize: "0.8125rem",
                fontWeight: 600,
              }}
            >
              ✓ {toastMsg}
            </div>
          )}

          <div className="acc-history-modal-body">
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem",
                  color: "var(--acc-text-muted)",
                }}
              >
                Loading audit history...
              </div>
            ) : error ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem",
                  color: "var(--acc-danger)",
                }}
              >
                {error}
              </div>
            ) : historyItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem",
                  color: "var(--acc-text-muted)",
                }}
              >
                No balance or funding movements recorded for this account yet.
              </div>
            ) : (
              <div className="acc-table-wrapper acc-history-table-wrapper">
                <table className="acc-table acc-history-table">
                  <thead>
                    <tr>
                      <th className="acc-history-th-date">Date</th>
                      <th className="acc-history-th-entry">Entry #</th>
                      <th className="acc-history-th-type">Type</th>
                      <th className="acc-history-th-desc">Description</th>
                      <th className="acc-history-th-counterpart">Counterpart</th>
                      <th className="acc-align-right acc-history-th-amount">Amount</th>
                      <th className="acc-history-th-status">Status</th>
                      <th className="acc-history-th-recorder">Recorded By</th>
                      {canMutate && (
                        <th className="acc-align-right acc-col-action acc-history-th-action">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((entry) => (
                      <tr key={entry.lineId}>
                        <td className="acc-history-td-date tabular-nums">
                          {entry.entryDate}
                        </td>
                        <td className="acc-history-td-entry font-mono text-xs">
                          {entry.entryNumber}
                        </td>
                        <td className="acc-history-td-type">
                          <span
                            className="acc-badge acc-badge-neutral"
                            style={{ fontSize: "0.6875rem" }}
                          >
                            {entry.displayType}
                          </span>
                        </td>
                        <td className="acc-history-td-desc">
                          <div style={{ fontWeight: 500 }}>
                            {entry.description || "General entry"}
                          </div>
                        </td>
                        <td className="acc-history-td-counterpart text-xs">
                          {entry.counterpartAccount}
                        </td>
                        <td
                          className={`acc-align-right tabular-nums font-bold acc-history-td-amount ${
                            entry.direction === "INFLOW"
                              ? "acc-direction-inflow"
                              : "acc-direction-outflow"
                          }`}
                        >
                          {entry.direction === "INFLOW" ? "+" : "-"}
                          {formatMoney(entry.amountMinor, currency)}
                        </td>
                        <td className="acc-history-td-status">
                          {entry.status === "ACTIVE" ? (
                            <span
                              className="acc-badge acc-badge-success"
                              style={{ fontSize: "0.6875rem" }}
                            >
                              Active
                            </span>
                          ) : entry.status === "REVERSED" ? (
                            <span
                              className="acc-badge acc-badge-neutral"
                              style={{ fontSize: "0.6875rem", opacity: 0.7 }}
                              title={
                                entry.reversedByEntryNumber
                                  ? `Reversed by ${entry.reversedByEntryNumber}`
                                  : "Reversed"
                              }
                            >
                              Reversed
                            </span>
                          ) : (
                            <span
                              className="acc-badge acc-badge-info"
                              style={{ fontSize: "0.6875rem" }}
                            >
                              Reversal
                            </span>
                          )}
                        </td>
                        <td className="acc-history-td-recorder">
                          <div
                            style={{
                              fontWeight: 500,
                              color: "var(--acc-text-main)",
                            }}
                          >
                            {entry.createdBy}
                          </div>
                          <div
                            style={{
                              fontSize: "0.6875rem",
                              color: "var(--acc-text-muted)",
                            }}
                          >
                            {formatVoidDate(entry.createdAt)}
                          </div>
                        </td>
                        {canMutate && (
                          <td className="acc-align-right acc-col-action acc-history-td-action">
                            {entry.isEligibleForCorrection ? (
                              <div
                                style={{
                                  display: "inline-flex",
                                  gap: "0.3rem",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-primary"
                                  style={{ padding: "0.15rem 0.45rem", fontSize: "0.75rem" }}
                                  onClick={() => handleStartCorrection(entry)}
                                >
                                  Correct
                                </button>
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-outline acc-btn-danger-outline"
                                  style={{ padding: "0.15rem 0.45rem", fontSize: "0.75rem" }}
                                  onClick={() => handleStartReversal(entry)}
                                >
                                  Reverse
                                </button>
                              </div>
                            ) : entry.status === "REVERSED" ? (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--acc-text-muted)",
                                }}
                              >
                                {entry.reversedByEntryNumber
                                  ? `Reversed by ${entry.reversedByEntryNumber}`
                                  : "Reversed"}
                              </span>
                            ) : entry.status === "REVERSAL" ? (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--acc-text-muted)",
                                }}
                              >
                                {entry.reversalOfEntryNumber
                                  ? `Reversal of ${entry.reversalOfEntryNumber}`
                                  : "Reversal entry"}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--acc-text-muted)",
                                }}
                              >
                                Transactions
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--acc-border)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Correct Entry Modal */}
      {correctingEntry && (
        <div
          className="acc-modal-backdrop acc-modal-backdrop-elevated"
          onClick={() => setCorrectingEntry(null)}
        >
          <div
            className="acc-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px" }}
          >
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Correct Funding Entry</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setCorrectingEntry(null)}
              >
                ✕
              </button>
            </div>

            {correctionError && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  marginBottom: "0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--acc-danger-soft, rgba(239, 68, 68, 0.1))",
                  color: "var(--acc-danger)",
                  fontSize: "0.8125rem",
                }}
              >
                ⚠️ {correctionError}
              </div>
            )}

            <form onSubmit={handleConfirmCorrection}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="correct-amount-input">
                  Correct Amount (₹) *
                </label>
                <FormattedMoneyInput
                  id="correct-amount-input"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  value={correctAmountStr}
                  onChange={(e) => setCorrectAmountStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="correct-dest-account">
                  Destination Payment Account *
                </label>
                <select
                  id="correct-dest-account"
                  required
                  className="acc-form-select"
                  value={correctTargetAccountId}
                  onChange={(e) => setCorrectTargetAccountId(e.target.value)}
                >
                  {availableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="correct-reason-input">
                  Correction Reason *
                </label>
                <input
                  id="correct-reason-input"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Correcting typo in initial opening balance"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setCorrectingEntry(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingCorrection}
                >
                  {submittingCorrection ? "Correcting..." : "Apply Correction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Entry Modal */}
      {reversingEntry && (
        <div
          className="acc-modal-backdrop acc-modal-backdrop-elevated"
          onClick={() => setReversingEntry(null)}
        >
          <div
            className="acc-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "460px" }}
          >
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Reverse Funding Entry</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setReversingEntry(null)}
              >
                ✕
              </button>
            </div>

            {reversalError && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  marginBottom: "0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "var(--acc-danger-soft, rgba(239, 68, 68, 0.1))",
                  color: "var(--acc-danger)",
                  fontSize: "0.8125rem",
                }}
              >
                ⚠️ {reversalError}
              </div>
            )}

            <form onSubmit={handleConfirmReversal}>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--acc-text-muted)",
                  margin: "0 0 1rem 0",
                }}
              >
                Reversing will post an equal and opposite entry that permanently voids this balance movement.
              </p>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="rev-reason">
                  Reversal Reason (Optional)
                </label>
                <input
                  id="rev-reason"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. Duplicate entry entered in error"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setReversingEntry(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-danger"
                  style={{ flex: 1.5 }}
                  disabled={submittingReversal}
                >
                  {submittingReversal ? "Reversing..." : "Confirm Reversal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
