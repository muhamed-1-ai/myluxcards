"use client";

import { useState, useMemo, useRef, useEffect, useId, useCallback } from "react";
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

  // Measure untransformed chart wrapper using ResizeObserver content-box and clientWidth
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(0);

  useEffect(() => {
          const el = chartWrapperRef.current;
          if (!el) return;

          const measure = () => {
            // clientWidth measures untransformed layout width, ignoring CSS scale(...) animations
            const cw = el.clientWidth;
            if (cw > 0) {
              setMeasuredWidth(cw);
            }
          };

          // Initial measurement
          measure();

          // ResizeObserver reads content-box inlineSize, which is immune to CSS transforms
          const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              let w = 0;
              if (entry.contentBoxSize) {
                const size = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
                if (size && size.inlineSize > 0) {
                  w = Math.floor(size.inlineSize);
                }
              }
              if (!w && entry.contentRect && entry.contentRect.width > 0) {
                w = Math.floor(entry.contentRect.width);
              }
              if (!w && el.clientWidth > 0) {
                w = el.clientWidth;
              }
              if (w > 0) {
                setMeasuredWidth(w);
              }
            }
          });

          resizeObserver.observe(el);

          // Also attach window resize and animationend listeners to guarantee synchronization
          window.addEventListener("resize", measure);
          el.addEventListener("animationend", measure);
          el.addEventListener("transitionend", measure);

          // Safety checks for when entrance animation settles
          const t1 = setTimeout(measure, 50);
          const t2 = setTimeout(measure, 420);

          return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", measure);
            el.removeEventListener("animationend", measure);
            el.removeEventListener("transitionend", measure);
            clearTimeout(t1);
            clearTimeout(t2);
          };
        }, []);

  // Compute dataset based on selected period
  // Server's growthTimeline is source of truth when available (including when empty)
  // Recent activity is a fallback ONLY when timeline is unavailable (undefined/null)
  const chartData = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 365;
    const pointsMap: Record<string, number> = {};

      const isTimelineAvailable = growthTimeline !== undefined && growthTimeline !== null && Array.isArray(growthTimeline);

      if (isTimelineAvailable) {
        // Source of truth: server growth timeline
        for (const item of growthTimeline) {
          if (item && item.date) {
            pointsMap[item.date] = (pointsMap[item.date] || 0) + Number(item.count || 0);
          }
        }
    } else if (Array.isArray(recentActivity) && recentActivity.length > 0) {
      // Fallback ONLY when timeline is unavailable
      const seenLeadIds = new Set<string>();
      for (const act of recentActivity) {
        if (act.type === "LEAD_CREATED" && act.occurredAt) {
          const leadKey = act.leadId || act.id || `${act.occurredAt}_${act.description || ""}`;
          if (seenLeadIds.has(leadKey)) continue;
          seenLeadIds.add(leadKey);

              const dStr = act.occurredAt.slice(0, 10);
              pointsMap[dStr] = (pointsMap[dStr] || 0) + 1;
            }
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
            for (let i = days - 1; i >= 0; i--) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              const dStr = d.toISOString().slice(0, 10);
              const label =
                period === "7d"
                  ? d.toLocaleDateString("en-US", { weekday: "short" })
                  : d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
              result.push({ dateStr: dStr, label, count: pointsMap[dStr] || 0 });
            }
          }

          return result;
        }, [period, growthTimeline, recentActivity]);

  // Period total calculated strictly from the chart points
  const periodTotal = useMemo(() => {
    return chartData.reduce((sum, pt) => sum + pt.count, 0);
  }, [chartData]);

  const periodSubtitle = useMemo(() => {
    if (period === "7d") return "Last 7 days";
    if (period === "30d") return "Last 30 days";
    return "Last 12 months";
  }, [period]);

  // Responsive plot geometry
  const currentWidth = measuredWidth > 0 ? measuredWidth : 700;
  const isMobile = currentWidth < 600;
  const chartHeight = isMobile ? 210 : 250;

  // Space for Y-axis labels and right edge padding
  const paddingLeft = 36;
  const paddingRight = 14;
  const paddingTop = 12;
  const paddingBottom = 26;

  const plotWidth = Math.max(currentWidth - paddingLeft - paddingRight, 10);
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
   * Flat line at zero when all counts are 0, smooth curves otherwise.
   */
  const { linePath, areaPath } = useMemo(() => {
    const n = points.length;
    if (n === 0) return { linePath: "", areaPath: "" };
      const firstX = points[0].x;
      const lastX = points[n - 1].x;

      const isAllZero = points.every((p) => p.count === 0);
      if (isAllZero || n === 1) {
        // Flat line along zero baseline
        const path = `M ${firstX.toFixed(2)} ${zeroY.toFixed(2)} L ${lastX.toFixed(2)} ${zeroY.toFixed(2)}`;
        const fill = `${path} L ${lastX.toFixed(2)} ${zeroY.toFixed(2)} L ${firstX.toFixed(2)} ${zeroY.toFixed(2)} Z`;
        return { linePath: path, areaPath: fill };
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
          m[i] = 0;
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
      let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
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

      const fill = `${path} L ${lastX.toFixed(2)} ${zeroY.toFixed(2)} L ${firstX.toFixed(2)} ${zeroY.toFixed(2)} Z`;

      return { linePath: path, areaPath: fill };
    }, [points, zeroY]);

  // Unique SVG clip ID
  const rawId = useId();
  const clipId = useMemo(() => `lead-growth-clip-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [rawId]);

  // SVG Elements and Animation Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const clipRectRef = useRef<SVGRectElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isRevealingRef = useRef<boolean>(false);
  const revealedWidthRef = useRef<number>(plotWidth);
  const [isSettled, setIsSettled] = useState<boolean>(false);

  const lastPeriodRef = useRef<Period>(period);
  const hasInitializedRef = useRef<boolean>(false);
  const plotWidthRef = useRef<number>(plotWidth);
  plotWidthRef.current = plotWidth;

  // Coordinated Horizontal Reveal Effect (Duration ~1,000ms matching reference 0:02.1-0:03.3)
  useEffect(() => {
    if (chartData.length === 0) return;

    const isRangeChange = hasInitializedRef.current && period !== lastPeriodRef.current;
    const isInitialDataReveal = !hasInitializedRef.current;

    lastPeriodRef.current = period;

    // Only run reveal on initial data appearance or when range changes
    if (!isInitialDataReveal && !isRangeChange) {
      return;
    }

    hasInitializedRef.current = true;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      revealedWidthRef.current = plotWidth;
      if (clipRectRef.current) {
        clipRectRef.current.setAttribute("width", String(plotWidth));
      }
      setIsSettled(true);
      isRevealingRef.current = false;
      return;
    }

    // Cancel any previous animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Reset to 0 at the start of reveal
    setIsSettled(false);
    isRevealingRef.current = true;
    revealedWidthRef.current = 0;
    if (clipRectRef.current) {
      clipRectRef.current.setAttribute("width", "0");
    }

    const duration = 1000;
    const start = performance.now();
    startTimeRef.current = start;

    const animate = (now: number) => {
      const elapsed = Math.max(0, now - start);
      const t = Math.min(1, Math.max(0, elapsed / duration));
      // Decelerating cubic-bezier curve matching cubic-bezier(0.16, 1, 0.3, 1)
      const progress = Math.max(0, 1 - Math.pow(1 - t, 3.5));
      const safePlotWidth = Math.max(0, plotWidthRef.current);
      const currentW = Math.max(0, progress * safePlotWidth);

      revealedWidthRef.current = currentW;
      if (clipRectRef.current) {
        clipRectRef.current.setAttribute("width", currentW.toFixed(2));
      }

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        revealedWidthRef.current = plotWidthRef.current;
        if (clipRectRef.current) {
          clipRectRef.current.setAttribute("width", String(plotWidthRef.current));
        }
        isRevealingRef.current = false;
        setIsSettled(true);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [period, chartData.length > 0]);

  // Keep clip width synchronized when window resizes after settled state
  useEffect(() => {
    if (isSettled && !isRevealingRef.current && clipRectRef.current) {
      revealedWidthRef.current = plotWidth;
      clipRectRef.current.setAttribute("width", String(plotWidth));
    }
  }, [plotWidth, isSettled]);

  // Pointer Move Handler (Desktop Hover & Touch Scrubbing with accurate SVG coordinate mapping)
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;

    let pointerX: number;
    const svgEl = svgRef.current;
    if (typeof svgEl.createSVGPoint === "function" && svgEl.getScreenCTM) {
      try {
        const pt = svgEl.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svgEl.getScreenCTM();
        if (ctm) {
          const transformed = pt.matrixTransform(ctm.inverse());
          pointerX = transformed.x;
        } else {
          const rect = svgEl.getBoundingClientRect();
          pointerX = (e.clientX - rect.left) * (currentWidth / (rect.width || 1));
        }
      } catch {
        const rect = svgEl.getBoundingClientRect();
        pointerX = (e.clientX - rect.left) * (currentWidth / (rect.width || 1));
      }
    } else {
      const rect = svgEl.getBoundingClientRect();
      pointerX = (e.clientX - rect.left) * (currentWidth / (rect.width || 1));
    }

    // Do not respond if pointer is outside horizontal plot bounds
      if (pointerX < paddingLeft - 20 || pointerX > currentWidth - paddingRight + 20) {
        return;
      }

      // Determine currently revealed maximum X coordinate
      let maxAllowedX = paddingLeft + plotWidth;
      if (isRevealingRef.current && startTimeRef.current !== null) {
        const elapsed = performance.now() - startTimeRef.current;
        const t = Math.min(1, Math.max(0, elapsed / 1000));
        const p = 1 - Math.pow(1 - t, 3.5);
        maxAllowedX = paddingLeft + p * plotWidth;
      }

      // Only allow selecting points within the portion already revealed
      const revealedPoints = points.filter((pt) => pt.x <= maxAllowedX + 2);
      if (revealedPoints.length === 0) {
        setHoveredPoint(null);
        return;
      }

      // Clamp pointer target to the revealed edge
      const targetX = Math.min(pointerX, maxAllowedX);

      // Find the nearest point along X
      let closest = revealedPoints[0];
      let minDist = Math.abs(closest.x - targetX);
      for (let i = 1; i < revealedPoints.length; i++) {
        const dist = Math.abs(revealedPoints[i].x - targetX);
        if (dist < minDist) {
          minDist = dist;
          closest = revealedPoints[i];
        }
      }

      setHoveredPoint(closest);
    };

    const handlePointerLeave = () => {
      setHoveredPoint(null);
    };

    return (
        <div
      style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          minWidth: 0,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        {/* 1. Header: Title on Left, Range Controls on Right (Wraps neatly on mobile) */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <h2
            title="Daily new lead generation volume"
            style={{
              fontSize: isMobile ? 16 : 18,
              fontWeight: 800,
              color: "var(--text-primary, #F8FAFC)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Growth Velocity{" "}
            <span style={{ fontWeight: 500, color: "var(--text-secondary, #94A3B8)" }}>
              — Lead Acquisition
            </span>
          </h2>

          {/* Period Selector Segmented Capsule */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "#161822",
              border: "1px solid var(--border-color, #343740)",
              padding: 3,
              borderRadius: 10,
              flexShrink: 0,
            }}
          >
                {(["7d", "30d", "12m"] as Period[]).map((pKey) => {
                  const label =
                    pKey === "7d"
                      ? isMobile
                        ? "7D"
                        : "7 Days"
                      : pKey === "30d"
                        ? isMobile
                          ? "30D"
                          : "30 Days"
                        : isMobile
                          ? "12M"
                          : "12 Months";
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

    {/* 2. Prominent Period Total & Subtitle Row (Just below title, zero dead space) */ }
    < div
  style = {{
    display: "flex",
      alignItems: "baseline",
        justifyContent: "space-between",
          marginBottom: 12,
            flexWrap: "wrap",
              gap: 8,
        }
}
      >
  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
    <span
      style={{
        fontSize: isMobile ? 26 : 32,
        fontWeight: 800,
        color: "var(--text-primary, #F8FAFC)",
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      {periodTotal}
    </span>
    <span
      style={{
        fontSize: 13,
        color: "var(--text-secondary, #94A3B8)",
        fontWeight: 500,
      }}
    >
      New {periodTotal === 1 ? "lead" : "leads"} · {periodSubtitle}
    </span>
  </div>

{/* Legend Indicator */ }
<span
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-muted, #94A3B8)",
    fontWeight: 500,
  }}
>
  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#168BFF" }} />
  New Leads
</span>
      </div >

  {/* 3. Full-Width Responsive Graph (Uses nearly full inner width of card) */ }
  < div
            ref = { chartWrapperRef }
  style = {{
    position: "relative",
      width: "100%",
        minWidth: 0,
          height: chartHeight,
            overflow: "visible",
        }
}
      >
  <svg
    ref={svgRef}
    width="100%"
    height={chartHeight}
    viewBox={`0 0 ${currentWidth} ${chartHeight}`}
    style={{
      display: "block",
      width: "100%",
      height: "100%",
      overflow: "visible",
      touchAction: "pan-y",
    }}
    onPointerMove={handlePointerMove}
    onPointerDown={handlePointerMove}
    onPointerLeave={handlePointerLeave}
  >
    <defs>
      {/* SVG ClipPath for Coordinated Horizontal Curve & Gradient Reveal */}
      <clipPath id={clipId}>
        <rect
          ref={clipRectRef}
          x={paddingLeft}
          y={0}
          width={Math.max(0, isSettled ? plotWidth : 0)}
          height={Math.max(0, chartHeight)}
        />
      </clipPath>
      <linearGradient id="leadSmoothGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#168BFF" stopOpacity="0.22" />
        <stop offset="60%" stopColor="#168BFF" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#168BFF" stopOpacity="0.0" />
      </linearGradient>
      <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#168BFF" floodOpacity="0.6" />
      </filter>
    </defs>

      {/* Faint Horizontal Dashed Guides (0 to maxVal) - Stable shell */}
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
                x2={currentWidth - paddingRight}
                y2={y}
                stroke="rgba(22, 139, 255, 0.35)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              // Faint horizontal guide
              <line
                x1={paddingLeft}
                y1={y}
                x2={currentWidth - paddingRight}
                y2={y}
                stroke="var(--border-color, #343740)"
                strokeDasharray="4 4"
                strokeWidth="1"
                strokeOpacity="0.6"
              />
            )}
            {/* Y-Axis Label */}
            <text
              x={paddingLeft - 8}
              y={y + 4}
              fill="var(--text-muted, #969CA8)"
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

        {/* Coordinated Horizontal Reveal (Curve & Gradient Fill share identical moving clip edge) */ }
        <g clipPath={`url(#${clipId})`}>
          {/* Soft Gradient Fade Area Underneath Curve */}
          <path
            d={areaPath}
            fill="url(#leadSmoothGradient)"
            className="dash-chart-area-reveal"
          />

          {/* Smooth Monotone Cubic Spline Line (2.5px width) */}
          <path
            d={linePath}
            fill="none"
            stroke="#168BFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dash-chart-line-reveal"
          />
        </g>

          {/* X-Axis Ticks & Labels - First and last date labels kept inside the card */}
          {points.map((pt, idx) => {
            // Tick decimation logic
            if (period === "30d" && idx % (isMobile ? 6 : 4) !== 0 && idx !== points.length - 1) return null;
            if (period === "12m" && currentWidth < 500 && idx % 2 !== 0 && idx !== points.length - 1) return null;

        let displayLabel = pt.label;
        if (isMobile && period === "7d" && currentWidth < 360) {
          displayLabel = pt.label.slice(0, 2);
        }

            // Align first tick to start, last tick to end, and middle ticks to middle
            const textAnchor = idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle";

            return (
              <text
                key={`xlabel-${idx}`}
                x={pt.x}
                y={zeroY + 18}
                fill="var(--text-muted, #969CA8)"
                fontSize={isMobile ? "10" : "11"}
                fontWeight="500"
                fontFamily="Inter, system-ui, sans-serif"
                textAnchor={textAnchor}
              >
                {displayLabel}
              </text>
            );
          })
        }

      {/* Active Hover Guide Line & Glowing Point (Clamped within revealed curve) */}
      {hoveredPoint && (
        <g>
          <line
            x1={hoveredPoint.x}
            y1={paddingTop}
            x2={hoveredPoint.x}
            y2={zeroY}
            stroke="rgba(22, 139, 255, 0.4)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r="9"
            fill="rgba(22, 139, 255, 0.2)"
          />
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r="4.5"
            fill="#168BFF"
            stroke="var(--surface, #1B1C21)"
            strokeWidth="2"
            filter="url(#pointGlow)"
          />
        </g>
      )}

      {/* Interactive Invisible Hover Hitboxes (For Keyboard Accessibility) */}
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
          onFocus={() => {
            const maxAllowedX = isRevealingRef.current
              ? paddingLeft + revealedWidthRef.current
              : paddingLeft + plotWidth;
            if (pt.x <= maxAllowedX + 2) {
              setHoveredPoint(pt);
            }
          }}
          onBlur={() => setHoveredPoint(null)}
        />
      ))}
        </svg>

{/* Polished Floating Glassmorphic Tooltip */ }
{
  hoveredPoint && (
    <div
      style={{
        position: "absolute",
        zIndex: 30,
        pointerEvents: "none",
        background: "var(--surface-elevated, #23252C)",
        border: "1px solid var(--border-color, #343740)",
        color: "var(--text-primary, #F5F6F8)",
        padding: "8px 14px",
        borderRadius: 10,
        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.6)",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        transform: `translate(${hoveredPoint.x < paddingLeft + 50 ? "0%" : hoveredPoint.x > currentWidth - paddingRight - 50 ? "-100%" : "-50%"}, -125%)`,
        left: `${hoveredPoint.x}px`,
        top: `${hoveredPoint.y}px`,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted, #969CA8)", marginBottom: 3 }}>
        {hoveredPoint.dateStr || hoveredPoint.label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#168BFF" }} />
        <span style={{ color: "var(--text-primary, #F5F6F8)" }}>{hoveredPoint.count} New Leads</span>
      </div>
    </div>
  )
}
      </div >
    </div >
  );
}
