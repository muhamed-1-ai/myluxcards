"use client";

import { LeadStage } from "@/lib/crm";
import { ArrowUpRight } from "lucide-react";

interface LeadLivePipelineProps {
  pipelineCounts: Record<LeadStage, number>;
  totalLeads?: number;
  onSelectStage?: (stage: LeadStage) => void;
}

const STAGES: { key: LeadStage; label: string; accentColor: string; fillGradient?: string }[] = [
  { key: "NEW", label: "NEW", accentColor: "#0066FF", fillGradient: "linear-gradient(90deg, #0066FF 0%, #F5D77F 100%)" },
  { key: "CONTACTED", label: "CONTACTED", accentColor: "#3B82F6", fillGradient: "linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)" },
  { key: "INTERESTED", label: "INTERESTED", accentColor: "#EC4899", fillGradient: "linear-gradient(90deg, #EC4899 0%, #F472B6 100%)" },
  { key: "FOLLOW_UP", label: "FOLLOW-UP", accentColor: "#F59E0B", fillGradient: "linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)" },
  { key: "WON", label: "WON", accentColor: "#10B981", fillGradient: "linear-gradient(90deg, #10B981 0%, #34D399 100%)" },
  { key: "LOST", label: "LOST", accentColor: "#EF4444", fillGradient: "linear-gradient(90deg, #EF4444 0%, #F87171 100%)" },
];

export function LeadLivePipeline({
  pipelineCounts,
  totalLeads: passedTotal,
  onSelectStage,
}: LeadLivePipelineProps) {
  const calculatedTotal = Object.values(pipelineCounts || {}).reduce((sum, val) => sum + (val || 0), 0);
  const totalLeads = typeof passedTotal === "number" ? passedTotal : calculatedTotal;

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
      {/* Header matching reference */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF", margin: 0 }}>Pipeline Stages</h2>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: "2px 0 0" }}>
          Lead stage distribution and funnels
        </p>
      </div>

      {/* Stage Rows Container */}
      <div className="scrollbar-thin" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
        {STAGES.map((stg) => {
          const count = pipelineCounts?.[stg.key] || 0;
          const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
          const isSingular = count === 1;

          return (
            <div
              key={stg.key}
              onClick={() => onSelectStage && onSelectStage(stg.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.05)",
                background: "#181924",
                cursor: onSelectStage ? "pointer" : "default",
                minHeight: 54,
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
            >
              {/* Row Header: Stage Name & Badge */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: stg.accentColor }} />
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", color: "#FFFFFF" }}>
                    {stg.label}
                  </span>
                </div>

                <div style={{ background: "#12131A", border: "1px solid rgba(0, 229, 255, 0.3)", color: "#0066FF", padding: "2px 10px", borderRadius: 50, fontSize: 11, fontWeight: 800 }}>
                  {count} {isSingular ? "Lead" : "Leads"}
                </div>
              </div>

              {/* Progress Bar Track */}
              <div
                style={{ position: "relative", width: "100%", height: 7, background: "#0B0C10", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden", margin: "2px 0" }}
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${stg.label} Leads: ${count} of ${totalLeads}`}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${percentage}%`,
                    background: stg.fillGradient || "linear-gradient(90deg, #0066FF 0%, #F5D77F 100%)",
                    transition: "width 0.5s ease-out",
                  }}
                />
              </div>

              {/* Flex Meta: Percentage (Left) & View Link (Right) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#94A3B8" }}>
                <span>{percentage}% of total Leads</span>
                {onSelectStage && (
                  <span style={{ color: "#0066FF", display: "flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 700 }}>
                    View <ArrowUpRight style={{ width: 12, height: 12 }} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
