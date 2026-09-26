"use client";

import React from "react";
import { UserPlus, Users, FileText, Share2 } from "lucide-react";

export interface ProfileActionsProps {
  card: {
    name?: string;
    brochure?: string;
    brochureData?: string;
    [key: string]: any;
  };
  onSaveContact?: () => void;
  onShareDetails?: () => void;
  onShare?: () => void;
  onOpenBrochure?: () => void;
  layoutStyle?: "modern" | "standard";
  isDashboardPreview?: boolean;
}

export function ProfileActions({
  card,
  onSaveContact,
  onShareDetails,
  onShare,
  onOpenBrochure,
  layoutStyle = "modern",
}: ProfileActionsProps) {
  const hasBrochure = Boolean(card.brochure || card.brochureData);

  if (layoutStyle === "modern") {
    return (
      <div className="zappit-modern-actions-grid">
        {onSaveContact && (
          <button
            type="button"
            className="zappit-modern-btn-primary"
            onClick={onSaveContact}
          >
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            <span>Save Contact</span>
          </button>
        )}

        {onShareDetails && (
          <button
            type="button"
            className="zappit-modern-btn-glass zappit-btn-share-details"
            onClick={onShareDetails}
            style={{
              borderColor: "rgba(0, 229, 255, 0.4)",
              background: "rgba(0, 102, 255, 0.15)",
              color: "#ffffff",
            }}
          >
            <Users className="w-4 h-4 flex-shrink-0 text-[#00E5FF]" />
            <span>Share Details</span>
          </button>
        )}

        {hasBrochure && onOpenBrochure && (
          <button
            type="button"
            className="zappit-modern-btn-glass"
            onClick={onOpenBrochure}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span>Brochure</span>
          </button>
        )}

        {onShare && (
          <button
            type="button"
            className="zappit-modern-btn-glass"
            onClick={onShare}
          >
            <Share2 className="w-4 h-4 flex-shrink-0" />
            <span>Share</span>
          </button>
        )}
      </div>
    );
  }

  // Standard Profile Layout
  return (
    <div className="profile-actions pc-actions">
      {onSaveContact && (
        <button
          className="pc-action-btn pc-action-btn-primary"
          type="button"
          onClick={onSaveContact}
        >
          <UserPlus className="w-4 h-4 flex-shrink-0 mr-1.5" />
          <span>Save Contact</span>
        </button>
      )}

      {onShareDetails && (
        <button
          className="pc-action-btn zappit-btn-share-details"
          type="button"
          onClick={onShareDetails}
          style={{
            background: "rgba(0, 102, 255, 0.25)",
            borderColor: "#00E5FF",
            color: "#ffffff",
          }}
        >
          <Users className="w-4 h-4 flex-shrink-0 mr-1.5 text-[#00E5FF]" />
          <span>Share Details</span>
        </button>
      )}

      {hasBrochure && onOpenBrochure && (
        <button
          className="pc-action-btn"
          type="button"
          onClick={onOpenBrochure}
        >
          <FileText className="w-4 h-4 flex-shrink-0 mr-1.5" />
          <span>Brochure</span>
        </button>
      )}

      {onShare && (
        <button
          className="pc-action-btn"
          type="button"
          onClick={onShare}
        >
          <Share2 className="w-4 h-4 flex-shrink-0 mr-1.5" />
          <span>Share</span>
        </button>
      )}
    </div>
  );
}
