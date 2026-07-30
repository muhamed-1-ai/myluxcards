export const metadata = { title: "MyLux Partner Program | MyLuxCards" };

const partnerTypes = [
  { number: "01", title: "Refer & Earn", label: "For MyLux customers", text: "Recommend the products you already use and earn eligible store-credit rewards.", benefit: "Personal link · Store credit · Simple sharing", href: "/partners/apply?type=CUSTOMER_REFERRER" },
  { number: "02", title: "Creator Partner", label: "For creators and educators", text: "Turn useful product content into a measurable income stream with campaign reporting.", benefit: "Tiered rates · Campaign links · Creative assets", href: "/partners/apply?type=CREATOR" },
  { number: "03", title: "Business Partner", label: "For agencies and consultants", text: "Bring smarter networking products to clients and protect qualified corporate opportunities.", benefit: "Lead protection · Bulk opportunities · Partner support", href: "/partners/apply?type=BUSINESS_PARTNER" },
  { number: "04", title: "Campus Ambassador", label: "For students and college communities", text: "Lead campus campaigns, grow your network, and unlock achievement rewards.", benefit: "Campus campaigns · Milestones · Community growth", href: "/partners/apply?type=CAMPUS_AMBASSADOR" },
];

const faqs = [
  ["Does applying guarantee approval?", "No. Every application is reviewed to protect partners, customers, and the MyLuxCards brand."],
  ["How are commissions decided?", "Your partner type, tier, product, and any approved individual rate determine the commission. The exact calculation is saved with each commission."],
  ["When can I request a payout?", "After a verified order is delivered, its holding period ends, and your approved balance reaches the configured minimum."],
  ["Can I promote individual products?", "Yes. Approved partners can generate safe product links, campaign links, and downloadable referral QR codes."],
];

export default function PartnersPage() {
  return <main className="partner-landing">
    <section className="partner-hero">
      <div className="partner-hero-glow" />
      <div className="partner-eyebrow"><span /> MyLux Partner Program</div>
      <h1>Turn Every Connection<br/>Into an <em>Opportunity.</em></h1>
      <p>Recommend MyLuxCards, help people connect smarter, and earn rewards from every eligible sale.</p>
      <div className="partner-hero-actions">
        <a className="partner-primary" href="/partners/apply">Become a partner <span>↗</span></a>
        <a className="partner-secondary" href="/partners/dashboard">Partner login</a>
      </div>
      <div className="partner-trust">
        <span>One secure dashboard</span><i/>
        <span>Real performance data</span><i/>
        <span>Flexible partner paths</span>
      </div>
    </section>

    <section className="partner-section partner-paths">
      <header className="partner-section-head">
        <div><small>CHOOSE YOUR PATH</small><h2>Built for the way<br/>you create value.</h2></div>
        <p>Whether you share with friends, teach an audience, serve business clients, or lead a campus community, there is a clear way to partner.</p>
      </header>
      <div className="partner-card-grid">{partnerTypes.map(item =>
        <a className="partner-type-card" href={item.href} key={item.title}>
          <div className="partner-card-top"><span>{item.number}</span><b>{item.label}</b></div>
          <h3>{item.title}</h3><p>{item.text}</p>
          <div className="partner-benefit">{item.benefit}</div>
          <strong>Explore this path <span>→</span></strong>
        </a>
      )}</div>
    </section>

    <section className="partner-process">
      <div className="partner-process-copy"><small>HOW IT WORKS</small><h2>From application<br/>to earnings.</h2><p>A straightforward program with transparent attribution and no fabricated performance numbers.</p></div>
      <ol>
        <li><span>01</span><div><h3>Apply securely</h3><p>Use your existing MyLuxCards account and select the partner path that fits you.</p></div></li>
        <li><span>02</span><div><h3>Get approved</h3><p>An administrator reviews every application before referral tools become active.</p></div></li>
        <li><span>03</span><div><h3>Share with purpose</h3><p>Create product links, named campaigns, or QR codes from your private dashboard.</p></div></li>
        <li><span>04</span><div><h3>Track and earn</h3><p>Follow real clicks and eligible orders, then request rewards after the holding period.</p></div></li>
      </ol>
    </section>

    <section className="partner-benefits partner-section">
      <div className="partner-benefit-title"><small>PARTNER ADVANTAGE</small><h2>Useful tools.<br/>Clear rules.</h2></div>
      <div className="partner-benefit-list">
        <article><span>↗</span><div><h3>Campaign-ready links</h3><p>Generate safe links for the main store or individual products, with source and campaign reporting.</p></div></article>
        <article><span>◎</span><div><h3>Privacy-conscious tracking</h3><p>Secure attribution measures performance without exposing unnecessary customer information.</p></div></article>
        <article><span>◇</span><div><h3>Growth milestones</h3><p>Progress through configurable tiers and become eligible for administrator-approved rewards.</p></div></article>
        <article><span>✓</span><div><h3>Protected commission history</h3><p>Every commission keeps the exact basis and rate used when it was calculated.</p></div></article>
      </div>
    </section>

    <section className="partner-rules">
      <div><small>SIMPLE, RESPONSIBLE PARTNERSHIPS</small><h2>Promote with confidence.</h2><p>Eligible paid orders can earn rewards after delivery and the configured holding period. Self-referrals, spam, misleading claims, forced clicks, and referral manipulation are prohibited.</p></div>
      <a href="/partners/terms">Read program terms <span>→</span></a>
    </section>

    <section className="partner-faq partner-section">
      <header><small>COMMON QUESTIONS</small><h2>Good to know.</h2></header>
      <div>{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div>
    </section>

    <section className="partner-cta">
      <small>YOUR NEXT CONNECTION COULD OPEN A NEW DOOR</small>
      <h2>Ready to partner<br/>with MyLuxCards?</h2>
      <p>Choose your path, tell us how you create value, and start building smarter connections.</p>
      <a className="partner-primary" href="/partners/apply">Apply to the program <span>↗</span></a>
    </section>
  </main>;
}
