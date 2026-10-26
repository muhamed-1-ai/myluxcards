"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAccounting } from "./AccountingContext";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Clock,
  Receipt,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  BarChart3,
  Table as TableIcon,
  ChevronRight,
} from "lucide-react";
import "./accounting.css";

interface DashboardMetrics {
  period?: string;
  asOfDate: string;
  periodStart?: string;
  periodEnd?: string;
  availableBalanceMinor: number;
  liquidAccountsCount?: number;
  moneyReceivedMinor: number;
  moneyPaidMinor: number;
  owedToMeMinor: number;
  iOweMinor: number;
  earnedRevenueMinor?: number;
  earnedIncomeMinor?: number;
  incurredExpenseMinor: number;
  previousIncurredExpenseMinor?: number | null;
  expenseSparkline?: number[];
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
    sublabel?: string;
    date?: string;
    inflow_minor: number;
    outflow_minor: number;
    net_minor?: number;
  }>;
  monthlyTrend?: Array<{
    month: string;
    cashInMinor: number;
    cashOutMinor: number;
  }>;
}

// Compact currency formatter for chart axis ticks
function formatCompactAxis(minorUnits: number, currency = "INR"): string {
  const units = minorUnits / 100;
  const symbol =
    currency === "INR"
      ? "₹"
      : currency === "USD"
      ? "$"
      : currency === "EUR"
      ? "€"
      : currency === "GBP"
      ? "£"
      : `${currency} `;
  const abs = Math.abs(units);
  if (currency === "INR") {
    if (abs >= 10000000) {
      const v = units / 10000000;
      return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}Cr`;
    }
    if (abs >= 100000) {
      const v = units / 100000;
      return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}L`;
    }
    if (abs >= 1000) {
      const v = units / 1000;
      return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(0)}k`;
    }
    return `${symbol}${units.toFixed(0)}`;
  } else {
    if (abs >= 1000000000) {
      const v = units / 1000000000;
      return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}B`;
    }
    if (abs >= 1000000) {
      const v = units / 1000000;
      return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
    }
    if (abs >= 1000) {
      const v = units / 1000;
      return `${symbol}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(0)}k`;
    }
    return `${symbol}${units.toFixed(0)}`;
  }
}

// Extract clean 2-letter uppercase initials for contact avatars
function getInitials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Distinct avatar color palette matching reference design
const AVATAR_PALETTE = [
  { bg: "#1D4ED8", text: "#FFFFFF" }, // Royal Blue (e.g. Google)
  { bg: "#D97706", text: "#FFFFFF" }, // Warm Amber (e.g. AWS)
  { bg: "#7C3AED", text: "#FFFFFF" }, // Purple (e.g. Figma)
  { bg: "#262626", text: "#FFFFFF" }, // Neutral Charcoal (e.g. Vercel)
  { bg: "#059669", text: "#FFFFFF" }, // Emerald Green
];

// Clean parsing of commitment title into vendor/contact name, subtitle detail, and avatar initial
function parseCommitmentInfo(title: string): { name: string; subtitle: string; initial: string } {
  if (!title) return { name: "Obligation", subtitle: "", initial: "O" };

  // e.g. "Invoice INV-2026-0001 - Acme Client Ltd"
  const invMatch = title.match(/^Invoice\s+([^\s-]+)\s*-\s*(.+)$/i);
  if (invMatch) {
    const name = invMatch[2].trim();
    return { name, subtitle: `Invoice ${invMatch[1]}`, initial: name ? name[0].toUpperCase() : "I" };
  }

  // e.g. "Bill payable: ₹XX to Google Workspace"
  const billMatch = title.match(/^Bill payable(?::\s*[^to]+)?\s+to\s+(.+)$/i);
  if (billMatch) {
    const name = billMatch[1].trim();
    return { name, subtitle: "Bill payable", initial: name ? name[0].toUpperCase() : "B" };
  }

  // e.g. "Loan EMI - Lender"
  if (title.startsWith("Loan EMI - ") || title.startsWith("EMI: ")) {
    const name = title.replace(/^(?:Loan EMI - |EMI:\s*)/, "").trim();
    return { name, subtitle: "Loan EMI", initial: name ? name[0].toUpperCase() : "L" };
  }

  return { name: title, subtitle: "", initial: title[0].toUpperCase() };
}

// Chart point interface for shape-preserving monotone spline
interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Computes a shape-preserving monotone cubic spline path (Fritsch-Carlson algorithm).
 * Equivalent to d3.curveMonotoneX.
 * Guarantees:
 * 1. Passes through every actual data point.
 * 2. Monotone in each interval: never overshoots local extrema or dips into negative values.
 * 3. Preserves isolated spikes as crisp peaks without artificial ringing.
 */
