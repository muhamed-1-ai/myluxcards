"use client";

import React, { useState, useEffect } from "react";
import { resolveMediaUrl } from "@/lib/storage/resolver";
import { formatCountryCode, CardProfileProduct, isValidStoreUrl } from "@/lib/cards";
import { normalizePhoneNumber } from "@/lib/phone";
import { ProfileActions } from "./ProfileActions";
import { BrandLogo } from "./BrandLogo";
import { AppStoreChooserModal, type AppDownloadSettings } from "./AppStoreChooserModal";
import { detectUserDevice, type DetectedOS } from "@/lib/device";
import {
  resolveThemeTokens,
  isLightColor,
  getLuminance,
  resolveAvatarDiameter,
  calculateAvatarSpacing,
} from "@/lib/themeTokens";
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
  Pencil,
} from "lucide-react";

export { getLuminance, isLightColor };

export interface ModernProfileConfig {
  cardBackground?: string;
  cardBorder?: string;
  nameColor?: string;
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
    profileBackground?: string;
    profileAccent?: string;
    profileText?: string;
    nameColor?: string;
    modernConfig?: ModernProfileConfig;
    slug?: string;
    id?: string;
    appDownload?: AppDownloadSettings;
    contactNumbers?: Array<{
      id?: string;
      label?: string;
      countryCode?: string;
      phoneNumber: string;
      isPrimary?: boolean;
    }>;
  };
  profileProducts?: CardProfileProduct[];
  onSaveContact?: () => void;
  onShareDetails?: () => void;
  onShare?: () => void;
  onOpenBrochure?: () => void;
  onEditProfile?: () => void;
  isDashboardPreview?: boolean;
}

function SocialBrandLogo({ brand, name }: { brand: string; name?: string }) {
  return <BrandLogo brand={brand} name={name} size={30} />;
}

export function resolveModernThemeTokens(card: ModernProfileLayoutProps["card"]) {
  const { styleObj } = resolveThemeTokens(card);
  const fontFamily = card.modernConfig?.fontFamily || "'Inter', system-ui, -apple-system, sans-serif";

  return {
    bgIsLight: isLightColor(card.profileBackground || "#050B14"),
    styleVars: {
      width: "100%",
      maxWidth: 480,
      margin: "0 auto",
      boxSizing: "border-box",
      fontFamily,
      ...styleObj,
    } as React.CSSProperties,
  };
}

