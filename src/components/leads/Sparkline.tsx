"use client";

import React, { useId, useRef, useEffect, useState } from "react";

export interface SparklinePoint {
  x?: string;
  y: number;
}

interface SparklineProps {
  data?: SparklinePoint[] | number[];
  color: string;
  width?: number;
  height?: number;
  ariaLabel?: string;
  seriesTitle?: string;
}

export function Sparkline({
  data = [],
  color,
  width = 110,
  height = 38,
  ariaLabel,
  seriesTitle,
}: SparklineProps) {
  const clipId = "sparkline-clip-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipRectRef = useRef<SVGRectElement>(null);
  const [isSettled, setIsSettled] = useState(false);

  // Normalize points to numbers
  const values = React.useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    return data.map((d) => (typeof d === "number" ? d : d.y));
  }, [data]);

  // Check data state: insufficient, genuine zero, or standard series
  const isInsufficient = values.length === 0;
  const isAllZero = values.length > 0 && values.every((v) => v === 0);

  // Min / Max computation
  const { min, max } = React.useMemo(() => {
    if (values.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [values]);

  // Compute SVG smooth curve path
  const pathD = React.useMemo(() => {
    if (isInsufficient) return "";
    const paddingY = 4;
    const paddingX = 2;
    const plotW = width - paddingX * 2;
    const plotH = height - paddingY * 2;

    // Genuine zero series: render a flat horizontal line at y = 0 baseline
    if (isAllZero) {
      const y = height - paddingY;
      return `M ${paddingX} ${y} L ${width - paddingX} ${y}`;
    }

    const range = max - min || 1;
    // Map data points to Cartesian coordinates
    const pts = values.map((val, idx) => {
      const x = paddingX + (idx / Math.max(values.length - 1, 1)) * plotW;
      const y = height - paddingY - ((val - min) / range) * plotH;
      return { x, y };
    });

    if (pts.length === 1) {
      return `M ${paddingX} ${pts[0].y} L ${width - paddingX} ${pts[0].y}`;
    }

    // Smooth Bézier curve interpolation
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const midX = (p0.x + p1.x) / 2;
      d += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  }, [values, isInsufficient, isAllZero, width, height, min, max]);

  // Short left-to-right reveal animation when data loads or changes
  useEffect(() => {
    if (isInsufficient) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      if (clipRectRef.current) clipRectRef.current.setAttribute("width", String(width));
      setIsSettled(true);
      return;
    }

    setIsSettled(false);
    if (clipRectRef.current) clipRectRef.current.setAttribute("width", "0");

    let animId: number;
    const duration = 450; // Smooth 450ms reveal
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // Decelerating ease-out curve
      const p = 1 - Math.pow(1 - t, 3);
      if (clipRectRef.current) {
        clipRectRef.current.setAttribute("width", (p * width).toFixed(1));
      }
      if (t < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        if (clipRectRef.current) clipRectRef.current.setAttribute("width", String(width));
        setIsSettled(true);
      }
    };
    animId = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(animId);
  }, [values, isInsufficient, width]);

  // Render unavailable state when there is insufficient data
  if (isInsufficient) {
    return (
      <div
        className="flex items-center justify-end pr-1 text-[11px] text-[var(--text-muted,#64748B)] italic opacity-60"
        style={{ width, height }}
        title={seriesTitle ? `${seriesTitle}: Insufficient data` : "Insufficient data"}
      >
        <span>—</span>
      </div>
    );
  }

  return (
    <div
      style={{ width, height }}
      className="relative flex items-center justify-end shrink-0"
      title={seriesTitle || ariaLabel || "Metric trend"}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible block"
        aria-label={ariaLabel || "Metric trend sparkline"}
      >
        <defs>
          <clipPath id={clipId}>
            <rect ref={clipRectRef} x={0} y={0} width={isSettled ? width : 0} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

export default Sparkline;

