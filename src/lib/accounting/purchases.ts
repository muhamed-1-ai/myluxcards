import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  PurchaseRow,
  PurchaseLineRow,
  PurchasePaymentRow,
  PurchaseStatus,
  PurchaseType,
  PaymentMethod,
  UserTransactionRow,
  TransactionAttachmentRow,
} from "./types";
import { postJournalEntry, reverseJournalEntry } from "./ledger";
import { getFinancialAccountByCode, getFinancialAccountById, listPaymentAccounts } from "./accounts";
import { getContactById } from "./contacts";

export interface PurchaseLineInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxMinor?: number;
}

export interface PurchaseInitialPaymentInput {
  financialAccountId?: string;
  accountId?: string;
  amountMinor: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface CreatePurchaseInput {
  workspaceId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierBillNumber?: string | null;
  purchaseDate?: string;
  dueDate?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  status?: PurchaseStatus; // DRAFT, UNPAID, PARTIALLY_PAID, PAID
  purchaseType?: PurchaseType; // EXPENSE, INVENTORY, ASSET
  notes?: string | null;
  lines: PurchaseLineInput[];
  attachmentIds?: string[];
  initialPayment?: PurchaseInitialPaymentInput;
  userId?: string;
  idempotencyKey?: string;
}

export interface UpdateDraftPurchaseInput {
  workspaceId: string;
  purchaseId: string;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierBillNumber?: string | null;
  purchaseDate?: string;
  dueDate?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  notes?: string | null;
  lines?: PurchaseLineInput[];
  attachmentIds?: string[];
  postNow?: boolean;
  statusIfPosting?: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  initialPayment?: PurchaseInitialPaymentInput;
  userId?: string;
}

export interface RecordPurchasePaymentInput {
  workspaceId: string;
  purchaseId: string;
  financialAccountId?: string;
  accountId?: string;
  amountMinor: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
  userId?: string;
  idempotencyKey?: string;
}

export interface ListPurchasesFilter {
  status?: string; // ALL, DRAFT, UNPAID, PARTIALLY_PAID, PAID, VOIDED
  search?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export function calculatePurchaseTotals(lines: PurchaseLineInput[]) {
  let subtotalMinor = 0;
  let discountMinor = 0;
  let taxMinor = 0;
  let totalMinor = 0;

  const calculatedLines = lines.map((line, idx) => {
    const qty = Math.max(0.01, Number(line.quantity) || 1);
    const unitPrice = Math.max(0, Math.round(Number(line.unitPriceMinor) || 0));
    const lineSubtotal = Math.round(qty * unitPrice);
    const lineDiscount = Math.max(0, Math.round(Number(line.discountMinor) || 0));
    const lineTax = Math.max(0, Math.round(Number(line.taxMinor) || 0));
    const lineTotal = Math.max(0, lineSubtotal - lineDiscount + lineTax);

    subtotalMinor += lineSubtotal;
    discountMinor += lineDiscount;
    taxMinor += lineTax;
    totalMinor += lineTotal;

    return {
      productId: line.productId || null,
      description: (line.description || "").trim() || "Item",
      quantity: qty,
      unitPriceMinor: unitPrice,
      discountMinor: lineDiscount,
      taxMinor: lineTax,
      totalMinor: lineTotal,
      sortOrder: idx + 1,
    };
  });

  return { subtotalMinor, discountMinor, taxMinor, totalMinor, calculatedLines };
}

/**
 * Validates that an account is strictly Cash in Hand or Bank Account.
 */
async function validatePaymentAccount(workspaceId: string, accountId: string, db: Queryable) {
  const account = await getFinancialAccountById(workspaceId, accountId, db);
  if (!account) {
    throw new Error("Selected payment account was not found in this workspace.");
  }
  if (!account.is_active) {
    throw new Error("Selected payment account is not active.");
  }
  const isCash = account.code === "1010" || (account.type === "ASSET" && account.subtype === "CASH");
  const isBank = account.code === "1020" || (account.type === "ASSET" && account.subtype === "BANK");
  if (!isCash && !isBank) {
    throw new Error("Payments can only be made from 'Cash in Hand' or 'Bank Account'.");
  }
  return account;
}

/**
 * Generates an atomic sequential purchase number (e.g. PUR-2026-0001).
 */
async function generatePurchaseNumber(workspaceId: string, period: string, db: Queryable): Promise<string> {
  await db.query(
    `INSERT INTO accounting_purchase_sequences (workspace_id, period, next_seq, updated_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (workspace_id, period) DO NOTHING`,
    [workspaceId, period]
  );

  const seqRow = (
    await db.query<{ next_seq: number }>(
      `SELECT next_seq FROM accounting_purchase_sequences
       WHERE workspace_id = $1 AND period = $2
       FOR UPDATE`,
      [workspaceId, period]
    )
  ).rows[0];

  const currentCounter = seqRow?.next_seq || 1;

  const sqlMaxRes = await db.query<{ max_seq: number }>(
    `SELECT COALESCE(
       MAX(
         CASE 
           WHEN purchase_number ~ ('^PUR-' || $2 || '-([0-9]{1,8})$')
           THEN (regexp_match(purchase_number, ('^PUR-' || $2 || '-([0-9]{1,8})$')))[1]::integer
           ELSE 0
         END
       ), 0
     ) as max_seq
     FROM accounting_purchases
     WHERE workspace_id = $1`,
    [workspaceId, period]
  );
  const maxExisting = sqlMaxRes.rows[0]?.max_seq || 0;

  let candidateSeq = Math.max(currentCounter, maxExisting + 1);
  let purchaseNumber = `PUR-${period}-${candidateSeq.toString().padStart(4, "0")}`;

  while (true) {
    const existingCheck = await db.query(
      `SELECT 1 FROM accounting_purchases WHERE workspace_id = $1 AND purchase_number = $2 LIMIT 1`,
      [workspaceId, purchaseNumber]
    );
    if (existingCheck.rows.length === 0) break;
    candidateSeq++;
    purchaseNumber = `PUR-${period}-${candidateSeq.toString().padStart(4, "0")}`;
  }

  await db.query(
    `UPDATE accounting_purchase_sequences
     SET next_seq = $1, updated_at = NOW()
     WHERE workspace_id = $2 AND period = $3`,
    [candidateSeq + 1, workspaceId, period]
  );

  return purchaseNumber;
}

/**
 * Creates an authoritative purchase record (Draft, Unpaid, Partially Paid, or Fully Paid).
 */
export async function createPurchase(
  input: CreatePurchaseInput,
  client?: Queryable
): Promise<{ purchase: PurchaseRow; lines: PurchaseLineRow[] }> {
  // 1. Guard against unsupported inventory or fixed asset purchases
  const purchaseType: PurchaseType = input.purchaseType || "EXPENSE";
  if (purchaseType === "INVENTORY") {
    throw new Error(
      "Unsupported accounting treatment: Full inventory asset capitalization is not configured in this workspace. Inventory purchases cannot be silently classified as ordinary operating expenses. Please record this purchase as an operational expense under an appropriate expense category."
    );
  }
  if (purchaseType === "ASSET") {
    throw new Error(
      "Unsupported accounting treatment: Fixed asset equipment tracking and depreciation schedules are not configured in this workspace. Equipment purchases cannot be silently classified as ordinary operating expenses. Please record this purchase as an operational expense under an appropriate expense category."
    );
  }

  if (!input.lines || input.lines.length === 0) {
    throw new Error("Purchase must have at least one item line.");
  }

  const { subtotalMinor, discountMinor, taxMinor, totalMinor, calculatedLines } = calculatePurchaseTotals(input.lines);
  const purchaseDate = input.purchaseDate || new Date().toISOString().slice(0, 10);
  const dueDate = input.dueDate || null;
  const targetStatus: PurchaseStatus = input.status || "DRAFT";

  return withTransaction(async (db) => {
    // 2. Validate category if provided
    let effectiveCategoryId: string | null = null;
    const catIdToCheck = input.subcategoryId || input.categoryId || null;
    if (catIdToCheck) {
      const catCheck = await db.query<{ id: string; name: string; type: string; is_archived: boolean }>(
        `SELECT id, name, type, is_archived FROM accounting_categories WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [catIdToCheck, input.workspaceId]
      );
      if (catCheck.rows.length === 0) {
        throw new Error("Selected category does not exist in this workspace.");
      }
      const cat = catCheck.rows[0];
      if (cat.is_archived) {
        throw new Error(`Cannot record purchase under archived category "${cat.name}".`);
      }
      if (cat.type !== "EXPENSE") {
        throw new Error(`Category "${cat.name}" is an income category, but purchases must use an Expense category.`);
      }
      effectiveCategoryId = cat.id;
    }

    // 3. Resolve supplier contact
    let supplierContact = null;
    let supplierName = input.supplierName?.trim() || null;
    if (input.supplierId) {
      supplierContact = await getContactById(input.workspaceId, input.supplierId);
      if (!supplierContact) {
        throw new Error("Selected supplier was not found in this workspace.");
      }
      supplierName = supplierContact.name;
    }

    if (targetStatus !== "DRAFT" && !supplierContact) {
      throw new Error("A supplier from People is required to post a purchase.");
    }

    // 4. Generate sequential purchase number
    const period = purchaseDate.slice(0, 4) || new Date().getFullYear().toString();
    const purchaseNumber = await generatePurchaseNumber(input.workspaceId, period, db);

    // 5. Handle DRAFT status: no journal entries, no balance effects
    if (targetStatus === "DRAFT") {
      const draftRes = await db.query<PurchaseRow>(
        `INSERT INTO accounting_purchases
           (workspace_id, purchase_number, supplier_id, supplier_name, supplier_bill_number,
            purchase_date, due_date, category_id, status, purchase_type, currency,
            subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor,
            notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', $9, 'INR', $10, $11, $12, $13, 0, $13, $14, $15)
         RETURNING *`,
        [
          input.workspaceId,
          purchaseNumber,
          supplierContact?.id || null,
          supplierName,
          input.supplierBillNumber?.trim() || null,
          purchaseDate,
          dueDate,
          effectiveCategoryId,
          purchaseType,
          subtotalMinor,
          discountMinor,
          taxMinor,
          totalMinor,
          input.notes?.trim() || null,
          input.userId || null,
        ]
      );
      const purchase = draftRes.rows[0];

      // Insert Lines
      const insertedLines: PurchaseLineRow[] = [];
      for (const line of calculatedLines) {
        const lRes = await db.query<PurchaseLineRow>(
          `INSERT INTO accounting_purchase_lines
             (purchase_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            purchase.id,
            line.productId,
            line.description,
            line.quantity,
            line.unitPriceMinor,
            line.discountMinor,
            line.taxMinor,
            line.totalMinor,
            line.sortOrder,
          ]
        );
        insertedLines.push(lRes.rows[0]);
      }

      // Sync Attachments
      if (input.attachmentIds && input.attachmentIds.length > 0) {
        await db.query(
          `UPDATE accounting_transaction_attachments
           SET purchase_id = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND workspace_id = $3`,
          [purchase.id, input.attachmentIds.slice(0, 5), input.workspaceId]
        );
      }

      return { purchase, lines: insertedLines };
    }

    // 6. Handle POSTED Statuses: UNPAID, PARTIALLY_PAID, or PAID
    let amountPaidMinor = 0;
    let initialPaymentAccount = null;

    if (targetStatus === "PAID") {
      if (!input.initialPayment) {
        throw new Error("Payment account details are required for a fully paid purchase.");
      }
      const initialAccountId = input.initialPayment.financialAccountId || input.initialPayment.accountId;
      if (!initialAccountId) {
        throw new Error("A valid payment account (Cash in Hand or Bank Account) is required.");
      }
      initialPaymentAccount = await validatePaymentAccount(
        input.workspaceId,
        initialAccountId,
        db
      );
      amountPaidMinor = totalMinor;
    } else if (targetStatus === "PARTIALLY_PAID") {
      if (!input.initialPayment) {
        throw new Error("Initial payment details are required for a partially paid purchase.");
      }
      const rawPaid = Math.round(Number(input.initialPayment.amountMinor) || 0);
      if (rawPaid <= 0 || rawPaid >= totalMinor) {
        throw new Error(`Partially paid amount must be between ₹0.01 and less than total amount (₹${(totalMinor / 100).toFixed(2)}).`);
      }
      const initialAccountId = input.initialPayment.financialAccountId || input.initialPayment.accountId;
      if (!initialAccountId) {
        throw new Error("A valid payment account (Cash in Hand or Bank Account) is required.");
      }
      initialPaymentAccount = await validatePaymentAccount(
        input.workspaceId,
        initialAccountId,
        db
      );
      amountPaidMinor = rawPaid;
    } else {
      // UNPAID
      amountPaidMinor = 0;
    }

    const amountDueMinor = totalMinor - amountPaidMinor;
    const finalStatus: PurchaseStatus =
      amountPaidMinor === 0 ? "UNPAID" : amountDueMinor === 0 ? "PAID" : "PARTIALLY_PAID";

    // 7. General Ledger Double-Entry for Purchase:
    // Debit: Operating Expenses (5000) for totalMinor
    // Credit: Accounts Payable (2000) for totalMinor
    const expenseAcc = await getFinancialAccountByCode(input.workspaceId, "5000", db);
    const apAcc = await getFinancialAccountByCode(input.workspaceId, "2000", db);
    if (!expenseAcc || !apAcc) {
      throw new Error("Chart of accounts is missing Operating Expenses (5000) or Accounts Payable (2000).");
    }

    const purchaseDesc = `Purchase ${purchaseNumber}${input.supplierBillNumber ? ` (Bill: ${input.supplierBillNumber})` : ""}${supplierName ? ` from ${supplierName}` : ""}`;

    const { entry: purchaseJE } = await postJournalEntry(
      {
        workspaceId: input.workspaceId,
        entryType: "EXPENSE",
        entryDate: purchaseDate,
        description: purchaseDesc,
        reference: purchaseNumber,
        sourceType: "PURCHASE",
        idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-PUR` : undefined,
        lines: [
          { financialAccountId: expenseAcc.id, debitMinor: totalMinor, creditMinor: 0, description: "Purchase Expense" },
          { financialAccountId: apAcc.id, debitMinor: 0, creditMinor: totalMinor, description: `Payable to ${supplierName}` },
        ],
        userId: input.userId,
      },
      db
    );

    // 8. Update supplier total_payable_minor by totalMinor
    if (supplierContact) {
      await db.query(
        `UPDATE accounting_contacts
         SET total_payable_minor = total_payable_minor + $1, updated_at = NOW()
         WHERE id = $2 AND workspace_id = $3`,
        [totalMinor, supplierContact.id, input.workspaceId]
      );
    }

    // 9. Process Initial Payment (if any):
    // Debit: Accounts Payable (2000) for amountPaidMinor
    // Credit: Payment Account (1010/1020) for amountPaidMinor
    let initialPaymentId: string | null = null;
    let initialPaymentJEId: string | null = null;

    if (amountPaidMinor > 0 && initialPaymentAccount) {
      const paymentDate = input.initialPayment?.paymentDate || purchaseDate;
      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM accounting_payments WHERE workspace_id = $1`,
        [input.workspaceId]
      );
      const seq = parseInt(countRes.rows[0]?.count || "0", 10) + 1;
      const paymentNumber = `PAY-OUT-${period}-${seq.toString().padStart(4, "0")}`;

      const { entry: payJE } = await postJournalEntry(
        {
          workspaceId: input.workspaceId,
          entryType: "PAYMENT_DISBURSEMENT",
          entryDate: paymentDate,
          description: `Disbursement ${paymentNumber} for purchase ${purchaseNumber}`,
          reference: paymentNumber,
          sourceType: "PAYMENT",
          idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-PAY` : undefined,
          lines: [
            { financialAccountId: apAcc.id, debitMinor: amountPaidMinor, creditMinor: 0, description: `Payable settled to ${supplierName}` },
            { financialAccountId: initialPaymentAccount.id, debitMinor: 0, creditMinor: amountPaidMinor, description: `Funds Paid via ${initialPaymentAccount.name}` },
          ],
          userId: input.userId,
        },
        db
      );
      initialPaymentJEId = payJE.id;

      // Reduce supplier total_payable_minor by amountPaidMinor
      if (supplierContact) {
        await db.query(
          `UPDATE accounting_contacts
           SET total_payable_minor = GREATEST(0, total_payable_minor - $1), updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [amountPaidMinor, supplierContact.id, input.workspaceId]
        );
      }

      // Insert Payment Record
      const payRes = await db.query<{ id: string }>(
        `INSERT INTO accounting_payments
           (workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor,
            payment_date, payment_method, reference_number, notes, journal_entry_id, created_by)
         VALUES ($1, $2, 'OUT', $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          input.workspaceId,
          paymentNumber,
          supplierContact?.id || null,
          initialPaymentAccount.id,
          amountPaidMinor,
          paymentDate,
          input.initialPayment?.paymentMethod || (initialPaymentAccount.subtype === "CASH" ? "CASH" : "BANK_TRANSFER"),
          input.initialPayment?.referenceNumber || null,
          input.initialPayment?.notes || `Payment on purchase ${purchaseNumber}`,
          payJE.id,
          input.userId || null,
        ]
      );
      initialPaymentId = payRes.rows[0].id;
    }

    // 10. Link in All Transactions: exactly ONE authoritative expense record
    // linked to the purchase so All Transactions displays it without duplicating cost
    const txRes = await db.query<UserTransactionRow>(
      `INSERT INTO accounting_transactions
         (workspace_id, journal_entry_id, type, category_id, financial_account_id, contact_id,
          amount_minor, date, notes, status, created_by)
       VALUES ($1, $2, 'EXPENSE', $3, $4, $5, $6, $7, $8, 'POSTED', $9)
       RETURNING *`,
      [
        input.workspaceId,
        purchaseJE.id,
        effectiveCategoryId,
        initialPaymentAccount ? initialPaymentAccount.id : apAcc.id,
        supplierContact?.id || null,
        totalMinor,
        purchaseDate,
        `Purchase ${purchaseNumber}${input.supplierBillNumber ? ` [Bill: ${input.supplierBillNumber}]` : ""}`,
        input.userId || null,
      ]
    );
    const linkedTx = txRes.rows[0];

    // 11. Insert Purchase Row
    const purchRes = await db.query<PurchaseRow>(
      `INSERT INTO accounting_purchases
         (workspace_id, purchase_number, supplier_id, supplier_name, supplier_bill_number,
          purchase_date, due_date, category_id, status, purchase_type, currency,
          subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor,
          notes, posted_journal_entry_id, transaction_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'INR', $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        input.workspaceId,
        purchaseNumber,
        supplierContact?.id || null,
        supplierName,
        input.supplierBillNumber?.trim() || null,
        purchaseDate,
        dueDate,
        effectiveCategoryId,
        finalStatus,
        purchaseType,
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        amountPaidMinor,
        amountDueMinor,
        input.notes?.trim() || null,
        purchaseJE.id,
        linkedTx.id,
        input.userId || null,
      ]
    );
    const purchase = purchRes.rows[0];

    // Link transaction to purchase
    await db.query(
      `UPDATE accounting_transactions SET purchase_id = $1 WHERE id = $2`,
      [purchase.id, linkedTx.id]
    );

    // 12. Insert Purchase Lines
    const insertedLines: PurchaseLineRow[] = [];
    for (const line of calculatedLines) {
      const lRes = await db.query<PurchaseLineRow>(
        `INSERT INTO accounting_purchase_lines
           (purchase_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          purchase.id,
          line.productId,
          line.description,
          line.quantity,
          line.unitPriceMinor,
          line.discountMinor,
          line.taxMinor,
          line.totalMinor,
          line.sortOrder,
        ]
      );
      insertedLines.push(lRes.rows[0]);
    }

    // 13. Insert Purchase Payment Record (if paid)
    if (amountPaidMinor > 0 && initialPaymentAccount && initialPaymentId) {
      await db.query(
        `INSERT INTO accounting_purchase_payments
           (workspace_id, purchase_id, payment_id, financial_account_id, amount_minor, payment_date, payment_method, reference_number, notes, journal_entry_id, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'POSTED', $11)`,
        [
          input.workspaceId,
          purchase.id,
          initialPaymentId,
          initialPaymentAccount.id,
          amountPaidMinor,
          input.initialPayment?.paymentDate || purchaseDate,
          input.initialPayment?.paymentMethod || (initialPaymentAccount.subtype === "CASH" ? "CASH" : "BANK_TRANSFER"),
          input.initialPayment?.referenceNumber || null,
          input.initialPayment?.notes || `Payment on purchase ${purchaseNumber}`,
          initialPaymentJEId,
          input.userId || null,
        ]
      );
    }

    // 14. Sync Attachments
    if (input.attachmentIds && input.attachmentIds.length > 0) {
      await db.query(
        `UPDATE accounting_transaction_attachments
         SET purchase_id = $1, transaction_id = $2, updated_at = NOW()
         WHERE id = ANY($3::uuid[]) AND workspace_id = $4`,
        [purchase.id, linkedTx.id, input.attachmentIds.slice(0, 5), input.workspaceId]
      );
    }

    // 15. Register Reminder if due date provided for unpaid/partially paid
    if (dueDate && amountDueMinor > 0 && input.userId) {
      await db.query(
        `INSERT INTO accounting_reminders
           (workspace_id, user_id, title, description, type, due_date, status)
         VALUES ($1, $2, $3, $4, 'BILL_DUE', $5, 'PENDING')`,
        [
          input.workspaceId,
          input.userId,
          `Bill payable: ₹${(amountDueMinor / 100).toFixed(2)} to ${supplierName || "Supplier"} (${purchaseNumber})`,
          input.notes || `Supplier bill payment due`,
          dueDate,
        ]
      );
    }

    return { purchase, lines: insertedLines };
  });
}

/**
 * Record an additional payment against an unpaid or partially paid purchase.
 */
export async function recordPurchasePayment(
  input: RecordPurchasePaymentInput,
  client?: Queryable
): Promise<{ purchase: PurchaseRow; payment: PurchasePaymentRow }> {
  const amountMinor = Math.round(Number(input.amountMinor) || 0);
  if (amountMinor <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  return withTransaction(async (db) => {
    // 1. Lock purchase row
    const pRes = await db.query<PurchaseRow>(
      `SELECT * FROM accounting_purchases WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [input.purchaseId, input.workspaceId]
    );
    if (pRes.rows.length === 0) {
      throw new Error("Purchase not found in this workspace.");
    }
    const purchase = pRes.rows[0];

    if (purchase.status === "DRAFT") {
      throw new Error("Cannot record payments on a draft purchase. Please post the purchase first.");
    }
    if (purchase.status === "VOIDED") {
      throw new Error("Cannot record payments on a voided purchase.");
    }
    if (purchase.status === "PAID" || Number(purchase.amount_due_minor) <= 0) {
      throw new Error(`Purchase ${purchase.purchase_number} is already fully paid.`);
    }

    const currentDue = Number(purchase.amount_due_minor);
    if (amountMinor > currentDue) {
      throw new Error(
        `Overpayment prevented: Cannot pay ₹${(amountMinor / 100).toFixed(2)} on purchase ${purchase.purchase_number} which only has ₹${(currentDue / 100).toFixed(2)} remaining due.`
      );
    }

    // 2. Validate payment account strictly Cash in Hand or Bank Account
    const paymentAccountId = input.financialAccountId || input.accountId;
    if (!paymentAccountId) {
      throw new Error("A payment account (Cash in Hand or Bank Account) is required.");
    }
    const finAcc = await validatePaymentAccount(input.workspaceId, paymentAccountId, db);

    // 3. Idempotency & Double-submission guards
    if (input.idempotencyKey) {
      const existingJE = await db.query<{ id: string }>(
        `SELECT id FROM accounting_journal_entries
         WHERE workspace_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [input.workspaceId, input.idempotencyKey]
      );
      if (existingJE.rows.length > 0) {
        const existingPurchPay = await db.query<PurchasePaymentRow>(
          `SELECT * FROM accounting_purchase_payments
           WHERE journal_entry_id = $1
           LIMIT 1`,
          [existingJE.rows[0].id]
        );
        if (existingPurchPay.rows.length > 0) {
          return { purchase, payment: existingPurchPay.rows[0] };
        }
      }
    } else {
      const recentDup = await db.query(
        `SELECT id FROM accounting_purchase_payments
         WHERE workspace_id = $1 AND purchase_id = $2 AND amount_minor = $3 AND created_at >= NOW() - INTERVAL '5 seconds'
         LIMIT 1`,
        [input.workspaceId, purchase.id, amountMinor]
      );
      if (recentDup.rows.length > 0) {
        throw new Error("Duplicate payment detected. Please wait a few seconds before trying again.");
      }
    }

    // 4. Generate sequential payment number
    const paymentDate = input.paymentDate || new Date().toISOString().slice(0, 10);
    const period = paymentDate.slice(0, 4) || new Date().getFullYear().toString();
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounting_payments WHERE workspace_id = $1`,
      [input.workspaceId]
    );
    const seq = parseInt(countRes.rows[0]?.count || "0", 10) + 1;
    const paymentNumber = `PAY-OUT-${period}-${seq.toString().padStart(4, "0")}`;

    // 5. Post Payment Disbursement Journal Entry:
    // Debit: Accounts Payable (2000) for amountMinor
    // Credit: Payment Account (1010/1020) for amountMinor
    const apAcc = await getFinancialAccountByCode(input.workspaceId, "2000", db);
    if (!apAcc) throw new Error("Accounts Payable account (2000) not found.");

    const { entry: payJE } = await postJournalEntry(
      {
        workspaceId: input.workspaceId,
        entryType: "PAYMENT_DISBURSEMENT",
        entryDate: paymentDate,
        description: input.notes || `Payment ${paymentNumber} for purchase ${purchase.purchase_number}`,
        reference: paymentNumber,
        sourceType: "PURCHASE_PAYMENT",
        idempotencyKey: input.idempotencyKey,
        lines: [
          { financialAccountId: apAcc.id, debitMinor: amountMinor, creditMinor: 0, description: `Accounts Payable settled for ${purchase.supplier_name || "Supplier"}` },
          { financialAccountId: finAcc.id, debitMinor: 0, creditMinor: amountMinor, description: `Funds Disbursed from ${finAcc.name}` },
        ],
        userId: input.userId,
      },
      db
    );

    // 6. Reduce supplier total_payable_minor
    if (purchase.supplier_id) {
      await db.query(
        `UPDATE accounting_contacts
         SET total_payable_minor = GREATEST(0, total_payable_minor - $1), updated_at = NOW()
         WHERE id = $2 AND workspace_id = $3`,
        [amountMinor, purchase.supplier_id, input.workspaceId]
      );
    }

    // 7. Insert Payment row in accounting_payments
    const payRes = await db.query<{ id: string }>(
      `INSERT INTO accounting_payments
         (workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor,
          payment_date, payment_method, reference_number, notes, journal_entry_id, created_by)
       VALUES ($1, $2, 'OUT', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        input.workspaceId,
        paymentNumber,
        purchase.supplier_id || null,
        finAcc.id,
        amountMinor,
        paymentDate,
        input.paymentMethod || (finAcc.subtype === "CASH" ? "CASH" : "BANK_TRANSFER"),
        input.referenceNumber || null,
        input.notes || `Settlement payment for purchase ${purchase.purchase_number}`,
        payJE.id,
        input.userId || null,
      ]
    );
    const paymentRecordId = payRes.rows[0].id;

    // 8. Insert into accounting_purchase_payments
    const purchPayRes = await db.query<PurchasePaymentRow>(
      `INSERT INTO accounting_purchase_payments
         (workspace_id, purchase_id, payment_id, financial_account_id, amount_minor,
          payment_date, payment_method, reference_number, notes, journal_entry_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'POSTED', $11)
       RETURNING *`,
      [
        input.workspaceId,
        purchase.id,
        paymentRecordId,
        finAcc.id,
        amountMinor,
        paymentDate,
        input.paymentMethod || (finAcc.subtype === "CASH" ? "CASH" : "BANK_TRANSFER"),
        input.referenceNumber || null,
        input.notes || null,
        payJE.id,
        input.userId || null,
      ]
    );

    // 9. Update Purchase balances & status
    const newPaid = Number(purchase.amount_paid_minor) + amountMinor;
    const newDue = currentDue - amountMinor;
    const newStatus: PurchaseStatus = newDue === 0 ? "PAID" : "PARTIALLY_PAID";

    const updatedPurchRes = await db.query<PurchaseRow>(
      `UPDATE accounting_purchases
       SET amount_paid_minor = $1, amount_due_minor = $2, status = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newPaid, newDue, newStatus, purchase.id]
    );

    // 10. Audit log (if actor user ID is present)
    if (input.userId) {
      await db.query(
        `INSERT INTO accounting_audit_logs
           (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, $2, 'STAFF', 'PURCHASE_PAYMENT_RECORDED', 'accounting_purchases', $3, $4, $5)`,
        [
          input.workspaceId,
          input.userId,
          purchase.id,
          JSON.stringify({ amount_paid: purchase.amount_paid_minor, amount_due: purchase.amount_due_minor, status: purchase.status }),
          JSON.stringify({ payment_id: purchPayRes.rows[0].id, amount_paid: newPaid, amount_due: newDue, status: newStatus }),
        ]
      );
    }

    return {
      purchase: updatedPurchRes.rows[0],
      payment: {
        ...purchPayRes.rows[0],
        account_name: finAcc.name,
        account_code: finAcc.code,
      },
    };
  });
}

/**
 * Updates a Draft purchase. Can optionally post it immediately.
 */
export async function updateDraftPurchase(
  input: UpdateDraftPurchaseInput,
  client?: Queryable
): Promise<{ purchase: PurchaseRow; lines: PurchaseLineRow[] }> {
  return withTransaction(async (db) => {
    const existingRes = await db.query<PurchaseRow>(
      `SELECT * FROM accounting_purchases WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [input.purchaseId, input.workspaceId]
    );
    if (existingRes.rows.length === 0) {
      throw new Error("Purchase not found.");
    }
    const existing = existingRes.rows[0];
    if (existing.status !== "DRAFT") {
      throw new Error("Only draft purchases can be edited via draft update. Posted purchases cannot change item lines.");
    }

    if (input.postNow) {
      // Re-invoke createPurchase logic by deleting draft lines and reposting
      const supplierId = input.supplierId !== undefined ? input.supplierId : existing.supplier_id;
      let lines = input.lines;
      if (!lines || lines.length === 0) {
        const curLinesRes = await db.query<PurchaseLineRow>(
          `SELECT * FROM accounting_purchase_lines WHERE purchase_id = $1 ORDER BY sort_order ASC`,
          [existing.id]
        );
        lines = curLinesRes.rows.map((l) => ({
          productId: l.product_id,
          description: l.description,
          quantity: Number(l.quantity),
          unitPriceMinor: Number(l.unit_price_minor),
          discountMinor: Number(l.discount_minor),
          taxMinor: Number(l.tax_minor),
        }));
      }

      // Delete the draft record so createPurchase posts cleanly
      await db.query(`DELETE FROM accounting_purchase_lines WHERE purchase_id = $1`, [existing.id]);
      await db.query(`DELETE FROM accounting_purchases WHERE id = $1`, [existing.id]);

      return createPurchase(
        {
          workspaceId: input.workspaceId,
          supplierId,
          supplierName: input.supplierName !== undefined ? input.supplierName : existing.supplier_name,
          supplierBillNumber: input.supplierBillNumber !== undefined ? input.supplierBillNumber : existing.supplier_bill_number,
          purchaseDate: input.purchaseDate || existing.purchase_date,
          dueDate: input.dueDate !== undefined ? input.dueDate : existing.due_date,
          categoryId: input.categoryId !== undefined ? input.categoryId : existing.category_id,
          subcategoryId: input.subcategoryId,
          status: input.statusIfPosting || "UNPAID",
          notes: input.notes !== undefined ? input.notes : existing.notes,
          lines,
          attachmentIds: input.attachmentIds,
          initialPayment: input.initialPayment,
          userId: input.userId,
        },
        db
      );
    }

    // Normal draft update (remains DRAFT)
    let supplierName = input.supplierName !== undefined ? input.supplierName : existing.supplier_name;
    if (input.supplierId) {
      const sup = await getContactById(input.workspaceId, input.supplierId);
      if (sup) supplierName = sup.name;
    }

    let calculated = null;
    let linesToInsert = input.lines;
    if (linesToInsert && linesToInsert.length > 0) {
      calculated = calculatePurchaseTotals(linesToInsert);
    }

    const subtotalMinor = calculated ? calculated.subtotalMinor : existing.subtotal_minor;
    const discountMinor = calculated ? calculated.discountMinor : existing.discount_minor;
    const taxMinor = calculated ? calculated.taxMinor : existing.tax_minor;
    const totalMinor = calculated ? calculated.totalMinor : existing.total_minor;

    const updatedRes = await db.query<PurchaseRow>(
      `UPDATE accounting_purchases
       SET supplier_id = $1, supplier_name = $2, supplier_bill_number = $3,
           purchase_date = $4, due_date = $5, category_id = $6, notes = $7,
           subtotal_minor = $8, discount_minor = $9, tax_minor = $10,
           total_minor = $11, amount_due_minor = $11, updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        input.supplierId !== undefined ? input.supplierId : existing.supplier_id,
        supplierName,
        input.supplierBillNumber !== undefined ? input.supplierBillNumber?.trim() || null : existing.supplier_bill_number,
        input.purchaseDate || existing.purchase_date,
        input.dueDate !== undefined ? input.dueDate : existing.due_date,
        input.categoryId !== undefined ? input.categoryId : existing.category_id,
        input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        existing.id,
      ]
    );

    if (calculated && linesToInsert) {
      await db.query(`DELETE FROM accounting_purchase_lines WHERE purchase_id = $1`, [existing.id]);
      for (const line of calculated.calculatedLines) {
        await db.query(
          `INSERT INTO accounting_purchase_lines
             (purchase_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            existing.id,
            line.productId,
            line.description,
            line.quantity,
            line.unitPriceMinor,
            line.discountMinor,
            line.taxMinor,
            line.totalMinor,
            line.sortOrder,
          ]
        );
      }
    }

    if (input.attachmentIds !== undefined) {
      await db.query(
        `UPDATE accounting_transaction_attachments
         SET purchase_id = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND workspace_id = $3`,
        [existing.id, input.attachmentIds.slice(0, 5), input.workspaceId]
      );
    }

    const linesRes = await db.query<PurchaseLineRow>(
      `SELECT * FROM accounting_purchase_lines WHERE purchase_id = $1 ORDER BY sort_order ASC`,
      [existing.id]
    );

    return { purchase: updatedRes.rows[0], lines: linesRes.rows };
  });
}

/**
 * Updates metadata (notes, supplier bill number, category, attachments) for a POSTED purchase.
 * Strictly guarantees that balances and journals are NEVER touched.
 */
export async function updatePurchaseMetadata(
  workspaceIdOrInput:
    | string
    | {
        workspaceId: string;
        purchaseId: string;
        supplierBillNumber?: string | null;
        notes?: string | null;
        categoryId?: string | null;
        subcategoryId?: string | null;
        attachmentIds?: string[];
        userId?: string;
      },
  purchaseIdParam?: string,
  inputParam?: {
    supplierBillNumber?: string | null;
    notes?: string | null;
    categoryId?: string | null;
    subcategoryId?: string | null;
    attachmentIds?: string[];
  },
  userIdParam?: string
): Promise<PurchaseRow> {
  const isObj = typeof workspaceIdOrInput === "object";
  const workspaceId = isObj ? workspaceIdOrInput.workspaceId : (workspaceIdOrInput as string);
  const purchaseId = isObj ? workspaceIdOrInput.purchaseId : (purchaseIdParam as string);
  const input = isObj ? workspaceIdOrInput : inputParam || {};
  const userId = isObj ? workspaceIdOrInput.userId : userIdParam;

  return withTransaction(async (db) => {
    const existingRes = await db.query<PurchaseRow>(
      `SELECT * FROM accounting_purchases WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [purchaseId, workspaceId]
    );
    if (existingRes.rows.length === 0) {
      throw new Error("Purchase not found.");
    }
    const existing = existingRes.rows[0];
    if (existing.status === "VOIDED") {
      throw new Error("Cannot edit a voided purchase.");
    }

    let categoryId = existing.category_id;
    const catTarget = input.subcategoryId || input.categoryId;
    if (catTarget !== undefined) {
      if (catTarget) {
        const catCheck = await db.query(
          `SELECT id, type, is_archived FROM accounting_categories WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
          [catTarget, workspaceId]
        );
        if (catCheck.rows.length === 0) {
          throw new Error("Selected category does not exist in this workspace.");
        }
        if (catCheck.rows[0].is_archived) {
          throw new Error("Cannot assign an archived category.");
        }
        if (catCheck.rows[0].type !== "EXPENSE") {
          throw new Error("Purchases must use an Expense category.");
        }
        categoryId = catCheck.rows[0].id;
      } else {
        categoryId = null;
      }
    }

    const supplierBillNumber =
      input.supplierBillNumber !== undefined ? input.supplierBillNumber?.trim() || null : existing.supplier_bill_number;
    const notes = input.notes !== undefined ? input.notes?.trim() || null : existing.notes;

    const res = await db.query<PurchaseRow>(
      `UPDATE accounting_purchases
       SET supplier_bill_number = $1, notes = $2, category_id = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [supplierBillNumber, notes, categoryId, purchaseId]
    );

    // Sync attachments without affecting financial ledger
    if (input.attachmentIds !== undefined) {
      await db.query(
        `UPDATE accounting_transaction_attachments
         SET purchase_id = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND workspace_id = $3`,
        [purchaseId, input.attachmentIds.slice(0, 5), workspaceId]
      );
    }

    return res.rows[0];
  });
}

/**
 * Voids a purchase and coordinates reversals of the purchase and any linked payments.
 * Balances, supplier payables, and audit history are properly reversed.
 */
export async function voidPurchase(
  workspaceId: string,
  purchaseId: string,
  reason: string,
  userId?: string
): Promise<PurchaseRow> {
  if (!reason || reason.trim().length < 3) {
    throw new Error("A valid reason is required to void a purchase (minimum 3 characters).");
  }

  return withTransaction(async (db) => {
    // 1. Lock purchase row
    const pRes = await db.query<PurchaseRow>(
      `SELECT * FROM accounting_purchases WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [purchaseId, workspaceId]
    );
    if (pRes.rows.length === 0) {
      throw new Error("Purchase not found.");
    }
    const purchase = pRes.rows[0];

    if (purchase.status === "VOIDED") {
      throw new Error("Purchase is already voided.");
    }

    // If DRAFT: simply mark VOIDED
    if (purchase.status === "DRAFT") {
      const vRes = await db.query<PurchaseRow>(
        `UPDATE accounting_purchases
         SET status = 'VOIDED', voided_at = NOW(), voided_by = $1, void_reason = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [userId || null, reason.trim(), purchase.id]
      );
      return vRes.rows[0];
    }

    // 2. Reverse all active linked payments in accounting_purchase_payments
    const paymentsRes = await db.query<PurchasePaymentRow>(
      `SELECT * FROM accounting_purchase_payments
       WHERE purchase_id = $1 AND workspace_id = $2 AND status = 'POSTED'`,
      [purchase.id, workspaceId]
    );

    for (const payment of paymentsRes.rows) {
      if (payment.journal_entry_id) {
        // Reverse payment disbursement journal entry (Debits Cash/Bank, Credits AP)
        await reverseJournalEntry(workspaceId, payment.journal_entry_id, `Reversal of payment on voided purchase ${purchase.purchase_number}: ${reason}`, userId, db);
      }

      // Restore supplier payable by payment amount
      if (purchase.supplier_id) {
        await db.query(
          `UPDATE accounting_contacts
           SET total_payable_minor = total_payable_minor + $1, updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [payment.amount_minor, purchase.supplier_id, workspaceId]
        );
      }

      // Mark payment row voided
      await db.query(
        `UPDATE accounting_purchase_payments
         SET status = 'VOIDED', updated_at = NOW()
         WHERE id = $1`,
        [payment.id]
      );

      // If linked to accounting_payments, update its notes
      if (payment.payment_id) {
        await db.query(
          `UPDATE accounting_payments
           SET notes = COALESCE(notes, '') || ' [VOIDED with purchase ' || $1 || ']'
           WHERE id = $2`,
          [purchase.purchase_number, payment.payment_id]
        );
      }
    }

    // 3. Reverse the purchase journal entry (Credits Expense 5000, Debits AP 2000)
    if (purchase.posted_journal_entry_id) {
      await reverseJournalEntry(workspaceId, purchase.posted_journal_entry_id, `Voided purchase ${purchase.purchase_number}: ${reason}`, userId, db);
    }

    // 4. Reduce supplier total_payable_minor by purchase total
    if (purchase.supplier_id) {
      await db.query(
        `UPDATE accounting_contacts
         SET total_payable_minor = GREATEST(0, total_payable_minor - $1), updated_at = NOW()
         WHERE id = $2 AND workspace_id = $3`,
        [purchase.total_minor, purchase.supplier_id, workspaceId]
      );
    }

    // 5. Void linked transaction row in accounting_transactions so it moves to Voided section
    if (purchase.transaction_id) {
      await db.query(
        `UPDATE accounting_transactions
         SET status = 'VOIDED', voided_at = NOW(), voided_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [userId || null, purchase.transaction_id]
      );
    }

    // 6. Update purchase record status to VOIDED
    const updatedPurchRes = await db.query<PurchaseRow>(
      `UPDATE accounting_purchases
       SET status = 'VOIDED', voided_at = NOW(), voided_by = $1, void_reason = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [userId || null, reason.trim(), purchase.id]
    );

    // 7. Audit Log (if actor user ID is present)
    if (userId) {
      await db.query(
        `INSERT INTO accounting_audit_logs
           (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, $2, 'STAFF', 'PURCHASE_VOIDED', 'accounting_purchases', $3, $4, $5)`,
        [
          workspaceId,
          userId,
          purchase.id,
          JSON.stringify({ status: purchase.status, total: purchase.total_minor, paid: purchase.amount_paid_minor }),
          JSON.stringify({ status: "VOIDED", reason: reason.trim(), voided_by: userId }),
        ]
      );
    }

    return updatedPurchRes.rows[0];
  });
}

/**
 * Restores a voided purchase.
 * Safeguarded against duplicate restorations or duplicate financial postings.
 */
export async function restorePurchase(
  workspaceId: string,
  purchaseId: string,
  reason: string = "Purchase restored by user",
  userId?: string
): Promise<PurchaseRow> {
  return withTransaction(async (db) => {
    const pRes = await db.query<PurchaseRow>(
      `SELECT * FROM accounting_purchases WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [purchaseId, workspaceId]
    );
    if (pRes.rows.length === 0) {
      throw new Error("Purchase not found.");
    }
    const purchase = pRes.rows[0];

    if (purchase.status !== "VOIDED") {
      throw new Error("Purchase is not voided and cannot be restored.");
    }

    // Reinstate Purchase Journal Entry (Debit Expense 5000, Credit AP 2000)
    const expenseAcc = await getFinancialAccountByCode(workspaceId, "5000", db);
    const apAcc = await getFinancialAccountByCode(workspaceId, "2000", db);
    if (!expenseAcc || !apAcc) {
      throw new Error("Chart of accounts is missing Operating Expenses (5000) or Accounts Payable (2000).");
    }

    const totalMinor = Number(purchase.total_minor);
    const pDate = purchase.purchase_date ? String(purchase.purchase_date).slice(0, 10) : new Date().toISOString().slice(0, 10);

    const { entry: reinstatementJE } = await postJournalEntry(
      {
        workspaceId,
        entryType: "EXPENSE",
        entryDate: pDate,
        description: `Reinstatement of purchase ${purchase.purchase_number}: ${reason}`,
        reference: purchase.purchase_number,
        sourceType: "PURCHASE",
        lines: [
          { financialAccountId: expenseAcc.id, debitMinor: totalMinor, creditMinor: 0, description: "Restored Purchase Expense" },
          { financialAccountId: apAcc.id, debitMinor: 0, creditMinor: totalMinor, description: `Payable to ${purchase.supplier_name || "Supplier"}` },
        ],
        userId,
      },
      db
    );

    // Reinstate supplier total_payable_minor
    if (purchase.supplier_id) {
      await db.query(
        `UPDATE accounting_contacts
         SET total_payable_minor = total_payable_minor + $1, updated_at = NOW()
         WHERE id = $2 AND workspace_id = $3`,
        [totalMinor, purchase.supplier_id, workspaceId]
      );
    }

    // Reinstate transaction row
    if (purchase.transaction_id) {
      await db.query(
        `UPDATE accounting_transactions
         SET status = 'POSTED', journal_entry_id = $1, restored_at = NOW(), restored_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [reinstatementJE.id, userId || null, purchase.transaction_id]
      );
    }

    // Return purchase to UNPAID status with original balance due
    const updatedPurch = await db.query<PurchaseRow>(
      `UPDATE accounting_purchases
       SET status = 'UNPAID', amount_paid_minor = 0, amount_due_minor = $1,
           posted_journal_entry_id = $2, voided_at = NULL, voided_by = NULL, void_reason = NULL, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [totalMinor, reinstatementJE.id, purchase.id]
    );

    // Audit log (if actor user ID is present)
    if (userId) {
      await db.query(
        `INSERT INTO accounting_audit_logs
           (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, $2, 'STAFF', 'PURCHASE_RESTORED', 'accounting_purchases', $3, $4, $5)`,
        [
          workspaceId,
          userId,
          purchase.id,
          JSON.stringify({ status: "VOIDED" }),
          JSON.stringify({ status: "UNPAID", restored_by: userId, reason }),
        ]
      );
    }

    return updatedPurch.rows[0];
  });
}

/**
 * List purchases with pagination, status filter, and multi-field search.
 */
export async function listPurchases(
  workspaceId: string,
  filter: ListPurchasesFilter = {}
): Promise<{ purchases: PurchaseRow[]; total: number }> {
  let where = `WHERE p.workspace_id = $1`;
  const params: unknown[] = [workspaceId];

  if (filter.status && filter.status !== "ALL") {
    params.push(filter.status);
    where += ` AND p.status = $${params.length}`;
  }

  if (filter.supplierId) {
    params.push(filter.supplierId);
    where += ` AND p.supplier_id = $${params.length}`;
  }

  if (filter.startDate) {
    params.push(filter.startDate);
    where += ` AND p.purchase_date >= $${params.length}`;
  }

  if (filter.endDate) {
    params.push(filter.endDate);
    where += ` AND p.purchase_date <= $${params.length}`;
  }

  if (filter.search && filter.search.trim()) {
    params.push(`%${filter.search.trim().toLowerCase()}%`);
    where += ` AND (
      LOWER(p.purchase_number) LIKE $${params.length}
      OR LOWER(COALESCE(p.supplier_bill_number, '')) LIKE $${params.length}
      OR LOWER(COALESCE(p.supplier_name, '')) LIKE $${params.length}
      OR LOWER(COALESCE(c.name, '')) LIKE $${params.length}
    )`;
  }

  const countQuery = `
    SELECT COUNT(*) as count
    FROM accounting_purchases p
    LEFT JOIN accounting_contacts c ON c.id = p.supplier_id
    ${where}
  `;
  const total = parseInt((await pool.query<{ count: string }>(countQuery, params)).rows[0]?.count || "0", 10);

  const limit = Math.min(100, Math.max(1, filter.limit || 25));
  const offset = Math.max(0, filter.offset || 0);

  params.push(limit, offset);
  const dataQuery = `
    SELECT p.*,
           c.name as supplier_name_contact,
           c.email as supplier_email,
           c.phone as supplier_phone,
           c.address as supplier_address,
           cat.name as category_name,
           parent_cat.name as parent_category_name,
           CASE
             WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
             ELSE cat.name
           END as main_category_name,
           CASE
             WHEN parent_cat.id IS NOT NULL THEN cat.name
             ELSE NULL
           END as subcategory_name,
           COALESCE((
             SELECT COUNT(*)
             FROM accounting_transaction_attachments att
             WHERE att.purchase_id = p.id
           ), 0)::int as attachment_count
    FROM accounting_purchases p
    LEFT JOIN accounting_contacts c ON c.id = p.supplier_id
    LEFT JOIN accounting_categories cat ON cat.id = p.category_id
    LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
    ${where}
    ORDER BY p.purchase_date DESC, p.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const res = await pool.query<PurchaseRow>(dataQuery, params);
  const purchases = res.rows.map((row) => ({
    ...row,
    supplier_name: row.supplier_name || (row as any).supplier_name_contact || "Unknown Supplier",
  }));

  return { purchases, total };
}

/**
 * Get detailed purchase record including lines, payments, and attachments.
 */
export async function getPurchaseById(
  workspaceId: string,
  purchaseId: string
): Promise<PurchaseRow | null> {
  const pRes = await pool.query<PurchaseRow>(
    `SELECT p.*,
            c.name as supplier_name_contact,
            c.email as supplier_email,
            c.phone as supplier_phone,
            c.address as supplier_address,
            cat.name as category_name,
            parent_cat.name as parent_category_name,
            CASE
              WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
              ELSE cat.name
            END as main_category_name,
            CASE
              WHEN parent_cat.id IS NOT NULL THEN cat.name
              ELSE NULL
            END as subcategory_name
     FROM accounting_purchases p
     LEFT JOIN accounting_contacts c ON c.id = p.supplier_id
     LEFT JOIN accounting_categories cat ON cat.id = p.category_id
     LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
     WHERE p.id = $1 AND p.workspace_id = $2
     LIMIT 1`,
    [purchaseId, workspaceId]
  );
  if (pRes.rows.length === 0) return null;

  const purchase = pRes.rows[0];
  purchase.supplier_name = purchase.supplier_name || (purchase as any).supplier_name_contact || "Unknown Supplier";

  // Lines
  const linesRes = await pool.query<PurchaseLineRow>(
    `SELECT l.*, prod.name as product_name, prod.sku
     FROM accounting_purchase_lines l
     LEFT JOIN accounting_products prod ON prod.id = l.product_id
     WHERE l.purchase_id = $1
     ORDER BY l.sort_order ASC`,
    [purchase.id]
  );
  purchase.lines = linesRes.rows;

  // Payments
  const paymentsRes = await pool.query<PurchasePaymentRow>(
    `SELECT pp.*, fa.name as account_name, fa.code as account_code
     FROM accounting_purchase_payments pp
     LEFT JOIN accounting_financial_accounts fa ON fa.id = pp.financial_account_id
     WHERE pp.purchase_id = $1 AND pp.workspace_id = $2
     ORDER BY pp.payment_date DESC, pp.created_at DESC`,
    [purchase.id, workspaceId]
  );
  purchase.payments = paymentsRes.rows;

  // Attachments
  const attRes = await pool.query<TransactionAttachmentRow>(
    `SELECT * FROM accounting_transaction_attachments
     WHERE purchase_id = $1 AND workspace_id = $2
     ORDER BY created_at ASC`,
    [purchase.id, workspaceId]
  );
  purchase.attachments = attRes.rows.map((row) => ({
    ...row,
    url: `/api/accounting/transactions/attachments/${row.id}`,
    download_url: `/api/accounting/transactions/attachments/${row.id}?download=1`,
  }));
  purchase.attachment_count = purchase.attachments.length;

  return purchase;
}

/**
 * Delete a draft purchase.
 */
export async function deleteDraftPurchase(workspaceId: string, purchaseId: string): Promise<boolean> {
  return withTransaction(async (db) => {
    const existingRes = await db.query(
      `SELECT status FROM accounting_purchases WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [purchaseId, workspaceId]
    );
    if (existingRes.rows.length === 0) {
      throw new Error("Purchase not found.");
    }
    if (existingRes.rows[0].status !== "DRAFT") {
      throw new Error("Only draft purchases can be deleted.");
    }

    await db.query(`DELETE FROM accounting_purchase_lines WHERE purchase_id = $1`, [purchaseId]);
    await db.query(`DELETE FROM accounting_purchases WHERE id = $1`, [purchaseId]);
    return true;
  });
}
