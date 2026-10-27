"use client";

import React, { useId } from "react";

export interface BrandLogoProps {
  brand: string;
  name?: string;
  size?: number;
  className?: string;
  customIcon?: string;
}

export function normalizeBrandKey(brand: string): string {
  if (!brand) return "website";
  const cleaned = brand.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (cleaned.includes("instagram") || cleaned === "ig" || cleaned === "insta") return "instagram";
  if (cleaned.includes("facebook") || cleaned === "fb") return "facebook";
  if (cleaned.includes("youtube") || cleaned === "yt") return "youtube";
  if (cleaned.includes("linkedin") || cleaned === "li") return "linkedin";
  if (cleaned === "twitter" || cleaned === "tweet") return "twitter";
  if (cleaned === "x" || cleaned.includes("xcorp")) return "x";
  if (cleaned.includes("whatsapp") || cleaned === "wa") return "whatsapp";
  if (cleaned.includes("googlereview") || cleaned.includes("review") || cleaned.includes("star")) return "reviews";
  if (cleaned.includes("appdownload") || cleaned.includes("download") || cleaned.includes("getapp") || cleaned.includes("appstore") || cleaned.includes("playstore")) return "download";
  if (cleaned.includes("googlemaps") || cleaned === "maps" || cleaned.includes("location")) return "maps";
  if (cleaned.includes("googlebusiness") || cleaned === "google" || cleaned === "gmb") return "google";
  if (cleaned.includes("github") || cleaned === "git") return "github";
  if (cleaned.includes("website") || cleaned === "web" || cleaned === "site" || cleaned === "link" || cleaned === "globe") return "website";
  return cleaned;
}

