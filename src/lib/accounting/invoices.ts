import "server-only";
import { randomBytes } from "node:crypto";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  InvoiceRow,
  InvoiceLineRow,
  DirectSaleRow,
  InvoiceStatus,
  InvoiceSettingsRow,
  SellerSnapshot,
  CustomerSnapshot,
  WarrantyType,
} from "./types";
import { postJournalEntry } from "./ledger";
import { getFinancialAccountByCode } from "./accounts";

export interface InvoiceLineInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxMinor?: number;
  model?: string | null;
  sku?: string | null;
  serialNumber?: string | null;
  warrantyType?: WarrantyType;
  warrantyProvider?: string | null;
  warrantyDurationMonths?: number | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  warrantyCoverage?: string | null;
  warrantyExclusions?: string | null;
  warrantyContact?: string | null;
  serviceStartDate?: string | null;
  serviceEndDate?: string | null;
}

export interface CreateInvoiceInput {
  workspaceId: string;
  contactId?: string | null;
  issueDate?: string;
  dueDate: string;
  status?: InvoiceStatus; // DRAFT or ISSUED
  notes?: string | null;
  terms?: string | null;
  warrantyTerms?: string | null;
  internalNotes?: string | null;
  leadId?: string | null;
  lines: InvoiceLineInput[];
  userId?: string;
}

export interface UpdateDraftInvoiceInput {
  workspaceId: string;
  invoiceId: string;
  contactId?: string | null;
  issueDate?: string;
  dueDate?: string;
  notes?: string | null;
  terms?: string | null;
  warrantyTerms?: string | null;
  internalNotes?: string | null;
  lines?: InvoiceLineInput[];
  issueNow?: boolean;
  userId?: string;
}

export interface InvoicePaymentDetail {
  id: string;
  payment_number: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  amount_minor: number;
  allocated_minor: number;
  account_name: string | null;
}

export interface InvoiceContactDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface CreateDirectSaleInput {
  workspaceId: string;
  contactId?: string | null;
  customerName?: string | null;
  date?: string;
  lines?: InvoiceLineInput[];
  amountMinor?: number;
  financialAccountId: string;
  paymentMethod?: string;
  notes?: string | null;
  leadId?: string | null;
  userId?: string;
  idempotencyKey?: string;
}

export interface ConvertDirectSaleInput {
  workspaceId: string;
  saleId: string;
  contactId?: string | null;
  lines?: InvoiceLineInput[];
  dueDate?: string;
  notes?: string | null;
  terms?: string | null;
  warrantyTerms?: string | null;
  userId?: string;
}

/**
 * Retrieves the invoice settings for a workspace, falling back to workspace business profile.
 */
