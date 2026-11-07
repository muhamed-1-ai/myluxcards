"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Share2, Copy, Check, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import type { AppDownloadSettings } from "./AppStoreChooserModal";
import { isValidStoreUrl } from "@/lib/cards";

export interface ShareableLinkItem {
  key: string;
  name: string;
  url?: string;
  brand: string;
  subText?: string;
  isAppDownload?: boolean;
  hasBothStores?: boolean;
  ariaLabel?: string;
}

export interface SelectiveAppsShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardName: string;
  items: ShareableLinkItem[];
  appDownload?: AppDownloadSettings;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Resolves the device-independent URL for an item to be shared.
 * For the App tile:
 * - Priority 1: Smart referral URL (preserves referral tracking).
 * - Priority 2: Configured app store / play store URL(s).
 * - Priority 3: The tile's direct URL.
 * For other links: preserves full URL with all query parameters, fragments, and referral tokens.
 */
export function resolveItemShareUrl(
  item: ShareableLinkItem,
  appDownload?: AppDownloadSettings
): string {
  if (item.isAppDownload) {
    const rawReferral = (appDownload?.referralUrl || "").trim();
    if (rawReferral && isValidStoreUrl(rawReferral, "universal")) {
      return /^https?:\/\//i.test(rawReferral) ? rawReferral : `https://${rawReferral}`;
    }
    const rawApple = (appDownload?.appStoreUrl || "").trim();
    const rawGoogle = (appDownload?.playStoreUrl || "").trim();
    const hasApple = Boolean(rawApple && isValidStoreUrl(rawApple, "apple"));
    const hasGoogle = Boolean(rawGoogle && isValidStoreUrl(rawGoogle, "google"));

    if (hasApple && hasGoogle) {
      const apple = /^https?:\/\//i.test(rawApple) ? rawApple : `https://${rawApple}`;
      const google = /^https?:\/\//i.test(rawGoogle) ? rawGoogle : `https://${rawGoogle}`;
      return `${apple} (iOS) / ${google} (Android)`;
    }
    if (hasApple) return /^https?:\/\//i.test(rawApple) ? rawApple : `https://${rawApple}`;
    if (hasGoogle) return /^https?:\/\//i.test(rawGoogle) ? rawGoogle : `https://${rawGoogle}`;
  }
  return (item.url || "").trim();
}

/**
 * Builds the readable text payload for sharing only the selected links in profile display order.
 */
export function buildFormattedSharePayload(
  selectedItems: ShareableLinkItem[],
  appDownload?: AppDownloadSettings
): string {
  return selectedItems
    .map((item) => {
      const url = resolveItemShareUrl(item, appDownload);
      const label = item.subText && !item.name.includes(item.subText)
        ? `${item.name} (${item.subText})`
        : item.name;
      return `${label}: ${url}`;
    })
    .join("\n");
}

