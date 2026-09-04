"use client";

import React, { useState } from "react";
import { LayoutGrid, Check, Layers, BarChart3, Briefcase, Zap, SlidersHorizontal } from "lucide-react";

export type DashboardLayoutType = "business" | "digital_card" | "compact";

export interface DashboardLayoutSelectorProps {
  currentLayout: DashboardLayoutType;
  onSelectLayout: (layout: DashboardLayoutType) => Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
}

export const LAYOUT_OPTIONS: {
  id: DashboardLayoutType;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "business",
    title: "Business Overview",
    subtitle: "Balanced business view (Default)",
    description: "Combines profile entry analytics, active cards, completion status, and quick actions.",
    icon: <Briefcase className="w-5 h-5 text-[#0066FF]" />,
  },
  {
    id: "digital_card",
    title: "Digital Card",
    subtitle: "Profile analytics & NFC/QR focus",
    description: "Focuses on profile views, entry source breakdowns (NFC vs QR), completion, and QR sharing.",
    icon: <Layers className="w-5 h-5 text-blue-400" />,
  },
  {
    id: "compact",
    title: "Compact",
    subtitle: "Minimalist dashboard",
    description: "Streamlined single-screen summary with today's core metrics and fast action buttons.",
    icon: <Zap className="w-5 h-5 text-purple-400" />,
  },
];

export function DashboardLayoutSelectorModal({
  currentLayout,
  onSelectLayout,
  isOpen,
  onClose,
}: DashboardLayoutSelectorProps) {
  const [savingId, setSavingId] = useState<DashboardLayoutType | null>(null);

  if (!isOpen) return null;

  const handleSelect = async (layout: DashboardLayoutType) => {
    if (layout === currentLayout) return;
    setSavingId(layout);
    try {
      await onSelectLayout(layout);
      if (onClose) onClose();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div
        style={{
          width: "min(680px, 100%)",
          background: "#0B0C10",
          border: "1px solid rgba(0, 229, 255, 0.4)",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 25px 70px rgba(0,0,0,0.9), 0 0 30px rgba(0, 229, 255,0.1)",
          animation: "notifSlideDown 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              DASHBOARD PREFERENCES
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#FFF", margin: "2px 0 4px" }}>
              Choose Dashboard Layout
            </h2>
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              Select how your dashboard widgets and information priority are organized.
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "#888", fontSize: 20, cursor: "pointer", padding: 4 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 4 Layout Preview Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}>
          {LAYOUT_OPTIONS.map((opt) => {
            const isSelected = opt.id === currentLayout;
            const isSaving = savingId === opt.id;

            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                style={{
                  background: isSelected ? "rgba(0, 229, 255, 0.05)" : "#12131A",
                  border: isSelected ? "2px solid #0066FF" : "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: isSelected ? "0 0 20px rgba(0, 229, 255, 0.18)" : "none",
                  borderRadius: 16,
                  padding: 18,
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: "#0B0C10", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {opt.icon}
                    </div>

                    {isSelected && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", background: "rgba(0, 229, 255,0.18)", border: "1px solid rgba(0, 229, 255,0.35)", padding: "3px 10px", borderRadius: 10, display: "flex", alignItems: "center", gap: 4 }}>
                        <Check className="w-3 h-3" /> Current
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, color: isSelected ? "#F5E6A3" : "#FFF", margin: "0 0 2px" }}>
                    {opt.title}
                  </h3>
                  <div style={{ fontSize: 11.5, color: "#888", fontWeight: 600, marginBottom: 8 }}>
                    {opt.subtitle}
                  </div>
                  <p style={{ fontSize: 12, color: "#AAA", lineHeight: 1.45, margin: 0 }}>
                    {opt.description}
                  </p>
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "flex-end" }}>
                  {isSelected ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0066FF" }}>Active Layout ✓</span>
                  ) : (
                    <button
                      type="button"
                      disabled={isSaving}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        background: "#0D0E15",
                        color: "#0066FF",
                        border: "1px solid rgba(0, 229, 255,0.35)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isSaving ? "Updating..." : "Use Layout"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Compact Dropdown Header Selector */
export function CompactDashboardLayoutDropdown({
  currentLayout,
  onSelectLayout,
}: DashboardLayoutSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentOpt = LAYOUT_OPTIONS.find((o) => o.id === currentLayout) || LAYOUT_OPTIONS[0];

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="crm-pill-btn"
        style={{
          fontSize: 12,
          padding: "6px 14px",
          background: "#0D0E15",
          color: "#0066FF",
          borderColor: "rgba(0, 229, 255,0.35)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span>Layout: {currentOpt.title}</span>
        <span style={{ fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 240,
            background: "#0B0C10",
            border: "1px solid rgba(0, 229, 255, 0.35)",
            borderRadius: 14,
            boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
            zIndex: 90,
            overflow: "hidden",
            padding: 6,
          }}
        >
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={async () => {
                setOpen(false);
                if (opt.id !== currentLayout) {
                  await onSelectLayout(opt.id);
                }
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: opt.id === currentLayout ? 700 : 500,
                background: opt.id === currentLayout ? "rgba(0, 229, 255,0.15)" : "transparent",
                color: opt.id === currentLayout ? "#0066FF" : "#FFF",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{opt.title}</span>
              {opt.id === currentLayout && <Check className="w-3.5 h-3.5 text-[#0066FF]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
