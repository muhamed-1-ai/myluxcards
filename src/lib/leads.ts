export type LeadStatus = 'NEW' | 'CONTACTED' | 'INTERESTED' | 'FOLLOW_UP' | 'WON' | 'LOST' | 'ARCHIVED';

export interface LeadRecord {
  id: string;
  card_id: string;
  owner_user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  company: string | null;
  message: string | null;
  status: LeadStatus;
  source: string;
  next_follow_up_at: string | null;
  notes: string | null;
  submission_count: number;
  consent_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface LeadNoteRecord {
  id: string;
  lead_id: string;
  user_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface LeadSummaryMetrics {
  total: number;
  newCount: number;
  followUpCount: number;
  wonCount: number;
}

export const LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'FOLLOW_UP',
  'WON',
  'LOST',
];

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; bg: string; color: string; border: string }> = {
  NEW:        { label: "NEW",        bg: "rgba(52, 152, 219, 0.15)",  color: "#3498db", border: "rgba(52, 152, 219, 0.4)" },
  CONTACTED:  { label: "CONTACTED",  bg: "rgba(212, 175, 55, 0.15)",  color: "#d4af37", border: "rgba(212, 175, 55, 0.4)" },
  INTERESTED: { label: "INTERESTED", bg: "rgba(155, 89, 182, 0.15)", color: "#a569bd", border: "rgba(155, 89, 182, 0.4)" },
  FOLLOW_UP:  { label: "FOLLOW-UP",  bg: "rgba(230, 126, 34, 0.15)",  color: "#e67e22", border: "rgba(230, 126, 34, 0.4)" },
  WON:        { label: "WON",        bg: "rgba(46, 204, 113, 0.15)",  color: "#2ecc71", border: "rgba(46, 204, 113, 0.4)" },
  LOST:       { label: "LOST",       bg: "rgba(231, 76, 60, 0.15)",   color: "#e74c3c", border: "rgba(231, 76, 60, 0.4)" },
  ARCHIVED:   { label: "ARCHIVED",   bg: "rgba(149, 165, 166, 0.15)", color: "#95a5a6", border: "rgba(149, 165, 166, 0.4)" },
};

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export function validateLeadSubmission(data: { name?: unknown; company?: unknown; phone?: unknown; email?: unknown }) {
  const name = String(data.name || "").trim();
  const company = String(data.company || "").trim();
  const phone = String(data.phone || "").trim();
  const email = data.email ? String(data.email).trim() : "";

  if (name.length < 2 || name.length > 100) {
    return { valid: false, message: "Please enter a valid name (2 to 100 characters)." };
  }
  if (company.length < 1 || company.length > 150) {
    return { valid: false, message: "Please enter your company name (up to 150 characters)." };
  }
  const digits = normalizePhoneNumber(phone);
  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, message: "Please enter a valid phone number (at least 7 digits)." };
  }
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
    return { valid: false, message: "Please enter a valid email address." };
  }

  return {
    valid: true,
    data: { name, company, phone, email: email || null },
  };
}

export function formatWhatsAppUrl(phone: string): string {
  const digits = normalizePhoneNumber(phone);
  if (!digits) return "#";
  return `https://wa.me/${digits}`;
}
