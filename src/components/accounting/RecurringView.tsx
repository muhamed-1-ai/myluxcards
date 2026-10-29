"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";
import PaymentAccountPicker from "./PaymentAccountPicker";

interface RecurringRule {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  amount_minor: number;
  frequency: string;
  next_run_date: string;
  category_name?: string;
  financial_account_name?: string;
  is_active: boolean;
}

export default function RecurringView() {
  const { activeWorkspace, formatMoney, accounts, categories, refreshKey, triggerRefresh, canMutate } = useAccounting();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [amountStr, setAmountStr] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [nextRunDate, setNextRunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadRules() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting/recurring?workspaceId=${activeWorkspace?.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setRules(data.rules || []);
        }
      } catch (err) {
        console.error("Failed to load recurring rules:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRules();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);
    if (!activeWorkspace || !name.trim() || isNaN(amt) || amt <= 0 || !accountId) {
      alert("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: name.trim(),
          type,
          amountMinor: Math.round(amt * 100),
          frequency,
          categoryId: categoryId || undefined,
          financialAccountId: accountId,
          nextRunDate,
        }),
      });

      if (res.ok) {
        setAddModalOpen(false);
        setName("");
        setAmountStr("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create recurring rule");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteRule = async (ruleId: string) => {
    if (!confirm("Confirm execution of this recurring transaction? This will post an official entry into the ledger.")) return;
    try {
      const res = await fetch(`/api/accounting/recurring/${ruleId}/execute`, { method: "POST" });
      if (res.ok) {
        alert("Transaction posted successfully!");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Execution failed");
      }
    } catch {
      alert("Network error");
    }
  };

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Recurring Items</h2>
          <p className="acc-subtitle">Scheduled bills, subscriptions, and recurring income with manual approval control.</p>
        </div>

        <div className="acc-header-actions">
          {canMutate && (
            <button
              type="button"
              className="acc-btn acc-btn-primary acc-btn-sm"
              onClick={() => setAddModalOpen(true)}
            >
              + Add Recurring Rule
            </button>
          )}
        </div>
      </div>

      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading recurring items...
          </div>
        ) : rules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            No recurring rules configured. Add repeating bills (rent, salary, utilities) or income subscriptions here.
          </div>
        ) : (
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Frequency</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th className="acc-align-right">Amount</th>
                  <th>Next Due</th>
                  {canMutate && <th className="acc-align-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>
                      <span className={`acc-badge ${r.type === "INCOME" ? "acc-badge-success" : "acc-badge-danger"}`}>
                        {r.type}
                      </span>
                    </td>
                    <td>{r.frequency}</td>
                    <td><span className="acc-badge acc-badge-neutral">{r.category_name || "—"}</span></td>
                    <td style={{ fontSize: "0.8125rem" }}>{r.financial_account_name || "—"}</td>
                    <td className="acc-align-right tabular-nums font-bold">
                      {formatMoney(r.amount_minor, activeWorkspace?.currency)}
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{r.next_run_date}</td>
                    {canMutate && (
                      <td className="acc-align-right">
                        <button
                          type="button"
                          className="acc-btn acc-btn-sm acc-btn-primary"
                          style={{ padding: "0.2rem 0.5rem" }}
                          onClick={() => handleExecuteRule(r.id)}
                          title="Execute and post to ledger"
                        >
                          Execute Now
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

      {/* Add Recurring Rule Modal */}
      {addModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">New Recurring Rule</h3>
              <button type="button" className="acc-modal-close" onClick={() => setAddModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRule}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="rec-name">Rule Description *</label>
                <input
                  id="rec-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Office Rent, Cloud Server Subscription, Retainer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="rec-type">Type</label>
                  <select
                    id="rec-type"
                    className="acc-form-select"
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                  >
                    <option value="EXPENSE">Expense (Money Out)</option>
                    <option value="INCOME">Income (Money In)</option>
                  </select>
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="rec-freq">Frequency</label>
                  <select
                    id="rec-freq"
                    className="acc-form-select"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="rec-amount">Amount (₹) *</label>
                <FormattedMoneyInput
                  id="rec-amount"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="rec-account">Payment Account *</label>
                <PaymentAccountPicker
                  id="rec-account"
                  value={accountId}
                  onChange={setAccountId}
                  placeholder="Select Bank or Cash account..."
                  accountFilter={(a) => Boolean(a.is_payment_account || (a.type === "ASSET" && ["CASH", "BANK"].includes(a.subtype)))}
                  required
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="rec-next-date">First / Next Execution Date</label>
                <input
                  id="rec-next-date"
                  type="date"
                  className="acc-form-input"
                  value={nextRunDate}
                  onChange={(e) => setNextRunDate(e.target.value)}
                  required
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
                  {submitting ? "Saving..." : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
