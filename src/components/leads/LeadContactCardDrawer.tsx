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

interface LeadContactCardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: {
    id: string;
    name?: string | null;
    contactNumber?: string | null;
    email?: string | null;
    companyName?: string | null;
    jobTitle?: string | null;
    address?: string | null;
    stage?: string | null;
    status?: string | null;
  } | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onToastFeedback?: (msg: string, isErr?: boolean) => void;
}

export default function LeadContactCardDrawer({
  isOpen,
  onClose,
  lead,
  isLoading = false,
  error = null,
  onRetry,
  onToastFeedback,
}: LeadContactCardDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when drawer is active
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

  if (!isOpen || !mounted) return null;

  const leadName =
    (lead?.name && lead.name.trim()) ||
    (lead?.companyName && lead.companyName.trim()) ||
    "Lead Contact";
  const phone = (lead?.contactNumber || "").trim();
  const cleanPhoneDigits = phone.replace(/[^0-9]/g, "");
  const email = (lead?.email || "").trim();
  const company = (lead?.companyName || "").trim();
  const jobTitle = (lead?.jobTitle || "").trim();
  const address = (lead?.address || "").trim();

  // Extract initials (e.g. "Sahid Cholayil" -> "SC")
  const nameParts = leadName.split(/\s+/).filter(Boolean);
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase()
      : leadName.slice(0, 2).toUpperCase();

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    if (onToastFeedback) onToastFeedback(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveToContacts = () => {
    if (!lead?.id || !phone) {
      if (onToastFeedback)
        onToastFeedback(`No valid contact number available for ${leadName}.`, true);
      return;
    }

    if (onToastFeedback) onToastFeedback(`Opening contact preview for ${leadName}...`);

    const vcardUrl = `/api/leads/${lead.id}/vcard`;
    if (typeof window !== "undefined") {
      window.location.href = vcardUrl;
    }
  };

  const handleDownloadFile = () => {
    if (!lead?.id || !phone) {
      if (onToastFeedback)
        onToastFeedback(`No valid contact number available for ${leadName}.`, true);
      return;
    }

    const safeFilename = leadName
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .trim();

    const link = document.createElement("a");
    link.href = `/api/leads/${lead.id}/vcard`;
    link.setAttribute("download", `${safeFilename || "Lead"}_Contact.vcf`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (onToastFeedback) onToastFeedback(`Contact file download started for ${leadName}.`);
  };

  // Determine which body state to render inside visible panel
  const renderPanelBody = () => {
    // 1. LOADING STATE
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <div className="text-base font-bold text-slate-900 dark:text-white">
            Loading contact details...
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Fetching verified lead contact information
          </div>
        </div>
      );
    }

    // 2. ERROR STATE
    if (error || !lead) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Unable to load contact
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              {error || "Lead contact details are unavailable or unauthenticated."}
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

    // 3. READY STATE
    return (
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        {/* Hero Contact Card Header */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          {/* Avatar / Initials Pill */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white text-2xl sm:text-3xl font-extrabold flex items-center justify-center shadow-xl ring-4 ring-blue-500/20">
            {initials}
          </div>

          {/* Subtitle Company / Role */}
          {(company || jobTitle) && (
            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase max-w-xs truncate">
              {[jobTitle, company].filter(Boolean).join(" • ")}
            </div>
          )}

          {/* Lead Full Name */}
          <h2 className="text-[22px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
            {leadName}
          </h2>

          {/* Circular Quick Action Buttons Row (Call, Message, WhatsApp, Email) */}
          <div className="flex items-center justify-center gap-4 pt-2">
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex flex-col items-center gap-1.5 group"
                title={`Call ${phone}`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-all">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Call</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1.5 opacity-40">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Call</span>
              </div>
            )}

            {phone ? (
              <a
                href={`sms:${phone}`}
                className="flex flex-col items-center gap-1.5 group"
                title={`Send SMS to ${phone}`}
              >
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-all">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Message</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1.5 opacity-40">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Message</span>
              </div>
            )}

            {phone ? (
              <a
                href={`https://wa.me/${cleanPhoneDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 group"
                title="Open WhatsApp chat"
              >
                <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-all">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">WhatsApp</span>
              </a>
            ) : null}

            {email ? (
              <a
                href={`mailto:${email}`}
                className="flex flex-col items-center gap-1.5 group"
                title={`Email ${email}`}
              >
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-all">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Email</span>
              </a>
            ) : null}
          </div>
        </div>

        {/* Grouped Information Details Card */}
        <div className="zappit-drawer-info-card space-y-4">
          {phone && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">mobile</div>
                <a href={`tel:${phone}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  {phone}
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(phone, "Mobile Number")}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title="Copy Mobile Number"
              >
                {copiedField === "Mobile Number" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          {email && (
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">email</div>
                <a href={`mailto:${email}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline break-all">
                  {email}
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(email, "Email Address")}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title="Copy Email Address"
              >
                {copiedField === "Email Address" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          {address && (
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">work address</div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">
                {address}
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={handleSaveToContacts}
            disabled={!phone}
            className="w-full h-[48px] min-h-[48px] px-6 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Save to Contacts</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadFile}
            disabled={!phone}
            className="w-full h-[44px] min-h-[44px] px-5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
      aria-label={lead ? `Contact details for ${leadName}` : "Contact details"}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="zappit-contact-drawer-backdrop"
    >
      <div className="zappit-contact-drawer-panel bg-white dark:bg-[#0A1320] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
        {/* Top Handle Bar & Close Control */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden" />
          <div className="hidden sm:block" />
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Close contact details sheet"
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
