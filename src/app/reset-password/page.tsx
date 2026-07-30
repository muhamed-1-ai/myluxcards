"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import "./reset-password.css";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [required, setRequired] = useState(false);

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
              <label>New password<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
              <label>Confirm password<input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></label>
              <div className="reset-error" role="alert">{message}</div>
              <button className="reset-button" type="submit">Change password</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
