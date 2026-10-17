"use client";

import React, { useState, useEffect } from "react";
import { resolveMediaUrl } from "@/lib/storage/resolver";
import { CardProfileProduct } from "@/lib/cards";
import { normalizePhoneNumber } from "@/lib/phone";
import { BrandLogo } from "./BrandLogo";
import {
  resolveSimpleProfileTokens,
  isLightColor,
  resolveAvatarDiameter,
  calculateAvatarSpacing,
} from "@/lib/themeTokens";
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
    logoZoom?: number;
    logoRotation?: number;
    logoX?: number;
    logoY?: number;
    coverScale?: number;
    coverRotation?: number;
    coverX?: number;
    coverY?: number;
    simpleConfig?: {
      coverScale?: number;
      coverRotation?: number;
      coverX?: number;
      coverY?: number;
    };
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

function SocialBrandIcon({ brand, name }: { brand: string; name?: string }) {
  return <BrandLogo brand={brand} name={name} size={26} />;
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
  const [coverImgError, setCoverImgError] = useState(false);

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
    { key: "google", name: "Google Maps", url: card.social?.["Google Maps"] || card.social?.google || card.social?.["Google Business"], brand: "maps" },
    { key: "whatsapp", name: "WhatsApp", url: card.social?.WhatsApp || card.social?.whatsapp, brand: "whatsapp" },
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

  // Design-specific crop coordinates for Simple cover header (falls back to card cover settings)
  const simpleConfig = card.simpleConfig || {};
  const coverScale = typeof simpleConfig.coverScale === "number" ? simpleConfig.coverScale : (card.coverScale ?? 100);
  const coverRotation = typeof simpleConfig.coverRotation === "number" ? simpleConfig.coverRotation : (card.coverRotation ?? 0);
  const coverX = typeof simpleConfig.coverX === "number" ? simpleConfig.coverX : (card.coverX ?? 50);
  const coverY = typeof simpleConfig.coverY === "number" ? simpleConfig.coverY : (card.coverY ?? 50);
  const hasCover = card.cover !== "none";
  const avatarDiameter = resolveAvatarDiameter(card.logoScale);
  const spacing = calculateAvatarSpacing(avatarDiameter, hasCover);

  return (
    <div
      className={`zappit-simple-wrapper ${themeClass}`}
      style={tokens.styleObj as React.CSSProperties}
    >
      <div className="zappit-simple-card">

        {/* ── Wide Cover Photo Header (Facebook-style) ── */}
        <div className="zappit-simple-cover-wrap">
          {card.cover && !coverImgError ? (
            <img
              src={resolveMediaUrl(card.cover)}
              alt="Cover photo"
              className="zappit-simple-cover-img"
              onError={() => setCoverImgError(true)}
              style={{
                transform: `scale(${coverScale / 100}) rotate(${coverRotation}deg)`,
                objectPosition: `${coverX}% ${coverY}%`,
              }}
            />
          ) : (
            <div className="zappit-simple-cover-fallback" />
          )}

          {/* Edit button in top-right corner if authorized (never shown to public visitors) */}
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
        </div>

        {/* ── Profile Content Body (Solid surface below cover) ── */}
        <div className="zappit-simple-body">

          {/* ── 1. Contained Profile Photo (Overlapping bottom edge of cover) ── */}
          <div
            className="zappit-simple-photo-wrap"
            style={{
              marginTop: `${spacing.marginTop}px`,
              marginBottom: `${spacing.gapBeforeName}px`,
            }}
          >
            <div
              className="zappit-simple-photo-ring"
              style={{
                width: `${spacing.diameter}px`,
                height: `${spacing.diameter}px`,
              }}
            >
              {card.logo && !imgError ? (
                <img
                  src={resolveMediaUrl(card.logo)}
                  alt={name}
                  className="zappit-simple-photo-img"
                  onError={() => setImgError(true)}
                  style={{
                    transform: `scale(${((card.logoZoom || 100) / 100)}) rotate(${card.logoRotation || 0}deg)`,
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
                    <BrandLogo brand={item.brand} name={item.name} size={26} />
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

        </div>{/* End zappit-simple-body */}
      </div>{/* End zappit-simple-card */}
    </div>
  );
}
