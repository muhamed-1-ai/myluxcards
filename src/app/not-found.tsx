import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found | 3G Zappit",
  description: "The page you requested could not be found.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        background: "radial-gradient(ellipse at top, #0f172a 0%, #07090e 100%)",
        color: "#f8fafc",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          textAlign: "center",
          padding: "40px 32px",
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
        }}
      >
        <div
          style={{
            fontSize: "72px",
            fontWeight: "900",
            letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #38bdf8 0%, #0066ff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            lineHeight: 1,
            marginBottom: "16px",
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "700",
            margin: "0 0 10px",
            color: "#ffffff",
          }}
        >
          Page Not Found
        </h1>
        <p
          style={{
            fontSize: "14.5px",
            color: "#94a3b8",
            lineHeight: 1.6,
            margin: "0 0 28px",
          }}
        >
          The page you are looking for does not exist, has been removed, or is temporarily unavailable.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 20px",
              background: "#0967d2",
              color: "#ffffff",
              borderRadius: "10px",
              fontSize: "14.5px",
              fontWeight: "600",
              textDecoration: "none",
              transition: "background 0.2s ease",
            }}
          >
            ← Return to Homepage
          </Link>

          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 20px",
              background: "rgba(255, 255, 255, 0.06)",
              color: "#e2e8f0",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "10px",
              fontSize: "14.5px",
              fontWeight: "500",
              textDecoration: "none",
            }}
          >
            Open Dashboard
          </Link>

          <Link
            href="/support"
            style={{
              display: "inline-block",
              marginTop: "8px",
              fontSize: "13px",
              color: "#38bdf8",
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Need help? Contact Technical Support
          </Link>
        </div>
      </div>
    </main>
  );
}