function getMonotoneCubicPath(points: ChartPoint[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  if (n === 2) {
    return `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)},${points[1].y.toFixed(2)}`;
  }

  // Calculate secant slopes
  const dxs: number[] = [];
  const dys: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    slopes.push(dx === 0 ? 0 : dy / dx);
  }

  // Initialize tangents at data points
  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const sPrev = slopes[i - 1];
    const sNext = slopes[i];
    // If sign differs or either is zero, slope is an extremum -> must be 0 to avoid overshoot
    if (sPrev * sNext <= 0) {
      tangents[i] = 0;
    } else {
      // Weighted harmonic mean (Fritsch-Butland)
      const dxPrev = dxs[i - 1];
      const dxNext = dxs[i];
      const common = dxPrev + dxNext;
      tangents[i] = (3 * common) / ((common + dxNext) / sPrev + (common + dxPrev) / sNext);
      if (!isFinite(tangents[i])) {
        tangents[i] = (sPrev + sNext) / 2;
      }
    }
  }

  // Endpoint slope sign checks
  if (slopes[0] === 0 || tangents[0] * slopes[0] <= 0) {
    tangents[0] = 0;
  }
  if (slopes[n - 2] === 0 || tangents[n - 1] * slopes[n - 2] <= 0) {
    tangents[n - 1] = 0;
  }

  // Fritsch-Carlson monotonicity check: ensure (alpha, beta) inside the circle alpha^2 + beta^2 <= 9
  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i];
    if (s === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / s;
      const beta = tangents[i + 1] / s;
      const dist = alpha * alpha + beta * beta;
      if (dist > 9) {
        const tau = 3 / Math.sqrt(dist);
        tangents[i] = tau * alpha * s;
        tangents[i + 1] = tau * beta * s;
      }
    }
  }

  // Build SVG cubic Bezier path
  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = dxs[i];
    const cp1x = p0.x + dx / 3;
    const cp1y = p0.y + (tangents[i] * dx) / 3;
    const cp2x = p1.x - dx / 3;
    const cp2y = p1.y - (tangents[i + 1] * dx) / 3;

    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  }

  return path;
}

/**
 * Builds a closed SVG path for the area fill under a monotone cubic curve down to baseY
 */
