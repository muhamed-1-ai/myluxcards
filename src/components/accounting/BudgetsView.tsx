"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput, { stripCommas } from "../ui/FormattedMoneyInput";
import PaymentAccountPicker from "./PaymentAccountPicker";

interface Budget {
  id: string;
  name?: string | null;
  icon?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  period: string;
  period_type?: string;
  start_date: string;
  end_date: string;
  period_start?: string;
  period_end?: string;
  amount_minor: number;
  spent_minor: number;
  remaining_minor: number;
  percent_used: number;
  is_exceeded: boolean;
  transaction_count?: number;
}

interface BudgetTransaction {
  id: string;
  date: string;
  notes: string | null;
  amount_minor: number;
  category_name: string | null;
  account_name: string | null;
  status: string;
}

interface BudgetDetailData {
  budget: Budget;
  transactions: BudgetTransaction[];
}

const EMOJI_OPTIONS = ["🏠", "🛒", "🚗", "💻", "🍔", "✈️", "💼", "📈", "🎁", "🏥", "⚡", "🎓"];

export default function BudgetsView() {
  const {
    activeWorkspace,
    formatMoney,
    categories,
    accounts,
    refreshKey,
    triggerRefresh,
    canMutate,
  } = useAccounting();

  // Listing state
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>("");

  // Navigation / Detail view state
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<BudgetDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Default month generator
  const getDefaultMonth = (): string => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    return `${yr}-${mo}`;
  };

  // Create Form State
  const [createName, setCreateName] = useState("");
  const [createIcon, setCreateIcon] = useState("🏠");
  const [createMonth, setCreateMonth] = useState<string>(getDefaultMonth());
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createLimitStr, setCreateLimitStr] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  // Edit Form State
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("🏠");
  const [editLimitStr, setEditLimitStr] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Add Expense Inside Detail Form State
  const [expNotes, setExpNotes] = useState("");
  const [expAmountStr, setExpAmountStr] = useState("");
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expCategoryId, setExpCategoryId] = useState("");
  const [expAccountId, setExpAccountId] = useState("");
  const [expSubmitting, setExpSubmitting] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  // Voiding state
  const [voidingTxId, setVoidingTxId] = useState<string | null>(null);

  // Liquid accounts for payment dropdown
  const liquidAccounts = accounts.filter(
    (a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR", "UPI"].includes(a.subtype)
  );
  const availableAccounts = liquidAccounts.length > 0 ? liquidAccounts : accounts.filter((a) => a.type === "ASSET");

  // Load budgets listing
  const loadBudgets = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      const url = monthFilter
        ? `/api/accounting/budgets?workspaceId=${activeWorkspace.id}&month=${monthFilter}`
        : `/api/accounting/budgets?workspaceId=${activeWorkspace.id}`;
      const res = await fetch(url, {
        headers: { "x-workspace-id": activeWorkspace.id },
      });
      if (res.ok) {
        const data = await res.json();
        setBudgets(data.budgets || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || "Failed to load budgets");
      }
    } catch (err: any) {
      console.error("Failed to load budgets:", err);
      setErrorMessage(err.message || "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, monthFilter]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets, refreshKey]);

  // Load single budget details
  const loadBudgetDetails = useCallback(async (budgetId: string) => {
    if (!activeWorkspace) return;
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/accounting/budgets/${budgetId}?workspaceId=${activeWorkspace.id}`, {
        headers: { "x-workspace-id": activeWorkspace.id },
      });
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
        // Pre-fill expense category if budget is tied to a specific category
        if (data.budget?.category_id) {
          setExpCategoryId(data.budget.category_id);
        } else {
          setExpCategoryId("");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || "Failed to load budget details");
      }
    } catch (err: any) {
      console.error("Failed to load budget details:", err);
      setErrorMessage(err.message || "Network error loading budget details");
    } finally {
      setDetailLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (selectedBudgetId) {
      loadBudgetDetails(selectedBudgetId);
    } else {
      setDetailData(null);
    }
  }, [selectedBudgetId, loadBudgetDetails, refreshKey]);

  // Set default payment account
  useEffect(() => {
    if (availableAccounts.length > 0 && !expAccountId) {
      setExpAccountId(availableAccounts[0].id);
    }
  }, [availableAccounts, expAccountId]);

  // Handle Create Budget
  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFormError(null);

    const trimmedMonth = (createMonth || "").trim();
    if (!trimmedMonth || !/^\d{4}-\d{2}$/.test(trimmedMonth)) {
      setCreateFormError("Please select a valid budget month (YYYY-MM).");
      return;
    }

    const rawLimit = stripCommas(createLimitStr);
    const limit = parseFloat(rawLimit);
    if (!activeWorkspace || isNaN(limit) || limit <= 0) {
      setCreateFormError("Please provide a valid budget limit greater than ₹0.");
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/budgets?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: createName.trim() || undefined,
          icon: createIcon || "🏠",
          categoryId: createCategoryId || undefined,
          amountMinor: Math.round(limit * 100),
          month: trimmedMonth,
          periodType: "MONTHLY",
        }),
      });

      const data = await res.json();
      if (res.ok && data.budget) {
        setSuccessMessage(`Budget "${data.budget.name || data.budget.category_name || trimmedMonth}" created successfully.`);
        setCreateModalOpen(false);
        setCreateName("");
        setCreateIcon("🏠");
        setCreateLimitStr("");
        setCreateCategoryId("");
        setCreateMonth(getDefaultMonth());
        setCreateFormError(null);
        triggerRefresh();
        loadBudgets();
      } else {
        setCreateFormError(data.error || "Failed to create budget. Please review form inputs.");
      }
    } catch (err: any) {
      setCreateFormError(err.message || "Network request failed. Please check connection and try again.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = () => {
    if (!detailData?.budget) return;
    const b = detailData.budget;
    setEditName(b.name || "");
    setEditIcon(b.icon || "🏠");
    setEditLimitStr((b.amount_minor / 100).toString());
    setEditFormError(null);
    setEditModalOpen(true);
  };

  // Handle Update Budget
  const handleUpdateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBudgetId || !activeWorkspace) return;
    setEditFormError(null);

    const rawLimit = stripCommas(editLimitStr);
    const limit = parseFloat(rawLimit);
    if (isNaN(limit) || limit <= 0) {
      setEditFormError("Please enter a valid budget limit greater than ₹0.");
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/budgets/${selectedBudgetId}?workspaceId=${activeWorkspace.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          icon: editIcon || "🏠",
          amountMinor: Math.round(limit * 100),
        }),
      });

      const data = await res.json();
      if (res.ok && data.budget) {
        setSuccessMessage("Budget updated successfully.");
        setEditModalOpen(false);
        triggerRefresh();
        loadBudgetDetails(selectedBudgetId);
        loadBudgets();
      } else {
        setEditFormError(data.error || "Failed to update budget.");
      }
    } catch (err: any) {
      setEditFormError(err.message || "Network error updating budget.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Delete Budget
  const handleDeleteBudget = async () => {
    if (!selectedBudgetId || !activeWorkspace) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete this budget? Existing expense transactions will NOT be deleted or altered."
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/accounting/budgets/${selectedBudgetId}?workspaceId=${activeWorkspace.id}`, {
        method: "DELETE",
        headers: { "x-workspace-id": activeWorkspace.id },
      });
      if (res.ok) {
        setSuccessMessage("Budget deleted successfully.");
        setSelectedBudgetId(null);
        triggerRefresh();
        loadBudgets();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete budget.");
      }
    } catch (err: any) {
      alert(err.message || "Network error deleting budget.");
    }
  };

  // Handle Add Expense Inside Detail View
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !detailData?.budget) return;
    setExpError(null);

    const rawAmt = stripCommas(expAmountStr);
    const amt = parseFloat(rawAmt);
    if (isNaN(amt) || amt <= 0) {
      setExpError("Please enter a valid expense amount greater than ₹0.");
      return;
    }

    // Determine target category
    const catId = expCategoryId || detailData.budget.category_id;
    if (!catId) {
      setExpError("Please select an expense category.");
      return;
    }

    if (!expAccountId) {
      setExpError("Please select a payment account.");
      return;
    }

    setExpSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          type: "EXPENSE",
          amountMinor: Math.round(amt * 100),
          date: expDate,
          categoryId: catId,
          financialAccountId: expAccountId,
          notes: expNotes.trim() || undefined,
          isPaid: true,
          paymentStatus: "PAID",
        }),
      });

      const data = await res.json();
      if (res.ok && data.transaction) {
        setSuccessMessage("Expense recorded and budget updated.");
        setExpNotes("");
        setExpAmountStr("");
        triggerRefresh();
        loadBudgetDetails(detailData.budget.id);
        loadBudgets();
      } else {
        setExpError(data.error || "Failed to record expense.");
      }
    } catch (err: any) {
      setExpError(err.message || "Network error recording expense.");
    } finally {
      setExpSubmitting(false);
    }
  };

  // Handle Void Expense
  const handleVoidExpense = async (txId: string) => {
    if (!activeWorkspace || !selectedBudgetId) return;
    const confirmed = window.confirm(
      "Are you sure you want to void this expense? This creates an accounting reversal entry and restores the budget balance."
    );
    if (!confirmed) return;

    setVoidingTxId(txId);
    try {
      const res = await fetch(`/api/accounting/transactions/${txId}?workspaceId=${activeWorkspace.id}`, {
        method: "DELETE",
        headers: { "x-workspace-id": activeWorkspace.id },
      });

      if (res.ok) {
        setSuccessMessage("Expense voided and budget totals recalculated.");
        triggerRefresh();
        loadBudgetDetails(selectedBudgetId);
        loadBudgets();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to void expense.");
      }
    } catch (err: any) {
      alert(err.message || "Network error voiding expense.");
    } finally {
      setVoidingTxId(null);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE" && !c.is_archived);

  // =========================================================================
  // VIEW: BUDGET DETAIL
  // =========================================================================
  if (selectedBudgetId && detailData) {
    const b = detailData.budget;
    const progressClamped = Math.min(100, Math.max(0, b.percent_used || 0));
    const isExceeded = b.is_exceeded || (b.percent_used || 0) > 100;
    const isWarning = !isExceeded && (b.percent_used || 0) > 80;

    return (
      <div className="acc-detail-page">
        {/* Top Navigation & Actions Bar */}
        <div className="acc-detail-header">
          <div className="acc-detail-header-left">
            <button
              type="button"
              className="acc-back-btn"
              onClick={() => setSelectedBudgetId(null)}
              aria-label="Back to budgets list"
            >
              ← Back to Budgets
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>{b.icon || "📊"}</span>
              <h2 className="acc-title" style={{ fontSize: "1.375rem" }}>
                {b.name || b.category_name || "Workspace Budget"}
              </h2>
            </div>
          </div>

          {canMutate && (
            <div className="acc-header-actions">
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                onClick={openEditModal}
              >
                ✎ Edit Budget
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-danger acc-btn-sm"
                onClick={handleDeleteBudget}
              >
                ✕ Delete Budget
              </button>
            </div>
          )}
        </div>

        {/* Success / Error Messages */}
        {successMessage && (
          <div className="acc-alert acc-alert-success" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{successMessage}</span>
            <button type="button" onClick={() => setSuccessMessage(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}
        {errorMessage && (
          <div className="acc-alert acc-alert-danger" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Top 2-Column Grid: Summary Card (Left) & Add Expense Card (Right) */}
        <div className="acc-detail-top-grid">
          {/* Left: Summary Card */}
          <div className="acc-detail-summary-card">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div className="acc-budget-card-avatar">{b.icon || "📊"}</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                      {b.name || b.category_name || "Budget"}
                    </h3>
                    <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginTop: "0.25rem" }}>
                      {b.transaction_count ?? detailData.transactions.length} Item{(b.transaction_count ?? detailData.transactions.length) === 1 ? "" : "s"} · {b.category_name || "Overall Workspace"}
                    </div>
                  </div>
                </div>
                <div className="acc-budget-card-amount">
                  {formatMoney(b.amount_minor, activeWorkspace?.currency)}
                </div>
              </div>

              {/* Spend vs Remaining */}
              <div className="acc-budget-card-metrics" style={{ fontSize: "0.875rem", marginBottom: "0.625rem" }}>
                <span>
                  {formatMoney(b.spent_minor, activeWorkspace?.currency)} Spend
                </span>
                {b.remaining_minor < 0 ? (
                  <span style={{ color: "var(--acc-danger)", fontWeight: 700 }}>
                    {formatMoney(Math.abs(b.remaining_minor), activeWorkspace?.currency)} Overspent
                  </span>
                ) : (
                  <span>
                    {formatMoney(b.remaining_minor, activeWorkspace?.currency)} Remaining
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="acc-budget-card-bar-track" style={{ height: "10px", marginBottom: "1.25rem" }}>
                <div
                  className="acc-budget-card-bar-fill"
                  style={{
                    width: `${progressClamped}%`,
                    backgroundColor: isExceeded ? "var(--acc-danger)" : isWarning ? "var(--acc-warning)" : "var(--acc-blue)",
                  }}
                />
              </div>
            </div>

            {/* Scope & Period Metadata */}
                  <div className="acc-budget-scope-period">
                    <div className="acc-budget-meta-item">
                      <span className="acc-budget-meta-label">Budget Period</span>
                      <strong className="acc-budget-meta-val acc-nowrap">
                        {b.start_date || b.period_start} — {b.end_date || b.period_end}
                      </strong>
                    </div>
                        <div className="acc-budget-meta-item">
                          <span className="acc-budget-meta-label">Budget Scope</span>
                          <strong className="acc-budget-meta-val">
                            {b.category_name ? `${b.category_name} (Category)` : "Overall Workspace"}
                          </strong>
                        </div>
                    </div>
                  </div>

                  {/* Right: Add Expense Card */}
                  <div className="acc-detail-form-card">
                    <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", fontWeight: 700 }}>
                      Add Expense
                    </h3>

                    {expError && (
                      <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                        {expError}
                      </div>
                    )}

                    <form onSubmit={handleAddExpense}>
                      <div className="acc-form-group">
                        <label className="acc-form-label" htmlFor="exp-name">
                          Expense Description *
                        </label>
                        <input
                          id="exp-name"
                          type="text"
                          required
                          className="acc-form-input"
                          placeholder="e.g. Bedroom Decor, Software subscription"
                          value={expNotes}
                          onChange={(e) => setExpNotes(e.target.value)}
                        />
                      </div>

                        <div className="acc-form-responsive-grid">
                          <div className="acc-form-group">
                            <label className="acc-form-label" htmlFor="exp-amt">
                              Amount ({activeWorkspace?.currency || "₹"}) *
                            </label>
                            <FormattedMoneyInput
                              id="exp-amt"
                              required
                              className="acc-form-input tabular-nums"
                              placeholder="0.00"
                              value={expAmountStr}
                              onChange={(e) => setExpAmountStr(e.target.value)}
                            />
                          </div>

                          <div className="acc-form-group">
                            <label className="acc-form-label" htmlFor="exp-date">
                              Date *
                            </label>
                            <input
                              id="exp-date"
                              type="date"
                              required
                              className="acc-form-input acc-date-input"
                              value={expDate}
                              onChange={(e) => setExpDate(e.target.value)}
                            />
                          </div>
                        </div>

                          <div className="acc-form-responsive-grid">
                            <div className="acc-form-group">
                              <label className="acc-form-label" htmlFor="exp-cat">
                                Category *
                              </label>
                              <select
                                id="exp-cat"
                                className="acc-form-select"
                                required
                                value={expCategoryId}
                                onChange={(e) => setExpCategoryId(e.target.value)}
                              >
                                <option value="">Select Category</option>
                                {expenseCategories
                                  .filter((c) => !c.parent_id)
                                  .map((main) => {
                                    const subs = expenseCategories.filter((s) => s.parent_id === main.id);
                                    return (
                                      <React.Fragment key={main.id}>
                                        <option value={main.id} style={{ fontWeight: 600 }}>
                                          {main.name}
                                        </option>
                                        {subs.map((sub) => (
                                          <option key={sub.id} value={sub.id}>
                                            &nbsp;&nbsp;&nbsp;&nbsp;↳ {sub.name}
                                          </option>
                                        ))}
                                      </React.Fragment>
                                    );
                                  })}
                              </select>
                            </div>

                            <div className="acc-form-group">
                              <label className="acc-form-label" htmlFor="exp-account">
                                Payment Account *
                              </label>
                              <PaymentAccountPicker
                                id="exp-account"
                                required
                                value={expAccountId}
                                onChange={setExpAccountId}
                                accounts={availableAccounts}
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="acc-btn acc-btn-primary"
                            style={{ width: "100%", marginTop: "1.25rem", minHeight: "46px" }}
                            disabled={expSubmitting || !canMutate}
                          >
                            {expSubmitting ? "Recording..." : "Add New Expense"}
                          </button>
                        </form>
                      </div>
                  </div>

                  {/* Bottom Section: Latest Expenses */}
                  <div className="acc-detail-table-card">
                    <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.125rem", fontWeight: 700 }}>
                      Latest Expenses
                    </h3>

                    {detailLoading ? (
                      <div style={{ textAlign: "center", padding: "2rem", color: "var(--acc-text-muted)" }}>
                        Loading expenses...
                      </div>
                    ) : detailData.transactions.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--acc-text-muted)" }}>
                        <p style={{ margin: 0 }}>No expenses recorded under this budget period yet.</p>
                        <p style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                          Use the "Add Expense" form above to record an expense and track consumption.
                        </p>
                      </div>
                    ) : (
                      <div className="acc-table-wrapper">
                        <table className="acc-table">
                          <thead>
                            <tr>
                              <th>Name / Description</th>
                              <th className="acc-align-right">Amount</th>
                              <th>Date</th>
                              {canMutate && <th className="acc-align-right" style={{ width: "80px" }}>Action</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.transactions.map((tx) => (
                              <tr key={tx.id}>
                                <td style={{ fontWeight: 600 }}>
                                  <div>{tx.notes || tx.category_name || "Expense"}</div>
                                  {tx.category_name && tx.notes && (
                                    <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", fontWeight: 400 }}>
                                      {tx.category_name} {tx.account_name ? `· Paid via ${tx.account_name}` : ""}
                                    </div>
                                  )}
                                </td>
                                <td className="acc-align-right tabular-nums font-semibold" style={{ color: "var(--acc-danger)" }}>
                                  {formatMoney(tx.amount_minor, activeWorkspace?.currency)}
                                </td>
                                <td style={{ color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                                  {tx.date}
                                </td>
                                {canMutate && (
                                  <td className="acc-align-right">
                                    <button
                                      type="button"
                                      className="acc-btn acc-btn-sm"
                                      style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--acc-danger)",
                                        cursor: "pointer",
                                        padding: "0.25rem 0.5rem",
                                        fontSize: "1.1rem",
                                      }}
                                      title="Void expense (create reversal entry)"
                                      onClick={() => handleVoidExpense(tx.id)}
                                      disabled={voidingTxId === tx.id}
                                    >
                                      {voidingTxId === tx.id ? "…" : "🗑"}
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

                  {/* Edit Budget Modal */}
                  {editModalOpen && (
                    <div className="acc-modal-backdrop" onClick={() => setEditModalOpen(false)}>
                      <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="acc-modal-header">
                          <h3 className="acc-modal-title">Edit Budget</h3>
                          <button type="button" className="acc-modal-close" onClick={() => setEditModalOpen(false)}>
                            ✕
                          </button>
                        </div>

                        {editFormError && (
                          <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                            {editFormError}
                          </div>
                        )}

                        <form onSubmit={handleUpdateBudget}>
                          <div className="acc-form-group">
                            <label className="acc-form-label">Icon</label>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                              {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={`acc-emoji-btn ${editIcon === emoji ? "active" : ""}`}
                                  onClick={() => setEditIcon(emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="acc-form-group">
                            <label className="acc-form-label" htmlFor="edit-name">
                              Budget Name
                            </label>
                            <input
                              id="edit-name"
                              type="text"
                              className="acc-form-input"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                          </div>

                          <div className="acc-form-group">
                            <label className="acc-form-label" htmlFor="edit-limit">
                              Monthly Limit ({activeWorkspace?.currency || "₹"}) *
                            </label>
                            <FormattedMoneyInput
                              id="edit-limit"
                              required
                              className="acc-form-input tabular-nums"
                              placeholder="0.00"
                              value={editLimitStr}
                              onChange={(e) => setEditLimitStr(e.target.value)}
                            />
                          </div>

                          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                            <button
                              type="button"
                              className="acc-btn acc-btn-outline"
                              style={{ flex: 1 }}
                              onClick={() => setEditModalOpen(false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="acc-btn acc-btn-primary"
                              style={{ flex: 1.5 }}
                              disabled={editSubmitting}
                            >
                              {editSubmitting ? "Saving..." : "Save Changes"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
              </div>
              );
  }

              // =========================================================================
              // VIEW: BUDGET LISTING (MATCHING SCREENSHOT 1)
              // =========================================================================
              return (
              <div>
                <div className="acc-header">
                  <div className="acc-title-group">
                    <h2 className="acc-title">Budgets & Planning</h2>
                    <p className="acc-subtitle">Set monthly category spending limits and track consumption.</p>
                  </div>

                  <div className="acc-header-actions">
                    {/* Compact Month / Period Selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="month"
                        aria-label="Filter by month"
                        className="acc-form-input"
                        style={{ width: "auto", padding: "0.35rem 0.65rem", fontSize: "0.875rem" }}
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                      />
                      {monthFilter && (
                        <button
                          type="button"
                          className="acc-btn acc-btn-outline acc-btn-sm"
                          onClick={() => setMonthFilter("")}
                          title="Clear filter to show all budgets"
                        >
                          All
                        </button>
                      )}
                    </div>

                    {canMutate && (
                      <button
                        type="button"
                        className="acc-btn acc-btn-primary acc-btn-sm"
                        onClick={() => {
                          setCreateFormError(null);
                          setCreateMonth(getDefaultMonth());
                          setCreateModalOpen(true);
                        }}
                      >
                        + Create Budget
                      </button>
                    )}
                  </div>
                </div>

                {/* Success Notification Banner */}
                {successMessage && (
                  <div
                    className="acc-alert acc-alert-success"
                    style={{
                      marginBottom: "1.25rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{successMessage}</span>
                    <button
                      type="button"
                      onClick={() => setSuccessMessage(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                        lineHeight: 1,
                        padding: "0 0.25rem",
                      }}
                      aria-label="Dismiss message"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Error Notification Banner */}
                {errorMessage && (
                  <div
                    className="acc-alert acc-alert-danger"
                    style={{
                      marginBottom: "1.25rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{errorMessage}</span>
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                        lineHeight: 1,
                        padding: "0 0.25rem",
                      }}
                      aria-label="Dismiss message"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Main Responsive Grid */}
                {loading ? (
                  <div className="acc-card" style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                    Loading budgets...
                  </div>
                ) : (
                  <div className="acc-cards-grid">
                    {/* Dashed Create New Budget Tile (Screenshot 1 Reference - always visible) */}
                    {canMutate && (
                      <button
                        type="button"
                        className="acc-create-tile"
                        onClick={() => {
                          setCreateFormError(null);
                          setCreateMonth(getDefaultMonth());
                          setCreateModalOpen(true);
                        }}
                        aria-label="Create New Budget"
                      >
                        <span className="acc-create-tile-icon">+</span>
                        <span className="acc-create-tile-label">Create New Budget</span>
                      </button>
                    )}

                    {/* Budget Cards */}
                    {budgets.map((b) => {
                      const progressClamped = Math.min(100, Math.max(0, b.percent_used || 0));
                      const isExceeded = b.is_exceeded || (b.percent_used || 0) > 100;
                      const isWarning = !isExceeded && (b.percent_used || 0) > 80;

                      return (
                        <div
                          key={b.id}
                          className="acc-budget-card"
                          onClick={() => setSelectedBudgetId(b.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedBudgetId(b.id);
                            }
                          }}
                          aria-label={`View details for budget ${b.name || b.category_name || "Workspace Budget"}`}
                        >
                          {/* Header Row: Left (Avatar + Title + Item Count) | Right (Limit Amount) */}
                          <div className="acc-budget-card-header">
                            <div className="acc-budget-card-left">
                              <div className="acc-budget-card-avatar">{b.icon || "📊"}</div>
                              <div className="acc-budget-card-info">
                                <h4 className="acc-budget-card-title">
                                  {b.name || b.category_name || "Workspace Budget"}
                                </h4>
                                <span className="acc-budget-card-sub">
                                  {b.transaction_count ?? 0} Item{(b.transaction_count ?? 0) === 1 ? "" : "s"} · {b.category_name || "Overall Workspace"}
                                </span>
                              </div>
                            </div>

                            <div className="acc-budget-card-amount">
                              {formatMoney(b.amount_minor, activeWorkspace?.currency)}
                            </div>
                          </div>

                          {/* Metrics Row: Spent (Left) | Remaining or Overspent (Right) */}
                          <div>
                            <div className="acc-budget-card-metrics">
                              <span>
                                {formatMoney(b.spent_minor, activeWorkspace?.currency)} Spend
                              </span>
                              {b.remaining_minor < 0 ? (
                                <span style={{ color: "var(--acc-danger)", fontWeight: 700 }}>
                                  {formatMoney(Math.abs(b.remaining_minor), activeWorkspace?.currency)} Overspent
                                </span>
                              ) : (
                                <span>
                                  {formatMoney(b.remaining_minor, activeWorkspace?.currency)} Remaining
                                </span>
                              )}
                            </div>

                            {/* Visual Progress Bar (Clamped) */}
                            <div className="acc-budget-card-bar-track">
                              <div
                                className="acc-budget-card-bar-fill"
                                style={{
                                  width: `${progressClamped}%`,
                                  backgroundColor: isExceeded
                                    ? "var(--acc-danger)"
                                    : isWarning
                                      ? "var(--acc-warning)"
                                      : "var(--acc-blue)",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* =======================================================================
          MODAL: CREATE NEW BUDGET (MATCHING SCREENSHOT 2)
          ======================================================================= */}
                {createModalOpen && (
                  <div className="acc-modal-backdrop" onClick={() => setCreateModalOpen(false)}>
                    <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
                      <div className="acc-modal-header">
                        <h3 className="acc-modal-title">Create New Budget</h3>
                        <button
                          type="button"
                          className="acc-modal-close"
                          onClick={() => setCreateModalOpen(false)}
                          aria-label="Close dialog"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleCreateBudget}>
                        {createFormError && (
                          <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                            {createFormError}
                          </div>
                        )}

                        {/* Emoji / Icon Selector */}
                        <div className="acc-form-group">
                          <label className="acc-form-label">Icon</label>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {EMOJI_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className={`acc-emoji-btn ${createIcon === emoji ? "active" : ""}`}
                                onClick={() => setCreateIcon(emoji)}
                                aria-label={`Select icon ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Budget Name */}
                        <div className="acc-form-group">
                          <label className="acc-form-label" htmlFor="create-budget-name">
                            Budget Name *
                          </label>
                          <input
                            id="create-budget-name"
                            type="text"
                            required
                            className="acc-form-input"
                            placeholder="e.g. Home Decor, Marketing, Groceries"
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                          />
                        </div>

                        {/* Budget Amount with FormattedMoneyInput */}
                        <div className="acc-form-group">
                          <label className="acc-form-label" htmlFor="create-budget-amount">
                            Budget Amount ({activeWorkspace?.currency || "₹"}) *
                          </label>
                          <FormattedMoneyInput
                            id="create-budget-amount"
                            required
                            className="acc-form-input acc-amount-hero-input tabular-nums"
                            placeholder="e.g. 5000"
                            value={createLimitStr}
                            onChange={(e) => setCreateLimitStr(e.target.value)}
                          />
                        </div>

                        {/* Budget Month */}
                        <div className="acc-form-group">
                          <label className="acc-form-label" htmlFor="create-budget-month">
                            Budget Month *
                          </label>
                          <input
                            id="create-budget-month"
                            type="month"
                            required
                            className="acc-form-input"
                            value={createMonth}
                            onChange={(e) => setCreateMonth(e.target.value)}
                          />
                        </div>

                        {/* Scope / Category */}
                        <div className="acc-form-group">
                          <label className="acc-form-label" htmlFor="create-budget-category">
                            Expense Category (Optional - leave blank for Overall Workspace)
                          </label>
                          <select
                            id="create-budget-category"
                            className="acc-form-select"
                            value={createCategoryId}
                            onChange={(e) => setCreateCategoryId(e.target.value)}
                          >
                            <option value="">All Categories (Overall Workspace Budget)</option>
                            {expenseCategories
                              .filter((c) => !c.parent_id)
                              .map((main) => {
                                const subs = expenseCategories.filter((s) => s.parent_id === main.id);
                                return (
                                  <React.Fragment key={main.id}>
                                    <option value={main.id} style={{ fontWeight: 600 }}>
                                      {main.name} (Main Category)
                                    </option>
                                    {subs.map((sub) => (
                                      <option key={sub.id} value={sub.id}>
                                        &nbsp;&nbsp;&nbsp;&nbsp;↳ {sub.name}
                                      </option>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                          </select>
                        </div>

                        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                          <button
                            type="button"
                            className="acc-btn acc-btn-outline"
                            style={{ flex: 1 }}
                            onClick={() => setCreateModalOpen(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="acc-btn acc-btn-primary"
                            style={{ flex: 1.5 }}
                            disabled={createSubmitting}
                          >
                            {createSubmitting ? "Creating..." : "Create Budget"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
              );
}
