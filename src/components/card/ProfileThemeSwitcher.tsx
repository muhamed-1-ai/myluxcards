"use client";

import React, { useRef, useEffect } from "react";
import { Check, RefreshCw, Palette } from "lucide-react";
import {
  type ProfileThemePreference,
  normalizeProfileThemePreference,
  resolveThemeTokens,
} from "@/lib/themeTokens";

export interface ProfileThemeSwitcherProps {
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

export function ProfileThemeSwitcher({
  card,
  currentPreference,
  onSelectTheme,
  saving = false,
  saveError = "",
  onRetry,
}: ProfileThemeSwitcherProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

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

  // Ensure active button stays visible within horizontal track on narrow viewports
  useEffect(() => {
    if (selectedButtonRef.current && trackRef.current) {
      selectedButtonRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activePref]);

  // Keyboard navigation for W3C ARIA radio group pattern
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = options.length - 1;
    }

    if (nextIndex >= 0) {
      const nextOption = options[nextIndex];
      onSelectTheme(nextOption.id);
      // Find and focus the next radio button
      if (trackRef.current) {
        const buttons = trackRef.current.querySelectorAll<HTMLButtonElement>("button[role='radio']");
        buttons[nextIndex]?.focus();
      }
    }
  };

  return (
    <section
      className="pts-container"
      role="region"
      aria-label="Profile Theme Switcher"
    >
      <div className="pts-header pts-desktop-only">
        <div className="pts-header-left">
          <Palette size={13} className="pts-header-icon" aria-hidden="true" />
          <span className="pts-header-title">Profile Theme</span>
        </div>
        <div className="pts-header-right">
          {saving && <span className="pts-status saving" aria-live="polite">Saving…</span>}
          {saveError && (
            <button
              type="button"
              onClick={onRetry}
              className="pts-retry-btn"
              title="Failed to save theme. Tap to retry."
            >
              Save failed · Retry
            </button>
          )}
        </div>
      </div>

      <div
        className="pts-options-grid pts-options-track"
        role="radiogroup"
        aria-label="Select digital profile theme"
        ref={trackRef}
      >
        {options.map((opt, idx) => {
          const isSelected = activePref === opt.id;
          return (
            <button
              key={opt.id}
              ref={isSelected ? selectedButtonRef : undefined}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={`pts-card ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectTheme(opt.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              title={`${opt.label}: ${opt.descriptor}`}
              aria-label={`${opt.label} Theme: ${opt.descriptor}`}
            >
              <div className="pts-swatch-split" aria-hidden="true">
                <div className="pts-swatch-inner">
                  <span
                    className="pts-swatch-left"
                    style={{ backgroundColor: opt.leftColor }}
                  />
                  <span
                    className="pts-swatch-right"
                    style={{ backgroundColor: opt.rightColor }}
                  />
                </div>
                {isSelected && (
                  <span className="pts-check-badge" aria-hidden="true">
                    <Check size={9} strokeWidth={3} />
                  </span>
                )}
              </div>
              <span className="pts-card-label pts-desktop-only">
                {opt.isDashboard && (
                  <RefreshCw size={9} className="pts-sync-icon" aria-hidden="true" />
                )}
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {saveError && (
        <div className="pts-mobile-retry" role="alert">
          <button
            type="button"
            onClick={onRetry}
            className="pts-retry-btn"
            title="Failed to save theme. Tap to retry."
          >
            Save failed · Tap to retry
          </button>
        </div>
      )}
    </section>
  );
}

export default ProfileThemeSwitcher;

