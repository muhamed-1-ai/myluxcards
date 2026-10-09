import { pool } from "./db/core";
import { normalizePhoneNumber } from "./phone";
import * as XLSX from "xlsx";

export interface StandardImportField {
  key: string;
  header: string;
  aliases: string[];
  group: "basic" | "contact" | "pipeline" | "followup" | "revenue";
  description?: string;
}

export const STANDARD_IMPORT_FIELDS: StandardImportField[] = [
  // Basic Information
  { key: "name", header: "Lead Name", aliases: ["lead name", "name", "full name", "contact name"], group: "basic", description: "Full name of the lead" },
  { key: "companyName", header: "Company Name", aliases: ["company name", "company", "organization"], group: "basic", description: "Company or organization name" },
  { key: "address", header: "Address", aliases: ["address", "location", "city"], group: "basic", description: "Physical or business address" },

  // Contact Information
  { key: "contactNumber", header: "Mobile Number", aliases: ["mobile number", "mobile", "phone", "contact number", "phone number"], group: "contact", description: "Primary mobile or phone number" },
  { key: "email", header: "Email Address", aliases: ["email address", "email", "mail"], group: "contact", description: "Email address" },

  // Pipeline & Assignment
  { key: "assignedTo", header: "Assigned To", aliases: ["assigned to", "assigned user", "owner", "assignee"], group: "pipeline", description: "Email or name of assigned team member" },
  { key: "source", header: "Lead Source", aliases: ["lead source", "source", "channel"], group: "pipeline", description: "Source (e.g. NFC Tap, QR Scan, Website, Referral, Manual)" },
  { key: "lifecycle", header: "Lead Lifecycle", aliases: ["lead lifecycle", "lifecycle", "type"], group: "pipeline", description: "Lifecycle stage (e.g. Lead, Opportunity, Customer)" },
  { key: "stage", header: "Current Lead Stage", aliases: ["current lead stage", "lead stage", "stage", "status"], group: "pipeline", description: "Stage (NEW, CONTACTED, INTERESTED, PROPOSAL, WON, LOST)" },
  { key: "lastRemark", header: "Last Remark", aliases: ["last remark", "remark", "notes", "comment"], group: "pipeline", description: "Initial remark or note" },

  // Revenue & Financial
  { key: "totalAmount", header: "Total Amount", aliases: ["total amount", "amount", "deal value", "revenue"], group: "revenue", description: "Total deal/opportunity amount (numeric)" },
  { key: "advanceAmount", header: "Advance Amount", aliases: ["advance amount", "advance", "paid amount"], group: "revenue", description: "Advance payment amount (numeric)" },
  { key: "balanceAmount", header: "Balance Amount", aliases: ["balance amount", "balance", "pending amount"], group: "revenue", description: "Remaining balance amount (numeric)" },
  { key: "paymentInformation", header: "Payment Information", aliases: ["payment information", "payment info", "payment mode"], group: "revenue", description: "Payment details or mode" },
  { key: "products", header: "Products", aliases: ["products", "product", "services"], group: "revenue", description: "Products or services interested in" },

  // Follow-up Fields
  { key: "nextFollowUpAt", header: "Follow-up Date", aliases: ["follow-up date", "followup date", "next follow up date", "follow up date"], group: "followup", description: "Date format YYYY-MM-DD (e.g. 2026-10-15)" },
  { key: "nextFollowUpTime", header: "Follow-up Time", aliases: ["follow-up time", "followup time", "time"], group: "followup", description: "Time format 10:00 AM or 14:30" },
  { key: "nextFollowUpType", header: "Follow-up Type", aliases: ["follow-up type", "followup type", "activity type"], group: "followup", description: "Call, Meeting, Email, WhatsApp, or Demo" },
  { key: "nextFollowUpNote", header: "Follow-up Note", aliases: ["follow-up note", "followup note", "task note"], group: "followup", description: "Follow-up note or agenda" },
];

export interface DynamicFieldDefinition {
  id: string;
  name: string;
  inputType: string;
  isRequired?: boolean;
  options?: any;
}

