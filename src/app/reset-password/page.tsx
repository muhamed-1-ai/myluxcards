"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import "./reset-password.css";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [tokenChecked, setTokenChecked] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [required, setRequired] = useState(false);
  const [isSetup, setIsSetup] = useState(false);

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
    const isRequired = searchParams.get("required") === "1";
    setRequired(isRequired);

    const extractedToken =
      searchParams.get("token") ||
      hashParams.get("token") ||
      hashParams.get("access_token") ||
      "";

    setToken(extractedToken);

    if (isRequired) {
      setTokenValid(true);
      setTokenChecked(true);
      return;
    }

    if (!extractedToken) {
      setTokenValid(false);
      setTokenError("No password recovery token was provided. Please use the link sent to your email.");
      setTokenChecked(true);
      return;
    }

    // Verify token validity on server without consuming it
    async function verifyToken() {
      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(extractedToken)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.valid) {
          setTokenValid(true);
          setIsSetup(Boolean(data.isSetup));
        } else {
          setTokenValid(false);
          setTokenError(data.message || "This password recovery link is invalid, expired, or has already been used.");
        }
      } catch {
        setTokenValid(false);
        setTokenError("Unable to verify reset link. Please check your network connection.");
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
      return setMessage("Use 12+ characters with uppercase, lowercase, numbers, and symbols.");
    }

    if (!passwordsMatch) {
      return setMessage("New password and confirmation password do not match.");
    }

    if (!required && !token) {
      return setMessage("This reset link is invalid or has expired.");
    }

    setSubmitting(true);
    try {
      const response = await fetch(required ? "/api/auth/change-password" : "/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          token,
          password: passwordValue,
          newPassword: passwordValue,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.message || data.msg || "Unable to reset password. The link may have expired.");
        return;
      }

      // Remove sensitive token from browser URL history immediately
      window.history.replaceState({}, "", required ? "/admin" : "/reset-password");
      setComplete(true);
    } catch {
      setMessage("Network connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="reset-shell">
      <section className="reset-card">
        <Link href="/" className="reset-brand">Zappit</Link>

        {/* 1. Success State */}
        {complete ? (
          <>
            <h1>{isSetup ? "Password added" : "Password changed"}</h1>
            <p style={{ lineHeight: 1.6, color: "var(--acc-text-muted, #94a3b8)" }}>
              {isSetup
                ? "Your password has been successfully established. You can now log in using either your email and password or Google."
                : "Your new password is now active. All previous sessions across your devices have been signed out."}
            </p>
            <Link
              href={required ? "/admin" : "/?login=1"}
              className="reset-button"
              style={{ display: "inline-block", textAlign: "center", textDecoration: "none", marginTop: "1rem" }}
            >
              {required ? "Continue to administration" : "Return to Login"}
            </Link>
          </>
        ) : !tokenChecked ? (
          /* 2. Loading / Verification State */
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <p style={{ color: "#94a3b8" }}>Verifying password recovery link…</p>
          </div>
        ) : !tokenValid && !required ? (
          /* 3. Invalid or Expired Token State with Request New Link Action */
          <>
            <h1 style={{ color: "#f87171" }}>Invalid or Expired Link</h1>
            <p style={{ lineHeight: 1.6, color: "#cbd5e1" }}>
              {tokenError || "This password recovery link is invalid, expired, or has already been used."}
            </p>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.5rem" }}>
              For your security, links expire after 15 minutes and can only be used once.
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Link
                href="/forgot-password"
                className="reset-button"
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                Request New Link
              </Link>
              <Link
                href="/?login=1"
                style={{
                  textAlign: "center",
                  fontSize: "0.85rem",
                  color: "#38bdf8",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Back to Login
              </Link>
            </div>
          </>
        ) : (
          /* 4. Valid Token Form */
          <>
            <h1>{isSetup ? "Create your password" : "Choose a new password"}</h1>
            <p>{isSetup ? "Add a password so you can also sign in with your email." : "Enter a new password for your Zappit account."}</p>

            <form onSubmit={submit}>
              <label>
                New password
                <span className="reset-password-field">
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
                    className="reset-password-toggle"
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                <span className="reset-password-requirements" aria-live="polite">
                  {passwordRules.map(([label, met]) => (
                    <small className={met ? "met" : ""} key={label}>
                      {met ? "✓ " : ""}{label}
                    </small>
                  ))}
                </span>
                {capsField === "password" && <small className="reset-caps-warning">Caps Lock is on</small>}
              </label>

              <label>
                Confirm password
                <span className="reset-password-field">
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
                    className="reset-password-toggle"
                    aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"}
                    aria-pressed={showConfirmation}
                    onClick={() => setShowConfirmation((visible) => !visible)}
                  >
                    {showConfirmation ? "Hide" : "Show"}
                  </button>
                </span>
                {confirmationValue && (
                  <small className={`reset-match ${passwordsMatch ? "met" : ""}`}>
                    {passwordsMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
                  </small>
                )}
                {capsField === "confirmation" && <small className="reset-caps-warning">Caps Lock is on</small>}
              </label>

              {message && <div className="reset-error" role="alert">{message}</div>}

              <button
                className="reset-button"
                type="submit"
                disabled={submitting || !allRulesMet || !passwordsMatch}
                style={{
                  opacity: submitting || !allRulesMet || !passwordsMatch ? 0.6 : 1,
                  cursor: submitting || !allRulesMet || !passwordsMatch ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? (isSetup ? "Creating Password…" : "Saving New Password…") : (isSetup ? "Create Password" : "Save New Password")}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
