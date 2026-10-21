import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  PaymentRow,
  PaymentAllocationRow,
  PaymentType,
  PaymentMethod,
  InvoiceRow,
} from "./types";
import { postJournalEntry, reverseJournalEntry } from "./ledger";
import { getFinancialAccountByCode, getFinancialAccountById } from "./accounts";

export interface InvoiceAllocationInput {
  invoiceId: string;
  amountMinor: number;
}

export interface RecordPaymentInput {
  workspaceId: string;
  type?: PaymentType; // IN or OUT (default: IN)
  contactId?: string | null;
  financialAccountId: string;
  amountMinor: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  allocations?: InvoiceAllocationInput[];
  invoiceId?: string | null;
  idempotencyKey?: string | null;
  userId?: string;
}

/**
 * Record an atomic Payment Collection or Disbursement.
 *
 * Guarantees:
 * 1. Exact monetary validation (amount > 0, non-overpayment).
 * 2. Automatic invoiceId to allocations mapping.
 * 3. Server-side idempotency and rapid double-submit protection.
 * 4. Row-level locks (FOR UPDATE) preventing concurrent double collections.
 * 5. Atomic issuance for DRAFT invoices upon collection (AR Dr, Revenue Cr) without duplicate revenue.
 * 6. Balanced ledger postings (Bank Dr, AR Cr for collection; AP Dr, Bank Cr for disbursement).
 * 7. Synchronized invoice balances (amount_paid_minor, amount_due_minor, status).
 * 8. All writes commit together or roll back together.
 */