export async function getInvoiceSettings(
  workspaceId: string,
  client?: Queryable
): Promise<InvoiceSettingsRow> {
  const db = client || pool;
  const res = await db.query<InvoiceSettingsRow>(
    `SELECT * FROM accounting_invoice_settings WHERE workspace_id = $1`,
    [workspaceId]
  );
  if (res.rows.length > 0) {
    return res.rows[0];
  }

  // Fallback to workspace details
  const wsRes = await db.query<{ name: string; settings: any }>(
    `SELECT name, settings FROM accounting_workspaces WHERE id = $1`,
    [workspaceId]
  );
  const ws = wsRes.rows[0];
  const wsSettings = ws?.settings || {};

  return {
    workspace_id: workspaceId,
    business_name: wsSettings.business_name || ws?.name || null,
    logo_url: wsSettings.logo_url || null,
    address: wsSettings.address || null,
    city: wsSettings.city || null,
    state: wsSettings.state || null,
    postal_code: wsSettings.postal_code || null,
    country: wsSettings.country || null,
    phone: wsSettings.phone || null,
    email: wsSettings.email || null,
    website: wsSettings.website || null,
    tax_id: wsSettings.tax_id || wsSettings.gstin || null,
    tax_label: wsSettings.tax_label || "GSTIN",
    default_notes: wsSettings.payment_instructions || wsSettings.default_notes || null,
    default_terms: wsSettings.default_terms || "Net 30",
    default_warranty_terms: wsSettings.default_warranty_terms || null,
    default_return_terms: wsSettings.default_return_terms || null,
    invoice_prefix: wsSettings.invoice_prefix || "INV",
    next_sequence: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Updates or creates invoice branding and default terms settings.
 */
export async function updateInvoiceSettings(
  workspaceId: string,
  input: {
    business_name?: string | null;
    logo_url?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    tax_id?: string | null;
    tax_label?: string | null;
    default_notes?: string | null;
    default_terms?: string | null;
    default_warranty_terms?: string | null;
    default_return_terms?: string | null;
    invoice_prefix?: string | null;
    next_sequence?: number | null;
  },
  client?: Queryable
): Promise<InvoiceSettingsRow> {
  const db = client || pool;
  const prefix = (input.invoice_prefix || "INV").trim().toUpperCase();
  const taxLabel = (input.tax_label || "GSTIN").trim();
  const defaultTerms = (input.default_terms || "Net 30").trim();
  const nextSeq = Math.max(1, Number(input.next_sequence) || 1);

  const res = await db.query<InvoiceSettingsRow>(
    `INSERT INTO accounting_invoice_settings (
       workspace_id, business_name, logo_url, address, city, state, postal_code, country,
       phone, email, website, tax_id, tax_label, default_notes, default_terms, default_warranty_terms, default_return_terms,
       invoice_prefix, next_sequence, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       business_name = COALESCE(EXCLUDED.business_name, accounting_invoice_settings.business_name),
       logo_url = CASE WHEN $20 THEN EXCLUDED.logo_url ELSE accounting_invoice_settings.logo_url END,
       address = COALESCE(EXCLUDED.address, accounting_invoice_settings.address),
       city = COALESCE(EXCLUDED.city, accounting_invoice_settings.city),
       state = COALESCE(EXCLUDED.state, accounting_invoice_settings.state),
       postal_code = COALESCE(EXCLUDED.postal_code, accounting_invoice_settings.postal_code),
       country = COALESCE(EXCLUDED.country, accounting_invoice_settings.country),
       phone = COALESCE(EXCLUDED.phone, accounting_invoice_settings.phone),
       email = COALESCE(EXCLUDED.email, accounting_invoice_settings.email),
       website = COALESCE(EXCLUDED.website, accounting_invoice_settings.website),
       tax_id = COALESCE(EXCLUDED.tax_id, accounting_invoice_settings.tax_id),
       tax_label = COALESCE(EXCLUDED.tax_label, accounting_invoice_settings.tax_label),
       default_notes = COALESCE(EXCLUDED.default_notes, accounting_invoice_settings.default_notes),
       default_terms = COALESCE(EXCLUDED.default_terms, accounting_invoice_settings.default_terms),
       default_warranty_terms = COALESCE(EXCLUDED.default_warranty_terms, accounting_invoice_settings.default_warranty_terms),
       default_return_terms = COALESCE(EXCLUDED.default_return_terms, accounting_invoice_settings.default_return_terms),
       invoice_prefix = COALESCE(EXCLUDED.invoice_prefix, accounting_invoice_settings.invoice_prefix),
       next_sequence = COALESCE(EXCLUDED.next_sequence, accounting_invoice_settings.next_sequence),
       updated_at = NOW()
     RETURNING *`,
    [
      workspaceId,
      input.business_name !== undefined ? input.business_name : null,
      input.logo_url !== undefined ? input.logo_url : null,
      input.address !== undefined ? input.address : null,
      input.city !== undefined ? input.city : null,
      input.state !== undefined ? input.state : null,
      input.postal_code !== undefined ? input.postal_code : null,
      input.country !== undefined ? input.country : null,
      input.phone !== undefined ? input.phone : null,
      input.email !== undefined ? input.email : null,
      input.website !== undefined ? input.website : null,
      input.tax_id !== undefined ? input.tax_id : null,
      taxLabel,
      input.default_notes !== undefined ? input.default_notes : null,
      defaultTerms,
      input.default_warranty_terms !== undefined ? input.default_warranty_terms : null,
      input.default_return_terms !== undefined ? input.default_return_terms : null,
      prefix,
      nextSeq,
      input.logo_url !== undefined,
    ]
  );
  return res.rows[0];
}

/**
 * Builds immutable snapshots of seller business branding and customer billing info for issued invoices.
 */
export async function buildSnapshots(
  workspaceId: string,
  contactId: string | null | undefined,
  db: Queryable
): Promise<{ sellerSnapshot: SellerSnapshot; customerSnapshot: CustomerSnapshot | null }> {
  const settings = await getInvoiceSettings(workspaceId, db);

  const sellerSnapshot: SellerSnapshot = {
    business_name: settings.business_name || "Business",
    logo_url: settings.logo_url || null,
    address: settings.address || null,
    city: settings.city || null,
    state: settings.state || null,
    postal_code: settings.postal_code || null,
    country: settings.country || null,
    phone: settings.phone || null,
    email: settings.email || null,
    website: settings.website || null,
    tax_id: settings.tax_id || null,
    tax_label: settings.tax_label || "GSTIN",
    default_return_terms: settings.default_return_terms || null,
  };

  let customerSnapshot: CustomerSnapshot | null = null;
  if (contactId) {
    const contactRes = await db.query<{ id: string; name: string; email: string | null; phone: string | null; address: string | null }>(
      `SELECT id, name, email, phone, address FROM accounting_contacts WHERE id = $1 AND workspace_id = $2`,
      [contactId, workspaceId]
    );
    if (contactRes.rows.length > 0) {
      const c = contactRes.rows[0];
      customerSnapshot = {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
      };
    }
  }

  return { sellerSnapshot, customerSnapshot };
}

/**
 * Atomically generates next sequential invoice number with row locking to prevent duplicates.
 */
export async function generateInvoiceNumber(
  workspaceId: string,
  prefix: string,
  db: Queryable
): Promise<string> {
  const period = new Date().getFullYear().toString();
  const cleanPrefix = (prefix || "INV").trim().toUpperCase();

  // Ensure sequence row exists for this workspace and period
  await db.query(
    `INSERT INTO accounting_invoice_sequences (workspace_id, period, next_seq, updated_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (workspace_id, period) DO NOTHING`,
    [workspaceId, period]
  );

  // Lock and retrieve current sequence counter
  const seqRow = (
    await db.query<{ next_seq: number }>(
      `SELECT next_seq FROM accounting_invoice_sequences
       WHERE workspace_id = $1 AND period = $2
       FOR UPDATE`,
      [workspaceId, period]
    )
  ).rows[0];

  const currentCounter = seqRow?.next_seq || 1;

  // Guard against existing numeric suffixes with this prefix
  const sqlMaxRes = await db.query<{ max_seq: number }>(
    `SELECT COALESCE(
       MAX(
         CASE 
           WHEN invoice_number ~ ('^' || $3 || '-' || $2 || '-([0-9]{1,8})$')
           THEN (regexp_match(invoice_number, ('^' || $3 || '-' || $2 || '-([0-9]{1,8})$')))[1]::integer
           ELSE 0
         END
       ), 0
     ) as max_seq
     FROM accounting_invoices
     WHERE workspace_id = $1`,
    [workspaceId, period, cleanPrefix]
  );
  const maxExistingNumeric = sqlMaxRes.rows[0]?.max_seq || 0;

  let candidateSeq = Math.max(currentCounter, maxExistingNumeric + 1);
  let invoiceNumber = `${cleanPrefix}-${period}-${candidateSeq.toString().padStart(4, "0")}`;

  // Loop-check to guarantee zero collision
  while (true) {
    const existingCheck = await db.query(
      `SELECT 1 FROM accounting_invoices WHERE workspace_id = $1 AND invoice_number = $2 LIMIT 1`,
      [workspaceId, invoiceNumber]
    );
    if (existingCheck.rows.length === 0) break;
    candidateSeq++;
    invoiceNumber = `${cleanPrefix}-${period}-${candidateSeq.toString().padStart(4, "0")}`;
  }

  // Advance sequence counter atomically in the sequence table
  await db.query(
    `UPDATE accounting_invoice_sequences
     SET next_seq = $1, updated_at = NOW()
     WHERE workspace_id = $2 AND period = $3`,
    [candidateSeq + 1, workspaceId, period]
  );

  return invoiceNumber;
}

export function calculateInvoiceTotals(lines: InvoiceLineInput[]) {
  let subtotalMinor = 0;
  let discountMinor = 0;
  let taxMinor = 0;
  let totalMinor = 0;

  const calculatedLines = lines.map((line, idx) => {
    const qty = Math.max(0.01, Number(line.quantity) || 1);
    const lineSubtotal = Math.round(qty * Number(line.unitPriceMinor));
    const lineDiscount = Math.max(0, Number(line.discountMinor) || 0);
    const lineTax = Math.max(0, Number(line.taxMinor) || 0);
    const lineTotal = Math.max(0, lineSubtotal - lineDiscount + lineTax);

    subtotalMinor += lineSubtotal;
    discountMinor += lineDiscount;
    taxMinor += lineTax;
    totalMinor += lineTotal;

    // Optional warranty end date computation if duration provided and end date not set
    let computedEndDate = line.warrantyEndDate || null;
    if (line.warrantyType && line.warrantyType !== "NONE" && line.warrantyDurationMonths && !computedEndDate) {
      const sDate = line.warrantyStartDate ? new Date(line.warrantyStartDate) : new Date();
      if (!isNaN(sDate.getTime())) {
        sDate.setMonth(sDate.getMonth() + Number(line.warrantyDurationMonths));
        computedEndDate = sDate.toISOString().slice(0, 10);
      }
    }

    return {
      ...line,
      quantity: qty,
      unitPriceMinor: line.unitPriceMinor,
      discountMinor: lineDiscount,
      taxMinor: lineTax,
      totalMinor: lineTotal,
      sortOrder: idx + 1,
      model: line.model || null,
      sku: line.sku || null,
      serialNumber: line.serialNumber || null,
      warrantyType: (line.warrantyType as WarrantyType) || "NONE",
      warrantyDurationMonths: line.warrantyDurationMonths ? Number(line.warrantyDurationMonths) : null,
      warrantyStartDate: line.warrantyStartDate || null,
      warrantyEndDate: computedEndDate,
      warrantyCoverage: line.warrantyCoverage || null,
      warrantyExclusions: line.warrantyExclusions || null,
      warrantyContact: line.warrantyContact || null,
    };
  });

  return { subtotalMinor, discountMinor, taxMinor, totalMinor, calculatedLines };
}

/**
 * Creates an Invoice (Draft or Issued).
 * If status is ISSUED, atomically posts to general ledger (AR Dr, Revenue Cr) and captures branding snapshots.
 */
export async function createInvoice(
  input: CreateInvoiceInput,
  client?: Queryable
): Promise<{ invoice: InvoiceRow; lines: InvoiceLineRow[] }> {
  if (!input.lines || input.lines.length === 0) {
    throw new Error("Invoice must have at least one line item.");
  }

  const { subtotalMinor, discountMinor, taxMinor, totalMinor, calculatedLines } = calculateInvoiceTotals(input.lines);
  const issueDate = input.issueDate || new Date().toISOString().slice(0, 10);
  const dueDate = input.dueDate || issueDate;
  const status: InvoiceStatus = input.status || "DRAFT";

  return withTransaction(async (db) => {
    // 1. Fetch settings and generate invoice number
    const settings = await getInvoiceSettings(input.workspaceId, db);
    const invoiceNumber = await generateInvoiceNumber(input.workspaceId, settings.invoice_prefix || "INV", db);
    const shareToken = randomBytes(16).toString("hex");

    let postedJournalEntryId: string | null = null;
    let sellerSnapshot: SellerSnapshot | null = null;
    let customerSnapshot: CustomerSnapshot | null = null;

    // 2. Accrual Posting & Snapshots if issued immediately
    if (status === "ISSUED") {
      const arAcc = await getFinancialAccountByCode(input.workspaceId, "1200", db);
      const revAcc = await getFinancialAccountByCode(input.workspaceId, "4000", db);
      if (!arAcc || !revAcc) throw new Error("Chart of accounts missing AR (1200) or Revenue (4000).");

      const { entry } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "SALE",
          entryDate: issueDate,
          description: `Invoice ${invoiceNumber} issued`,
          reference: invoiceNumber,
          sourceType: "INVOICE",
          lines: [
            { financialAccountId: arAcc.id, debitMinor: totalMinor, creditMinor: 0, description: "Accounts Receivable" },
            { financialAccountId: revAcc.id, debitMinor: 0, creditMinor: totalMinor, description: "Sales Revenue" },
          ],
          userId: input.userId,
        },
        db
      );
      postedJournalEntryId = entry.id;

      // Update contact receivable balance
      if (input.contactId) {
        await db.query(
          `UPDATE accounting_contacts
           SET total_receivable_minor = total_receivable_minor + $1, updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [totalMinor, input.contactId, input.workspaceId]
        );
      }

      // Snapshot seller and customer details
      const snaps = await buildSnapshots(input.workspaceId, input.contactId, db);
      sellerSnapshot = snaps.sellerSnapshot;
      customerSnapshot = snaps.customerSnapshot;
    }

    // 3. Insert Invoice
    const invRes = await db.query<InvoiceRow>(
      `INSERT INTO accounting_invoices
         (workspace_id, invoice_number, contact_id, issue_date, due_date, status,
          subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor,
          notes, terms, internal_notes, share_token, lead_id, posted_journal_entry_id,
          seller_snapshot, customer_snapshot, warranty_terms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        input.workspaceId,
        invoiceNumber,
        input.contactId || null,
        issueDate,
        dueDate,
        status,
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        input.notes || null,
        input.terms || settings.default_terms || null,
        input.internalNotes || null,
        shareToken,
        input.leadId || null,
        postedJournalEntryId,
        sellerSnapshot ? JSON.stringify(sellerSnapshot) : null,
        customerSnapshot ? JSON.stringify(customerSnapshot) : null,
        input.warrantyTerms || settings.default_warranty_terms || null,
        input.userId || null,
      ]
    );
    const invoice = invRes.rows[0];

    // 4. Insert Line Items with warranty & SKU details
    const insertedLines: InvoiceLineRow[] = [];
    for (const l of calculatedLines) {
      const lineRes = await db.query<InvoiceLineRow>(
        `INSERT INTO accounting_invoice_lines
           (invoice_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order,
            model, sku, serial_number, warranty_type, warranty_provider, warranty_duration_months, warranty_start_date, warranty_end_date, warranty_coverage, warranty_exclusions, warranty_contact, service_start_date, service_end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         RETURNING *`,
        [
          invoice.id,
          l.productId || null,
          l.description,
          l.quantity,
          l.unitPriceMinor,
          l.discountMinor,
          l.taxMinor,
          l.totalMinor,
          l.sortOrder,
          l.model || null,
          l.sku || null,
          l.serialNumber || null,
          l.warrantyType || "NONE",
          l.warrantyProvider || null,
          l.warrantyDurationMonths || null,
          l.warrantyStartDate || null,
          l.warrantyEndDate || null,
          l.warrantyCoverage || null,
          l.warrantyExclusions || null,
          l.warrantyContact || null,
          l.serviceStartDate || null,
          l.serviceEndDate || null,
        ]
      );
      insertedLines.push(lineRes.rows[0]);
    }

    return { invoice, lines: insertedLines };
  });
}

/**
 * Updates an existing DRAFT invoice, or transitions it to ISSUED.
 * Enforces that non-draft (ISSUED, PARTIALLY_PAID, PAID) invoices cannot be rewritten directly.
 */
export async function updateDraftInvoice(
  input: UpdateDraftInvoiceInput,
  client?: Queryable
): Promise<{ invoice: InvoiceRow; lines: InvoiceLineRow[] }> {
  return withTransaction(async (db) => {
    // 1. Lock invoice row
    const existingRes = await db.query<InvoiceRow>(
      `SELECT * FROM accounting_invoices WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [input.invoiceId, input.workspaceId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new Error("Invoice not found.");
    }
    if (existing.status !== "DRAFT") {
      throw new Error(`Only DRAFT invoices can be edited. Current status is ${existing.status}.`);
    }

    const issueDate = input.issueDate || existing.issue_date;
    const dueDate = input.dueDate || existing.due_date;
    const contactId = input.contactId !== undefined ? input.contactId : existing.contact_id;
    const notes = input.notes !== undefined ? input.notes : existing.notes;
    const terms = input.terms !== undefined ? input.terms : existing.terms;
    const warrantyTerms = input.warrantyTerms !== undefined ? input.warrantyTerms : existing.warranty_terms;
    const internalNotes = input.internalNotes !== undefined ? input.internalNotes : existing.internal_notes;

    let subtotalMinor = Number(existing.subtotal_minor);
    let discountMinor = Number(existing.discount_minor);
    let taxMinor = Number(existing.tax_minor);
    let totalMinor = Number(existing.total_minor);

    if (input.lines && input.lines.length > 0) {
      const totals = calculateInvoiceTotals(input.lines);
      subtotalMinor = totals.subtotalMinor;
      discountMinor = totals.discountMinor;
      taxMinor = totals.taxMinor;
      totalMinor = totals.totalMinor;

      // Replace lines
      await db.query(`DELETE FROM accounting_invoice_lines WHERE invoice_id = $1`, [existing.id]);
      for (const l of totals.calculatedLines) {
        await db.query(
          `INSERT INTO accounting_invoice_lines
             (invoice_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order,
              model, sku, serial_number, warranty_type, warranty_provider, warranty_duration_months, warranty_start_date, warranty_end_date, warranty_coverage, warranty_exclusions, warranty_contact, service_start_date, service_end_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            existing.id,
            l.productId || null,
            l.description,
            l.quantity,
            l.unitPriceMinor,
            l.discountMinor,
            l.taxMinor,
            l.totalMinor,
            l.sortOrder,
            l.model || null,
            l.sku || null,
            l.serialNumber || null,
            l.warrantyType || "NONE",
            l.warrantyProvider || null,
            l.warrantyDurationMonths || null,
            l.warrantyStartDate || null,
            l.warrantyEndDate || null,
            l.warrantyCoverage || null,
            l.warrantyExclusions || null,
            l.warrantyContact || null,
            l.serviceStartDate || null,
            l.serviceEndDate || null,
          ]
        );
      }
    }

    let status: InvoiceStatus = existing.status;
    let postedJournalEntryId = existing.posted_journal_entry_id;
    let sellerSnapshot = existing.seller_snapshot;
    let customerSnapshot = existing.customer_snapshot;

    if (input.issueNow) {
      const arAcc = await getFinancialAccountByCode(input.workspaceId, "1200", db);
      const revAcc = await getFinancialAccountByCode(input.workspaceId, "4000", db);
      if (!arAcc || !revAcc) throw new Error("Chart of accounts missing AR (1200) or Revenue (4000).");

      const { entry } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "SALE",
          entryDate: issueDate,
          description: `Invoice ${existing.invoice_number} issued`,
          reference: existing.invoice_number,
          sourceType: "INVOICE",
          lines: [
            { financialAccountId: arAcc.id, debitMinor: totalMinor, creditMinor: 0, description: "Accounts Receivable" },
            { financialAccountId: revAcc.id, debitMinor: 0, creditMinor: totalMinor, description: "Sales Revenue" },
          ],
          userId: input.userId,
        },
        db
      );
      postedJournalEntryId = entry.id;
      status = "ISSUED";

      if (contactId) {
        await db.query(
          `UPDATE accounting_contacts
           SET total_receivable_minor = total_receivable_minor + $1, updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [totalMinor, contactId, input.workspaceId]
        );
      }

      // Snapshot seller and customer details upon issuance
      const snaps = await buildSnapshots(input.workspaceId, contactId, db);
      sellerSnapshot = snaps.sellerSnapshot;
      customerSnapshot = snaps.customerSnapshot;
    }

    const updatedRes = await db.query<InvoiceRow>(
      `UPDATE accounting_invoices
       SET contact_id = $1, issue_date = $2, due_date = $3, status = $4,
           subtotal_minor = $5, discount_minor = $6, tax_minor = $7, total_minor = $8,
           amount_due_minor = $8, notes = $9, terms = $10, internal_notes = $11,
           posted_journal_entry_id = $12, warranty_terms = $13,
           seller_snapshot = COALESCE($14, seller_snapshot),
           customer_snapshot = COALESCE($15, customer_snapshot),
           updated_at = NOW()
       WHERE id = $16 AND workspace_id = $17
       RETURNING *`,
      [
        contactId || null,
        issueDate,
        dueDate,
        status,
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        notes || null,
        terms || null,
        internalNotes || null,
        postedJournalEntryId,
        warrantyTerms || null,
        sellerSnapshot ? JSON.stringify(sellerSnapshot) : null,
        customerSnapshot ? JSON.stringify(customerSnapshot) : null,
        existing.id,
        input.workspaceId,
      ]
    );

    const linesRes = await db.query<InvoiceLineRow>(
      `SELECT * FROM accounting_invoice_lines WHERE invoice_id = $1 ORDER BY sort_order ASC`,
      [existing.id]
    );

    return { invoice: updatedRes.rows[0], lines: linesRes.rows };
  });
}

export async function issueDraftInvoice(
  workspaceId: string,
  invoiceId: string,
  userId?: string
): Promise<{ invoice: InvoiceRow; lines: InvoiceLineRow[] }> {
  return updateDraftInvoice({
    workspaceId,
    invoiceId,
    issueNow: true,
    userId,
  });
}

/**
 * Direct walk-in sale without lead.
 * Posts directly to ledger: Cash/Bank Debit, Sales Revenue Credit.
 */
export async function createDirectSale(
  input: CreateDirectSaleInput
): Promise<{ sale: DirectSaleRow }> {
  let lines = input.lines;
  const amountMinor = input.amountMinor ? Math.round(Number(input.amountMinor)) : 0;

  if ((!lines || lines.length === 0) && amountMinor > 0) {
    lines = [
      {
        description: input.notes || "Walk-in Direct Sale",
        quantity: 1,
        unitPriceMinor: amountMinor,
      },
    ];
  }

  if (!lines || lines.length === 0) {
    throw new Error("Direct sale must have at least one line item or a valid amount.");
  }

  const { totalMinor } = calculateInvoiceTotals(lines);
  const date = input.date || new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();

  return withTransaction(async (db) => {
    // 1. Resolve or create contact if customerName was entered without contactId
    let contactId = input.contactId || null;
    if (!contactId && input.customerName?.trim()) {
      const existingContact = await db.query<{ id: string }>(
        `SELECT id FROM accounting_contacts WHERE workspace_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
        [input.workspaceId, input.customerName.trim()]
      );
      if (existingContact.rows.length > 0) {
        contactId = existingContact.rows[0].id;
      } else {
        const newContact = await db.query<{ id: string }>(
          `INSERT INTO accounting_contacts (workspace_id, name, type, is_active)
           VALUES ($1, $2, 'CUSTOMER', true)
           RETURNING id`,
          [input.workspaceId, input.customerName.trim()]
        );
        contactId = newContact.rows[0].id;
      }
    }

    // 2. Check idempotency
    if (input.idempotencyKey) {
      const existing = (
        await db.query<DirectSaleRow>(
          `SELECT * FROM accounting_sales WHERE workspace_id = $1 AND notes LIKE $2 LIMIT 1`,
          [input.workspaceId, `%[IDEMPOTENCY:${input.idempotencyKey}]%`]
        )
      ).rows[0];
      if (existing) return { sale: existing };
    }

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounting_sales WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const seq = parseInt(countRes.rows[0]?.count || "0", 10) + 1;
    const saleNumber = `SALE-${year}-${seq.toString().padStart(4, "0")}`;

    const revAcc = await getFinancialAccountByCode(input.workspaceId, "4000", db);
    if (!revAcc) throw new Error("Sales revenue account (4000) not found.");

    // 3. Post atomic journal: Cash/Bank Dr, Revenue Cr
    const { entry } = await postJournalEntry(
      {
        workspaceId: input.workspaceId,
        entryType: "SALE",
        entryDate: date,
        description: `Direct Walk-in Sale ${saleNumber}`,
        reference: saleNumber,
        sourceType: "SALE",
        idempotencyKey: input.idempotencyKey,
        lines: [
          { financialAccountId: input.financialAccountId, debitMinor: totalMinor, creditMinor: 0, description: "Cash / Bank Received" },
          { financialAccountId: revAcc.id, debitMinor: 0, creditMinor: totalMinor, description: "Sales Revenue" },
        ],
        userId: input.userId,
      },
      db
    );

    const notesWithKey = input.idempotencyKey
      ? `${input.notes || ""}\n[IDEMPOTENCY:${input.idempotencyKey}]`.trim()
      : input.notes || null;

    const saleRes = await db.query<DirectSaleRow>(
      `INSERT INTO accounting_sales
         (workspace_id, sale_number, contact_id, date, total_minor, paid_minor, payment_method, financial_account_id, lead_id, notes, status, posted_journal_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, 'COMPLETED', $10, $11)
       RETURNING *`,
      [
        input.workspaceId,
        saleNumber,
        contactId,
        date,
        totalMinor,
        input.paymentMethod || "CASH",
        input.financialAccountId,
        input.leadId || null,
        notesWithKey,
        entry.id,
        input.userId || null,
      ]
    );

    return { sale: saleRes.rows[0] };
  });
}

