"use client";

import { useEffect, useState } from "react";

type Card = {
  id?: string;
  name: string; slug: string; title: string; business: string; countryCode: string; mobile: string;
  whatsapp: string; email: string; website: string; state: string; city: string; address: string;
  brochure: string; brochureData?: string; social: Record<string, string>; about: string;
  services: string[]; logo: string; cover: string; active: boolean;
  profileBackground?: string; profileAccent?: string; profileText?: string;
  logoScale?: number; logoRotation?: number; logoX?: number; logoY?: number;
  previewAuthorized?: boolean;
};

const STORE_PREFIX = "mylux-dashboard-cards-v2:";
const brands: Record<string, { short: string; className: string }> = {
  Facebook: { short: "f", className: "facebook" },
  Instagram: { short: "", className: "instagram" },
  LinkedIn: { short: "in", className: "linkedin" },
  Twitter: { short: "𝕏", className: "twitter" },
  YouTube: { short: "▶", className: "youtube" },
  "Google Business": { short: "G", className: "google" },
};

export default function PublicCardClient({ slug }: { slug: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showStatusBubble, setShowStatusBubble] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadStatus, setLeadStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/cards/public/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (!cancelled) {
            setCard(payload.card);
            setLoaded(true);
            void fetch(`/api/cards/public/${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "VIEW", channel: new URLSearchParams(window.location.search).get("source")?.toUpperCase() || "LINK" }) });
          }
          return;
        }
      } catch { /* Browser-saved migration fallback below. */ }
      for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(STORE_PREFIX)) continue;
      try {
        const cards = JSON.parse(localStorage.getItem(key) || "[]") as Card[];
        const match = cards.find((item) => item.slug === slug);
        if (match) {
          setCard(match);
          if (!match.active) {
            const noticeKey = `mylux-card-off-notice:${slug}`;
            const noticeCount = Number(localStorage.getItem(noticeKey) || "0");
            if (noticeCount < 2) {
              setShowStatusBubble(true);
              localStorage.setItem(noticeKey, String(noticeCount + 1));
            }
          }
          break;
        }
      } catch { /* Ignore malformed unrelated browser data. */ }
      }
      if (!cancelled) setLoaded(true);
    };
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  if (!loaded) return <main className="public-card-state">Loading card…</main>;
  if (!card) return <main className="public-card-state"><h1>Card not found</h1><a href="/dashboard">Return to dashboard</a></main>;
  const isDashboardPreview = card.previewAuthorized === true || (!/^[0-9a-f-]{36}$/i.test(card.id || "") && new URLSearchParams(window.location.search).get("preview") === "1");
  if (!card.active && !isDashboardPreview) return <main className="public-card-state">
    {showStatusBubble && <aside className="status-help-bubble" role="status"><button onClick={() => setShowStatusBubble(false)} aria-label="Dismiss">×</button><strong>Your card is currently off</strong><p>Go to <b>My Cards</b> in your dashboard and press the Status switch to turn it back on.</p><a href="/dashboard?tab=cards">Open My Cards</a></aside>}
    <h1>This card is currently unavailable</h1>
  </main>;

  const phone = card.mobile ? `${card.countryCode}${card.mobile}` : "";
  const whatsapp = card.whatsapp ? `${card.countryCode}${card.whatsapp}` : "";
  const location = [card.address, card.city, card.state].filter(Boolean).join(", ");
  const socials = Object.entries(card.social || {}).filter(([, url]) => Boolean(url));
  const initials = card.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ML";
  const share = async () => {
    const data = { title: card.name, text: `${card.name}'s digital business card`, url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(window.location.href);
  };
  const track = (type: string, linkType?: string) => {
    void fetch(`/api/cards/public/${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, linkType, channel: "LINK" }) });
  };
  const saveContact = () => {
    const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${card.name}`, card.title && `TITLE:${card.title}`,
      card.business && `ORG:${card.business}`, phone && `TEL:${phone}`, card.email && `EMAIL:${card.email}`,
      card.website && `URL:${card.website}`, location && `ADR:;;${location};;;;`, "END:VCARD"].filter(Boolean).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([vcard], { type: "text/vcard" }));
    link.download = `${card.name || "contact"}.vcf`; link.click(); URL.revokeObjectURL(link.href);
    track("CONTACT_SAVE");
  };
  const submitLead = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLeadStatus("Sending…");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/cards/public/${encodeURIComponent(slug)}/lead`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), email: form.get("email"), phone: form.get("phone"), company: form.get("company"), message: form.get("message"), consent: form.get("consent") === "on" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setLeadStatus(payload.message || "Please check your details."); return; }
    setLeadStatus("Your details were shared securely.");
    event.currentTarget.reset();
  };

  return <main className="public-profile" style={{ "--profile-bg": card.profileBackground || "#020202", "--profile-accent": card.profileAccent || "#d4af37", "--profile-text": card.profileText || "#ffffff" } as React.CSSProperties}>
    <section className="public-identity">
      <div className="public-cover" style={card.cover ? { backgroundImage: `url(${card.cover})` } : undefined}>{!card.cover && <span>MYLUX</span>}</div>
      <div className="public-logo">{card.logo ? <img src={card.logo} alt={`${card.business || card.name} logo`} style={{transform:`scale(${(card.logoScale||100)/100}) rotate(${card.logoRotation||0}deg)`,objectPosition:`${card.logoX||50}% ${card.logoY||50}%`}} /> : initials}</div>
      <div className="public-name"><h1>{card.name}</h1>{(card.title || card.business) && <p>{[card.title, card.business].filter(Boolean).join(" – ")}</p>}</div>
      <div className="public-actions">
        <button onClick={saveContact}>Save Contact</button>
        {card.brochure && <a href={card.brochureData || "#"} download={card.brochure} onClick={(event) => { if (!card.brochureData) event.preventDefault(); }}>Brochure</a>}
        <button onClick={() => { track("SHARE"); void share(); }}>Share</button>
        <button onClick={() => setLeadOpen(true)}>Exchange Details</button>
      </div>
      <div className="public-contact">
        {phone && <a href={`tel:${phone}`} onClick={() => track("LINK_CLICK","phone")}><i>☎</i><span><small>Mobile</small><b>{phone}</b></span></a>}
        {card.email && <a href={`mailto:${card.email}`} onClick={() => track("LINK_CLICK","email")}><i>✉</i><span><small>Email</small><b>{card.email}</b></span></a>}
        {card.website && <a href={card.website} target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK","website")}><i>⌁</i><span><small>Website</small><b>{card.website}</b></span></a>}
        {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK","whatsapp")}><i>◉</i><span><small>WhatsApp</small><b>{whatsapp}</b></span></a>}
        {location && <div className="address"><i>⌖</i><span><small>Address</small><b>{location}</b></span></div>}
      </div>
      {socials.length > 0 && <div className="public-social"><h2>Social Media Links</h2><div>{socials.map(([name, url]) => {
        const brand = brands[name] || { short: name[0], className: "google" };
        return <a key={name} className={brand.className} href={url} target="_blank" rel="noopener noreferrer" aria-label={name}>{name === "Instagram" ? <InstagramIcon /> : brand.short}</a>;
      })}</div></div>}
    </section>
    {(card.about || card.services.length > 0) && <section className="public-business">
      <div className="business-tab">⌂ Business<br />Information</div>
      <article><h2>Business Information</h2>{card.about && <><h3>About Company</h3><p>{card.about}</p></>}
        {card.services.length > 0 && <><h3>Services / Products</h3><ul>{card.services.map((service) => <li key={service}>{service}</li>)}</ul></>}
      </article>
    </section>}
    {leadOpen && <div className="exchange-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLeadOpen(false); }}>
      <form className="exchange-form" onSubmit={submitLead}>
        <button className="exchange-close" type="button" onClick={() => setLeadOpen(false)} aria-label="Close">×</button>
        <span>CONTACT EXCHANGE</span><h2>Share your details with {card.name.split(" ")[0]}</h2><p>Only the card owner can view what you submit.</p>
        <label>Name *<input name="name" required maxLength={120} autoComplete="name" /></label>
        <div><label>Email<input name="email" type="email" maxLength={320} autoComplete="email" /></label><label>Phone<input name="phone" maxLength={30} autoComplete="tel" /></label></div>
        <label>Company<input name="company" maxLength={160} autoComplete="organization" /></label>
        <label>Message<textarea name="message" maxLength={1000} rows={3} /></label>
        <label className="exchange-consent"><input name="consent" type="checkbox" required /> I consent to sharing these details with this card owner so they can contact me.</label>
        <button className="exchange-submit">Share my details</button>
        {leadStatus && <output>{leadStatus}</output>}
      </form>
    </div>}
  </main>;
}

function InstagramIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.8" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="17.4" cy="6.8" r="1.15" fill="currentColor" />
  </svg>;
}
