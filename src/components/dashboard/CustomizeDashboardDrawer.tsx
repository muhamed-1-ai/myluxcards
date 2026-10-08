"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  SlidersHorizontal,
  X,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Check,
  Loader2,
  CheckSquare,
  Square,
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
  { id: "growth_pipeline", defaultTitle: "Growth Velocity & Pipeline Stages", visible: true, order: 1 },
  { id: "product_performance", defaultTitle: "Product Performance", visible: true, order: 2 },
  { id: "lob_analysis", defaultTitle: "LOB Analysis", visible: true, order: 3 },
  { id: "calendar_companion", defaultTitle: "Calendar & Reminders", visible: true, order: 4 },
];

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
  const [draftCards, setDraftCards] = useState<ItemPreference[]>([]);
  const [draftSections, setDraftSections] = useState<ItemPreference[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const sectionsRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Initialize draft whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setSaving(false);
      setErrorMsg("");

      // Merge currentPrefs with default registry so new/removed widgets handle gracefully
      const mergeGroup = (saved: ItemPreference[], defaults: ItemPreference[]): ItemPreference[] => {
        const savedMap = new Map((saved || []).map((s) => [s.id, s]));
        const result: ItemPreference[] = [];

        // Add saved in order
        (saved || []).forEach((s, idx) => {
          const def = defaults.find((d) => d.id === s.id);
          if (def) {
            result.push({
              id: s.id,
              defaultTitle: def.defaultTitle,
              visible: typeof s.visible === "boolean" ? s.visible : true,
              order: typeof s.order === "number" ? s.order : idx,
              displayName: s.displayName,
            });
          }
        });

        // Add any missing default widgets
        defaults.forEach((def, idx) => {
          if (!result.some((r) => r.id === def.id)) {
            result.push({
              ...def,
              order: result.length,
            });
          }
        });

        return result;
      };

      setDraftCards(mergeGroup(currentPrefs.cards, DEFAULT_DASHBOARD_CARDS));
      setDraftSections(mergeGroup(currentPrefs.sections, DEFAULT_DASHBOARD_SECTIONS));

      if (activeTab === "sections" && sectionsRef.current) {
        setTimeout(() => {
          sectionsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 150);
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

  if (!isOpen) return null;

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

    // Swap elements
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    // Update orders
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

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "flex-end",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        ref={drawerRef}
        style={{
          width: "100%",
          maxWidth: 510,
          height: "100vh",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.5)",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(0, 102, 255, 0.12)",
                color: "#0066FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SlidersHorizontal style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  margin: 0,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                Customize Dashboard
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: "#94A3B8",
                  margin: "2px 0 0",
                  fontWeight: 500,
                }}
              >
                Choose which cards and sections appear on your dashboard.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              background: "var(--bg-secondary)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* ERROR ALERT IF SAVING FAILED */}
        {errorMsg && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "12px 16px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#F87171",
              fontSize: 13,
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* CONTENT AREA (INDEPENDENTLY SCROLLABLE) */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {/* GROUP 1: DASHBOARD CARDS */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#0066FF",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                DASHBOARD CARDS ({draftCards.length})
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>
                {visibleCardsCount} visible
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {draftCards.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    opacity: item.visible ? 1 : 0.65,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={() => toggleVisibility("cards", item.id)}
                        style={{ display: "none" }}
                      />
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          border: item.visible ? "none" : "2px solid #64748B",
                          background: item.visible ? "#0066FF" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#FFFFFF",
                        }}
                      >
                        {item.visible && <Check style={{ width: 14, height: 14, strokeWidth: 3 }} />}
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.defaultTitle}
                      </span>
                    </label>

                    {/* UP / DOWN ARROWS */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveItem("cards", index, "up")}
                        title="Move Up"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color)",
                          background: "var(--surface)",
                          color: "var(--text-muted)",
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
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color)",
                          background: "var(--surface)",
                          color: "var(--text-muted)",
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

                  {/* DISPLAY NAME INPUT */}
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#94A3B8",
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
                        background: "var(--surface)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GROUP 2: DASHBOARD SECTIONS */}
          <div ref={sectionsRef}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#0066FF",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                DASHBOARD SECTIONS ({draftSections.length})
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8" }}>
                {visibleSectionsCount} visible
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {draftSections.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    opacity: item.visible ? 1 : 0.65,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={() => toggleVisibility("sections", item.id)}
                        style={{ display: "none" }}
                      />
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          border: item.visible ? "none" : "2px solid #64748B",
                          background: item.visible ? "#0066FF" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#FFFFFF",
                        }}
                      >
                        {item.visible && <Check style={{ width: 14, height: 14, strokeWidth: 3 }} />}
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.defaultTitle}
                      </span>
                    </label>

                    {/* UP / DOWN ARROWS */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveItem("sections", index, "up")}
                        title="Move Up"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color)",
                          background: "var(--surface)",
                          color: "var(--text-muted)",
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
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          border: "1px solid var(--border-color)",
                          background: "var(--surface)",
                          color: "var(--text-muted)",
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

                  {/* DISPLAY NAME INPUT */}
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#94A3B8",
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
                        background: "var(--surface)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "var(--text-primary)",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
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
              color: "var(--text-muted)",
              background: "none",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
            Reset to Default
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
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
                  Saving...
                </>
              ) : (
                <>
                  <Check style={{ width: 15, height: 15, strokeWidth: 3 }} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