function getMonotoneCubicAreaPath(points: ChartPoint[], baseY: number): string {
  if (points.length < 2) return "";
  const curvePath = getMonotoneCubicPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curvePath} L ${last.x.toFixed(2)},${baseY.toFixed(2)} L ${first.x.toFixed(2)},${baseY.toFixed(2)} Z`;
}

export default function AccountingOverview({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const {
    activeWorkspace,
    workspaces,
    setActiveWorkspace,
    formatMoney,
    openFastModal,
    refreshKey,
    accounts,
  } = useAccounting();

  const [period, setPeriod] = useState<"today" | "week" | "month" | "year">("month");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Cash-flow chart view: line chart or accessible data table
  const [chartViewMode, setChartViewMode] = useState<"chart" | "table">("chart");
  // Tooltip state for cash flow line chart
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Dynamic measured container width for unscaled 1:1 pixel rendering
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(680);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;

    const update = () => {
      if (el.clientWidth > 0) {
        setChartWidth(el.clientWidth);
      }
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          if (w > 0) setChartWidth(w);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
  }, [chartViewMode, metrics]);

  // Cache partitioned strictly by workspace ID and period to avoid cross-tenant bleeding
  const cacheRef = useRef<Map<string, { metrics: DashboardMetrics; timestamp: Date }>>(new Map());

  // Invalidate cache when financial transactions change
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
            errData?.message || "Failed to load financial records. Please try again.";
          setError(errorMsg);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Network error loading dashboard");
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
      <div className="acc-card acc-empty-compact" style={{ padding: "4rem 1.5rem" }}>
        <div
          className="acc-empty-icon-wrap"
          style={{ backgroundColor: "var(--acc-blue-soft)", color: "var(--acc-blue)" }}
        >
          <Building2 size={24} />
        </div>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>No Active Workspace</h3>
        <p style={{ color: "var(--acc-text-muted)", margin: 0, maxWidth: "420px", fontSize: "0.875rem" }}>
          Please select or configure an Accounting workspace to view financial records.
        </p>
      </div>
    );
  }

  const hasData = metrics !== null;
  const isStale = Boolean(error && hasData);
  const isUnavailable = Boolean(error && !hasData);
  const isLoadingInitial = Boolean(loading && !hasData);

  const periodLabelMap: Record<string, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
  };
  const activePeriodLabel = periodLabelMap[period] || "This Period";

  // Liquid cash accounts count from backend or accounting context
  const liquidCount =
    metrics?.liquidAccountsCount ??
    accounts.filter((a) => a.is_active && (a.subtype === "CASH" || a.subtype === "BANK" || a.subtype === "UPI")).length ??
    1;

  // Trend series for Cash Flow Chart
  const trendBars =
    metrics?.cashFlowTrend && metrics.cashFlowTrend.length > 0
      ? metrics.cashFlowTrend
      : (metrics?.monthlyTrend || []).map((m) => ({
          label: m.month,
          sublabel: undefined,
          date: undefined,
          inflow_minor: m.cashInMinor,
          outflow_minor: m.cashOutMinor,
          net_minor: m.cashInMinor - m.cashOutMinor,
        }));

  const hasCashActivity = trendBars.some(
    (b) => (b.inflow_minor || 0) > 0 || (b.outflow_minor || 0) > 0
  );

  const rawMaxVal = Math.max(
    ...trendBars.flatMap((t) => [t.inflow_minor || 0, t.outflow_minor || 0]),
    0
  );

  // Give 10% headroom above the peak so top markers are never clipped by the top border
  const maxSeriesVal = rawMaxVal > 0 ? Math.ceil((rawMaxVal * 1.1) / 1000) * 1000 : 0;

  return (
    <div>
      {/* 1. Header: Deliberate 2-tier header grouping controls and actions cleanly */}
      <div className="acc-header-v2">
        <div className="acc-header-top-tier">
          <div className="acc-title-group">
            <div className="acc-title-row">
              <h1 className="acc-title">Financial overview</h1>
            </div>
            <p className="acc-subtitle">Real-time cash flow, profit margins, and upcoming payments.</p>
          </div>

          <div className="acc-header-controls-group">
            {/* Workspace Switcher */}
            {workspaces.length > 1 ? (
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <select
                  className="acc-form-select"
                  aria-label="Accounting Workspace"
                  style={{
                    width: "auto",
                    minHeight: "36px",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    paddingRight: "2rem",
                  }}
                  value={activeWorkspace.id}
                  onChange={(e) => {
                    const found = workspaces.find((w) => w.id === e.target.value);
                    if (found) setActiveWorkspace(found);
                  }}
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type === "BUSINESS" ? "Business" : "Personal"})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div
                className="acc-badge-scope"
                style={{ minHeight: "36px", boxSizing: "border-box", padding: "0 0.875rem" }}
              >
                <Building2 size={14} />
                <span>
                  {activeWorkspace.name} ({activeWorkspace.type === "BUSINESS" ? "Business" : "Personal"})
                </span>
              </div>
            )}

            {/* Period Selector: Segmented Pill Control */}
            <div className="acc-period-pills" role="radiogroup" aria-label="Select Date Period">
              {(["today", "week", "month", "year"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  className={`acc-period-pill ${period === p ? "is-active" : ""}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="acc-header-actions-tier">
          {/* Action Buttons: Grouped firmly together so Transfer is never isolated */}
          <div className="acc-actions-btn-group">
            <button
              type="button"
              className="acc-btn acc-btn-primary acc-btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
              onClick={() => openFastModal("INCOME")}
            >
              <Plus size={15} />
              <span>Add Income / Sale</span>
            </button>
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
              onClick={() => openFastModal("EXPENSE")}
            >
              <Minus size={15} />
              <span>Add Expense</span>
            </button>
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
              title="Transfer funds between accounts"
              onClick={() => openFastModal("TRANSFER")}
            >
              <ArrowLeftRight size={15} />
              <span>Transfer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Offline / Error Banner */}
      {error && (
        <div
          style={{
            padding: "0.875rem 1.125rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--acc-radius-md)",
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <AlertTriangle size={18} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{error}</div>
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
            style={{
              minHeight: "32px",
              padding: "0.25rem 0.75rem",
              borderColor: "currentColor",
              color: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
            onClick={handleRetry}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Retrying…" : "Retry"}</span>
          </button>
        </div>
      )}

      {/* 2. ROW 1: Three Primary Cards (Available Balance, Money Received, Money Paid) */}
      <div className="acc-top-three-grid">
        {/* Card 1: Available Balance */}
        <div className="acc-primary-card acc-card-balance">
          <div>
            <div className="acc-card-header-row">
              <span className="acc-card-label">Available balance</span>
              <span className="acc-accounts-badge">
                <span className="acc-accounts-dot" />
                <span>{liquidCount} {liquidCount === 1 ? "account" : "accounts"}</span>
              </span>
            </div>

            <div className="acc-card-amount tabular-nums">
              {isLoadingInitial ? (
                <span style={{ opacity: 0.4 }}>…</span>
              ) : isUnavailable ? (
                <span style={{ fontSize: "1.5rem", color: "var(--acc-text-muted)" }}>Unavailable</span>
              ) : (
                formatMoney(metrics?.availableBalanceMinor ?? 0, activeWorkspace.currency)
              )}
            </div>
          </div>

          <div className="acc-card-footer-row">
            <span className="acc-card-sublabel">As of {metrics?.asOfDate || "Today"}</span>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab("accounting-accounts-transfers")}
                className="acc-card-action-link"
                title="View liquid account balances"
              >
                <span>Account balances</span>
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Money Received */}
        <div className="acc-primary-card">
          <div>
            <div className="acc-card-header-row">
              <span className="acc-card-label">Money received</span>
              <span className="acc-stat-pill acc-stat-inflow">
                <ArrowDownLeft size={13} />
                <span>Cash in</span>
              </span>
            </div>

            <div className="acc-card-amount tabular-nums" style={{ color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-text-main)" }}>
              {isLoadingInitial ? (
                <span style={{ opacity: 0.4 }}>…</span>
              ) : isUnavailable ? (
                <span style={{ fontSize: "1.5rem", color: "var(--acc-text-muted)" }}>Unavailable</span>
              ) : (
                formatMoney(metrics?.moneyReceivedMinor ?? 0, activeWorkspace.currency)
              )}
            </div>
          </div>

          <div className="acc-card-footer-row">
            <span className="acc-card-sublabel">
              Deposited in {activePeriodLabel.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Card 3: Money Paid */}
        <div className="acc-primary-card">
          <div>
            <div className="acc-card-header-row">
              <span className="acc-card-label">Money paid</span>
              <span className="acc-stat-pill acc-stat-outflow">
                <ArrowUpRight size={13} />
                <span>Cash out</span>
              </span>
            </div>

            <div className="acc-card-amount tabular-nums" style={{ color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-text-main)" }}>
              {isLoadingInitial ? (
                <span style={{ opacity: 0.4 }}>…</span>
              ) : isUnavailable ? (
                <span style={{ fontSize: "1.5rem", color: "var(--acc-text-muted)" }}>Unavailable</span>
              ) : (
                formatMoney(metrics?.moneyPaidMinor ?? 0, activeWorkspace.currency)
              )}
            </div>
          </div>

          <div className="acc-card-footer-row">
            <span className="acc-card-sublabel">
              Disbursed in {activePeriodLabel.toLowerCase()}
            </span>
          </div>
        </div>
      </div>

      {/* 3. ROW 2: Two Compact Outstanding-Money Cards (Owed to Me, I Owe - Height ~100-120px) */}
      <div className="acc-outstanding-grid">
        {/* Owed to Me */}
        <div className="acc-compact-card">
          <div className="acc-card-header-row">
            <span className="acc-card-label">Owed to me</span>
            <Clock size={14} style={{ color: "#2583FF" }} />
          </div>

          <div className="acc-compact-amount tabular-nums" style={{ color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-text-main)" }}>
            {isLoadingInitial ? (
              <span style={{ opacity: 0.4 }}>…</span>
            ) : isUnavailable ? (
              <span style={{ fontSize: "1.25rem", color: "var(--acc-text-muted)" }}>Unavailable</span>
            ) : (
              formatMoney(metrics?.owedToMeMinor ?? 0, activeWorkspace.currency)
            )}
          </div>

          <div className="acc-card-footer-row" style={{ paddingTop: "0.5rem" }}>
            <span className="acc-card-sublabel">
              As of {metrics?.asOfDate || "Today"} · Outstanding customer receivables
            </span>
          </div>
        </div>

        {/* I Owe */}
        <div className="acc-compact-card">
          <div className="acc-card-header-row">
            <span className="acc-card-label">I owe</span>
            <Receipt size={14} style={{ color: "#F59E0B" }} />
          </div>

          <div className="acc-compact-amount tabular-nums" style={{ color: isUnavailable ? "var(--acc-text-muted)" : "var(--acc-text-main)" }}>
            {isLoadingInitial ? (
              <span style={{ opacity: 0.4 }}>…</span>
            ) : isUnavailable ? (
              <span style={{ fontSize: "1.25rem", color: "var(--acc-text-muted)" }}>Unavailable</span>
            ) : (
              formatMoney(metrics?.iOweMinor ?? 0, activeWorkspace.currency)
            )}
          </div>

          <div className="acc-card-footer-row" style={{ paddingTop: "0.5rem" }}>
            <span className="acc-card-sublabel">
              As of {metrics?.asOfDate || "Today"} · Outstanding bills and obligations
            </span>
          </div>
        </div>
      </div>

      {/* 4. MAIN ROW: Cash-Flow Line Chart (~2/3) and Upcoming Payments (~1/3) */}
      <div className="acc-main-split">
        {/* Left: Cash Flow Chart Card */}
        <div className="acc-card acc-chart-card">
          <div className="acc-chart-header">
            <div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0 }}>Cash flow</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                {period === "today"
                  ? "Cash movements for today"
                  : period === "week"
                  ? "Daily cash movements for this week (7 days)"
                  : period === "month"
                  ? `Daily cash movements for ${activePeriodLabel.toLowerCase()} (Days 1–${trendBars.length})`
                  : period === "year"
                  ? `Monthly cash movements for ${activePeriodLabel.toLowerCase()}`
                  : `Cash movements for ${activePeriodLabel.toLowerCase()}`}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              {/* Dual-line Legend */}
              <div className="acc-chart-legend">
                <span className="acc-chart-legend-item">
                  <span
                    style={{
                      width: "16px",
                      height: "3px",
                      backgroundColor: "#2583FF",
                      display: "inline-block",
                      borderRadius: "2px",
                    }}
                  />
                  <span>Money In</span>
                </span>
                <span className="acc-chart-legend-item">
                  <span
                    style={{
                      width: "16px",
                      height: "0px",
                      borderTop: "2px dashed var(--acc-text-muted, #A3A3A3)",
                      display: "inline-block",
                    }}
                  />
                  <span>Money Out</span>
                </span>
              </div>

              {/* Data Table / Line Chart Switcher */}
              <button
                type="button"
                className="acc-btn acc-btn-sm acc-btn-outline"
                style={{
                  minHeight: "28px",
                  padding: "0.2rem 0.6rem",
                  fontSize: "0.75rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
                onClick={() => setChartViewMode(chartViewMode === "chart" ? "table" : "chart")}
                title={chartViewMode === "chart" ? "View accessible data table" : "View line chart"}
              >
                {chartViewMode === "chart" ? (
                  <>
                    <TableIcon size={12} />
                    <span>Table</span>
                  </>
                ) : (
                  <>
                    <BarChart3 size={12} />
                    <span>Chart</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SVG Dual-Line Chart or Accessible Table View */}
          {isLoadingInitial ? (
            <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
              Loading cash flow data…
            </div>
          ) : isUnavailable ? (
            <div style={{ height: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
              <AlertTriangle size={24} style={{ color: "var(--acc-danger)" }} />
              <span style={{ fontWeight: 600 }}>Cash flow data unavailable</span>
              <button
                type="button"
                className="acc-btn acc-btn-sm acc-btn-outline"
                style={{ minHeight: "28px", padding: "0.2rem 0.75rem", fontSize: "0.75rem" }}
                onClick={handleRetry}
              >
                Retry
              </button>
            </div>
          ) : !hasCashActivity && chartViewMode === "chart" ? (
            <div className="acc-chart-empty-compact">
              <div className="acc-chart-empty-icon-pill">
                <BarChart3 size={20} />
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--acc-text-main)" }}>
                {period === "today"
                  ? "No cash activity today"
                  : period === "week"
                  ? "No cash activity this week"
                  : period === "month"
                  ? "No cash activity this month"
                  : period === "year"
                  ? "No cash activity this year"
                  : `No cash activity for ${activePeriodLabel.toLowerCase()}`}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", maxWidth: "320px", textAlign: "center", lineHeight: 1.4 }}>
                Recorded receipts and payments will appear here.
              </div>
            </div>
          ) : chartViewMode === "table" ? (
            <div className="acc-table-wrapper" style={{ maxHeight: "250px" }}>
              <table className="acc-table" aria-label="Cash Flow Data Table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="acc-align-right">Money In</th>
                    <th className="acc-align-right">Money Out</th>
                    <th className="acc-align-right">Net Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {trendBars.map((bar, idx) => {
                    const net = bar.inflow_minor - bar.outflow_minor;
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>
                          <div>{bar.label}</div>
                          {bar.sublabel && (
                            <span style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>
                              {bar.sublabel}
                            </span>
                          )}
                        </td>
                        <td className="acc-align-right tabular-nums" style={{ color: "var(--acc-success)", fontWeight: 600 }}>
                          {formatMoney(bar.inflow_minor, activeWorkspace.currency)}
                        </td>
                        <td className="acc-align-right tabular-nums" style={{ color: "var(--acc-danger)", fontWeight: 600 }}>
                          {formatMoney(bar.outflow_minor, activeWorkspace.currency)}
                        </td>
                        <td
                          className="acc-align-right tabular-nums"
                          style={{
                            fontWeight: 700,
                            color: net >= 0 ? "var(--acc-text-main)" : "var(--acc-danger)",
                          }}
                        >
                          {net >= 0 ? "+" : ""}
                          {formatMoney(net, activeWorkspace.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div ref={chartWrapRef} className="acc-chart-svg-wrap" onMouseLeave={() => setHoveredPointIndex(null)}>
              {/* Tooltip Overlay */}
              {hoveredPointIndex !== null && trendBars[hoveredPointIndex] && tooltipPos && (
                <div
                  className="acc-chart-tooltip"
                  style={{
                    left: `${tooltipPos.x}px`,
                    top: `${tooltipPos.y}px`,
                  }}
                  role="tooltip"
                >
                  <div style={{ fontWeight: 700, fontSize: "0.75rem", marginBottom: "0.3rem", color: "var(--acc-text-main)" }}>
                    {trendBars[hoveredPointIndex].sublabel || trendBars[hoveredPointIndex].label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.25rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--acc-text-muted)" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2583FF", display: "inline-block" }} />
                        <span>Money In:</span>
                      </span>
                      <strong className="tabular-nums" style={{ color: "#2583FF" }}>
                        {formatMoney(trendBars[hoveredPointIndex].inflow_minor, activeWorkspace.currency)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.25rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--acc-text-muted)" }}>
                        <span style={{ width: "8px", height: "2px", borderTop: "2px dashed var(--acc-text-muted, #A3A3A3)", display: "inline-block" }} />
                        <span>Money Out:</span>
                      </span>
                      <strong className="tabular-nums" style={{ color: "var(--acc-text-muted, #A3A3A3)" }}>
                        {formatMoney(trendBars[hoveredPointIndex].outflow_minor, activeWorkspace.currency)}
                      </strong>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1.25rem",
                        paddingTop: "0.3rem",
                        borderTop: "1px solid var(--acc-border)",
                      }}
                    >
                      <span style={{ color: "var(--acc-text-muted)", fontWeight: 500 }}>Net Flow:</span>
                      <strong
                        className="tabular-nums"
                        style={{
                          color:
                            trendBars[hoveredPointIndex].inflow_minor >= trendBars[hoveredPointIndex].outflow_minor
                              ? "var(--acc-text-main)"
                              : "var(--acc-danger)",
                        }}
                      >
                        {trendBars[hoveredPointIndex].inflow_minor >= trendBars[hoveredPointIndex].outflow_minor ? "+" : ""}
                        {formatMoney(
                          trendBars[hoveredPointIndex].inflow_minor - trendBars[hoveredPointIndex].outflow_minor,
                          activeWorkspace.currency
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Dual-Line SVG Chart with Monotone Cubic Spline Curves & Gradient Area */}
              {(() => {
                const svgWidth = chartWidth > 0 ? chartWidth : 680;
                const svgHeight = 250;
                const padLeft = 58;
                const padRight = 20;
                const padTop = 18;
                const padBottom = 28;

                const plotWidth = Math.max(10, svgWidth - padLeft - padRight);
                const plotHeight = Math.max(10, svgHeight - padTop - padBottom);
                const baseY = padTop + plotHeight;

                const numPoints = trendBars.length;
                const scaleVal = maxSeriesVal > 0 ? maxSeriesVal : 1;

                // Compute exact data coordinates
                const points = trendBars.map((bar, idx) => {
                  let x = padLeft + plotWidth / 2;
                  if (numPoints > 1) {
                    x = padLeft + (idx / (numPoints - 1)) * plotWidth;
                  }
                  const inY = padTop + plotHeight - (bar.inflow_minor / scaleVal) * plotHeight;
                  const outY = padTop + plotHeight - (bar.outflow_minor / scaleVal) * plotHeight;
                  return { x, inY, outY, bar, idx };
                });

                // Generate shape-preserving monotone cubic curves (Fritsch-Carlson algorithm)
                const inPoints = points.map((p) => ({ x: p.x, y: p.inY }));
                const outPoints = points.map((p) => ({ x: p.x, y: p.outY }));

                const inCurvePath = numPoints > 1 ? getMonotoneCubicPath(inPoints) : "";
                const inAreaPath = numPoints > 1 ? getMonotoneCubicAreaPath(inPoints, baseY) : "";
                const outCurvePath = numPoints > 1 ? getMonotoneCubicPath(outPoints) : "";

                // 5 Clean grid ticks: 0%, 25%, 50%, 75%, 100% of scaleVal
                const ticks = [0, 0.25, 0.5, 0.75, 1.0].map((pct) => ({
                  pct,
                  valMinor: Math.round(scaleVal * pct),
                  y: padTop + plotHeight * (1 - pct),
                }));

                return (
                  <svg
                    className="acc-chart-svg"
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    width="100%"
                    height={svgHeight}
                    role="img"
                    aria-label={`Cash flow line chart displaying Money In vs Money Out for ${activePeriodLabel}`}
                  >
                    <defs>
                      <linearGradient id="accMoneyInGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2583FF" stopOpacity="0.22" />
                        <stop offset="65%" stopColor="#2583FF" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#2583FF" stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {/* Faint Horizontal Gridlines & Y-Axis Scale (no vertical gridlines) */}
                    {ticks.map((t, idx) => (
                      <g key={idx}>
                        <line
                          x1={padLeft}
                          y1={t.y}
                          x2={svgWidth - padRight}
                          y2={t.y}
                          className="acc-chart-gridline"
                        />
                        <text
                          x={padLeft - 10}
                          y={t.y + 3.5}
                          textAnchor="end"
                          className="acc-chart-axis-text"
                          style={{ fontSize: "11px", fill: "var(--acc-text-muted)" }}
                        >
                          {formatCompactAxis(t.valMinor, activeWorkspace.currency)}
                        </text>
                      </g>
                    ))}

                    {/* Subtle Blue Area Fill Fading Toward Transparent Beneath Money In */}
                    {numPoints > 1 && inAreaPath && (
                      <path
                        d={inAreaPath}
                        fill="url(#accMoneyInGradient)"
                        stroke="none"
                        role="presentation"
                      />
                    )}

                    {/* For 1 data point: show vertical dashed guide and clear value summary badge */}
                    {numPoints === 1 && points[0] && (
                      <g>
                        <line
                          x1={points[0].x}
                          y1={padTop}
                          x2={points[0].x}
                          y2={baseY}
                          stroke="var(--acc-border-hover, #64748B)"
                          strokeDasharray="3 3"
                          strokeWidth="1.25"
                          opacity="0.85"
                        />
                        <g transform={`translate(${points[0].x}, ${Math.max(padTop + 24, Math.min(points[0].inY, points[0].outY) - 16)})`}>
                          <rect
                            x={-56}
                            y={-22}
                            width={112}
                            height={22}
                            rx={4}
                            fill="var(--acc-surface)"
                            stroke="var(--acc-border)"
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={-7}
                            textAnchor="middle"
                            style={{ fontSize: "11px", fontWeight: 700, fill: "var(--acc-text-main)" }}
                          >
                            {points[0].bar.inflow_minor > 0
                              ? `+${formatMoney(points[0].bar.inflow_minor, activeWorkspace.currency)}`
                              : formatMoney(points[0].bar.outflow_minor, activeWorkspace.currency)}
                          </text>
                        </g>
                      </g>
                    )}

                    {/* Active Hover Guide Line for multi-point series */}
                    {numPoints > 1 && hoveredPointIndex !== null && points[hoveredPointIndex] && (
                      <line
                        x1={points[hoveredPointIndex].x}
                        y1={padTop}
                        x2={points[hoveredPointIndex].x}
                        y2={baseY}
                        stroke="var(--acc-border-hover, #64748B)"
                        strokeDasharray="3 3"
                        strokeWidth="1.25"
                        opacity="0.85"
                      />
                    )}

                    {/* Line Series: Money In (Electric blue ~2px monotone smooth curve) */}
                    {numPoints > 1 && inCurvePath && (
                      <path
                        d={inCurvePath}
                        fill="none"
                        stroke="#2583FF"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Line Series: Money Out (Contrasting light slate ~2px dashed monotone curve) */}
                    {numPoints > 1 && outCurvePath && (
                      <path
                        d={outCurvePath}
                        fill="none"
                        stroke="var(--acc-text-muted, #A3A3A3)"
                        strokeWidth="2"
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Interactive Touch & Hover Trigger Zones */}
                    {points.map((pt) => {
                      const isHovered = hoveredPointIndex === pt.idx;
                      const slotW = numPoints > 1 ? plotWidth / (numPoints - 1) : plotWidth;
                      const showMarker = isHovered || numPoints === 1;

                      // Decide whether to show X-axis tick label
                      // If <= 12 points, show all. If > 12 points (e.g. Month view with 24-31 days):
                      // show Day 1, multiples of 5, the final cutoff day, or the actively hovered point.
                      const showXLabel =
                        numPoints <= 12 ||
                        pt.idx === 0 ||
                        pt.idx === numPoints - 1 ||
                        (pt.idx + 1) % 5 === 0 ||
                        isHovered;

                      const updateTooltipCoords = () => {
                        const clampedX = Math.max(75, Math.min(svgWidth - 75, pt.x));
                        setTooltipPos({
                          x: clampedX,
                          y: Math.min(pt.inY, pt.outY),
                        });
                      };

                      return (
                        <g
                          key={pt.idx}
                          tabIndex={0}
                          role="graphics-symbol"
                          aria-label={`${pt.bar.label}: Money In ${formatMoney(pt.bar.inflow_minor, activeWorkspace.currency)}, Money Out ${formatMoney(pt.bar.outflow_minor, activeWorkspace.currency)}`}
                          onMouseEnter={() => {
                            updateTooltipCoords();
                            setHoveredPointIndex(pt.idx);
                          }}
                          onClick={() => {
                            updateTooltipCoords();
                            setHoveredPointIndex(hoveredPointIndex === pt.idx ? null : pt.idx);
                          }}
                          onTouchStart={() => {
                            updateTooltipCoords();
                            setHoveredPointIndex(pt.idx);
                          }}
                          onFocus={() => setHoveredPointIndex(pt.idx)}
                          onBlur={() => setHoveredPointIndex(null)}
                          style={{ outline: "none", cursor: "pointer" }}
                        >
                          {/* Invisible hover trigger area */}
                          <rect
                            x={pt.x - slotW / 2}
                            y={padTop}
                            width={slotW}
                            height={plotHeight}
                            fill="transparent"
                          />

                          {/* Point markers: Hidden permanently for multi-point; visible on hover, touch, or single-point views */}
                          {showMarker && (
                            <>
                              <circle
                                cx={pt.x}
                                cy={pt.inY}
                                r={isHovered ? 5 : 4}
                                fill="#2583FF"
                                stroke="var(--acc-surface, #ffffff)"
                                strokeWidth={2}
                              />
                              <circle
                                cx={pt.x}
                                cy={pt.outY}
                                r={isHovered ? 4.5 : 3.5}
                                fill="var(--acc-text-muted, #A3A3A3)"
                                stroke="var(--acc-surface, #ffffff)"
                                strokeWidth={1.75}
                              />
                            </>
                          )}

                          {/* X-Axis Date/Bucket Label */}
                          {showXLabel && (
                            <text
                              x={pt.x}
                              y={baseY + 18}
                              textAnchor="middle"
                              className="acc-chart-axis-text"
                              style={{
                                fontSize: "11px",
                                fontWeight: isHovered ? 700 : 500,
                                fill: isHovered ? "var(--acc-text-main)" : "var(--acc-text-muted)",
                              }}
                            >
                              {pt.bar.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          )}

          {/* Chart Footer with Reconciled Supporting Totals */}
          <div className="acc-chart-footer">
            <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
              <span>
                Total Inflow:{" "}
                <strong className="tabular-nums" style={{ color: "var(--acc-text-main)" }}>
                  {formatMoney(metrics?.moneyReceivedMinor ?? 0, activeWorkspace.currency)}
                </strong>
              </span>
              <span>
                Total Outflow:{" "}
                <strong className="tabular-nums" style={{ color: "var(--acc-text-muted)" }}>
                  {formatMoney(metrics?.moneyPaidMinor ?? 0, activeWorkspace.currency)}
                </strong>
              </span>
            </div>
            <div>
              <span>
                Net Cash Flow:{" "}
                <strong
                  className="tabular-nums"
                  style={{
                    color:
                      (metrics?.moneyReceivedMinor ?? 0) >= (metrics?.moneyPaidMinor ?? 0)
                        ? "var(--acc-text-main)"
                        : "var(--acc-danger)",
                  }}
                >
                  {(metrics?.moneyReceivedMinor ?? 0) >= (metrics?.moneyPaidMinor ?? 0) ? "+" : ""}
                  {formatMoney(
                    (metrics?.moneyReceivedMinor ?? 0) - (metrics?.moneyPaidMinor ?? 0),
                    activeWorkspace.currency
                  )}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Upcoming Bills (~39% Width) */}
        <div className="acc-card acc-commitments-card">
          <div className="acc-commitments-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
              <div>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "var(--acc-text-main)" }}>
                  Upcoming bills
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  Bills and obligations due
                </span>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  className="acc-btn acc-btn-sm acc-btn-outline"
                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                  onClick={() => onNavigateTab("accounting-reminders")}
                  title="View all reminders and bills"
                >
                  <span>Reminders</span>
                  <ChevronRight size={12} />
                </button>
              )}
            </div>

            {isLoadingInitial ? (
              <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
                Loading bills…
              </div>
            ) : isUnavailable ? (
              <div className="acc-empty-compact">
                <AlertTriangle size={20} style={{ color: "var(--acc-danger)" }} />
                <strong style={{ color: "var(--acc-text-main)", fontSize: "0.875rem" }}>
                  Commitments unavailable
                </strong>
                <p style={{ fontSize: "0.75rem", margin: 0 }}>Could not load pending bills.</p>
                <button
                  type="button"
                  className="acc-btn acc-btn-sm acc-btn-outline"
                  style={{ minHeight: "28px", padding: "0.2rem 0.65rem", fontSize: "0.75rem", marginTop: "0.35rem" }}
                  onClick={handleRetry}
                >
                  Retry
                </button>
              </div>
            ) : (metrics?.upcomingCommitments || []).length === 0 ? (
              <div className="acc-empty-compact">
                <div
                  className="acc-empty-icon-wrap"
                  style={{ backgroundColor: "var(--acc-raised)", color: "#2583FF", width: "36px", height: "36px", border: "1px solid var(--acc-border)" }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <strong style={{ color: "var(--acc-text-main)", fontSize: "0.875rem" }}>
                  No upcoming bills scheduled
                </strong>
                <p style={{ fontSize: "0.75rem", margin: 0, maxWidth: "260px", color: "var(--acc-text-muted)", textAlign: "center", lineHeight: 1.4 }}>
                  No scheduled bills or invoice payments due in the immediate schedule.
                  {(metrics?.iOweMinor ?? 0) > 0 && (
                    <span style={{ display: "block", marginTop: "0.25rem", color: "var(--acc-warning)" }}>
                      Total obligations: {formatMoney(metrics!.iOweMinor, activeWorkspace.currency)}
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {(metrics?.upcomingCommitments || []).map((c, idx) => {
                  const info = parseCommitmentInfo(c.title);
                  const palette = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
                  return (
                    <div
                      key={c.id}
                      className={`acc-bill-row ${c.is_overdue ? "is-overdue" : ""}`}
                      onClick={() => onNavigateTab && onNavigateTab(c.type === "INVOICE" ? "accounting-invoices" : "accounting-reminders")}
                      title="Click to view details"
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                        <div
                          className="acc-bill-avatar"
                          style={{ backgroundColor: palette.bg, color: palette.text }}
                        >
                          {info.initial}
                        </div>
                        <div className="acc-bill-details">
                          <div className="acc-bill-name">
                            {info.name}
                          </div>
                          <div className="acc-bill-sub">
                            {c.is_overdue ? (
                              <span
                                className="acc-badge acc-badge-danger"
                                style={{ fontSize: "0.625rem", padding: "0.05rem 0.35rem", fontWeight: 700 }}
                              >
                                OVERDUE • {c.due_date}
                              </span>
                            ) : (
                              <span>Due {c.due_date}</span>
                            )}
                            {info.subtitle && (
                              <>
                                <span>·</span>
                                <span>{info.subtitle}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className="acc-bill-amount tabular-nums"
                        style={{ color: c.is_overdue ? "var(--acc-danger)" : "var(--acc-text-main)" }}
                      >
                        {formatMoney(c.amount_minor, activeWorkspace.currency)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {onNavigateTab && (
            <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--acc-border)", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="acc-btn acc-btn-sm acc-btn-outline"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem", minHeight: "28px" }}
                onClick={() => onNavigateTab("accounting-invoices")}
              >
                Manage Invoices →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. FULL-WIDTH RECENT TRANSACTIONS TABLE */}
      <div className="acc-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0 }}>Recent transactions</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
              Latest cash movements and posted transactions
            </span>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              className="acc-btn acc-btn-sm acc-btn-outline"
              style={{ padding: "0.2rem 0.65rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              onClick={() => onNavigateTab("accounting-transactions")}
            >
              <span>View all</span>
              <ChevronRight size={12} />
            </button>
          )}
        </div>

        {isLoadingInitial ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>
            Loading recent transactions…
          </div>
        ) : isUnavailable ? (
          <div className="acc-empty-compact">
            <AlertTriangle size={20} style={{ color: "var(--acc-danger)" }} />
            <strong style={{ color: "var(--acc-text-main)", fontSize: "0.875rem" }}>
              Transactions history unavailable
            </strong>
            <button
              type="button"
              className="acc-btn acc-btn-sm acc-btn-outline"
              style={{ minHeight: "28px", padding: "0.2rem 0.65rem", fontSize: "0.75rem", marginTop: "0.35rem" }}
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        ) : (metrics?.recentTransactions || []).length === 0 ? (
          <div className="acc-empty-compact">
            <div
              className="acc-empty-icon-wrap"
              style={{ backgroundColor: "var(--acc-raised)", color: "var(--acc-text-muted)", width: "36px", height: "36px" }}
            >
              <Receipt size={18} />
            </div>
            <strong style={{ color: "var(--acc-text-main)", fontSize: "0.875rem" }}>
              No transactions recorded yet
            </strong>
            <p style={{ fontSize: "0.75rem", margin: 0, maxWidth: "340px" }}>
              Start recording sales, expenses, and account transfers to build your financial statements.
            </p>
            <div style={{ marginTop: "0.625rem" }}>
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
            <table className="acc-table" aria-label="Recent Transactions">
              <thead>
                <tr>
                  <th>Description / Contact</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th className="acc-align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(metrics?.recentTransactions || []).slice(0, 5).map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--acc-text-main)" }}>
                        {tx.contact_name || tx.notes || "General Entry"}
                      </div>
                      {tx.notes && tx.contact_name && (
                        <div style={{ fontSize: "0.6875rem", color: "var(--acc-text-muted)" }}>{tx.notes}</div>
                      )}
                    </td>
                    <td>
                      <span className="acc-badge acc-badge-neutral">{tx.category_name || tx.type}</span>
                    </td>
                    <td style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                      {tx.date}
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                      {tx.account_name || "—"}
                    </td>
                    <td>
                      <span
                        className={
                          tx.status === "POSTED"
                            ? "acc-badge acc-badge-success"
                            : tx.status === "VOIDED"
                            ? "acc-badge acc-badge-danger"
                            : "acc-badge acc-badge-neutral"
                        }
                        style={{ fontSize: "0.6875rem" }}
                      >
                        {tx.status}
                      </span>
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
