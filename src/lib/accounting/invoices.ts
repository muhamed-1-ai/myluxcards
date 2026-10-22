import "server-only";
import { randomBytes } from "node:crypto";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  InvoiceRow,
  InvoiceLineRow,
  DirectSaleRow,
  InvoiceStatus,
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
}

export interface CreateInvoiceInput {
  workspaceId: string;
  contactId?: string | null;
  issueDate?: string;
  dueDate: string;
  status?: InvoiceStatus; // DRAFT or ISSUED
  notes?: string | null;
  terms?: string | null;
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
  date?: string;
  lines: InvoiceLineInput[];
  financialAccountId: string;
  paymentMethod?: string;
  notes?: string | null;
  leadId?: string | null;
  userId?: string;
  idempotencyKey?: string;
}

function calculateInvoiceTotals(lines: InvoiceLineInput[]) {
  let subtotalMinor = 0;
  let discountMinor = 0;
  let taxMinor = 0;
  let totalMinor = 0;

  const calculatedLines = lines.map((line, idx) => {
    const qty = Math.max(0.01, line.quantity || 1);
    const lineSubtotal = Math.round(qty * line.unitPriceMinor);
    const lineDiscount = Math.max(0, line.discountMinor || 0);
    const lineTax = Math.max(0, line.taxMinor || 0);
    const lineTotal = Math.max(0, lineSubtotal - lineDiscount + lineTax);

    subtotalMinor += lineSubtotal;
    discountMinor += lineDiscount;
    taxMinor += lineTax;
    totalMinor += lineTotal;

    return {
      ...line,
      quantity: qty,
      unitPriceMinor: line.unitPriceMinor,
      discountMinor: lineDiscount,
      taxMinor: lineTax,
      totalMinor: lineTotal,
      sortOrder: idx + 1,
    };
  });

  return { subtotalMinor, discountMinor, taxMinor, totalMinor, calculatedLines };
}

/**
 * Creates an Invoice (Draft or Issued).
 * If status is ISSUED, atomically posts to general ledger (AR Dr, Revenue Cr).
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
    // 1. Generate sequential invoice number with concurrency lock
    await db.query(`SELECT id FROM accounting_workspaces WHERE id = $1 FOR UPDATE`, [input.workspaceId]);
    const year = new Date().getFullYear();
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounting_invoices WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const maxSeqRes = await db.query<{ max_seq: string }>(
      `SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(invoice_number, '^INV-[0-9]+-', ''), '') AS integer)), 0) as max_seq
       FROM accounting_invoices
       WHERE workspace_id = $1 AND invoice_number LIKE $2`,
      [input.workspaceId, `INV-${year}-%`]
    );
    const countSeq = parseInt(countRes.rows[0]?.count || "0", 10) + 1;
    const parsedMaxSeq = parseInt(maxSeqRes.rows[0]?.max_seq || "0", 10) + 1;
    const seq = Math.max(countSeq, parsedMaxSeq);
    const invoiceNumber = `INV-${year}-${seq.toString().padStart(4, "0")}`;
    const shareToken = randomBytes(16).toString("hex");

    let postedJournalEntryId: string | null = null;

    // 2. Accrual Posting if issued immediately
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
    }

    // 3. Insert Invoice
    const invRes = await db.query<InvoiceRow>(
      `INSERT INTO accounting_invoices
         (workspace_id, invoice_number, contact_id, issue_date, due_date, status,
          subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor,
          notes, terms, internal_notes, share_token, lead_id, posted_journal_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $10, $11, $12, $13, $14, $15, $16, $17)
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
        input.terms || null,
        input.internalNotes || null,
        shareToken,
        input.leadId || null,
        postedJournalEntryId,
        input.userId || null,
      ]
    );
    const invoice = invRes.rows[0];

    // 4. Insert Line Items
    const insertedLines: InvoiceLineRow[] = [];
    for (const l of calculatedLines) {
      const lineRes = await db.query<InvoiceLineRow>(
        `INSERT INTO accounting_invoice_lines
           (invoice_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [invoice.id, l.productId || null, l.description, l.quantity, l.unitPriceMinor, l.discountMinor, l.taxMinor, l.totalMinor, l.sortOrder]
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
             (invoice_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [existing.id, l.productId || null, l.description, l.quantity, l.unitPriceMinor, l.discountMinor, l.taxMinor, l.totalMinor, l.sortOrder]
        );
      }
    }

    let status: InvoiceStatus = existing.status;
    let postedJournalEntryId = existing.posted_journal_entry_id;

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
    }

    const updatedRes = await db.query<InvoiceRow>(
      `UPDATE accounting_invoices
       SET contact_id = $1, issue_date = $2, due_date = $3, status = $4,
           subtotal_minor = $5, discount_minor = $6, tax_minor = $7, total_minor = $8,
           amount_due_minor = $8, notes = $9, terms = $10, internal_notes = $11,
           posted_journal_entry_id = $12, updated_at = NOW()
       WHERE id = $13 AND workspace_id = $14
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
  if (!input.lines || input.lines.length === 0) {
    throw new Error("Direct sale must have at least one line item.");
  }

  const { totalMinor } = calculateInvoiceTotals(input.lines);
  const date = input.date || new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();

  return withTransaction(async (db) => {
    // 1. Check idempotency
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

    // 2. Post atomic journal: Cash/Bank Dr, Revenue Cr
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
        input.contactId || null,
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

export async function listInvoices(
  workspaceId: string,
  options?: { status?: InvoiceStatus; contactId?: string; search?: string }
): Promise<InvoiceRow[]> {
  let sql = `
    SELECT inv.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone, c.address as contact_address
    FROM accounting_invoices inv
    LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
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
  const res = await pool.query<InvoiceRow>(sql, params);
  return res.rows;
}

export async function getInvoiceById(
  workspaceId: string,
  invoiceId: string
): Promise<{
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
  contact: InvoiceContactDetail | null;
  payments: InvoicePaymentDetail[];
} | null> {
  const invRes = await pool.query<InvoiceRow>(
    `SELECT inv.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone, c.address as contact_address
     FROM accounting_invoices inv
     LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
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

  return {
    invoice,
    lines: linesRes.rows,
    contact,
    payments: paymentsRes.rows,
  };
}

export async function getPublicInvoiceByShareToken(
  shareToken: string
): Promise<{
  invoice: Partial<InvoiceRow>;
  lines: InvoiceLineRow[];
  contact: InvoiceContactDetail | null;
  workspace: { name: string; currency: string } | null;
} | null> {
  const invRes = await pool.query<InvoiceRow & { workspace_name: string; workspace_currency: string }>(
    `SELECT inv.id, inv.invoice_number, inv.issue_date, inv.due_date, inv.status, inv.currency,
            inv.subtotal_minor, inv.discount_minor, inv.tax_minor, inv.total_minor, inv.amount_paid_minor, inv.amount_due_minor,
            inv.notes, inv.terms,
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
    `SELECT id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order
     FROM accounting_invoice_lines
     WHERE invoice_id = $1
     ORDER BY sort_order ASC`,
    [row.id]
  );

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
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      contact_phone: row.contact_phone,
      contact_address: row.contact_address,
    },
    lines: linesRes.rows,
    contact: row.contact_id
      ? {
          id: row.contact_id,
          name: row.contact_name || "",
          email: row.contact_email || null,
          phone: row.contact_phone || null,
          address: row.contact_address || null,
        }
      : null,
    workspace: {
      name: row.workspace_name,
      currency: row.workspace_currency,
    },
  };
}
