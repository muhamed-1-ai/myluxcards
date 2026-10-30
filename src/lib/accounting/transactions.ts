import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  UserTransactionRow,
  JournalEntryRow,
  JournalLineRow,
} from "./types";
import { postJournalEntry, reverseJournalEntry, type PostJournalLineInput } from "./ledger";
import { getFinancialAccountByCode, getFinancialAccountById } from "./accounts";
import { syncTransactionAttachments } from "./attachments";

export interface CreateTransactionInput {
  workspaceId: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amountMinor: number;
  date?: string; // YYYY-MM-DD
  categoryId?: string | null;
  mainCategoryId?: string | null;
  subcategoryId?: string | null;
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
  attachmentIds?: string[];
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

    // Validate category & hierarchy if provided
    let effectiveCategoryId: string | null = null;
    if (input.subcategoryId && input.mainCategoryId) {
      // Both main category and subcategory provided: verify parent-child relationship & workspace isolation
      const catsCheck = await db.query<{ id: string; name: string; type: string; parent_id: string | null; is_archived: boolean }>(
        `SELECT id, name, type, parent_id, is_archived
         FROM accounting_categories
         WHERE id IN ($1, $2) AND workspace_id = $3`,
        [input.subcategoryId, input.mainCategoryId, input.workspaceId]
      );
      const subCat = catsCheck.rows.find((c) => c.id === input.subcategoryId);
      const mainCat = catsCheck.rows.find((c) => c.id === input.mainCategoryId);

      if (!subCat || !mainCat) {
        throw new Error("Selected category does not exist in this workspace.");
      }
      if (subCat.parent_id !== mainCat.id) {
        throw new Error(`Selected subcategory "${subCat.name}" does not belong to category "${mainCat.name}".`);
      }
      if (subCat.is_archived) {
        throw new Error(`Cannot record transaction under archived subcategory "${subCat.name}".`);
      }
      if (mainCat.is_archived) {
        throw new Error(`Cannot record transaction under category "${mainCat.name}" because it is archived.`);
      }
      if (subCat.type !== input.type || mainCat.type !== input.type) {
        throw new Error(`Category type (${subCat.type}) does not match transaction type (${input.type}).`);
      }
      effectiveCategoryId = subCat.id;
    } else {
      const targetId = input.subcategoryId || input.categoryId || input.mainCategoryId || null;
      if (targetId) {
        const catCheck = await db.query<{ id: string; name: string; type: string; is_archived: boolean; parent_archived: boolean | null }>(
          `SELECT c.id, c.name, c.type, c.is_archived, p.is_archived as parent_archived
           FROM accounting_categories c
           LEFT JOIN accounting_categories p ON p.id = c.parent_id
           WHERE c.id = $1 AND c.workspace_id = $2
           LIMIT 1`,
          [targetId, input.workspaceId]
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
        effectiveCategoryId = cat.id;
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

      if (input.attachmentIds && input.attachmentIds.length > 0) {
        await db.query(
          `UPDATE accounting_transaction_attachments
           SET transaction_id = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND workspace_id = $3`,
          [txRes.rows[0].id, input.attachmentIds.slice(0, 5), input.workspaceId]
        );
      }

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
          effectiveCategoryId,
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

      if (input.attachmentIds && input.attachmentIds.length > 0) {
        await db.query(
          `UPDATE accounting_transaction_attachments
           SET transaction_id = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND workspace_id = $3`,
          [txRes.rows[0].id, input.attachmentIds.slice(0, 5), input.workspaceId]
        );
      }

      const enrichRes = await db.query<UserTransactionRow>(
        `SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
                CASE
                  WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
                  ELSE cat.name
                END as main_category_name,
                CASE
                  WHEN parent_cat.id IS NOT NULL THEN cat.name
                  ELSE NULL
                END as subcategory_name,
                fa.name as account_name, c.name as contact_name,
                COALESCE((
                  SELECT COUNT(*)
                  FROM accounting_transaction_attachments att
                  WHERE att.transaction_id = t.id
                ), 0)::int as attachment_count
         FROM accounting_transactions t
         LEFT JOIN accounting_categories cat ON cat.id = t.category_id
         LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
         LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
         LEFT JOIN accounting_contacts c ON c.id = t.contact_id
         WHERE t.id = $1 AND t.workspace_id = $2`,
        [txRes.rows[0].id, input.workspaceId]
      );
      return { transaction: enrichRes.rows[0] || txRes.rows[0], journalEntry: entry };
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
          effectiveCategoryId,
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

      if (input.attachmentIds && input.attachmentIds.length > 0) {
        await db.query(
          `UPDATE accounting_transaction_attachments
           SET transaction_id = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND workspace_id = $3`,
          [txRes.rows[0].id, input.attachmentIds.slice(0, 5), input.workspaceId]
        );
      }

      const enrichRes = await db.query<UserTransactionRow>(
        `SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
                CASE
                  WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
                  ELSE cat.name
                END as main_category_name,
                CASE
                  WHEN parent_cat.id IS NOT NULL THEN cat.name
                  ELSE NULL
                END as subcategory_name,
                fa.name as account_name, c.name as contact_name,
                COALESCE((
                  SELECT COUNT(*)
                  FROM accounting_transaction_attachments att
                  WHERE att.transaction_id = t.id
                ), 0)::int as attachment_count
         FROM accounting_transactions t
         LEFT JOIN accounting_categories cat ON cat.id = t.category_id
         LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
         LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
         LEFT JOIN accounting_contacts c ON c.id = t.contact_id
         WHERE t.id = $1 AND t.workspace_id = $2`,
        [txRes.rows[0].id, input.workspaceId]
      );
      return { transaction: enrichRes.rows[0] || txRes.rows[0], journalEntry: entry };
    }

    throw new Error(`Unsupported transaction type: ${input.type}`);
  });
}

