"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";

interface Budget {
  id: string;
  category_id?: string;
  category_name?: string;
  period: string;
  start_date: string;
  end_date: string;
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

  const [categoryId, setCategoryId] = useState("");
  const [limitStr, setLimitStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadBudgets() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting/budgets?workspaceId=${activeWorkspace?.id}`);
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
    const limit = parseFloat(limitStr);
    if (!activeWorkspace || isNaN(limit) || limit <= 0) {
      alert("Please provide a valid budget limit.");
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const res = await fetch("/api/accounting/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          categoryId: categoryId || undefined,
          amountMinor: Math.round(limit * 100),
          startDate: start,
          endDate: end,
          period: "MONTHLY",
        }),
      });

      if (res.ok) {
        setAddModalOpen(false);
        setCategoryId("");
        setLimitStr("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create budget");
      }
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
              onClick={() => setAddModalOpen(true)}
            >
              + Create Budget
            </button>
          )}
        </div>
      </div>

      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading budgets...
          </div>
        ) : budgets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            No active budgets set for this month. Click "+ Create Budget" to set spending targets.
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
                      {b.period} · {b.start_date} to {b.end_date}
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
                      width: `${Math.min(100, b.percent_used)}%`,
                      height: "100%",
                      backgroundColor: b.is_exceeded ? "var(--acc-danger)" : b.percent_used > 80 ? "var(--acc-warning)" : "var(--acc-blue)",
                      borderRadius: "4px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  <span>{b.percent_used}% used</span>
                  <span>
                    Remaining:{" "}
                    <strong className="tabular-nums" style={{ color: b.remaining_minor < 0 ? "var(--acc-danger)" : "var(--acc-success)" }}>
                      {formatMoney(b.remaining_minor, activeWorkspace?.currency)}
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
              <button type="button" className="acc-modal-close" onClick={() => setAddModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateBudget}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="budget-cat">Category (Optional - leave blank for total limit)</label>
                <select
                  id="budget-cat"
                  className="acc-form-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">All Categories (Workspace Cap)</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="budget-limit">Monthly Limit (₹) *</label>
                <input
                  id="budget-limit"
                  type="number"
                  step="0.01"
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
