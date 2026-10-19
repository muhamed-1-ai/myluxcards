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
  leadId?: string | null;
  lines: InvoiceLineInput[];
  userId?: string;
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
    // 1. Generate sequential invoice number
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounting_invoices WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const seq = parseInt(countRes.rows[0]?.count || "0", 10) + 1;
    const year = new Date().getFullYear();
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
          notes, terms, share_token, lead_id, posted_journal_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $10, $11, $12, $13, $14, $15, $16)
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
    SELECT inv.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone
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
): Promise<{ invoice: InvoiceRow; lines: InvoiceLineRow[] } | null> {
  const invRes = await pool.query<InvoiceRow>(
    `SELECT inv.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone
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
  return { invoice, lines: linesRes.rows };
}

export async function getPublicInvoiceByShareToken(shareToken: string): Promise<{ invoice: Partial<InvoiceRow>; lines: InvoiceLineRow[] } | null> {
  const invRes = await pool.query<InvoiceRow>(
    `SELECT inv.id, inv.invoice_number, inv.issue_date, inv.due_date, inv.status, inv.currency,
            inv.subtotal_minor, inv.discount_minor, inv.tax_minor, inv.total_minor, inv.amount_paid_minor, inv.amount_due_minor,
            inv.notes, inv.terms, c.name as contact_name
     FROM accounting_invoices inv
     LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
     WHERE inv.share_token = $1
     LIMIT 1`,
    [shareToken]
  );
  const invoice = invRes.rows[0];
  if (!invoice) return null;

  const linesRes = await pool.query<InvoiceLineRow>(
    `SELECT id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order
     FROM accounting_invoice_lines
     WHERE invoice_id = $1
     ORDER BY sort_order ASC`,
    [invoice.id]
  );
  return { invoice, lines: linesRes.rows };
}
