"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, Palette, X, RefreshCw } from "lucide-react";
import {
  type ProfileThemePreference,
  normalizeProfileThemePreference,
  resolveThemeTokens,
} from "@/lib/themeTokens";

export interface CompactProfileThemeSwitcherProps {
  card: {
    theme?: string;
    profileTheme?: string;
    profileBackground?: string;
    profileAccent?: string;
    profileText?: string;
    modernConfig?: any;
    profileThemePreference?: string;
  };
  currentPreference: ProfileThemePreference;
  onSelectTheme: (pref: ProfileThemePreference) => void;
  saving?: boolean;
  saveError?: string;
  onRetry?: () => void;
}

interface ThemeCardOption {
  id: ProfileThemePreference;
  label: string;
  descriptor: string;
  leftColor: string;
  rightColor: string;
  isDashboard?: boolean;
}

export function CompactProfileThemeSwitcher({
  card,
  currentPreference,
  onSelectTheme,
  saving = false,
  saveError = "",
  onRetry,
}: CompactProfileThemeSwitcherProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Compute live dashboard colors for dynamic inheritance preview
  const dashTokens = resolveThemeTokens({
    ...card,
    profileThemePreference: "dashboard",
  });
  const dashBg = dashTokens.tokens.background || "#050B14";
  const dashAccent = dashTokens.tokens.primary || card.profileAccent || "#0066FF";

  const options: ThemeCardOption[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      descriptor: "Follows saved dashboard appearance",
      leftColor: dashBg,
      rightColor: dashAccent,
      isDashboard: true,
    },
    {
      id: "carbon_platinum",
      label: "Carbon Platinum",
      descriptor: "Carbon black & platinum",
      leftColor: "#101214",
      rightColor: "#B9C2CC",
    },
    {
      id: "black_white",
      label: "Black & White",
      descriptor: "Pure black profile with white contrast",
      leftColor: "#000000",
      rightColor: "#FFFFFF",
    },
    {
      id: "white_black",
      label: "White & Black",
      descriptor: "Pure white profile with black contrast",
      leftColor: "#FFFFFF",
      rightColor: "#000000",
    },
  ];

  const activePref = normalizeProfileThemePreference(currentPreference);
  const activeOpt = options.find((o) => o.id === activePref) || options[0];

  // Click outside and Escape key listeners for popover dismissal
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsExpanded(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExpanded(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <div className="pts-compact-wrap">
      {/* ── Collapsed Single Theme Control (Trigger) ── */}
      <button
        ref={triggerRef}
        type="button"
        className={`pts-compact-trigger ${isExpanded ? "expanded" : ""}`}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isExpanded}
        aria-label={`Theme: ${activeOpt.label}. Tap to choose profile theme`}
        title={`Theme: ${activeOpt.label} (Tap to change)`}
      >
        <span className="pts-compact-trigger-swatch" aria-hidden="true">
          <span
            className="pts-compact-trigger-half-left"
            style={{ backgroundColor: activeOpt.leftColor }}
          />
          <span
            className="pts-compact-trigger-half-right"
            style={{ backgroundColor: activeOpt.rightColor }}
          />
        </span>
        <Palette size={11} className="pts-compact-trigger-icon" aria-hidden="true" />
      </button>

      {/* ── Expanded Floating Theme Chooser Panel ── */}
      {isExpanded && (
        <div
          ref={popoverRef}
          className="pts-compact-popover"
          role="dialog"
          aria-modal="true"
          aria-label="Profile Theme Chooser"
        >
          {/* Header with Title, Status & Close Button */}
          <div className="pts-compact-popover-header">
            <div className="pts-compact-popover-title-row">
              <Palette size={12} className="pts-compact-title-icon" aria-hidden="true" />
              <span className="pts-compact-title-text">Profile Theme</span>
              {saving && <span className="pts-compact-status saving" aria-live="polite">Saving…</span>}
            </div>
            <button
              type="button"
              className="pts-compact-close-btn"
              onClick={() => setIsExpanded(false)}
              aria-label="Close theme chooser"
              title="Close"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {/* Theme Swatches (4 Exact Options in One Compact Row) */}
          <div
            className="pts-compact-options-row"
            role="radiogroup"
            aria-label="Select digital profile theme"
          >
            {options.map((opt) => {
              const isSelected = activePref === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`pts-compact-opt-btn ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectTheme(opt.id)}
                  title={`${opt.label}: ${opt.descriptor}`}
                  aria-label={`${opt.label} Theme`}
                >
                  <div className="pts-compact-opt-swatch" aria-hidden="true">
                    <span
                      className="pts-compact-opt-half-left"
                      style={{ backgroundColor: opt.leftColor }}
                    />
                    <span
                      className="pts-compact-opt-half-right"
                      style={{ backgroundColor: opt.rightColor }}
                    />
                    {isSelected && (
                      <span className="pts-compact-opt-check" aria-hidden="true">
                        <Check size={8} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Error & Retry Notice if saving fails */}
          {saveError && (
            <div className="pts-compact-error-notice" role="alert">
              <button
                type="button"
                onClick={onRetry}
                className="pts-compact-retry-btn"
                title="Failed to save theme. Tap to retry."
              >
                Save failed · Tap to retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CompactProfileThemeSwitcher;

