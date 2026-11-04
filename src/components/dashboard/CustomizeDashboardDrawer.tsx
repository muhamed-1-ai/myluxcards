"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  SlidersHorizontal,
  LayoutGrid,
  CreditCard,
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";

export interface ItemPreference {
  id: string;
  defaultTitle: string;
  visible: boolean;
  order: number;
  displayName?: string;
}

export interface UserDashboardPreferences {
  version: number;
  cards: ItemPreference[];
  sections: ItemPreference[];
}

export const DEFAULT_DASHBOARD_CARDS: ItemPreference[] = [
  { id: "todays_leads", defaultTitle: "Today's Leads", visible: true, order: 0 },
  { id: "total_leads", defaultTitle: "Total Leads", visible: true, order: 1 },
  { id: "closed_leads", defaultTitle: "Closed Leads", visible: true, order: 2 },
  { id: "active_users", defaultTitle: "Active Users", visible: true, order: 3 },
];

export const DEFAULT_DASHBOARD_SECTIONS: ItemPreference[] = [
  { id: "daily_capacity", defaultTitle: "Daily Follow-Up Capacity", visible: true, order: 0 },
  { id: "growth_velocity", defaultTitle: "Growth Velocity", visible: true, order: 1 },
  { id: "pipeline_stages", defaultTitle: "Pipeline Stages", visible: true, order: 2 },
  { id: "lob_analysis", defaultTitle: "LOB Analysis", visible: true, order: 3 },
  { id: "calendar_companion", defaultTitle: "Calendar & Reminders", visible: true, order: 4 },
];

/**
 * Normalizes and migrates section preferences.
 * Carries over the legacy combined 'growth_pipeline' visibility to both
 * 'growth_velocity' and 'pipeline_stages' on first load.
 */
