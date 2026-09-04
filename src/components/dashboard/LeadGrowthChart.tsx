"use client";

import { useState, useMemo } from "react";
import { CrmActivityItem, LeadGrowthPoint } from "@/lib/crm";

interface LeadGrowthChartProps {
  growthTimeline?: LeadGrowthPoint[];
  recentActivity?: CrmActivityItem[];
  totalLeads?: number;
}

type Period = "7d" | "30d" | "12m";

export function LeadGrowthChart({
  growthTimeline,
  recentActivity = [],
}: LeadGrowthChartProps) {
  const [period, setPeriod] = useState<Period>("7d");
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; count: number; x: number; y: number } | null>(null);

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
        const label = d.toLocaleDateString("en-US", { weekday: "short" });
        result.push({ dateStr: dStr, label, count: pointsMap[dStr] || 0 });
      }
    }

    return result;
  }, [period, growthTimeline, recentActivity]);

  // SVG layout dimensions
  const svgWidth = 600;
  const svgHeight = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 45;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;
  const zeroY = paddingTop + plotHeight;

  const maxVal = useMemo(() => {
    const highest = Math.max(...chartData.map((d) => d.count), 0);
    return highest <= 3 ? 4 : Math.ceil(highest * 1.25);
  }, [chartData]);

  const points = useMemo(() => {
    return chartData.map((pt, i) => {
      const x = paddingLeft + (i / Math.max(chartData.length - 1, 1)) * plotWidth;
      const y = zeroY - (pt.count / maxVal) * plotHeight;
      return { ...pt, x, y };
    });
  }, [chartData, maxVal, paddingLeft, plotWidth, zeroY, plotHeight]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      const prev = points[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, "");
  }, [points]);

  const areaPath = useMemo(() => {
    if (!linePath || points.length === 0) return "";
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${linePath} L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`;
  }, [linePath, points, zeroY]);

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header & Compact Period Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <h2 style={{
            fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 17,
            fontWeight: 700,
            color: "#FFFFFF",
            margin: 0,
            letterSpacing: "-0.01em"
          }}>
            Growth Velocity <span style={{ fontWeight: 500, color: "#E2E8F0" }}>— Lead Acquisition</span>
          </h2>
          <p style={{
            fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 13,
            color: "#8E8EA0",
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
          gap: 3,
          background: "#161722",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          padding: 3,
          borderRadius: 12
        }}>
          {(["7d", "30d", "12m"] as Period[]).map((pKey) => {
            const label = pKey === "7d" ? "7 Days" : pKey === "30d" ? "30 Days" : "12 Months";
            const isActive = period === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => setPeriod(pKey)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: "Inter, system-ui, sans-serif",
                  borderRadius: 9,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "#0066FF" : "transparent",
                  color: isActive ? "#08080A" : "#8E8EA0",
                  boxShadow: isActive ? "0 2px 8px rgba(0, 229, 255, 0.25)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plotting Area */}
      <div style={{ position: "relative", width: "100%", flex: 1, minHeight: 220, display: "flex", alignItems: "center" }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ width: "100%", height: "100%", overflow: "visible" }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="leadGoldGradientSubtle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Dashed Grid Lines (0 to maxVal) */}
          {[0, 1, 2, 3, 4].map((stepVal, idx) => {
            const pct = 1 - stepVal / 4;
            const y = paddingTop + pct * plotHeight;
            const valLabel = Math.round((stepVal / 4) * maxVal);

            return (
              <g key={idx}>
                {stepVal === 0 ? (
                  // Solid Zero Baseline in Gold (matching 1:1 reference line)
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#0066FF"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ) : (
                  // Horizontal Dashed Grid Line
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                )}
                {/* Y-Axis Label */}
                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  fill="#8E8EA0"
                  fontSize="12"
                  fontWeight="500"
                  fontFamily="Inter, system-ui, sans-serif"
                  textAnchor="end"
                >
                  {valLabel}
                </text>
              </g>
            );
          })}

          {/* Subtle Fill */}
          <path d={areaPath} fill="url(#leadGoldGradientSubtle)" />

          {/* Smooth Lead Series Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#0066FF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-Axis Ticks & Labels (Positioned directly below y=0 baseline line) */}
          {points.map((pt, idx) => (
            <text
              key={`xlabel-${idx}`}
              x={pt.x}
              y={zeroY + 22}
              fill="#8E8EA0"
              fontSize="12"
              fontWeight="500"
              fontFamily="Inter, system-ui, sans-serif"
              textAnchor="middle"
            >
              {pt.label}
            </text>
          ))}

          {/* Hover Targets & Active Markers */}
          {points.map((pt, idx) => {
            const isHovered = hoveredPoint?.label === pt.label;
            return (
              <g key={`point-${idx}`}>
                {/* Invisible Hitbox for smooth hover */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="14"
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredPoint({ label: pt.label, count: pt.count, x: pt.x, y: pt.y })}
                />
                {/* Active Marker Dot ONLY on Hover */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill="#0066FF"
                    stroke="#08080A"
                    strokeWidth="2.5"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: "absolute",
              zIndex: 30,
              pointerEvents: "none",
              background: "#161722",
              border: "1px solid rgba(0, 229, 255, 0.6)",
              color: "#FFF",
              padding: "6px 12px",
              borderRadius: 8,
              boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
              fontSize: 12,
              fontFamily: "Inter, system-ui, sans-serif",
              transform: "translate(-50%, -100%)",
              marginBottom: 10,
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: `${(hoveredPoint.y / svgHeight) * 100}%`,
            }}
          >
            <div style={{ fontWeight: 700, color: "#0066FF" }}>{hoveredPoint.count} New Leads</div>
            <div style={{ fontSize: 10, color: "#8E8EA0" }}>{hoveredPoint.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}
