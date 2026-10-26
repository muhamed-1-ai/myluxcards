"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Paperclip,
  UploadCloud,
  Camera,
  FileText,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { TransactionAttachmentRow } from "@/lib/accounting/types";

export const MAX_ATTACHMENTS_PER_TX = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export interface AttachmentLocalItem {
  id: string; // server id or client temp id
  file?: File;
  name: string;
  size: number;
  type: string;
  url?: string;
  downloadUrl?: string;
  previewUrl?: string;
  status: "UPLOADING" | "COMPLETED" | "FAILED";
  error?: string;
}

interface TransactionAttachmentsDropzoneProps {
  transactionId?: string | null;
  initialAttachments?: TransactionAttachmentRow[];
  onChange: (attachmentIds: string[], items: AttachmentLocalItem[]) => void;
  onErrorStateChange?: (hasErrorsOrUploading: boolean) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TransactionAttachmentsDropzone({
  transactionId,
  initialAttachments = [],
  onChange,
  onErrorStateChange,
  disabled = false,
}: TransactionAttachmentsDropzoneProps) {
  const [items, setItems] = useState<AttachmentLocalItem[]>(() =>
    initialAttachments.map((att) => ({
      id: att.id,
      name: att.file_name,
      size: att.file_size,
      type: att.file_type,
      url: att.url || `/api/accounting/transactions/attachments/${att.id}`,
      downloadUrl: att.download_url || `/api/accounting/transactions/attachments/${att.id}?download=1`,
      previewUrl: att.file_type.startsWith("image/")
        ? att.url || `/api/accounting/transactions/attachments/${att.id}`
        : undefined,
      status: "COMPLETED",
    }))
  );

  const [isDragging, setIsDragging] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Notify parent on items change
  const notifyParent = useCallback(
    (currentItems: AttachmentLocalItem[]) => {
      const completedIds = currentItems
        .filter((item) => item.status === "COMPLETED")
        .map((item) => item.id);
      onChange(completedIds, currentItems);

      const hasIssues = currentItems.some(
        (item) => item.status === "FAILED" || item.status === "UPLOADING"
      );
      onErrorStateChange?.(hasIssues);
    },
    [onChange, onErrorStateChange]
  );

  const uploadSingleFile = async (
    item: AttachmentLocalItem
  ): Promise<AttachmentLocalItem> => {
    if (!item.file) return item;

    try {
      const formData = new FormData();
      formData.append("file", item.file);
      if (transactionId) {
        formData.append("transactionId", transactionId);
      }

      const res = await fetch("/api/accounting/transactions/attachments/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      const uploaded: TransactionAttachmentRow = data.attachment;
      return {
        ...item,
        id: uploaded.id,
        name: uploaded.file_name,
        size: uploaded.file_size,
        type: uploaded.file_type,
        url: uploaded.url,
        downloadUrl: uploaded.download_url,
        previewUrl: uploaded.file_type.startsWith("image/") ? uploaded.url : undefined,
        status: "COMPLETED",
        error: undefined,
      };
    } catch (err: any) {
      return {
        ...item,
        status: "FAILED",
        error: err.message || "Failed to upload file.",
      };
    }
  };

  const processFiles = async (fileList: FileList | File[]) => {
    setBannerError(null);
    const files = Array.from(fileList);
    if (!files.length) return;

    const remainingSlots = MAX_ATTACHMENTS_PER_TX - items.length;
    if (remainingSlots <= 0) {
      setBannerError(
        `Maximum ${MAX_ATTACHMENTS_PER_TX} attachments reached. Remove existing files before adding more.`
      );
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setBannerError(
        `Only ${remainingSlots} more attachment${remainingSlots > 1 ? "s" : ""} could be added (max ${MAX_ATTACHMENTS_PER_TX}).`
      );
    }

    const newItems: AttachmentLocalItem[] = [];

    for (const file of filesToProcess) {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
      const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);

      // Check size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        newItems.push({
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          status: "FAILED",
          error: "File exceeds 10 MB limit.",
        });
        continue;
      }

      // Check format
      if (!isAllowedExt && !isAllowedMime) {
        newItems.push({
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          status: "FAILED",
          error: "Unsupported format. Only JPEG, PNG, WebP, and PDF are allowed.",
        });
        continue;
      }

      // Create preview object URL for images
      let previewUrl: string | undefined = undefined;
      if (file.type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {
          // ignore
        }
      }