export function BrandLogo({
  brand,
  name,
  size = 30,
  className = "",
  customIcon,
}: BrandLogoProps) {
  const uniqueId = useId().replace(/[:]/g, "");

  // If a custom image or URL is provided, display it directly
  const isCustomUrl = customIcon || (brand && (/^https?:\/\//i.test(brand) || /^data:image\//i.test(brand) || brand.startsWith("/")));
  if (isCustomUrl) {
    const iconSrc = customIcon || brand;
    return (
      <img
        src={iconSrc}
        alt={name || brand || "Brand icon"}
        width={size}
        height={size}
        className={`zappit-brand-logo-custom ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          objectFit: "contain",
          display: "block",
          filter: "none",
          opacity: 1,
        }}
      />
    );
  }

  const key = normalizeBrandKey(brand);
  const commonSvgProps: React.SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    className: `zappit-brand-logo-svg zappit-brand-${key} ${className}`,
    style: {
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      filter: "none",
      opacity: 1,
      display: "block",
      flexShrink: 0,
    },
    "aria-hidden": true,
  };

  switch (key) {
    case "instagram": {
      const radId = `ig-rad-${uniqueId}`;
      const linId = `ig-lin-${uniqueId}`;
      return (
        <svg {...commonSvgProps}>
          <defs>
            <radialGradient id={radId} cx="19%" cy="100%" r="140%">
              <stop offset="0%" stopColor="#FFD600" />
              <stop offset="15%" stopColor="#FF7A00" />
              <stop offset="50%" stopColor="#FF0069" />
              <stop offset="100%" stopColor="#D300C5" />
            </radialGradient>
            <linearGradient id={linId} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7638FA" />
              <stop offset="100%" stopColor="#FF0069" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="5.5" fill={`url(#${radId})`} />
          <rect width="24" height="24" rx="5.5" fill={`url(#${linId})`} />
          <rect x="4.9" y="4.9" width="14.2" height="14.2" rx="4.1" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="3.5" fill="none" stroke="#FFFFFF" strokeWidth="1.7" />
          <circle cx="15.8" cy="8.2" r="0.95" fill="#FFFFFF" />
        </svg>
      );
    }

    case "facebook":
      return (
        <svg {...commonSvgProps}>
          <circle cx="12" cy="12" r="12" fill="#1877F2" />
          <path
            fill="#FFFFFF"
            d="M15.117 12.727l.42-2.738h-2.628V8.212c0-.751.368-1.482 1.547-1.482h1.197V4.398s-1.086-.186-2.125-.186c-2.168 0-3.585 1.314-3.585 3.692v2.085H9.533v2.738h2.41v6.618a12.06 12.06 0 0 0 2.955 0v-6.618h2.219z"
          />
        </svg>
      );

    case "youtube":
      return (
        <svg {...commonSvgProps}>
          <path
            fill="#FF0000"
            d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
          />
          <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );

    case "linkedin":
      return (
        <svg {...commonSvgProps}>
          <rect width="24" height="24" rx="4.5" fill="#0A66C2" />
          <path
            fill="#FFFFFF"
            d="M6.94 5a1.95 1.95 0 1 1-3.9 0 1.95 1.95 0 0 1 3.9 0zM3.4 8.7h3.2V19H3.4V8.7zm5.2 0h3.07v1.41h.04c.43-.81 1.48-1.67 3.04-1.67 3.25 0 3.85 2.14 3.85 4.92V19h-3.2v-4.74c0-1.13-.02-2.58-1.57-2.58-1.57 0-1.81 1.23-1.81 2.5V19H8.6V8.7z"
          />
        </svg>
      );

    case "x":
      return (
        <svg {...commonSvgProps}>
          <rect width="24" height="24" rx="5" fill="#000000" />
          <path
            fill="#FFFFFF"
            d="M17.53 4h2.72l-5.94 6.79 6.99 9.21h-5.47l-4.29-5.61-4.91 5.61H3.91l6.36-7.27L3.5 4h5.61l3.88 5.13L17.53 4zm-.95 14.39h1.51L7.51 5.52H5.89l10.69 12.87z"
          />
        </svg>
      );

    case "twitter":
      return (
        <svg {...commonSvgProps}>
          <circle cx="12" cy="12" r="12" fill="#1DA1F2" />
          <path
            fill="#FFFFFF"
            d="M19.5 7.42a6.18 6.18 0 0 1-1.78.49 3.1 3.1 0 0 0 1.36-1.71 6.2 6.2 0 0 1-1.97.75 3.1 3.1 0 0 0-5.28 2.83 8.8 8.8 0 0 1-6.39-3.24 3.1 3.1 0 0 0 .96 4.14 3.07 3.07 0 0 1-1.4-.39v.04a3.1 3.1 0 0 0 2.49 3.04 3.1 3.1 0 0 1-1.4.05 3.1 3.1 0 0 0 2.89 2.15A6.23 6.23 0 0 1 3 17.06 8.78 8.78 0 0 0 7.75 18.5c5.7 0 8.82-4.72 8.82-8.82v-.4a6.3 6.3 0 0 0 1.55-1.61z"
          />
        </svg>
      );

    case "whatsapp":
      return (
        <svg {...commonSvgProps}>
          <circle cx="12" cy="12" r="12" fill="#25D366" />
          <path
            fill="#FFFFFF"
            d="M17.5 6.5A7.78 7.78 0 0 0 12 4.22c-4.3 0-7.8 3.5-7.8 7.8 0 1.37.36 2.72 1.05 3.91L4 20l4.18-1.1a7.78 7.78 0 0 0 3.82.99h.01c4.3 0 7.8-3.5 7.8-7.8 0-2.08-.81-4.04-2.31-5.59zm-5.49 12.11h-.01a6.47 6.47 0 0 1-3.3-.9l-.24-.14-2.45.64.65-2.39-.16-.25a6.45 6.45 0 0 1-.99-3.48c0-3.57 2.91-6.48 6.49-6.48 1.73 0 3.36.67 4.58 1.9a6.44 6.44 0 0 1 1.9 4.58c0 3.58-2.91 6.49-6.49 6.49zm3.56-4.86c-.2-.1-.17-.28-.35-.37-.18-.09-1.09-.54-1.26-.6-.17-.06-.3-.09-.42.09-.13.18-.49.6-.6.72-.11.12-.22.14-.42.04-.2-.1-.84-.31-1.6-.99-.59-.53-.99-1.18-1.1-1.38-.11-.2 0-.31.09-.41.09-.09.2-.23.3-.35.1-.11.13-.19.2-.32.07-.13.03-.24-.02-.34-.05-.1-.42-1.02-.58-1.4-.15-.36-.31-.32-.42-.32h-.36c-.12 0-.32.05-.49.23-.17.18-.65.64-.65 1.56s.67 1.81.76 1.93c.1.13 1.32 2.02 3.2 2.83.45.19.8.31 1.07.4.45.14.86.12 1.18.07.36-.05 1.09-.45 1.25-.88.15-.43.15-.81.11-.88-.05-.07-.17-.12-.37-.22z"
          />
        </svg>
      );

    case "maps":
      return (
        <svg {...commonSvgProps}>
          <circle cx="12" cy="12" r="12" fill="#FFFFFF" />
          <path
            fill="#EA4335"
            d="M12 3.5C8.41 3.5 5.5 6.41 5.5 10c0 1.61.59 3.09 1.56 4.23l4.94 6.27 4.94-6.27c.97-1.14 1.56-2.62 1.56-4.23 0-3.59-2.91-6.5-6.5-6.5zm0 8.8a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z"
          />
          <path fill="#4285F4" d="M12 3.5v8.8a2.3 2.3 0 0 0 2.3-2.3c0-3.59-1-5.5-2.3-6.5z" />
          <path fill="#FBBC04" d="M5.5 10c0 1.61.59 3.09 1.56 4.23l4.94-4.23H5.5z" />
          <path fill="#34A853" d="M12 20.5l-4.94-6.27L12 18.5v2z" />
        </svg>
      );

    case "google":
    case "reviews":
      return (
        <svg {...commonSvgProps}>
          <circle cx="12" cy="12" r="12" fill="#FFFFFF" />
          <path
            fill="#4285F4"
            d="M20.64 12.2c0-.64-.06-1.25-.16-1.84H12v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"
          />
          <path
            fill="#34A853"
            d="M12 21c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H3.86v2.33C5.34 18.94 8.43 21 12 21z"
          />
          <path
            fill="#FBBC04"
            d="M6.96 13.71c-.18-.54-.28-1.12-.28-1.71s.1-1.17.28-1.71V7.96H3.86C3.31 9.06 3 10.49 3 12s.31 2.94.86 4.04l3.1-2.33z"
          />
          <path
            fill="#EA4335"
            d="M12 6.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C16.46 3.9 14.43 3 12 3 8.43 3 5.34 5.06 3.86 8.04l3.1 2.41c.71-2.13 2.7-3.87 5.04-3.87z"
          />
        </svg>
      );

    case "github":
      return (
        <svg {...commonSvgProps}>
          <circle cx="12" cy="12" r="12" fill="#24292F" />
          <path
            fill="#FFFFFF"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 4C7.58 4 4 7.58 4 12c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 20 12c0-4.42-3.58-8-8-8z"
          />
        </svg>
      );

    case "download": {
      const gradId = `dl-grad-${uniqueId}`;
      return (
        <svg {...commonSvgProps}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="12" fill={`url(#${gradId})`} />
          <path
            fill="#FFFFFF"
            d="M12 14.8l-3.8-3.8 1.4-1.4 1.4 1.4V6h2v5l1.4-1.4 1.4 1.4-3.8 3.8zm-5.5 2.2v-1.8h11V17h-11z"
          />
        </svg>
      );
    }

    case "website":
    default:
      return (
        <svg {...commonSvgProps}>
          <circle cx="12" cy="12" r="12" fill="#0284C7" />
          <circle cx="12" cy="12" r="7.5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
          <line x1="4.5" y1="12" x2="19.5" y2="12" stroke="#FFFFFF" strokeWidth="1.6" />
          <path
            d="M12 4.5a11 11 0 0 1 3 7.5 11 11 0 0 1-3 7.5 11 11 0 0 1-3-7.5 11 11 0 0 1 3-7.5z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.6"
          />
        </svg>
      );
  }
}
