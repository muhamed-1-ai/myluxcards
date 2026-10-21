import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  UserTransactionRow,
  JournalEntryRow,
} from "./types";
import { postJournalEntry, reverseJournalEntry } from "./ledger";
import { getFinancialAccountByCode, getFinancialAccountById } from "./accounts";

export interface CreateTransactionInput {
  workspaceId: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amountMinor: number;
  date?: string; // YYYY-MM-DD
  categoryId?: string | null;
  financialAccountId?: string | null; // source or deposit account (required when money moves)
  destinationAccountId?: string | null; // required for TRANSFER
  contactId?: string | null;
  contactName?: string | null;
  isPaid?: boolean; // backwards compatible
  paymentStatus?: "PAID" | "PARTLY_PAID" | "UNPAID";
  paidAmountMinor?: number; // for PARTLY_PAID
  dueDate?: string | null;
  notes?: string | null;
  attachmentUrl?: string | null;
  tags?: string[];
  isRecurring?: boolean;
  userId?: string;
  idempotencyKey?: string;
}

export async function createTransaction(
  input: CreateTransactionInput,
  client?: Queryable
): Promise<{ transaction: UserTransactionRow; journalEntry: JournalEntryRow }> {
  if (input.amountMinor <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }
  const date = input.date || new Date().toISOString().slice(0, 10);

  // Resolve payment status: PAID, PARTLY_PAID, or UNPAID
  let status: "PAID" | "PARTLY_PAID" | "UNPAID" = input.paymentStatus || "PAID";
  if (!input.paymentStatus && typeof input.isPaid === "boolean") {
    status = input.isPaid ? "PAID" : "UNPAID";
  }

  let paidMinor = input.amountMinor;
  let unpaidMinor = 0;

  if (status === "UNPAID") {
    paidMinor = 0;
    unpaidMinor = input.amountMinor;
  } else if (status === "PARTLY_PAID") {
    const rawPaid = typeof input.paidAmountMinor === "number" ? input.paidAmountMinor : 0;
    paidMinor = Math.min(input.amountMinor, Math.max(0, rawPaid));
    unpaidMinor = input.amountMinor - paidMinor;
    if (paidMinor === 0) status = "UNPAID";
    else if (unpaidMinor === 0) status = "PAID";
  }

  const isPaid = status === "PAID";

  return withTransaction(async (db) => {
    // Resolve contact if contactName was supplied without contactId
    let effectiveContactId = input.contactId || null;
    if (!effectiveContactId && input.contactName && input.contactName.trim()) {
      const trimmedName = input.contactName.trim();
      const existingRes = await db.query<{ id: string }>(
        `SELECT id FROM accounting_contacts WHERE workspace_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
        [input.workspaceId, trimmedName]
      );
      if (existingRes.rows.length > 0) {
        effectiveContactId = existingRes.rows[0].id;
      } else {
        const contactType = input.type === "INCOME" ? "CUSTOMER" : "VENDOR";
        const newContactRes = await db.query<{ id: string }>(
          `INSERT INTO accounting_contacts (workspace_id, name, type) VALUES ($1, $2, $3) RETURNING id`,
          [input.workspaceId, trimmedName, contactType]
        );
        effectiveContactId = newContactRes.rows[0].id;
      }
    }

    // Validate category if provided
    if (input.categoryId) {
      const catCheck = await db.query<{ id: string; name: string; type: string; is_archived: boolean; parent_archived: boolean | null }>(
        `SELECT c.id, c.name, c.type, c.is_archived, p.is_archived as parent_archived
         FROM accounting_categories c
         LEFT JOIN accounting_categories p ON p.id = c.parent_id
         WHERE c.id = $1 AND c.workspace_id = $2
         LIMIT 1`,
        [input.categoryId, input.workspaceId]
      );
      if (catCheck.rows.length === 0) {
        throw new Error("Selected category does not exist in this workspace.");
      }
      const cat = catCheck.rows[0];
      if (cat.is_archived) {
        throw new Error(`Cannot record transaction under archived category "${cat.name}".`);
      }
      if (cat.parent_archived) {
        throw new Error(`Cannot record transaction under subcategory "${cat.name}" because its parent category is archived.`);
      }
      if (cat.type !== input.type) {
        throw new Error(`Category "${cat.name}" type (${cat.type}) does not match transaction type (${input.type}).`);
      }
    }

    // 1. Resolve Financial Accounts
    let primaryAccountId = input.financialAccountId || null;
    let offsetAccountId: string;

    if (input.type === "TRANSFER") {
      if (!input.financialAccountId || !input.destinationAccountId || input.destinationAccountId === input.financialAccountId) {
        throw new Error("Transfer requires distinct source and destination accounts.");
      }
      primaryAccountId = input.destinationAccountId; // Destination debited (receives money)
      offsetAccountId = input.financialAccountId;    // Source credited (sends money)

      // Debit Destination Account, Credit Source Account
      const { entry } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "TRANSFER",
          entryDate: date,
          description: input.notes || "Account transfer",
          sourceType: "TRANSFER",
          idempotencyKey: input.idempotencyKey,
          lines: [
            { financialAccountId: primaryAccountId, debitMinor: input.amountMinor, creditMinor: 0, description: "Transfer In" },
            { financialAccountId: offsetAccountId, debitMinor: 0, creditMinor: input.amountMinor, description: "Transfer Out" },
          ],
          userId: input.userId,
        },
        db
      );

      const txRes = await db.query<UserTransactionRow>(
        `INSERT INTO accounting_transactions
           (workspace_id, journal_entry_id, type, financial_account_id, destination_account_id, amount_minor, date, notes, attachment_url, tags, is_recurring, created_by)
         VALUES ($1, $2, 'TRANSFER', $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         RETURNING *`,
        [
          input.workspaceId,
          entry.id,
          input.financialAccountId,
          input.destinationAccountId,
          input.amountMinor,
          date,
          input.notes || null,
          input.attachmentUrl || null,
          JSON.stringify(input.tags || []),
          Boolean(input.isRecurring),
          input.userId || null,
        ]
      );
      return { transaction: txRes.rows[0], journalEntry: entry };
    }

    if (input.type === "INCOME") {
      const revenueAcc = await getFinancialAccountByCode(input.workspaceId, "4000", db);
      if (!revenueAcc) throw new Error("Revenue account (4000) not found.");
      offsetAccountId = revenueAcc.id;

      const journalLines: Array<{ financialAccountId: string; debitMinor: number; creditMinor: number; description?: string }> = [];

      let finalTxAccountId: string;

      if (status === "PAID") {
        if (!input.financialAccountId) {
          throw new Error("Payment account is required for paid income.");
        }
        finalTxAccountId = input.financialAccountId;
        journalLines.push(
          { financialAccountId: input.financialAccountId, debitMinor: input.amountMinor, creditMinor: 0, description: "Money Received" },
          { financialAccountId: offsetAccountId, debitMinor: 0, creditMinor: input.amountMinor, description: "Sales Revenue" }
        );
      } else if (status === "UNPAID") {
        const arAcc = await getFinancialAccountByCode(input.workspaceId, "1200", db);
        if (!arAcc) throw new Error("Receivable account (1200) not found.");
        finalTxAccountId = arAcc.id;

        journalLines.push(
          { financialAccountId: arAcc.id, debitMinor: input.amountMinor, creditMinor: 0, description: "Accounts Receivable" },
          { financialAccountId: offsetAccountId, debitMinor: 0, creditMinor: input.amountMinor, description: "Sales Revenue" }
        );

        if (effectiveContactId) {
          await db.query(
            `UPDATE accounting_contacts
             SET total_receivable_minor = total_receivable_minor + $1, updated_at = NOW()
             WHERE id = $2 AND workspace_id = $3`,
            [input.amountMinor, effectiveContactId, input.workspaceId]
          );
        }
      } else {
        // PARTLY_PAID
        if (!input.financialAccountId) {
          throw new Error("Payment account is required for received portion of income.");
        }
        const arAcc = await getFinancialAccountByCode(input.workspaceId, "1200", db);
        if (!arAcc) throw new Error("Receivable account (1200) not found.");
        finalTxAccountId = input.financialAccountId;

        journalLines.push(
          { financialAccountId: input.financialAccountId, debitMinor: paidMinor, creditMinor: 0, description: "Money Received (Partial)" },
          { financialAccountId: arAcc.id, debitMinor: unpaidMinor, creditMinor: 0, description: "Accounts Receivable" },
          { financialAccountId: offsetAccountId, debitMinor: 0, creditMinor: input.amountMinor, description: "Sales Revenue" }
        );

        if (effectiveContactId) {
          await db.query(
            `UPDATE accounting_contacts
             SET total_receivable_minor = total_receivable_minor + $1, updated_at = NOW()
             WHERE id = $2 AND workspace_id = $3`,
            [unpaidMinor, effectiveContactId, input.workspaceId]
          );
        }
      }

      // If dueDate provided for unpaid or partly paid, register a reminder
      if (input.dueDate && unpaidMinor > 0 && input.userId) {
        await db.query(
          `INSERT INTO accounting_reminders
             (workspace_id, user_id, title, description, type, due_date, status)
           VALUES ($1, $2, $3, $4, 'INVOICE_DUE', $5, 'PENDING')`,
          [
            input.workspaceId,
            input.userId,
            `Collection due: ₹${(unpaidMinor / 100).toFixed(2)}${input.contactName ? ` from ${input.contactName}` : ""}`,
            input.notes || "Credit sale payment expected",
            input.dueDate,
          ]
        );
      }

      const { entry } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "SALE",
          entryDate: date,
          description: input.notes || "Income recorded",
          sourceType: "TRANSACTION",
          idempotencyKey: input.idempotencyKey,
          lines: journalLines,
          userId: input.userId,
        },
        db
      );

      const txRes = await db.query<UserTransactionRow>(
        `INSERT INTO accounting_transactions
           (workspace_id, journal_entry_id, type, category_id, financial_account_id, contact_id, amount_minor, date, notes, attachment_url, tags, is_recurring, created_by)
         VALUES ($1, $2, 'INCOME', $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
         RETURNING *`,
        [
          input.workspaceId,
          entry.id,
          input.categoryId || null,
          finalTxAccountId,
          effectiveContactId,
          input.amountMinor,
          date,
          input.notes || null,
          input.attachmentUrl || null,
          JSON.stringify(input.tags || []),
          Boolean(input.isRecurring),
          input.userId || null,
        ]
      );
      return { transaction: txRes.rows[0], journalEntry: entry };
    }

    if (input.type === "EXPENSE") {
      const expenseAcc = await getFinancialAccountByCode(input.workspaceId, "5000", db);
      if (!expenseAcc) throw new Error("Operating expense account (5000) not found.");

      const journalLines: Array<{ financialAccountId: string; debitMinor: number; creditMinor: number; description?: string }> = [];
      let finalTxAccountId: string;

      if (status === "PAID") {
        if (!input.financialAccountId) {
          throw new Error("Payment account is required for paid expense.");
        }
        finalTxAccountId = input.financialAccountId;
        journalLines.push(
          { financialAccountId: expenseAcc.id, debitMinor: input.amountMinor, creditMinor: 0, description: "Operating Expense" },
          { financialAccountId: input.financialAccountId, debitMinor: 0, creditMinor: input.amountMinor, description: "Cash Paid" }
        );
      } else if (status === "UNPAID") {
        const apAcc = await getFinancialAccountByCode(input.workspaceId, "2000", db);
        if (!apAcc) throw new Error("Accounts Payable account (2000) not found.");
        finalTxAccountId = apAcc.id;

        journalLines.push(
          { financialAccountId: expenseAcc.id, debitMinor: input.amountMinor, creditMinor: 0, description: "Operating Expense" },
          { financialAccountId: apAcc.id, debitMinor: 0, creditMinor: input.amountMinor, description: "Accounts Payable" }
        );

        if (effectiveContactId) {
          await db.query(
            `UPDATE accounting_contacts
             SET total_payable_minor = total_payable_minor + $1, updated_at = NOW()
             WHERE id = $2 AND workspace_id = $3`,
            [input.amountMinor, effectiveContactId, input.workspaceId]
          );
        }
      } else {
        // PARTLY_PAID
        if (!input.financialAccountId) {
          throw new Error("Payment account is required for paid portion of expense.");
        }
        const apAcc = await getFinancialAccountByCode(input.workspaceId, "2000", db);
        if (!apAcc) throw new Error("Accounts Payable account (2000) not found.");
        finalTxAccountId = input.financialAccountId;

        journalLines.push(
          { financialAccountId: expenseAcc.id, debitMinor: input.amountMinor, creditMinor: 0, description: "Operating Expense" },
          { financialAccountId: input.financialAccountId, debitMinor: 0, creditMinor: paidMinor, description: "Cash Paid (Partial)" },
          { financialAccountId: apAcc.id, debitMinor: 0, creditMinor: unpaidMinor, description: "Accounts Payable" }
        );

        if (effectiveContactId) {
          await db.query(
            `UPDATE accounting_contacts
             SET total_payable_minor = total_payable_minor + $1, updated_at = NOW()
             WHERE id = $2 AND workspace_id = $3`,
            [unpaidMinor, effectiveContactId, input.workspaceId]
          );
        }
      }

      // If dueDate provided for unpaid or partly paid bill, register a reminder
      if (input.dueDate && unpaidMinor > 0 && input.userId) {
        await db.query(
          `INSERT INTO accounting_reminders
             (workspace_id, user_id, title, description, type, due_date, status)
           VALUES ($1, $2, $3, $4, 'BILL_DUE', $5, 'PENDING')`,
          [
            input.workspaceId,
            input.userId,
            `Bill payable: ₹${(unpaidMinor / 100).toFixed(2)}${input.contactName ? ` to ${input.contactName}` : ""}`,
            input.notes || "Supplier payment due",
            input.dueDate,
          ]
        );
      }

      const { entry } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "EXPENSE",
          entryDate: date,
          description: input.notes || "Expense incurred",
          sourceType: "TRANSACTION",
          idempotencyKey: input.idempotencyKey,
          lines: journalLines,
          userId: input.userId,
        },
        db
      );

      const txRes = await db.query<UserTransactionRow>(
        `INSERT INTO accounting_transactions
           (workspace_id, journal_entry_id, type, category_id, financial_account_id, contact_id, amount_minor, date, notes, attachment_url, tags, is_recurring, created_by)
         VALUES ($1, $2, 'EXPENSE', $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
         RETURNING *`,
        [
          input.workspaceId,
          entry.id,
          input.categoryId || null,
          finalTxAccountId,
          effectiveContactId,
          input.amountMinor,
          date,
          input.notes || null,
          input.attachmentUrl || null,
          JSON.stringify(input.tags || []),
          Boolean(input.isRecurring),
          input.userId || null,
        ]
      );
      return { transaction: txRes.rows[0], journalEntry: entry };
    }

    throw new Error(`Unsupported transaction type: ${input.type}`);
  });
}

export interface ListTransactionsFilter {
  type?: string;
  categoryId?: string;
  financialAccountId?: string;
  contactId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listTransactions(
  workspaceId: string,
  filter: ListTransactionsFilter = {}
): Promise<{ transactions: UserTransactionRow[]; total: number }> {
  let where = `WHERE t.workspace_id = $1`;
  const params: unknown[] = [workspaceId];

  if (filter.type) {
    params.push(filter.type);
    where += ` AND t.type = $${params.length}`;
  }
  if (filter.categoryId) {
    params.push(filter.categoryId);
    where += ` AND t.category_id IN (
      SELECT id FROM accounting_categories WHERE id = $${params.length} OR parent_id = $${params.length}
    )`;
  }
  if (filter.financialAccountId) {
    params.push(filter.financialAccountId);
    where += ` AND (t.financial_account_id = $${params.length} OR t.destination_account_id = $${params.length})`;
  }
  if (filter.contactId) {
    params.push(filter.contactId);
    where += ` AND t.contact_id = $${params.length}`;
  }
  if (filter.startDate) {
    params.push(filter.startDate);
    where += ` AND t.date >= $${params.length}`;
  }
  if (filter.endDate) {
    params.push(filter.endDate);
    where += ` AND t.date <= $${params.length}`;
  }
  if (filter.search) {
    params.push(`%${filter.search.toLowerCase()}%`);
    where += ` AND (LOWER(t.notes) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length} OR LOWER(cat.name) LIKE $${params.length} OR LOWER(parent_cat.name) LIKE $${params.length})`;
  }

  const countQuery = `
    SELECT COUNT(*) as count
    FROM accounting_transactions t
    LEFT JOIN accounting_contacts c ON c.id = t.contact_id
    LEFT JOIN accounting_categories cat ON cat.id = t.category_id
    LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
    ${where}
  `;
  const total = parseInt((await pool.query<{ count: string }>(countQuery, params)).rows[0]?.count || "0", 10);

  const limit = Math.min(100, Math.max(1, filter.limit || 25));
  const offset = Math.max(0, filter.offset || 0);

  params.push(limit, offset);
  const dataQuery = `
    SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
           fa.name as account_name, c.name as contact_name
    FROM accounting_transactions t
    LEFT JOIN accounting_categories cat ON cat.id = t.category_id
    LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
    LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
    LEFT JOIN accounting_contacts c ON c.id = t.contact_id
    ${where}
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const res = await pool.query<UserTransactionRow>(dataQuery, params);
  return { transactions: res.rows, total };
}

/**
 * Update transaction metadata and category classification safely.
 */
export async function updateTransaction(
  workspaceId: string,
  transactionId: string,
  input: {
    categoryId?: string | null;
    date?: string;
    notes?: string | null;
    tags?: string[];
  }
): Promise<UserTransactionRow> {
  return withTransaction(async (db) => {
    const existingRes = await db.query<UserTransactionRow>(
      `SELECT * FROM accounting_transactions WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [transactionId, workspaceId]
    );
    if (existingRes.rows.length === 0) {
      throw new Error("Transaction not found.");
    }
    const existing = existingRes.rows[0];
    if (existing.status === "VOIDED") {
      throw new Error("Cannot edit a voided transaction.");
    }

    let categoryId = existing.category_id;
    if (input.categoryId !== undefined) {
      if (input.categoryId) {
        const catCheck = await db.query<{ id: string; name: string; type: string; is_archived: boolean; parent_archived: boolean | null }>(
          `SELECT c.id, c.name, c.type, c.is_archived, p.is_archived as parent_archived
           FROM accounting_categories c
           LEFT JOIN accounting_categories p ON p.id = c.parent_id
           WHERE c.id = $1 AND c.workspace_id = $2
           LIMIT 1`,
          [input.categoryId, workspaceId]
        );
        if (catCheck.rows.length === 0) {
          throw new Error("Selected category does not exist in this workspace.");
        }
        const cat = catCheck.rows[0];
        if (cat.is_archived) {
          throw new Error(`Cannot select archived category "${cat.name}".`);
        }
        if (cat.parent_archived) {
          throw new Error(`Cannot select subcategory "${cat.name}" because its parent category is archived.`);
        }
        if (cat.type !== existing.type) {
          throw new Error(`Category "${cat.name}" type (${cat.type}) does not match transaction type (${existing.type}).`);
        }
        categoryId = cat.id;
      } else {
        categoryId = null;
      }
    }

    const date = input.date !== undefined ? input.date : existing.date;
    const notes = input.notes !== undefined ? input.notes : existing.notes;
    const tags = input.tags !== undefined ? JSON.stringify(input.tags) : existing.tags;

    await db.query(
      `UPDATE accounting_transactions
       SET category_id = $1, date = $2, notes = $3, tags = $4::jsonb, updated_at = NOW()
       WHERE id = $5 AND workspace_id = $6`,
      [categoryId, date, notes, tags, transactionId, workspaceId]
    );

    const fullRes = await db.query<UserTransactionRow>(
      `SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
              fa.name as account_name, c.name as contact_name
       FROM accounting_transactions t
       LEFT JOIN accounting_categories cat ON cat.id = t.category_id
       LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
       LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
       LEFT JOIN accounting_contacts c ON c.id = t.contact_id
       WHERE t.id = $1 AND t.workspace_id = $2`,
      [transactionId, workspaceId]
    );

    return fullRes.rows[0];
  });
}

/**
 * Void/Reverse a transaction with traceable audit history.
 */
export async function voidTransaction(
  workspaceId: string,
  transactionId: string,
  reason: string,
  userId?: string
): Promise<UserTransactionRow> {
  return withTransaction(async (client) => {
    const tx = (
      await client.query<UserTransactionRow>(
        `SELECT * FROM accounting_transactions WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [transactionId, workspaceId]
      )
    ).rows[0];
    if (!tx) throw new Error("Transaction not found.");
    if (tx.status === "VOIDED") throw new Error("Transaction is already voided.");

    // Reverse underlying journal entry
    await reverseJournalEntry(workspaceId, tx.journal_entry_id, reason, userId);

    // Update transaction status
    const updated = (
      await client.query<UserTransactionRow>(
        `UPDATE accounting_transactions
         SET status = 'VOIDED', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [transactionId]
      )
    ).rows[0];

    return updated;
  });
}
