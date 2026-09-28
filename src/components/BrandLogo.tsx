"use client";

import React from "react";

export interface BrandLogoProps {
  variant?: "full" | "mark" | "auto" | "compact" | string;
  size?: "sm" | "md" | "lg" | "compact" | string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  alt?: string;
}

export function BrandLogo({
  variant = "full",
  size,
  width,
  height,
  className = "h-8 w-auto object-contain",
  style,
  priority = false,
  alt = "Zappit Logo",
}: BrandLogoProps) {
  const isMark = variant === "mark" || variant === "compact" || size === "compact";
  const logoSrc = isMark
    ? "/brand/zappit-mark.png" 
    : "/brand/zappit-logo-transparent.png";

  const defaultWidth = isMark ? 40 : 160;
  const defaultHeight = isMark ? 40 : 48;

  return (
    <img
      src={logoSrc}
      alt={alt}
      width={width || defaultWidth}
      height={height || defaultHeight}
      className={className}
      loading={priority ? "eager" : "lazy"}
      style={{
        objectFit: "contain",
        background: "transparent",
        backgroundColor: "transparent",
        ...style,
      }}
    />
  );
}

export default BrandLogo;
