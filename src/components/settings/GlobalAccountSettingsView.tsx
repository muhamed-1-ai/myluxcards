"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  Mail,
  KeyRound,
  ExternalLink,
  Moon,
  Sun,
  LogOut,
  Save,
  Check,
  CreditCard,
  Building,
} from "lucide-react";

interface GlobalAccountSettingsViewProps {
  currentUser?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    featurePermissions?: Record<string, boolean>;
  } | null;
  onUpdateNickname?: (newName: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export default function GlobalAccountSettingsView({
  currentUser,
  onUpdateNickname,
  onNavigateTab,
}: GlobalAccountSettingsViewProps) {
  // Account identity states (loaded from /api/auth/me)
  const [accountEmail, setAccountEmail] = useState<string>(currentUser?.email || "");
  const [accountName, setAccountName] = useState<string>(currentUser?.name || "");
  const [accountRole, setAccountRole] = useState<string>(currentUser?.role || "USER");
  const [isGoogleOnly, setIsGoogleOnly] = useState<boolean>(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState<boolean>(true);

  // Nickname editing state
  const [editingName, setEditingName] = useState<string>("");
  const [savingName, setSavingName] = useState<boolean>(false);
  const [nameSuccess, setNameSuccess] = useState<string>("");
  const [nameError, setNameError] = useState<string>("");

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsWarning, setCapsWarning] = useState<"current" | "new" | "confirm" | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Add Password setup link state (Google users)
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupSuccessMessage, setSetupSuccessMessage] = useState("");
  const [setupErrorMessage, setSetupErrorMessage] = useState("");
  const [setupCooldown, setSetupCooldown] = useState(0);

  // Theme preference state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Fetch verified account identity from /api/auth/me
  useEffect(() => {
    async function loadAccountIdentity() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const verifiedEmail = data.email || data.user?.email || currentUser?.email || "";
          const verifiedName = data.name || data.user?.name || currentUser?.name || "";
          const verifiedRole = data.role || data.user?.role || currentUser?.role || "USER";

          setAccountEmail(verifiedEmail);
          setAccountName(verifiedName);
          setEditingName(verifiedName);
          setAccountRole(verifiedRole);
          setIsGoogleOnly(Boolean(data.isGoogleOnly));
          setHasPassword(data.hasPassword !== undefined ? Boolean(data.hasPassword) : true);
        } else {
          if (currentUser?.email) setAccountEmail(currentUser.email);
          if (currentUser?.name) {
            setAccountName(currentUser.name);
            setEditingName(currentUser.name);
          }
          if (currentUser?.role) setAccountRole(currentUser.role);
          setHasPassword(true);
        }
      } catch {
        if (currentUser?.email) setAccountEmail(currentUser.email);
        if (currentUser?.name) {
          setAccountName(currentUser.name);
          setEditingName(currentUser.name);
        }
        setHasPassword(true);
      } finally {
        setLoadingIdentity(false);
      }
    }
    loadAccountIdentity();
  }, [currentUser]);

  // Setup link cooldown countdown
  useEffect(() => {
    if (setupCooldown <= 0) return;
    const interval = setInterval(() => {
      setSetupCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [setupCooldown]);

  // Check current theme
  useEffect(() => {
    if (typeof document !== "undefined") {
      const isDark =
        document.documentElement.getAttribute("data-theme") !== "light" &&
        !document.body.classList.contains("light-mode");
      setIsDarkMode(isDark);
    }
  }, []);

  const handleToggleTheme = () => {
    if (typeof document === "undefined") return;
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.remove("light-mode");
      document.body.classList.add("dark-mode");
      try {
        localStorage.setItem("theme", "dark");
      } catch {}
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.remove("dark-mode");
      document.body.classList.add("light-mode");
      try {
        localStorage.setItem("theme", "light");
      } catch {}
    }
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editingName.trim();
    if (!trimmed) {
      setNameError("Display name cannot be empty.");
      return;
    }
    if (trimmed.length < 2) {
      setNameError("Display name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setNameError("Display name cannot exceed 50 characters.");
      return;
    }

    setSavingName(true);
    setNameError("");
    setNameSuccess("");

    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAccountName(trimmed);
        setNameSuccess("Display name updated successfully.");
        if (onUpdateNickname) onUpdateNickname(trimmed);
        setTimeout(() => setNameSuccess(""), 4000);
      } else {
        setNameError(data.message || "Failed to update display name.");
      }
    } catch {
      setNameError("Network error while saving display name.");
    } finally {
      setSavingName(false);
    }
  };

  const handleSendSetupLink = async () => {
    setSetupErrorMessage("");
    setSetupSuccessMessage("");
    setSetupSubmitting(true);
    try {
      const res = await fetch("/api/auth/setup-password/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSetupErrorMessage(data.message || "Failed to send password setup link. Please try again.");
        return;
      }
      setSetupSuccessMessage(
        data.message || "A secure password setup link has been sent to your verified email address."
      );
      setSetupCooldown(60);
    } catch {
      setSetupErrorMessage("Network error occurred. Please try again.");
    } finally {
      setSetupSubmitting(false);
    }
  };

  const passwordRules = [
    { label: "12+ characters", met: newPassword.length >= 12 },
    { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter (a-z)", met: /[a-z]/.test(newPassword) },
    { label: "Number (0-9)", met: /\d/.test(newPassword) },
    { label: "Special symbol (!@#$%...)", met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const allRulesMet = passwordRules.every((r) => r.met);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }

    if (!allRulesMet) {
      setPasswordError("New password must meet all complexity requirements.");
      return;
    }

    if (!passwordsMatch) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from your current password.");
      return;
    }

    setSubmittingPassword(true);
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
        setPasswordError(data.message || "Failed to update password. Please check your current password.");
        return;
      }

      setPasswordSuccess("Password updated successfully! All active sessions have been secured.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Optional redirect to login after session invalidation
      setTimeout(() => {
        window.location.href = "/?login=1&changed=1";
      }, 3000);
    } catch {
      setPasswordError("Network connection error. Please try again.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.href = "/?login=1";
  };

  return (
    <div className="global-settings-container" style={{ maxWidth: "860px", margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "rgba(0, 102, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--apple-blue, #0066FF)",
            }}
          >
            <Shield size={20} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
            Account Settings
          </h1>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--acc-text-muted, #94a3b8)", margin: 0 }}>
          Manage your personal profile, authenticated login credentials, security preferences, and active sessions.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        {/* CARD 1: Profile & Identity */}
        <section
          className="acc-card"
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--acc-card-bg, #1a1d24)",
            border: "1px solid var(--acc-border, rgba(255, 255, 255, 0.08))",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <User size={18} style={{ color: "#38bdf8" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
              Profile &amp; Account Identity
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
            {/* Registered Account Email (FIXED: Never Unknown) */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                backgroundColor: "rgba(15, 23, 42, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--acc-text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Registered Login Email
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.7rem",
                    color: "#10b981",
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle2 size={12} />
                  Verified
                </span>
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 600, color: "#FFFFFF", wordBreak: "break-all" }}>
                {loadingIdentity ? "Loading..." : accountEmail || "No registered email"}
              </div>
              <p style={{ fontSize: "0.725rem", color: "#64748b", margin: "0.4rem 0 0 0", lineHeight: 1.4 }}>
                Primary authenticated login identifier used for security alerts and credential recovery.
              </p>
            </div>

            {/* Account Role & Access */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "8px",
                backgroundColor: "rgba(15, 23, 42, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--acc-text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Account Authority
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "6px",
                    backgroundColor: accountRole === "SUPER_ADMIN" || accountRole === "OWNER" ? "rgba(0, 102, 255, 0.15)" : "rgba(255, 255, 255, 0.1)",
                    color: accountRole === "SUPER_ADMIN" || accountRole === "OWNER" ? "#38bdf8" : "#e2e8f0",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                  }}
                >
                  {accountRole}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--acc-text-muted, #94a3b8)" }}>
                  {isGoogleOnly ? "Google Sign-In Account" : "Password Authenticated"}
                </span>
              </div>
              <p style={{ fontSize: "0.725rem", color: "#64748b", margin: "0.4rem 0 0 0", lineHeight: 1.4 }}>
                System permissions are mapped to your authenticated identity.
              </p>
            </div>
          </div>

          {/* Display Name / Nickname Editor */}
          <form onSubmit={handleSaveNickname} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "1.25rem" }}>
            <label
              htmlFor="settings-display-name"
              style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.5rem" }}
            >
              Display Name &middot; Nickname
            </label>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                id="settings-display-name"
                type="text"
                value={editingName}
                onChange={(e) => {
                  setEditingName(e.target.value);
                  if (nameError) setNameError("");
                }}
                placeholder="Enter your display name"
                maxLength={50}
                disabled={savingName}
                style={{
                  flex: "1 1 240px",
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: nameError ? "1px solid #ef4444" : "1px solid var(--acc-border, #334155)",
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  color: "#FFFFFF",
                  fontSize: "0.9375rem",
                }}
              />
              <button
                type="submit"
                className="acc-btn acc-btn-primary acc-btn-sm"
                disabled={savingName || editingName.trim() === accountName}
                style={{ height: "40px", padding: "0 18px", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                {savingName ? (
                  "Saving..."
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Name</span>
                  </>
                )}
              </button>
            </div>

            {nameError && (
              <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.5rem", marginBottom: 0 }}>
                {nameError}
              </p>
            )}
            {nameSuccess && (
              <p style={{ color: "#10b981", fontSize: "0.8rem", marginTop: "0.5rem", marginBottom: 0, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Check size={14} />
                {nameSuccess}
              </p>
            )}
          </form>
        </section>

        {/* CARD 2: Security & Password */}
        <section
          className="acc-card"
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--acc-card-bg, #1a1d24)",
            border: "1px solid var(--acc-border, rgba(255, 255, 255, 0.08))",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Lock size={18} style={{ color: "#38bdf8" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
              Password &amp; Credentials
            </h2>
          </div>

          {/* Case A: Account without password (Google Only) */}
          {hasPassword === false ? (
            <div
              style={{
                padding: "1.25rem",
                borderRadius: "10px",
                backgroundColor: "rgba(2, 132, 199, 0.08)",
                border: "1px solid rgba(2, 132, 199, 0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <KeyRound size={18} style={{ color: "#38bdf8" }} />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "#FFFFFF" }}>
                  Add Password to Google Account
                </h3>
              </div>
              <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 1rem" }}>
                Your account currently signs in with Google (<strong>{accountEmail}</strong>). Adding a password enables direct email and password login to this account while keeping your Google sign-in and profile records intact.
              </p>

              {setupSuccessMessage && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#34d399",
                    fontSize: "0.85rem",
                    marginBottom: "1rem",
                  }}
                >
                  ✓ {setupSuccessMessage}
                </div>
              )}

              {setupErrorMessage && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    fontSize: "0.85rem",
                    marginBottom: "1rem",
                  }}
                >
                  {setupErrorMessage}
                </div>
              )}

              <button
                type="button"
                className="acc-btn acc-btn-primary"
                onClick={handleSendSetupLink}
                disabled={setupSubmitting || setupCooldown > 0}
                style={{
                  opacity: setupSubmitting || setupCooldown > 0 ? 0.6 : 1,
                  cursor: setupSubmitting || setupCooldown > 0 ? "not-allowed" : "pointer",
                }}
              >
                {setupCooldown > 0
                  ? `Resend available in ${setupCooldown}s`
                  : setupSubmitting
                  ? "Sending setup link..."
                  : "Email Password Setup Link"}
              </button>
            </div>
          ) : (
            /* Case B: Account with password (Change Password Form) */
            <form onSubmit={handleChangePassword}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                {/* Current Password */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <label
                      htmlFor="settings-current-pwd"
                      style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#e2e8f0" }}
                    >
                      Current Password *
                    </label>
                    <a
                      href="/forgot-password"
                      style={{ fontSize: "0.75rem", color: "#38bdf8", textDecoration: "none" }}
                    >
                      Forgot current password?
                    </a>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      id="settings-current-pwd"
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      onKeyUp={(e) => setCapsWarning(e.getModifierState("CapsLock") ? "current" : null)}
                      onBlur={() => setCapsWarning(null)}
                      placeholder="Enter current password"
                      required
                      autoComplete="current-password"
                      style={{
                        width: "100%",
                        height: "42px",
                        padding: "0 42px 0 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--acc-border, #334155)",
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        color: "#FFFFFF",
                        fontSize: "0.9375rem",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      aria-label={showCurrent ? "Hide password" : "Show password"}
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
                        padding: "4px",
                      }}
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {capsWarning === "current" && (
                    <small style={{ color: "#f59e0b", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                      Caps Lock is on
                    </small>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label
                    htmlFor="settings-new-pwd"
                    style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.4rem" }}
                  >
                    New Password *
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="settings-new-pwd"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onKeyUp={(e) => setCapsWarning(e.getModifierState("CapsLock") ? "new" : null)}
                      onBlur={() => setCapsWarning(null)}
                      placeholder="At least 12 characters"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      style={{
                        width: "100%",
                        height: "42px",
                        padding: "0 42px 0 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--acc-border, #334155)",
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        color: "#FFFFFF",
                        fontSize: "0.9375rem",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      aria-label={showNew ? "Hide password" : "Show password"}
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
                        padding: "4px",
                      }}
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {capsWarning === "new" && (
                    <small style={{ color: "#f59e0b", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                      Caps Lock is on
                    </small>
                  )}

                  {/* Password requirements rules checkmarks */}
                  <div
                    style={{
                      marginTop: "0.6rem",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      backgroundColor: "rgba(15, 23, 42, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                      Password Requirements:
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.35rem" }}>
                      {passwordRules.map((rule) => (
                        <div
                          key={rule.label}
                          style={{
                            fontSize: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            color: rule.met ? "#34d399" : "#64748b",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{rule.met ? "✓" : "○"}</span>
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label
                    htmlFor="settings-confirm-pwd"
                    style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#e2e8f0", marginBottom: "0.4rem" }}
                  >
                    Confirm New Password *
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="settings-confirm-pwd"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyUp={(e) => setCapsWarning(e.getModifierState("CapsLock") ? "confirm" : null)}
                      onBlur={() => setCapsWarning(null)}
                      placeholder="Repeat new password"
                      required
                      autoComplete="new-password"
                      style={{
                        width: "100%",
                        height: "42px",
                        padding: "0 42px 0 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--acc-border, #334155)",
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        color: "#FFFFFF",
                        fontSize: "0.9375rem",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
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
                        padding: "4px",
                      }}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <small
                      style={{
                        color: passwordsMatch ? "#34d399" : "#ef4444",
                        fontSize: "0.75rem",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </small>
                  )}
                </div>

                {passwordError && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      backgroundColor: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      fontSize: "0.85rem",
                    }}
                  >
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      backgroundColor: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#34d399",
                      fontSize: "0.85rem",
                    }}
                  >
                    {passwordSuccess}
                  </div>
                )}

                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    type="submit"
                    className="acc-btn acc-btn-primary"
                    disabled={submittingPassword || !allRulesMet || !passwordsMatch}
                    style={{
                      padding: "0.625rem 1.5rem",
                      opacity: submittingPassword || !allRulesMet || !passwordsMatch ? 0.6 : 1,
                      cursor: submittingPassword || !allRulesMet || !passwordsMatch ? "not-allowed" : "pointer",
                    }}
                  >
                    {submittingPassword ? "Updating Password..." : "Save New Password"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Active Sessions & Security Notice */}
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              borderRadius: "8px",
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#38bdf8", marginBottom: "0.25rem" }}>
              Active Session Protection
            </div>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              Security notice: Updating your password immediately terminates active login sessions on all other web browsers and mobile devices. You will be required to sign in again with your new credentials.
            </p>
          </div>
        </section>

        {/* CARD 3: Personal Preferences */}
        <section
          className="acc-card"
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--acc-card-bg, #1a1d24)",
            border: "1px solid var(--acc-border, rgba(255, 255, 255, 0.08))",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Sun size={18} style={{ color: "#facc15" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--acc-text-main, #FFFFFF)" }}>
              Personal Preferences
            </h2>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem",
              borderRadius: "8px",
              backgroundColor: "rgba(15, 23, 42, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#FFFFFF" }}>Interface Theme</div>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted, #94a3b8)" }}>
                Currently active: {isDarkMode ? "Dark Mode" : "Light Mode"}
              </span>
            </div>
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm"
              onClick={handleToggleTheme}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              {isDarkMode ? <Sun size={14} style={{ color: "#facc15" }} /> : <Moon size={14} />}
              <span>Switch to {isDarkMode ? "Light Mode" : "Dark Mode"}</span>
            </button>
          </div>
        </section>

        {/* CARD 4: Account Deletion & Danger Zone (Visually Separated) */}
        <section
          className="acc-card"
          style={{
            padding: "1.5rem",
            backgroundColor: "rgba(239, 68, 68, 0.03)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <AlertTriangle size={18} style={{ color: "#ef4444" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "#ef4444" }}>
              Account Deletion &amp; Data Protection
            </h2>
          </div>

          <p style={{ fontSize: "0.8125rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 1rem" }}>
            Permanent account deletion irrecoverably removes your user credentials, digital business cards, CRM leads, and associated assets in accordance with our data retention policy.
          </p>

          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "8px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#FFFFFF", display: "block" }}>
                Need to delete or close your account?
              </span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {accountRole === "SUPER_ADMIN" || accountRole === "ADMIN"
                  ? "Admins can manage user account lifecycle and deletion in the Admin Portal."
                  : "Contact support from your registered email address to request permanent account closure."}
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(accountRole === "SUPER_ADMIN" || accountRole === "ADMIN") && (
                <a
                  href="/admin"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", textDecoration: "none" }}
                >
                  <ExternalLink size={13} />
                  <span>Admin Portal</span>
                </a>
              )}
              <button
                type="button"
                className="acc-btn acc-btn-sm"
                onClick={handleLogout}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <LogOut size={13} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

