"use client";

import React, { useState, useEffect } from "react";
import { resolveMediaUrl } from "@/lib/storage/resolver";
import { CardProfileProduct } from "@/lib/cards";
import { normalizePhoneNumber } from "@/lib/phone";
import { resolveSimpleProfileTokens, isLightColor } from "@/lib/themeTokens";
import {
  Phone,
  Mail,
  MessageCircle,
  Globe,
  UserPlus,
  Users,
  Share2,
  FileText,
  Pencil,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

export interface SimpleProfileLayoutProps {
  card: {
    name?: string;
    title?: string;
    business?: string;
    countryCode?: string;
    countryIso?: string;
    mobile?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    about?: string;
    brochure?: string;
    brochureData?: string;
    social?: Record<string, string>;
    services?: string[];
    logo?: string;
    cover?: string;
    logoScale?: number;
    logoRotation?: number;
    logoX?: number;
    logoY?: number;
    profileBackground?: string;
    profileAccent?: string;
    profileText?: string;
    slug?: string;
    id?: string;
  };
  profileProducts?: CardProfileProduct[];
  onSaveContact?: () => void;
  onShareDetails?: () => void;
  onShare?: () => void;
  onOpenBrochure?: () => void;
  onEditProfile?: () => void;
  isDashboardPreview?: boolean;
}

function SocialBrandIcon({ brand }: { brand: string }) {
  const normalized = brand.toLowerCase();
  if (normalized === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-none stroke-currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" />
      </svg>
    );
  }
  if (normalized === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-currentColor" aria-hidden="true">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.64a1.6 1.6 0 1 0 1.6 1.6 1.6 1.6 0 0 0-1.6-1.6z" />
      </svg>
    );
  }
  if (normalized === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  if (normalized === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }
  if (normalized === "twitter" || normalized === "x") {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (normalized === "github") {
    return (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-currentColor" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    );
  }
  if (normalized === "maps" || normalized === "google") {
    return (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-currentColor" aria-hidden="true">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-none stroke-currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function SimpleProfileLayout({
  card,
  profileProducts,
  onSaveContact,
  onShareDetails,
  onShare,
  onOpenBrochure,
  onEditProfile,
  isDashboardPreview = false,
}: SimpleProfileLayoutProps) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [fetchedProducts, setFetchedProducts] = useState<CardProfileProduct[]>([]);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (profileProducts !== undefined) return;
    const cardId = card.id;
    if (!cardId || !/^[0-9a-f-]{36}$/i.test(cardId)) return;

    let isMounted = true;
    fetch(`/api/cards/profile-products?cardId=${encodeURIComponent(cardId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && Array.isArray(data.products)) {
          setFetchedProducts(data.products);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [card.id, profileProducts]);

  const effectiveProducts = profileProducts !== undefined ? profileProducts : fetchedProducts;

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(null), 2000);
    }
  };

  const name = (card.name || "").trim() || "Your Name";
  const title = (card.title || "").trim();
  const business = (card.business || "").trim();
  const about = (card.about || "").trim();

  // Normalize phone & whatsapp
  const normPhone = normalizePhoneNumber(card.mobile, card.countryCode || card.countryIso);
  const fullPhone = normPhone.isValid ? (normPhone.displayFormatted || normPhone.normalized) : (card.mobile || "");
  const telHref = normPhone.isValid ? `tel:${normPhone.normalized}` : (card.mobile ? `tel:${card.mobile}` : "");

  const normWhatsapp = normalizePhoneNumber(card.whatsapp, card.countryCode || card.countryIso);
  const waDigits = normWhatsapp.isValid ? normWhatsapp.normalized.replace(/[^0-9]/g, "") : (card.whatsapp ? card.whatsapp.replace(/[^0-9]/g, "") : "");
  const waHref = waDigits ? `https://wa.me/${waDigits}` : "";

  const emailHref = card.email && card.email.trim() ? `mailto:${card.email.trim()}` : "";
  const websiteHref = card.website && card.website.trim() ? card.website.trim() : "";
  const hasBrochure = Boolean(card.brochure || card.brochureData);

  // Social links
  const socialLinks = [
    { key: "instagram", name: "Instagram", url: card.social?.Instagram || card.social?.instagram, brand: "instagram" },
    { key: "linkedin", name: "LinkedIn", url: card.social?.LinkedIn || card.social?.linkedin, brand: "linkedin" },
    { key: "website", name: "Website", url: card.website, brand: "website" },
    { key: "youtube", name: "YouTube", url: card.social?.YouTube || card.social?.youtube, brand: "youtube" },
    { key: "facebook", name: "Facebook", url: card.social?.Facebook || card.social?.facebook, brand: "facebook" },
    { key: "twitter", name: "X", url: card.social?.Twitter || card.social?.twitter, brand: "twitter" },
    { key: "github", name: "GitHub", url: card.social?.GitHub || card.social?.github, brand: "github" },
    { key: "google", name: "Google Maps", url: card.social?.["Google Maps"] || card.social?.google, brand: "maps" },
  ].filter((item) => item.url && item.url.trim().length > 0);

  // Initials fallback for contained avatar
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "ZP";

  // Unified Simple profile color tokens (explicit user choice, preset, or fallback)
  const tokens = resolveSimpleProfileTokens(card);
  const themeClass = tokens.bgIsLight ? "zappit-simple-theme-light" : "zappit-simple-theme-dark";

  return (
    <div
      className={`zappit-simple-wrapper ${themeClass}`}
      style={tokens.styleObj as React.CSSProperties}
    >
      <div className="zappit-simple-card">

        {/* ── Top-right edit button (if provided) ── */}
        {onEditProfile && (
          <div className="zappit-simple-edit-bar">
            <button
              type="button"
              onClick={onEditProfile}
              aria-label="Edit profile"
              className="zappit-simple-edit-btn"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        )}

        {/* ── 1. Contained Profile Photo (Plain background, no overlap) ── */}
        <div className="zappit-simple-photo-wrap">
          <div className="zappit-simple-photo-ring">
            {card.logo && !imgError ? (
              <img
                src={resolveMediaUrl(card.logo)}
                alt={name}
                className="zappit-simple-photo-img"
                onError={() => setImgError(true)}
                style={{
                  transform: `scale(${(card.logoScale || 100) / 100}) rotate(${card.logoRotation || 0}deg)`,
                  objectPosition: `${card.logoX || 50}% ${card.logoY || 50}%`,
                }}
              />
            ) : (
              <div className="zappit-simple-photo-fallback">
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Name Heading, Job Title & Company ── */}
        <div className="zappit-simple-identity">
          <h1 className="zappit-simple-name">{name}</h1>

          {(title || business) && (
            <p className="zappit-simple-subtitle">
              {title}
              {title && business ? " • " : ""}
              {business}
            </p>
          )}

          {/* Short Bio (Hidden cleanly when empty) */}
          {about && (
            <p className="zappit-simple-bio">{about}</p>
          )}
        </div>

        {/* ── 3. Primary Contact Action (Save Contact) ── */}
        {onSaveContact && (
          <div className="zappit-simple-primary-wrap">
            <button
              type="button"
              className="zappit-simple-btn-primary"
              onClick={onSaveContact}
              aria-label="Save contact to phone address book"
            >
              <UserPlus className="w-4.5 h-4.5 flex-shrink-0" />
              <span>Save Contact</span>
            </button>
          </div>
        )}

        {/* ── 4. Neatly Grouped Secondary Contact Actions ── */}
        {(telHref || waHref || emailHref || websiteHref) && (
          <div className="zappit-simple-actions-group">
            {telHref && (
              <a
                href={telHref}
                className="zappit-simple-action-pill"
                aria-label={`Call ${fullPhone}`}
              >
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span>Call</span>
              </a>
            )}

            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="zappit-simple-action-pill"
                aria-label="Send WhatsApp message"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span>WhatsApp</span>
              </a>
            )}

            {emailHref && (
              <a
                href={emailHref}
                className="zappit-simple-action-pill"
                aria-label={`Email ${card.email}`}
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>Email</span>
              </a>
            )}

            {websiteHref && (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="zappit-simple-action-pill"
                aria-label="Visit website"
              >
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span>Website</span>
              </a>
            )}
          </div>
        )}

        {/* ── 5. Detailed Direct Contacts (Copyable List) ── */}
        {(fullPhone || card.email || websiteHref) && (
          <div className="zappit-simple-contact-list">
            {fullPhone && (
              <div className="zappit-simple-contact-row">
                <div className="zappit-simple-contact-left">
                  <span className="zappit-simple-contact-icon">
                    <Phone className="w-4 h-4" />
                  </span>
                  <div className="zappit-simple-contact-text">
                    <span className="zappit-simple-contact-label">Mobile</span>
                    <a href={telHref} className="zappit-simple-contact-value">
                      {fullPhone}
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  className="zappit-simple-copy-btn"
                  onClick={() => handleCopy(fullPhone, "phone")}
                  aria-label="Copy phone number"
                  title="Copy phone"
                >
                  {copiedLabel === "phone" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {card.email && (
              <div className="zappit-simple-contact-row">
                <div className="zappit-simple-contact-left">
                  <span className="zappit-simple-contact-icon">
                    <Mail className="w-4 h-4" />
                  </span>
                  <div className="zappit-simple-contact-text">
                    <span className="zappit-simple-contact-label">Email</span>
                    <a href={emailHref} className="zappit-simple-contact-value">
                      {card.email}
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  className="zappit-simple-copy-btn"
                  onClick={() => handleCopy(card.email || "", "email")}
                  aria-label="Copy email address"
                  title="Copy email"
                >
                  {copiedLabel === "email" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {websiteHref && (
              <div className="zappit-simple-contact-row">
                <div className="zappit-simple-contact-left">
                  <span className="zappit-simple-contact-icon">
                    <Globe className="w-4 h-4" />
                  </span>
                  <div className="zappit-simple-contact-text">
                    <span className="zappit-simple-contact-label">Website</span>
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zappit-simple-contact-value"
                    >
                      {websiteHref.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                    </a>
                  </div>
                </div>
                <a
                  href={websiteHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zappit-simple-copy-btn"
                  aria-label="Open website"
                  title="Open website"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── 6. Neatly Grouped Social Links ── */}
        {socialLinks.length > 0 && (
          <div className="zappit-simple-social-section">
            <h2 className="zappit-simple-section-title">Connect &amp; Social</h2>
            <div className="zappit-simple-social-grid">
              {socialLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zappit-simple-social-card"
                  aria-label={`Visit ${item.name}`}
                >
                  <span className="zappit-simple-social-icon">
                    <SocialBrandIcon brand={item.brand} />
                  </span>
                  <span className="zappit-simple-social-name">{item.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. Business Services (When provided) ── */}
        {Array.isArray(card.services) && card.services.length > 0 && (
          <div className="zappit-simple-services-section">
            <h2 className="zappit-simple-section-title">Services &amp; Offerings</h2>
            <div className="zappit-simple-services-list">
              {card.services.map((service, index) => (
                <div key={index} className="zappit-simple-service-item">
                  <span className="zappit-simple-service-dot">•</span>
                  <span className="zappit-simple-service-text">{service}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 8. Profile Products (When present) ── */}
        {effectiveProducts.length > 0 && (
          <div className="zappit-simple-products-section">
            <h2 className="zappit-simple-section-title">Products</h2>
            <div className="zappit-simple-products-grid">
              {effectiveProducts.map((product) => (
                <div key={product.id} className="zappit-simple-product-card">
                  {product.imageUrl && (
                    <div className="zappit-simple-product-image">
                      <img src={resolveMediaUrl(product.imageUrl)} alt={product.name} />
                    </div>
                  )}
                  <div className="zappit-simple-product-body">
                    <div className="zappit-simple-product-name">{product.name}</div>
                    {product.description && (
                      <p className="zappit-simple-product-desc">{product.description}</p>
                    )}
                    <div className="zappit-simple-product-footer">
                      {product.price && (
                        <span className="zappit-simple-product-price">
                          {product.currency || "$"}
                          {product.price}
                        </span>
                      )}
                      {product.ctaUrl && (
                        <a
                          href={product.ctaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="zappit-simple-product-cta"
                        >
                          {product.ctaLabel || "View"} →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 9. Secondary Utilities (Exchange Contact, Brochure, Share) ── */}
        <div className="zappit-simple-utilities">
          {onShareDetails && (
            <button
              type="button"
              className="zappit-simple-util-btn"
              onClick={onShareDetails}
              aria-label="Share your contact details with this person"
            >
              <Users className="w-4 h-4" />
              <span>Exchange Details</span>
            </button>
          )}

          {hasBrochure && onOpenBrochure && (
            <button
              type="button"
              className="zappit-simple-util-btn"
              onClick={onOpenBrochure}
              aria-label="Download business brochure"
            >
              <FileText className="w-4 h-4" />
              <span>Brochure</span>
            </button>
          )}

          {onShare && (
            <button
              type="button"
              className="zappit-simple-util-btn"
              onClick={onShare}
              aria-label="Share this card link"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
