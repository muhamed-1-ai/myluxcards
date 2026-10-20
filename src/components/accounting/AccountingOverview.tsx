"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAccounting } from "./AccountingContext";

interface DashboardMetrics {
  period?: string;
  asOfDate: string;
  availableBalanceMinor: number;
  moneyReceivedMinor: number;
  moneyPaidMinor: number;
  owedToMeMinor: number;
  iOweMinor: number;
  earnedRevenueMinor?: number;
  earnedIncomeMinor?: number;
  incurredExpenseMinor: number;
  netSurplusMinor: number;
  recentTransactions: Array<{
    id: string;
    date: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amount_minor: number;
    category_name?: string;
    account_name?: string;
    contact_name?: string;
    notes?: string;
    status: string;
  }>;
  upcomingCommitments: Array<{
    id: string;
    title: string;
    due_date: string;
    amount_minor: number;
    type: string;
    is_overdue: boolean;
  }>;
  cashFlowTrend?: Array<{
    label: string;
    inflow_minor: number;
    outflow_minor: number;
  }>;
  monthlyTrend?: Array<{
    month: string;
    cashInMinor: number;
    cashOutMinor: number;
  }>;
}

export default function AccountingOverview({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const {
    activeWorkspace,
    workspaces,
    setActiveWorkspace,
    formatMoney,
    openFastModal,
    refreshKey,
  } = useAccounting();

  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("month");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Cache partitioned strictly by workspace ID and period to avoid state bleeding across workspaces
  const cacheRef = useRef<Map<string, { metrics: DashboardMetrics; timestamp: Date }>>(new Map());

  // Invalidate cache for the active workspace when global refresh is triggered (e.g., new transaction posted)
  useEffect(() => {
    if (refreshKey > 0 && activeWorkspace?.id) {
      for (const key of cacheRef.current.keys()) {
        if (key.startsWith(`${activeWorkspace.id}:`)) {
          cacheRef.current.delete(key);
        }
      }
    }
  }, [refreshKey, activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace) return;

    const cacheKey = `${activeWorkspace.id}:${period}`;
    const cached = cacheRef.current.get(cacheKey);

    // If cached data exists for this specific workspace and period, display it immediately
    if (cached) {
      setMetrics(cached.metrics);
      setLastUpdated(cached.timestamp);
      setLoading(false);
      setError("");
    } else {
      setMetrics(null);
      setLastUpdated(null);
      setLoading(true);
      setError("");
    }

    const controller = new AbortController();

    async function fetchDashboard() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          `/api/accounting/reports/dashboard?workspaceId=${activeWorkspace?.id}&period=${period}`,
          { signal: controller.signal }
        );

        if (res.ok) {
          const data: DashboardMetrics = await res.json();
          const now = new Date();
          cacheRef.current.set(cacheKey, { metrics: data, timestamp: now });
          setMetrics(data);
          setLastUpdated(now);
          setError("");
        } else {
          const errData = await res.json().catch(() => null);
          const errorMsg =
            errData?.message || "Failed to load dashboard metrics. Please try again.";
          setError(errorMsg);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();

    return () => {
      controller.abort();
    };
  }, [activeWorkspace?.id, period, refreshKey, retryTrigger]);

  const handleRetry = () => {
    setRetryTrigger((prev) => prev + 1);
  };

  if (!activeWorkspace) {
    return (
      <div className="acc-card" style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏢</div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>No Active Workspace</h3>
        <p style={{ color: "var(--acc-text-muted)", marginTop: "0.5rem" }}>
          Please select or configure an Accounting workspace to view financial records.
        </p>
      </div>
    );
  }

  const isBusiness = activeWorkspace.type === "BUSINESS";
  const profitLabel = isBusiness ? "Net Business Profit" : "Personal Surplus";

  const hasData = metrics !== null;
  const isStale = Boolean(error && hasData);
  const isUnavailable = Boolean(error && !hasData);
  const isLoadingInitial = Boolean(loading && !hasData);

  const earnedRevenue = metrics?.earnedRevenueMinor ?? metrics?.earnedIncomeMinor ?? 0;
  const incurredExpense = metrics?.incurredExpenseMinor ?? 0;
  const netSurplus = metrics?.netSurplusMinor ?? (earnedRevenue - incurredExpense);

  const trendBars =
    metrics?.cashFlowTrend ||
    (metrics?.monthlyTrend || []).map((m) => ({
      label: m.month,
      inflow_minor: m.cashInMinor,
      outflow_minor: m.cashOutMinor,
    }));

  return (
    <div>
      {/* 1. Straightforward Home Header with Period & Quick Actions */}
      <div className="acc-header">
        <div className="acc-title-group">
          <div className="acc-title-row">
            <h1 className="acc-title">Home</h1>
            <span className="acc-workspace-badge">
              {activeWorkspace.name} ({activeWorkspace.type === "BUSINESS" ? "Business" : "Personal"})
            </span>
          </div>
          <p className="acc-subtitle">Every Rupee, Clearly Managed for Your Business.</p>
        </div>

        <div className="acc-header-actions">
          {/* Workspace Switcher */}
          {workspaces.length > 1 && (
            <select
              className="acc-form-select"
              aria-label="Select Workspace"
              style={{ width: "auto", minHeight: "38px", fontSize: "0.8125rem", fontWeight: 500 }}
              value={activeWorkspace.id}
              onChange={(e) => {
                const found = workspaces.find((w) => w.id === e.target.value);
                if (found) setActiveWorkspace(found);
              }}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type})
                </option>
              ))}
            </select>
          )}

          {/* Period Filter */}
          <select
            className="acc-form-select"
            aria-label="Select Period"
            style={{ width: "auto", minHeight: "38px", fontSize: "0.8125rem", fontWeight: 500 }}
            value={period}
            onChange={(e) => setPeriod(e.target.value as "today" | "week" | "month" | "year")}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>

          {/* Primary everyday actions front and center */}
          <button
            type="button"
            className="acc-btn acc-btn-primary"
            onClick={() => openFastModal("INCOME")}
          >
            + Add Income / Sale
          </button>
          <button
            type="button"
            className="acc-btn acc-btn-outline"
            onClick={() => openFastModal("EXPENSE")}
          >
            - Add Expense
          </button>
          <button
            type="button"
            className="acc-btn acc-btn-outline"
            style={{ padding: "0.5rem 0.75rem" }}
            title="Transfer funds between accounts"
            onClick={() => openFastModal("TRANSFER")}
          >
            ⇄ Transfer
          </button>
        </div>
      </div>

      {/* Error / Offline Alert Banner */}
      {error && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.25rem",
            borderRadius: "8px",
            backgroundColor: "var(--acc-danger-soft)",
            color: "var(--acc-danger)",
            border: "1px solid var(--acc-danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.125rem" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600 }}>{error}</div>
              {isStale && lastUpdated && (
                <div style={{ fontSize: "0.75rem", opacity: 0.9, marginTop: "0.15rem" }}>
                  Displaying cached figures from {lastUpdated.toLocaleTimeString()}.
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="acc-btn acc-btn-sm acc-btn-outline"
            style={{ minHeight: "34px", padding: "0.25rem 0.75rem", borderColor: "currentColor" }}
            onClick={handleRetry}
            disabled={loading}
          >
            {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {/* 2. Available Balance Hero Card (Liquid Cash distinctly separated from Accrual Revenue) */}
      <div className="acc-hero-balance">
        <div>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--acc-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Available Liquid Balance
          </span>
          <div className="acc-hero-amount tabular-nums">
            {isLoadingInitial ? (
              <span style={{ opacity: 0.6 }}>…</span>
            ) : isUnavailable ? (
              <span style={{ fontSize: "1.625rem", color: "var(--acc-text-muted)", fontWeight: 600, letterSpacing: "normal" }}>
                Unavailable
              </span>
            ) : (
              formatMoney(metrics?.availableBalanceMinor ?? 0, activeWorkspace.currency)
            )}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
            {isUnavailable ? (
              "Liquid funds data could not be retrieved. Click Retry to reload."
            ) : isStale && lastUpdated ? (
              `⚠️ Showing cached balance as of ${lastUpdated.toLocaleTimeString()} · Click Retry to refresh`
            ) : (
              `Liquid funds in Cash, Bank & UPI settlement accounts ready to spend right now · As of ${metrics?.asOfDate || "Today"}`
            )}
          </span>
        </div>

        {/* Accrual revenue/expense strip: clearly separated from cash in hand */}
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>Earned Revenue</span>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-success)",
              }}
              className="tabular-nums"
            >
              {isLoadingInitial ? (
                "…"
              ) : isUnavailable ? (
                "Unavailable"
              ) : (
                formatMoney(earnedRevenue, activeWorkspace.currency)
              )}
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>Sales delivered</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>Incurred Expense</span>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-danger)",
              }}
              className="tabular-nums"
            >
              {isLoadingInitial ? (
                "…"
              ) : isUnavailable ? (
                "Unavailable"
              ) : (
                formatMoney(incurredExpense, activeWorkspace.currency)
              )}
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>Bills & costs</span>
          </div>
          <div style={{ textAlign: "right", borderLeft: "1px solid var(--acc-border)", paddingLeft: "1.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>{profitLabel}</span>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: isUnavailable
                  ? "var(--acc-text-muted)"
                  : netSurplus >= 0
                  ? "var(--acc-blue)"
                  : "var(--acc-danger)",
              }}
              className="tabular-nums"
            >
              {isLoadingInitial ? (
                "…"
              ) : isUnavailable ? (
                "Unavailable"
              ) : (
                formatMoney(netSurplus, activeWorkspace.currency)
              )}
            </div>
            <span style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>Period margin</span>
          </div>
        </div>
      </div>

      {/* 3. Four Core Metric Cards: Money Received, Money Paid, Owed to Me, I Owe */}
      <div className="acc-overview-grid">
        {/* Money Received */}
        <div className="acc-metric-card">
          <div className="acc-metric-top">
            <span className="acc-metric-label">Money Received</span>
            <div className="acc-metric-icon" style={{ backgroundColor: "var(--acc-success-soft)", color: "var(--acc-success)" }}>
              ↓
            </div>
          </div>
          <div
            className="acc-metric-val tabular-nums"
            style={{ color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-success)" }}
          >
            {isLoadingInitial ? (
              "…"
            ) : isUnavailable ? (
              <span style={{ fontSize: "1.125rem", fontWeight: 600 }}>Unavailable</span>
            ) : (
              formatMoney(metrics?.moneyReceivedMinor ?? 0, activeWorkspace.currency)
            )}
          </div>
          <span className="acc-metric-sub">Actual cash collected in selected period</span>
        </div>

        {/* Money Paid */}
        <div className="acc-metric-card">
          <div className="acc-metric-top">
            <span className="acc-metric-label">Money Paid</span>
            <div className="acc-metric-icon" style={{ backgroundColor: "var(--acc-danger-soft)", color: "var(--acc-danger)" }}>
              ↑
            </div>
          </div>
          <div
            className="acc-metric-val tabular-nums"
            style={{ color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-danger)" }}
          >
            {isLoadingInitial ? (
              "…"
            ) : isUnavailable ? (
              <span style={{ fontSize: "1.125rem", fontWeight: 600 }}>Unavailable</span>
            ) : (
              formatMoney(metrics?.moneyPaidMinor ?? 0, activeWorkspace.currency)
            )}
          </div>
          <span className="acc-metric-sub">Actual cash spent in selected period</span>
        </div>

        {/* Owed to Me */}
        <div className="acc-metric-card">
          <div className="acc-metric-top">
            <span className="acc-metric-label">Owed to Me</span>
            <div className="acc-metric-icon" style={{ backgroundColor: "var(--acc-blue-soft)", color: "var(--acc-blue)" }}>
              ⏳
            </div>
          </div>
          <div className="acc-metric-val tabular-nums">
            {isLoadingInitial ? (
              "…"
            ) : isUnavailable ? (
              <span style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--acc-text-muted)" }}>
                Unavailable
              </span>
            ) : (
              formatMoney(metrics?.owedToMeMinor ?? 0, activeWorkspace.currency)
            )}
          </div>
          <span className="acc-metric-sub">Customer credit & unpaid invoices</span>
        </div>

        {/* I Owe */}
        <div className="acc-metric-card">
          <div className="acc-metric-top">
            <span className="acc-metric-label">I Owe</span>
            <div className="acc-metric-icon" style={{ backgroundColor: "var(--acc-warning-soft)", color: "var(--acc-warning)" }}>
              🧾
            </div>
          </div>
          <div className="acc-metric-val tabular-nums">
            {isLoadingInitial ? (
              "…"
            ) : isUnavailable ? (
              <span style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--acc-text-muted)" }}>
                Unavailable
              </span>
            ) : (
              formatMoney(metrics?.iOweMinor ?? 0, activeWorkspace.currency)
            )}
          </div>
          <span className="acc-metric-sub">Pending supplier bills & loan obligations</span>
        </div>
      </div>

      {/* 4. One Clear Money-In / Money-Out Chart + Upcoming/Overdue Commitments */}
      <div className="acc-two-col">
        {/* Trend Visualization Card */}
        <div className="acc-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Money In vs Money Out Trend</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Recent monthly cash flow comparison</span>
            </div>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "var(--acc-success)" }} />
                Money In
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: "var(--acc-danger)" }} />
                Money Out
              </span>
            </div>
          </div>

          {/* SVG Bar Trend Chart */}
          <div style={{ height: "220px", display: "flex", alignItems: "flex-end", gap: "1rem", padding: "1rem 0" }}>
            {isLoadingInitial ? (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
                Loading cash flow trend…
              </div>
            ) : isUnavailable ? (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
                <span>⚠️ Cash flow trend unavailable</span>
                <button
                  type="button"
                  className="acc-btn acc-btn-sm acc-btn-outline"
                  style={{ minHeight: "30px", padding: "0.2rem 0.65rem", fontSize: "0.75rem" }}
                  onClick={handleRetry}
                >
                  Retry
                </button>
              </div>
            ) : trendBars.length === 0 ? (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
                No cash flow records yet in this period
              </div>
            ) : (
              trendBars.map((bar, idx) => {
                const maxVal = Math.max(
                  ...trendBars.flatMap((t) => [t.inflow_minor, t.outflow_minor]),
                  100000
                );
                const inHeight = Math.max(4, (bar.inflow_minor / maxVal) * 160);
                const outHeight = Math.max(4, (bar.outflow_minor / maxVal) * 160);

                return (
                  <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ display: "flex", gap: "4px", alignItems: "flex-end", height: "170px" }}>
                      <div
                        style={{
                          width: "16px",
                          height: `${inHeight}px`,
                          backgroundColor: "var(--acc-success)",
                          borderRadius: "3px 3px 0 0",
                          transition: "height 0.3s ease",
                        }}
                        title={`Money In: ₹${(bar.inflow_minor / 100).toFixed(2)}`}
                      />
                      <div
                        style={{
                          width: "16px",
                          height: `${outHeight}px`,
                          backgroundColor: "var(--acc-danger)",
                          borderRadius: "3px 3px 0 0",
                          transition: "height 0.3s ease",
                        }}
                        title={`Money Out: ₹${(bar.outflow_minor / 100).toFixed(2)}`}
                      />
                    </div>
                    <span style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)", marginTop: "0.5rem", whiteSpace: "nowrap" }}>
                      {bar.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Commitments & Overdue Payments */}
        <div className="acc-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
              Upcoming & Overdue Payments
            </h3>
            {onNavigateTab && (
              <button
                type="button"
                className="acc-btn acc-btn-sm acc-btn-outline"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                onClick={() => onNavigateTab("accounting-reminders")}
              >
                View Reminders →
              </button>
            )}
          </div>

          {isLoadingInitial ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
              Loading upcoming commitments…
            </div>
          ) : isUnavailable ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>⚠️</div>
              <strong style={{ color: "var(--acc-text-main)" }}>Commitments data unavailable</strong>
              <p style={{ fontSize: "0.75rem", margin: "0.25rem 0 0.75rem 0" }}>Could not load pending bills, customer invoices, or loan EMIs.</p>
              <button
                type="button"
                className="acc-btn acc-btn-sm acc-btn-outline"
                style={{ minHeight: "30px", padding: "0.2rem 0.65rem", fontSize: "0.75rem" }}
                onClick={handleRetry}
              >
                Retry
              </button>
            </div>
          ) : (metrics?.upcomingCommitments || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>✓</div>
              <strong>All payments are up to date!</strong>
              <p style={{ fontSize: "0.75rem", margin: "0.25rem 0 0 0" }}>No pending overdue bills, customer invoices, or loan EMIs.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(metrics?.upcomingCommitments || []).map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.875rem",
                    borderRadius: "8px",
                    backgroundColor: "var(--acc-raised)",
                    border: c.is_overdue ? "1px solid var(--acc-danger)" : "1px solid var(--acc-border)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--acc-text-main)" }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: c.is_overdue ? "var(--acc-danger)" : "var(--acc-text-muted)", fontWeight: c.is_overdue ? 700 : 400 }}>
                      {c.is_overdue ? `⚠️ OVERDUE (Due: ${c.due_date})` : `Due date: ${c.due_date}`}
                    </div>
                  </div>
                  <div className="tabular-nums font-bold" style={{ fontSize: "0.9375rem", color: c.is_overdue ? "var(--acc-danger)" : "inherit" }}>
                    {formatMoney(c.amount_minor, activeWorkspace.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Recent Transactions List */}
      <div className="acc-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
              Recent Transactions
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Latest cash movements and journal posts</span>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              className="acc-btn acc-btn-sm acc-btn-outline"
              onClick={() => onNavigateTab("accounting-transactions")}
            >
              View All Transactions →
            </button>
          )}
        </div>

        {isLoadingInitial ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
            Loading recent transactions…
          </div>
        ) : isUnavailable ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>⚠️</div>
            <strong style={{ color: "var(--acc-text-main)" }}>Transactions history unavailable</strong>
            <p style={{ fontSize: "0.75rem", margin: "0.25rem 0 0.75rem 0" }}>Could not load recent account movements and journal posts.</p>
            <button
              type="button"
              className="acc-btn acc-btn-sm acc-btn-outline"
              style={{ minHeight: "30px", padding: "0.2rem 0.65rem", fontSize: "0.75rem" }}
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        ) : (metrics?.recentTransactions || []).length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>💳</div>
            No transactions recorded yet in this workspace.
            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => openFastModal("INCOME")}
              >
                + Record Your First Transaction
              </button>
            </div>
          </div>
        ) : (
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description / Contact</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th className="acc-align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(metrics?.recentTransactions || []).slice(0, 5).map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                      {tx.date}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{tx.contact_name || tx.notes || "General Entry"}</div>
                      {tx.notes && tx.contact_name && (
                        <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>{tx.notes}</div>
                      )}
                    </td>
                    <td>
                      <span className="acc-badge acc-badge-neutral">{tx.category_name || tx.type}</span>
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                      {tx.account_name || "—"}
                    </td>
                    <td
                      className="acc-align-right tabular-nums"
                      style={{
                        fontWeight: 700,
                        color:
                          tx.type === "INCOME"
                            ? "var(--acc-success)"
                            : tx.type === "EXPENSE"
                            ? "var(--acc-danger)"
                            : "var(--acc-text-main)",
                      }}
                    >
                      {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                      {formatMoney(tx.amount_minor, activeWorkspace.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