export function ModernProfileLayout({
  card,
  profileProducts,
  onSaveContact,
  onShareDetails,
  onShare,
  onOpenBrochure,
  onEditProfile,
  isDashboardPreview = false,
}: ModernProfileLayoutProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fetchedProducts, setFetchedProducts] = useState<CardProfileProduct[]>([]);
  const [storeChooserOpen, setStoreChooserOpen] = useState(false);
  const [detectedOS, setDetectedOS] = useState<DetectedOS>("unknown");

  useEffect(() => {
    setDetectedOS(detectUserDevice());
  }, []);

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
  const subtitle = [card.title, card.business].filter(Boolean).join(" – ");
  const normPhone = normalizePhoneNumber(card.mobile, card.countryCode || card.countryIso);
  const fullPhone = normPhone.isValid ? (normPhone.displayFormatted || normPhone.normalized) : (card.mobile || "");
  const normWhatsapp = normalizePhoneNumber(card.whatsapp, card.countryCode || card.countryIso);
  const fullWhatsapp = normWhatsapp.isValid ? (normWhatsapp.displayFormatted || normWhatsapp.normalized) : (card.whatsapp || "");
  // Resolve all contact numbers to display
  const allPhones: Array<{
    id: string;
    label: string;
    displayFormatted: string;
    telLink?: string;
    rawNormalized: string;
  }> = [];

  if (Array.isArray(card.contactNumbers) && card.contactNumbers.length > 0) {
    for (let idx = 0; idx < card.contactNumbers.length; idx++) {
      const item = card.contactNumbers[idx];
      const rawNum = (item.phoneNumber || "").trim();
      if (!rawNum) continue;
      const cc = item.countryCode || card.countryCode || card.countryIso;
      const norm = normalizePhoneNumber(rawNum, cc);
      const displayFormatted = norm.isValid ? (norm.displayFormatted || norm.normalized) : (cc ? `${formatCountryCode(cc)} ${rawNum}` : rawNum);
      allPhones.push({
        id: item.id || `phone_${idx}`,
        label: item.label || (idx === 0 ? "Mobile" : "Other"),
        displayFormatted,
        telLink: norm.isValid ? norm.telLink : `tel:${rawNum}`,
        rawNormalized: norm.normalized || rawNum,
      });
    }
  } else if (fullPhone) {
    allPhones.push({
      id: "primary_mobile",
      label: "Mobile",
      displayFormatted: fullPhone,
      telLink: normPhone.isValid ? normPhone.telLink : `tel:${card.mobile}`,
      rawNormalized: normPhone.normalized || card.mobile || "",
    });
  }

  const hasBrochure = Boolean(card.brochure || card.brochureData);

  const appDownload = card.appDownload;
  const hasApple = Boolean(appDownload?.appStoreUrl && isValidStoreUrl(appDownload.appStoreUrl, "apple"));
  const hasGoogle = Boolean(appDownload?.playStoreUrl && isValidStoreUrl(appDownload.playStoreUrl, "google"));
  const hasAppDownload = hasApple || hasGoogle;

  const appTileLabel = hasApple && hasGoogle
    ? "Download Our App"
    : hasApple
    ? "Download on App Store"
    : "Get it on Google Play";

  const defaultAppUrl = hasApple && hasGoogle
    ? (detectedOS === "android" ? appDownload?.playStoreUrl : appDownload?.appStoreUrl) || ""
    : (hasApple ? appDownload?.appStoreUrl : appDownload?.playStoreUrl) || "";

  const handleAppDownloadClick = (e: React.MouseEvent) => {
    const currentDevice = detectUserDevice();
    if (hasApple && hasGoogle) {
      if (currentDevice === "android" && appDownload?.playStoreUrl) {
        if (e.currentTarget.getAttribute("href") !== appDownload.playStoreUrl) {
          e.preventDefault();
          window.open(appDownload.playStoreUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }
      if (currentDevice === "ios" && appDownload?.appStoreUrl) {
        if (e.currentTarget.getAttribute("href") !== appDownload.appStoreUrl) {
          e.preventDefault();
          window.open(appDownload.appStoreUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }
      e.preventDefault();
      setStoreChooserOpen(true);
      return;
    }

    if (hasApple && !hasGoogle) {
      if (currentDevice === "ios" && appDownload?.appStoreUrl) {
        return;
      }
      e.preventDefault();
      setStoreChooserOpen(true);
      return;
    }

    if (!hasApple && hasGoogle) {
      if (currentDevice === "android" && appDownload?.playStoreUrl) {
        return;
      }
      e.preventDefault();
      setStoreChooserOpen(true);
      return;
    }
  };

  const socialLinks = [
    { key: "instagram", name: "Instagram", url: card.social?.Instagram || card.social?.instagram, brand: "instagram" },
    { key: "website", name: "Website", url: card.website, brand: "website" },
    { key: "linkedin", name: "LinkedIn", url: card.social?.LinkedIn || card.social?.linkedin, brand: "linkedin" },
    { key: "youtube", name: "YouTube", url: card.social?.YouTube || card.social?.youtube, brand: "youtube" },
    { key: "facebook", name: "Facebook", url: card.social?.Facebook || card.social?.facebook, brand: "facebook" },
    { key: "twitter", name: "Twitter", url: card.social?.Twitter || card.social?.twitter, brand: "twitter" },
    { key: "google-business", name: "Google Business", url: card.social?.["Google Business"] || card.social?.googlebusiness, brand: "google" },
    { key: "google-maps", name: "Google Maps", url: card.social?.["Google Maps"] || card.social?.googlemaps || (!card.social?.["Google Business"] && !card.social?.googlebusiness ? card.social?.google : undefined), brand: "maps" },
    { key: "google-reviews", name: "Google Reviews", url: card.social?.["Google Reviews"] || card.social?.["google-reviews"] || card.social?.["google_reviews"] || card.social?.googlereviews || card.social?.reviews, brand: "reviews" },
    ...(hasAppDownload ? [{
      key: "app-download",
      name: appTileLabel,
      subText: card.appDownload?.appName,
      url: defaultAppUrl,
      brand: "download",
      isAppDownload: true,
      hasBothStores: hasApple && hasGoogle,
    }] : []),
    { key: "whatsapp", name: "WhatsApp", url: card.social?.WhatsApp || card.social?.whatsapp, brand: "whatsapp" },
    { key: "github", name: "GitHub", url: card.social?.GitHub || card.social?.github, brand: "github" },
  ].filter((item) => item.url && item.url.trim().length > 0);

  // Initials fallback
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "ZP";

  const { styleVars } = resolveModernThemeTokens(card);

  const hasCover = card.cover !== "none";
  const avatarDiameter = resolveAvatarDiameter(card.logoScale);
  const spacing = calculateAvatarSpacing(avatarDiameter, hasCover);

  return (
    <div className="zappit-modern-wrapper" style={styleVars}>
      <div className="zappit-modern-container">
        
        {/* ── TOP-RIGHT EDIT BUTTON ── */}
        {onEditProfile && (
          <div className="zappit-profile-edit-bar">
            <button
              type="button"
              onClick={onEditProfile}
              aria-label="Edit profile"
              className="zappit-profile-edit-btn"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>
        )}

        {/* ── 1. COVER AREA (Fixed height, overflow hidden, safe zone gradient) ── */}
        <div
          className="zappit-modern-cover"
          style={{
            height: card.modernConfig?.headerHeight ? `${card.modernConfig.headerHeight}px` : undefined,
            minHeight: card.modernConfig?.headerHeight ? `${card.modernConfig.headerHeight}px` : undefined,
          }}
        >
          {card.cover ? (
            <img
              src={resolveMediaUrl(card.cover)}
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
          <div className="zappit-modern-cover-overlay" />
        </div>

        {/* ── 2. FLOATING AVATAR AREA (Dynamic negative top margin, precise space reservation) ── */}
        <div
          className="zappit-modern-avatar-wrap"
          style={{
            marginTop: `${spacing.marginTop}px`,
            marginBottom: `${spacing.gapBeforeName}px`,
          }}
        >
          <div
            className="zappit-modern-avatar-circle zappit-modern-avatar-ring"
            style={{
              width: `${spacing.diameter}px`,
              height: `${spacing.diameter}px`,
            }}
          >
            {card.logo ? (
              <img
                src={resolveMediaUrl(card.logo)}
                alt={name}
                className="zappit-modern-avatar-img"
                style={{
                  transform: `scale(${((card.logoZoom || 100) / 100)}) rotate(${card.logoRotation || 0}deg)`,
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

        {/* ── 3. CENTERED PROFILE HEADER (Always stays below avatar) ── */}
        <div className="zappit-modern-header">
          <h1 className="zappit-modern-name">{name}</h1>
          {subtitle && <p className="zappit-modern-subtitle">{subtitle}</p>}
        </div>

        {/* ── 3. PRIMARY ACTION ROW ── */}
        <ProfileActions
          card={card}
          onSaveContact={onSaveContact}
          onShareDetails={onShareDetails}
          onShare={onShare}
          onOpenBrochure={onOpenBrochure}
          layoutStyle="modern"
          isDashboardPreview={isDashboardPreview}
        />

        {/* ── 4. CONTACT DETAILS CARD ── */}
        {(allPhones.length > 0 || card.email || fullWhatsapp) && (
          <div className="zappit-modern-card">
            <div className="zappit-modern-card-header">
              <User className="w-4 h-4" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
              <span>Contact Details</span>
            </div>

            <div className="zappit-modern-contact-list">
              {/* Phone Rows */}
              {allPhones.map((p) => (
                <div key={p.id} className="zappit-modern-contact-row">
                  <div
                    className="zappit-modern-icon-circle"
                    style={{
                      background: "var(--profile-primary-gradient, var(--profile-primary))",
                      color: "var(--profile-primary-text, #ffffff)",
                    }}
                  >
                    <Phone className="w-4 h-4" style={{ color: "var(--profile-primary-text, #ffffff)" }} />
                  </div>
                  <div className="zappit-modern-contact-body">
                    <span className="zappit-modern-label">{p.label}</span>
                    <a href={p.telLink} className="zappit-modern-val">
                      {p.displayFormatted}
                    </a>
                  </div>
                  <button
                    type="button"
                    className="zappit-modern-copy-btn"
                    onClick={() => handleCopy(p.rawNormalized || p.displayFormatted, p.id)}
                    title={`Copy ${p.label} phone`}
                    aria-label={`Copy ${p.label} phone number`}
                  >
                    {copiedField === p.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}

              {/* Email Row */}
              {card.email && (
                <div className="zappit-modern-contact-row">
                  <div
                    className="zappit-modern-icon-circle"
                    style={{
                      background: "var(--profile-primary-gradient, var(--profile-primary))",
                      color: "var(--profile-primary-text, #ffffff)",
                    }}
                  >
                    <Mail className="w-4 h-4" style={{ color: "var(--profile-primary-text, #ffffff)" }} />
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
                    href={normWhatsapp.isValid ? normWhatsapp.waLink : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`zappit-modern-chat-btn ${!normWhatsapp.isValid ? "opacity-60 cursor-not-allowed" : ""}`}
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
                <Briefcase className="w-4 h-4" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
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
                  <ShoppingBag className="w-4 h-4" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
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
                <LinkIcon className="w-4 h-4" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
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
                  className={`zappit-modern-app-tile ${item.isAppDownload ? "zappit-app-tile" : ""}`}
                  onClick={item.isAppDownload ? handleAppDownloadClick : undefined}
                >
                  <div className={`zappit-modern-app-icon ${item.brand}`}>
                    <BrandLogo brand={item.brand} name={item.name} size={30} />
                  </div>
                  <span className="zappit-modern-app-name">{item.name}</span>
                  {item.subText && (
                    <span className="zappit-modern-app-subtext" style={{ fontSize: "9.5px", color: "var(--profile-muted, #94a3b8)", marginTop: "2px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.subText}
                    </span>
                  )}
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
              <Users className="w-4 h-4" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
              <span>About Me</span>
            </div>
            <div className="zappit-modern-about-body">
              <p className="zappit-modern-about-text">{card.about}</p>
              <div className="zappit-modern-about-graphic">
                <div className="zappit-graphic-badge">
                  <span className="font-black text-lg" style={{ color: "var(--profile-primary, var(--mod-accent))" }}>Z</span>
                  <span className="text-xs font-bold text-slate-300">Ideas to Impact</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 7. BRAND FOOTER ── */}
        <div className="zappit-modern-footer">
          <div className="zappit-footer-left">
            <span className="font-bold tracking-wider text-xs" style={{ color: "var(--profile-primary, var(--mod-accent))" }}>ZAPPIT</span>
            <span className="text-slate-500 text-xs mx-1">|</span>
            <span className="text-slate-400 text-xs">Your Digital Identity</span>
          </div>
          <div className="zappit-footer-right">
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
            <span className="text-slate-400 text-[11px] font-medium">Tap to Connect</span>
          </div>
        </div>

      </div>

      {/* ── STORE CHOOSER MODAL ── */}
      <AppStoreChooserModal
        isOpen={storeChooserOpen}
        onClose={() => setStoreChooserOpen(false)}
        appDownload={card.appDownload}
        detectedOS={detectedOS}
      />
    </div>
  );
}
