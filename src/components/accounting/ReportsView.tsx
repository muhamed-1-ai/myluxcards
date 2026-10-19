"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";

interface ReceivablesAging {
  totalOutstandingMinor: number;
  currentMinor: number;
  days1To30Minor: number;
  days31To60Minor: number;
  days61To90Minor: number;
  days90PlusMinor: number;
  invoices: Array<{
    id: string;
    invoice_number: string;
    contact_name?: string;
    due_date: string;
    amount_due_minor: number;
    days_overdue: number;
  }>;
}

interface CategorySpending {
  category_id: string;
  category_name: string;
  spent_minor: number;
  percentage: number;
}

export default function ReportsView() {
  const { activeWorkspace, formatMoney, refreshKey, canExport } = useAccounting();
  const [reportType, setReportType] = useState<"PROFIT_LOSS" | "CASH_FLOW" | "RECEIVABLES_AGING" | "EXPENSE_ANALYTICS">("PROFIT_LOSS");
  const [basis, setBasis] = useState<"ACCRUAL" | "CASH">("ACCRUAL");
  const [aging, setAging] = useState<ReceivablesAging | null>(null);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadReportData() {
      try {
        setLoading(true);
        if (reportType === "RECEIVABLES_AGING") {
          const res = await fetch(`/api/accounting/reports/receivables-aging?workspaceId=${activeWorkspace?.id}`);
          if (res.ok && isMounted) {
            const data = await res.json();
            setAging(data);
          }
        } else if (reportType === "EXPENSE_ANALYTICS") {
          const res = await fetch(`/api/accounting/reports/dashboard?workspaceId=${activeWorkspace?.id}&period=month`);
          if (res.ok && isMounted) {
            const data = await res.json();
            setCategorySpending(data.categorySpending || []);
          }
        }
      } catch (err) {
        console.error("Failed to load report data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReportData();
    return () => { isMounted = false; };
  }, [activeWorkspace, reportType, refreshKey]);

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Financial Reports</h2>
          <p className="acc-subtitle">Double-entry reconciled statements, cash flow, receivables aging, and expense analytics.</p>
        </div>

        <div className="acc-header-actions">
          {canExport && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <a
                href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&type=${reportType === "EXPENSE_ANALYTICS" ? "PROFIT_LOSS" : reportType}&format=csv`}
                download="report.csv"
                className="acc-btn acc-btn-outline acc-btn-sm"
              >
                Export CSV
              </a>
              <a
                href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&type=${reportType === "EXPENSE_ANALYTICS" ? "PROFIT_LOSS" : reportType}&format=xlsx`}
                download="report.xlsx"
                className="acc-btn acc-btn-primary acc-btn-sm"
              >
                Export Excel (.xlsx)
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${reportType === "PROFIT_LOSS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setReportType("PROFIT_LOSS")}
        >
          Income vs Expense (P&L)
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${reportType === "CASH_FLOW" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setReportType("CASH_FLOW")}
        >
          Cash Flow Statement
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${reportType === "RECEIVABLES_AGING" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setReportType("RECEIVABLES_AGING")}
        >
          Receivables Aging
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${reportType === "EXPENSE_ANALYTICS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setReportType("EXPENSE_ANALYTICS")}
        >
          Expense Analytics
        </button>
      </div>

      {/* Basis Selector for Profit & Loss */}
      {reportType === "PROFIT_LOSS" && (
        <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Accounting Method Basis:</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className={`acc-btn acc-btn-sm ${basis === "ACCRUAL" ? "acc-btn-primary" : "acc-btn-outline"}`}
                onClick={() => setBasis("ACCRUAL")}
              >
                Accrual (Earned / Incurred)
              </button>
              <button
                type="button"
                className={`acc-btn acc-btn-sm ${basis === "CASH" ? "acc-btn-primary" : "acc-btn-outline"}`}
                onClick={() => setBasis("CASH")}
              >
                Cash Basis (Actual Received / Paid)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Receivables Aging Report */}
      {reportType === "RECEIVABLES_AGING" && (
        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
            Receivables Aging Buckets
          </h3>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              Loading aging analysis...
            </div>
          ) : !aging || (aging.invoices || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              No overdue or pending receivables found. All invoices are settled!
            </div>
          ) : (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>Current (Not Due)</span>
                  <strong className="tabular-nums font-bold" style={{ fontSize: "1.125rem", color: "var(--acc-blue)" }}>
                    {formatMoney(aging.currentMinor || 0, activeWorkspace?.currency)}
                  </strong>
                </div>
                <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>1 - 30 Days</span>
                  <strong className="tabular-nums font-bold" style={{ fontSize: "1.125rem", color: "var(--acc-warning)" }}>
                    {formatMoney(aging.days1To30Minor || 0, activeWorkspace?.currency)}
                  </strong>
                </div>
                <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>31 - 60 Days</span>
                  <strong className="tabular-nums font-bold" style={{ fontSize: "1.125rem", color: "var(--acc-danger)" }}>
                    {formatMoney(aging.days31To60Minor || 0, activeWorkspace?.currency)}
                  </strong>
                </div>
                <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>61 - 90 Days</span>
                  <strong className="tabular-nums font-bold" style={{ fontSize: "1.125rem", color: "var(--acc-danger)" }}>
                    {formatMoney(aging.days61To90Minor || 0, activeWorkspace?.currency)}
                  </strong>
                </div>
                <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>90+ Days</span>
                  <strong className="tabular-nums font-bold" style={{ fontSize: "1.125rem", color: "var(--acc-danger)" }}>
                    {formatMoney(aging.days90PlusMinor || 0, activeWorkspace?.currency)}
                  </strong>
                </div>
              </div>

              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Due Date</th>
                      <th>Days Overdue</th>
                      <th className="acc-align-right">Amount Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aging.invoices || []).map((inv) => (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                        <td>{inv.contact_name || "—"}</td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{inv.due_date}</td>
                        <td>
                          <span className={`acc-badge ${inv.days_overdue > 30 ? "acc-badge-danger" : inv.days_overdue > 0 ? "acc-badge-warning" : "acc-badge-neutral"}`}>
                            {inv.days_overdue > 0 ? `${inv.days_overdue} days` : "Current"}
                          </span>
                        </td>
                        <td className="acc-align-right tabular-nums font-bold">
                          {formatMoney(inv.amount_due_minor, activeWorkspace?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Expense Analytics Report (Moved from Home) */}
      {reportType === "EXPENSE_ANALYTICS" && (
        <div className="acc-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                Expense Breakdown & Category Analytics
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                Detailed breakdown of operational disbursements by category
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              Loading analytics...
            </div>
          ) : categorySpending.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              No expenses recorded yet in this workspace.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {categorySpending.map((cat, idx) => {
                const colors = ["var(--acc-blue)", "var(--acc-warning)", "#8B5CF6", "#EC4899", "var(--acc-success)", "#14B8A6"];
                const color = colors[idx % colors.length];

                return (
                  <div key={cat.category_id || idx} style={{ padding: "0.75rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{cat.category_name}</span>
                      <span className="tabular-nums font-bold" style={{ fontSize: "0.9375rem" }}>
                        {formatMoney(cat.spent_minor, activeWorkspace?.currency)} ({cat.percentage}%)
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "8px", backgroundColor: "var(--acc-surface)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                          height: "100%",
                          backgroundColor: color,
                          borderRadius: "4px",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Income vs Expense (Profit & Loss) Statement */}
      {reportType === "PROFIT_LOSS" && (
        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
            Income & Expense Statement ({basis === "ACCRUAL" ? "Accrual Basis" : "Cash Basis"})
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1.25rem" }}>
            {basis === "ACCRUAL"
              ? "Accrual basis records revenue when earned (invoiced) and expenses when incurred (billed), regardless of cash movement timing."
              : "Cash basis records revenue only when money is deposited, and expenses only when money is disbursed."}
          </p>

          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Category / Account Code</th>
                  <th>Classification</th>
                  <th className="acc-align-right">Period Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Operating Revenue (Sales & Fees)</td>
                  <td><span className="acc-badge acc-badge-success">Income</span></td>
                  <td className="acc-align-right tabular-nums font-bold" style={{ color: "var(--acc-success)" }}>
                    Calculated from ledger
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Cost of Sales & Operating Expenses</td>
                  <td><span className="acc-badge acc-badge-danger">Expense</span></td>
                  <td className="acc-align-right tabular-nums font-bold" style={{ color: "var(--acc-danger)" }}>
                    Calculated from ledger
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "1.5rem", padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Download full double-entry audited report:</span>
            {canExport && (
              <a
                href={`/api/accounting/reports/export?workspaceId=${activeWorkspace?.id}&type=PROFIT_LOSS&format=xlsx`}
                download="profit_loss.xlsx"
                className="acc-btn acc-btn-sm acc-btn-primary"
              >
                Download Statement (.xlsx)
              </a>
            )}
          </div>
        </div>
      )}

      {/* 4. Cash Flow Statement */}
      {reportType === "CASH_FLOW" && (
        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
            Statement of Cash Flows
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1.25rem" }}>
            Summarizes liquid cash movements across operating, investing, and financing activities.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem" }}>Operating Cash Flows</h4>
              <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", margin: 0 }}>
                Cash received from sales collections minus cash paid for supplier bills and operational overhead.
              </p>
            </div>
            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem" }}>Financing & Loan Cash Flows</h4>
              <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", margin: 0 }}>
                Cash received from loan disbursements, principal repayments, and owner capital deposits.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
