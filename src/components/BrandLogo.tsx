import React from "react";
import Image from "next/image";

export interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "compact" | number;
  variant?: "default" | "compact" | "mobile" | "footer" | "full" | "icon" | "text";
  showTagline?: boolean;
  lightText?: boolean;
  alt?: string;
  priority?: boolean;
  style?: React.CSSProperties;
}

export function BrandLogo({
  className = "",
  size = "md",
  variant = "default",
  alt = "Zappit - The Change Maker",
  priority = true,
  style,
}: BrandLogoProps) {
  const getDimensions = () => {
    if (typeof size === "number") {
      return { height: size, width: Math.round(size * 2.1) };
    }
    switch (size) {
      case "sm":
        return { height: 28, width: 60 };
      case "compact":
        return { height: 32, width: 68 };
      case "lg":
        return { height: 52, width: 110 };
      case "xl":
        return { height: 72, width: 150 };
      case "md":
      default:
        return { height: 40, width: 84 };
    }
  };

  const { height, width } = getDimensions();
  const isCompact = variant === "compact" || variant === "mobile";
  const isFooter = variant === "footer";

  return (
    <div
      className={`zappit-brand-logo-container zappit-brand-logo-${variant} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        userSelect: "none",
        textDecoration: "none",
        lineHeight: 1,
        verticalAlign: "middle",
        ...style,
      }}
    >
      <Image
        src="/brand/zappit-logo.png"
        alt={alt}
        width={width * 2}
        height={height * 2}
        priority={priority}
        style={{
          height: isFooter ? `${Math.round(height * 1.1)}px` : isCompact ? `${Math.round(height * 0.9)}px` : `${height}px`,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          objectPosition: "left center",
          display: "block",
        }}
        className="zappit-official-brand-logo"
      />
    </div>
  );
}

export default BrandLogo;
