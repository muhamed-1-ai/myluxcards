/**
 * Contact Export Helper Utility for 3G ZAPPIT
 * Generates RFC 6350 / vCard 3.0 .vcf files from selected lead records.
 * Direct inline vCard serving & desktop download without navigator.share system sheet.
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

  // Safe filename derived from lead's name
  const cleanNameForFile = name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
  const filename = `${cleanNameForFile || "Lead"}_Contact.vcf`;

  // Check if lead has server id for direct API endpoint opening
  if (lead.id && typeof window !== "undefined") {
    const isMobileDevice =
      window.innerWidth <= 1024 ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobileDevice) {
      // Mobile native contact preview/import: direct user navigation to authorized vCard endpoint
      const vcardUrl = `/api/leads/${lead.id}/vcard`;
      if (onFeedback) {
        onFeedback(`Opening contact preview for ${name}...`);
      }
      window.location.href = vcardUrl;
      return true;
    }
  }

  // Client-side Blob generation for desktop or fallback
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

  const blob = new Blob([vcardObj.vcard], { type: "text/vcard;charset=utf-8;" });
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
    onFeedback(`Contact download started for ${leadName}.`);
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
    border: 1px solid ${isError ? "#0066FF" : "#0066FF"};
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
