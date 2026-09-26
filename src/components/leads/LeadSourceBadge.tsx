"use client";

import React, { useState } from "react";
import { getLeadSourceConfig } from "@/lib/lead-source";

export interface LeadSourceBadgeProps {
  source?: string | null;
  compact?: boolean;
  className?: string;
  showTooltip?: boolean;
}

export function LeadSourceBadge({
  source,
  compact = false,
  className = "",
  showTooltip = true,
}: LeadSourceBadgeProps) {
  const config = getLeadSourceConfig(source);
  const Icon = config.icon;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center group/sourceBadge ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          height: "26px",
          padding: compact ? "0 8px" : "0 11px",
          borderRadius: "9999px",
          fontSize: "12px",
          fontWeight: 600,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          lineHeight: 1,
          background: config.badgeStyle.bg,
          border: `1px solid ${config.badgeStyle.border}`,
          color: config.badgeStyle.text,
          boxShadow: isHovered && config.badgeStyle.glow ? `0 0 12px ${config.badgeStyle.glow}` : "none",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: "default",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <Icon
          style={{
            width: "13px",
            height: "13px",
            flexShrink: 0,
            color: config.badgeStyle.text,
          }}
        />
        <span>{compact ? config.shortLabel : config.label}</span>
      </span>

      {/* Interactive Floating Tooltip */}
      {showTooltip && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/sourceBadge:opacity-100 transition-all duration-200 z-50"
          style={{ transform: "translate(-50%, -4px)" }}
        >
          <div
            style={{
              background: "#0B1528",
              border: `1px solid ${config.badgeStyle.border}`,
              color: "#F1F5F9",
              padding: "5px 10px",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
              letterSpacing: "0.01em",
            }}
          >
            {config.tooltip}
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadSourceBadge;
