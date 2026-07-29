export default function ForbiddenPage() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#070706", color: "#f6f2e8" }}>
    <section style={{ maxWidth: 520, textAlign: "center" }}>
      <p style={{ color: "#c9a24d", fontWeight: 800, letterSpacing: ".14em" }}>403 · ACCESS DENIED</p>
      <h1>You do not have permission to open this page.</h1>
      <p style={{ color: "#b8b1a3" }}>Sign in with an authorized administrator account or return to your dashboard.</p>
      <a href="/dashboard" style={{ color: "#c9a24d" }}>Return to dashboard</a>
    </section>
  </main>;
}
