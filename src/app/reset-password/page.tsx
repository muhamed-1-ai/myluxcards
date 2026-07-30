"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import "./reset-password.css";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [required, setRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmationValue, setConfirmationValue] = useState("");
  const [capsField, setCapsField] = useState<"password" | "confirmation" | null>(null);
  const passwordRules = [
    ["12+ characters", passwordValue.length >= 12],
    ["Uppercase", /[A-Z]/.test(passwordValue)],
    ["Lowercase", /[a-z]/.test(passwordValue)],
    ["Number", /\d/.test(passwordValue)],
    ["Symbol", /[^A-Za-z0-9]/.test(passwordValue)],
  ] as const;

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setToken(hash.get("access_token") || "");
    setRequired(new URLSearchParams(window.location.search).get("required") === "1");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");

    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
        !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return setMessage("Use 12+ characters with upper, lower, number, and symbol.");
    }
    if (password !== confirmation) return setMessage("Passwords do not match.");
    if (!required && !token) return setMessage("This reset link is invalid or has expired.");

    const response = await fetch(required ? "/api/auth/change-password" : "/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message || data.msg || "This reset link is invalid or has expired.");
      return;
    }
    window.history.replaceState({}, "", required ? "/admin" : "/reset-password");
    setComplete(true);
  }

  return (
    <main className="reset-shell">
      <section className="reset-card">
        <Link href="/" className="reset-brand">MyLuxCards</Link>
        {complete ? (
          <>
            <h1>Password changed</h1>
            <p>Your new password is ready.</p>
            <Link href={required ? "/admin" : "/?login=1"} className="reset-button">{required ? "Continue to administration" : "Return to login"}</Link>
          </>
        ) : (
          <>
            <h1>Choose a new password</h1>
            <p>Enter a new password for your MyLuxCards account.</p>
            <form onSubmit={submit}>
              <label>
                New password
                <span className="reset-password-field">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    minLength={12}
                    autoComplete="new-password"
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
                  {passwordRules.map(([label, met]) => <small className={met ? "met" : ""} key={label}>{label}</small>)}
                </span>
                {capsField === "password" && <small className="reset-caps-warning">Caps Lock is on</small>}
              </label>
              <label>
                Confirm password
                <span className="reset-password-field">
                  <input
                    name="confirmation"
                    type={showConfirmation ? "text" : "password"}
                    minLength={12}
                    autoComplete="new-password"
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
                {confirmationValue && <small className={`reset-match ${passwordValue === confirmationValue ? "met" : ""}`}>{passwordValue === confirmationValue ? "Passwords match" : "Passwords do not match yet"}</small>}
                {capsField === "confirmation" && <small className="reset-caps-warning">Caps Lock is on</small>}
              </label>
              <div className="reset-error" role="alert">{message}</div>
              <button className="reset-button" type="submit">Change password</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
