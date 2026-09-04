import React from 'react';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  showTagline?: boolean;
  variant?: 'full' | 'icon' | 'text';
  lightText?: boolean;
}

export function Logo({
  className = '',
  size = 'md',
  showTagline = false,
  variant = 'full',
  lightText = true,
}: LogoProps) {
  const getDimension = () => {
    if (typeof size === 'number') return { height: size, fontScale: size / 32 };
    switch (size) {
      case 'sm': return { height: 24, fontScale: 0.75 };
      case 'lg': return { height: 42, fontScale: 1.3 };
      case 'xl': return { height: 56, fontScale: 1.75 };
      case 'md':
      default: return { height: 34, fontScale: 1.05 };
    }
  };

  const { height, fontScale } = getDimension();
  const textColor = lightText ? '#FFFFFF' : '#0F172A';

  return (
    <div
      className={`zappit-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.max(6, fontScale * 10)}px`,
        textDecoration: 'none',
        userSelect: 'none',
      }}
    >
      {(variant === 'full' || variant === 'icon') && (
        <svg
          width={height}
          height={height}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', flexShrink: 0 }}
        >
          <defs>
            <linearGradient id="zappitIconGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00D9FF" />
              <stop offset="50%" stopColor="#0066FF" />
              <stop offset="100%" stopColor="#0057FF" />
            </linearGradient>

            <linearGradient id="zappitPulseGrad" x1="0" y1="0" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E056FF" />
              <stop offset="100%" stopColor="#B026FF" />
            </linearGradient>

            <filter id="zappitGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer Glass Card Frame */}
          <rect x="2" y="2" width="36" height="36" rx="10" fill="#080B12" stroke="url(#zappitIconGrad)" strokeWidth="2" />

          {/* Inner Signal & Tap Symbol */}
          <path d="M12 14C16.4183 9.58172 23.5817 9.58172 28 14" stroke="#00D9FF" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          <path d="M15 18C17.7614 15.2386 22.2386 15.2386 25 18" stroke="#0066FF" strokeWidth="2" strokeLinecap="round" />
          
          {/* Central Zapp Lightning Bolt */}
          <path d="M22 17L14 26H20L18 31L26 22H20L22 17Z" fill="url(#zappitIconGrad)" filter="url(#zappitGlow)" />

          {/* Magenta Signal Dot */}
          <circle cx="28" cy="11" r="2.5" fill="url(#zappitPulseGrad)" filter="url(#zappitGlow)" />
        </svg>
      )}

      {(variant === 'full' || variant === 'text') && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: `${fontScale * 22}px`,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: textColor,
            }}
          >
            <span>Zapp</span>
            <span style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  width: `${Math.max(4, fontScale * 5)}px`,
                  height: `${Math.max(4, fontScale * 5)}px`,
                  borderRadius: '50%',
                  backgroundColor: '#B026FF',
                  boxShadow: '0 0 8px #B026FF, 0 0 14px rgba(176, 38, 255, 0.6)',
                  marginBottom: `${fontScale * 2}px`,
                  display: 'inline-block',
                }}
              />
              <span style={{ marginTop: `-${fontScale * 2}px` }}>ı</span>
            </span>
            <span>t</span>
          </div>

          {showTagline && (
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: `${Math.max(8, fontScale * 8.5)}px`,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: 'linear-gradient(90deg, #00D9FF, #0066FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginTop: `${fontScale * 3}px`,
              }}
            >
              SMART TAP SOLUTIONS
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default Logo;