/**
 * Converts a recorded direct sale into an official invoice without duplicating revenue or journal entries.
 * Validates that item totals reconcile exactly with the recorded direct sale.
 */
export async function convertDirectSaleToInvoice(
  input: ConvertDirectSaleInput
): Promise<{ invoice: InvoiceRow; lines: InvoiceLineRow[]; sale: DirectSaleRow }> {
  return withTransaction(async (db) => {
    // 1. Lock direct sale
    const saleRes = await db.query<DirectSaleRow>(
      `SELECT * FROM accounting_sales WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [input.saleId, input.workspaceId]
    );
    const sale = saleRes.rows[0];
    if (!sale) throw new Error("Direct sale not found.");
    if (sale.status === "VOID" || sale.status === "REFUNDED") {
      throw new Error(`Cannot create invoice for a ${sale.status.toLowerCase()} direct sale.`);
    }
    if (sale.invoice_id) {
      const existingInv = await db.query<{ invoice_number: string }>(
        `SELECT invoice_number FROM accounting_invoices WHERE id = $1`,
        [sale.invoice_id]
      );
      throw new Error(`Direct sale is already linked to invoice ${existingInv.rows[0]?.invoice_number || sale.invoice_id}.`);
    }

    const saleTotalMinor = Number(sale.total_minor);

    // 2. Prepare line items
    let rawLines = input.lines;
    if (!rawLines || rawLines.length === 0) {
      rawLines = [
        {
          description: sale.notes?.split("\n")[0] || `Walk-in Direct Sale (${sale.sale_number})`,
          quantity: 1,
          unitPriceMinor: saleTotalMinor,
        },
      ];
    }

    const totals = calculateInvoiceTotals(rawLines);

    // 3. Validate reconciliation with direct sale total
    if (totals.totalMinor !== saleTotalMinor) {
      throw new Error(
        `Invoice line items total (₹${(totals.totalMinor / 100).toFixed(2)}) must exactly match direct sale total (₹${(saleTotalMinor / 100).toFixed(2)}).`
      );
    }

    // 4. Generate invoice number
    const settings = await getInvoiceSettings(input.workspaceId, db);
    const invoiceNumber = await generateInvoiceNumber(input.workspaceId, settings.invoice_prefix || "INV", db);

    const shareToken = randomBytes(16).toString("hex");
    const issueDate = sale.date || new Date().toISOString().slice(0, 10);
    const dueDate = input.dueDate || issueDate;
    const contactId = input.contactId || sale.contact_id || null;

    // 5. Build snapshots
    const { sellerSnapshot, customerSnapshot } = await buildSnapshots(input.workspaceId, contactId, db);

    // 6. Insert Invoice as PAID without re-posting revenue to general ledger
    const invRes = await db.query<InvoiceRow>(
      `INSERT INTO accounting_invoices
         (workspace_id, invoice_number, contact_id, issue_date, due_date, status,
          subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor,
          notes, terms, internal_notes, share_token, lead_id, posted_journal_entry_id, direct_sale_id,
          warranty_terms, seller_snapshot, customer_snapshot, created_by)
       VALUES ($1, $2, $3, $4, $5, 'PAID', $6, $7, $8, $9, $9, 0, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        input.workspaceId,
        invoiceNumber,
        contactId,
        issueDate,
        dueDate,
        totals.subtotalMinor,
        totals.discountMinor,
        totals.taxMinor,
        totals.totalMinor,
        input.notes || sale.notes || null,
        input.terms || settings.default_terms || null,
        `Converted from Direct Sale ${sale.sale_number}`,
        shareToken,
        sale.lead_id || null,
        sale.posted_journal_entry_id, // Link to original journal entry, NO duplicate posting!
        sale.id,
        input.warrantyTerms || settings.default_warranty_terms || null,
        JSON.stringify(sellerSnapshot),
        customerSnapshot ? JSON.stringify(customerSnapshot) : null,
        input.userId || null,
      ]
    );
    const invoice = invRes.rows[0];

    // 7. Insert line items
    const insertedLines: InvoiceLineRow[] = [];
    for (const l of totals.calculatedLines) {
      const lineRes = await db.query<InvoiceLineRow>(
        `INSERT INTO accounting_invoice_lines
           (invoice_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order,
            model, sku, serial_number, warranty_type, warranty_provider, warranty_duration_months, warranty_start_date, warranty_end_date, warranty_coverage, warranty_exclusions, warranty_contact, service_start_date, service_end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         RETURNING *`,
        [
          invoice.id,
          l.productId || null,
          l.description,
          l.quantity,
          l.unitPriceMinor,
          l.discountMinor,
          l.taxMinor,
          l.totalMinor,
          l.sortOrder,
          l.model || null,
          l.sku || null,
          l.serialNumber || null,
          l.warrantyType || "NONE",
          l.warrantyProvider || null,
          l.warrantyDurationMonths || null,
          l.warrantyStartDate || null,
          l.warrantyEndDate || null,
          l.warrantyCoverage || null,
          l.warrantyExclusions || null,
          l.warrantyContact || null,
          l.serviceStartDate || null,
          l.serviceEndDate || null,
        ]
      );
      insertedLines.push(lineRes.rows[0]);
    }

    // 8. Link sale to invoice
    await db.query(
      `UPDATE accounting_sales SET invoice_id = $1, updated_at = NOW() WHERE id = $2`,
      [invoice.id, sale.id]
    );

    // 9. If contact was added, link sale's contact as well if empty
    if (contactId && !sale.contact_id) {
      await db.query(
        `UPDATE accounting_sales SET contact_id = $1 WHERE id = $2`,
        [contactId, sale.id]
      );
    }

    const updatedSale = (
      await db.query<DirectSaleRow>(`SELECT * FROM accounting_sales WHERE id = $1`, [sale.id])
    ).rows[0];

    return { invoice, lines: insertedLines, sale: updatedSale };
  });
}

