"use client";

import React, { useState, useMemo } from "react";
import { LeadStage } from "@/lib/crm";
import { AnimatedNumber } from "@/lib/dashboardMotion";

export interface LeadLivePipelineProps {
  pipelineCounts: Record<LeadStage, number>;
  totalLeads?: number;
  isLoading?: boolean;
  canAccessAllLeads?: boolean;
  onSelectStage?: (stage: LeadStage) => void;
}

export interface PipelineStageConfig {
  key: LeadStage;
  label: string;
  color: string;
}

export const PIPELINE_STAGES: PipelineStageConfig[] = [
  { key: "NEW", label: "New", color: "#2488FF" },
  { key: "CONTACTED", label: "Contacted", color: "#60A9ED" },
  { key: "INTERESTED", label: "Interested", color: "#567DB1" },
  { key: "FOLLOW_UP", label: "Follow-up", color: "#425BC9" },
  { key: "WON", label: "Won", color: "#8EDBFF" },
  { key: "LOST", label: "Lost", color: "#8197B8" },
];

export function formatSharePercentage(count: number, total: number): string {
  if (total <= 0 || count <= 0) return "0%";
  const pct = (count / total) * 100;
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export function LeadLivePipeline({
  pipelineCounts,
  totalLeads: passedTotal,
  isLoading = false,
  canAccessAllLeads = true,
  onSelectStage,
}: LeadLivePipelineProps) {
  const [hoveredStage, setHoveredStage] = useState<LeadStage | null>(null);

    // Compute calculated total from counts so ring and numbers always agree
    const calculatedTotal = useMemo(() => {
      return PIPELINE_STAGES.reduce((sum, s) => sum + (pipelineCounts?.[s.key] || 0), 0);
    }, [pipelineCounts]);

    const totalLeads = typeof passedTotal === "number" && passedTotal >= calculatedTotal ? passedTotal : calculatedTotal;

    // Filter only active stages for the doughnut ring slices
    const activeSlices = useMemo(() => {
      return PIPELINE_STAGES.filter((s) => (pipelineCounts?.[s.key] || 0) > 0);
    }, [pipelineCounts]);

    // SVG ring parameters matching mockup
    const size = 220;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 18;

    // Compute geometry for multi-slice ring with rounded caps and subtle gaps
    const sliceArcs = useMemo(() => {
      const n = activeSlices.length;
      if (totalLeads <= 0 || n === 0) return [];

      if (n === 1) {
        return [{
          stage: activeSlices[0],
          isFullCircle: true,
          pathData: "",
        }];
      }

      const gapDeg = 5; // degrees of gap between adjacent rounded tips
      const capDeg = (strokeWidth / 2 / radius) * (180 / Math.PI); // cap compensation
      const totalGapSpan = n * gapDeg;
      const availableDeg = 360 - totalGapSpan;

      // Start angle so New begins just past 12 o'clock (~15 deg) matching mockup
      let currentAngle = 15;
      const arcs: { stage: PipelineStageConfig; isFullCircle: boolean; pathData: string }[] = [];

      for (let i = 0; i < n; i++) {
        const stage = activeSlices[i];
        const count = pipelineCounts?.[stage.key] || 0;
        const sliceDeg = (count / totalLeads) * availableDeg;
        const rawStart = currentAngle + gapDeg / 2;
        const rawEnd = rawStart + sliceDeg;

        let arcStart = rawStart + capDeg;
        let arcEnd = rawEnd - capDeg;

        if (arcEnd <= arcStart) {
          const mid = (rawStart + rawEnd) / 2;
          arcStart = mid - 0.1;
          arcEnd = mid + 0.1;
        }

        const pathData = describeArc(center, center, radius, arcStart, arcEnd);
        arcs.push({ stage, isFullCircle: false, pathData });

        currentAngle = rawEnd + gapDeg / 2;
      }

      return arcs;
    }, [activeSlices, totalLeads, radius, strokeWidth, center, pipelineCounts]);

    return (
          <div className="crm-pipeline-widget-root">
            {/* 1. CARD HEADER */}
            <div className="pipeline-header">
              <div>
                <h2 className="pipeline-title">Pipeline Stages</h2>
                <p className="pipeline-subtitle">Lead distribution by stage</p>
              </div>
              <div className="pipeline-total-badge">
                <span className="pipeline-total-badge-text">
                  <AnimatedNumber value={totalLeads} /> total
                </span>
              </div>
            </div>

      {/* 2. CARD BODY: CHART (LEFT) & TABLE LEGEND (RIGHT) */}
      <div className="pipeline-body">
        {/* Left Column: Circular Doughnut Ring */}
        <div className="pipeline-chart-col">
          <div className="pipeline-ring-wrap">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="pipeline-doughnut-svg"
              aria-label={`Pipeline distribution: ${totalLeads} total leads`}
              role="img"
            >
              {/* Neutral background track / placeholder ring */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={strokeWidth}
              />

              {/* Slices or empty state ring */}
              {isLoading ? (
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="rgba(36, 136, 255, 0.2)"
                  strokeWidth={strokeWidth}
                  className="pipeline-skeleton-ring"
                />
              ) : totalLeads === 0 || sliceArcs.length === 0 ? (
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth={strokeWidth}
                  className="pipeline-empty-ring"
                />
              ) : (
                <g className="pipeline-slices-group">
                  {sliceArcs.map(({ stage, isFullCircle, pathData }) => {
                    const isHovered = hoveredStage === stage.key;
                    const strokeW = isHovered ? strokeWidth + 3 : strokeWidth;

                    if (isFullCircle) {
                      return (
                        <circle
                          key={stage.key}
                          cx={center}
                          cy={center}
                          r={radius}
                          fill="none"
                          stroke={stage.color}
                          strokeWidth={strokeW}
                          className="pipeline-doughnut-slice dash-animated-pipeline-fill"
                          style={{
                            cursor: canAccessAllLeads ? "pointer" : "default",
                            transition: "stroke-width 0.2s ease, filter 0.2s ease",
                            filter: isHovered ? "brightness(1.15)" : undefined,
                          }}
                          onClick={() => canAccessAllLeads && onSelectStage?.(stage.key)}
                          onMouseEnter={() => setHoveredStage(stage.key)}
                          onMouseLeave={() => setHoveredStage(null)}
                        >
                          <title>{`${stage.label}: ${totalLeads} leads (100%)`}</title>
                        </circle>
                      );
                    }

                    return (
                      <path
                        key={stage.key}
                        d={pathData}
                        fill="none"
                        stroke={stage.color}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                        className="pipeline-doughnut-slice dash-animated-pipeline-fill"
                        style={{
                          cursor: canAccessAllLeads ? "pointer" : "default",
                          transition: "stroke-width 0.2s ease, filter 0.2s ease",
                          filter: isHovered ? `drop-shadow(0 0 6px ${stage.color}88) brightness(1.12)` : undefined,
                        }}
                        onClick={() => canAccessAllLeads && onSelectStage?.(stage.key)}
                        onMouseEnter={() => setHoveredStage(stage.key)}
                        onMouseLeave={() => setHoveredStage(null)}
                      >
                        <title>{`${stage.label}: ${pipelineCounts?.[stage.key] || 0} leads (${formatSharePercentage(pipelineCounts?.[stage.key] || 0, totalLeads)})`}</title>
                      </path>
                    );
                  })}
                </g>
              )}

              {/* Center Text */}
              <text
                x={center}
                y={center - 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="pipeline-center-count"
              >
                {totalLeads}
              </text>
              <text
                x={center}
                y={center + 24}
                textAnchor="middle"
                dominantBaseline="central"
                className="pipeline-center-label"
              >
                {totalLeads === 0 ? "No leads yet" : "Total leads"}
              </text>
            </svg>
          </div>
        </div>

        {/* Divider on desktop */}
        <div className="pipeline-col-divider" />

        {/* Right Column: Stage Table Legend */}
        <div className="pipeline-table-col">
          {/* Table Header */}
          <div className="pipeline-table-header" role="row">
            <span className="pipeline-th pipeline-th-stage">STAGE</span>
            <span className="pipeline-th pipeline-th-leads">LEADS</span>
            <span className="pipeline-th pipeline-th-share">SHARE</span>
          </div>

          {/* Table Rows */}
          <div className="pipeline-table-rows" role="list">
            {PIPELINE_STAGES.map((stg) => {
              const count = pipelineCounts?.[stg.key] || 0;
              const hasLeads = count > 0;
              const share = formatSharePercentage(count, totalLeads);
              const isHovered = hoveredStage === stg.key;

              return (
                <div
                  key={stg.key}
                  className={`pipeline-table-row ${canAccessAllLeads ? "is-clickable" : ""} ${isHovered ? "is-active" : ""}`}
                  role={canAccessAllLeads ? "button" : "listitem"}
                  tabIndex={canAccessAllLeads ? 0 : undefined}
                  aria-label={`${stg.label}: ${count} leads, ${share}`}
                  onClick={() => canAccessAllLeads && onSelectStage?.(stg.key)}
                  onMouseEnter={() => setHoveredStage(stg.key)}
                  onMouseLeave={() => setHoveredStage(null)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && canAccessAllLeads) {
                      e.preventDefault();
                      onSelectStage?.(stg.key);
                    }
                  }}
                >
                  {/* Stage Name & Dot */}
                  <div className="pipeline-stage-info">
                    <span
                      className="pipeline-dot"
                      style={{
                        background: hasLeads ? stg.color : "rgba(255, 255, 255, 0.16)",
                        boxShadow: hasLeads && isHovered ? `0 0 6px ${stg.color}` : "none",
                      }}
                    />
                    <span
                      className="pipeline-stage-label"
                      style={{
                        color: hasLeads ? "var(--text-primary, #F8FAFC)" : "var(--text-muted, #64748B)",
                      }}
                    >
                      {stg.label}
                    </span>
                  </div>

                  {/* Leads Count */}
                  <span
                    className="pipeline-lead-count"
                    style={{
                      color: hasLeads ? "var(--text-primary, #F8FAFC)" : "var(--text-muted, #64748B)",
                    }}
                  >
                    <AnimatedNumber value={count} />
                  </span>

                  {/* Share % */}
                  <span
                    className="pipeline-lead-share"
                    style={{
                      color: hasLeads ? "#94A3B8" : "#64748B",
                    }}
                  >
                    {share}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
          </div>
        </div>
        );
}
