"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";

interface Budget {
  id: string;
  category_id?: string;
  category_name?: string;
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
}

export default function BudgetsView() {
  const { activeWorkspace, formatMoney, categories, refreshKey, triggerRefresh, canMutate } = useAccounting();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const getDefaultMonth = (): string => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    return `${yr}-${mo}`;
  };

  const [budgetMonth, setBudgetMonth] = useState<string>(getDefaultMonth());
  const [categoryId, setCategoryId] = useState("");
  const [limitStr, setLimitStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;
    const wsId = activeWorkspace.id;
    let isMounted = true;

    async function loadBudgets() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting/budgets?workspaceId=${wsId}`, {
          headers: { "x-workspace-id": wsId },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setBudgets(data.budgets || []);
        }
      } catch (err) {
        console.error("Failed to load budgets:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBudgets();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedMonth = (budgetMonth || "").trim();
    if (!trimmedMonth || !/^\d{4}-\d{2}$/.test(trimmedMonth)) {
      setFormError("Please select a valid budget month (YYYY-MM).");
      return;
    }

    const limit = parseFloat(limitStr);
    if (!activeWorkspace || isNaN(limit) || limit <= 0) {
      setFormError("Please provide a valid budget limit greater than ₹0.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/budgets?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          categoryId: categoryId || undefined,
          amountMinor: Math.round(limit * 100),
          month: trimmedMonth,
          periodType: "MONTHLY",
        }),
      });

      const data = await res.json();
      if (res.ok && data.budget) {
        // Immediately update local state so budget appears without manual reload
        setBudgets((prev) => {
          const exists = prev.some((b) => b.id === data.budget.id);
          if (exists) {
            return prev.map((b) => (b.id === data.budget.id ? data.budget : b));
          }
          return [data.budget, ...prev];
        });

        setSuccessMessage(`Budget created successfully for ${trimmedMonth}.`);
        setAddModalOpen(false);
        setCategoryId("");
        setLimitStr("");
        setBudgetMonth(getDefaultMonth());
        setFormError(null);
        triggerRefresh();
      } else {
        setFormError(data.error || "Failed to create budget. Please review form inputs.");
      }
    } catch (err: any) {
      setFormError(err.message || "Network request failed. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE" && !c.is_archived);

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Budgets & Planning</h2>
          <p className="acc-subtitle">Set monthly category spending limits and track consumption.</p>
        </div>

        <div className="acc-header-actions">
          {canMutate && (
            <button
              type="button"
              className="acc-btn acc-btn-primary acc-btn-sm"
              onClick={() => {
                setFormError(null);
                setBudgetMonth(getDefaultMonth());
                setAddModalOpen(true);
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

      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading budgets...
          </div>
        ) : budgets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            <p style={{ margin: "0 0 1rem 0" }}>No active budgets set for this workspace. Click "+ Create Budget" to set spending targets.</p>
            {canMutate && (
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => {
                  setFormError(null);
                  setBudgetMonth(getDefaultMonth());
                  setAddModalOpen(true);
                }}
              >
                + Create First Budget
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
            {budgets.map((b) => (
              <div
                key={b.id}
                style={{
                  border: "1px solid var(--acc-border)",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  backgroundColor: "var(--acc-raised)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                      {b.category_name || "Overall Workspace Budget"}
                    </h4>
                    <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                      {b.period || b.period_type || "MONTHLY"} · {b.start_date || b.period_start} to {b.end_date || b.period_end}
                    </span>
                  </div>
                  {b.is_exceeded && (
                    <span className="acc-badge acc-badge-danger">Exceeded</span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                  <span style={{ color: "var(--acc-text-muted)" }}>Spent:</span>
                  <span className="tabular-nums font-semibold" style={{ color: b.is_exceeded ? "var(--acc-danger)" : "inherit" }}>
                    {formatMoney(b.spent_minor, activeWorkspace?.currency)} / {formatMoney(b.amount_minor, activeWorkspace?.currency)}
                  </span>
                </div>

                <div style={{ width: "100%", height: "8px", backgroundColor: "var(--acc-surface)", borderRadius: "4px", overflow: "hidden", marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      width: `${Math.min(100, b.percent_used || 0)}%`,
                      height: "100%",
                      backgroundColor: b.is_exceeded ? "var(--acc-danger)" : (b.percent_used || 0) > 80 ? "var(--acc-warning)" : "var(--acc-blue)",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  <span>{b.percent_used || 0}% used</span>
                  <span>
                    Remaining:{" "}
                    <strong className="tabular-nums" style={{ color: (b.remaining_minor || 0) < 0 ? "var(--acc-danger)" : "var(--acc-success)" }}>
                      {formatMoney(b.remaining_minor || 0, activeWorkspace?.currency)}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Budget Modal */}
      {addModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Create Monthly Budget</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setAddModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBudget}>
              {formError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {formError}
                </div>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="budget-month">Budget Month *</label>
                <input
                  id="budget-month"
                  type="month"
                  required
                  className="acc-form-input"
                  value={budgetMonth}
                  onChange={(e) => setBudgetMonth(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="budget-cat">Category (Optional - leave blank for Overall Workspace Budget)</label>
                <select
                  id="budget-cat"
                  className="acc-form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
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

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="budget-limit">
                  Monthly Limit ({activeWorkspace?.currency || "₹"}) *
                </label>
                <FormattedMoneyInput
                  id="budget-limit"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={limitStr}
                  onChange={(e) => setLimitStr(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
