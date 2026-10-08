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
            style={{
              background: "var(--profile-primary-gradient, var(--mod-btn-primary-bg))",
              color: "var(--profile-primary-text, var(--mod-btn-primary-text))",
            }}
          >
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            <span>Save Contact</span>
          </button>
        )}

        {onShare && (
          <button
            type="button"
            className="zappit-modern-btn-glass zappit-btn-share"
            onClick={onShare}
            style={{
              borderColor: "var(--profile-secondary-border, var(--mod-btn-glass-border))",
              background: "var(--profile-secondary-bg, var(--mod-btn-glass-bg))",
              color: "var(--profile-secondary-text, var(--mod-btn-glass-text))",
            }}
          >
            <Share2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
            <span>Share</span>
          </button>
        )}

        {hasBrochure && onOpenBrochure && (
          <button
            type="button"
            className="zappit-modern-btn-glass zappit-btn-brochure"
            onClick={onOpenBrochure}
            style={{
              borderColor: "var(--profile-secondary-border, var(--mod-btn-glass-border))",
              background: "var(--profile-secondary-bg, var(--mod-btn-glass-bg))",
              color: "var(--profile-secondary-text, var(--mod-btn-glass-text))",
            }}
          >
            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
            <span>Brochure</span>
          </button>
        )}

        {onShareDetails && (
          <button
            type="button"
            className="zappit-modern-btn-glass zappit-btn-share-details"
            onClick={onShareDetails}
            style={{
              borderColor: "var(--profile-secondary-border, var(--mod-btn-glass-border))",
              background: "var(--profile-secondary-bg, var(--mod-btn-glass-bg))",
              color: "var(--profile-secondary-text, var(--mod-btn-glass-text))",
            }}
          >
            <Users className="w-4 h-4 flex-shrink-0" style={{ color: "var(--profile-primary, var(--mod-accent))" }} />
            <span>Share Your Contacts</span>
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
          style={{
            background: "var(--profile-primary-gradient, var(--pc-accent))",
            color: "var(--profile-primary-text, #ffffff)",
            borderColor: "var(--profile-primary, var(--pc-accent))",
          }}
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
            background: "var(--profile-secondary-bg, rgba(255, 255, 255, 0.1))",
            borderColor: "var(--profile-secondary-border, var(--profile-primary))",
            color: "var(--profile-secondary-text, #ffffff)",
          }}
        >
          <Users className="w-4 h-4 flex-shrink-0 mr-1.5" style={{ color: "var(--profile-primary, var(--profile-accent))" }} />
          <span>Share Your Contacts</span>
        </button>
      )}

      {hasBrochure && onOpenBrochure && (
        <button
          className="pc-action-btn"
          type="button"
          onClick={onOpenBrochure}
          style={{
            background: "var(--profile-secondary-bg, rgba(255, 255, 255, 0.1))",
            borderColor: "var(--profile-secondary-border, var(--profile-primary))",
            color: "var(--profile-secondary-text, #ffffff)",
          }}
        >
          <FileText className="w-4 h-4 flex-shrink-0 mr-1.5" style={{ color: "var(--profile-primary, var(--profile-accent))" }} />
          <span>Brochure</span>
        </button>
      )}

      {onShare && (
        <button
          className="pc-action-btn"
          type="button"
          onClick={onShare}
          style={{
            background: "var(--profile-secondary-bg, rgba(255, 255, 255, 0.1))",
            borderColor: "var(--profile-secondary-border, var(--profile-primary))",
            color: "var(--profile-secondary-text, #ffffff)",
          }}
        >
          <Share2 className="w-4 h-4 flex-shrink-0 mr-1.5" style={{ color: "var(--profile-primary, var(--profile-accent))" }} />
          <span>Share</span>
        </button>
      )}
    </div>
  );
}
