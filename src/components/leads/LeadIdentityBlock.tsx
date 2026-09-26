"use client";

import React from "react";
import { Star, MessageSquare, Phone } from "lucide-react";

export interface LeadIdentityBlockProps {
  lead: {
    id: string;
    name?: string | null;
    email?: string | null;
    contactNumber?: string | null;
    companyName?: string | null;
    avatarUrl?: string | null;
  };
  isStarred: boolean;
  onToggleStar: (e: React.MouseEvent, id: string) => void;
  showStar?: boolean;
  className?: string;
}

export function getAvatarGradient(name: string) {
  const charCode = name.charCodeAt(0) || 65;
  if (charCode % 4 === 0) return "bg-emerald-600 text-white";
  if (charCode % 4 === 1) return "bg-purple-600 text-white";
  if (charCode % 4 === 2) return "bg-blue-600 text-white";
  return "bg-indigo-600 text-white";
}

export default function LeadIdentityBlock({
  lead,
  isStarred,
  onToggleStar,
  showStar = true,
  className = "",
}: LeadIdentityBlockProps) {
  const leadName = (lead.name && lead.name.trim()) || "Unnamed Lead";
  const avatarLetter = leadName.charAt(0).toUpperCase();
  const hasEmail = Boolean(lead.email && lead.email.trim());
  const hasPhone = Boolean(lead.contactNumber && lead.contactNumber.trim());

  // Format WhatsApp clean number (digits only)
  const cleanPhone = hasPhone ? lead.contactNumber!.replace(/[^0-9]/g, "") : "";

  return (
    <div className={`flex items-start gap-3 min-w-0 w-full max-w-[380px] ${className}`}>
      {/* Left: Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        {lead.avatarUrl ? (
          <img
            src={lead.avatarUrl}
            alt={leadName}
            className="w-9 h-9 sm:w-[38px] sm:h-[38px] rounded-full object-cover shadow-sm border border-slate-700/50"
          />
        ) : (
          <div
            className={`w-9 h-9 sm:w-[38px] sm:h-[38px] rounded-full ${getAvatarGradient(
              leadName
            )} font-bold flex items-center justify-center text-sm shadow-sm select-none`}
            aria-hidden="true"
          >
            {avatarLetter}
          </div>
        )}
      </div>

      {/* Right: Three levels of information */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        {/* Line 1: Lead Name & Star */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <span
            className="font-semibold text-[14px] leading-snug text-[var(--text-primary,#0F172A)] group-hover:text-emerald-500 transition-colors line-clamp-2 break-words"
            title={leadName}
          >
            {leadName}
          </span>

          {showStar && (
            <button
              type="button"
              onClick={(e) => onToggleStar(e, lead.id)}
              className="p-1 rounded-md hover:bg-slate-800/60 transition-colors flex-shrink-0 text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
              aria-label={isStarred ? "Remove from starred" : "Star lead"}
              title={isStarred ? "Starred lead" : "Star lead"}
            >
              <Star
                className={`w-4 h-4 transition-colors ${
                  isStarred
                    ? "text-amber-400 fill-amber-400"
                    : "text-[var(--text-secondary,#94A3B8)] hover:text-amber-400"
                }`}
              />
            </button>
          )}
        </div>

        {/* Line 2: Email */}
        {hasEmail ? (
          <div className="min-w-0">
            <a
              href={`mailto:${lead.email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[12px] text-[var(--text-secondary,#94A3B8)] hover:text-emerald-400 transition-colors truncate block"
              title={lead.email!}
            >
              {lead.email}
            </a>
          </div>
        ) : null}

        {/* Line 3: Phone & Contact Actions */}
        {hasPhone ? (
          <div className="flex flex-wrap items-center gap-y-1 gap-x-2.5 text-[12px] text-[var(--text-secondary,#94A3B8)] pt-0.5 min-w-0">
            <span
              className="font-normal text-[var(--text-secondary,#94A3B8)] whitespace-nowrap"
              title={lead.contactNumber!}
            >
              {lead.contactNumber}
            </span>

            <div
              className="flex items-center gap-1.5 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {cleanPhone && (
                <a
                  href={`https://wa.me/${cleanPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Send WhatsApp message"
                  aria-label={`Send WhatsApp message to ${leadName}`}
                  className="w-7 h-7 sm:w-7 sm:h-7 min-w-[28px] min-h-[28px] rounded-md bg-slate-800/70 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700/60 hover:border-emerald-500/50 transition-all flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-emerald-500/20" />
                </a>
              )}
              <a
                href={`tel:${lead.contactNumber}`}
                onClick={(e) => e.stopPropagation()}
                title="Call lead"
                aria-label={`Call ${leadName}`}
                className="w-7 h-7 sm:w-7 sm:h-7 min-w-[28px] min-h-[28px] rounded-md bg-slate-800/70 hover:bg-blue-500/20 text-slate-300 hover:text-blue-400 border border-slate-700/60 hover:border-blue-500/50 transition-all flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : !hasEmail ? (
          <div className="text-[12px] text-slate-500 italic pt-0.5">
            No contact details
          </div>
        ) : null}
      </div>
    </div>
  );
}
