"use client";

import React, { useMemo, useState } from "react";
import { buildPremiumQrSvg, svgToHighResPngBlob } from "@/lib/premiumQr";

export interface PremiumQRCodeProps {
  value: string;
  label?: string;
  showLabel?: boolean;
  size?: number;
  downloadFilename?: string;
  className?: string;
}

export function PremiumQRCode({
  value,
  label = "SCAN ME",
  showLabel = true,
  downloadFilename = "mylux-card-qr",
  className = "",
}: PremiumQRCodeProps) {
  const [isDownloadingPng, setIsDownloadingPng] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svgString = useMemo(() => {
    try {
      return buildPremiumQrSvg(value, { label, showLabel });
    } catch {
      return null;
    }
  }, [value, label, showLabel]);

  const handleDownloadPng = async () => {
    if (!svgString) return;
    setIsDownloadingPng(true);
    setError(null);
    try {
      const blob = await svgToHighResPngBlob(svgString, 1500);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${downloadFilename}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Failed to generate PNG download.");
    } finally {
      setIsDownloadingPng(false);
    }
  };

  const handleDownloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${downloadFilename}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!svgString) {
    return <div className="qr-error">Could not render QR code.</div>;
  }

  return (
    <div className={`premium-qr-container ${className}`}>
      <div
        className="premium-qr-display"
        dangerouslySetInnerHTML={{ __html: svgString }}
        style={{ width: "100%", maxWidth: "340px", margin: "0 auto" }}
      />
      {error && <p className="qr-error-msg">{error}</p>}
      <div className="premium-qr-actions" style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "center" }}>
        <button
          type="button"
          className="qr-download-btn"
          onClick={handleDownloadPng}
          disabled={isDownloadingPng}
        >
          {isDownloadingPng ? "Preparing PNG…" : "Download PNG"}
        </button>
        <button
          type="button"
          className="qr-download-btn svg-btn"
          onClick={handleDownloadSvg}
        >
          Download SVG
        </button>
      </div>
    </div>
  );
}
