import React from 'react';
import Image from 'next/image';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  showTagline?: boolean;
  variant?: 'full' | 'icon' | 'text';
  lightText?: boolean;
  alt?: string;
}

export function Logo({
  className = '',
  size = 'md',
  showTagline = false,
  variant = 'full',
  lightText = true,
  alt = '3G Zappit - Smart Tap Solutions',
}: LogoProps) {
  const getDimensions = () => {
    if (typeof size === 'number') {
      return { height: size, width: Math.round(size * 1.978) };
    }
    switch (size) {
      case 'sm':
        return { height: 28, width: 56 };
      case 'lg':
        return { height: 52, width: 104 };
      case 'xl':
        return { height: 72, width: 142 };
      case 'md':
      default:
        return { height: 40, width: 80 };
    }
  };

  const { height, width } = getDimensions();

  if (variant === 'icon') {
    return (
      <div
        className={`zappit-logo-container zappit-logo-icon ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <Image
          src="/assets/icon-mark.png"
          alt={alt}
          width={height}
          height={height}
          priority
          style={{
            height: `${height}px`,
            width: `${height}px`,
            objectFit: 'contain',
          }}
          className="brand-logo-icon"
        />
      </div>
    );
  }

  return (
    <div
      className={`zappit-logo-container zappit-logo-full ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none',
        textDecoration: 'none',
      }}
    >
      <Image
        src="/assets/logo-transparent.png"
        alt={alt}
        width={width * 2}
        height={height * 2}
        priority
        style={{
          height: `${height}px`,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
        }}
        className="brand-logo-img"
      />
    </div>
  );
}

export default Logo;
