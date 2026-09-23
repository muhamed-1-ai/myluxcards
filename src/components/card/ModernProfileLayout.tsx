"use client";

import React, { useState, useEffect } from "react";
import { resolveMediaUrl } from "@/lib/storage/resolver";
import { formatCountryCode, CardProfileProduct } from "@/lib/cards";
import {
  Phone,
  Mail,
  MessageSquare,
  Globe,
  Share2,
  FileText,
  UserPlus,
  User,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Briefcase,
  ShoppingBag,
} from "lucide-react";


export interface ModernProfileConfig {
  cardBackground?: string;
  cardBorder?: string;
  mutedText?: string;
  primaryBtnBg?: string;
  primaryBtnText?: string;
  secondaryBtnBg?: string;
  secondaryBtnText?: string;
  secondaryBtnBorder?: string;
  headerStyle?: "gradient" | "solid";
  headerGradientStart?: string;
  headerGradientEnd?: string;
  headerHeight?: number;
  coverOverlay?: number;
  fontFamily?: string;
  nameSize?: number;
  bodySize?: number;
  cardRadius?: number;
  buttonRadius?: number;
  spacingDensity?: "compact" | "comfortable" | "spacious";
}

export interface ModernProfileLayoutProps {
  card: {
    name?: string;
    title?: string;
    business?: string;
    countryCode?: string;
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
    coverScale?: number;
    coverRotation?: number;
    coverX?: number;
    coverY?: number;
    profileBackground?: string;
    profileAccent?: string;
    profileText?: string;
    modernConfig?: ModernProfileConfig;
    slug?: string;
    id?: string;
  };
  profileProducts?: CardProfileProduct[];
  onSaveContact?: () => void;
  onShare?: () => void;
  onOpenBrochure?: () => void;
  isDashboardPreview?: boolean;
}

