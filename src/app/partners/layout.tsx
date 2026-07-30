import "../affiliate/affiliate.css";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="affiliate-page partner-site">
    <header className="partner-main-nav">
      <a className="partner-main-logo" href="/" aria-label="MyLuxCards home">
        <img src="/assets/logo-navbar.png" alt="MyLuxCards" />
      </a>
      <nav aria-label="Main navigation">
        <a href="/">Home</a>
        <a href="/#featured-categories-section">Shop</a>
        <a href="/#card-configurator">NFC Cards</a>
        <a className="active" href="/partners">Partners</a>
      </nav>
      <div className="partner-main-actions">
        <a className="partner-login-link" href="/partners/terms">Terms</a>
        <a className="partner-main-button" href="/partners/dashboard">Partner login</a>
      </div>
    </header>
    {children}
    <footer className="affiliate-footer">MyLux Partner Program · Turn every connection into an opportunity</footer>
  </div>;
}
