"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { CrmActivityItem, LeadGrowthPoint } from "@/lib/crm";

interface LeadGrowthChartProps {
  growthTimeline?: LeadGrowthPoint[];
  recentActivity?: CrmActivityItem[];
  totalLeads?: number;
}

type Period = "7d" | "30d" | "12m";

interface Point {
  dateStr: string;
  label: string;
  count: number;
  x: number;
  y: number;
}

export function LeadGrowthChart({
  growthTimeline,
  recentActivity = [],
}: LeadGrowthChartProps) {
  const [period, setPeriod] = useState<Period>("7d");
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  // Measure chart wrapper width dynamically to ensure 100% full-width plot
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(700);

  useEffect(() => {
    if (!chartWrapperRef.current) return;
    const updateSize = () => {
      if (chartWrapperRef.current) {
        const rect = chartWrapperRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          setMeasuredWidth(Math.floor(rect.width));
        }
      }
    };
    updateSize();

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(chartWrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute dataset based on selected period
  const chartData = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 365;
    const pointsMap: Record<string, number> = {};

    // 1. Map existing growthTimeline if available
    if (growthTimeline && growthTimeline.length > 0) {
      for (const item of growthTimeline) {
        pointsMap[item.date] = item.count;
      }
    }

    // 2. Map from recentActivity LEAD_CREATED items
    for (const act of recentActivity) {
      if (act.type === "LEAD_CREATED" && act.occurredAt) {
        const dStr = act.occurredAt.slice(0, 10);
        pointsMap[dStr] = (pointsMap[dStr] || 0) + 1;
      }
    }

    // Build timeline points array backwards from today
    const result: { dateStr: string; label: string; count: number }[] = [];
    const today = new Date();

    if (period === "12m") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short" });

        let monthCount = 0;
        Object.keys(pointsMap).forEach((k) => {
          if (k.startsWith(mKey)) monthCount += pointsMap[k];
        });

        result.push({ dateStr: mKey, label, count: monthCount });
      }
    } else {
      const step = 1;
      for (let i = days - 1; i >= 0; i -= step) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        const label = period === "7d"
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
        result.push({ dateStr: dStr, label, count: pointsMap[dStr] || 0 });
      }
    }

    return result;
  }, [period, growthTimeline, recentActivity]);

  // Responsive plot geometry
  const isMobile = measuredWidth < 600;
  const chartHeight = isMobile ? 230 : 280;

  // Reserve ~44px for Y-axis numbers and 14px on the right
  const paddingLeft = 44;
  const paddingRight = 14;
  const paddingTop = 16;
  const paddingBottom = 28;

  const plotWidth = Math.max(measuredWidth - paddingLeft - paddingRight, 10);
  const plotHeight = Math.max(chartHeight - paddingTop - paddingBottom, 10);
  const zeroY = paddingTop + plotHeight;

  const maxVal = useMemo(() => {
    const highest = Math.max(...chartData.map((d) => d.count), 0);
    return highest <= 3 ? 4 : Math.ceil(highest * 1.25);
  }, [chartData]);

  // Map to Cartesian coordinates spanning the full measured width
  const points: Point[] = useMemo(() => {
    return chartData.map((pt, i) => {
      const x = paddingLeft + (i / Math.max(chartData.length - 1, 1)) * plotWidth;
      const y = zeroY - (pt.count / maxVal) * plotHeight;
      return { ...pt, x, y };
    });
  }, [chartData, maxVal, paddingLeft, plotWidth, zeroY, plotHeight]);

  /**
   * Monotone Cubic Spline (Fritsch-Carlson algorithm)
   * Prevents overshoot below zero and guarantees smooth, flowing C1 curves.
   */
  const { linePath, areaPath } = useMemo(() => {
    const n = points.length;
    if (n === 0) return { linePath: "", areaPath: "" };
    if (n === 1) {
      const p = points[0];
      return {
        linePath: `M ${p.x} ${p.y}`,
        areaPath: `M ${p.x} ${p.y} L ${p.x} ${zeroY} Z`,
      };
    }

    // 1. Calculate secants (slopes between consecutive points)
    const dx: number[] = [];
    const dy: number[] = [];
    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const dX = points[i + 1].x - points[i].x;
      const dY = points[i + 1].y - points[i].y;
      dx.push(dX);
      dy.push(dY);
      slopes.push(dX === 0 ? 0 : dY / dX);
    }

    // 2. Initialize tangents at each point
    const m: number[] = new Array(n).fill(0);
    m[0] = slopes[0];
    for (let i = 1; i < n - 1; i++) {
      if (slopes[i - 1] * slopes[i] <= 0) {
        m[i] = 0; // Local extremum or flat
      } else {
        m[i] = (slopes[i - 1] + slopes[i]) / 2;
      }
    }
    m[n - 1] = slopes[n - 2];

    // 3. Fritsch-Carlson conditions to ensure monotonicity
    for (let i = 0; i < n - 1; i++) {
      if (slopes[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const alpha = m[i] / slopes[i];
        const beta = m[i + 1] / slopes[i];
        const dist = alpha * alpha + beta * beta;
        if (dist > 9) {
          const tau = 3 / Math.sqrt(dist);
          m[i] = tau * alpha * slopes[i];
          m[i + 1] = tau * beta * slopes[i];
        }
      }
    }

    // 4. Build smooth Cubic Bézier SVG path segments
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const segmentDx = dx[i];

      const cp1x = p0.x + segmentDx / 3;
      let cp1y = p0.y + (m[i] * segmentDx) / 3;

      const cp2x = p1.x - segmentDx / 3;
      let cp2y = p1.y - (m[i + 1] * segmentDx) / 3;

      // Mathematical clamp: Never overshoot below the zero baseline
      if (cp1y > zeroY) cp1y = zeroY;
      if (cp2y > zeroY) cp2y = zeroY;

      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }

    const firstX = points[0].x;
    const lastX = points[n - 1].x;
    const fill = `${path} L ${lastX.toFixed(2)} ${zeroY} L ${firstX.toFixed(2)} ${zeroY} Z`;

    return { linePath: path, areaPath: fill };
  }, [points, zeroY]);

  // Summary Metrics calculations
  const periodTotal = useMemo(() => chartData.reduce((acc, curr) => acc + curr.count, 0), [chartData]);
  const peakVal = useMemo(() => Math.max(...chartData.map((d) => d.count), 0), [chartData]);
  const avgVal = useMemo(() => (chartData.length > 0 ? (periodTotal / chartData.length).toFixed(1) : "0"), [chartData, periodTotal]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      minWidth: 0,
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }}>
      {/* 1. Header: Title on Left, Time-Range Selector on Right (18px bottom gap) */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 18,
      }}>
        <div>
          <h2 style={{
            fontSize: 18,
            fontWeight: 800,
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.01em"
          }}>
            Growth Velocity <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>— Lead Acquisition</span>
          </h2>
          <p style={{
            fontSize: 13,
            color: "var(--text-muted)",
            margin: "4px 0 0",
            fontWeight: 400
          }}>
            Daily new lead generation volume
          </p>
        </div>

        {/* Period Selector Segmented Capsule */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "#161822",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: 3,
          borderRadius: 10,
          flexShrink: 0
        }}>
          {(["7d", "30d", "12m"] as Period[]).map((pKey) => {
            const label = pKey === "7d" ? (isMobile ? "7D" : "7 Days") : pKey === "30d" ? (isMobile ? "30D" : "30 Days") : (isMobile ? "12M" : "12 Months");
            const isActive = period === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => setPeriod(pKey)}
                style={{
                  height: 28,
                  padding: isMobile ? "0 9px" : "0 12px",
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: "Inter, system-ui, sans-serif",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "#0066FF" : "transparent",
                  color: isActive ? "#FFFFFF" : "#94A3B8",
                  boxShadow: isActive ? "0 2px 8px rgba(0, 102, 255, 0.25)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Summary Row: Three Equal-Width Cards (14px bottom gap) */}
      <div className="crm-chart-summary-grid" style={{ marginBottom: 14 }}>
        {/* Card 1: Period Total */}
        <div className="crm-chart-summary-card">
          <span className="crm-chart-summary-label">Period Total</span>
          <div className="crm-chart-summary-value">{periodTotal} <span className="crm-chart-summary-unit">Leads</span></div>
          <span className="crm-chart-summary-sub">Selected timeframe</span>
        </div>

        {/* Card 2: Avg. Volume */}
        <div className="crm-chart-summary-card">
          <span className="crm-chart-summary-label">Avg. Volume</span>
          <div className="crm-chart-summary-value" style={{ color: "#0066FF" }}>{avgVal} <span className="crm-chart-summary-unit">/ day</span></div>
          <span className="crm-chart-summary-sub">Daily acquisition average</span>
        </div>

        {/* Card 3: Peak Volume */}
        <div className="crm-chart-summary-card">
          <span className="crm-chart-summary-label">Peak Volume</span>
          <div className="crm-chart-summary-value" style={{ color: "#38BDF8" }}>{peakVal} <span className="crm-chart-summary-unit">Leads</span></div>
          <span className="crm-chart-summary-sub">Highest single day</span>
        </div>
      </div>

      {/* 3. Compact Legend Row: Aligned with the right edge of summary row (10px bottom gap) */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        paddingRight: paddingRight,
        marginBottom: 10,
      }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "#94A3B8",
          fontWeight: 500
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0066FF" }} />
          New Leads
        </span>
      </div>

      {/* 4. Full-Width Responsive Graph (Exact measured dimensions, zero letterboxing) */}
      <div
        ref={chartWrapperRef}
        style={{
          position: "relative",
          width: "100%",
          minWidth: 0,
          height: chartHeight,
          overflow: "visible",
        }}
      >
        <svg
          width={measuredWidth}
          height={chartHeight}
          viewBox={`0 0 ${measuredWidth} ${chartHeight}`}
          style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="leadSmoothGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#0066FF" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0.0" />
            </linearGradient>
            <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#0066FF" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Faint Horizontal Dashed Gridlines (0 to maxVal) */}
          {[0, 1, 2, 3, 4].map((stepVal, idx) => {
            const pct = 1 - stepVal / 4;
            const y = paddingTop + pct * plotHeight;
            const valLabel = Math.round((stepVal / 4) * maxVal);

            return (
              <g key={idx}>
                {stepVal === 0 ? (
                  // Solid zero baseline in subtle cyan/blue
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={measuredWidth - paddingRight}
                    y2={y}
                    stroke="rgba(0, 102, 255, 0.3)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                ) : (
                  // Faint dashed horizontal gridline
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={measuredWidth - paddingRight}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                )}
                {/* Y-Axis Label */}
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="500"
                  fontFamily="Inter, system-ui, sans-serif"
                  textAnchor="end"
                >
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Soft Gradient Fade Area Underneath Curve */}
          <path d={areaPath} fill="url(#leadSmoothGradient)" />

          {/* Smooth Monotone Cubic Spline Line (2.5px width) */}
          <path
            d={linePath}
            fill="none"
            stroke="#0066FF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-Axis Ticks & Labels */}
          {points.map((pt, idx) => {
            // In 30-day mode, skip intermediate labels for breathing room
            if (period === "30d" && idx % 4 !== 0 && idx !== points.length - 1) return null;
            // In 12-month mode on small screens, skip every other month
            if (period === "12m" && measuredWidth < 460 && idx % 2 !== 0 && idx !== points.length - 1) return null;

            let displayLabel = pt.label;
            if (isMobile && period === "7d" && measuredWidth < 360) {
              displayLabel = pt.label.slice(0, 2);
            }

            return (
              <text
                key={`xlabel-${idx}`}
                x={pt.x}
                y={zeroY + 18}
                fill="#64748B"
                fontSize={isMobile ? "10" : "11"}
                fontWeight="500"
                fontFamily="Inter, system-ui, sans-serif"
                textAnchor="middle"
              >
                {displayLabel}
              </text>
            );
          })}

          {/* Active Hover Guide Line & Glowing Point */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={paddingTop}
                x2={hoveredPoint.x}
                y2={zeroY}
                stroke="rgba(0, 102, 255, 0.35)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="9"
                fill="rgba(0, 102, 255, 0.2)"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#0066FF"
                stroke="#080A12"
                strokeWidth="2"
                filter="url(#pointGlow)"
              />
            </g>
          )}

          {/* Interactive Invisible Hover Hitboxes (No Permanent Dots) */}
          {points.map((pt, idx) => (
            <circle
              key={`hitbox-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r="16"
              fill="transparent"
              style={{ cursor: "pointer" }}
              tabIndex={0}
              aria-label={`${pt.label}: ${pt.count} leads`}
              onMouseEnter={() => setHoveredPoint(pt)}
              onFocus={() => setHoveredPoint(pt)}
            />
          ))}
        </svg>

        {/* Polished Floating Glassmorphic Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: "absolute",
              zIndex: 30,
              pointerEvents: "none",
              background: "#121420",
              border: "1px solid rgba(0, 102, 255, 0.4)",
              color: "#FFFFFF",
              padding: "8px 14px",
              borderRadius: 10,
              boxShadow: "0 10px 24px rgba(0, 0, 0, 0.5)",
              fontSize: 12,
              fontFamily: "Inter, system-ui, sans-serif",
              transform: "translate(-50%, -120%)",
              left: `${hoveredPoint.x}px`,
              top: `${hoveredPoint.y}px`,
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 3 }}>
              {hoveredPoint.dateStr || hoveredPoint.label}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0066FF" }} />
              <span style={{ color: "#FFFFFF" }}>{hoveredPoint.count} New Leads</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
