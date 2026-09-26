'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCookieConsent, setCookieConsent, CookieConsentChoice } from '@/lib/cookieConsent';

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentChoice = getCookieConsent();
    if (!currentChoice) {
      // Small timeout ensures clean entrance animation after mount
      const timer = setTimeout(() => {
        setVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (choice: CookieConsentChoice) => {
    setCookieConsent(choice);
    setVisible(false);
  };

  if (!mounted || !visible) return null;

  return (
    <div
      aria-label="Cookie Privacy Consent"
      role="region"
      style={{
        position: 'fixed',
        bottom: 24,
        left: 20,
        right: 20,
        maxWidth: 580,
        margin: '0 auto',
        zIndex: 999999,
        animation: 'cookieConsentFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes cookieConsentFadeUp {
            from {
              opacity: 0;
              transform: translateY(24px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          .zappit-cookie-card {
            background: linear-gradient(135deg, rgba(7, 16, 35, 0.96) 0%, rgba(10, 24, 52, 0.94) 100%);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 217, 255, 0.22);
            border-radius: 18px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(0, 217, 255, 0.08);
            padding: 22px 24px;
            color: #ffffff;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
          }
          .zappit-cookie-btn-primary {
            background: linear-gradient(135deg, #0066FF 0%, #00D9FF 100%);
            color: #ffffff;
            font-weight: 700;
            font-size: 13.5px;
            padding: 10px 18px;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(0, 102, 255, 0.35);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 1;
            white-space: nowrap;
          }
          .zappit-cookie-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0, 217, 255, 0.45);
            opacity: 0.96;
          }
          .zappit-cookie-btn-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: rgba(255, 255, 255, 0.88);
            font-weight: 600;
            font-size: 13.5px;
            padding: 10px 18px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 1;
            white-space: nowrap;
          }
          .zappit-cookie-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.12);
            color: #ffffff;
            border-color: rgba(0, 217, 255, 0.3);
          }
          .zappit-cookie-details-toggle {
            background: none;
            border: none;
            color: #00D9FF;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            padding: 0;
            margin-top: 4px;
            text-decoration: underline;
            text-underline-offset: 3px;
          }
          .zappit-cookie-details-toggle:hover {
            opacity: 0.85;
          }
          @media (max-width: 480px) {
            .zappit-cookie-card {
              padding: 18px 16px;
            }
            .zappit-cookie-actions {
              flex-direction: column-reverse;
              gap: 8px !important;
            }
            .zappit-cookie-btn-primary, .zappit-cookie-btn-secondary {
              width: 100%;
            }
          }
        `
      }} />

      <div className="zappit-cookie-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(0, 217, 255, 0.12)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            🛡️
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                fontFamily: "'Outfit', sans-serif",
              }}
            >
              Your Privacy Matters
            </h3>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 12.5,
                lineHeight: 1.55,
                color: 'rgba(255, 255, 255, 0.78)',
              }}
            >
              Zappit uses cookies to improve your experience, keep your account secure, remember your preferences, and understand how our website is used. We only collect information necessary to provide and improve our services. We do not collect unnecessary personal data.
            </p>
          </div>
        </div>

        {/* Optional Expandable Category Details */}
        {showDetails && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.85)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#00D9FF' }}>Essential Cookies</strong>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Authentication, Security, Sessions & Core Features</div>
              </div>
              <span style={{ fontSize: 11, background: 'rgba(0, 217, 255, 0.15)', color: '#00D9FF', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                Always Active
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#ffffff' }}>Analytics Cookies</strong>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Performance optimization & visitor metrics</div>
              </div>
              <span style={{ fontSize: 11, background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: 6 }}>
                Optional
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#ffffff' }}>Preference Cookies</strong>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Theme options & custom workspace settings</div>
              </div>
              <span style={{ fontSize: 11, background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: 6 }}>
                Optional
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <button
            type="button"
            className="zappit-cookie-details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide cookie preferences ▲' : 'Manage cookie preferences ▼'}
          </button>

          <Link
            href="/privacy-policy"
            style={{
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.65)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Privacy Policy
          </Link>
        </div>

        <div className="zappit-cookie-actions" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            className="zappit-cookie-btn-secondary"
            onClick={() => handleChoice('rejected')}
          >
            Reject Non-Essential
          </button>

          <button
            type="button"
            className="zappit-cookie-btn-primary"
            onClick={() => handleChoice('accepted')}
          >
            Accept All Cookies
          </button>
        </div>
      </div>
    </div>
  );
}
