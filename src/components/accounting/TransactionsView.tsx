"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";

interface TransactionItem {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount_minor: number;
  date: string;
  notes?: string;
  contact_name?: string;
  category_id?: string | null;
  category_name?: string;
  parent_category_name?: string;
  account_name?: string;
  status: string;
  journal_entry_id?: string;
  voided_at?: string | null;
  voided_by?: string | null;
  voided_by_name?: string | null;
  restored_at?: string | null;
  restored_by?: string | null;
  restored_by_name?: string | null;
}

interface TransactionsViewProps {
  initialSubtab?: "TRANSACTIONS" | "BALANCES" | "VOIDED";
}

function formatVoidDate(dateVal?: Date | string | null): string {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal).slice(0, 10);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(dateVal).slice(0, 10);
  }
}

export default function TransactionsView({ initialSubtab = "TRANSACTIONS" }: TransactionsViewProps) {
  const {
    activeWorkspace,
    accounts,
    categories,
    formatMoney,
    openFastModal,
    refreshKey,
    triggerRefresh,
    canMutate,
  } = useAccounting();

  const [subtab, setSubtab] = useState<"TRANSACTIONS" | "BALANCES" | "VOIDED">(initialSubtab);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [voidedTransactions, setVoidedTransactions] = useState<TransactionItem[]>([]);
  const [voidedTotal, setVoidedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingVoided, setLoadingVoided] = useState(true);

  // Filters for All Transactions
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Filters for Voided
  const [voidedCategoryId, setVoidedCategoryId] = useState("");
  const [voidedSearchTerm, setVoidedSearchTerm] = useState("");

  // Toast / Feedback message banner
  const [feedbackToast, setFeedbackToast] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  // Edit Transaction state
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editMainCatId, setEditMainCatId] = useState("");
  const [editSubCatId, setEditSubCatId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Void modal state
  const [voidingTx, setVoidingTx] = useState<TransactionItem | null>(null);
  const [submittingVoid, setSubmittingVoid] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Restore modal state
  const [restoringTx, setRestoringTx] = useState<TransactionItem | null>(null);
  const [submittingRestore, setSubmittingRestore] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Opening Balance Modal State
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [openingBalanceStr, setOpeningBalanceStr] = useState("");
  const [submittingOpening, setSubmittingOpening] = useState(false);

  useEffect(() => {
    setSubtab(initialSubtab);
  }, [initialSubtab]);

  // Auto-dismiss feedback toast
  useEffect(() => {
    if (!feedbackToast) return;
    const timer = setTimeout(() => setFeedbackToast(null), 4000);
    return () => clearTimeout(timer);
  }, [feedbackToast]);

  // Accessible Escape key listener for open dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (voidingTx && !submittingVoid) setVoidingTx(null);
        if (restoringTx && !submittingRestore) setRestoringTx(null);
        if (editingTx && !submittingEdit) setEditingTx(null);
        if (openingModalOpen && !submittingOpening) setOpeningModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [voidingTx, submittingVoid, restoringTx, submittingRestore, editingTx, submittingEdit, openingModalOpen, submittingOpening]);

  // Load active transactions and voided expenses from server
  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setLoadingVoided(true);

        const [activeRes, voidedRes] = await Promise.all([
          fetch(`/api/accounting/transactions?workspaceId=${activeWorkspace?.id}&status=POSTED`),
          fetch(`/api/accounting/transactions?workspaceId=${activeWorkspace?.id}&status=VOIDED&type=EXPENSE`),
        ]);

        if (activeRes.ok) {
          const data = await activeRes.json();
          if (isMounted) {
            setTransactions(data.transactions || []);
            setActiveTotal(data.total ?? (data.transactions || []).length);
          }
        }

        if (voidedRes.ok) {
          const data = await voidedRes.json();
          if (isMounted) {
            setVoidedTransactions(data.transactions || []);
            setVoidedTotal(data.total ?? (data.transactions || []).length);
          }
        }
      } catch (err) {
        console.error("Failed to load transactions:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingVoided(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  // Void confirmation submit
  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingTx || submittingVoid) return;

    setSubmittingVoid(true);
    setVoidError(null);
    try {
      const res = await fetch(`/api/accounting/transactions/${voidingTx.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Voided by user" }),
      });
      if (res.ok) {
        const data = await res.json();
        // Remove from active transactions list and decrement total
        setTransactions((prev) => prev.filter((t) => t.id !== voidingTx.id));
        setActiveTotal((prev) => Math.max(0, prev - 1));

        // Add to voided transactions list and increment total
        if (data.transaction) {
          setVoidedTransactions((prev) => [data.transaction, ...prev]);
          setVoidedTotal((prev) => prev + 1);
        }

        setVoidingTx(null);
        setFeedbackToast({ type: "success", message: "Expense moved to Voided." });
        triggerRefresh();
      } else {
        const data = await res.json();
        setVoidError(data.error || "Failed to void expense.");
      }
    } catch {
      setVoidError("Network error voiding expense.");
    } finally {
      setSubmittingVoid(false);
    }
  };

  // Restore confirmation submit
  const handleConfirmRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoringTx || submittingRestore) return;

    setSubmittingRestore(true);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/accounting/transactions/${restoringTx.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Restored by user" }),
      });
      if (res.ok) {
        const data = await res.json();
        // Remove from voided list and decrement voided total
        setVoidedTransactions((prev) => prev.filter((t) => t.id !== restoringTx.id));
        setVoidedTotal((prev) => Math.max(0, prev - 1));

        // Add to active transactions list and increment total
        if (data.transaction) {
          setTransactions((prev) => [data.transaction, ...prev]);
          setActiveTotal((prev) => prev + 1);
        }

        setRestoringTx(null);
        setFeedbackToast({ type: "success", message: "Expense restored." });
        triggerRefresh();
      } else {
        const data = await res.json();
        setRestoreError(data.error || "Failed to restore expense.");
      }
    } catch {
      setRestoreError("Network error restoring expense.");
    } finally {
      setSubmittingRestore(false);
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

  const openEditTx = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditError(null);
    setEditDate(tx.date || new Date().toISOString().split("T")[0]);
    setEditNotes(tx.notes || "");

    const cat = categories.find((c) => c.id === tx.category_id);
    if (cat) {
      if (cat.parent_id) {
        setEditMainCatId(cat.parent_id);
        setEditSubCatId(cat.id);
      } else {
        setEditMainCatId(cat.id);
        setEditSubCatId("");
      }
    } else {
      setEditMainCatId("");
      setEditSubCatId("");
    }
  };

  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    setSubmittingEdit(true);
    setEditError(null);
    try {
      const targetCatId = editSubCatId || editMainCatId || null;
      const res = await fetch(`/api/accounting/transactions/${editingTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: targetCatId,
          date: editDate,
          notes: editNotes,
        }),
      });

      if (res.ok) {
        setEditingTx(null);
        triggerRefresh();
      } else {
        const data = await res.json();
        setEditError(data.error || "Failed to update transaction.");
      }
    } catch {
      setEditError("Network error updating transaction.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Filtered active transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (filterType !== "ALL" && tx.type !== filterType) return false;
    if (filterCategoryId) {
      const matchingCatIds = new Set<string>([filterCategoryId]);
      categories.forEach((c) => {
        if (c.parent_id === filterCategoryId) {
          matchingCatIds.add(c.id);
        }
      });
      if (!tx.category_id || !matchingCatIds.has(tx.category_id)) return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchNotes = (tx.notes || "").toLowerCase().includes(q);
      const matchContact = (tx.contact_name || "").toLowerCase().includes(q);
      const matchCat = (tx.category_name || "").toLowerCase().includes(q);
      const matchParentCat = (tx.parent_category_name || "").toLowerCase().includes(q);
      const matchAcc = (tx.account_name || "").toLowerCase().includes(q);
      if (!matchNotes && !matchContact && !matchCat && !matchParentCat && !matchAcc) return false;
    }
    return true;
  });

  // Filtered voided expenses
  const filteredVoided = voidedTransactions.filter((tx) => {
    if (voidedCategoryId) {
      const matchingCatIds = new Set<string>([voidedCategoryId]);
      categories.forEach((c) => {
        if (c.parent_id === voidedCategoryId) {
          matchingCatIds.add(c.id);
        }
      });
      if (!tx.category_id || !matchingCatIds.has(tx.category_id)) return false;
    }
    if (voidedSearchTerm) {
      const q = voidedSearchTerm.toLowerCase();
      const matchNotes = (tx.notes || "").toLowerCase().includes(q);
      const matchContact = (tx.contact_name || "").toLowerCase().includes(q);
      const matchCat = (tx.category_name || "").toLowerCase().includes(q);
      const matchParentCat = (tx.parent_category_name || "").toLowerCase().includes(q);
      const matchAcc = (tx.account_name || "").toLowerCase().includes(q);
      if (!matchNotes && !matchContact && !matchCat && !matchParentCat && !matchAcc) return false;
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
              href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&status=POSTED&format=csv`}
              download="transactions.csv"
              className="acc-btn acc-btn-outline acc-btn-sm"
            >
              Export CSV
            </a>
          )}
          {subtab === "VOIDED" && (
            <a
              href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&status=VOIDED&type=EXPENSE&format=csv`}
              download="voided_expenses.csv"
              className="acc-btn acc-btn-outline acc-btn-sm"
            >
              Export CSV
            </a>
          )}
        </div>
      </div>

      {/* Secondary Navigation Segmented Control: All Transactions, Account Balances, Voided */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "TRANSACTIONS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("TRANSACTIONS")}
        >
          💳 All Transactions ({activeTotal})
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "BALANCES" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("BALANCES")}
        >
          🏦 Account Balances ({assetAccounts.length} Cash/Bank)
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "VOIDED" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("VOIDED")}
        >
          🗑️ Voided ({voidedTotal})
        </button>
      </div>

      {/* Feedback Toast Notification Banner */}
      {feedbackToast && (
        <div
          className={`acc-alert ${feedbackToast.type === "danger" ? "acc-alert-danger" : "acc-alert-success"}`}
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
          role="status"
          aria-live="polite"
        >
          <span>{feedbackToast.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: All Transactions Ledger (Excludes voided expenses) */}
      {subtab === "TRANSACTIONS" && (
        <div>
          {/* Filters Bar */}
          <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <input
                  type="text"
                  className="acc-form-input"
                  placeholder="Search by description, contact, account, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ minWidth: "170px" }}>
                <select
                  className="acc-form-select"
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  style={{ height: "38px" }}
                >
                  <option value="">All Categories</option>
                  {categories
                    .filter((c) => !c.parent_id)
                    .map((main) => {
                      const subs = categories.filter((s) => s.parent_id === main.id);
                      return (
                        <React.Fragment key={main.id}>
                          <option value={main.id}>{main.name} ({main.type})</option>
                          {subs.map((sub) => (
                            <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name}</option>
                          ))}
                        </React.Fragment>
                      );
                    })}
                </select>
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
                      <tr key={tx.id}>
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
                        </td>
                        <td>
                          {tx.parent_category_name ? (
                            <span className="acc-badge acc-badge-neutral" title={`${tx.parent_category_name} → ${tx.category_name}`}>
                              <span style={{ opacity: 0.7 }}>{tx.parent_category_name} → </span>
                              <span style={{ fontWeight: 600 }}>{tx.category_name}</span>
                            </span>
                          ) : (
                            <span className="acc-badge acc-badge-neutral">
                              {tx.category_name || "—"}
                            </span>
                          )}
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
                          <td className="acc-align-right" style={{ whiteSpace: "nowrap" }}>
                            {tx.status === "POSTED" && (
                              <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-outline"
                                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                  onClick={() => openEditTx(tx)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-outline"
                                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", color: "var(--acc-danger)" }}
                                  onClick={() => {
                                    setVoidingTx(tx);
                                    setVoidError(null);
                                  }}
                                >
                                  Void
                                </button>
                              </div>
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
        <div className="acc-two-col-equal">
          {/* Asset Accounts */}
          <div className="acc-card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
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
                    <th className="acc-col-code" style={{ width: "70px", whiteSpace: "nowrap" }}>Code</th>
                    <th className="acc-col-name">Account Name</th>
                    <th style={{ width: "110px", whiteSpace: "nowrap" }}>Subtype</th>
                    <th className="acc-align-right acc-col-balance" style={{ width: "150px", whiteSpace: "nowrap" }}>Current Balance</th>
                    {canMutate && <th className="acc-align-right acc-col-action" style={{ width: "120px", whiteSpace: "nowrap" }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {assetAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="acc-col-code" style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--acc-text-muted)" }}>
                        {acc.code}
                      </td>
                      <td className="acc-col-name" style={{ fontWeight: 600, overflowWrap: "break-word" }}>
                        {acc.name}
                        {acc.description && (
                          <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)", fontWeight: "normal" }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="acc-badge acc-badge-neutral">{acc.subtype}</span>
                      </td>
                      <td className="acc-align-right tabular-nums font-bold acc-col-balance" style={{ color: Number(acc.current_balance_minor) >= 0 ? "var(--acc-text-main)" : "var(--acc-danger)" }}>
                        {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                      </td>
                      {canMutate && (
                        <td className="acc-align-right acc-col-action">
                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-outline"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => {
                              setSelectedAccountId(acc.id);
                              setOpeningBalanceStr((acc.current_balance_minor / 100).toString());
                              setOpeningModalOpen(true);
                            }}
                          >
                            Set Opening
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liability Accounts */}
          <div className="acc-card" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>
              Liabilities & Payables
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block", marginBottom: "1rem" }}>
              Payables to suppliers, loans, and financial obligations
            </span>

            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th className="acc-col-code" style={{ width: "70px", whiteSpace: "nowrap" }}>Code</th>
                    <th className="acc-col-name">Account Name</th>
                    <th style={{ width: "110px", whiteSpace: "nowrap" }}>Subtype</th>
                    <th className="acc-align-right acc-col-balance" style={{ width: "150px", whiteSpace: "nowrap" }}>Current Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {liabilityAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="acc-col-code" style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--acc-text-muted)" }}>
                        {acc.code}
                      </td>
                      <td className="acc-col-name" style={{ fontWeight: 600 }}>
                        {acc.name}
                        {acc.description && (
                          <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)", fontWeight: "normal" }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="acc-badge acc-badge-neutral">{acc.subtype}</span>
                      </td>
                      <td className="acc-align-right tabular-nums font-bold acc-col-balance" style={{ color: "var(--acc-warning)" }}>
                        {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equity Accounts */}
          <div className="acc-card">
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem 0" }}>
              Owner Equity & Capital
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block", marginBottom: "1rem" }}>
              Net capital investment and retained business earnings
            </span>

            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th className="acc-col-code" style={{ width: "70px", whiteSpace: "nowrap" }}>Code</th>
                    <th className="acc-col-name">Account Name</th>
                    <th style={{ width: "110px", whiteSpace: "nowrap" }}>Subtype</th>
                    <th className="acc-align-right acc-col-balance" style={{ width: "150px", whiteSpace: "nowrap" }}>Current Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {equityAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="acc-col-code" style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--acc-text-muted)" }}>
                        {acc.code}
                      </td>
                      <td className="acc-col-name" style={{ fontWeight: 600 }}>
                        {acc.name}
                        {acc.description && (
                          <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)", fontWeight: "normal" }}>
                            {acc.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="acc-badge acc-badge-neutral">{acc.subtype}</span>
                      </td>
                      <td className="acc-align-right tabular-nums font-bold acc-col-balance" style={{ color: "var(--acc-text-main)" }}>
                        {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Voided Expenses Section */}
      {subtab === "VOIDED" && (
        <div>
          <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
            Voided expenses are kept here for your records. Restore an expense to make it active again.
          </p>

          {/* Voided Filters Bar (Expenses-focused: no income/transfer options) */}
          <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <input
                  type="text"
                  className="acc-form-input"
                  placeholder="Search by description, contact, account, or category..."
                  value={voidedSearchTerm}
                  onChange={(e) => setVoidedSearchTerm(e.target.value)}
                />
              </div>
              <div style={{ minWidth: "170px" }}>
                <select
                  className="acc-form-select"
                  value={voidedCategoryId}
                  onChange={(e) => setVoidedCategoryId(e.target.value)}
                  style={{ height: "38px" }}
                >
                  <option value="">All Categories</option>
                  {categories
                    .filter((c) => !c.parent_id && c.type === "EXPENSE")
                    .map((main) => {
                      const subs = categories.filter((s) => s.parent_id === main.id);
                      return (
                        <React.Fragment key={main.id}>
                          <option value={main.id}>{main.name}</option>
                          {subs.map((sub) => (
                            <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name}</option>
                          ))}
                        </React.Fragment>
                      );
                    })}
                </select>
              </div>
            </div>
          </div>

          {/* Voided Expenses Table */}
          <div className="acc-card">
            {loadingVoided ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                Loading voided expenses...
              </div>
            ) : filteredVoided.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                No voided expenses
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
                    {filteredVoided.map((tx) => (
                      <tr key={tx.id} style={{ opacity: 1 }}>
                        <td style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                          {tx.date}
                        </td>
                        <td>
                          <span className="acc-badge acc-badge-danger">
                            EXPENSE
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--acc-text-main)" }}>
                            {tx.contact_name || tx.notes || "General Entry"}
                          </div>
                          {tx.notes && tx.contact_name && (
                            <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>
                              {tx.notes}
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                            <span className="acc-badge acc-badge-danger">
                              VOIDED
                            </span>
                            {(tx.voided_at || tx.voided_by_name) && (
                              <span style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>
                                Voided {formatVoidDate(tx.voided_at)}{tx.voided_by_name ? ` by ${tx.voided_by_name}` : ""}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {tx.parent_category_name ? (
                            <span className="acc-badge acc-badge-neutral" title={`${tx.parent_category_name} → ${tx.category_name}`}>
                              <span style={{ opacity: 0.7 }}>{tx.parent_category_name} → </span>
                              <span style={{ fontWeight: 600 }}>{tx.category_name}</span>
                            </span>
                          ) : (
                            <span className="acc-badge acc-badge-neutral">
                              {tx.category_name || "—"}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                          {tx.account_name || "—"}
                        </td>
                        <td
                          className="acc-align-right tabular-nums font-bold"
                          style={{ color: "var(--acc-danger)" }}
                        >
                          -{formatMoney(tx.amount_minor, activeWorkspace?.currency)}
                        </td>
                        {canMutate && (
                          <td className="acc-align-right" style={{ whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="acc-btn acc-btn-sm acc-btn-outline"
                              style={{ padding: "0.2rem 0.65rem", fontSize: "0.75rem", fontWeight: 600 }}
                              onClick={() => {
                                setRestoringTx(tx);
                                setRestoreError(null);
                              }}
                            >
                              Restore
                            </button>
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

      {/* Opening Balance Modal */}
      {openingModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setOpeningModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Set Account Opening Balance</h3>
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
                  required
                  className="acc-form-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="">-- Choose Account --</option>
                  {accounts
                    .filter((a) => a.is_active && (a.type === "ASSET" || a.type === "LIABILITY"))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({a.subtype})
                      </option>
                    ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="opening-balance-input">
                  Balance Amount (₹) *
                </label>
                <FormattedMoneyInput
                  id="opening-balance-input"
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

      {/* Void Expense Confirmation Modal */}
      {voidingTx && (
        <div
          className="acc-modal-backdrop"
          onClick={() => {
            if (!submittingVoid) setVoidingTx(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-expense-title"
        >
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="acc-modal-header">
              <h3 id="void-expense-title" className="acc-modal-title">
                Void this expense?
              </h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => {
                  if (!submittingVoid) setVoidingTx(null);
                }}
                disabled={submittingVoid}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmVoid}>
              {voidError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {voidError}
                </div>
              )}

              {/* Expense Context Card */}
              <div
                style={{
                  background: "var(--acc-raised)",
                  border: "1px solid var(--acc-border)",
                  borderRadius: "var(--acc-radius-md)",
                  padding: "0.875rem 1rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--acc-text-main)" }}>
                    {voidingTx.contact_name || voidingTx.notes || "General Entry"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--acc-danger)", fontVariantNumeric: "tabular-nums" }}>
                    -{formatMoney(voidingTx.amount_minor, activeWorkspace?.currency)}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {voidingTx.account_name && <span>Account: <strong>{voidingTx.account_name}</strong></span>}
                  {voidingTx.category_name && <span>Category: <strong>{voidingTx.category_name}</strong></span>}
                  <span>Date: <strong>{voidingTx.date}</strong></span>
                </div>
              </div>

              <p style={{ fontSize: "0.875rem", color: "var(--acc-text-main)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                This expense will leave All Transactions and appear in Voided. Its effect on your account balance and expense totals will be reversed. You can restore it later.
              </p>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={() => setVoidingTx(null)}
                  disabled={submittingVoid}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ backgroundColor: "var(--acc-danger)", borderColor: "var(--acc-danger)" }}
                  disabled={submittingVoid}
                >
                  {submittingVoid ? "Voiding..." : "Yes, void expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restore Expense Confirmation Modal */}
      {restoringTx && (
        <div
          className="acc-modal-backdrop"
          onClick={() => {
            if (!submittingRestore) setRestoringTx(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-expense-title"
        >
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="acc-modal-header">
              <h3 id="restore-expense-title" className="acc-modal-title">
                Restore this expense?
              </h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => {
                  if (!submittingRestore) setRestoringTx(null);
                }}
                disabled={submittingRestore}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmRestore}>
              {restoreError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {restoreError}
                </div>
              )}

              {/* Expense Context Card */}
              <div
                style={{
                  background: "var(--acc-raised)",
                  border: "1px solid var(--acc-border)",
                  borderRadius: "var(--acc-radius-md)",
                  padding: "0.875rem 1rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--acc-text-main)" }}>
                    {restoringTx.contact_name || restoringTx.notes || "General Entry"}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--acc-danger)", fontVariantNumeric: "tabular-nums" }}>
                    -{formatMoney(restoringTx.amount_minor, activeWorkspace?.currency)}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  {restoringTx.account_name && <span>Account: <strong>{restoringTx.account_name}</strong></span>}
                  {restoringTx.category_name && <span>Category: <strong>{restoringTx.category_name}</strong></span>}
                  <span>Date: <strong>{restoringTx.date}</strong></span>
                </div>
              </div>

              <p style={{ fontSize: "0.875rem", color: "var(--acc-text-main)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
                This expense will return to All Transactions and affect your account balance and expense totals again.
              </p>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={() => setRestoringTx(null)}
                  disabled={submittingRestore}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  disabled={submittingRestore}
                >
                  {submittingRestore ? "Restoring..." : "Yes, restore expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="acc-modal-backdrop" onClick={() => setEditingTx(null)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="acc-modal-header">
              <div>
                <h3 className="acc-modal-title">Edit Transaction</h3>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  {editingTx.type} • {formatMoney(editingTx.amount_minor, activeWorkspace?.currency)}
                </p>
              </div>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setEditingTx(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEditTx}>
              {editError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {editError}
                </div>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-tx-date">
                  Date *
                </label>
                <input
                  id="edit-tx-date"
                  type="date"
                  required
                  className="acc-form-input"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              {editingTx.type !== "TRANSFER" && (
                <>
                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="edit-main-cat">
                      Category (Main)
                    </label>
                    <select
                      id="edit-main-cat"
                      className="acc-form-select"
                      value={editMainCatId}
                      onChange={(e) => {
                        setEditMainCatId(e.target.value);
                        setEditSubCatId(""); // Clear subcategory when parent changes
                      }}
                    >
                      <option value="">No Category</option>
                      {categories
                        .filter((c) => !c.parent_id && !c.is_archived && c.type === editingTx.type)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {editMainCatId && (
                    <div className="acc-form-group">
                      <label className="acc-form-label" htmlFor="edit-sub-cat">
                        Subcategory (Optional)
                      </label>
                      <select
                        id="edit-sub-cat"
                        className="acc-form-select"
                        value={editSubCatId}
                        onChange={(e) => setEditSubCatId(e.target.value)}
                      >
                        <option value="">None (Keep under main category)</option>
                        {categories
                          .filter((c) => c.parent_id === editMainCatId && !c.is_archived)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              ↳ {c.name}
                            </option>
                          ))}
                      </select>
                      <small style={{ color: "var(--acc-text-muted)", fontSize: "0.6875rem", display: "block", marginTop: "0.25rem" }}>
                        Only children of the selected category are shown.
                      </small>
                    </div>
                  )}
                </>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-tx-notes">
                  Description / Notes
                </label>
                <input
                  id="edit-tx-notes"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. Office supplies purchase"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setEditingTx(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingEdit}
                >
                  {submittingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
