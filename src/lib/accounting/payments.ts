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
import { postJournalEntry } from "./ledger";
import { getFinancialAccountByCode, getFinancialAccountById } from "./accounts";

export interface InvoiceAllocationInput {
  invoiceId: string;
  amountMinor: number;
}

export interface RecordPaymentInput {
  workspaceId: string;
  type: PaymentType; // IN or OUT
  contactId?: string | null;
  financialAccountId: string;
  amountMinor: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  allocations?: InvoiceAllocationInput[];
  userId?: string;
}

export async function recordPayment(
  input: RecordPaymentInput,
  client?: Queryable
): Promise<{ payment: PaymentRow; allocations: PaymentAllocationRow[] }> {
  if (input.amountMinor <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }
  const paymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);
  const year = new Date().getFullYear();

  return withTransaction(async (db) => {
    // 1. Generate sequential payment number
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounting_payments WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const seq = parseInt(countRes.rows[0]?.count || "0", 10) + 1;
    const prefix = input.type === "IN" ? "PAY-IN" : "PAY-OUT";
    const paymentNumber = `${prefix}-${year}-${seq.toString().padStart(4, "0")}`;

    // 2. Validate financial account
    const finAcc = await getFinancialAccountById(input.workspaceId, input.financialAccountId, db);
    if (!finAcc) throw new Error("Deposit/disbursement financial account not found.");

    let postedJournalEntryId: string | null = null;

    if (input.type === "IN") {
      // Money In / Collection: Debit Cash/Bank, Credit Accounts Receivable (1200)
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
          lines: [
            { financialAccountId: finAcc.id, debitMinor: input.amountMinor, creditMinor: 0, description: "Funds Received" },
            { financialAccountId: arAcc.id, debitMinor: 0, creditMinor: input.amountMinor, description: "Accounts Receivable Settled" },
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
           SET total_receivable_minor = GREATEST(0, total_receivable_minor - $1), updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [input.amountMinor, input.contactId, input.workspaceId]
        );
      }
    } else {
      // Money Out / Vendor payment: Debit Accounts Payable (2000), Credit Cash/Bank
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
          lines: [
            { financialAccountId: apAcc.id, debitMinor: input.amountMinor, creditMinor: 0, description: "Accounts Payable Settled" },
            { financialAccountId: finAcc.id, debitMinor: 0, creditMinor: input.amountMinor, description: "Funds Disbursed" },
          ],
          userId: input.userId,
        },
        db
      );
      postedJournalEntryId = entry.id;

      if (input.contactId) {
        await db.query(
          `UPDATE accounting_contacts
           SET total_payable_minor = GREATEST(0, total_payable_minor - $1), updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [input.amountMinor, input.contactId, input.workspaceId]
        );
      }
    }

    // 3. Insert Payment record
    const payRes = await db.query<PaymentRow>(
      `INSERT INTO accounting_payments
         (workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor, payment_date, payment_method, reference_number, notes, journal_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.workspaceId,
        paymentNumber,
        input.type,
        input.contactId || null,
        input.financialAccountId,
        input.amountMinor,
        paymentDate,
        input.paymentMethod || "BANK_TRANSFER",
        input.referenceNumber || null,
        input.notes || null,
        postedJournalEntryId,
        input.userId || null,
      ]
    );
    const payment = payRes.rows[0];

    // 4. Process Invoice Allocations (if any)
    const insertedAllocations: PaymentAllocationRow[] = [];

    if (input.allocations && input.allocations.length > 0) {
      let allocatedTotal = 0;

      for (const alloc of input.allocations) {
        if (alloc.amountMinor <= 0) continue;
        allocatedTotal += alloc.amountMinor;

        // Fetch invoice with row lock
        const invRes = await db.query<InvoiceRow>(
          `SELECT * FROM accounting_invoices WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
          [alloc.invoiceId, input.workspaceId]
        );
        const invoice = invRes.rows[0];
        if (!invoice) throw new Error(`Invoice ${alloc.invoiceId} not found.`);

        const dueMinor = Number(invoice.amount_due_minor);
        if (alloc.amountMinor > dueMinor) {
          throw new Error(
            `Overpayment prevented: Cannot allocate ₹${(alloc.amountMinor / 100).toFixed(2)} to invoice ${invoice.invoice_number} which only has ₹${(dueMinor / 100).toFixed(2)} remaining due.`
          );
        }

        const newPaid = Number(invoice.amount_paid_minor) + alloc.amountMinor;
        const newDue = dueMinor - alloc.amountMinor;
        const newStatus = newDue === 0 ? "PAID" : "PARTIALLY_PAID";

        await db.query(
          `UPDATE accounting_invoices
           SET amount_paid_minor = $1, amount_due_minor = $2, status = $3, updated_at = NOW()
           WHERE id = $4`,
          [newPaid, newDue, newStatus, invoice.id]
        );

        // If invoice is fully paid, cancel / dismiss any active due reminders
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

      if (allocatedTotal > input.amountMinor) {
        throw new Error("Total allocated across invoices exceeds recorded payment amount.");
      }
    }

    return { payment, allocations: insertedAllocations };
  });
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
