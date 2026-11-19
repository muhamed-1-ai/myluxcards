'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import '../mfa.css';

export default function AdminMfaEnrollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [setupData, setSetupData] = useState<{
    secret: string;
    qrDataUrl: string;
    recoveryCodes: string[];
    alreadyEnrolled?: boolean;
  } | null>(null);

  const [code, setCode] = useState('');
  const [step, setStep] = useState<'scan' | 'codes'>('scan');
  const [copied, setCopied] = useState(false);
  const [savedCodesAcknowledged, setSavedCodesAcknowledged] = useState(false);

  useEffect(() => {
    async function loadSetup() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/admin/mfa/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to initialize MFA setup. Are you logged in as an administrator?');
        }

        const data = await res.json();
        setSetupData(data);
      } catch (err: any) {
        setError(err.message || 'Could not load MFA configuration.');
      } finally {
        setLoading(false);
      }
    }

    loadSetup();
  }, []);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || !code.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/admin/mfa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: setupData.secret,
          token: code.trim(),
          recoveryCodes: setupData.recoveryCodes,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Verification failed. Please check the 6-digit code and try again.');
      }

      setStep('codes');
    } catch (err: any) {
      setError(err.message || 'Failed to verify code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCodes = () => {
    if (!setupData) return;
    const text = `3G ZAPPIT ADMIN RECOVERY CODES\n============================\n${setupData.recoveryCodes.join(
      '\n'
    )}\n\nKeep these codes in a safe place. Each code is single-use.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleProceed = () => {
    router.push(nextUrl);
  };

  return (
    <div className="mfa-page-container">
      <div className="mfa-card">
        <div className="mfa-header">
          <div className="mfa-icon-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="mfa-title">
            {step === 'scan' ? 'Enroll Admin Multi-Factor Auth' : 'Save Your Recovery Codes'}
          </h1>
          <p className="mfa-subtitle">
            {step === 'scan'
              ? 'Multi-Factor Authentication (MFA) is required for all administrator and staff accounts.'
              : 'Save these emergency recovery codes before proceeding. Each code can only be used once.'}
          </p>
        </div>

        {error && <div className="mfa-alert mfa-alert-error">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#9aa4ae' }}>
            Initializing secure authenticator setup...
          </div>
        ) : step === 'scan' && setupData ? (
          <>
            <div className="mfa-qr-box">
              <img
                src={setupData.qrDataUrl}
                alt="Authenticator QR Code"
                className="mfa-qr-img"
              />
              <span style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>
                Scan with Google Authenticator, 1Password, or Authy
              </span>
            </div>

            <div className="mfa-secret-box">
              <div className="mfa-secret-label">Can't scan? Enter key manually:</div>
              <div className="mfa-secret-code">{setupData.secret}</div>
            </div>

            <form onSubmit={handleConfirm}>
              <div className="mfa-form-group">
                <label htmlFor="mfa-code-input" className="mfa-label">
                  Enter 6-Digit Authenticator Code
                </label>
                <input
                  id="mfa-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="mfa-input"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="mfa-btn-primary"
              >
                {submitting ? 'Verifying Code...' : 'Verify & Enable MFA'}
              </button>
            </form>
          </>
        ) : step === 'codes' && setupData ? (
          <div>
            <div className="mfa-alert mfa-alert-warning">
              ⚠️ If you ever lose access to your phone or authenticator app, these recovery codes are the ONLY way to access your administrator account.
            </div>

            <div className="mfa-recovery-grid">
              {setupData.recoveryCodes.map((c, i) => (
                <div key={i} className="mfa-recovery-code-item">
                  {c}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyCodes}
              className="mfa-btn-primary"
              style={{ background: '#1e293b', marginBottom: '16px' }}
            >
              {copied ? '✓ Recovery Codes Copied to Clipboard' : '📋 Copy All Recovery Codes'}
            </button>

            <div style={{ margin: '14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="ack-saved-codes"
                checked={savedCodesAcknowledged}
                onChange={(e) => setSavedCodesAcknowledged(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="ack-saved-codes" style={{ fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
                I have saved and stored these recovery codes safely.
              </label>
            </div>

            <button
              type="button"
              disabled={!savedCodesAcknowledged}
              onClick={handleProceed}
              className="mfa-btn-primary"
            >
              Continue to Administration →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
