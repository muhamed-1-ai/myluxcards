"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import "./setup-password.css";

export default function SetupPasswordPage() {
  const [token, setToken] = useState("");
  const [tokenChecked, setTokenChecked] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmationValue, setConfirmationValue] = useState("");
  const [capsField, setCapsField] = useState<"password" | "confirmation" | null>(null);

  const passwordRules = [
    ["12+ characters", passwordValue.length >= 12],
    ["Uppercase letter", /[A-Z]/.test(passwordValue)],
    ["Lowercase letter", /[a-z]/.test(passwordValue)],
    ["Number", /\d/.test(passwordValue)],
    ["Special symbol", /[^A-Za-z0-9]/.test(passwordValue)],
  ] as const;

  const allRulesMet = passwordRules.every(([, met]) => met);
  const passwordsMatch = passwordValue.length > 0 && passwordValue === confirmationValue;

  useEffect(() => {
    // Referrer leakage prevention for token URLs
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);

    // Extract token from query params (?token=...) or legacy hash (#access_token=...)
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));

    const extractedToken =
      searchParams.get("token") ||
      hashParams.get("token") ||
      hashParams.get("access_token") ||
      "";

    setToken(extractedToken);

    if (!extractedToken) {
      setTokenValid(false);
      setTokenError("No password setup token was provided. Please open the link sent to your email.");
      setTokenChecked(true);
      return;
    }

    // Verify token validity non-destructively (safe for link crawlers and email security scanners)
    async function verifyToken() {
      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(extractedToken)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError(data.message || "This password setup link is invalid, expired, or has already been used.");
        }
      } catch {
        setTokenValid(false);
        setTokenError("Unable to verify password setup link. Please check your network connection.");
      } finally {
        setTokenChecked(true);
      }
    }

    verifyToken();

    return () => {
      if (document.head.contains(meta)) {
        document.head.removeChild(meta);
      }
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!allRulesMet) {
      return setMessage("Password must be at least 12 characters and include uppercase, lowercase, numbers, and symbols.");
    }

    if (!passwordsMatch) {
      return setMessage("New password and confirmation password do not match.");
    }

    if (!token) {
      return setMessage("This password setup link is invalid or has expired.");
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          token,
          password: passwordValue,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setMessage(data.message || "Unable to set password. The link may have expired or already been used.");
        return;
      }

      // Remove sensitive token from browser URL history immediately
      window.history.replaceState({}, "", "/setup-password");
      setComplete(true);
    } catch {
      setMessage("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="setup-shell">
      <section className="setup-card" role="region" aria-labelledby="setup-heading">
        <Link href="/" className="setup-brand">
          ZAPPIT
        </Link>

        {/* 1. Success State */}
        {complete ? (
          <div>
            <div className="setup-success-box" role="status">
              <span>✓</span>
              <span>Your password is ready. You can now sign in with Google or your email and password.</span>
            </div>
            <h1 id="setup-heading">Password Established</h1>
            <p style={{ color: "var(--setup-text-secondary)" }}>
              Your new password is now active. You can use it alongside Google Sign-In to access your account.
            </p>
            <Link
              href="/?login=1"
              className="setup-button"
              id="setup-return-login-btn"
              style={{ display: "inline-block", textAlign: "center", textDecoration: "none", marginTop: "1rem" }}
            >
              Sign in to ZAPPIT
            </Link>
          </div>
        ) : !tokenChecked ? (
          /* 2. Loading State */
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <p style={{ color: "var(--setup-text-muted)" }}>Verifying password setup link…</p>
          </div>
        ) : !tokenValid ? (
          /* 3. Invalid or Expired State */
          <div>
            <h1 id="setup-heading" style={{ color: "var(--setup-danger)" }}>Invalid or Expired Link</h1>
            <p style={{ lineHeight: 1.6, color: "var(--setup-text-secondary)" }}>
              {tokenError || "This password setup link is invalid, expired, or has already been used."}
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--setup-text-muted)", marginTop: "0.5rem" }}>
              For your security, password links expire after 15 minutes and can only be used once.
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Link
                href="/forgot-password"
                className="setup-button"
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                Request New Link
              </Link>
              <Link
                href="/?login=1"
                style={{
                  textAlign: "center",
                  fontSize: "0.85rem",
                  color: "var(--setup-brand)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          /* 4. Password Form */
          <div>
            <h1 id="setup-heading">Set your ZAPPIT password</h1>
            <p>Choose a secure password for your ZAPPIT account so you can also sign in with your email.</p>

            <form onSubmit={submit}>
              <label htmlFor="new-password">
                New Password
                <span className="setup-password-field">
                  <input
                    name="password"
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    minLength={12}
                    autoComplete="new-password"
                    value={passwordValue}
                    onChange={(event) => setPasswordValue(event.target.value)}
                    onKeyUp={(event) => setCapsField(event.getModifierState("CapsLock") ? "password" : null)}
                    onBlur={() => setCapsField(null)}
                    required
                  />
                  <button
                    type="button"
                    className="setup-password-toggle"
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                <span className="setup-password-requirements" aria-live="polite">
                  {passwordRules.map(([label, met]) => (
                    <small className={met ? "met" : ""} key={label}>
                      {met ? "✓ " : ""}{label}
                    </small>
                  ))}
                </span>
                {capsField === "password" && <small className="setup-caps-warning">Caps Lock is on</small>}
              </label>

              <label htmlFor="confirm-password">
                Confirm Password
                <span className="setup-password-field">
                  <input
                    name="confirmation"
                    id="confirm-password"
                    type={showConfirmation ? "text" : "password"}
                    minLength={12}
                    autoComplete="new-password"
                    value={confirmationValue}
                    onChange={(event) => setConfirmationValue(event.target.value)}
                    onKeyUp={(event) => setCapsField(event.getModifierState("CapsLock") ? "confirmation" : null)}
                    onBlur={() => setCapsField(null)}
                    required
                  />
                  <button
                    type="button"
                    className="setup-password-toggle"
                    aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"}
                    aria-pressed={showConfirmation}
                    onClick={() => setShowConfirmation((visible) => !visible)}
                  >
                    {showConfirmation ? "Hide" : "Show"}
                  </button>
                </span>
                {confirmationValue && (
                  <small className={`setup-match ${passwordsMatch ? "met" : ""}`}>
                    {passwordsMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
                  </small>
                )}
                {capsField === "confirmation" && <small className="setup-caps-warning">Caps Lock is on</small>}
              </label>

              {message && <div className="setup-error" role="alert">{message}</div>}

              <button
                className="setup-button"
                id="set-password-submit-btn"
                type="submit"
                disabled={submitting || !allRulesMet || !passwordsMatch}
              >
                {submitting ? "Setting Password…" : "Set Password"}
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
