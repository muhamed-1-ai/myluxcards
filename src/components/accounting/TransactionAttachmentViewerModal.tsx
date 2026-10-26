"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import type { TransactionAttachmentRow } from "@/lib/accounting/types";

interface TransactionAttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionTitle?: string;
  transactionSubtitle?: string;
  attachments: TransactionAttachmentRow[];
  initialIndex?: number;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TransactionAttachmentViewerModal({
  isOpen,
  onClose,
  transactionTitle,
  transactionSubtitle,
  attachments,
  initialIndex = 0,
}: TransactionAttachmentViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoading, setImageLoading] = useState(true);

  // Sync initialIndex when modal opens
  useEffect(() => {
    if (isOpen) {
      const validIndex = Math.max(0, Math.min(initialIndex, attachments.length - 1));
      setCurrentIndex(validIndex);
      setImageLoading(true);
    }
  }, [isOpen, initialIndex, attachments.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setImageLoading(true);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < attachments.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setImageLoading(true);
    }
  }, [currentIndex, attachments.length]);

  // Keyboard navigation: Escape, ArrowLeft, ArrowRight
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  if (!isOpen || !attachments || attachments.length === 0) return null;

  const current = attachments[currentIndex] || attachments[0];
  const isPdf =
    current.file_type === "application/pdf" ||
    current.file_name.toLowerCase().endsWith(".pdf");
  const isImage =
    current.file_type?.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".webp"].some((ext) =>
      current.file_name.toLowerCase().endsWith(ext)
    );

  const fileUrl = current.url || `/api/accounting/transactions/attachments/${current.id}`;
  const downloadUrl =
    current.download_url ||
    `/api/accounting/transactions/attachments/${current.id}?download=1`;

  return (
    <div
      className="acc-modal-backdrop acc-attachment-viewer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Attachment Viewer"
    >
      <div
        className="acc-modal-content acc-attachment-viewer-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="acc-viewer-header">
          <div className="acc-viewer-title-group">
            <div className="acc-viewer-title-row">
              <Paperclip size={15} style={{ color: "var(--acc-blue, #3B82F6)" }} />
              <h3 className="acc-viewer-filename" title={current.file_name}>
                {current.file_name}
              </h3>
              <span className="acc-viewer-counter">
                {currentIndex + 1} of {attachments.length}
              </span>
            </div>
            {(transactionTitle || transactionSubtitle) && (
              <div className="acc-viewer-context">
                {transactionTitle && <span className="acc-viewer-ctx-title">{transactionTitle}</span>}
                {transactionTitle && transactionSubtitle && <span> • </span>}
                {transactionSubtitle && <span className="acc-viewer-ctx-sub">{transactionSubtitle}</span>}
                <span> • {formatFileSize(current.file_size)}</span>
              </div>
            )}
          </div>

          <div className="acc-viewer-actions">
            <a
              href={downloadUrl}
              download={current.file_name}
              className="acc-btn acc-btn-sm acc-btn-outline acc-viewer-download-btn"
              title="Download file"
            >
              <Download size={14} />
              <span>Download</span>
            </a>

            <button
              type="button"
              className="acc-modal-close"
              onClick={onClose}
              aria-label="Close viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Viewer Body / Stage */}
        <div className="acc-viewer-stage">
          {/* Previous Button */}
          {attachments.length > 1 && (
            <button
              type="button"
              className="acc-viewer-nav-btn acc-viewer-nav-prev"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label="Previous attachment"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Main Content Area */}
          <div className="acc-viewer-media-wrapper">
            {isImage ? (
              <div className="acc-viewer-img-container">
                <img
                  src={fileUrl}
                  alt={current.file_name}
                  className={`acc-viewer-img ${imageLoading ? "acc-viewer-img-loading" : ""}`}
                  onLoad={() => setImageLoading(false)}
                />
              </div>
            ) : isPdf ? (
              <div className="acc-viewer-pdf-container">
                <div className="acc-viewer-pdf-toolbar">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FileText size={18} style={{ color: "#EF4444" }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>PDF Document Preview</span>
                  </div>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="acc-btn acc-btn-sm acc-btn-outline"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                  >
                    <ExternalLink size={12} />
                    Open in New Tab
                  </a>
                </div>
                <iframe
                  src={`${fileUrl}#toolbar=0`}
                  title={current.file_name}
                  className="acc-viewer-pdf-frame"
                />
              </div>
            ) : (
              <div className="acc-viewer-fallback">
                <FileText size={48} style={{ color: "var(--acc-text-muted)" }} />
                <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>{current.file_name}</p>
                <a
                  href={downloadUrl}
                  download={current.file_name}
                  className="acc-btn acc-btn-primary"
                  style={{ marginTop: "1rem" }}
                >
                  <Download size={14} />
                  Download File ({formatFileSize(current.file_size)})
                </a>
              </div>
            )}
          </div>

          {/* Next Button */}
          {attachments.length > 1 && (
            <button
              type="button"
              className="acc-viewer-nav-btn acc-viewer-nav-next"
              onClick={handleNext}
              disabled={currentIndex === attachments.length - 1}
              aria-label="Next attachment"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        {/* Bottom Thumbnails Strip (when multiple attachments) */}
        {attachments.length > 1 && (
          <div className="acc-viewer-thumb-strip">
            {attachments.map((att, idx) => {
              const attIsImage =
                att.file_type?.startsWith("image/") ||
                [".jpg", ".jpeg", ".png", ".webp"].some((ext) =>
                  att.file_name.toLowerCase().endsWith(ext)
                );
              const thumbUrl = att.url || `/api/accounting/transactions/attachments/${att.id}`;

              return (
                <button
                  key={att.id}
                  type="button"
                  className={`acc-viewer-strip-thumb ${idx === currentIndex ? "acc-strip-thumb-active" : ""}`}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setImageLoading(true);
                  }}
                  title={att.file_name}
                >
                  {attIsImage ? (
                    <img src={thumbUrl} alt={att.file_name} />
                  ) : (
                    <div className="acc-viewer-strip-pdf">
                      <FileText size={16} />
                      <span>PDF</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
