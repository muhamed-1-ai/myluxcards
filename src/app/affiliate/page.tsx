export const metadata = { title: "Affiliate Program | MyLuxCards" };

export default function AffiliatePage() {
  return <main>
    <section className="affiliate-hero">
      <div className="affiliate-kicker">Partner with MyLuxCards</div>
      <h1>Share smarter cards. Earn commissions.</h1>
      <p>Promote NFC business cards, QR lost-and-found products, accessories, and future MyLuxCards releases through trackable links and approved coupon codes.</p>
      <a className="affiliate-button" href="/affiliate/apply">Apply now</a>
    </section>
    <section className="affiliate-grid">
      <article className="affiliate-card"><h2>Unique links</h2><p>Approved affiliates receive a unique code plus safe product and campaign links for this website.</p></article>
      <article className="affiliate-card"><h2>Transparent reporting</h2><p>Track clicks, unique visitors, referred orders, commission states, and payout history using real order data.</p></article>
      <article className="affiliate-card"><h2>Protected payouts</h2><p>Commissions are held through the configured return period and become payable only after trusted order verification.</p></article>
    </section>
    <section className="affiliate-section">
      <h2>How it works</h2>
      <ol className="affiliate-steps"><li>Create or use your MyLuxCards customer account and submit an application.</li><li>An administrator reviews your promotion plan and approves eligible partners.</li><li>Share your referral links or assigned coupon without spam, misleading claims, or self-referrals.</li><li>Eligible paid orders earn commission after delivery and the configured holding period.</li><li>Request a manual payout after your approved balance reaches the displayed minimum.</li></ol>
    </section>
    <section className="affiliate-section affiliate-panel">
      <h2>Program basics</h2>
      <p>Commission rates, attribution window, payout minimum, eligible products, and holding period are controlled centrally and displayed in the affiliate dashboard. Referral coupon attribution takes priority over a referral cookie by default.</p>
      <p>Fraud, cookie manipulation, paid-search impersonation, unsolicited spam, misleading advertising, and self-referrals are prohibited unless an administrator explicitly changes the applicable program rule.</p>
      <a className="affiliate-button secondary" href="/affiliate/terms">Read program terms</a>
    </section>
  </main>;
}
