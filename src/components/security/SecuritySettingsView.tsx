"use client";

import React, { useState } from "react";
import { Shield, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, ExternalLink } from "lucide-react";

interface SecuritySettingsViewProps {
  user: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  } | null;
}

export default function SecuritySettingsView({ user }: SecuritySettingsViewProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isGoogleManaged, setIsGoogleManaged] = useState<boolean | null>(null);

  // Check whether the user is Google-managed on mount
  React.useEffect(() => {
    async function checkAccountType() {
      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json().catch(() => ({}));
        // We can inspect whether user has credentials or is Google-only
        const profileRes = await fetch("/api/auth/me").catch(() => null);
        if (profileRes && profileRes.ok) {
          const profileData = await profileRes.json().catch(() => ({}));
          if (profileData.isGoogleOnly) {
            setIsGoogleManaged(true);
          } else {
            setIsGoogleManaged(false);
          }
        } else {
          setIsGoogleManaged(false);
        }
      } catch {
        setIsGoogleManaged(false);
      }
    }
    checkAccountType();
  }, []);

  const passwordRules = [
    { label: "12+ characters", met: newPassword.length >= 12 },
    { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter (a-z)", met: /[a-z]/.test(newPassword) },
    { label: "Number (0-9)", met: /\d/.test(newPassword) },
    { label: "Special symbol (!@#$%...)", met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const allRulesMet = passwordRules.every((r) => r.met);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!currentPassword) {
      setErrorMessage("Current password is required.");
      return;
    }

    if (!allRulesMet) {
      setErrorMessage("New password does not meet all security requirements.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage("New password must be different from your current password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.message && data.message.includes("Google")) {
          setIsGoogleManaged(true);
        }
        setErrorMessage(data.message || "Failed to update password. Please verify your current password.");
        return;
      }

      setSuccessMessage("Password updated successfully! Signing you out to re-authenticate...");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Session revoked on server. Redirect to login after brief display
      setTimeout(() => {
        window.location.href = "/?login=1&changed=1";
      }, 1800);
    } catch (err) {
      setErrorMessage("Network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#38bdf8",
            }}
          >
            <Shield style={{ width: "22px", height: "22px" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
              Account Security
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--acc-text-muted, #94a3b8)", margin: "0.25rem 0 0" }}>
              Manage password credentials and active session protection for {user?.email || "your account"}.
            </p>
          </div>
        </div>
      </div>

      {/* Google-Only Managed Notice */}
      {isGoogleManaged ? (
        <div
          style={{
            backgroundColor: "rgba(30, 41, 59, 0.7)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "14px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#60a5fa",
                flexShrink: 0,
              }}
            >
              <KeyRound style={{ width: "20px", height: "20px" }} />
            </div>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem", color: "#FFFFFF" }}>
                Sign-In Managed via Google
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 1rem" }}>
                Your ZAPPIT account signs in directly through your Google identity (<strong>{user?.email}</strong>).
                Standalone passwords are not required or stored locally.
              </p>
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  color: "#38bdf8",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                <span>Manage Google Account Security</span>
                <ExternalLink style={{ width: "14px", height: "14px" }} />
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* Change Password Card */
        <div
          style={{
            backgroundColor: "var(--acc-card-bg, #1e293b)",
            border: "1px solid var(--acc-border, #334155)",
            borderRadius: "14px",
            padding: "1.75rem",
            boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <Lock style={{ width: "18px", height: "18px", color: "#38bdf8" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "#FFFFFF" }}>
              Change Password
            </h2>
          </div>

          {errorMessage && (
            <div
              role="alert"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.25rem",
              }}
            >
              <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                color: "#34d399",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.25rem",
              }}
            >
              <CheckCircle2 style={{ width: "16px", height: "16px", flexShrink: 0 }} />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Current Password */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="current-password"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "0.5rem",
                }}
              >
                Current Password *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="current-password"
                  name="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 46px 0 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--acc-border, #475569)",
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    color: "#FFFFFF",
                    fontSize: "0.9375rem",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  aria-label={showCurrent ? "Hide current password" : "Show current password"}
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "6px",
                  }}
                >
                  {showCurrent ? <EyeOff style={{ width: "18px", height: "18px" }} /> : <Eye style={{ width: "18px", height: "18px" }} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label
                htmlFor="new-password"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "0.5rem",
                }}
              >
                New Password *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="new-password"
                  name="newPassword"
                  type={showNew ? "text" : "password"}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 46px 0 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--acc-border, #475569)",
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    color: "#FFFFFF",
                    fontSize: "0.9375rem",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  aria-label={showNew ? "Hide new password" : "Show new password"}
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "6px",
                  }}
                >
                  {showNew ? <EyeOff style={{ width: "18px", height: "18px" }} /> : <Eye style={{ width: "18px", height: "18px" }} />}
                </button>
              </div>

              {/* Password Requirements Checklist */}
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "rgba(15, 23, 42, 0.5)",
                  borderRadius: "8px",
                  border: "1px solid rgba(51, 65, 85, 0.7)",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Password Requirements
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.375rem" }}>
                  {passwordRules.map((rule) => (
                    <div
                      key={rule.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        fontSize: "0.8125rem",
                        color: rule.met ? "#34d399" : "#94a3b8",
                        fontWeight: rule.met ? 600 : 400,
                      }}
                    >
                      <span>{rule.met ? "✓" : "○"}</span>
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirm New Password */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                htmlFor="confirm-password"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "0.5rem",
                }}
              >
                Confirm New Password *
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 46px 0 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--acc-border, #475569)",
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    color: "#FFFFFF",
                    fontSize: "0.9375rem",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "6px",
                  }}
                >
                  {showConfirm ? <EyeOff style={{ width: "18px", height: "18px" }} /> : <Eye style={{ width: "18px", height: "18px" }} />}
                </button>
              </div>
              {confirmPassword && (
                <div
                  style={{
                    marginTop: "0.375rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: passwordsMatch ? "#34d399" : "#f87171",
                  }}
                >
                  {passwordsMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !allRulesMet || !passwordsMatch || !currentPassword}
              style={{
                width: "100%",
                height: "46px",
                borderRadius: "10px",
                backgroundColor: "#0284c7",
                color: "#FFFFFF",
                fontSize: "0.9375rem",
                fontWeight: 600,
                border: "none",
                cursor: submitting || !allRulesMet || !passwordsMatch || !currentPassword ? "not-allowed" : "pointer",
                opacity: submitting || !allRulesMet || !passwordsMatch || !currentPassword ? 0.6 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {submitting ? "Saving New Password..." : "Save New Password"}
            </button>
          </form>

          <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted, #94a3b8)", marginTop: "1rem", lineHeight: 1.4 }}>
            Security notice: Updating your password immediately terminates any other active login sessions on your other devices. You will be required to sign in with your new password.
          </p>
        </div>
      )}

      {/* Account Email Information (Separated from Password Change) */}
      <div
        style={{
          marginTop: "1.5rem",
          padding: "1.25rem",
          borderRadius: "12px",
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          border: "1px solid var(--acc-border, #334155)",
        }}
      >
        <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted, #94a3b8)" }}>
          Registered Account Email
        </div>
        <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#FFFFFF", marginTop: "0.25rem" }}>
          {user?.email || "Unknown"}
        </div>
        <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0.5rem 0 0" }}>
          Email address changes are kept separate from password authentication for account recovery integrity. Contact system administrators to update primary email.
        </p>
      </div>
    </div>
  );
}
