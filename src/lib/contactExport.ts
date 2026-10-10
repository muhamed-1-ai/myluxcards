/**
 * Contact Export & Mobile Native Handoff Utility for 3G ZAPPIT
 * Generates RFC 6350 / vCard 3.0 .vcf files and manages browser/device handoff.
 * 
 * Supports:
 * 1. Web Share API with File (iOS 15+, Android Chrome) -> Direct phone Contacts app handoff
 * 2. iOS Safari direct vCard preview
 * 3. Android & Desktop clean .vcf file download with friendly guidance
 * 4. Graceful cancellation (AbortError) without error alerts or duplicate downloads
 */

import { buildVCardString, VCardInput } from "./vcard";

export interface ContactData {
  id?: string;
  slug?: string;
  isPublicProfile?: boolean;
  name?: string | null;
  contactNumber?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  companyName?: string | null;
  business?: string | null;
  jobTitle?: string | null;
  title?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  website?: string | null;
}

export type ContactExportLead = ContactData;

export interface ContactHandoffResult {
  success: boolean;
  method: "share_api" | "ios_preview" | "download" | "cancelled" | "error";
  message?: string;
}

/**
 * Sanitizes contact names into clean, safe filenames.
 */
export function getSafeVCardFilename(name?: string | null): string {
  const cleanName = (name || "Contact")
    .trim()
    .replace(/[\r\n"\\;=]/g, "")
    .replace(/[/\\?%*:|"<>]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 50);

  return `${cleanName || "Contact"}_Contact.vcf`;
}

/**
 * Resolves phone number from contact record.
 */
export function resolvePhoneNumber(contact: ContactData): string {
  return (
    contact.contactNumber ||
    contact.phone ||
    contact.mobile ||
    contact.whatsapp ||
    ""
  ).trim();
}

/**
 * Prepares a valid RFC 6350 / vCard 3.0 string for the contact.
 */
export function serializeContactToVCard(contact: ContactData): string {
  const phone = resolvePhoneNumber(contact);
  const vcardInput: VCardInput = {
    profileName: contact.name,
    cardName: contact.name,
    companyName: contact.companyName || contact.business,
    title: contact.jobTitle || contact.title,
    phone: phone || undefined,
    email: contact.email || undefined,
    address: contact.address || undefined,
    city: contact.city || undefined,
    state: contact.state || undefined,
    country: contact.country || undefined,
    website: contact.website || undefined,
  };

  const built = buildVCardString(vcardInput);
  return built.vcard;
}

/**
 * Native phone contact preview/save handoff.
 * Attempts native OS contact flow where supported, with graceful fallbacks.
 */
export async function executeNativeContactHandoff(
  contact: ContactData,
  onFeedback?: (msg: string, isError?: boolean) => void
): Promise<ContactHandoffResult> {
  const phone = resolvePhoneNumber(contact);
  const fullName = (contact.name || "").trim() || "Contact";

  if (!phone && !contact.email) {
    const errorMsg = `No phone number or email available for ${fullName}.`;
    if (onFeedback) onFeedback(errorMsg, true);
    return { success: false, method: "error", message: errorMsg };
  }

  const filename = getSafeVCardFilename(fullName);

  // 1. Fetch authorized vCard if an API endpoint is available, or build client-side
  let vcardText = "";
  try {
    let endpointUrl = "";
    if (contact.isPublicProfile && contact.slug) {
      endpointUrl = `/api/cards/public/${encodeURIComponent(contact.slug)}/vcard`;
    } else if (contact.id && /^[0-9a-f-]{36}$/i.test(contact.id)) {
      endpointUrl = `/api/leads/${encodeURIComponent(contact.id)}/vcard`;
    }

    if (endpointUrl && typeof window !== "undefined") {
      const res = await fetch(endpointUrl, {
        headers: { Accept: "text/vcard, text/plain, */*" },
      });
      if (res.ok) {
        vcardText = await res.text();
      }
    }
  } catch {
    // Non-fatal: fallback to client-side serializer below
  }

  if (!vcardText || !vcardText.startsWith("BEGIN:VCARD")) {
    vcardText = serializeContactToVCard(contact);
  }

  // 2. Try Mobile Web Share API with File (iOS 15+, modern Android)
  if (typeof navigator !== "undefined" && typeof File !== "undefined") {
    try {
      const vcardFile = new File([vcardText], filename, {
        type: "text/vcard;charset=utf-8",
      });

      if (navigator.canShare && navigator.canShare({ files: [vcardFile] })) {
        await navigator.share({
          files: [vcardFile],
          title: fullName,
        });

        // Native share completed without exception
        if (onFeedback) {
          onFeedback("Complete saving in your phone's Contacts app.");
        }
        return { success: true, method: "share_api" };
      }
    } catch (err: any) {
      // User cancelled the native share sheet
      if (err?.name === "AbortError") {
        return { success: true, method: "cancelled" };
      }
      // If another error occurred, proceed to fallbacks
    }
  }

  // 3. Browser-specific fallback
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const blob = new Blob([vcardText], { type: "text/vcard;charset=utf-8" });

  if (isIOS) {
    // On iOS Safari, creating a blob link and clicking it prompts the native contact preview
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    if (onFeedback) {
      onFeedback("Opening contact preview on your device...");
    }
    return { success: true, method: "ios_preview" };
  }

  // 4. Android & Desktop: Clean file download with guidance
  triggerVCardBlobDownload(blob, filename);

  const isMobile =
    typeof window !== "undefined" &&
    (window.innerWidth <= 1024 || /Android/i.test(navigator.userAgent));

  const feedbackMsg = isMobile
    ? "Contact file downloaded. Tap the notification to add to contacts."
    : `Contact file downloaded (${filename}).`;

  if (onFeedback) onFeedback(feedbackMsg);

  return { success: true, method: "download", message: feedbackMsg };
}

/**
 * Downloads the .vcf file explicitly.
 */
export function triggerExplicitVCardDownload(
  contact: ContactData,
  onFeedback?: (msg: string, isError?: boolean) => void
): boolean {
  const fullName = (contact.name || "").trim() || "Contact";
  const filename = getSafeVCardFilename(fullName);
  const vcardText = serializeContactToVCard(contact);

  try {
    const blob = new Blob([vcardText], { type: "text/vcard;charset=utf-8" });
    triggerVCardBlobDownload(blob, filename);
    if (onFeedback) {
      onFeedback(`Downloaded ${filename}`);
    }
    return true;
  } catch (err) {
    console.error("[vCard Download Error]", err);
    if (onFeedback) {
      onFeedback("Could not download contact file. Please try again.", true);
    }
    return false;
  }
}

function triggerVCardBlobDownload(blob: Blob, filename: string) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Backwards compatibility helper for existing lead workspace callers.
 */
export function exportLeadContact(
  lead: ContactExportLead,
  onFeedback?: (message: string, isError?: boolean) => void
): boolean {
  void executeNativeContactHandoff(lead, onFeedback);
  return true;
}

/**
 * Non-intrusive floating toast feedback
 */
export function showToastNotification(message: string, isError: boolean = false) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("zappit-contact-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "zappit-contact-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    background: ${isError ? "#1F1212" : "#0F172A"};
    border: 1px solid ${isError ? "#EF4444" : "#3B82F6"};
    color: #FFFFFF;
    padding: 12px 20px;
    border-radius: 14px;
    box-shadow: 0 12px 30px rgba(0,0,0,0.4);
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    transition: opacity 0.2s ease;
  `;
  toast.innerHTML = `<span>${isError ? "⚠️" : "📇"}</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }
  }, 3500);
}