export function getLuminance(hex?: string): number {
  if (!hex || typeof hex !== "string") return 0;
  const clean = hex.replace("#", "").trim();
  if (clean.length < 6) return 0;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightColor(hex?: string): boolean {
  return getLuminance(hex) > 0.45;
}

export function resolveModernThemeTokens(card: ModernProfileLayoutProps["card"]) {
  const bg = card.profileBackground || "#050B14";
  const accent = card.profileAccent || "#00E5FF";
  const text = card.profileText || "#FFFFFF";
  const mc = card.modernConfig || {};

  const bgIsLight = isLightColor(bg);

  // Derived surfaces
  const cardBg = mc.cardBackground || (bgIsLight ? "rgba(255, 255, 255, 0.88)" : "#0a1628");
  const cardBorder = mc.cardBorder || (bgIsLight ? "rgba(0, 0, 0, 0.12)" : "rgba(30, 58, 115, 0.45)");
  const mutedText = mc.mutedText || (bgIsLight ? "rgba(0, 0, 0, 0.62)" : "#94a3b8");
  const rowBg = bgIsLight ? "rgba(0, 0, 0, 0.04)" : "rgba(15, 27, 48, 0.7)";
  const rowBorder = bgIsLight ? "rgba(0, 0, 0, 0.08)" : "rgba(30, 58, 115, 0.5)";

  // Derived button styles
  const accentIsLight = isLightColor(accent);
  const primaryBtnBg = mc.primaryBtnBg || (
    bgIsLight
      ? `linear-gradient(135deg, ${accent}, ${accent}dd)`
      : `linear-gradient(135deg, ${accent}, #0066FF)`
  );
  const primaryBtnText = mc.primaryBtnText || (accentIsLight ? "#000000" : "#ffffff");

  const secondaryBtnBg = mc.secondaryBtnBg || (bgIsLight ? "rgba(0, 0, 0, 0.06)" : "rgba(15, 23, 42, 0.65)");
  const secondaryBtnBorder = mc.secondaryBtnBorder || (bgIsLight ? "rgba(0, 0, 0, 0.15)" : `rgba(${accent === "#00E5FF" ? "0, 229, 255" : "255, 255, 255"}, 0.3)`);
  const secondaryBtnText = mc.secondaryBtnText || text;

  // Header style
  const headerStyle = mc.headerStyle || "gradient";
  const headerHeight = mc.headerHeight || 200;
  const coverOverlay = mc.coverOverlay !== undefined ? mc.coverOverlay / 100 : 0.2;
  const headerGradStart = mc.headerGradientStart || (bgIsLight ? accent : "#061830");
  const headerGradEnd = mc.headerGradientEnd || (bgIsLight ? bg : "#004b99");
  const headerBg = headerStyle === "solid" ? bg : `linear-gradient(135deg, ${headerGradStart}, ${headerGradEnd})`;

  // Typography & shape
  const fontFamily = mc.fontFamily || "'Inter', system-ui, -apple-system, sans-serif";
  const nameSize = mc.nameSize || 22;
  const bodySize = mc.bodySize || 14;
  const cardRadius = mc.cardRadius !== undefined ? mc.cardRadius : 14;
  const buttonRadius = mc.buttonRadius !== undefined ? mc.buttonRadius : 21;
  const gap = mc.spacingDensity === "compact" ? 10 : mc.spacingDensity === "spacious" ? 18 : 14;

  return {
    bgIsLight,
    styleVars: {
      width: "100%",
      maxWidth: 480,
      margin: "0 auto",
      boxSizing: "border-box",
      fontFamily,
      ["--mod-bg" as string]: bg,
      ["--mod-accent" as string]: accent,
      ["--mod-text" as string]: text,
      ["--mod-card-bg" as string]: cardBg,
      ["--mod-card-border" as string]: cardBorder,
      ["--mod-muted-text" as string]: mutedText,
      ["--mod-row-bg" as string]: rowBg,
      ["--mod-row-border" as string]: rowBorder,
      ["--mod-btn-primary-bg" as string]: primaryBtnBg,
      ["--mod-btn-primary-text" as string]: primaryBtnText,
      ["--mod-btn-glass-bg" as string]: secondaryBtnBg,
      ["--mod-btn-glass-border" as string]: secondaryBtnBorder,
      ["--mod-btn-glass-text" as string]: secondaryBtnText,
      ["--mod-header-bg" as string]: headerBg,
      ["--mod-header-height" as string]: `${headerHeight}px`,
      ["--mod-header-overlay" as string]: coverOverlay,
      ["--mod-name-size" as string]: `${nameSize}px`,
      ["--mod-body-size" as string]: `${bodySize}px`,
      ["--mod-card-radius" as string]: `${cardRadius}px`,
      ["--mod-btn-radius" as string]: `${buttonRadius}px`,
      ["--mod-gap" as string]: `${gap}px`,
    } as React.CSSProperties,
  };
}

export function ModernProfileLayout({
  card,
  profileProducts,
  onSaveContact,
  onShare,
  onOpenBrochure,
  isDashboardPreview = false,
}: ModernProfileLayoutProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fetchedProducts, setFetchedProducts] = useState<CardProfileProduct[]>([]);

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
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const name = card.name || "Your Name";
  const subtitle = [card.title, card.business].filter(Boolean).join(" – ") || "Title – Company Name";
  const fullPhone = card.mobile ? `${formatCountryCode(card.countryCode)} ${card.mobile}`.trim() : "";
  const fullWhatsapp = card.whatsapp ? `${formatCountryCode(card.countryCode)} ${card.whatsapp}`.trim() : "";
  const hasBrochure = Boolean(card.brochure || card.brochureData);

  const socialLinks = [
    { key: "instagram", name: "Instagram", url: card.social?.Instagram || card.social?.instagram, brand: "instagram" },
    { key: "website", name: "Website", url: card.website, brand: "website" },
    { key: "linkedin", name: "LinkedIn", url: card.social?.LinkedIn || card.social?.linkedin, brand: "linkedin" },
    { key: "youtube", name: "YouTube", url: card.social?.YouTube || card.social?.youtube, brand: "youtube" },
    { key: "facebook", name: "Facebook", url: card.social?.Facebook || card.social?.facebook, brand: "facebook" },
    { key: "twitter", name: "Twitter", url: card.social?.Twitter || card.social?.twitter, brand: "twitter" },
    { key: "google", name: "Google Maps", url: card.social?.["Google Maps"] || card.social?.google, brand: "maps" },
  ].filter((item) => item.url && item.url.trim().length > 0);

  // Initials fallback
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "ZP";

  const { styleVars } = resolveModernThemeTokens(card);

  return (
    <div className="zappit-modern-wrapper" style={styleVars}>
      <div className="zappit-modern-container">
        
        {/* ── 1. COVER & TOP BAR ── */}
        <div className="zappit-modern-cover">
          {card.cover ? (
            <img
              src={card.cover}
              alt="Cover"
              className="zappit-modern-cover-img"
              style={{
                transform: `scale(${(card.coverScale ?? 100) / 100}) rotate(${card.coverRotation ?? 0}deg)`,
                objectPosition: `${card.coverX ?? 50}% ${card.coverY ?? 50}%`,
              }}
            />
          ) : (
            <div className="zappit-modern-cover-gradient" />
          )}

          {/* Centered Overlapping Avatar */}
          <div className="zappit-modern-avatar-wrap">
            <div className="zappit-modern-avatar-ring">
              {card.logo ? (
                <img
                  src={resolveMediaUrl(card.logo)}
                  alt={name}
                  className="zappit-modern-avatar-img"
                  style={{
                    transform: `scale(${(card.logoScale || 100) / 100}) rotate(${card.logoRotation || 0}deg)`,
                    objectPosition: `${card.logoX || 50}% ${card.logoY || 50}%`,
                  }}
                />
              ) : (
                <div className="zappit-modern-avatar-fallback">
                  {initials}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 2. CENTERED PROFILE HEADER ── */}
        <div className="zappit-modern-header">
          <h1 className="zappit-modern-name">{name}</h1>
          <p className="zappit-modern-subtitle">{subtitle}</p>
        </div>

        {/* ── 3. PRIMARY ACTION ROW ── */}
        <div className="zappit-modern-actions-grid">
          <button
            type="button"
            className="zappit-modern-btn-primary"
            onClick={onSaveContact}
          >
            <UserPlus className="w-4 h-4" />
            <span>Save Contact</span>
          </button>

          {hasBrochure && (
            <button
              type="button"
              className="zappit-modern-btn-glass"
              onClick={onOpenBrochure}
            >
              <FileText className="w-4 h-4" />
              <span>Brochure</span>
            </button>
          )}

          <button
            type="button"
            className="zappit-modern-btn-glass"
            onClick={onShare}
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>

        {/* ── 4. CONTACT DETAILS CARD ── */}
        {(fullPhone || card.email || fullWhatsapp) && (
          <div className="zappit-modern-card">
            <div className="zappit-modern-card-header">
              <User className="w-4 h-4 text-[#00E5FF]" />
              <span>Contact Details</span>
            </div>

            <div className="zappit-modern-contact-list">
              {/* Phone Row */}
              {fullPhone && (
                <div className="zappit-modern-contact-row">
                  <div className="zappit-modern-icon-circle blue">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div className="zappit-modern-contact-body">
                    <span className="zappit-modern-label">Mobile</span>
                    <a href={`tel:${card.mobile}`} className="zappit-modern-val">
                      {fullPhone}
                    </a>
                  </div>
                  <button
                    type="button"
                    className="zappit-modern-copy-btn"
                    onClick={() => handleCopy(fullPhone, "phone")}
                    title="Copy phone"
                  >
                    {copiedField === "phone" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* Email Row */}
              {card.email && (
                <div className="zappit-modern-contact-row">
                  <div className="zappit-modern-icon-circle blue">
                    <Mail className="w-4 h-4 text-white" />
                  </div>
                  <div className="zappit-modern-contact-body">
                    <span className="zappit-modern-label">Email</span>
                    <a href={`mailto:${card.email}`} className="zappit-modern-val break-all">
                      {card.email}
                    </a>
                  </div>
                  <button
                    type="button"
                    className="zappit-modern-copy-btn"
                    onClick={() => handleCopy(card.email!, "email")}
                    title="Copy email"
                  >
                    {copiedField === "email" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* WhatsApp Row */}
              {fullWhatsapp && (
                <div className="zappit-modern-contact-row green-border">
                  <div className="zappit-modern-icon-circle green">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div className="zappit-modern-contact-body">
                    <span className="zappit-modern-label">WhatsApp</span>
                    <span className="zappit-modern-val">{fullWhatsapp}</span>
                  </div>
                  <a
                    href={`https://wa.me/${card.whatsapp?.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zappit-modern-chat-btn"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4.5 BUSINESS INFORMATION (SERVICES / PRODUCTS) CARD ── */}
        {card.services && card.services.length > 0 && (
          <div className="zappit-modern-card">
            <div className="zappit-modern-card-header justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#00E5FF]" />
                <div className="flex flex-col">
                  <span className="text-[10px] tracking-wider uppercase text-slate-400 font-semibold leading-none">BUSINESS INFORMATION</span>
                  <span className="text-sm font-bold leading-tight mt-0.5">Services / Products</span>
                </div>
              </div>
            </div>

            <div className="zappit-modern-services-list">
              {card.services.map((item, idx) => (
                <div key={`${item}-${idx}`} className="zappit-modern-service-row">
                  <div className="zappit-modern-service-num">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="zappit-modern-service-name">
                    {item}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4.8 MY PRODUCTS CARD ── */}
        {(() => {
          const activeProducts = (effectiveProducts || []).filter((p) => p.enabled !== false);
          if (activeProducts.length === 0) return null;

          return (
            <div className="zappit-modern-card">
              <div className="zappit-modern-card-header justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#00E5FF]" />
                  <div className="flex flex-col">
                    <span className="text-[10px] tracking-wider uppercase text-slate-400 font-semibold leading-none">SHOWCASE</span>
                    <span className="text-sm font-bold leading-tight mt-0.5">My Products</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {activeProducts.length} {activeProducts.length === 1 ? "Product" : "Products"}
                </span>
              </div>

              <div className="zappit-modern-products-grid">
                {activeProducts.map((prod) => {
                  const resolvedImg = prod.imageUrl ? resolveMediaUrl(prod.imageUrl) : null;
                  const currencySymbol = prod.currency === "USD" ? "$" : prod.currency === "EUR" ? "€" : "₹";
                  const formattedPrice = prod.price ? `${currencySymbol}${prod.price}` : null;

                  return (
                    <div key={prod.id} className="zappit-modern-product-card">
                      {resolvedImg ? (
                        <div className="zappit-modern-product-img-wrap">
                          <img
                            src={resolvedImg}
                            alt={prod.name}
                            className="zappit-modern-product-img"
                          />
                        </div>
                      ) : (
                        <div className="zappit-modern-product-img-fallback">
                          <ShoppingBag className="w-8 h-8 text-slate-500 opacity-60" />
                        </div>
                      )}

                      <div className="zappit-modern-product-body">
                        {prod.category && (
                          <span className="zappit-modern-product-cat">
                            {prod.category}
                          </span>
                        )}

                        <h3 className="zappit-modern-product-title">
                          {prod.name}
                        </h3>

                        {formattedPrice && (
                          <div className="zappit-modern-product-price">
                            {formattedPrice}
                          </div>
                        )}

                        {prod.description && (
                          <p className="zappit-modern-product-desc">
                            {prod.description}
                          </p>
                        )}

                        {prod.ctaUrl && (
                          <a
                            href={prod.ctaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="zappit-modern-product-cta"
                          >
                            <span>{prod.ctaLabel || "View / Explore"}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── 5. APPS & LINKS CARD ── */}
        {socialLinks.length > 0 && (
          <div className="zappit-modern-card">
            <div className="zappit-modern-card-header justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[#00E5FF]" />
                <span>Apps &amp; Links</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Follow &amp; Explore →</span>
            </div>

            <div className="zappit-modern-apps-grid">
              {socialLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="zappit-modern-app-tile"
                >
                  <div className={`zappit-modern-app-icon ${item.brand}`}>
                    {item.brand === "instagram" && <span>📸</span>}
                    {item.brand === "website" && <Globe className="w-4 h-4 text-sky-400" />}
                    {item.brand === "linkedin" && <span className="font-bold text-blue-400 text-xs">in</span>}
                    {item.brand === "youtube" && <span className="text-red-500 text-xs">▶</span>}
                    {item.brand === "facebook" && <span className="font-bold text-blue-500 text-xs">f</span>}
                    {item.brand === "twitter" && <span className="font-bold text-sky-400 text-xs">𝕏</span>}
                    {item.brand === "maps" && <span>📍</span>}
                  </div>
                  <span className="zappit-modern-app-name">{item.name}</span>
                  <span className="zappit-modern-app-arrow">→</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── 6. ABOUT ME CARD ── */}
        {card.about && (
          <div className="zappit-modern-card">
            <div className="zappit-modern-card-header">
              <Users className="w-4 h-4 text-[#00E5FF]" />
              <span>About Me</span>
            </div>
            <div className="zappit-modern-about-body">
              <p className="zappit-modern-about-text">{card.about}</p>
              <div className="zappit-modern-about-graphic">
                <div className="zappit-graphic-badge">
                  <span className="text-[#00E5FF] font-black text-lg">Z</span>
                  <span className="text-xs font-bold text-slate-300">Ideas to Impact</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 7. BRAND FOOTER ── */}
        <div className="zappit-modern-footer">
          <div className="zappit-footer-left">
            <span className="font-bold text-[#00E5FF] tracking-wider text-xs">ZAPPIT</span>
            <span className="text-slate-500 text-xs mx-1">|</span>
            <span className="text-slate-400 text-xs">Your Digital Identity</span>
          </div>
          <div className="zappit-footer-right">
            <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span className="text-slate-400 text-[11px] font-medium">Tap to Connect</span>
          </div>
        </div>

      </div>
    </div>
  );
}