export interface WorkspaceContext {
  ownerUserId: string;
  cardId: string;
  users: { id: string; name: string | null; email: string }[];
  dynamicFields: DynamicFieldDefinition[];
  allowedStages: string[];
  allowedSources: string[];
}

/**
 * Loads multi-tenant workspace context for import validation & commit
 */
export async function getWorkspaceImportContext(ownerUserId: string): Promise<WorkspaceContext> {
  // 1. Resolve card ID for owner
  const cardRes = await pool.query<{ id: string }>(
    `SELECT id FROM digital_cards WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [ownerUserId]
  );
  let cardId = cardRes.rows[0]?.id;
  if (!cardId) {
    const slug = `card-${ownerUserId.slice(0, 8)}-${Date.now()}`;
    const newCardRes = await pool.query<{ id: string }>(
      `INSERT INTO digital_cards (owner_id, slug, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id`,
      [ownerUserId, slug]
    );
    cardId = newCardRes.rows[0]?.id;
  }

  // 2. Fetch workspace users for Assigned To resolution
  const usersRes = await pool.query<{ id: string; name: string | null; email: string }>(
    `SELECT id, name, email FROM users WHERE id = $1 OR created_by_admin_id = $1 OR id IN (SELECT owner_user_id FROM users WHERE created_by_admin_id = $1)`,
    [ownerUserId]
  );

  // 3. Fetch active Dynamic Fields for workspace
  const defsRes = await pool.query<DynamicFieldDefinition>(
    `SELECT id, name, input_type as "inputType", is_required as "isRequired", options
     FROM lead_field_definitions
     WHERE (owner_user_id = $1 OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $1))
       AND status = 'ACTIVE'
     ORDER BY sort_order ASC, created_at ASC`,
    [ownerUserId]
  );

  return {
    ownerUserId,
    cardId: cardId || ownerUserId,
    users: usersRes.rows,
    dynamicFields: defsRes.rows,
    allowedStages: ["NEW", "CONTACTED", "INTERESTED", "PROPOSAL", "FOLLOW_UP", "WON", "LOST"],
    allowedSources: ["NFC", "QR", "DIRECT", "MANUAL", "FACEBOOK", "INSTAGRAM", "WEBSITE", "REFERRAL"],
  };
}

/**
 * Sanitizes formula injection strings (=, +, -, @)
 */
export function sanitizeFormulaInjection(val: any): any {
  if (typeof val === "string") {
    const trimmed = val.trim();
    // Allow + followed by digits for international phone numbers (e.g. +919876543210)
    if (/^\+[0-9\s-]{6,}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^[=+@-]/i.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  }
  return val;
}

/**
 * Normalizes header string for safe fuzzy matching
 */
export function normalizeHeader(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Formats a Date object or string to YYYY-MM-DD safely
 */
export function parseDateToIsoString(raw: any): { dateStr: string | null; isValid: boolean } {
  if (!raw) return { dateStr: null, isValid: true };
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return { dateStr: raw.toISOString().slice(0, 10), isValid: true };
  }
  const str = String(raw).trim();
  if (!str) return { dateStr: null, isValid: true };

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const paddedM = String(m).padStart(2, "0");
      const paddedD = String(d).padStart(2, "0");
      return { dateStr: `${y}-${paddedM}-${paddedD}`, isValid: true };
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const y = parseInt(slashMatch[3], 10);
    // Assume DD/MM/YYYY if p1 > 12, else DD/MM/YYYY preferred
    let d = p1;
    let m = p2;
    if (p1 <= 12 && p2 > 12) {
      m = p1;
      d = p2;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const paddedM = String(m).padStart(2, "0");
      const paddedD = String(d).padStart(2, "0");
      return { dateStr: `${y}-${paddedM}-${paddedD}`, isValid: true };
    }
  }

  // Excel Serial Date Number
  if (!isNaN(Number(str))) {
    const num = Number(str);
    if (num > 20000 && num < 60000) {
      const parsed = XLSX.SSF.parse_date_code(num);
      if (parsed) {
        const paddedM = String(parsed.m).padStart(2, "0");
        const paddedD = String(parsed.d).padStart(2, "0");
        return { dateStr: `${parsed.y}-${paddedM}-${paddedD}`, isValid: true };
      }
    }
  }

  return { dateStr: null, isValid: false };
}

export interface RowValidationResult {
  rowNumber: number;
  isEmpty: boolean;
  isValid: boolean;
  errors: { field: string; message: string; value: any }[];
  warnings: { field: string; message: string; value: any }[];
  data: {
    // Standard fields
    name?: string;
    companyName?: string;
    address?: string;
    contactNumber?: string;
    contactNumberNormalized?: string;
    email?: string;
    assignedUserId?: string;
    assignedUserName?: string;
    source?: string;
    lifecycle?: string;
    stage?: string;
    lastRemark?: string;
    totalAmount?: number;
    advanceAmount?: number;
    balanceAmount?: number;
    paymentInformation?: string;
    products?: string;

    // Follow-up
    nextFollowUpAt?: string;
    nextFollowUpTime?: string;
    nextFollowUpType?: string;
    nextFollowUpNote?: string;

    // Dynamic fields map { defId: val }
    dynamicValues: Record<string, any>;
  };
}

/**
 * Validates a single parsed row object against Zappit import schema
 */
export function validateImportRow(
  rawRow: Record<string, any>,
  rowNumber: number,
  headerMapping: Record<string, { type: "standard" | "dynamic"; key: string; def?: DynamicFieldDefinition }>,
  context: WorkspaceContext
): RowValidationResult {
  const errors: { field: string; message: string; value: any }[] = [];
  const warnings: { field: string; message: string; value: any }[] = [];
  const data: RowValidationResult["data"] = { dynamicValues: {} };

  let hasAnyCellData = false;

  // Process mapped headers
  Object.entries(rawRow).forEach(([rawHeader, cellVal]) => {
    if (cellVal === undefined || cellVal === null) return;
    const cleanStr = String(cellVal).trim();
    if (!cleanStr || cleanStr === "null" || cleanStr === "undefined") return;

    const mapping = headerMapping[rawHeader];
    if (!mapping) {
      // Unknown column (recorded once globally during header mapping)
      return;
    }

    hasAnyCellData = true;
    const sanitizedVal = sanitizeFormulaInjection(cleanStr);

    if (mapping.type === "standard") {
      const key = mapping.key;
      switch (key) {
        case "name":
          data.name = sanitizedVal.slice(0, 150);
          break;
        case "companyName":
          data.companyName = sanitizedVal.slice(0, 150);
          break;
        case "address":
          data.address = sanitizedVal.slice(0, 255);
          break;
        case "contactNumber": {
          data.contactNumber = sanitizedVal;
          const phoneRes = normalizePhoneNumber(sanitizedVal);
          if (!phoneRes.isValid) {
            warnings.push({ field: "Mobile Number", message: "Phone number formatting is non-standard but will be imported.", value: sanitizedVal });
            data.contactNumberNormalized = sanitizedVal.replace(/[^0-9+]/g, "");
          } else {
            data.contactNumberNormalized = phoneRes.normalized;
          }
          break;
        }
        case "email": {
          const emailLower = sanitizedVal.toLowerCase();
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(emailLower)) {
            warnings.push({ field: "Email Address", message: "Email format appears unusual.", value: sanitizedVal });
          }
          data.email = emailLower;
          break;
        }
        case "assignedTo": {
          const matchUser = context.users.find(
            (u) =>
              u.email.toLowerCase() === sanitizedVal.toLowerCase() ||
              (u.name && u.name.toLowerCase() === sanitizedVal.toLowerCase())
          );
          if (matchUser) {
            data.assignedUserId = matchUser.id;
            data.assignedUserName = matchUser.name || matchUser.email;
          } else {
            errors.push({ field: "Assigned To", message: `User "${sanitizedVal}" not found in workspace.`, value: sanitizedVal });
          }
          break;
        }
        case "source":
          data.source = sanitizedVal.toUpperCase().replace(/\s+/g, "_");
          break;
        case "lifecycle":
          data.lifecycle = sanitizedVal;
          break;
        case "stage": {
          const normStage = sanitizedVal.toUpperCase().replace(/\s+/g, "_");
          const isValidStage = context.allowedStages.some((st) => st === normStage || st.replace("_", "") === normStage);
          if (isValidStage) {
            data.stage = normStage;
          } else {
            errors.push({ field: "Current Lead Stage", message: `Stage "${sanitizedVal}" does not exist in workspace.`, value: sanitizedVal });
          }
          break;
        }
        case "lastRemark":
          data.lastRemark = sanitizedVal;
          break;
        case "totalAmount": {
          const num = Number(sanitizedVal.replace(/[^0-9.-]/g, ""));
          if (isNaN(num)) {
            errors.push({ field: "Total Amount", message: "Total Amount must be a valid number.", value: sanitizedVal });
          } else {
            data.totalAmount = num;
          }
          break;
        }
        case "advanceAmount": {
          const num = Number(sanitizedVal.replace(/[^0-9.-]/g, ""));
          if (isNaN(num)) {
            errors.push({ field: "Advance Amount", message: "Advance Amount must be a valid number.", value: sanitizedVal });
          } else {
            data.advanceAmount = num;
          }
          break;
        }
        case "balanceAmount": {
          const num = Number(sanitizedVal.replace(/[^0-9.-]/g, ""));
          if (isNaN(num)) {
            errors.push({ field: "Balance Amount", message: "Balance Amount must be a valid number.", value: sanitizedVal });
          } else {
            data.balanceAmount = num;
          }
          break;
        }
        case "paymentInformation":
          data.paymentInformation = sanitizedVal;
          break;
        case "products":
          data.products = sanitizedVal;
          break;
        case "nextFollowUpAt": {
          const { dateStr, isValid } = parseDateToIsoString(sanitizedVal);
          if (!isValid || !dateStr) {
            errors.push({ field: "Follow-up Date", message: "Invalid Follow-up Date (expected YYYY-MM-DD).", value: sanitizedVal });
          } else {
            data.nextFollowUpAt = dateStr;
          }
          break;
        }
        case "nextFollowUpTime":
          data.nextFollowUpTime = sanitizedVal;
          break;
        case "nextFollowUpType": {
          const typeNorm = sanitizedVal.toUpperCase();
          const validTypes = ["CALL", "MEETING", "EMAIL", "WHATSAPP", "DEMO"];
          if (validTypes.includes(typeNorm)) {
            data.nextFollowUpType = typeNorm;
          } else {
            errors.push({ field: "Follow-up Type", message: `Invalid Follow-up Type "${sanitizedVal}" (expected Call, Meeting, Email, WhatsApp, Demo).`, value: sanitizedVal });
          }
          break;
        }
        case "nextFollowUpNote":
          data.nextFollowUpNote = sanitizedVal;
          break;
      }
    } else if (mapping.type === "dynamic" && mapping.def) {
      const def = mapping.def;
      if (def.inputType === "NUMBER") {
        const num = Number(sanitizedVal.replace(/[^0-9.-]/g, ""));
        if (isNaN(num)) {
          errors.push({ field: def.name, message: `Field "${def.name}" must be a valid number.`, value: sanitizedVal });
        } else {
          data.dynamicValues[def.id] = num;
        }
      } else if (def.inputType === "DATE") {
        const { dateStr, isValid } = parseDateToIsoString(sanitizedVal);
        if (!isValid || !dateStr) {
          errors.push({ field: def.name, message: `Field "${def.name}" must be a valid date (YYYY-MM-DD).`, value: sanitizedVal });
        } else {
          data.dynamicValues[def.id] = dateStr;
        }
      } else {
        data.dynamicValues[def.id] = sanitizedVal;
      }
    }
  });

  // Calculate balance amount if total & advance are present
  if (data.totalAmount != null && data.advanceAmount != null && data.balanceAmount == null) {
    data.balanceAmount = data.totalAmount - data.advanceAmount;
  }

  const isEmpty = !hasAnyCellData;
  const isValid = !isEmpty && errors.length === 0;

  return {
    rowNumber,
    isEmpty,
    isValid,
    errors,
    warnings,
    data,
  };
}