export async function recordPayment(
  input: RecordPaymentInput,
  client?: Queryable
): Promise<{ payment: PaymentRow; allocations: PaymentAllocationRow[] }> {
  const paymentType: PaymentType = input.type || "IN";
  const amountMinor = Math.round(Number(input.amountMinor));
  if (isNaN(amountMinor) || amountMinor <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  // Normalize single invoiceId into allocations array
  let allocations: InvoiceAllocationInput[] = input.allocations ? [...input.allocations] : [];
  if (allocations.length === 0 && input.invoiceId) {
    allocations = [{ invoiceId: input.invoiceId, amountMinor }];
  }

  // Validate allocation amounts
  if (allocations.length > 0) {
    let allocatedTotal = 0;
    for (const a of allocations) {
      const aAmt = Math.round(Number(a.amountMinor));
      if (isNaN(aAmt) || aAmt <= 0) {
        throw new Error("Allocation amount must be greater than zero.");
      }
      allocatedTotal += aAmt;
    }
    if (allocatedTotal > amountMinor) {
      throw new Error(
        `Total allocated across invoices (₹${(allocatedTotal / 100).toFixed(2)}) exceeds payment amount (₹${(amountMinor / 100).toFixed(2)}).`
      );
    }
  }

  // 1. Durable idempotency guard via journal entry key
  if (input.idempotencyKey) {
    const existingJE = await pool.query<{ id: string }>(
      `SELECT id FROM accounting_journal_entries WHERE workspace_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [input.workspaceId, input.idempotencyKey]
    );
    if (existingJE.rows.length > 0) {
      const existingPay = await pool.query<PaymentRow>(
        `SELECT * FROM accounting_payments WHERE workspace_id = $1 AND journal_entry_id = $2 LIMIT 1`,
        [input.workspaceId, existingJE.rows[0].id]
      );
      if (existingPay.rows.length > 0) {
        const existingAllocs = await pool.query<PaymentAllocationRow>(
          `SELECT * FROM accounting_payment_allocations WHERE payment_id = $1`,
          [existingPay.rows[0].id]
        );
        return { payment: existingPay.rows[0], allocations: existingAllocs.rows };
      }
    }
  }

  // 2. Double-Click / Duplicate Submit Guard (within 5 seconds for single invoice)
  if (allocations.length === 1) {
    const recentDup = await pool.query<PaymentRow>(
      `SELECT p.* FROM accounting_payments p
       JOIN accounting_payment_allocations a ON a.payment_id = p.id
       WHERE p.workspace_id = $1
         AND a.invoice_id = $2
         AND p.amount_minor = $3
         AND p.created_at >= NOW() - INTERVAL '5 seconds'
       ORDER BY p.created_at DESC LIMIT 1`,
      [input.workspaceId, allocations[0].invoiceId, amountMinor]
    );
    if (recentDup.rows.length > 0) {
      const existingAllocs = await pool.query<PaymentAllocationRow>(
        `SELECT * FROM accounting_payment_allocations WHERE payment_id = $1`,
        [recentDup.rows[0].id]
      );
      return { payment: recentDup.rows[0], allocations: existingAllocs.rows };
    }
  }

  const paymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();

  const runner = async (db: Queryable) => {
    // 3. Validate financial account
    const finAcc = await getFinancialAccountById(input.workspaceId, input.financialAccountId, db);
    if (!finAcc) throw new Error("Deposit/disbursement financial account not found in workspace.");

    // 4. Validate and lock invoices (if Money In collection with allocations)
    const lockedInvoices: Record<string, InvoiceRow> = {};
    if (paymentType === "IN" && allocations.length > 0) {
      for (const alloc of allocations) {
        const invRes = await db.query<InvoiceRow>(
          `SELECT * FROM accounting_invoices WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
          [alloc.invoiceId, input.workspaceId]
        );
        const inv = invRes.rows[0];
        if (!inv) throw new Error(`Invoice ${alloc.invoiceId} not found in workspace.`);
        if (inv.status === "VOID") throw new Error(`Cannot collect payment on a voided invoice (${inv.invoice_number}).`);
        if (inv.status === "PAID" || Number(inv.amount_due_minor) <= 0) {
          throw new Error(`Invoice ${inv.invoice_number} is already fully paid.`);
        }
        if (alloc.amountMinor > Number(inv.amount_due_minor)) {
          throw new Error(
            `Overpayment prevented: Cannot collect ₹${(alloc.amountMinor / 100).toFixed(2)} on invoice ${inv.invoice_number} which only has ₹${(Number(inv.amount_due_minor) / 100).toFixed(2)} remaining due.`
          );
        }

        // Handle DRAFT Invoice: Atomically issue it before collection
        if (inv.status === "DRAFT") {
          const arAcc = await getFinancialAccountByCode(input.workspaceId, "1200", db);
          const revAcc = await getFinancialAccountByCode(input.workspaceId, "4000", db);
          if (!arAcc || !revAcc) throw new Error("Chart of accounts missing AR (1200) or Revenue (4000).");

          const { entry: saleEntry } = await postJournalEntry(
            {
              workspaceId: input.workspaceId,
              entryType: "SALE",
              entryDate: inv.issue_date || paymentDate,
              description: `Invoice ${inv.invoice_number} issued upon collection`,
              reference: inv.invoice_number,
              sourceType: "INVOICE",
              sourceId: inv.id,
              lines: [
                { financialAccountId: arAcc.id, debitMinor: Number(inv.total_minor), creditMinor: 0, description: "Accounts Receivable" },
                { financialAccountId: revAcc.id, debitMinor: 0, creditMinor: Number(inv.total_minor), description: "Sales Revenue" },
              ],
              userId: input.userId,
            },
            db
          );

          if (inv.contact_id) {
            await db.query(
              `UPDATE accounting_contacts
               SET total_receivable_minor = total_receivable_minor + $1, updated_at = NOW()
               WHERE id = $2 AND workspace_id = $3`,
              [inv.total_minor, inv.contact_id, input.workspaceId]
            );
          }

          await db.query(
            `UPDATE accounting_invoices
             SET status = 'ISSUED', posted_journal_entry_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [saleEntry.id, inv.id]
          );
          inv.status = "ISSUED";
          inv.posted_journal_entry_id = saleEntry.id;
        }

        lockedInvoices[alloc.invoiceId] = inv;
      }
    }

    // 5. Generate sequential payment number
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounting_payments WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const seq = parseInt(countRes.rows[0]?.count || "0", 10) + 1;
    const prefix = paymentType === "IN" ? "PAY-IN" : "PAY-OUT";
    const paymentNumber = `${prefix}-${year}-${seq.toString().padStart(4, "0")}`;

    let postedJournalEntryId: string | null = null;
    const primaryContactId =
      input.contactId ||
      (allocations.length > 0 && lockedInvoices[allocations[0].invoiceId]
        ? lockedInvoices[allocations[0].invoiceId].contact_id
        : null);

    // 6. Post balanced ledger entries for collection / disbursement
    if (paymentType === "IN") {
      // Debit Cash/Bank, Credit Accounts Receivable (1200)
      const arAcc = await getFinancialAccountByCode(input.workspaceId, "1200", db);
      if (!arAcc) throw new Error("Accounts Receivable account (1200) not found.");

      const { entry } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "PAYMENT_COLLECTION",
          entryDate: paymentDate,
          description: input.notes || `Payment collection ${paymentNumber}`,
          reference: paymentNumber,
          sourceType: "PAYMENT",
          idempotencyKey: input.idempotencyKey || undefined,
          lines: [
            { financialAccountId: finAcc.id, debitMinor: amountMinor, creditMinor: 0, description: "Funds Received" },
            { financialAccountId: arAcc.id, debitMinor: 0, creditMinor: amountMinor, description: "Accounts Receivable Settled" },
          ],
          userId: input.userId,
        },
        db
      );
      postedJournalEntryId = entry.id;

      if (primaryContactId) {
        await db.query(
          `UPDATE accounting_contacts
           SET total_receivable_minor = GREATEST(0, total_receivable_minor - $1), updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [amountMinor, primaryContactId, input.workspaceId]
        );
      }
    } else {
      // Money Out / Vendor payment: Debit AP (2000), Credit Cash/Bank
      const apAcc = await getFinancialAccountByCode(input.workspaceId, "2000", db);
      if (!apAcc) throw new Error("Accounts Payable account (2000) not found.");

      const { entry } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "PAYMENT_DISBURSEMENT",
          entryDate: paymentDate,
          description: input.notes || `Disbursement ${paymentNumber}`,
          reference: paymentNumber,
          sourceType: "PAYMENT",
          idempotencyKey: input.idempotencyKey || undefined,
          lines: [
            { financialAccountId: apAcc.id, debitMinor: amountMinor, creditMinor: 0, description: "Accounts Payable Settled" },
            { financialAccountId: finAcc.id, debitMinor: 0, creditMinor: amountMinor, description: "Funds Disbursed" },
          ],
          userId: input.userId,
        },
        db
      );
      postedJournalEntryId = entry.id;

      if (primaryContactId) {
        await db.query(
          `UPDATE accounting_contacts
           SET total_payable_minor = GREATEST(0, total_payable_minor - $1), updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [amountMinor, primaryContactId, input.workspaceId]
        );
      }
    }

    // 7. Insert Payment record
    const payRes = await db.query<PaymentRow>(
      `INSERT INTO accounting_payments
         (workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor, payment_date, payment_method, reference_number, notes, journal_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.workspaceId,
        paymentNumber,
        paymentType,
        primaryContactId || null,
        input.financialAccountId,
        amountMinor,
        paymentDate,
        input.paymentMethod || "BANK_TRANSFER",
        input.referenceNumber || null,
        input.notes || null,
        postedJournalEntryId,
        input.userId || null,
      ]
    );
    const payment = payRes.rows[0];

    // 8. Process Invoice Allocations & Update Status
    const insertedAllocations: PaymentAllocationRow[] = [];
    for (const alloc of allocations) {
      if (alloc.amountMinor <= 0) continue;
      const invoice = lockedInvoices[alloc.invoiceId];
      const dueMinor = Number(invoice.amount_due_minor);
      const newPaid = Number(invoice.amount_paid_minor) + alloc.amountMinor;
      const newDue = dueMinor - alloc.amountMinor;
      const newStatus = newDue === 0 ? "PAID" : "PARTIALLY_PAID";

      await db.query(
        `UPDATE accounting_invoices
         SET amount_paid_minor = $1, amount_due_minor = $2, status = $3, updated_at = NOW()
         WHERE id = $4`,
        [newPaid, newDue, newStatus, invoice.id]
      );

      // If invoice is fully paid, dismiss any active due reminders
      if (newDue === 0) {
        await db.query(
          `UPDATE accounting_reminders
           SET status = 'DISMISSED', dismissed_at = NOW(), updated_at = NOW()
           WHERE entity_id = $1 AND entity_type = 'INVOICE' AND status = 'PENDING'`,
          [invoice.id]
        );
      }

      const allocRes = await db.query<PaymentAllocationRow>(
        `INSERT INTO accounting_payment_allocations (payment_id, invoice_id, allocated_minor)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [payment.id, invoice.id, alloc.amountMinor]
      );
      insertedAllocations.push(allocRes.rows[0]);
    }

    return { payment, allocations: insertedAllocations };
  };

  if (client) {
    return runner(client);
  }
  return withTransaction(runner);
}

/**
 * Traceably reverse an existing payment.
 * Swaps ledger debits and credits, restores invoice balance/status,
 * restores contact balances, and logs audit reason.
 */
export async function reversePayment(
  workspaceId: string,
  paymentId: string,
  reason: string,
  userId?: string,
  client?: Queryable
): Promise<{ payment: PaymentRow; allocations: PaymentAllocationRow[] }> {
  const runner = async (db: Queryable) => {
    // 1. Fetch payment with lock
    const payRes = await db.query<PaymentRow>(
      `SELECT * FROM accounting_payments WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [paymentId, workspaceId]
    );
    const payment = payRes.rows[0];
    if (!payment) throw new Error("Payment record not found.");
    if (payment.notes && payment.notes.includes("[REVERSED:")) {
      throw new Error("Payment has already been reversed.");
    }

    // 2. Reverse journal entry if posted
    if (payment.journal_entry_id) {
      await reverseJournalEntry(workspaceId, payment.journal_entry_id, reason, userId, db);
    }

    // 3. Fetch allocations and reverse each invoice balance
    const allocRes = await db.query<PaymentAllocationRow>(
      `SELECT * FROM accounting_payment_allocations WHERE payment_id = $1`,
      [paymentId]
    );

    for (const alloc of allocRes.rows) {
      const invRes = await db.query<InvoiceRow>(
        `SELECT * FROM accounting_invoices WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [alloc.invoice_id, workspaceId]
      );
      const inv = invRes.rows[0];
      if (inv) {
        const allocatedAmt = Number(alloc.allocated_minor);
        const newPaid = Math.max(0, Number(inv.amount_paid_minor) - allocatedAmt);
        const newDue = Math.min(Number(inv.total_minor), Number(inv.amount_due_minor) + allocatedAmt);
        const newStatus = newPaid === 0 ? "ISSUED" : "PARTIALLY_PAID";

        await db.query(
          `UPDATE accounting_invoices
           SET amount_paid_minor = $1, amount_due_minor = $2, status = $3, updated_at = NOW()
           WHERE id = $4`,
          [newPaid, newDue, newStatus, inv.id]
        );
      }
    }

    // 4. Restore contact receivable/payable balance
    if (payment.contact_id) {
      if (payment.type === "IN") {
        await db.query(
          `UPDATE accounting_contacts
           SET total_receivable_minor = total_receivable_minor + $1, updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [payment.amount_minor, payment.contact_id, workspaceId]
        );
      } else {
        await db.query(
          `UPDATE accounting_contacts
           SET total_payable_minor = total_payable_minor + $1, updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [payment.amount_minor, payment.contact_id, workspaceId]
        );
      }
    }

    // 5. Mark payment notes with traceable reversal tag
    const notesWithReversal = `${payment.notes || ""}\n[REVERSED: ${reason}]`.trim();
    const updatedPay = await db.query<PaymentRow>(
      `UPDATE accounting_payments
       SET notes = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [notesWithReversal, payment.id]
    );

    return { payment: updatedPay.rows[0], allocations: allocRes.rows };
  };

  if (client) {
    return runner(client);
  }
  return withTransaction(runner);
}

export async function listPayments(
  workspaceId: string,
  options?: { type?: PaymentType; contactId?: string }
): Promise<PaymentRow[]> {
  let sql = `
    SELECT p.*, c.name as contact_name, fa.name as account_name
    FROM accounting_payments p
    LEFT JOIN accounting_contacts c ON c.id = p.contact_id
    LEFT JOIN accounting_financial_accounts fa ON fa.id = p.financial_account_id
    WHERE p.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];

  if (options?.type) {
    params.push(options.type);
    sql += ` AND p.type = $${params.length}`;
  }
  if (options?.contactId) {
    params.push(options.contactId);
    sql += ` AND p.contact_id = $${params.length}`;
  }

  sql += ` ORDER BY p.payment_date DESC, p.created_at DESC`;
  const res = await pool.query<PaymentRow>(sql, params);
  return res.rows;
}