      newItems.push({
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || (ext === ".pdf" ? "application/pdf" : "image/jpeg"),
        previewUrl,
        status: "UPLOADING",
      });
    }

    const updatedItems = [...items, ...newItems];
    setItems(updatedItems);
    notifyParent(updatedItems);

    // Launch uploads for items in UPLOADING state
    const processedList = [...updatedItems];
    for (let i = 0; i < processedList.length; i++) {
      if (processedList[i].status === "UPLOADING") {
        const result = await uploadSingleFile(processedList[i]);
        processedList[i] = result;
        setItems([...processedList]);
        notifyParent([...processedList]);
      }
    }
  };

  const handleRetry = async (itemId: string) => {
    const target = items.find((it) => it.id === itemId);
    if (!target || !target.file) return;

    const updated = items.map((it) =>
      it.id === itemId ? { ...it, status: "UPLOADING" as const, error: undefined } : it
    );
    setItems(updated);
    notifyParent(updated);

    const result = await uploadSingleFile(target);
    const finalItems = updated.map((it) => (it.id === itemId ? result : it));
    setItems(finalItems);
    notifyParent(finalItems);
  };

  const handleRemove = async (itemId: string) => {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;

    // Release object URL preview if created
    if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    }

    const updated = items.filter((it) => it.id !== itemId);
    setItems(updated);
    notifyParent(updated);

    // If already uploaded to server (not temp-), send background delete request
    if (!itemId.startsWith("temp-")) {
      try {
        await fetch(`/api/accounting/transactions/attachments/${itemId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.warn("Could not delete attachment from server:", err);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && items.length < MAX_ATTACHMENTS_PER_TX) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="acc-attachments-section">
      <div className="acc-attachments-header">
        <div>
          <label className="acc-form-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
            <Paperclip size={14} style={{ color: "var(--acc-blue, #3B82F6)" }} />
            Attachments (Optional)
          </label>
          <p className="acc-attachments-subtitle">
            Add bill photos, receipts, item images or supporting documents.
          </p>
        </div>
        <span className="acc-attachments-limits-badge">
          {items.length}/{MAX_ATTACHMENTS_PER_TX} files • Max 10 MB each
        </span>
      </div>

      {bannerError && (
        <div className="acc-alert acc-alert-danger" style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", marginBottom: "0.75rem" }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{bannerError}</span>
        </div>
      )}

      {/* Dropzone container */}
      {items.length < MAX_ATTACHMENTS_PER_TX && !disabled && (
        <div
          className={`acc-attachments-dropzone ${isDragging ? "acc-dropzone-active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadCloud size={24} className="acc-dropzone-icon" />
          <div className="acc-dropzone-text">
            <span className="acc-dropzone-prompt">
              Drag & drop receipts or images here, or choose an option:
            </span>
            <span className="acc-dropzone-formats">
              Supported: JPEG, PNG, WebP, PDF (up to 10 MB each)
            </span>
          </div>

          <div className="acc-dropzone-actions">
            <button
              type="button"
              className="acc-btn acc-btn-sm acc-btn-outline acc-dropzone-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <Paperclip size={13} />
              Upload Files
            </button>

            <button
              type="button"
              className="acc-btn acc-btn-sm acc-btn-outline acc-dropzone-btn"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled}
              title="Capture photo using camera"
            >
              <Camera size={13} />
              Take Photo
            </button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Attachment item cards list */}
      {items.length > 0 && (
        <div className="acc-attachments-list">
          {items.map((item) => {
            const isImage = item.type.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp"].some(ext => item.name.toLowerCase().endsWith(ext));
            const isPdf = item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf");

            return (
              <div
                key={item.id}
                className={`acc-attachment-item-card ${
                  item.status === "FAILED" ? "acc-attachment-failed" : ""
                }`}
              >
                {/* Thumbnail / Icon */}
                <div className="acc-attachment-thumb">
                  {isImage && item.previewUrl ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="acc-attachment-thumb-img"
                    />
                  ) : isPdf ? (
                    <div className="acc-attachment-thumb-pdf">
                      <FileText size={20} />
                      <span>PDF</span>
                    </div>
                  ) : (
                    <div className="acc-attachment-thumb-generic">
                      <ImageIcon size={20} />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="acc-attachment-info">
                  <span className="acc-attachment-name" title={item.name}>
                    {item.name}
                  </span>
                  <div className="acc-attachment-meta">
                    <span className="acc-attachment-size">
                      {formatFileSize(item.size)}
                    </span>
                    {item.status === "COMPLETED" && (
                      <span className="acc-attachment-status-badge acc-status-success">
                        <CheckCircle2 size={11} /> Attached
                      </span>
                    )}
                    {item.status === "UPLOADING" && (
                      <span className="acc-attachment-status-badge acc-status-uploading">
                        <RefreshCw size={11} className="acc-spin" /> Uploading...
                      </span>
                    )}
                    {item.status === "FAILED" && (
                      <span className="acc-attachment-status-badge acc-status-error">
                        <AlertCircle size={11} /> {item.error || "Upload failed"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="acc-attachment-actions">
                  {item.status === "FAILED" && item.file && (
                    <button
                      type="button"
                      className="acc-btn-icon acc-btn-retry"
                      title="Retry upload"
                      onClick={() => handleRetry(item.id)}
                      disabled={disabled}
                    >
                      <RefreshCw size={13} />
                      <span className="acc-retry-label">Retry</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="acc-btn-icon acc-btn-remove"
                    title="Remove attachment"
                    onClick={() => handleRemove(item.id)}
                    disabled={disabled}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