export function SelectiveAppsShareModal({
  isOpen,
  onClose,
  cardName,
  items,
  appDownload,
  triggerRef,
}: SelectiveAppsShareModalProps) {
  // Starts with nothing selected as required
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string>("");
  const [manualCopyText, setManualCopyText] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedKeys(new Set());
      setToastMessage("");
      setManualCopyText(null);
      setSharing(false);
    }
  }, [isOpen]);

  // Focus trap, Escape key handling, and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 60);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to trigger button if provided
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage("");
    }, 3200);
  }, []);

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedKeys(new Set(items.map((i) => i.key)));
  }, [items]);

  const handleClearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  // Filter items in original profile order
  const selectedItems = items.filter((item) => selectedKeys.has(item.key));
  const selectionCount = selectedKeys.size;
  const isAllSelected = items.length > 0 && selectionCount === items.length;

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleCopy = useCallback(async (payload: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        showToast("Selected links copied to clipboard!");
        return true;
      }
    } catch {
      // Clipboard write failed
    }
    // Fallback: Show selectable text area for manual copying
    setManualCopyText(payload);
    return false;
  }, [showToast]);

  const handleShare = async () => {
    if (selectionCount === 0 || sharing) return;
    setSharing(true);

    const formattedPayload = buildFormattedSharePayload(selectedItems, appDownload);

    // If native share is supported, invoke directly in the button click handler
    if (canNativeShare) {
      let shareData: ShareData;
      if (selectedItems.length === 1) {
        const single = selectedItems[0];
        const singleUrl = resolveItemShareUrl(single, appDownload);
        shareData = {
          title: `${cardName} - ${single.name}`,
          text: `${single.name}: ${singleUrl}`,
          url: singleUrl,
        };
      } else {
        shareData = {
          title: `${cardName}'s Links`,
          text: formattedPayload,
        };
      }

      try {
        let isSupported = true;
        if (typeof navigator.canShare === "function") {
          try {
            isSupported = navigator.canShare(shareData);
          } catch {
            isSupported = true;
          }
        }

        if (isSupported) {
          await navigator.share(shareData);
          // Share dialog completed or dispatched
          setSharing(false);
          onClose();
          return;
        }
      } catch (err: any) {
        // AbortError is a normal user cancellation - do not show alarm or auto-copy
        if (err?.name === "AbortError") {
          setSharing(false);
          return;
        }
        // Other errors (permission, policy, unsupported payload) -> fall through to clipboard copy
      }
    }

    // Fallback if native sharing is unavailable or threw an unexpected error
    await handleCopy(formattedPayload);
    setSharing(false);
  };

  const handleDirectCopy = async () => {
    if (selectionCount === 0 || sharing) return;
    const formattedPayload = buildFormattedSharePayload(selectedItems, appDownload);
    await handleCopy(formattedPayload);
  };

  if (!isOpen) return null;

  return (
    <div
      className="zappit-share-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zappit-share-modal-title"
      aria-describedby="zappit-share-modal-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="zappit-share-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for mobile bottom sheet */}
        <div className="zappit-share-drag-bar" aria-hidden="true" />

        {/* ── HEADER ── */}
        <div className="zappit-share-header">
          <div className="zappit-share-header-text">
            <h2 id="zappit-share-modal-title" className="zappit-share-title">
              Share apps &amp; links
            </h2>
            <p id="zappit-share-modal-desc" className="zappit-share-subtitle">
              Choose the links you want to share.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="zappit-share-close-icon-btn"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── SELECTION CONTROLS BAR ── */}
        <div className="zappit-share-toolbar">
          <div className="zappit-share-pills">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`zappit-share-pill ${isAllSelected ? "disabled" : ""}`}
              disabled={isAllSelected}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className={`zappit-share-pill ${selectionCount === 0 ? "disabled" : ""}`}
              disabled={selectionCount === 0}
            >
              Clear selection
            </button>
          </div>
          <span className="zappit-share-counter">
            {selectionCount} of {items.length} selected
          </span>
        </div>

        {/* ── LINKS LIST ── */}
        <div className="zappit-share-list" role="group" aria-label="Available links to share">
          {items.map((item) => {
            const isSelected = selectedKeys.has(item.key);
            const resolvedUrl = resolveItemShareUrl(item, appDownload);

            return (
              <div
                key={item.key}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => toggleKey(item.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleKey(item.key);
                  }
                }}
                className={`zappit-share-item-row ${isSelected ? "is-selected" : ""}`}
              >
                <div className={`zappit-share-checkbox ${isSelected ? "is-checked" : ""}`} aria-hidden="true">
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>

                <div className={`zappit-share-item-icon ${item.brand}`}>
                  <BrandLogo brand={item.brand} name={item.name} size={24} />
                </div>

                <div className="zappit-share-item-content">
                  <div className="zappit-share-item-name-row">
                    <span className="zappit-share-item-name">{item.name}</span>
                    {item.subText && (
                      <span className="zappit-share-item-sub">{item.subText}</span>
                    )}
                  </div>
                  <span className="zappit-share-item-url" title={resolvedUrl}>
                    {resolvedUrl}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── MANUAL COPY TEXTAREA FALLBACK (WHEN CLIPBOARD API IS BLOCKED) ── */}
        {manualCopyText && (
          <div className="zappit-share-manual-box">
            <p className="zappit-share-manual-label">Copy selected links manually:</p>
            <textarea
              readOnly
              value={manualCopyText}
              className="zappit-share-manual-textarea"
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}

        {/* ── TOAST NOTIFICATION ── */}
        {toastMessage && (
          <div className="zappit-share-toast" role="status" aria-live="polite">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ── FOOTER ACTIONS ── */}
        <div className="zappit-share-footer">
          <button
            type="button"
            disabled={selectionCount === 0 || sharing}
            onClick={handleShare}
            className="zappit-share-submit-btn"
          >
            <Share2 className="w-4 h-4 flex-shrink-0" />
            <span>
              {canNativeShare
                ? `Share selected ${selectionCount > 0 ? `(${selectionCount})` : ""}`
                : `Copy selected links ${selectionCount > 0 ? `(${selectionCount})` : ""}`}
            </span>
          </button>

          {canNativeShare && (
            <button
              type="button"
              disabled={selectionCount === 0 || sharing}
              onClick={handleDirectCopy}
              className="zappit-share-copy-btn"
              title="Copy formatted links to clipboard"
            >
              <Copy className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Copy links</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
