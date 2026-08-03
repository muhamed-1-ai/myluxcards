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
  coverScale?: number; coverRotation?: number; coverX?: number; coverY?: number;
  previewAuthorized?: boolean;
};

export default function PublicCardClient({ slug }: { slug: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");
  const [loadReason, setLoadReason] = useState("");
  const [showStatusBubble, setShowStatusBubble] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/cards/public/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          if (!cancelled) {
            setCard(payload.card);
            setLoaded(true);
            void fetch(`/api/cards/public/${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "VIEW", channel: new URLSearchParams(window.location.search).get("source")?.toUpperCase() || "LINK" }) });
          }
          return;
        }
        if (!cancelled) { setLoadMessage(payload.message || "Card unavailable."); setLoadReason(payload.reason || ""); }
      } catch { /* The unavailable state is shown below. */ }
      if (!cancelled) setLoaded(true);
    };
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  if (!loaded) return <main className="pc-state">Loading card…</main>;
  if (!card) return (
    <main className="pc-state">
      <h1>{loadMessage === "Card unavailable." ? "This card is not active" : "Card not found"}</h1>
      <p>{loadMessage === "Card unavailable." ? loadReason === "NOT_ACTIVATED" ? "This card still needs its one-time activation code." : loadReason === "SWITCHED_OFF" ? "The owner has switched this card off in My Cards." : "The owner needs to activate this card or turn its status switch on in My Cards." : "Check that the card link was copied completely."}</p>
      <a href="/dashboard?tab=cards">Open My Cards</a>
    </main>
  );

  const isDashboardPreview = card.previewAuthorized === true || (!/^[0-9a-f-]{36}$/i.test(card.id || "") && new URLSearchParams(window.location.search).get("preview") === "1");
  if (!card.active && !isDashboardPreview) return (
    <main className="pc-state">
      {showStatusBubble && (
        <aside className="status-help-bubble" role="status">
          <button onClick={() => setShowStatusBubble(false)} aria-label="Dismiss">×</button>
          <strong>Your card is currently off</strong>
          <p>Go to <b>My Cards</b> in your dashboard and press the Status switch to turn it back on.</p>
          <a href="/dashboard?tab=cards">Open My Cards</a>
        </aside>
      )}
      <h1>This card is currently unavailable</h1>
    </main>
  );

  const phone    = card.mobile   ? `${card.countryCode}${card.mobile}`   : "";
  const whatsapp = card.whatsapp ? `${card.countryCode}${card.whatsapp}` : "";
  const location = [card.address, card.city, card.state].filter(Boolean).join(", ");
  const socials  = Object.entries(card.social || {}).filter(([, url]) => Boolean(url));
  const initials = card.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ML";

  const cssVars = {
    "--pc-bg":     card.profileBackground || "#0a0a0a",
    "--pc-accent": card.profileAccent     || "#b8962e",
    "--pc-text":   card.profileText       || "#ffffff",
  } as React.CSSProperties;

  const share = async () => {
    const data = { title: card.name, text: `${card.name}'s digital business card`, url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(window.location.href);
  };
  const track = (type: string, linkType?: string) => {
    void fetch(`/api/cards/public/${encodeURIComponent(slug)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, linkType, channel: "LINK" }) });
  };
  const saveContact = () => {
    const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${card.name}`,
      card.title    && `TITLE:${card.title}`,
      card.business && `ORG:${card.business}`,
      phone         && `TEL:${phone}`,
      card.email    && `EMAIL:${card.email}`,
      card.website  && `URL:${card.website}`,
      location      && `ADR:;;${location};;;;`,
      "END:VCARD"].filter(Boolean).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([vcard], { type: "text/vcard" }));
    link.download = `${card.name || "contact"}.vcf`;
    link.click();
    URL.revokeObjectURL(link.href);
    track("CONTACT_SAVE");
  };

  /* Social platform metadata */
  const SOCIAL: Record<string, { subtitle: string; icon: React.ReactNode; iconBg: string }> = {
    Facebook:          { subtitle: "Follow me",              icon: <FacebookIcon />,    iconBg: "#1877f2" },
    Instagram:         { subtitle: "Follow us on Instagram", icon: <InstagramIcon />,   iconBg: "radial-gradient(circle at 30% 107%,#fdf497 0%,#fd5949 45%,#d6249f 60%,#285aeb 90%)" },
    LinkedIn:          { subtitle: "Follow me",              icon: <LinkedInIcon />,    iconBg: "#0a66c2" },
    Twitter:           { subtitle: "Follow me",              icon: <TwitterXIcon />,    iconBg: "#000" },
    YouTube:           { subtitle: "Subscribe",              icon: <YouTubeIcon />,     iconBg: "#ff0000" },
    "Google Business": { subtitle: "Find us online",         icon: <GoogleLetter />,    iconBg: "#4285f4" },
    "Google Maps":     { subtitle: "Get directions",         icon: <LocationIcon />,    iconBg: "#4285f4" },
    WhatsApp:          { subtitle: "Message me",             icon: <WhatsAppBrandIcon />, iconBg: "#25d366" },
    Threads:           { subtitle: "Follow me",              icon: <ThreadsIcon />,     iconBg: "#000" },
  };

  return (
    <main className="pc-page" style={cssVars}>

      {/* ── Hero Card ── */}
      <div className="pc-hero">
        <div className="pc-hero-cover">
          {card.cover && <img
            src={card.cover}
            className="pc-hero-cover-image"
            alt=""
            style={{
              transform: `scale(${(card.coverScale ?? 100) / 100}) rotate(${card.coverRotation ?? 0}deg)`,
              objectPosition: `${card.coverX ?? 50}% ${card.coverY ?? 50}%`,
            }}
          />}
          {!card.cover && <span className="pc-hero-wordmark">MYLUX</span>}
          <div className="pc-hero-overlay">
            <div className="pc-hero-bottom">
              {card.logo && (
                <div className="pc-hero-logo-badge">
                  <img
                    src={card.logo}
                    alt={card.business || card.name}
                    style={{
                      transform: `scale(${(card.logoScale || 100) / 100}) rotate(${card.logoRotation || 0}deg)`,
                      objectPosition: `${card.logoX || 50}% ${card.logoY || 50}%`,
                    }}
                  />
                </div>
              )}
              <div className="pc-hero-identity">
                <h1 className="pc-hero-name">{card.name}</h1>
                {card.title    && <p className="pc-hero-title">{card.title}</p>}
                {card.business && <p className="pc-hero-biz">{card.business}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Quick-dial icon buttons */}
        <div className="pc-hero-icons">
          {phone && (
            <a href={`tel:${phone}`} className="pc-icon-btn" aria-label="Call" onClick={() => track("LINK_CLICK", "phone")}>
              <PhoneIcon />
            </a>
          )}
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="pc-icon-btn" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "whatsapp")}>
              <WhatsAppBrandIcon />
            </a>
          )}
          {card.email && (
            <a href={`mailto:${card.email}`} className="pc-icon-btn" aria-label="Email" onClick={() => track("LINK_CLICK", "email")}>
              <MailIcon />
            </a>
          )}
          {card.website && (
            <a href={card.website} className="pc-icon-btn" aria-label="Website" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "website")}>
              <WebIcon />
            </a>
          )}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="pc-actions">
        <button className="pc-action-btn" onClick={saveContact}>Save Contact</button>
        <button className="pc-action-btn" onClick={() => { track("SHARE"); void share(); }}>Share</button>
        {card.brochure && (
          <a
            className="pc-action-btn"
            href={card.brochureData || "#"}
            download={card.brochure}
            onClick={(e) => { if (!card.brochureData) e.preventDefault(); }}
          >Brochure</a>
        )}
      </div>

      {/* ── About ── */}
      {card.about && (
        <div className="pc-card pc-about">
          <h2 className="pc-card-heading">About {card.name.split(" ")[0]}</h2>
          <p className="pc-about-text">{card.about}</p>
        </div>
      )}

      {/* ── Contact details (email / website / address) ── */}
      {(card.email || card.website || location) && (
        <div className="pc-links-group">
          {card.email && (
            <a href={`mailto:${card.email}`} className="pc-link-row" onClick={() => track("LINK_CLICK", "email")}>
              <span className="pc-link-icon" style={{ background: "#c0392b" }}><MailIcon /></span>
              <span className="pc-link-text">
                <span className="pc-link-name">Email</span>
                <span className="pc-link-sub">{card.email}</span>
              </span>
              <span className="pc-link-arrow">›</span>
            </a>
          )}
          {card.website && (
            <a href={card.website} className="pc-link-row" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "website")}>
              <span className="pc-link-icon" style={{ background: "#444" }}><WebIcon /></span>
              <span className="pc-link-text">
                <span className="pc-link-name">Website</span>
                <span className="pc-link-sub">{card.website.replace(/^https?:\/\//, "")}</span>
              </span>
              <span className="pc-link-arrow">›</span>
            </a>
          )}
          {location && (
            <div className="pc-link-row">
              <span className="pc-link-icon" style={{ background: "#c0392b" }}><LocationIcon /></span>
              <span className="pc-link-text">
                <span className="pc-link-name">Address</span>
                <span className="pc-link-sub">{location}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Social platform rows ── */}
      {socials.length > 0 && (
        <div className="pc-links-group">
          {socials.map(([name, url]) => {
            const cfg = SOCIAL[name] || {
              subtitle: "Visit",
              icon: <span className="pc-brand-letter">{name[0]}</span>,
              iconBg: "#555",
            };
            return (
              <a
                key={name}
                href={url}
                className="pc-link-row"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("LINK_CLICK", name.toLowerCase())}
              >
                <span className="pc-link-icon" style={{ background: cfg.iconBg }}>{cfg.icon}</span>
                <span className="pc-link-text">
                  <span className="pc-link-name">{name}</span>
                  <span className="pc-link-sub">{cfg.subtitle}</span>
                </span>
                <span className="pc-link-arrow">›</span>
              </a>
            );
          })}
        </div>
      )}

      {/* ── Services / Products ── */}
      {card.services && card.services.length > 0 && (
        <div className="pc-card pc-services">
          <h2 className="pc-card-heading">Services / Products</h2>
          <ul className="pc-services-list">
            {card.services.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* ── Contact / Call me block ── */}
      {(phone || card.email) && (
        <div className="pc-card pc-contact-card">
          <div className="pc-contact-header">
            {card.cover
              ? <img src={card.cover} className="pc-contact-thumb" alt={card.name} />
              : card.logo
                ? <img src={card.logo} className="pc-contact-thumb pc-contact-thumb--logo" alt={card.name} />
                : <div className="pc-contact-thumb pc-contact-initials">{initials}</div>
            }
            <span className="pc-contact-label">Contact</span>
          </div>
          <hr className="pc-dashed-rule" />
          {phone && (
            <div className="pc-contact-row">
              <span className="pc-contact-row-label">Call me</span>
              <a href={`tel:${phone}`} className="pc-contact-row-value" onClick={() => track("LINK_CLICK", "phone")}>{phone}</a>
            </div>
          )}
          {whatsapp && whatsapp !== phone && (
            <div className="pc-contact-row">
              <span className="pc-contact-row-label">WhatsApp</span>
              <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="pc-contact-row-value" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "whatsapp")}>{whatsapp}</a>
            </div>
          )}
          {card.email && (
            <div className="pc-contact-row">
              <span className="pc-contact-row-label">Email me</span>
              <a href={`mailto:${card.email}`} className="pc-contact-row-value" onClick={() => track("LINK_CLICK", "email")}>{card.email}</a>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="pc-footer">
        <a href="/" className="pc-footer-pill">
          <span className="pc-footer-badge">M</span>
          Get your own page for free!
        </a>
      </footer>

      {/* ── Status help bubble (card-off notice) ── */}
      {showStatusBubble && (
        <aside className="status-help-bubble" role="status">
          <button onClick={() => setShowStatusBubble(false)} aria-label="Dismiss">×</button>
          <strong>Your card is currently off</strong>
          <p>Go to <b>My Cards</b> in your dashboard and press the Status switch to turn it back on.</p>
          <a href="/dashboard?tab=cards">Open My Cards</a>
        </aside>
      )}

    </main>
  );
}

/* ─── SVG Icon Components ─── */

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function WhatsAppBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.8" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="17.4" cy="6.8" r="1.15" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TwitterXIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function ThreadsIcon() {
  return (
    <svg viewBox="0 0 192 192" fill="currentColor" aria-hidden>
      <path d="M141.537 88.988a66.667 66.667 0 00-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.035l15.624 10.73c5.734-8.705 14.724-10.558 19.496-10.558h.23c7.535.048 13.219 2.237 16.895 6.506 2.682 3.08 4.476 7.379 5.354 12.82-6.687-1.138-13.925-1.489-21.67-.904-21.765 1.555-35.779 13.7-34.923 31.02.44 8.763 4.895 16.3 12.557 21.232 6.454 4.18 14.782 6.229 23.415 5.749 11.478-.64 20.479-5.01 26.752-13.003 4.732-6.11 7.734-14.042 9.077-24.089 5.44 3.284 9.459 7.842 11.525 13.392 3.595 9.532 3.805 25.174-7.46 36.443-9.816 9.819-21.622 14.075-39.441 14.201-19.758-.14-34.682-6.484-44.357-18.86-8.953-11.492-13.556-28.018-13.693-49.11.137-21.093 4.74-37.619 13.693-49.11 9.675-12.377 24.6-18.72 44.357-18.86 19.905.143 35.06 6.516 45.033 18.94 4.911 6.16 8.617 13.978 11.053 23.153l18.513-4.93c-2.953-11.191-7.69-20.829-14.17-28.748C119.021 19.42 100.58 10.473 77.8 10.3h-.497C54.663 10.474 36.383 19.45 23.725 36.534 12.576 51.806 6.925 72.832 6.75 99.416v.168c.175 26.583 5.826 47.609 16.975 62.88 12.658 17.085 30.938 26.06 54.553 26.234h.497c20.921-.149 35.8-5.726 47.938-17.864 15.785-15.781 15.315-35.59 10.064-47.741-3.727-8.695-10.714-15.705-19.57-20.226z" />
    </svg>
  );
}

function GoogleLetter() {
  return <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>G</span>;
}