export interface ListTransactionsFilter {
  type?: string;
  status?: "POSTED" | "VOIDED" | "ALL";
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

  // Default to POSTED if status is not explicitly provided, unless "ALL" is specified
  const effectiveStatus = filter.status !== undefined ? filter.status : "POSTED";
  if (effectiveStatus !== "ALL") {
    params.push(effectiveStatus);
    where += ` AND t.status = $${params.length}`;
  }

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
           p.purchase_number,
           CASE
             WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
             ELSE cat.name
           END as main_category_name,
           CASE
             WHEN parent_cat.id IS NOT NULL THEN cat.name
             ELSE NULL
           END as subcategory_name,
           fa.name as account_name, c.name as contact_name,
           u_void.name as voided_by_name, u_rest.name as restored_by_name,
           COALESCE((
             SELECT COUNT(*)
             FROM accounting_transaction_attachments att
             WHERE att.transaction_id = t.id OR att.purchase_id = t.purchase_id
           ), 0)::int as attachment_count
    FROM accounting_transactions t
    LEFT JOIN accounting_purchases p ON p.id = t.purchase_id
    LEFT JOIN accounting_categories cat ON cat.id = t.category_id
    LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
    LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
    LEFT JOIN accounting_contacts c ON c.id = t.contact_id
    LEFT JOIN users u_void ON u_void.id = t.voided_by
    LEFT JOIN users u_rest ON u_rest.id = t.restored_by
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
    mainCategoryId?: string | null;
    subcategoryId?: string | null;
    date?: string;
    notes?: string | null;
    tags?: string[];
    attachmentIds?: string[];
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
    if (input.subcategoryId !== undefined || input.mainCategoryId !== undefined || input.categoryId !== undefined) {
      if (input.subcategoryId && input.mainCategoryId) {
        // Both main category and subcategory provided: verify parent-child relationship & workspace isolation
        const catsCheck = await db.query<{ id: string; name: string; type: string; parent_id: string | null; is_archived: boolean }>(
          `SELECT id, name, type, parent_id, is_archived
           FROM accounting_categories
           WHERE id IN ($1, $2) AND workspace_id = $3`,
          [input.subcategoryId, input.mainCategoryId, workspaceId]
        );
        const subCat = catsCheck.rows.find((c) => c.id === input.subcategoryId);
        const mainCat = catsCheck.rows.find((c) => c.id === input.mainCategoryId);

        if (!subCat || !mainCat) {
          throw new Error("Selected category does not exist in this workspace.");
        }
        if (subCat.parent_id !== mainCat.id) {
          throw new Error(`Selected subcategory "${subCat.name}" does not belong to category "${mainCat.name}".`);
        }
        if (subCat.is_archived && subCat.id !== existing.category_id) {
          throw new Error(`Cannot select archived subcategory "${subCat.name}".`);
        }
        if (mainCat.is_archived && mainCat.id !== existing.category_id) {
          throw new Error(`Cannot select category "${mainCat.name}" because it is archived.`);
        }
        if (subCat.type !== existing.type || mainCat.type !== existing.type) {
          throw new Error(`Category type does not match transaction type (${existing.type}).`);
        }
        categoryId = subCat.id;
      } else {
        const targetId = input.subcategoryId || input.categoryId || input.mainCategoryId || null;
        if (targetId) {
          const catCheck = await db.query<{ id: string; name: string; type: string; is_archived: boolean; parent_archived: boolean | null }>(
            `SELECT c.id, c.name, c.type, c.is_archived, p.is_archived as parent_archived
             FROM accounting_categories c
             LEFT JOIN accounting_categories p ON p.id = c.parent_id
             WHERE c.id = $1 AND c.workspace_id = $2
             LIMIT 1`,
            [targetId, workspaceId]
          );
          if (catCheck.rows.length === 0) {
            throw new Error("Selected category does not exist in this workspace.");
          }
          const cat = catCheck.rows[0];
          if (cat.is_archived && cat.id !== existing.category_id) {
            throw new Error(`Cannot select archived category "${cat.name}".`);
          }
          if (cat.parent_archived && cat.id !== existing.category_id) {
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

    if (input.attachmentIds !== undefined) {
      await syncTransactionAttachments(workspaceId, transactionId, input.attachmentIds, db);
    }

    const fullRes = await db.query<UserTransactionRow>(
      `SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
              CASE
                WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
                ELSE cat.name
              END as main_category_name,
              CASE
                WHEN parent_cat.id IS NOT NULL THEN cat.name
                ELSE NULL
              END as subcategory_name,
              fa.name as account_name, c.name as contact_name,
              COALESCE((
                SELECT COUNT(*)
                FROM accounting_transaction_attachments att
                WHERE att.transaction_id = t.id
              ), 0)::int as attachment_count
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

    // Reverse underlying journal entry (atomically reverses financial account balances)
    await reverseJournalEntry(workspaceId, tx.journal_entry_id, reason, userId, client);

    // Update transaction status and audit columns
    await client.query(
      `UPDATE accounting_transactions
       SET status = 'VOIDED',
           voided_at = NOW(),
           voided_by = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [userId || null, transactionId]
    );

    if (tx.purchase_id) {
      await client.query(
        `UPDATE accounting_purchases
         SET status = 'VOIDED', voided_at = NOW(), voided_by = $1, void_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [userId || null, reason, tx.purchase_id]
      );
    }

    // Audit Log for the transaction entity
    let actorId = userId || tx.created_by;
    if (!actorId) {
      const wsOwner = await client.query<{ owner_user_id: string }>(
        `SELECT owner_user_id FROM accounting_workspaces WHERE id = $1`,
        [workspaceId]
      );
      actorId = wsOwner.rows[0]?.owner_user_id || null;
    }

    if (actorId) {
      await client.query(
        `INSERT INTO accounting_audit_logs
           (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, $2, 'STAFF', 'TRANSACTION_VOIDED', 'accounting_transactions', $3, $4, $5)`,
        [
          workspaceId,
          actorId,
          transactionId,
          JSON.stringify({ status: tx.status }),
          JSON.stringify({ status: "VOIDED", reason, voided_by: actorId }),
        ]
      );
    }

    const fullRes = await client.query<UserTransactionRow>(
      `SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
              CASE
                WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
                ELSE cat.name
              END as main_category_name,
              CASE
                WHEN parent_cat.id IS NOT NULL THEN cat.name
                ELSE NULL
              END as subcategory_name,
              fa.name as account_name, c.name as contact_name,
              u_void.name as voided_by_name, u_rest.name as restored_by_name
       FROM accounting_transactions t
       LEFT JOIN accounting_categories cat ON cat.id = t.category_id
       LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
       LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
       LEFT JOIN accounting_contacts c ON c.id = t.contact_id
       LEFT JOIN users u_void ON u_void.id = t.voided_by
       LEFT JOIN users u_rest ON u_rest.id = t.restored_by
       WHERE t.id = $1 AND t.workspace_id = $2`,
      [transactionId, workspaceId]
    );

    return fullRes.rows[0];
  });
}

/**
 * Restore a voided expense transaction atomically.
 * Reinstates the double-entry accounting effect once, creates balanced journal entries,
 * preserves full audit trail, and returns the transaction to All Transactions.
 */
export async function restoreTransaction(
  workspaceId: string,
  transactionId: string,
  reason: string = "Expense restored by user",
  userId?: string
): Promise<UserTransactionRow> {
  return withTransaction(async (client) => {
    // 1. Fetch transaction with FOR UPDATE row lock to prevent race conditions & duplicate restorations
    const tx = (
      await client.query<UserTransactionRow>(
        `SELECT * FROM accounting_transactions WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [transactionId, workspaceId]
      )
    ).rows[0];

    if (!tx) throw new Error("Transaction not found.");
    if (tx.status !== "VOIDED") throw new Error("Transaction is already active.");
    if (tx.type !== "EXPENSE") throw new Error("Only voided expense transactions can be restored.");

    // 2. Fetch the journal entry currently linked to this transaction
    const journalRes = await client.query<JournalEntryRow>(
      `SELECT * FROM accounting_journal_entries WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [tx.journal_entry_id, workspaceId]
    );
    const origJournal = journalRes.rows[0];
    if (!origJournal) {
      throw new Error("Associated journal entry not found.");
    }

    // 3. Fetch lines for the original entry to reinstate exact debits and credits
    const linesRes = await client.query<JournalLineRow>(
      `SELECT * FROM accounting_journal_lines WHERE journal_entry_id = $1`,
      [origJournal.id]
    );
    const lines = linesRes.rows;
    if (!lines || lines.length === 0) {
      throw new Error("Journal entry lines not found for reinstatement.");
    }

    // Reinstatement lines mirror the original debits and credits
    const reinstatementLines: PostJournalLineInput[] = lines.map((l) => ({
      financialAccountId: l.financial_account_id,
      debitMinor: Number(l.debit_minor),
      creditMinor: Number(l.credit_minor),
      description: `Reinstatement of ${origJournal.entry_number}: ${l.description || "Restored expense"}`,
    }));

    // 4. Post balanced reinstatement entry (applies double-entry financial effect once)
    const txDate = tx.date ? String(tx.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const { entry: reinstatement } = await postJournalEntry(
      {
        workspaceId,
        entryType: "EXPENSE",
        entryDate: txDate,
        description: `Reinstatement of ${origJournal.entry_number}: ${reason}`,
        reference: origJournal.entry_number,
        sourceType: "TRANSACTION",
        sourceId: tx.id,
        lines: reinstatementLines,
        userId,
      },
      client
    );

    // 5. Update transaction: return to POSTED, link new active journal entry, set restored audit info
    await client.query(
      `UPDATE accounting_transactions
       SET status = 'POSTED',
           journal_entry_id = $1,
           restored_at = NOW(),
           restored_by = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [reinstatement.id, userId || null, transactionId]
    );

    if (tx.purchase_id) {
      await client.query(
        `UPDATE accounting_purchases
         SET status = 'UNPAID', posted_journal_entry_id = $1, voided_at = NULL, voided_by = NULL, void_reason = NULL, updated_at = NOW()
         WHERE id = $2`,
        [reinstatement.id, tx.purchase_id]
      );
    }

    // 6. Audit Log
    let actorId = userId || tx.created_by;
    if (!actorId) {
      const wsOwner = await client.query<{ owner_user_id: string }>(
        `SELECT owner_user_id FROM accounting_workspaces WHERE id = $1`,
        [workspaceId]
      );
      actorId = wsOwner.rows[0]?.owner_user_id || null;
    }

    if (actorId) {
      await client.query(
        `INSERT INTO accounting_audit_logs
           (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, $2, 'STAFF', 'TRANSACTION_RESTORED', 'accounting_transactions', $3, $4, $5)`,
        [
          workspaceId,
          actorId,
          tx.id,
          JSON.stringify({ status: tx.status, previous_journal_entry_id: origJournal.id }),
          JSON.stringify({ status: "POSTED", reinstatement_journal_id: reinstatement.id, reason, restored_by: actorId }),
        ]
      );
    }

    // 7. Return complete updated row with joined accounts, categories, and actor names
    const fullRes = await client.query<UserTransactionRow>(
      `SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
              CASE
                WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
                ELSE cat.name
              END as main_category_name,
              CASE
                WHEN parent_cat.id IS NOT NULL THEN cat.name
                ELSE NULL
              END as subcategory_name,
              fa.name as account_name, c.name as contact_name,
              u_void.name as voided_by_name, u_rest.name as restored_by_name
       FROM accounting_transactions t
       LEFT JOIN accounting_categories cat ON cat.id = t.category_id
       LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
       LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
       LEFT JOIN accounting_contacts c ON c.id = t.contact_id
       LEFT JOIN users u_void ON u_void.id = t.voided_by
       LEFT JOIN users u_rest ON u_rest.id = t.restored_by
       WHERE t.id = $1 AND t.workspace_id = $2`,
      [transactionId, workspaceId]
    );

    return fullRes.rows[0];
  });
}
