"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";

interface TransactionItem {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount_minor: number;
  date: string;
  notes?: string;
  contact_name?: string;
  category_name?: string;
  account_name?: string;
  status: string;
  journal_entry_id?: string;
}

interface TransactionsViewProps {
  initialSubtab?: "TRANSACTIONS" | "BALANCES";
}

export default function TransactionsView({ initialSubtab = "TRANSACTIONS" }: TransactionsViewProps) {
  const {
    activeWorkspace,
    accounts,
    formatMoney,
    openFastModal,
    refreshKey,
    triggerRefresh,
    canMutate,
  } = useAccounting();

  const [subtab, setSubtab] = useState<"TRANSACTIONS" | "BALANCES">(initialSubtab);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Void modal state
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [submittingVoid, setSubmittingVoid] = useState(false);

  // Opening Balance Modal State
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [openingBalanceStr, setOpeningBalanceStr] = useState("");
  const [submittingOpening, setSubmittingOpening] = useState(false);

  useEffect(() => {
    setSubtab(initialSubtab);
  }, [initialSubtab]);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadTransactions() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting/transactions?workspaceId=${activeWorkspace?.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setTransactions(data.transactions || []);
        }
      } catch (err) {
        console.error("Failed to load transactions:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTransactions();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingId) return;

    setSubmittingVoid(true);
    try {
      const res = await fetch(`/api/accounting/transactions/${voidingId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason || "User voided transaction" }),
      });
      if (res.ok) {
        setVoidingId(null);
        setVoidReason("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to void transaction");
      }
    } catch {
      alert("Network error voiding transaction");
    } finally {
      setSubmittingVoid(false);
    }
  };

  const handleSetOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(openingBalanceStr);
    if (!activeWorkspace || !selectedAccountId || isNaN(amt)) {
      alert("Please choose an account and specify a valid opening balance.");
      return;
    }

    setSubmittingOpening(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          accountId: selectedAccountId,
          openingBalanceMinor: Math.round(amt * 100),
        }),
      });

      if (res.ok) {
        setOpeningModalOpen(false);
        setSelectedAccountId("");
        setOpeningBalanceStr("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to set opening balance");
      }
    } finally {
      setSubmittingOpening(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType !== "ALL" && tx.type !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchNotes = (tx.notes || "").toLowerCase().includes(q);
      const matchContact = (tx.contact_name || "").toLowerCase().includes(q);
      const matchCat = (tx.category_name || "").toLowerCase().includes(q);
      const matchAcc = (tx.account_name || "").toLowerCase().includes(q);
      if (!matchNotes && !matchContact && !matchCat && !matchAcc) return false;
    }
    return true;
  });

  const assetAccounts = accounts.filter((a) => a.type === "ASSET");
  const liabilityAccounts = accounts.filter((a) => a.type === "LIABILITY");
  const equityAccounts = accounts.filter((a) => a.type === "EQUITY");

  return (
    <div>
      {/* Header with Title and Actions */}
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Transactions</h2>
          <p className="acc-subtitle">Full transaction ledger, financial accounts, and fund transfers.</p>
        </div>

        <div className="acc-header-actions">
          <button
            type="button"
            className="acc-btn acc-btn-primary acc-btn-sm"
            onClick={() => openFastModal("INCOME")}
          >
            + Add Income / Sale
          </button>
          <button
            type="button"
            className="acc-btn acc-btn-outline acc-btn-sm"
            onClick={() => openFastModal("EXPENSE")}
          >
            - Add Expense
          </button>
          <button
            type="button"
            className="acc-btn acc-btn-outline acc-btn-sm"
            onClick={() => openFastModal("TRANSFER")}
          >
            ⇄ Transfer Funds
          </button>
          {subtab === "TRANSACTIONS" && (
            <a
              href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&type=TRANSACTIONS&format=csv`}
              download="transactions.csv"
              className="acc-btn acc-btn-outline acc-btn-sm"
            >
              Export CSV
            </a>
          )}
        </div>
      </div>

      {/* Secondary Navigation Segmented Control */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "TRANSACTIONS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("TRANSACTIONS")}
        >
          💳 All Transactions ({transactions.length})
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "BALANCES" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("BALANCES")}
        >
          🏦 Account Balances ({assetAccounts.length} Cash/Bank)
        </button>
      </div>

      {/* VIEW 1: All Transactions Ledger */}
      {subtab === "TRANSACTIONS" && (
        <div>
          {/* Filters Bar */}
          <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "220px" }}>
                <input
                  type="text"
                  className="acc-form-input"
                  placeholder="Search by description, contact, account, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {["ALL", "INCOME", "EXPENSE", "TRANSFER"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`acc-btn acc-btn-sm ${filterType === t ? "acc-btn-primary" : "acc-btn-outline"}`}
                    onClick={() => setFilterType(t)}
                  >
                    {t === "ALL" ? "All Types" : t === "INCOME" ? "+ Income" : t === "EXPENSE" ? "- Expense" : "⇄ Transfers"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="acc-card">
            {loading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                Loading transactions ledger...
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                No transactions match the selected filters.
              </div>
            ) : (
              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description / Contact</th>
                      <th>Category</th>
                      <th>Account</th>
                      <th className="acc-align-right">Amount</th>
                      {canMutate && <th className="acc-align-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} style={{ opacity: tx.status === "VOIDED" ? 0.5 : 1 }}>
                        <td style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                          {tx.date}
                        </td>
                        <td>
                          <span
                            className={`acc-badge ${
                              tx.type === "INCOME"
                                ? "acc-badge-success"
                                : tx.type === "EXPENSE"
                                ? "acc-badge-danger"
                                : "acc-badge-primary"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {tx.contact_name || tx.notes || "General Entry"}
                          </div>
                          {tx.notes && tx.contact_name && (
                            <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>
                              {tx.notes}
                            </div>
                          )}
                          {tx.status === "VOIDED" && (
                            <span className="acc-badge acc-badge-danger" style={{ marginTop: "0.2rem" }}>
                              VOIDED
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="acc-badge acc-badge-neutral">
                            {tx.category_name || "—"}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                          {tx.account_name || "—"}
                        </td>
                        <td
                          className="acc-align-right tabular-nums font-bold"
                          style={{
                            color:
                              tx.type === "INCOME"
                                ? "var(--acc-success)"
                                : tx.type === "EXPENSE"
                                ? "var(--acc-danger)"
                                : "var(--acc-text-main)",
                          }}
                        >
                          {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                          {formatMoney(tx.amount_minor, activeWorkspace?.currency)}
                        </td>
                        {canMutate && (
                          <td className="acc-align-right">
                            {tx.status === "POSTED" && (
                              <button
                                type="button"
                                className="acc-btn acc-btn-sm acc-btn-outline"
                                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                onClick={() => setVoidingId(tx.id)}
                              >
                                Void
                              </button>
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
        </div>
      )}

      {/* VIEW 2: Account Balances & Opening Balances */}
      {subtab === "BALANCES" && (
        <div>
          {/* Asset Accounts */}
          <div className="acc-card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                  Cash, Bank & UPI Accounts (Assets)
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  Liquid funds and active balances
                </span>
              </div>
              {canMutate && (
                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  onClick={() => setOpeningModalOpen(true)}
                >
                  Set Opening Balance
                </button>
              )}
            </div>

            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account Name</th>
                    <th>Subtype</th>
                    <th className="acc-align-right">Current Balance</th>
                    {canMutate && <th className="acc-align-right">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {assetAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{acc.code}</td>
                      <td style={{ fontWeight: 600 }}>{acc.name}</td>
                      <td>
                        <span className="acc-badge acc-badge-neutral">{acc.subtype}</span>
                      </td>
                      <td className="acc-align-right tabular-nums font-bold" style={{ fontSize: "0.9375rem" }}>
                        {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                      </td>
                      {canMutate && (
                        <td className="acc-align-right">
                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-outline"
                            style={{ padding: "0.2rem 0.5rem" }}
                            onClick={() => {
                              setSelectedAccountId(acc.id);
                              setOpeningBalanceStr((acc.current_balance_minor / 100).toString());
                              setOpeningModalOpen(true);
                            }}
                          >
                            Adjust Balance
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="acc-two-col-equal">
            <div className="acc-card">
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
                Liabilities & Payables
              </h3>
              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th className="acc-align-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liabilityAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--acc-text-muted)", padding: "1.5rem" }}>
                          No liability accounts.
                        </td>
                      </tr>
                    ) : (
                      liabilityAccounts.map((acc) => (
                        <tr key={acc.id}>
                          <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{acc.code}</td>
                          <td style={{ fontWeight: 600 }}>{acc.name}</td>
                          <td className="acc-align-right tabular-nums font-bold" style={{ color: "var(--acc-danger)" }}>
                            {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="acc-card">
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
                Equity & Retained Earnings
              </h3>
              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account Name</th>
                      <th className="acc-align-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equityAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--acc-text-muted)", padding: "1.5rem" }}>
                          No equity accounts.
                        </td>
                      </tr>
                    ) : (
                      equityAccounts.map((acc) => (
                        <tr key={acc.id}>
                          <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{acc.code}</td>
                          <td style={{ fontWeight: 600 }}>{acc.name}</td>
                          <td className="acc-align-right tabular-nums font-bold" style={{ color: "var(--acc-blue)" }}>
                            {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Opening Balance Modal */}
      {openingModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setOpeningModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Set Account Balance</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setOpeningModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSetOpeningBalance}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="opening-account-select">
                  Select Financial Account *
                </label>
                <select
                  id="opening-account-select"
                  className="acc-form-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                >
                  <option value="">Select an account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="opening-balance-input">
                  Balance Amount (₹) *
                </label>
                <input
                  id="opening-balance-input"
                  type="number"
                  step="0.01"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={openingBalanceStr}
                  onChange={(e) => setOpeningBalanceStr(e.target.value)}
                />
              </div>

              <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginTop: "0.5rem" }}>
                Setting an opening balance automatically posts a balanced double-entry journal against Owner Equity (Account 3000).
              </p>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setOpeningModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingOpening}
                >
                  {submittingOpening ? "Updating..." : "Save Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidingId && (
        <div className="acc-modal-backdrop" onClick={() => setVoidingId(null)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Void Transaction</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setVoidingId(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleVoid}>
              <p style={{ fontSize: "0.875rem", color: "var(--acc-text-main)", marginBottom: "1rem" }}>
                Voiding a transaction will create a balanced reversal entry in the general ledger. This action is permanently audited and cannot be undone.
              </p>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="void-reason">
                  Reason for Voiding *
                </label>
                <input
                  id="void-reason"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Duplicate entry, incorrect amount, cancelled cheque"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setVoidingId(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5, backgroundColor: "var(--acc-danger)" }}
                  disabled={submittingVoid}
                >
                  {submittingVoid ? "Voiding..." : "Confirm Void"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