/**
 * Lists direct sales for a workspace, including linked invoice info.
 */
export async function listDirectSales(
  workspaceId: string,
  options?: { limit?: number; search?: string }
): Promise<Array<DirectSaleRow & { contact_name?: string; invoice_number?: string; account_name?: string }>> {
  let sql = `
    SELECT s.*, c.name as contact_name, inv.invoice_number, fa.name as account_name
    FROM accounting_sales s
    LEFT JOIN accounting_contacts c ON c.id = s.contact_id
    LEFT JOIN accounting_invoices inv ON inv.id = s.invoice_id
    LEFT JOIN accounting_financial_accounts fa ON fa.id = s.financial_account_id
    WHERE s.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];

  if (options?.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    sql += ` AND (LOWER(s.sale_number) LIKE $${params.length} OR LOWER(COALESCE(c.name, '')) LIKE $${params.length} OR LOWER(COALESCE(s.notes, '')) LIKE $${params.length})`;
  }

  sql += ` ORDER BY s.date DESC, s.created_at DESC`;
  if (options?.limit) {
    params.push(options.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const res = await pool.query(sql, params);
  return res.rows;
}

export async function listInvoices(
  workspaceId: string,
  options?: { status?: InvoiceStatus; contactId?: string; search?: string }
): Promise<Array<InvoiceRow & { direct_sale_number?: string }>> {
  let sql = `
    SELECT inv.*,
           c.name as contact_name, c.email as contact_email, c.phone as contact_phone, c.address as contact_address,
           s.sale_number as direct_sale_number
    FROM accounting_invoices inv
    LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
    LEFT JOIN accounting_sales s ON s.id = inv.direct_sale_id
    WHERE inv.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];

  if (options?.status) {
    params.push(options.status);
    sql += ` AND inv.status = $${params.length}`;
  }
  if (options?.contactId) {
    params.push(options.contactId);
    sql += ` AND inv.contact_id = $${params.length}`;
  }
  if (options?.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    sql += ` AND (LOWER(inv.invoice_number) LIKE $${params.length} OR LOWER(COALESCE(c.name, '')) LIKE $${params.length})`;
  }

  sql += ` ORDER BY inv.issue_date DESC, inv.created_at DESC`;
  const res = await pool.query(sql, params);
  return res.rows;
}

