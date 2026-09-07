"use client";

import React, { useState, useEffect, useRef } from "react";

interface LegalConsentModalProps {
  isOpen: boolean;
  onConsentAccepted: () => void;
}

export default function LegalConsentModal({ isOpen, onConsentAccepted }: LegalConsentModalProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => firstCheckboxRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const allAccepted = termsAccepted && privacyAccepted && cookieConsent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAccepted || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsAccepted: true,
          privacyAccepted: true,
          cookieConsent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to record legal consent.");
      }

      onConsentAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay modal-active"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      role="presentation"
    >
      <div
        className="modal-card glass-solid"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-consent-title"
        aria-describedby="legal-consent-desc"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.98))",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "20px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15)",
          padding: "2rem",
          color: "#f8fafc",
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
          }
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 1rem",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 20px rgba(14, 165, 233, 0.4)",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#ffffff" }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h2
            id="legal-consent-title"
            style={{
              fontSize: "1.65rem",
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: "0.5rem",
              letterSpacing: "-0.02em",
            }}
          >
            Welcome to Zappit
          </h2>
          <p
            id="legal-consent-desc"
            style={{
              fontSize: "0.95rem",
              color: "#94a3b8",
              lineHeight: 1.5,
              maxWidth: "440px",
              margin: "0 auto",
            }}
          >
            Before you continue, please review and accept our Terms of Service, Privacy Policy, and Cookie Policy.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: "0.875rem",
              marginBottom: "1.25rem",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.875rem 1rem",
              borderRadius: "12px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <input
              ref={firstCheckboxRef}
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                marginTop: "2px",
                accentColor: "#0ea5e9",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "0.925rem", color: "#e2e8f0", lineHeight: 1.4 }}>
              I agree to the{" "}
              <a
                href="/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 600 }}
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.875rem 1rem",
              borderRadius: "12px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                marginTop: "2px",
                accentColor: "#0ea5e9",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "0.925rem", color: "#e2e8f0", lineHeight: 1.4 }}>
              I acknowledge the{" "}
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 600 }}
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </a>
            </span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              padding: "0.875rem 1rem",
              borderRadius: "12px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <input
              type="checkbox"
              checked={cookieConsent}
              onChange={(e) => setCookieConsent(e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                marginTop: "2px",
                accentColor: "#0ea5e9",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "0.925rem", color: "#e2e8f0", lineHeight: 1.4 }}>
              I accept the use of{" "}
              <a
                href="/cookie-policy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#38bdf8", textDecoration: "underline", fontWeight: 600 }}
                onClick={(e) => e.stopPropagation()}
              >
                Cookies
              </a>
            </span>
          </label>

          <button
            type="submit"
            disabled={!allAccepted || loading}
            style={{
              marginTop: "0.5rem",
              width: "100%",
              padding: "0.875rem 1.5rem",
              borderRadius: "12px",
              fontSize: "1rem",
              fontWeight: 600,
              color: "#ffffff",
              background: allAccepted
                ? "linear-gradient(135deg, #0ea5e9, #2563eb)"
                : "rgba(148, 163, 184, 0.2)",
              border: "none",
              cursor: allAccepted && !loading ? "pointer" : "not-allowed",
              boxShadow: allAccepted
                ? "0 4px 20px rgba(14, 165, 233, 0.4)"
                : "none",
              opacity: allAccepted && !loading ? 1 : 0.6,
              transition: "all 0.2s ease",
            }}
          >
            {loading ? "Saving consent..." : "Accept & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
