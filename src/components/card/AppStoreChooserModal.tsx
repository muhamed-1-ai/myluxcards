"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { DetectedOS } from "@/lib/device";
import { isValidStoreUrl } from "@/lib/cards";
import { BrandLogo } from "./BrandLogo";

export interface AppDownloadSettings {
  appName?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
  referralUrl?: string;
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

  const rawApple = (appDownload?.appStoreUrl || "").trim();
  const rawGoogle = (appDownload?.playStoreUrl || "").trim();
  const hasApple = Boolean(rawApple && isValidStoreUrl(rawApple, "apple"));
  const hasGoogle = Boolean(rawGoogle && isValidStoreUrl(rawGoogle, "google"));
  const appleUrl = hasApple ? (/^https?:\/\//i.test(rawApple) ? rawApple : `https://${rawApple}`) : "";
  const googleUrl = hasGoogle ? (/^https?:\/\//i.test(rawGoogle) ? rawGoogle : `https://${rawGoogle}`) : "";
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
                href={appleUrl}
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
                  <BrandLogo brand="appstore" size={28} />
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
                href={googleUrl}
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
                  <BrandLogo brand="playstore" size={28} />
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
