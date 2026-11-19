'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '../mfa.css';

export default function AdminMfaVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/admin';

  const [code, setCode] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Verification failed. Please check the code and try again.');
      }

      router.push(nextUrl);
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mfa-page-container">
      <div className="mfa-card">
        <div className="mfa-header">
          <div className="mfa-icon-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="mfa-title">Admin Two-Step Verification</h1>
          <p className="mfa-subtitle">
            {isRecovery
              ? 'Enter one of your 8-character single-use emergency recovery codes.'
              : 'Enter the 6-digit code from your authenticator app to access admin.'}
          </p>
        </div>

        {error && <div className="mfa-alert mfa-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mfa-form-group">
            <label htmlFor="admin-verify-code" className="mfa-label">
              {isRecovery ? 'Emergency Recovery Code (e.g. ABCD-EF12)' : '6-Digit Authenticator Code'}
            </label>
            <input
              id="admin-verify-code"
              type="text"
              inputMode={isRecovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              maxLength={isRecovery ? 12 : 6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={isRecovery ? 'XXXX-XXXX' : '000000'}
              className="mfa-input"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={submitting || code.trim().length < (isRecovery ? 8 : 6)}
            className="mfa-btn-primary"
          >
            {submitting ? 'Verifying...' : 'Verify & Access Admin'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            className="mfa-btn-secondary"
            onClick={() => {
              setIsRecovery(!isRecovery);
              setCode('');
              setError(null);
            }}
          >
            {isRecovery ? '← Use Authenticator App Code Instead' : 'Lost device? Use an emergency recovery code →'}
          </button>
        </div>
      </div>
    </div>
  );
}
