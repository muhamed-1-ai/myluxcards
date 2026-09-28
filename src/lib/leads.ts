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
  sourceType?: string;
  createdFrom?: string;
  profileImage?: string | null;
  assignedUserId?: string | null;
  status?: string;
}

export interface LeadRecord {
  id: string;
  owner_user_id: string;
  card_id: string;
  assigned_user_id: string | null;
  name: string;
  profile_image: string | null;
  company_name: string | null;
  contact_number: string;
  contact_number_normalized: string;
  email: string | null;
  status: string;
  source: string;
  source_type?: string | null;
  created_from?: string | null;
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
    profileImage: string | null;
    assignedUserId: string | null;
    status: string | null;
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

  const uuidRegex = /^[0-9a-f-]{36}$/i;
  let safeAssignedUserId: string | null = null;
  if (input.assignedUserId && typeof input.assignedUserId === "string" && uuidRegex.test(input.assignedUserId)) {
    safeAssignedUserId = input.assignedUserId;
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
      profileImage: input.profileImage || null,
      assignedUserId: safeAssignedUserId,
      status: input.status || null,
    },
  };
}

/**
 * Upserts a Lead scoped to (ownerUserId, contactNumberNormalized).
 * Multi-tenant safe. Overwrite-protected for empty optional fields.
 */
export async function upsertLead(input: CreateLeadInput): Promise<UpsertLeadResult> {
  const uuidRegex = /^[0-9a-f-]{36}$/i;
  if (!input.ownerUserId || typeof input.ownerUserId !== "string" || !uuidRegex.test(input.ownerUserId)) {
    throw new Error("Invalid owner user ID. Must be a valid UUID.");
  }

  const validation = validateLeadInput(input);
  if (!validation.valid || !validation.sanitized) {
    throw new Error(Object.values(validation.errors)[0] || "Invalid lead data.");
  }

  const { name, companyName, contactNumber, contactNumberNormalized, email, profileImage, assignedUserId, status } = validation.sanitized;
  const source = (input.source || "NPC TAP").trim();
  const sourceType = (input.sourceType || "NFC").trim();
  const createdFrom = (input.createdFrom || "PROFILE_SHARE").trim();
  const finalStatus = status || 'NEW';

  const validAssignedUserId = (assignedUserId && uuidRegex.test(assignedUserId)) ? assignedUserId : input.ownerUserId;

  let normKey = contactNumberNormalized || "+91";

  const upperSource = source.toUpperCase();
  const isPublicNpcTap =
    upperSource.includes("NPC") ||
    upperSource.includes("NFC") ||
    upperSource.includes("TAP") ||
    upperSource.includes("SHARE") ||
    createdFrom === "PROFILE_SHARE";

  // For manual creation or NPC Tap / Share submissions, append a unique discriminator to normKey so every submission inserts a distinct lead row
  if (source === "MANUAL" || createdFrom === "DASHBOARD" || isPublicNpcTap) {
    normKey = `${normKey}#npc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  if (isPublicNpcTap) {
    console.log("NPC TAP CREATE", {
      userId: input.ownerUserId,
      workspaceId: input.ownerUserId,
      leadData: {
        ownerUserId: input.ownerUserId,
        cardId: input.cardId,
        name,
        companyName,
        contactNumber,
        email,
        source,
      },
    });
  }

  const res = await pool.query<LeadRecord>(
    `INSERT INTO leads (
       owner_user_id,
       card_id,
       assigned_user_id,
       name,
       profile_image,
       company_name,
       contact_number,
       contact_number_normalized,
       email,
       status,
       source,
       source_type,
       created_from,
       first_submitted_at,
       last_submitted_at,
       submission_count,
       created_at,
       updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), 1, NOW(), NOW()
     )
     ON CONFLICT (owner_user_id, contact_number_normalized) DO UPDATE SET
       submission_count = leads.submission_count + 1,
       last_submitted_at = NOW(),
       updated_at = NOW(),
       name = EXCLUDED.name,
       profile_image = COALESCE(NULLIF(EXCLUDED.profile_image, ''), leads.profile_image),
       company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), leads.company_name),
       email = COALESCE(NULLIF(EXCLUDED.email, ''), leads.email),
       source = EXCLUDED.source,
       source_type = EXCLUDED.source_type,
       created_from = EXCLUDED.created_from,
       status = COALESCE(NULLIF(EXCLUDED.status, ''), leads.status),
       assigned_user_id = COALESCE(EXCLUDED.assigned_user_id, leads.assigned_user_id)
     RETURNING
       id,
       owner_user_id,
       card_id,
       assigned_user_id,
       name,
       profile_image,
       company_name,
       contact_number,
       contact_number_normalized,
       email,
       status,
       source,
       source_type,
       created_from,
       first_submitted_at,
       last_submitted_at,
       submission_count,
       created_at,
       updated_at`,
    [
      input.ownerUserId,
      input.cardId,
      validAssignedUserId,
      name,
      profileImage,
      companyName,
      contactNumber,
      normKey,
      email,
      finalStatus,
      source,
      sourceType,
      createdFrom,
    ]
  );

  const lead = res.rows[0];
  const isNew = lead.submission_count === 1;

  if (isPublicNpcTap) {
    console.log("CREATED LEAD ID", lead.id);
  }

  return {
    lead,
    isNew,
    submissionCount: lead.submission_count,
  };
}
