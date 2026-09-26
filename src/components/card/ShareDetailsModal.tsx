'use client';

import React, { useState } from 'react';
import { UserCheck, X, Plus, Trash2, Download, CheckCircle2, Phone, Mail, Building2, User, MessageSquare } from 'lucide-react';

export interface ShareDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  recipientName?: string;
}

interface AdditionalNumber {
  id: string;
  label: string;
  number: string;
}

const PHONE_LABEL_OPTIONS = ['Mobile', 'Office', 'Personal', 'WhatsApp', 'Direct', 'Other'];

export function ShareDetailsModal({ isOpen, onClose, slug, recipientName }: ShareDetailsModalProps) {
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [additionalNumbers, setAdditionalNumbers] = useState<AdditionalNumber[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [vcardContent, setVcardContent] = useState<string | null>(null);
  const [vcardFilename, setVcardFilename] = useState('My_vCard.vcf');

  if (!isOpen) return null;

  const handleAddNumber = () => {
    if (additionalNumbers.length >= 5) return;
    setAdditionalNumbers((prev) => [
      ...prev,
      { id: `phone_${Date.now()}_${Math.random()}`, label: 'Mobile', number: '' },
    ]);
  };

  const handleRemoveNumber = (id: string) => {
    setAdditionalNumbers((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateNumber = (id: string, field: 'label' | 'number', value: string) => {
    setAdditionalNumbers((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'Please enter your full name.';
    }

    if (!mobileNumber.trim()) {
      errs.mobileNumber = 'Please enter your mobile phone number.';
    } else {
      const cleanPhone = mobileNumber.replace(/[^0-9+]/g, '');
      if (cleanPhone.length < 7 || cleanPhone.length > 18) {
        errs.mobileNumber = 'Please enter a valid phone number with country code.';
      }
    }

    if (!businessName.trim()) {
      errs.businessName = 'Please enter your company or business name.';
    }

    if (email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.trim().toLowerCase())) {
        errs.email = 'Please enter a valid email address.';
      }
    }

    if (whatsappNumber.trim()) {
      const cleanWa = whatsappNumber.replace(/[^0-9+]/g, '');
      if (cleanWa.length < 7 || cleanWa.length > 18) {
        errs.whatsappNumber = 'Please enter a valid WhatsApp number.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch(`/api/cards/public/${encodeURIComponent(slug)}/share-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          mobileNumber: mobileNumber.trim(),
          businessName: businessName.trim(),
          email: email.trim(),
          whatsappNumber: whatsappNumber.trim(),
          additionalNumbers: additionalNumbers.map((a) => ({
            label: a.label,
            number: a.number.trim(),
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setSuccess(true);
        if (data.vcard) setVcardContent(data.vcard);
        if (data.filename) setVcardFilename(data.filename);
      } else {
        setErrors({ general: data.message || "We couldn't share your details right now. Please try again." });
      }
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadVCard = () => {
    if (!vcardContent) return;
    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', vcardFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setName('');
    setMobileNumber('');
    setBusinessName('');
    setEmail('');
    setWhatsappNumber('');
    setAdditionalNumbers([]);
    setErrors({});
    setSuccess(false);
    setVcardContent(null);
    onClose();
  };

  return (
    <div
      aria-labelledby="share-details-dialog-title"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(3, 8, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'shareModalFade 0.25s ease-out forwards',
      }}
      onClick={(e) => e.target === e.currentTarget && handleReset()}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes shareModalFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes shareModalPop {
            from { opacity: 0; transform: scale(0.96) translateY(12px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          .zappit-share-input {
            width: 100%;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            padding: 11px 14px;
            color: #ffffff;
            font-size: 13.5px;
            font-family: inherit;
            outline: none;
            transition: all 0.2s ease;
          }
          .zappit-share-input:focus {
            border-color: #00D9FF;
            background: rgba(0, 217, 255, 0.05);
            box-shadow: 0 0 14px rgba(0, 217, 255, 0.2);
          }
          .zappit-share-select {
            background: #091833;
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 8px;
            padding: 10px 10px;
            color: #ffffff;
            font-size: 12.5px;
            outline: none;
            cursor: pointer;
          }
        `
      }} />

      <div
        style={{
          width: '100%',
          maxWidth: 540,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, rgba(7, 16, 35, 0.98) 0%, rgba(10, 24, 52, 0.96) 100%)',
          border: '1px solid rgba(0, 217, 255, 0.25)',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(0, 217, 255, 0.12)',
          color: '#ffffff',
          overflow: 'hidden',
          animation: 'shareModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.2), rgba(0, 217, 255, 0.15))',
                border: '1px solid rgba(0, 217, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00D9FF',
              }}
            >
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="share-details-dialog-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                Share Your Details
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'rgba(255, 255, 255, 0.65)' }}>
                {recipientName ? `Send your contact information to ${recipientName} and connect instantly.` : 'Send your contact information and connect instantly.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#ffffff' }}>
                Your details have been shared successfully.
              </h3>
              <p style={{ margin: '8px 0 24px', fontSize: 13.5, color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.6 }}>
                {recipientName ? `${recipientName} has received your contact details.` : 'The profile owner has received your contact information.'} You can also download your generated vCard below.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
                <button
                  type="button"
                  onClick={handleDownloadVCard}
                  style={{
                    background: 'linear-gradient(135deg, #0066FF 0%, #00D9FF 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(0, 102, 255, 0.35)',
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>Download My vCard (.vcf)</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontWeight: 600,
                    fontSize: 13.5,
                    padding: '11px 20px',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer',
                  }}
                >
                  Continue Browsing Profile
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {errors.general && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: 13,
                  }}
                >
                  {errors.general}
                </div>
              )}

              {/* FULL NAME (Required) */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 6 }}>
                  <User className="w-3.5 h-3.5 text-[#00D9FF]" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  className="zappit-share-input"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
                {errors.name && <span style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.name}</span>}
              </div>

              {/* MOBILE NUMBER (Required) */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 6 }}>
                  <Phone className="w-3.5 h-3.5 text-[#00D9FF]" />
                  <span>Mobile Number *</span>
                </label>
                <input
                  type="tel"
                  className="zappit-share-input"
                  placeholder="Phone number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  maxLength={30}
                />
                {errors.mobileNumber && <span style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.mobileNumber}</span>}
              </div>

              {/* BUSINESS NAME (Required) */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 6 }}>
                  <Building2 className="w-3.5 h-3.5 text-[#00D9FF]" />
                  <span>Business Name *</span>
                </label>
                <input
                  type="text"
                  className="zappit-share-input"
                  placeholder="Company / Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  maxLength={150}
                />
                {errors.businessName && <span style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.businessName}</span>}
              </div>

              {/* EMAIL ADDRESS (Optional) */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 6 }}>
                  <Mail className="w-3.5 h-3.5 text-[#00D9FF]" />
                  <span>Email Address <small style={{ fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>(Optional)</small></span>
                </label>
                <input
                  type="email"
                  className="zappit-share-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                />
                {errors.email && <span style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.email}</span>}
              </div>

              {/* WHATSAPP NUMBER (Optional) */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 6 }}>
                  <MessageSquare className="w-3.5 h-3.5 text-[#22c55e]" />
                  <span>WhatsApp Number <small style={{ fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>(Optional)</small></span>
                </label>
                <input
                  type="tel"
                  className="zappit-share-input"
                  placeholder="WhatsApp number"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  maxLength={30}
                />
                {errors.whatsappNumber && <span style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.whatsappNumber}</span>}
              </div>

              {/* ADDITIONAL PHONE NUMBERS */}
              <div style={{ paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' }}>
                    Additional Phone Numbers
                  </span>
                  {additionalNumbers.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddNumber}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#00D9FF',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add another number</span>
                    </button>
                  )}
                </div>

                {additionalNumbers.map((item, index) => (
                  <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select
                      className="zappit-share-select"
                      value={item.label}
                      onChange={(e) => handleUpdateNumber(item.id, 'label', e.target.value)}
                    >
                      {PHONE_LABEL_OPTIONS.map((lbl) => (
                        <option key={lbl} value={lbl}>
                          {lbl}
                        </option>
                      ))}
                    </select>

                    <input
                      type="tel"
                      className="zappit-share-input"
                      placeholder={`Phone Number ${index + 2}`}
                      value={item.number}
                      onChange={(e) => handleUpdateNumber(item.id, 'number', e.target.value)}
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveNumber(item.id)}
                      title="Remove number"
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                        padding: '10px 10px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: 600,
                    fontSize: 13.5,
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1.5,
                    background: 'linear-gradient(135deg, #0066FF 0%, #00D9FF 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 13.5,
                    padding: '11px 16px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: submitting ? 'wait' : 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 102, 255, 0.35)',
                    opacity: submitting ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {submitting ? 'Sharing Details...' : 'Share Details'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareDetailsModal;
