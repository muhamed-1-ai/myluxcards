"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  UserPlus,
  Download,
  Check,
  Copy,
  MessageCircle,
  AlertCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  ContactData,
  executeNativeContactHandoff,
  triggerExplicitVCardDownload,
  resolvePhoneNumber,
} from "@/lib/contactExport";
import "./contact-card-drawer.css";

export interface LeadContactCardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Supports either lead or contact prop for maximum interoperability
  lead?: ContactData | null;
  contact?: ContactData | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onToastFeedback?: (msg: string, isErr?: boolean) => void;
}

export default function LeadContactCardDrawer({
  isOpen,
  onClose,
  lead,
  contact,
  isLoading = false,
  error = null,
  onRetry,
  onToastFeedback,
}: LeadContactCardDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeContact: ContactData | null = contact || lead || null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is open and restore on unmount/close
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Clear transient notice when drawer opens/closes
  useEffect(() => {
    if (!isOpen) {
      setNoticeMessage(null);
      setIsSaving(false);
      setCopiedField(null);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const contactName =
    (activeContact?.name && activeContact.name.trim()) ||
    (activeContact?.companyName && activeContact.companyName.trim()) ||
    (activeContact?.business && activeContact.business.trim()) ||
    "Contact Details";

  const phone = activeContact ? resolvePhoneNumber(activeContact) : "";
  const cleanPhoneDigits = phone.replace(/[^0-9]/g, "");
  const email = (activeContact?.email || "").trim();
  const company = (activeContact?.companyName || activeContact?.business || "").trim();
  const jobTitle = (activeContact?.jobTitle || activeContact?.title || "").trim();
  const address = (activeContact?.address || "").trim();

  // Handle / subtitle badge: e.g. card slug or brand tag if provided
  const handleBadge =
    (activeContact?.slug && activeContact.slug.toUpperCase()) ||
    (company && !jobTitle ? company : "");

  // Extract initials (e.g. "Sinan M" -> "SM", or "Sinan" -> "SI")
  const nameParts = contactName.split(/\s+/).filter(Boolean);
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase()
      : contactName.slice(0, 2).toUpperCase() || "ZP";

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedField(label);
    if (onToastFeedback) onToastFeedback(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveToContacts = async () => {
    if (isSaving || !activeContact) return;
    if (!phone && !email) {
      if (onToastFeedback) {
        onToastFeedback(`No valid phone number or email for ${contactName}.`, true);
      }
      return;
    }

    setIsSaving(true);
    setNoticeMessage(null);

    try {
      const result = await executeNativeContactHandoff(
        activeContact,
        (msg, isErr) => {
          if (onToastFeedback) onToastFeedback(msg, isErr);
          if (!isErr) setNoticeMessage(msg);
        }
      );

      if (result.method === "download") {
        setNoticeMessage("Contact file downloaded. Tap the notification to add to contacts.");
      } else if (result.method === "ios_preview") {
        setNoticeMessage("Opening contact preview on your device.");
      }
    } catch (err: any) {
      console.error("[Save Contact Error]", err);
      const errMsg = err?.message || "Unable to open contact preview. Please try again.";
      if (onToastFeedback) onToastFeedback(errMsg, true);
      setNoticeMessage(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadFile = () => {
    if (!activeContact) return;
    triggerExplicitVCardDownload(activeContact, onToastFeedback);
  };

  // Determine which body state to render inside visible panel
  const renderPanelBody = () => {
    // 1. LOADING STATE
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <div className="text-base font-bold text-slate-900 dark:text-white">
            Loading contact details...
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Fetching verified contact information
          </div>
        </div>
      );
    }

    // 2. ERROR STATE
    if (error || !activeContact) {
      return (
        <div className="flex flex-col items-center justify-center py-14 px-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Unable to load contact
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              {error || "Contact details are unavailable."}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="h-10 px-5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    const subtitleText = [jobTitle, company].filter(Boolean).join(" • ");

    // 3. READY STATE
    return (
      <div className="zappit-contact-scroll-body">
        {/* Identity Section */}
        <div className="zappit-contact-identity">
          <div className="zappit-contact-avatar">
            {initials}
          </div>

          {handleBadge && (
            <div className="zappit-contact-badge">
              {handleBadge}
            </div>
          )}

          <h2 id="zappit-contact-title" className="zappit-contact-name">
            {contactName}
          </h2>

          {subtitleText && (
            <p className="zappit-contact-subtext">
              {subtitleText}
            </p>
          )}
        </div>

        {/* Quick Actions Row (Call, Message, WhatsApp, Email) */}
        {(phone || email) && (
          <div className="zappit-contact-actions-row">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="zappit-action-item"
                title={`Call ${phone}`}
                aria-label={`Call ${phone}`}
              >
                <div className="zappit-action-btn-circle zappit-action-call">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="zappit-action-label">Call</span>
              </a>
            )}

            {phone && (
              <a
                href={`sms:${phone}`}
                className="zappit-action-item"
                title={`Send SMS to ${phone}`}
                aria-label={`Message ${phone}`}
              >
                <div className="zappit-action-btn-circle zappit-action-message">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="zappit-action-label">Message</span>
              </a>
            )}

            {phone && (
              <a
                href={`https://wa.me/${cleanPhoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="zappit-action-item"
                title="Open WhatsApp chat"
                aria-label="Open WhatsApp chat"
              >
                <div className="zappit-action-btn-circle zappit-action-whatsapp">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="zappit-action-label">WhatsApp</span>
              </a>
            )}

            {email && (
              <a
                href={`mailto:${email}`}
                className="zappit-action-item"
                title={`Email ${email}`}
                aria-label={`Email ${email}`}
              >
                <div className="zappit-action-btn-circle zappit-action-email">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="zappit-action-label">Email</span>
              </a>
            )}
          </div>
        )}

        {/* Contact Details Surface */}
        <div className="zappit-details-surface">
          {phone && (
            <div className="zappit-detail-row">
              <div className="zappit-detail-content">
                <span className="zappit-detail-label">Mobile</span>
                <a href={`tel:${phone}`} className="zappit-detail-value">
                  {phone}
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(phone, "Mobile Number")}
                className="zappit-copy-btn"
                title="Copy Mobile Number"
                aria-label="Copy Mobile Number"
              >
                {copiedField === "Mobile Number" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {email && (
            <div className="zappit-detail-row">
              <div className="zappit-detail-content">
                <span className="zappit-detail-label">Email</span>
                <a href={`mailto:${email}`} className="zappit-detail-value">
                  {email}
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(email, "Email Address")}
                className="zappit-copy-btn"
                title="Copy Email Address"
                aria-label="Copy Email Address"
              >
                {copiedField === "Email Address" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {address && (
            <div className="zappit-detail-row">
              <div className="zappit-detail-content">
                <span className="zappit-detail-label">Address</span>
                <span className="zappit-detail-value">
                  {address}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(address, "Address")}
                className="zappit-copy-btn"
                title="Copy Address"
                aria-label="Copy Address"
              >
                {copiedField === "Address" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Informative Guidance Notice if active */}
        {noticeMessage && (
          <div className="zappit-notice-banner" role="status">
            {noticeMessage}
          </div>
        )}

        {/* Save Area */}
        <div className="zappit-save-footer">
          <button
            type="button"
            onClick={handleSaveToContacts}
            disabled={(!phone && !email) || isSaving}
            className="zappit-btn-primary-save"
            aria-label="Save contact to phone"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Preparing Contact...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Save to Contacts</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadFile}
            disabled={(!phone && !email) || isSaving}
            className="zappit-btn-secondary-download"
            aria-label="Download vCard contact file"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Download Contact File (.vcf)</span>
          </button>
        </div>
      </div>
    );
  };

  const drawerContent = (
    <div
      ref={backdropRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="zappit-contact-title"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="zappit-contact-backdrop"
    >
      <div ref={panelRef} className="zappit-contact-panel">
        {/* Top Header with Centered Drag Handle & Inside Close Button */}
        <div className="zappit-contact-header">
          <div className="zappit-contact-handle" />
          <button
            type="button"
            onClick={onClose}
            className="zappit-contact-close-btn"
            aria-label="Close contact sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic State Body: Loading, Error, or Ready */}
        {renderPanelBody()}
      </div>
    </div>
  );

  return typeof window !== "undefined" ? createPortal(drawerContent, document.body) : null;
}
