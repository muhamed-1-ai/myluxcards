import "../affiliate/affiliate.css";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="affiliate-page">
    <header className="affiliate-nav">
      <a className="affiliate-brand affiliate-brand-image" href="/" aria-label="MyLuxCards home">
        <img src="/assets/logo-premium.png" alt="MyLuxCards" />
      </a>
      <nav><a href="/partners">Program</a><a href="/partners/terms">Terms</a><a className="affiliate-button" href="/partners/dashboard">Partner login</a></nav>
    </header>
    {children}
    <footer className="affiliate-footer">MyLux Partner Program · Turn every connection into an opportunity</footer>
  </div>;
}
