/**
 * Contact Export Helper Utility for 3G ZAPPIT
 * Generates RFC 6350 / vCard 3.0 .vcf files from selected lead records.
 * Supports desktop file download and mobile Web Share API handoff with fallback.
 */

import { buildVCardString } from "./vcard";

export interface ContactExportLead {
  id?: string;
  name?: string | null;
  contactNumber?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export function exportLeadContact(
  lead: ContactExportLead,
  onFeedback?: (message: string, isError?: boolean) => void
): boolean {
  const name = (lead.name && lead.name.trim()) || "Lead Contact";
  const primaryPhone = (lead.contactNumber || lead.phone || lead.mobile || "").trim();

  if (!primaryPhone) {
    const errorMsg = `No phone number available for ${name}.`;
    if (onFeedback) {
      onFeedback(errorMsg, true);
    } else {
      alert(errorMsg);
    }
    return false;
  }

  // 1. Build RFC 6350 / vCard 3.0 string using serialized vcard builder
  const vcardObj = buildVCardString({
    profileName: name,
    cardName: name,
    companyName: lead.companyName,
    title: lead.jobTitle,
    phone: primaryPhone,
    email: lead.email,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    country: lead.country,
  });

  // Safe filename derived from lead's name (preserving Unicode names)
  const cleanNameForFile = name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
  const filename = `${cleanNameForFile || "Lead"}_Contact.vcf`;

  const blob = new Blob([vcardObj.vcard], { type: "text/vcard;charset=utf-8;" });

  // 2. Mobile Web Share API file sharing check
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    const isMobileDevice =
      window.innerWidth <= 1024 ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobileDevice && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: "text/vcard" });
        if (navigator.canShare({ files: [file] })) {
          navigator
            .share({
              title: filename,
              text: `Contact card for ${name}`,
              files: [file],
            })
            .then(() => {
              if (onFeedback) {
                onFeedback("Contact file ready. Open file to save in Contacts.");
              }
            })
            .catch((err) => {
              // If user cancelled the share sheet explicitly, do not force download fallback
              if (err?.name === "AbortError") {
                return;
              }
              console.warn("[Save Contact] Share sheet failed, falling back to download:", err);
              triggerBlobDownload(blob, filename, name, onToastFeedback(onFeedback));
            });
          return true;
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return false;
        }
        console.warn("[Save Contact] Web Share error, falling back to download:", err);
      }
    }
  }

  // 3. Desktop / Fallback Blob Download
  triggerBlobDownload(blob, filename, name, onToastFeedback(onFeedback));
  return true;
}

function onToastFeedback(onFeedback?: (msg: string, isErr?: boolean) => void) {
  return onFeedback || ((msg: string) => {
    try {
      showToastNotification(msg);
    } catch {}
  });
}

function triggerBlobDownload(
  blob: Blob,
  filename: string,
  leadName: string,
  onFeedback: (message: string, isError?: boolean) => void
) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 3000);
    onFeedback(`Contact download started for ${leadName}. Open ${filename} to save.`);
  } catch (err) {
    console.error("[Save Contact] Download error:", err);
    onFeedback("Failed to generate contact file. Please try again.", true);
  }
}

export function showToastNotification(message: string, isError: boolean = false) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("zappit-contact-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "zappit-contact-toast";
  toast.className = "dash-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10000;
    background: ${isError ? "#451A1A" : "#0F172A"};
    border: 1px solid ${isError ? "#F87171" : "#0066FF"};
    color: #FFFFFF;
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: fadeIn 0.2s ease-out;
  `;
  toast.innerHTML = `<span>${isError ? "⚠️" : "📇"}</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 4000);
}
