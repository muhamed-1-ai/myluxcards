"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { DetectedOS } from "@/lib/device";

export interface AppDownloadSettings {
  appName?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
}

export interface AppStoreChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  appDownload?: AppDownloadSettings;
  detectedOS?: DetectedOS;
}

export function AppStoreChooserModal({
  isOpen,
  onClose,
  appDownload,
  detectedOS = "unknown",
}: AppStoreChooserModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const hasApple = Boolean(appDownload?.appStoreUrl?.trim());
  const hasGoogle = Boolean(appDownload?.playStoreUrl?.trim());
  const appName = (appDownload?.appName || "").trim();

  // Escape key listener and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Initial focus on close button or dialog
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Explanatory guidance based on configuration & device
  let guidanceText = "Select your store to download the app directly to your device.";
  if (hasApple && hasGoogle) {
    if (detectedOS === "desktop") {
      guidanceText = "Choose your device's store below to view or install the app.";
    } else {
      guidanceText = "Select which app store you would like to open.";
    }
  } else if (hasApple && !hasGoogle) {
    if (detectedOS === "android") {
      guidanceText = "This app is currently available for iOS devices on the Apple App Store.";
    } else {
      guidanceText = "Available for iOS devices on the Apple App Store.";
    }
  } else if (!hasApple && hasGoogle) {
    if (detectedOS === "ios") {
      guidanceText = "This app is currently available for Android devices on Google Play.";
    } else {
      guidanceText = "Available for Android devices on Google Play.";
    }
  }

  const deviceLabel =
    detectedOS === "ios"
      ? "iOS (iPhone/iPad)"
      : detectedOS === "android"
      ? "Android"
      : detectedOS === "desktop"
      ? "Desktop"
      : "Mobile / Tablet";

  return (
    <div
      className="zappit-store-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zappit-store-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        className="zappit-store-modal-dialog"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#0d131f",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderRadius: 20,
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 102, 255, 0.2)",
          color: "#ffffff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "zappitModalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "20px 22px 16px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 16px rgba(37, 99, 235, 0.35)",
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#FFFFFF" aria-hidden="true">
                <path d="M12 15.5l-4-4h2.5V5.5h3v6H16l-4 4zm-6 2.5v-1.5h12V18H6z" />
              </svg>
            </div>
            <div>
              <h2
                id="zappit-store-modal-title"
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: "-0.01em",
                }}
              >
                {appName ? `Get ${appName}` : "Download Our App"}
              </h2>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 3,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#94a3b8",
                }}
              >
                Device: {deviceLabel}
              </span>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close store chooser"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "rgba(255, 255, 255, 0.75)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: "20px 22px 24px" }}>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: 13,
              color: "#cbd5e1",
              lineHeight: 1.5,
            }}
          >
            {guidanceText}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* APPLE APP STORE BUTTON */}
            {hasApple && (
              <a
                href={appDownload?.appStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zappit-store-btn zappit-store-apple"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 18px",
                  borderRadius: 14,
                  background: "#000000",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  minHeight: 56,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.89c.65-.79 1.1-1.9 0.98-3-.95.04-2.09.64-2.76 1.43-.59.68-1.11 1.78-.97 2.85 1.05.08 2.12-.53 2.75-1.28z" />
                  </svg>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", fontWeight: 500 }}>
                    Download on the
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
                    App Store
                  </span>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 14, color: "#94a3b8" }}>↗</span>
              </a>
            )}

            {/* GOOGLE PLAY STORE BUTTON */}
            {hasGoogle && (
              <a
                href={appDownload?.playStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zappit-store-btn zappit-store-google"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 18px",
                  borderRadius: 14,
                  background: "#000000",
                  border: "1px solid rgba(255, 255, 255, 0.22)",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  minHeight: 56,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path fill="#4285F4" d="M3.6 1.7l11.2 11.2-3.1 3.1L2.1 2.9C2.4 2.3 2.9 1.8 3.6 1.7z" />
                    <path fill="#34A853" d="M18.8 9.8l-4 2.3-3.1-3.1 3.1-3.1 4 2.3c.7.4 1.2 1 1.2 1.6s-.5 1.2-1.2 1.6z" />
                    <path fill="#EA4335" d="M11.7 9l3.1 3.1-11.2 11.2c-.7-.1-1.2-.6-1.5-1.2L11.7 9z" />
                    <path fill="#FBBC04" d="M14.8 12.1l-3.1 3.1 3.1 3.1 4-2.3c.7-.4 1.2-1 1.2-1.6s-.5-1.2-1.2-1.6l-4-2.3z" />
                  </svg>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
                  <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", fontWeight: 500 }}>
                    GET IT ON
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
                    Google Play
                  </span>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 14, color: "#94a3b8" }}>↗</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
