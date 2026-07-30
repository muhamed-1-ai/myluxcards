import "./affiliate.css";

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  return <div className="affiliate-page">
    <header className="affiliate-nav">
      <a className="affiliate-brand" href="/">MYLUX<span>CARDS</span></a>
      <nav><a href="/affiliate">Program</a><a href="/affiliate/terms">Terms</a><a className="affiliate-button" href="/affiliate/dashboard">Dashboard</a></nav>
    </header>
    {children}
    <footer className="affiliate-footer">MyLuxCards Affiliate Program · Privacy-conscious referral partnerships</footer>
  </div>;
}
