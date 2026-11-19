'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sensitive error details exclusively to server/browser developer console
    console.error('[Application Error Boundary Caught]:', {
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack,
    });
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        background: 'radial-gradient(ellipse at top, #0f172a 0%, #07090e 100%)',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          textAlign: 'center',
          padding: '40px 32px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            marginBottom: '20px',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: '700',
            margin: '0 0 10px',
            color: '#ffffff',
          }}
        >
          Something Went Wrong
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#94a3b8',
            lineHeight: '1.6',
            margin: '0 0 24px',
          }}
        >
          An unexpected error occurred while processing your request. Our engineering team has been notified.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 20px',
              background: '#0967d2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            ↻ Try Again
          </button>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 20px',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              fontSize: '14.5px',
              fontWeight: '500',
              textDecoration: 'none',
            }}
          >
            ← Return to Homepage
          </Link>

          <Link
            href="/support"
            style={{
              display: 'inline-block',
              marginTop: '8px',
              fontSize: '13px',
              color: '#38bdf8',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            Report an issue to Technical Support
          </Link>
        </div>
      </div>
    </main>
  );
}
