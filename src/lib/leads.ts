import { pool } from "./db/core";
import { normalizePhoneNumber } from "./phone";

export interface CreateLeadInput {
  ownerUserId: string;
  cardId: string;
  name: string;
  companyName?: string | null;
  contactNumber: string;
  email?: string | null;
  source?: string;
}

export interface LeadRecord {
  id: string;
  owner_user_id: string;
  card_id: string;
  name: string;
  company_name: string | null;
  contact_number: string;
  contact_number_normalized: string;
  email: string | null;
  status: string;
  source: string;
  first_submitted_at: Date;
  last_submitted_at: Date;
  submission_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertLeadResult {
  lead: LeadRecord;
  isNew: boolean;
  submissionCount: number;
}

/**
 * Validates lead submission payload server-side.
 */
export function validateLeadInput(input: Partial<CreateLeadInput>): {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: {
    name: string;
    companyName: string | null;
    contactNumber: string;
    contactNumberNormalized: string;
    email: string | null;
  };
} {
  const errors: Record<string, string> = {};

  const name = (input.name || "").trim().slice(0, 100);
  if (!name) {
    errors.name = "Please enter your name.";
  }

  const rawPhone = (input.contactNumber || "").trim();
  const phoneRes = normalizePhoneNumber(rawPhone);
  if (!phoneRes.isValid) {
    errors.contactNumber = "Please enter a valid contact number.";
  }

  const companyName = (input.companyName || "").trim().slice(0, 150) || null;

  let email: string | null = null;
  if (input.email && input.email.trim().length > 0) {
    const rawEmail = input.email.trim().toLowerCase().slice(0, 255);
    // Standard email validation (not overly strict)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(rawEmail)) {
      errors.email = "Please enter a valid email address.";
    } else {
      email = rawEmail;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      name,
      companyName,
      contactNumber: rawPhone,
      contactNumberNormalized: phoneRes.normalized,
      email,
    },
  };
}

/**
 * Upserts a Lead scoped to (ownerUserId, contactNumberNormalized).
 * Multi-tenant safe. Overwrite-protected for empty optional fields.
 */
export async function upsertLead(input: CreateLeadInput): Promise<UpsertLeadResult> {
  const validation = validateLeadInput(input);
  if (!validation.valid || !validation.sanitized) {
    throw new Error(Object.values(validation.errors)[0] || "Invalid lead data.");
  }

  const { name, companyName, contactNumber, contactNumberNormalized, email } = validation.sanitized;
  const sourceInput = (input.source || "DIRECT").toUpperCase();
  const allowedSources = ["NFC", "QR", "SHARE", "DIRECT", "UNKNOWN"];
  const source = allowedSources.includes(sourceInput) ? sourceInput : "DIRECT";

  const res = await pool.query<LeadRecord>(
    `INSERT INTO leads (
       owner_user_id,
       card_id,
       name,
       company_name,
       contact_number,
       contact_number_normalized,
       email,
       status,
       source,
       first_submitted_at,
       last_submitted_at,
       submission_count,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, 'NEW', $8, NOW(), NOW(), 1, NOW(), NOW()
     )
     ON CONFLICT (owner_user_id, contact_number_normalized) DO UPDATE SET
       submission_count = leads.submission_count + 1,
       last_submitted_at = NOW(),
       updated_at = NOW(),
       name = EXCLUDED.name,
       company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), leads.company_name),
       email = COALESCE(NULLIF(EXCLUDED.email, ''), leads.email),
       source = EXCLUDED.source
     RETURNING
       id,
       owner_user_id,
       card_id,
       name,
       company_name,
       contact_number,
       contact_number_normalized,
       email,
       status,
       source,
       first_submitted_at,
       last_submitted_at,
       submission_count,
       created_at,
       updated_at`,
    [
      input.ownerUserId,
      input.cardId,
      name,
      companyName,
      contactNumber,
      contactNumberNormalized,
      email,
      source,
    ]
  );

  const lead = res.rows[0];
  const isNew = lead.submission_count === 1;

  return {
    lead,
    isNew,
    submissionCount: lead.submission_count,
  };
}
