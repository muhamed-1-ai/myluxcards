"use client";

import React from "react";

export type LogoVariant = "sidebar" | "header" | "mobile" | "auth" | "loading" | "full" | "compact" | "auto";
export type LogoSize = "sm" | "md" | "lg" | "compact";

export interface BrandLogoProps {
  variant?: LogoVariant | string;
  size?: LogoSize | string;
  width?: number;
  height?: number;
  maxWidth?: number | string;
  maxHeight?: number | string;
  className?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  alt?: string;
  src?: string;
}

/**
 * Official canonical Zappit logo asset present in the project.
 * 898px x 436px native dimensions (aspect ratio ~2.06:1).
 * Completely transparent background, full 3D wordmark + NFC emblem.
 */
export const OFFICIAL_ZAPPIT_LOGO = "/brand/zappit-logo-transparent.png";

/**
 * Precise, proportional dimension constraints for all UI variants.
 * Desktop sidebar target: 80px - 120px wide with comfortable breathing room.
 * Navbar header target: 110px - 130px visible wordmark width.
 */
const VARIANT_SPECS: Record<string, { maxWidth: number; maxHeight: number }> = {
  sidebar: { maxWidth: 110, maxHeight: 52 },
  header: { maxWidth: 125, maxHeight: 56 },
  mobile: { maxWidth: 100, maxHeight: 46 },
  auth: { maxWidth: 160, maxHeight: 64 },
  loading: { maxWidth: 140, maxHeight: 56 },
  sm: { maxWidth: 88, maxHeight: 36 },
  md: { maxWidth: 110, maxHeight: 48 },
  lg: { maxWidth: 130, maxHeight: 56 },
  compact: { maxWidth: 105, maxHeight: 50 },
  full: { maxWidth: 120, maxHeight: 54 },
};

export function BrandLogo({
  variant = "full",
  size,
  width,
  height,
  maxWidth,
  maxHeight,
  className = "",
  containerClassName = "",
  style,
  priority = false,
  alt = "Zappit",
  src = OFFICIAL_ZAPPIT_LOGO,
}: BrandLogoProps) {
  const specKey = (size || variant || "full").toLowerCase();
  const spec = VARIANT_SPECS[specKey] || VARIANT_SPECS.full;

  const resolvedMaxWidth = maxWidth ?? (width ? `${width}px` : `${spec.maxWidth}px`);
  const resolvedMaxHeight = maxHeight ?? (height ? `${height}px` : `${spec.maxHeight}px`);

  const resolvedWidth = width ?? (src === OFFICIAL_ZAPPIT_LOGO ? 898 : 850);
  const resolvedHeight = height ?? (src === OFFICIAL_ZAPPIT_LOGO ? 436 : 396);

  return (
    <span
      className={`zappit-logo-container ${containerClassName}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        lineHeight: 0,
        verticalAlign: "middle",
      }}
    >
      <img
        src={src}
        alt={alt}
        width={resolvedWidth}
        height={resolvedHeight}
        className={`zappit-logo-img ${className}`.trim()}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        style={{
          width: "auto",
          height: "auto",
          maxWidth: resolvedMaxWidth,
          maxHeight: resolvedMaxHeight,
          objectFit: "contain",
          aspectRatio: "898 / 436",
          display: "block",
          background: "transparent",
          backgroundColor: "transparent",
          ...(src !== OFFICIAL_ZAPPIT_LOGO ? { aspectRatio: "850 / 396" } : {}),
          ...style,
        }}
      />
    </span>
  );
}

export const ZappitLogo = BrandLogo;
export default BrandLogo;
