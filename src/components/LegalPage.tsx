import Link from "next/link";

export default function LegalPage({ title, updated = "1 August 2026", children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "#FFFFFF", color: "#111827", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", padding: "0 22px 70px" }}>
      <header style={{ maxWidth: 920, margin: "auto", padding: "24px 0", borderBottom: "1px solid #E5EAF2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ color: "#0066FF", textDecoration: "none", fontWeight: 800, fontFamily: "'Outfit', sans-serif", letterSpacing: "1px", fontSize: "1.25rem" }}>
          ZAPPIT
        </Link>
        <Link href="/support" style={{ color: "#0066FF", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>
          Support &rarr;
        </Link>
      </header>
      <article style={{ maxWidth: 820, margin: "auto", paddingTop: 56, lineHeight: 1.75 }}>
        <p style={{ color: "#0066FF", fontWeight: 700, letterSpacing: 2, fontSize: 12, textTransform: "uppercase", marginBottom: 8 }}>
          CUSTOMER INFORMATION
        </p>
        <h1 style={{ font: "800 44px 'Outfit', sans-serif", letterSpacing: "-0.02em", margin: "8px 0 10px", color: "#111827" }}>
          {title}
        </h1>
        <p style={{ color: "#526176", fontSize: "0.925rem", marginBottom: 32 }}>
          Last updated: {updated}
        </p>
        <div className="legal-copy" style={{ color: "#374151", fontSize: "1rem" }}>
          {children}
        </div>
        <hr style={{ border: 0, borderTop: "1px solid #E5EAF2", marginTop: 48, marginBottom: 24 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", marginBottom: 20, fontSize: "0.9rem" }}>
          <Link href="/terms-of-service" style={{ color: "#0066FF", textDecoration: "none", fontWeight: 500 }}>Terms of Service</Link>
          <Link href="/privacy-policy" style={{ color: "#0066FF", textDecoration: "none", fontWeight: 500 }}>Privacy Policy</Link>
          <Link href="/cookie-policy" style={{ color: "#0066FF", textDecoration: "none", fontWeight: 500 }}>Cookie Policy</Link>
          <Link href="/shipping" style={{ color: "#0066FF", textDecoration: "none", fontWeight: 500 }}>Shipping Information</Link>
          <Link href="/refunds" style={{ color: "#0066FF", textDecoration: "none", fontWeight: 500 }}>Returns &amp; Refunds</Link>
        </div>
        <p style={{ fontSize: "0.875rem", color: "#64748B" }}>
          Questions about this policy can be submitted through our <Link href="/support" style={{ color: "#0066FF", textDecoration: "underline" }}>support page</Link>.
        </p>
      </article>
    </main>
  );
}
