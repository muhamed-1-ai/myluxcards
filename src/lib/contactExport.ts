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
import { normalizePhoneNumber } from "./phone";

export interface ContactData {
  id?: string;
  slug?: string;
  isPublicProfile?: boolean;
  name?: string | null;
  contactNumber?: string | null;
  contact_number?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  countryCode?: string | null;
  country_code?: string | null;
  countryIso?: string | null;
  country_iso?: string | null;
  email?: string | null;
  companyName?: string | null;
  company_name?: string | null;
  business?: string | null;
  jobTitle?: string | null;
  job_title?: string | null;
  title?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  website?: string | null;
  contactNumbers?: Array<{ id?: string; label?: string; phoneNumber?: string; number?: string; countryCode?: string; isPrimary?: boolean }> | null;
  additionalPhones?: Array<{ label?: string; number: string }> | null;
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
    contact.contact_number ||
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
  const rawPhone = resolvePhoneNumber(contact);
  const countryContext =
    contact.countryCode ||
    contact.country_code ||
    contact.countryIso ||
    contact.country_iso ||
    "+91";
  const norm = normalizePhoneNumber(rawPhone, countryContext);
  const phone = norm.isValid ? norm.normalized : rawPhone;

  const additionalPhones: Array<{ label?: string; number: string }> = [];
  if (Array.isArray(contact.contactNumbers)) {
    for (const item of contact.contactNumbers) {
      if (item.isPrimary) continue;
      const numRaw = (item.phoneNumber || item.number || "").trim();
      if (!numRaw) continue;
      const cc = item.countryCode || countryContext;
      const normAdd = normalizePhoneNumber(numRaw, cc);
      const val = normAdd.isValid ? normAdd.normalized : (cc ? `${cc}${numRaw}` : numRaw);
      if (val && val !== phone) {
        additionalPhones.push({
          label: item.label || "WORK",
          number: val,
        });
      }
    }
  } else if (Array.isArray(contact.additionalPhones)) {
    for (const item of contact.additionalPhones) {
      const numRaw = (item.number || "").trim();
      if (numRaw && numRaw !== phone) {
        additionalPhones.push({
          label: item.label || "WORK",
          number: numRaw,
        });
      }
    }
  }

  const vcardInput: VCardInput = {
    profileName: contact.name,
    cardName: contact.name,
    companyName: contact.companyName || contact.company_name || contact.business,
    title: contact.jobTitle || contact.job_title || contact.title,
    phone: phone || undefined,
    additionalPhones: additionalPhones.length > 0 ? additionalPhones : undefined,
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
 * - On iOS devices (Safari / WebKit): Performs user-initiated navigation to the authorized
 *   HTTPS .vcf resource, opening the native iOS Contacts Card preview (Screenshot 3).
 * - Avoids Web Share API file sharing, which causes the unwanted system share sheet (Screenshot 2).
 * - On Android & Desktop: Downloads the .vcf contact file with clear user feedback.
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

  // 1. Determine authorized endpoint URL
  let endpointUrl = "";
  if (contact.id && /^[0-9a-f-]{36}$/i.test(contact.id)) {
    endpointUrl = `/api/leads/${encodeURIComponent(contact.id)}/vcard`;
  } else if (contact.isPublicProfile && contact.slug) {
    endpointUrl = `/api/cards/public/${encodeURIComponent(contact.slug)}/vcard`;
  }

  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  // 2. Pre-verify authorized endpoint if available to prevent navigating into error pages
  let verifiedVCardText = "";
  if (endpointUrl && typeof window !== "undefined") {
    try {
      const res = await fetch(endpointUrl, {
        method: "GET",
        headers: { Accept: "text/vcard, text/x-vcard, text/plain, */*" },
        cache: "no-store",
      });

      if (!res.ok) {
        if (res.status === 401) {
          const msg = "Sign-in required to export this contact.";
          if (onFeedback) onFeedback(msg, true);
          return { success: false, method: "error", message: msg };
        }
        if (res.status === 403) {
          const msg = "Access denied to export this contact.";
          if (onFeedback) onFeedback(msg, true);
          return { success: false, method: "error", message: msg };
        }
        if (res.status === 404) {
          const msg = "Contact record not found.";
          if (onFeedback) onFeedback(msg, true);
          return { success: false, method: "error", message: msg };
        }
        const msg = "Unable to load contact file. Please try again.";
        if (onFeedback) onFeedback(msg, true);
        return { success: false, method: "error", message: msg };
      }

      const bodyText = await res.text();
      if (!bodyText.startsWith("BEGIN:VCARD")) {
        const msg = "Server returned an invalid contact format.";
        if (onFeedback) onFeedback(msg, true);
        return { success: false, method: "error", message: msg };
      }

      verifiedVCardText = bodyText;
    } catch (err: any) {
      console.warn("[vCard Pre-check Error]", err);
    }
  }

  // 3. User-Initiated Native Handoff
  // A. On iOS devices (Safari / WebKit):
  // Normal user-initiated navigation to the authorized HTTPS .vcf resource triggers
  // iOS's native QuickLook / AddressBook contact card preview modal (Screenshot 3).
  // Note: Web Share API file sharing is explicitly NOT called to avoid the unwanted generic share sheet (Screenshot 2).
  if (isIOS) {
    if (onFeedback) {
      onFeedback("Opening contact preview on your device...");
    }

    if (endpointUrl) {
      // Direct navigation to authorized HTTPS .vcf resource
      window.location.href = endpointUrl;
      return { success: true, method: "ios_preview" };
    }

    // Fallback for contacts without backend endpoint (e.g. preview drafts)
    const vcardContent = verifiedVCardText || serializeContactToVCard(contact);
    const blob = new Blob([vcardContent], { type: "text/vcard;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    window.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return { success: true, method: "ios_preview" };
  }

  // B. On Android and Desktop (or browsers without native inline vCard preview):
  // Clean file download from the verified endpoint with explicit attachment disposition, or blob download
  if (endpointUrl) {
    const downloadUrl = `${endpointUrl}?download=1`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    const vcardContent = verifiedVCardText || serializeContactToVCard(contact);
    const blob = new Blob([vcardContent], { type: "text/vcard;charset=utf-8" });
    triggerVCardBlobDownload(blob, filename);
  }

  const feedbackMsg = isAndroid
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

  if (contact.id && /^[0-9a-f-]{36}$/i.test(contact.id)) {
    const downloadUrl = `/api/leads/${encodeURIComponent(contact.id)}/vcard?download=1`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (onFeedback) {
      onFeedback(`Downloaded ${filename}`);
    }
    return true;
  }

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