export async function getInvoiceById(
  workspaceId: string,
  invoiceId: string
): Promise<{
  invoice: InvoiceRow & { direct_sale_number?: string };
  lines: InvoiceLineRow[];
  contact: InvoiceContactDetail | null;
  payments: InvoicePaymentDetail[];
  settings: InvoiceSettingsRow;
} | null> {
  const invRes = await pool.query<InvoiceRow & { direct_sale_number?: string }>(
    `SELECT inv.*,
            c.name as contact_name, c.email as contact_email, c.phone as contact_phone, c.address as contact_address,
            s.sale_number as direct_sale_number
     FROM accounting_invoices inv
     LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
     LEFT JOIN accounting_sales s ON s.id = inv.direct_sale_id
     WHERE inv.id = $1 AND inv.workspace_id = $2
     LIMIT 1`,
    [invoiceId, workspaceId]
  );
  const invoice = invRes.rows[0];
  if (!invoice) return null;

  const linesRes = await pool.query<InvoiceLineRow>(
    `SELECT * FROM accounting_invoice_lines WHERE invoice_id = $1 ORDER BY sort_order ASC`,
    [invoiceId]
  );

  const contact: InvoiceContactDetail | null = invoice.contact_id
    ? {
        id: invoice.contact_id,
        name: invoice.contact_name || "",
        email: invoice.contact_email || null,
        phone: invoice.contact_phone || null,
        address: invoice.contact_address || null,
      }
    : null;

  const paymentsRes = await pool.query<InvoicePaymentDetail>(
    `SELECT p.id, p.payment_number, p.payment_date, p.payment_method, p.reference_number, p.notes,
            p.amount_minor, pa.allocated_minor, fa.name as account_name
     FROM accounting_payment_allocations pa
     JOIN accounting_payments p ON p.id = pa.payment_id
     LEFT JOIN accounting_financial_accounts fa ON fa.id = p.financial_account_id
     WHERE pa.invoice_id = $1
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    [invoiceId]
  );

  const settings = await getInvoiceSettings(workspaceId);

  return {
    invoice,
    lines: linesRes.rows,
    contact,
    payments: paymentsRes.rows,
    settings,
  };
}

export async function getPublicInvoiceByShareToken(
  shareToken: string
): Promise<{
  invoice: Partial<InvoiceRow>;
  lines: InvoiceLineRow[];
  contact: InvoiceContactDetail | null;
  seller: SellerSnapshot;
  payments: InvoicePaymentDetail[];
} | null> {
  const invRes = await pool.query<InvoiceRow & { workspace_name: string; workspace_currency: string }>(
    `SELECT inv.*,
            c.id as contact_id, c.name as contact_name, c.email as contact_email, c.phone as contact_phone, c.address as contact_address,
            w.name as workspace_name, w.currency as workspace_currency
     FROM accounting_invoices inv
     JOIN accounting_workspaces w ON w.id = inv.workspace_id
     LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
     WHERE inv.share_token = $1
     LIMIT 1`,
    [shareToken]
  );
  const row = invRes.rows[0];
  if (!row) return null;

  const linesRes = await pool.query<InvoiceLineRow>(
    `SELECT *
     FROM accounting_invoice_lines
     WHERE invoice_id = $1
     ORDER BY sort_order ASC`,
    [row.id]
  );

  const paymentsRes = await pool.query<InvoicePaymentDetail>(
    `SELECT p.id, p.payment_number, p.payment_date, p.payment_method, p.reference_number, p.notes,
            p.amount_minor, pa.allocated_minor, fa.name as account_name
     FROM accounting_payment_allocations pa
     JOIN accounting_payments p ON p.id = pa.payment_id
     LEFT JOIN accounting_financial_accounts fa ON fa.id = p.financial_account_id
     WHERE pa.invoice_id = $1
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    [row.id]
  );

  // Use snapshot if present; else fall back to live workspace settings
  const settings = await getInvoiceSettings(row.workspace_id);
  const seller: SellerSnapshot = row.seller_snapshot || {
    business_name: settings.business_name || row.workspace_name,
    logo_url: settings.logo_url || null,
    address: settings.address || null,
    phone: settings.phone || null,
    email: settings.email || null,
    website: settings.website || null,
    tax_id: settings.tax_id || null,
    tax_label: settings.tax_label || "GSTIN",
  };

  const contact: InvoiceContactDetail | null = (row.customer_snapshot as any) || (row.contact_id
    ? {
        id: row.contact_id,
        name: row.contact_name || "",
        email: row.contact_email || null,
        phone: row.contact_phone || null,
        address: row.contact_address || null,
      }
    : null);

  return {
    invoice: {
      id: row.id,
      invoice_number: row.invoice_number,
      issue_date: row.issue_date,
      due_date: row.due_date,
      status: row.status,
      currency: row.currency,
      subtotal_minor: row.subtotal_minor,
      discount_minor: row.discount_minor,
      tax_minor: row.tax_minor,
      total_minor: row.total_minor,
      amount_paid_minor: row.amount_paid_minor,
      amount_due_minor: row.amount_due_minor,
      notes: row.notes,
      terms: row.terms,
      warranty_terms: row.warranty_terms,
      seller_snapshot: seller,
      customer_snapshot: contact,
      // internal_notes strictly omitted for public customer sharing
    },
    lines: linesRes.rows,
    contact,
    seller,
    payments: paymentsRes.rows,
  };
}