export function normalizeDashboardSections(savedSections?: ItemPreference[]): ItemPreference[] {
  const defaults = DEFAULT_DASHBOARD_SECTIONS;
  if (!Array.isArray(savedSections) || savedSections.length === 0) {
    return defaults.map((d) => ({ ...d }));
  }

  const hasLegacy = savedSections.some((s) => s.id === "growth_pipeline");
  const hasGrowth = savedSections.some((s) => s.id === "growth_velocity");
  const hasPipeline = savedSections.some((s) => s.id === "pipeline_stages");

  let expanded = [...savedSections];
  if (hasLegacy && (!hasGrowth || !hasPipeline)) {
    const legacy = savedSections.find((s) => s.id === "growth_pipeline")!;
    const legacyVisible = legacy.visible !== false;
    const legacyOrder = typeof legacy.order === "number" ? legacy.order : 1;

    expanded = expanded.filter((s) => s.id !== "growth_pipeline");

    if (!hasGrowth) {
      expanded.push({
        id: "growth_velocity",
        defaultTitle: "Growth Velocity",
        visible: legacyVisible,
        order: legacyOrder,
        displayName: legacy.displayName ? `${legacy.displayName} (Growth)` : undefined,
      });
    }
    if (!hasPipeline) {
      expanded.push({
        id: "pipeline_stages",
        defaultTitle: "Pipeline Stages",
        visible: legacyVisible,
        order: legacyOrder + 1,
        displayName: legacy.displayName ? `${legacy.displayName} (Pipeline)` : undefined,
      });
    }
  }

  const result: ItemPreference[] = [];
  expanded.forEach((s) => {
    const def = defaults.find((d) => d.id === s.id);
    if (def) {
      result.push({
        id: s.id,
        defaultTitle: def.defaultTitle,
        visible: s.visible !== false,
        order: typeof s.order === "number" ? s.order : def.order,
        displayName: s.displayName,
      });
    }
  });

  defaults.forEach((def) => {
    if (!result.some((r) => r.id === def.id)) {
      result.push({
        ...def,
        order: result.length,
      });
    }
  });

  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function normalizeDashboardCards(savedCards?: ItemPreference[]): ItemPreference[] {
  const defaults = DEFAULT_DASHBOARD_CARDS;
  if (!Array.isArray(savedCards) || savedCards.length === 0) {
    return defaults.map((d) => ({ ...d }));
  }

  const result: ItemPreference[] = [];
  savedCards.forEach((c) => {
    const def = defaults.find((d) => d.id === c.id);
    if (def) {
      result.push({
        id: c.id,
        defaultTitle: def.defaultTitle,
        visible: c.visible !== false,
        order: typeof c.order === "number" ? c.order : def.order,
        displayName: c.displayName,
      });
    }
  });

  defaults.forEach((def) => {
    if (!result.some((r) => r.id === def.id)) {
      result.push({
        ...def,
        order: result.length,
      });
    }
  });

  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function normalizeDashboardPreferences(prefs?: Partial<UserDashboardPreferences>): UserDashboardPreferences {
  return {
    version: 1,
    cards: normalizeDashboardCards(prefs?.cards),
    sections: normalizeDashboardSections(prefs?.sections),
  };
}

interface CustomizeDashboardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrefs: UserDashboardPreferences;
  onSave: (newPrefs: UserDashboardPreferences) => Promise<void>;
  activeTab?: "cards" | "sections";
}

export function CustomizeDashboardDrawer({
  isOpen,
  onClose,
  currentPrefs,
  onSave,
  activeTab = "cards",
}: CustomizeDashboardDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTab, setCurrentTab] = useState<"cards" | "sections">("cards");
  const [draftCards, setDraftCards] = useState<ItemPreference[]>([]);
  const [draftSections, setDraftSections] = useState<ItemPreference[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // SSR hydration check for Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll when open and restore scroll position on close
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Sync draft state and active tab whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setSaving(false);
      setErrorMsg("");
      setCurrentTab(activeTab || "cards");
      setDraftCards(normalizeDashboardCards(currentPrefs?.cards));
      setDraftSections(normalizeDashboardSections(currentPrefs?.sections));

      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, currentPrefs, activeTab]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen || !mounted) return null;

  // Toggle Visibility
  const toggleVisibility = (group: "cards" | "sections", id: string) => {
    const setter = group === "cards" ? setDraftCards : setDraftSections;
    setter((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    );
  };

  // Reorder Item
  const moveItem = (group: "cards" | "sections", index: number, direction: "up" | "down") => {
    const items = group === "cards" ? [...draftCards] : [...draftSections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    items.forEach((item, idx) => {
      item.order = idx;
    });

    if (group === "cards") setDraftCards(items);
    else setDraftSections(items);
  };

  // Display Name Change
  const handleNameChange = (group: "cards" | "sections", id: string, name: string) => {
    const setter = group === "cards" ? setDraftCards : setDraftSections;
    setter((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, displayName: name.slice(0, 60) } : item
      )
    );
  };

  // Reset to Default
  const handleResetToDefault = () => {
    setDraftCards(DEFAULT_DASHBOARD_CARDS.map((c) => ({ ...c })));
    setDraftSections(DEFAULT_DASHBOARD_SECTIONS.map((s) => ({ ...s })));
    setErrorMsg("");
  };

  // Submit Save
  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const finalPrefs: UserDashboardPreferences = {
        version: 1,
        cards: draftCards.map((c, idx) => ({ ...c, order: idx })),
        sections: draftSections.map((s, idx) => ({ ...s, order: idx })),
      };
      await onSave(finalPrefs);
      onClose();
    } catch (err: any) {
      console.error("[CustomizeDashboardDrawer] Save error:", err);
      setErrorMsg(err?.message || "Failed to save dashboard customization.");
    } finally {
      setSaving(false);
    }
  };

  const visibleCardsCount = draftCards.filter((c) => c.visible).length;
  const visibleSectionsCount = draftSections.filter((s) => s.visible).length;

  const drawerContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "flex-end",
        animation: "dashDrawerFadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Customize Dashboard Drawer"
    >
      <style>{`
        @keyframes dashDrawerFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dashDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media (max-width: 640px) {
          .crm-customize-drawer-panel {
            max-width: 100% !important;
            border-left: none !important;
          }
        }
        .crm-customize-drawer-panel {
          height: 100vh;
          height: 100dvh;
        }
      `}</style>
      <div
        ref={drawerRef}
        className="crm-customize-drawer-panel"
        style={{
          width: "100%",
          maxWidth: 520,
          height: "100dvh",
          maxHeight: "100dvh",
          background: "var(--surface, #0B132B)",
          borderLeft: "1px solid var(--border-color, #1E293B)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.6)",
          color: "var(--text-primary, #F8FAFC)",
          overflow: "hidden",
          animation: "dashDrawerSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* PINNED HEADER */}
        <div
          style={{
            flexShrink: 0,
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border-color, #1E293B)",
            background: "var(--surface, #0B132B)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Header Row: Title & Close Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(0, 102, 255, 0.15)",
                  color: "#0066FF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {currentTab === "sections" ? (
                  <LayoutGrid style={{ width: 20, height: 20 }} />
                ) : (
                  <SlidersHorizontal style={{ width: 20, height: 20 }} />
                )}
              </div>
              <div>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    margin: 0,
                    color: "var(--text-primary, #F8FAFC)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {currentTab === "sections" ? "Manage Sections" : "Customize Dashboard"}
                </h2>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary, #94A3B8)",
                    margin: "2px 0 0",
                    fontWeight: 500,
                  }}
                >
                  {currentTab === "sections"
                    ? "Control section visibility and arrange dashboard layout."
                    : "Choose which KPI cards and sections appear on your dashboard."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              title="Close drawer"
              aria-label="Close drawer"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "1px solid var(--border-color, #1E293B)",
                background: "var(--bg-secondary, #1E293B)",
                color: "var(--text-secondary, #94A3B8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Tab Navigation Pills */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              padding: 4,
              borderRadius: 10,
              background: "var(--bg-secondary, #141E33)",
              border: "1px solid var(--border-color, #1E293B)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setCurrentTab("sections");
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: currentTab === "sections" ? "#0066FF" : "transparent",
                color: currentTab === "sections" ? "#FFFFFF" : "var(--text-secondary, #94A3B8)",
                boxShadow: currentTab === "sections" ? "0 2px 8px rgba(0, 102, 255, 0.35)" : "none",
              }}
            >
              <LayoutGrid style={{ width: 15, height: 15 }} />
              <span>Sections</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontWeight: 800,
                  background: currentTab === "sections" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                  color: currentTab === "sections" ? "#FFFFFF" : "var(--text-secondary, #94A3B8)",
                }}
              >
                {visibleSectionsCount}/{draftSections.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentTab("cards");
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: currentTab === "cards" ? "#0066FF" : "transparent",
                color: currentTab === "cards" ? "#FFFFFF" : "var(--text-secondary, #94A3B8)",
                boxShadow: currentTab === "cards" ? "0 2px 8px rgba(0, 102, 255, 0.35)" : "none",
              }}
            >
              <CreditCard style={{ width: 15, height: 15 }} />
              <span>KPI Cards</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontWeight: 800,
                  background: currentTab === "cards" ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                  color: currentTab === "cards" ? "#FFFFFF" : "var(--text-secondary, #94A3B8)",
                }}
              >
                {visibleCardsCount}/{draftCards.length}
              </span>
            </button>
          </div>
        </div>

        {/* ERROR ALERT IF SAVING FAILED */}
        {errorMsg && (
          <div
            style={{
              margin: "12px 24px 0",
              padding: "12px 16px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#F87171",
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* INDEPENDENTLY SCROLLABLE CONTENT BODY */}
        <div
          ref={scrollContainerRef}
          style={{
            flex: "1 1 0%",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "18px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {currentTab === "sections" ? (
            /* SECTIONS TAB CONTENT */
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#0066FF",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  DASHBOARD SECTIONS ({draftSections.length})
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94A3B8)" }}>
                  {visibleSectionsCount} of {draftSections.length} visible
                </span>
              </div>

              {draftSections.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    background: "var(--bg-secondary, #141E33)",
                    border: `1px solid ${item.visible ? "var(--border-color, #1E293B)" : "rgba(100, 116, 139, 0.2)"}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    opacity: item.visible ? 1 : 0.65,
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Row 1: Section Title & Reorder Arrows */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text-primary, #F8FAFC)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.defaultTitle}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: item.visible ? "rgba(0, 102, 255, 0.15)" : "rgba(100, 116, 139, 0.15)",
                          color: item.visible ? "#0066FF" : "#94A3B8",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {item.visible ? "Visible" : "Hidden"}
                      </span>
                    </div>

                    {/* Up / Down Reorder */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveItem("sections", index, "up")}
                        title="Move Up"
                        aria-label={`Move ${item.defaultTitle} up`}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color, #1E293B)",
                          background: "var(--surface, #0B132B)",
                          color: "var(--text-secondary, #94A3B8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          opacity: index === 0 ? 0.3 : 1,
                        }}
                      >
                        <ChevronUp style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        type="button"
                        disabled={index === draftSections.length - 1}
                        onClick={() => moveItem("sections", index, "down")}
                        title="Move Down"
                        aria-label={`Move ${item.defaultTitle} down`}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color, #1E293B)",
                          background: "var(--surface, #0B132B)",
                          color: "var(--text-secondary, #94A3B8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: index === draftSections.length - 1 ? "not-allowed" : "pointer",
                          opacity: index === draftSections.length - 1 ? 0.3 : 1,
                        }}
                      >
                        <ChevronDown style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Labelled "Show on dashboard" Switch */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <label
                      htmlFor={`switch-sec-${item.id}`}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-secondary, #94A3B8)",
                        cursor: "pointer",
                        userSelect: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>Show on dashboard</span>
                    </label>

                    <button
                      id={`switch-sec-${item.id}`}
                      type="button"
                      role="switch"
                      aria-checked={item.visible}
                      aria-label={`Show ${item.defaultTitle} on dashboard`}
                      onClick={() => toggleVisibility("sections", item.id)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: item.visible ? "#0066FF" : "#334155",
                        position: "relative",
                        cursor: "pointer",
                        border: "none",
                        transition: "background-color 0.2s ease",
                        padding: 2,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#FFFFFF",
                          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                          transform: item.visible ? "translateX(20px)" : "translateX(0px)",
                          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          display: "block",
                        }}
                      />
                    </button>
                  </div>

                  {/* Row 3: Display Name Input */}
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "var(--text-secondary, #94A3B8)",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                        textTransform: "uppercase",
                      }}
                    >
                      DISPLAY NAME
                    </span>
                    <input
                      type="text"
                      value={item.displayName || ""}
                      onChange={(e) => handleNameChange("sections", item.id, e.target.value)}
                      placeholder={item.defaultTitle}
                      maxLength={60}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "var(--surface, #0B132B)",
                        border: "1px solid var(--border-color, #1E293B)",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "var(--text-primary, #F8FAFC)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              ))}
            </>
          ) : (
            /* CARDS TAB CONTENT */
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#0066FF",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  KPI CARDS ({draftCards.length})
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, #94A3B8)" }}>
                  {visibleCardsCount} of {draftCards.length} visible
                </span>
              </div>

              {draftCards.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    background: "var(--bg-secondary, #141E33)",
                    border: `1px solid ${item.visible ? "var(--border-color, #1E293B)" : "rgba(100, 116, 139, 0.2)"}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    opacity: item.visible ? 1 : 0.65,
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Row 1: Card Title & Reorder Arrows */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text-primary, #F8FAFC)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.defaultTitle}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: item.visible ? "rgba(0, 102, 255, 0.15)" : "rgba(100, 116, 139, 0.15)",
                          color: item.visible ? "#0066FF" : "#94A3B8",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {item.visible ? "Visible" : "Hidden"}
                      </span>
                    </div>

                    {/* Up / Down Reorder */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveItem("cards", index, "up")}
                        title="Move Up"
                        aria-label={`Move ${item.defaultTitle} up`}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color, #1E293B)",
                          background: "var(--surface, #0B132B)",
                          color: "var(--text-secondary, #94A3B8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: index === 0 ? "not-allowed" : "pointer",
                          opacity: index === 0 ? 0.3 : 1,
                        }}
                      >
                        <ChevronUp style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        type="button"
                        disabled={index === draftCards.length - 1}
                        onClick={() => moveItem("cards", index, "down")}
                        title="Move Down"
                        aria-label={`Move ${item.defaultTitle} down`}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color, #1E293B)",
                          background: "var(--surface, #0B132B)",
                          color: "var(--text-secondary, #94A3B8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: index === draftCards.length - 1 ? "not-allowed" : "pointer",
                          opacity: index === draftCards.length - 1 ? 0.3 : 1,
                        }}
                      >
                        <ChevronDown style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Labelled "Show on dashboard" Switch */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <label
                      htmlFor={`switch-card-${item.id}`}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-secondary, #94A3B8)",
                        cursor: "pointer",
                        userSelect: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>Show on dashboard</span>
                    </label>

                    <button
                      id={`switch-card-${item.id}`}
                      type="button"
                      role="switch"
                      aria-checked={item.visible}
                      aria-label={`Show ${item.defaultTitle} on dashboard`}
                      onClick={() => toggleVisibility("cards", item.id)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: item.visible ? "#0066FF" : "#334155",
                        position: "relative",
                        cursor: "pointer",
                        border: "none",
                        transition: "background-color 0.2s ease",
                        padding: 2,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#FFFFFF",
                          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                          transform: item.visible ? "translateX(20px)" : "translateX(0px)",
                          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          display: "block",
                        }}
                      />
                    </button>
                  </div>

                  {/* Row 3: Display Name Input */}
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "var(--text-secondary, #94A3B8)",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                        textTransform: "uppercase",
                      }}
                    >
                      DISPLAY NAME
                    </span>
                    <input
                      type="text"
                      value={item.displayName || ""}
                      onChange={(e) => handleNameChange("cards", item.id, e.target.value)}
                      placeholder={item.defaultTitle}
                      maxLength={60}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "var(--surface, #0B132B)",
                        border: "1px solid var(--border-color, #1E293B)",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "var(--text-primary, #F8FAFC)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* PINNED FOOTER (WITH SAFE-AREA PADDING) */}
        <div
          style={{
            flexShrink: 0,
            padding: "16px 24px calc(16px + env(safe-area-inset-bottom, 0px)) 24px",
            borderTop: "1px solid var(--border-color, #1E293B)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface, #0B132B)",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary, #94A3B8)",
              background: "none",
              border: "1px solid var(--border-color, #1E293B)",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
            <span>Reset to Default</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary, #F8FAFC)",
                background: "var(--bg-secondary, #1E293B)",
                border: "1px solid var(--border-color, #1E293B)",
                borderRadius: 8,
                padding: "8px 16px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 800,
                color: "#FFFFFF",
                background: "#0066FF",
                border: "none",
                borderRadius: 8,
                padding: "9px 20px",
                cursor: saving ? "wait" : "pointer",
                boxShadow: "0 4px 14px rgba(0, 102, 255, 0.35)",
              }}
            >
              {saving ? (
                <>
                  <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check style={{ width: 15, height: 15, strokeWidth: 3 }} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
