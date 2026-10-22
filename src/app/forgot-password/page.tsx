"use client";

import { FormEvent, useState, useEffect } from "react";
import Link from "next/link";
import "../reset-password/reset-password.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSendReset(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (!email || !email.includes("@")) return;

    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => ({}));
      setSubmitted(true);
      setMessage(data.message || "If this account is eligible, we’ll email you a link to set or reset your password.");
      setCooldown(60); // 60 second resend cooldown
    } catch {
      // Always show uniform message to prevent enumeration even on network errors
      setSubmitted(true);
      setMessage("If this account is eligible, we’ll email you a link to set or reset your password.");
      setCooldown(60);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="reset-shell">
      <section className="reset-card">
        <Link href="/" className="reset-brand">Zappit</Link>

        {submitted ? (
          <>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#34d399",
                fontSize: "24px",
                margin: "0 auto 1.25rem",
              }}
            >
              ✓
            </div>
            <h1>Check your email</h1>
            <p style={{ lineHeight: 1.6, color: "var(--acc-text-muted, #cbd5e1)" }}>
              {message}
            </p>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.5rem", lineHeight: 1.5 }}>
              Check your inbox and spam folder. Recovery and setup links expire in 15 minutes and can only be used once.
            </p>

            <div style={{ marginTop: "1.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                type="button"
                className="reset-button"
                disabled={cooldown > 0 || submitting}
                onClick={() => handleSendReset()}
                style={{
                  opacity: cooldown > 0 || submitting ? 0.6 : 1,
                  cursor: cooldown > 0 || submitting ? "not-allowed" : "pointer",
                }}
              >
                {cooldown > 0 ? `Resend email in ${cooldown}s` : submitting ? "Sending..." : "Resend Email"}
              </button>

              <Link
                href="/?login=1"
                style={{
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: "#38bdf8",
                  textDecoration: "none",
                  fontWeight: 600,
                  marginTop: "0.5rem",
                }}
              >
                ← Back to Login
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1>Set or reset your password</h1>
            <p style={{ lineHeight: 1.6, color: "#cbd5e1" }}>
              Enter your registered email address to set or reset your password. If this account is eligible, we’ll email you a link to choose a password.
            </p>

            <form onSubmit={handleSendReset}>
              <label>
                Registered Email Address
                <input
                  type="email"
                  name="email"
                  id="forgot-email-input"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 14px",
                    borderRadius: "8px",
                    border: "1px solid #475569",
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    color: "#FFFFFF",
                    fontSize: "0.9375rem",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <button
                className="reset-button"
                type="submit"
                disabled={submitting || !email.includes("@")}
                style={{
                  marginTop: "1.25rem",
                  opacity: submitting || !email.includes("@") ? 0.6 : 1,
                  cursor: submitting || !email.includes("@") ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Sending Reset Link…" : "Send Reset Link"}
              </button>

              <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
                <Link
                  href="/?login=1"
                  style={{
                    fontSize: "0.875rem",
                    color: "#38bdf8",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  ← Back to Login
                </Link>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
