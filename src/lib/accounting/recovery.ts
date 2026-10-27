import "server-only";
import crypto from "crypto";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  RecoveryRecordCounts,
  FinancialSummary,
  RecoveryVersionRow,
  ProfileTemplate,
} from "./types";
import { seedDefaultChartOfAccounts } from "./accounts";
import { seedDefaultCategories } from "./categories";

/**
 * Deterministic canonicalization for consistent SHA-256 payload hashing.
 */
function canonicalize(val: any): any {
  if (val === null || typeof val !== "object") {
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (Array.isArray(val)) {
    return val.map(canonicalize);
  }
  const sortedKeys = Object.keys(val).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(val[key]);
  }
  return result;
}

/**
 * Computes canonical SHA-256 checksum of an accounting snapshot payload.
 */
export function computePayloadChecksum(payload: Record<string, any>): string {
  const normalized = JSON.parse(JSON.stringify(payload));
  const canonicalJson = JSON.stringify(canonicalize(normalized));
  return crypto.createHash("sha256").update(canonicalJson).digest("hex");
}

/**
 * Counts all active records for a workspace across all accounting-owned tables.
 */
export async function fetchWorkspaceRecordCounts(
  workspaceId: string,
  client?: Queryable
): Promise<RecoveryRecordCounts> {
  const db = client || pool;
  const res = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM accounting_financial_accounts WHERE workspace_id = $1) AS financial_accounts,
      (SELECT COUNT(*)::int FROM accounting_categories WHERE workspace_id = $1) AS categories,
      (SELECT COUNT(*)::int FROM accounting_contacts WHERE workspace_id = $1) AS contacts,
      (SELECT COUNT(*)::int FROM accounting_products WHERE workspace_id = $1) AS products,
      (SELECT COUNT(*)::int FROM accounting_journal_entries WHERE workspace_id = $1) AS journal_entries,
      (SELECT COUNT(*)::int FROM accounting_journal_lines l JOIN accounting_journal_entries e ON l.journal_entry_id = e.id WHERE e.workspace_id = $1) AS journal_lines,
      (SELECT COUNT(*)::int FROM accounting_invoices WHERE workspace_id = $1) AS invoices,
      (SELECT COUNT(*)::int FROM accounting_invoice_lines l JOIN accounting_invoices i ON l.invoice_id = i.id WHERE i.workspace_id = $1) AS invoice_lines,
      (SELECT COUNT(*)::int FROM accounting_invoice_sequences WHERE workspace_id = $1) AS invoice_sequences,
      (SELECT COUNT(*)::int FROM accounting_sales WHERE workspace_id = $1) AS sales,
      (SELECT COUNT(*)::int FROM accounting_payments WHERE workspace_id = $1) AS payments,
      (SELECT COUNT(*)::int FROM accounting_payment_allocations a JOIN accounting_payments p ON a.payment_id = p.id WHERE p.workspace_id = $1) AS payment_allocations,
      (SELECT COUNT(*)::int FROM accounting_transactions WHERE workspace_id = $1) AS transactions,
      (SELECT COUNT(*)::int FROM accounting_transaction_attachments WHERE workspace_id = $1) AS transaction_attachments,
      (SELECT COUNT(*)::int FROM accounting_loans WHERE workspace_id = $1) AS loans,
      (SELECT COUNT(*)::int FROM accounting_loan_installments i JOIN accounting_loans l ON i.loan_id = l.id WHERE l.workspace_id = $1) AS loan_installments,
      (SELECT COUNT(*)::int FROM accounting_budgets WHERE workspace_id = $1) AS budgets,
      (SELECT COUNT(*)::int FROM accounting_recurring_rules WHERE workspace_id = $1) AS recurring_rules,
      (SELECT COUNT(*)::int FROM accounting_reminders WHERE workspace_id = $1) AS reminders
  `, [workspaceId]);

  const row = res.rows[0] || {};
  return {
    financialAccounts: row.financial_accounts || 0,
    categories: row.categories || 0,
    contacts: row.contacts || 0,
    products: row.products || 0,
    journalEntries: row.journal_entries || 0,
    journalLines: row.journal_lines || 0,
    invoices: row.invoices || 0,
    invoiceLines: row.invoice_lines || 0,
    invoiceSequences: row.invoice_sequences || 0,
    sales: row.sales || 0,
    payments: row.payments || 0,
    paymentAllocations: row.payment_allocations || 0,
    transactions: row.transactions || 0,
    transactionAttachments: row.transaction_attachments || 0,
    loans: row.loans || 0,
    loanInstallments: row.loan_installments || 0,
    budgets: row.budgets || 0,
    recurringRules: row.recurring_rules || 0,
    reminders: row.reminders || 0,
  };
}

/**
 * Computes financial ledger summary totals for reconciliation and preview.
 */
export async function fetchWorkspaceFinancialSummary(
  workspaceId: string,
  client?: Queryable
): Promise<FinancialSummary> {
  const db = client || pool;

  const wsRes = await db.query<{ currency: string }>(
    `SELECT currency FROM accounting_workspaces WHERE id = $1`,
    [workspaceId]
  );
  const currency = wsRes.rows[0]?.currency || "INR";

  const balancesRes = await db.query(`
    SELECT
      COUNT(*)::int AS accounts_count,
      COALESCE(SUM(current_balance_minor), 0)::bigint AS net_balance,
      COALESCE(SUM(CASE WHEN subtype = 'RECEIVABLE' THEN current_balance_minor ELSE 0 END), 0)::bigint AS receivable_balance,
      COALESCE(SUM(CASE WHEN subtype = 'PAYABLE' THEN current_balance_minor ELSE 0 END), 0)::bigint AS payable_balance
    FROM accounting_financial_accounts
    WHERE workspace_id = $1 AND is_active = true
  `, [workspaceId]);

  const bRow = balancesRes.rows[0] || {};

  const txRes = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'INCOME' AND status = 'POSTED' THEN amount_minor ELSE 0 END), 0)::bigint AS total_inflow,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' AND status = 'POSTED' THEN amount_minor ELSE 0 END), 0)::bigint AS total_outflow
    FROM accounting_transactions
    WHERE workspace_id = $1
  `, [workspaceId]);

  const tRow = txRes.rows[0] || {};

  const invRes = await db.query(`
    SELECT COUNT(*)::int AS unpaid_count
    FROM accounting_invoices
    WHERE workspace_id = $1 AND status IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE')
  `, [workspaceId]);

  return {
    accountsCount: bRow.accounts_count || 0,
    netBalanceMinor: Number(bRow.net_balance || 0),
    totalInflowMinor: Number(tRow.total_inflow || 0),
    totalOutflowMinor: Number(tRow.total_outflow || 0),
    receivableMinor: Number(bRow.receivable_balance || 0),
    payableMinor: Number(bRow.payable_balance || 0),
    unpaidInvoicesCount: invRes.rows[0]?.unpaid_count || 0,
    currency,
  };
}

/**
 * Checks whether the workspace currently contains post-reset accounting activity
 * (active transactions, posted invoices, payments, loans, sales, or non-zero balances).
 */
export async function hasActiveAccountingActivity(
  workspaceId: string,
  client?: Queryable
): Promise<boolean> {
  const db = client || pool;
  const res = await db.query<{ count: string }>(`
    SELECT (
      (SELECT COUNT(*) FROM accounting_transactions WHERE workspace_id = $1) +
      (SELECT COUNT(*) FROM accounting_invoices WHERE workspace_id = $1) +
      (SELECT COUNT(*) FROM accounting_payments WHERE workspace_id = $1) +
      (SELECT COUNT(*) FROM accounting_loans WHERE workspace_id = $1) +
      (SELECT COUNT(*) FROM accounting_sales WHERE workspace_id = $1) +
      (SELECT COUNT(*) FROM accounting_journal_entries WHERE workspace_id = $1 AND source_type != 'OPENING_BALANCE') +
      (SELECT COUNT(*) FROM accounting_financial_accounts WHERE workspace_id = $1 AND (opening_balance_minor != 0 OR current_balance_minor != 0))
    ) AS count
  `, [workspaceId]);

  return parseInt(res.rows[0]?.count || "0", 10) > 0;
}

/**
 * Captures a complete, internally consistent snapshot of all Accounting-owned data.
 * All non-accounting tables are strictly excluded.
 */
export async function captureWorkspaceSnapshot(
  workspaceId: string,
  client: Queryable
): Promise<{
  payload: Record<string, any>;
  recordCounts: RecoveryRecordCounts;
  financialSummary: FinancialSummary;
  checksum: string;
}> {
  // 1. Fetch all records from every accounting-owned table for this workspace
  const financialAccounts = (
    await client.query(
      `SELECT * FROM accounting_financial_accounts WHERE workspace_id = $1 ORDER BY code ASC`,
      [workspaceId]
    )
  ).rows;

  const categories = (
    await client.query(
      `SELECT * FROM accounting_categories WHERE workspace_id = $1 ORDER BY sort_order ASC, name ASC`,
      [workspaceId]
    )
  ).rows;

  const contacts = (
    await client.query(
      `SELECT * FROM accounting_contacts WHERE workspace_id = $1 ORDER BY name ASC`,
      [workspaceId]
    )
  ).rows;

  const products = (
    await client.query(
      `SELECT * FROM accounting_products WHERE workspace_id = $1 ORDER BY name ASC`,
      [workspaceId]
    )
  ).rows;

  const journalEntries = (
    await client.query(
      `SELECT * FROM accounting_journal_entries WHERE workspace_id = $1 ORDER BY entry_date ASC, created_at ASC`,
      [workspaceId]
    )
  ).rows;

  const journalLines = (
    await client.query(
      `SELECT l.* FROM accounting_journal_lines l
       JOIN accounting_journal_entries e ON l.journal_entry_id = e.id
       WHERE e.workspace_id = $1 ORDER BY l.id ASC`,
      [workspaceId]
    )
  ).rows;

  const invoices = (
    await client.query(
      `SELECT * FROM accounting_invoices WHERE workspace_id = $1 ORDER BY issue_date ASC, created_at ASC`,
      [workspaceId]
    )
  ).rows;

  const invoiceLines = (
    await client.query(
      `SELECT l.* FROM accounting_invoice_lines l
       JOIN accounting_invoices i ON l.invoice_id = i.id
       WHERE i.workspace_id = $1 ORDER BY l.sort_order ASC, l.id ASC`,
      [workspaceId]
    )
  ).rows;

  const invoiceSequences = (
    await client.query(
      `SELECT * FROM accounting_invoice_sequences WHERE workspace_id = $1 ORDER BY period ASC`,
      [workspaceId]
    )
  ).rows;

  const sales = (
    await client.query(
      `SELECT * FROM accounting_sales WHERE workspace_id = $1 ORDER BY date ASC, created_at ASC`,
      [workspaceId]
    )
  ).rows;

  const payments = (
    await client.query(
      `SELECT * FROM accounting_payments WHERE workspace_id = $1 ORDER BY payment_date ASC, created_at ASC`,
      [workspaceId]
    )
  ).rows;

  const paymentAllocations = (
    await client.query(
      `SELECT a.* FROM accounting_payment_allocations a
       JOIN accounting_payments p ON a.payment_id = p.id
       WHERE p.workspace_id = $1 ORDER BY a.created_at ASC`,
      [workspaceId]
    )
  ).rows;

  const transactions = (
    await client.query(
      `SELECT * FROM accounting_transactions WHERE workspace_id = $1 ORDER BY date ASC, created_at ASC`,
      [workspaceId]
    )
  ).rows;

  const transactionAttachments = (
    await client.query(
      `SELECT * FROM accounting_transaction_attachments WHERE workspace_id = $1 ORDER BY created_at ASC`,
      [workspaceId]
    )
  ).rows;

  const loans = (
    await client.query(
      `SELECT * FROM accounting_loans WHERE workspace_id = $1 ORDER BY start_date ASC`,
      [workspaceId]
    )
  ).rows;

  const loanInstallments = (
    await client.query(
      `SELECT i.* FROM accounting_loan_installments i
       JOIN accounting_loans l ON i.loan_id = l.id
       WHERE l.workspace_id = $1 ORDER BY i.installment_number ASC`,
      [workspaceId]
    )
  ).rows;

  const budgets = (
    await client.query(
      `SELECT * FROM accounting_budgets WHERE workspace_id = $1 ORDER BY period_start ASC`,
      [workspaceId]
    )
  ).rows;

  const recurringRules = (
    await client.query(
      `SELECT * FROM accounting_recurring_rules WHERE workspace_id = $1 ORDER BY next_due_date ASC`,
      [workspaceId]
    )
  ).rows;

  const reminders = (
    await client.query(
      `SELECT * FROM accounting_reminders WHERE workspace_id = $1 ORDER BY due_date ASC`,
      [workspaceId]
    )
  ).rows;

  const wsSettingsRes = await client.query(
    `SELECT settings FROM accounting_workspaces WHERE id = $1`,
    [workspaceId]
  );
  const workspaceSettings = wsSettingsRes.rows[0]?.settings || {};

  const payload: Record<string, any> = {
    workspaceId,
    financialAccounts,
    categories,
    contacts,
    products,
    journalEntries,
    journalLines,
    invoices,
    invoiceLines,
    invoiceSequences,
    sales,
    payments,
    paymentAllocations,
    transactions,
    transactionAttachments,
    loans,
    loanInstallments,
    budgets,
    recurringRules,
    reminders,
    workspaceSettings,
  };

  const recordCounts: RecoveryRecordCounts = {
    financialAccounts: financialAccounts.length,
    categories: categories.length,
    contacts: contacts.length,
    products: products.length,
    journalEntries: journalEntries.length,
    journalLines: journalLines.length,
    invoices: invoices.length,
    invoiceLines: invoiceLines.length,
    invoiceSequences: invoiceSequences.length,
    sales: sales.length,
    payments: payments.length,
    paymentAllocations: paymentAllocations.length,
    transactions: transactions.length,
    transactionAttachments: transactionAttachments.length,
    loans: loans.length,
    loanInstallments: loanInstallments.length,
    budgets: budgets.length,
    recurringRules: recurringRules.length,
    reminders: reminders.length,
  };

  const financialSummary = await fetchWorkspaceFinancialSummary(workspaceId, client);
  const checksum = computePayloadChecksum(payload);

  return { payload, recordCounts, financialSummary, checksum };
}

/**
 * Transactionally wipes all active accounting records for a workspace in reverse FK order.
 * Strictly scopes every DELETE query by workspace_id.
 * Non-accounting tables and workspace identity/members are never touched.
 */
export async function wipeActiveAccountingRecords(
  workspaceId: string,
  client: Queryable
): Promise<void> {
  // 1. Transaction attachments
  await client.query(`DELETE FROM accounting_transaction_attachments WHERE workspace_id = $1`, [workspaceId]);

  // 2. Payment allocations
  await client.query(
    `DELETE FROM accounting_payment_allocations
     WHERE payment_id IN (SELECT id FROM accounting_payments WHERE workspace_id = $1)`,
    [workspaceId]
  );

  // 3. Loan installments
  await client.query(
    `DELETE FROM accounting_loan_installments
     WHERE loan_id IN (SELECT id FROM accounting_loans WHERE workspace_id = $1)`,
    [workspaceId]
  );

  // 4. Quick UI transactions
  await client.query(`DELETE FROM accounting_transactions WHERE workspace_id = $1`, [workspaceId]);

  // 5. Sales
  await client.query(`DELETE FROM accounting_sales WHERE workspace_id = $1`, [workspaceId]);

  // 6. Invoice lines
  await client.query(
    `DELETE FROM accounting_invoice_lines
     WHERE invoice_id IN (SELECT id FROM accounting_invoices WHERE workspace_id = $1)`,
    [workspaceId]
  );

  // 7. Invoices
  await client.query(`DELETE FROM accounting_invoices WHERE workspace_id = $1`, [workspaceId]);

  // 8. Payments
  await client.query(`DELETE FROM accounting_payments WHERE workspace_id = $1`, [workspaceId]);

  // 9. Loans
  await client.query(`DELETE FROM accounting_loans WHERE workspace_id = $1`, [workspaceId]);

  // 10. Budgets
  await client.query(`DELETE FROM accounting_budgets WHERE workspace_id = $1`, [workspaceId]);

  // 11. Recurring rules
  await client.query(`DELETE FROM accounting_recurring_rules WHERE workspace_id = $1`, [workspaceId]);

  // 12. Reminders
  await client.query(`DELETE FROM accounting_reminders WHERE workspace_id = $1`, [workspaceId]);

  // 13. Invoice sequences
  await client.query(`DELETE FROM accounting_invoice_sequences WHERE workspace_id = $1`, [workspaceId]);

  // 14. Journal lines
  await client.query(
    `DELETE FROM accounting_journal_lines
     WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`,
    [workspaceId]
  );

  // 15. Journal entries (clear self-referential reversal references first)
  await client.query(
    `UPDATE accounting_journal_entries
     SET reversal_of_entry_id = NULL, reversed_by_entry_id = NULL
     WHERE workspace_id = $1`,
    [workspaceId]
  );
  await client.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [workspaceId]);

  // 16. Contacts
  await client.query(`DELETE FROM accounting_contacts WHERE workspace_id = $1`, [workspaceId]);

  // 17. Products
  await client.query(`DELETE FROM accounting_products WHERE workspace_id = $1`, [workspaceId]);

  // 18. Categories (clear parent_id first to avoid self-referential FK constraints)
  await client.query(`UPDATE accounting_categories SET parent_id = NULL WHERE workspace_id = $1`, [workspaceId]);
  await client.query(`DELETE FROM accounting_categories WHERE workspace_id = $1`, [workspaceId]);

  // 19. Financial Accounts
  await client.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [workspaceId]);
}

/**
 * Re-initializes clean default accounts and categories with zero balances.
 */
export async function reinitializeCleanAccountingState(
  workspaceId: string,
  template: ProfileTemplate,
  client: Queryable
): Promise<void> {
  await seedDefaultChartOfAccounts(workspaceId, client);
  await seedDefaultCategories(workspaceId, template, client);
}

/**
 * Read-only preview of what an accounting reset will affect in the current active state.
 */
export async function previewResetImpact(workspaceId: string): Promise<{
  workspace: { id: string; name: string; currency: string; type: string };
  recordCounts: RecoveryRecordCounts;
  financialSummary: FinancialSummary;
  hasActiveData: boolean;
  retentionDays: number;
  unaffectedModules: string[];
}> {
  const wsRes = await pool.query(
    `SELECT id, name, currency, type FROM accounting_workspaces WHERE id = $1`,
    [workspaceId]
  );
  if (wsRes.rowCount === 0) {
    throw new Error("Workspace not found");
  }
  const workspace = wsRes.rows[0];

  const recordCounts = await fetchWorkspaceRecordCounts(workspaceId);
  const financialSummary = await fetchWorkspaceFinancialSummary(workspaceId);
  const hasActiveData = await hasActiveAccountingActivity(workspaceId);

  return {
    workspace,
    recordCounts,
    financialSummary,
    hasActiveData,
    retentionDays: 90,
    unaffectedModules: [
      "CRM Leads & Pipeline",
      "Follow-ups & Scheduled Reminders",
      "User Accounts, Auth & Credentials",
      "Digital Business Profiles & Cards",
      "NFC & QR Code Management",
      "Platform Billing & SaaS Subscriptions",
      "Other Workspaces & Shared Catalogs",
    ],
  };
}

/**
 * Executes a reversible Complete Accounting Reset:
 * 1. Takes transactional advisory lock for concurrency protection.
 * 2. Captures complete snapshot of all accounting data.
 * 3. Saves recovery version with SHA-256 HMAC/checksum.
 * 4. Verifies snapshot integrity before proceeding.
 * 5. Wipes active accounting tables strictly scoped to this workspace.
 * 6. Seeds clean 0-balance Chart of Accounts and default categories.
 * 7. Records audit log.
 */
export async function executeCompleteReset(
  workspaceId: string,
  userId: string,
  reason: string = "Manual reset requested by administrator"
): Promise<{
  recoveryVersionId: string;
  versionNumber: number;
  recordCounts: RecoveryRecordCounts;
  financialSummary: FinancialSummary;
}> {
  return withTransaction(async (client) => {
    // 1. Transactional advisory lock to prevent concurrent modifications
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('acc_ws_' || $1))`, [workspaceId]);

    // 2. Fetch workspace to confirm existence and template
    const wsRes = await client.query(
      `SELECT * FROM accounting_workspaces WHERE id = $1`,
      [workspaceId]
    );
    if (wsRes.rowCount === 0) {
      throw new Error("Workspace not found");
    }
    const workspace = wsRes.rows[0];

    // 3. Capture recovery snapshot
    const snapshot = await captureWorkspaceSnapshot(workspaceId, client);

    // 4. Calculate next version number
    const verRes = await client.query<{ next_ver: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver
       FROM accounting_recovery_versions
       WHERE workspace_id = $1`,
      [workspaceId]
    );
    const versionNumber = verRes.rows[0]?.next_ver || 1;
    const versionName = `Backup before reset (v${versionNumber}) - ${new Date().toLocaleDateString("en-GB")}`;

    // 5. Store recovery version with 90-day retention
    const insertRes = await client.query<RecoveryVersionRow>(
      `INSERT INTO accounting_recovery_versions
         (workspace_id, version_number, name, reason, status, checksum, data_payload, record_counts, financial_summary, created_by, expires_at)
       VALUES ($1, $2, $3, 'PRE_RESET', 'AVAILABLE', $4, $5, $6, $7, $8, NOW() + INTERVAL '90 days')
       RETURNING *`,
      [
        workspaceId,
        versionNumber,
        versionName,
        snapshot.checksum,
        JSON.stringify(snapshot.payload),
        JSON.stringify(snapshot.recordCounts),
        JSON.stringify(snapshot.financialSummary),
        userId,
      ]
    );
    const savedVersion = insertRes.rows[0];

    // 6. Integrity check: Read back and verify checksum
    const verifyRes = await client.query<{ checksum: string; data_payload: any }>(
      `SELECT checksum, data_payload FROM accounting_recovery_versions WHERE id = $1`,
      [savedVersion.id]
    );
    const readBack = verifyRes.rows[0];
    if (!readBack || computePayloadChecksum(readBack.data_payload) !== readBack.checksum) {
      throw new Error("Integrity verification failed for recovery backup. Reset operation aborted.");
    }

    // 7. Atomically wipe active accounting records
    await wipeActiveAccountingRecords(workspaceId, client);

    // 8. Re-initialize clean state with zero balances
    await reinitializeCleanAccountingState(workspaceId, workspace.profile_template, client);

    // 9. Record audit log
    await client.query(
      `INSERT INTO accounting_audit_logs
         (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
       VALUES ($1, $2, 'OWNER', 'COMPLETE_ACCOUNTING_RESET', 'accounting_recovery_versions', $3, $4, $5)`,
      [
        workspaceId,
        userId,
        savedVersion.id,
        JSON.stringify({
          recordCounts: snapshot.recordCounts,
          financialSummary: snapshot.financialSummary,
          reason,
        }),
        JSON.stringify({
          recoveryVersionId: savedVersion.id,
          versionNumber,
          status: "RESET_COMPLETED",
        }),
      ]
    );

    return {
      recoveryVersionId: savedVersion.id,
      versionNumber,
      recordCounts: snapshot.recordCounts,
      financialSummary: snapshot.financialSummary,
    };
  });
}

/**
 * List all recovery versions for a workspace, ordered by newest first.
 */
export async function listRecoveryVersions(workspaceId: string): Promise<
  Array<{
    id: string;
    versionNumber: number;
    name: string;
    reason: string;
    status: string;
    recordCounts: RecoveryRecordCounts;
    financialSummary: FinancialSummary;
    createdAt: string;
    expiresAt: string;
    restoredAt: string | null;
    isExpired: boolean;
  }>
> {
  const res = await pool.query<RecoveryVersionRow>(
    `SELECT *
     FROM accounting_recovery_versions
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  );

  const now = new Date();
  return res.rows.map((row) => {
    const expiresAt = new Date(row.expires_at);
    const isExpired = expiresAt.getTime() < now.getTime() || row.status === "EXPIRED";

    return {
      id: row.id,
      versionNumber: row.version_number,
      name: row.name,
      reason: row.reason,
      status: isExpired ? "EXPIRED" : row.status,
      recordCounts: row.record_counts,
      financialSummary: row.financial_summary,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      restoredAt: row.restored_at ? row.restored_at.toISOString() : null,
      isExpired,
    };
  });
}

/**
 * Read-only preview of what restoring a specific recovery version will do.
 */
export async function previewRestoreImpact(
  workspaceId: string,
  versionId: string
): Promise<{
  targetVersion: {
    id: string;
    versionNumber: number;
    name: string;
    reason: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    recordCounts: RecoveryRecordCounts;
    financialSummary: FinancialSummary;
    isExpired: boolean;
    isCorrupted: boolean;
  };
  currentActiveState: {
    recordCounts: RecoveryRecordCounts;
    financialSummary: FinancialSummary;
    hasActiveActivity: boolean;
  };
  willCreatePreRestoreBackup: boolean;
  canRestore: boolean;
  blockReason?: string;
}> {
  const verRes = await pool.query<RecoveryVersionRow>(
    `SELECT * FROM accounting_recovery_versions WHERE id = $1 AND workspace_id = $2`,
    [versionId, workspaceId]
  );

  if (verRes.rowCount === 0) {
    throw new Error("Recovery version not found");
  }
  const version = verRes.rows[0];

  const now = new Date();
  const isExpired = new Date(version.expires_at).getTime() < now.getTime();
  const calculatedChecksum = computePayloadChecksum(version.data_payload);
  const isCorrupted = calculatedChecksum !== version.checksum;

  const currentCounts = await fetchWorkspaceRecordCounts(workspaceId);
  const currentSummary = await fetchWorkspaceFinancialSummary(workspaceId);
  const hasActiveActivity = await hasActiveAccountingActivity(workspaceId);

  let canRestore = true;
  let blockReason: string | undefined;

  if (isExpired) {
    canRestore = false;
    blockReason = "This recovery version has expired under the 90-day retention policy and cannot be restored.";
  } else if (isCorrupted) {
    canRestore = false;
    blockReason = "This recovery version failed cryptographic checksum validation and cannot be restored.";
  }

  return {
    targetVersion: {
      id: version.id,
      versionNumber: version.version_number,
      name: version.name,
      reason: version.reason,
      status: isExpired ? "EXPIRED" : isCorrupted ? "CORRUPTED" : version.status,
      createdAt: version.created_at.toISOString(),
      expiresAt: version.expires_at.toISOString(),
      recordCounts: version.record_counts,
      financialSummary: version.financial_summary,
      isExpired,
      isCorrupted,
    },
    currentActiveState: {
      recordCounts: currentCounts,
      financialSummary: currentSummary,
      hasActiveActivity,
    },
    willCreatePreRestoreBackup: hasActiveActivity,
    canRestore,
    blockReason,
  };
}

/**
 * Safely executes restoration of a previous accounting version:
 * 1. Takes advisory lock on workspace.
 * 2. Fetches target recovery version and validates integrity & expiry.
 * 3. If current active accounting records exist, automatically captures a `PRE_RESTORE` recovery version.
 * 4. Wipes active accounting tables strictly for this workspace.
 * 5. Restores original entities preserving exact UUIDs, dates, and FK relationships.
 * 6. Verifies ledger reconciliation totals match historical snapshot.
 * 7. Marks target version as 'RESTORED' and records audit log.
 */
export async function executeRestore(
  workspaceId: string,
  versionId: string,
  userId: string
): Promise<{
  success: boolean;
  restoredVersionId: string;
  preRestoreBackupId?: string;
  financialSummary: FinancialSummary;
}> {
  return withTransaction(async (client) => {
    // 1. Transactional advisory lock
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('acc_ws_' || $1))`, [workspaceId]);

    // 2. Fetch target recovery version
    const verRes = await client.query<RecoveryVersionRow>(
      `SELECT * FROM accounting_recovery_versions WHERE id = $1 AND workspace_id = $2`,
      [versionId, workspaceId]
    );
    if (verRes.rowCount === 0) {
      throw new Error("Target recovery version not found");
    }
    const version = verRes.rows[0];

    // Check expiry
    const now = new Date();
    if (new Date(version.expires_at).getTime() < now.getTime()) {
      throw new Error("Target recovery version has expired and cannot be restored.");
    }

    // Check cryptographic integrity
    const payload = version.data_payload as any;
    const computedCheck = computePayloadChecksum(payload);
    if (computedCheck !== version.checksum) {
      await client.query(
        `UPDATE accounting_recovery_versions SET status = 'CORRUPTED' WHERE id = $1`,
        [version.id]
      );
      throw new Error("Cryptographic integrity check failed. Target recovery version is corrupted.");
    }

    // 3. Check for active post-reset activity
    let preRestoreBackupId: string | undefined;
    const hasActivity = await hasActiveAccountingActivity(workspaceId, client);

    if (hasActivity) {
      // Capture current state before restoration to prevent any data loss
      const preRestoreSnapshot = await captureWorkspaceSnapshot(workspaceId, client);
      const nextVerRes = await client.query<{ next_ver: number }>(
        `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_ver
         FROM accounting_recovery_versions
         WHERE workspace_id = $1`,
        [workspaceId]
      );
      const nextVer = nextVerRes.rows[0]?.next_ver || 1;
      const backupName = `Auto-backup before restore of v${version.version_number} (${new Date().toLocaleDateString("en-GB")})`;

      const backupRes = await client.query<RecoveryVersionRow>(
        `INSERT INTO accounting_recovery_versions
           (workspace_id, version_number, name, reason, status, checksum, data_payload, record_counts, financial_summary, created_by, expires_at)
         VALUES ($1, $2, $3, 'PRE_RESTORE', 'AVAILABLE', $4, $5, $6, $7, $8, NOW() + INTERVAL '90 days')
         RETURNING id`,
        [
          workspaceId,
          nextVer,
          backupName,
          preRestoreSnapshot.checksum,
          JSON.stringify(preRestoreSnapshot.payload),
          JSON.stringify(preRestoreSnapshot.recordCounts),
          JSON.stringify(preRestoreSnapshot.financialSummary),
          userId,
        ]
      );
      preRestoreBackupId = backupRes.rows[0]?.id;
    }

    // 4. Wipe active accounting tables
    await wipeActiveAccountingRecords(workspaceId, client);

    // 5. Restore records in proper foreign key dependency order

    // 5.1 Financial Accounts
    for (const acc of payload.financialAccounts || []) {
      await client.query(
        `INSERT INTO accounting_financial_accounts
           (id, workspace_id, code, name, type, subtype, currency, account_number_mask, is_system, is_active, opening_balance_minor, current_balance_minor, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          acc.id,
          workspaceId,
          acc.code,
          acc.name,
          acc.type,
          acc.subtype,
          acc.currency || "INR",
          acc.account_number_mask,
          acc.is_system,
          acc.is_active,
          acc.opening_balance_minor || 0,
          acc.current_balance_minor || 0,
          acc.description,
          acc.created_at,
          acc.updated_at,
        ]
      );
    }

    // 5.2 Categories (insert with parent_id NULL first, then update parent_id)
    for (const cat of payload.categories || []) {
      await client.query(
        `INSERT INTO accounting_categories
           (id, workspace_id, parent_id, name, slug, type, icon, color, is_system, is_archived, sort_order, created_at, updated_at)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          cat.id,
          workspaceId,
          cat.name,
          cat.slug,
          cat.type,
          cat.icon,
          cat.color,
          cat.is_system,
          cat.is_archived,
          cat.sort_order || 0,
          cat.created_at,
          cat.updated_at,
        ]
      );
    }
    for (const cat of payload.categories || []) {
      if (cat.parent_id) {
        await client.query(
          `UPDATE accounting_categories SET parent_id = $1 WHERE id = $2 AND workspace_id = $3`,
          [cat.parent_id, cat.id, workspaceId]
        );
      }
    }

    // 5.3 Contacts (with safe lead_id verification against external leads)
    for (const c of payload.contacts || []) {
      await client.query(
        `INSERT INTO accounting_contacts
           (id, workspace_id, name, type, email, phone, phone_normalized, address, notes, is_active, total_receivable_minor, total_payable_minor, lead_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, (SELECT id FROM leads WHERE id = $13), $14, $15)`,
        [
          c.id,
          workspaceId,
          c.name,
          c.type,
          c.email,
          c.phone,
          c.phone_normalized,
          c.address,
          c.notes,
          c.is_active,
          c.total_receivable_minor || 0,
          c.total_payable_minor || 0,
          c.lead_id || null,
          c.created_at,
          c.updated_at,
        ]
      );
    }

    // 5.4 Products (with safe catalog_product_id verification)
    for (const p of payload.products || []) {
      await client.query(
        `INSERT INTO accounting_products
           (id, workspace_id, name, sku, description, unit, default_price_minor, currency, is_active, catalog_product_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT id FROM products WHERE id = $10), $11, $12)`,
        [
          p.id,
          workspaceId,
          p.name,
          p.sku,
          p.description,
          p.unit || "pcs",
          p.default_price_minor || 0,
          p.currency || "INR",
          p.is_active,
          p.catalog_product_id || null,
          p.created_at,
          p.updated_at,
        ]
      );
    }

    // 5.5 Journal Entries (insert with reversal pointers NULL first, then update)
    for (const j of payload.journalEntries || []) {
      await client.query(
        `INSERT INTO accounting_journal_entries
           (id, workspace_id, entry_number, entry_date, entry_type, description, reference, source_type, source_id, idempotency_key, status, posted_at, reversal_of_entry_id, reversed_by_entry_id, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULL, NULL, (SELECT id FROM users WHERE id = $13), $14, $15)`,
        [
          j.id,
          workspaceId,
          j.entry_number,
          j.entry_date,
          j.entry_type,
          j.description,
          j.reference,
          j.source_type,
          j.source_id,
          j.idempotency_key,
          j.status,
          j.posted_at,
          j.created_by || null,
          j.created_at,
          j.updated_at,
        ]
      );
    }
    for (const j of payload.journalEntries || []) {
      if (j.reversal_of_entry_id || j.reversed_by_entry_id) {
        await client.query(
          `UPDATE accounting_journal_entries
           SET reversal_of_entry_id = $1, reversed_by_entry_id = $2
           WHERE id = $3 AND workspace_id = $4`,
          [j.reversal_of_entry_id || null, j.reversed_by_entry_id || null, j.id, workspaceId]
        );
      }
    }

    // 5.6 Journal Lines
    for (const l of payload.journalLines || []) {
      await client.query(
        `INSERT INTO accounting_journal_lines
           (id, journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          l.id,
          l.journal_entry_id,
          l.financial_account_id,
          l.debit_minor || 0,
          l.credit_minor || 0,
          l.description,
        ]
      );
    }

    // 5.7 Loans
    for (const loan of payload.loans || []) {
      await client.query(
        `INSERT INTO accounting_loans
           (id, workspace_id, loan_name, lender_contact_id, liability_account_id, disbursement_account_id, principal_minor, interest_rate_percent, tenure_months, start_date, monthly_installment_minor, remaining_principal_minor, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          loan.id,
          workspaceId,
          loan.loan_name,
          loan.lender_contact_id,
          loan.liability_account_id,
          loan.disbursement_account_id,
          loan.principal_minor,
          loan.interest_rate_percent || 0,
          loan.tenure_months,
          loan.start_date,
          loan.monthly_installment_minor || 0,
          loan.remaining_principal_minor,
          loan.status,
          loan.created_at,
          loan.updated_at,
        ]
      );
    }

    // 5.8 Payments
    for (const pay of payload.payments || []) {
      await client.query(
        `INSERT INTO accounting_payments
           (id, workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor, payment_date, payment_method, reference_number, notes, journal_entry_id, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, (SELECT id FROM users WHERE id = $13), $14, $15)`,
        [
          pay.id,
          workspaceId,
          pay.payment_number,
          pay.type,
          pay.contact_id,
          pay.financial_account_id,
          pay.amount_minor,
          pay.payment_date,
          pay.payment_method || "BANK_TRANSFER",
          pay.reference_number,
          pay.notes,
          pay.journal_entry_id,
          pay.created_by || null,
          pay.created_at,
          pay.updated_at,
        ]
      );
    }

    // 5.9 Invoices
    for (const inv of payload.invoices || []) {
      await client.query(
        `INSERT INTO accounting_invoices
           (id, workspace_id, invoice_number, contact_id, issue_date, due_date, status, currency, subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor, notes, terms, share_token, lead_id, posted_journal_entry_id, internal_notes, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, (SELECT id FROM leads WHERE id = $18), $19, $20, (SELECT id FROM users WHERE id = $21), $22, $23)`,
        [
          inv.id,
          workspaceId,
          inv.invoice_number,
          inv.contact_id,
          inv.issue_date,
          inv.due_date,
          inv.status,
          inv.currency || "INR",
          inv.subtotal_minor || 0,
          inv.discount_minor || 0,
          inv.tax_minor || 0,
          inv.total_minor || 0,
          inv.amount_paid_minor || 0,
          inv.amount_due_minor || 0,
          inv.notes,
          inv.terms,
          inv.share_token,
          inv.lead_id || null,
          inv.posted_journal_entry_id,
          inv.internal_notes,
          inv.created_by || null,
          inv.created_at,
          inv.updated_at,
        ]
      );
    }

    // 5.10 Invoice Lines
    for (const il of payload.invoiceLines || []) {
      await client.query(
        `INSERT INTO accounting_invoice_lines
           (id, invoice_id, product_id, description, quantity, unit_price_minor, discount_minor, tax_minor, total_minor, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          il.id,
          il.invoice_id,
          il.product_id,
          il.description,
          il.quantity || 1,
          il.unit_price_minor || 0,
          il.discount_minor || 0,
          il.tax_minor || 0,
          il.total_minor || 0,
          il.sort_order || 0,
        ]
      );
    }

    // 5.11 Sales
    for (const s of payload.sales || []) {
      await client.query(
        `INSERT INTO accounting_sales
           (id, workspace_id, sale_number, contact_id, date, total_minor, paid_minor, payment_method, financial_account_id, invoice_id, lead_id, notes, status, posted_journal_entry_id, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, (SELECT id FROM leads WHERE id = $11), $12, $13, $14, (SELECT id FROM users WHERE id = $15), $16, $17)`,
        [
          s.id,
          workspaceId,
          s.sale_number,
          s.contact_id,
          s.date,
          s.total_minor || 0,
          s.paid_minor || 0,
          s.payment_method || "CASH",
          s.financial_account_id,
          s.invoice_id,
          s.lead_id || null,
          s.notes,
          s.status || "COMPLETED",
          s.posted_journal_entry_id,
          s.created_by || null,
          s.created_at,
          s.updated_at,
        ]
      );
    }

    // 5.12 Transactions
    for (const tx of payload.transactions || []) {
      await client.query(
        `INSERT INTO accounting_transactions
           (id, workspace_id, journal_entry_id, type, category_id, financial_account_id, destination_account_id, contact_id, amount_minor, date, notes, status, attachment_url, tags, is_recurring, created_by, created_at, updated_at, voided_at, voided_by, restored_at, restored_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, (SELECT id FROM users WHERE id = $16), $17, $18, $19, (SELECT id FROM users WHERE id = $20), $21, (SELECT id FROM users WHERE id = $22))`,
        [
          tx.id,
          workspaceId,
          tx.journal_entry_id,
          tx.type,
          tx.category_id,
          tx.financial_account_id,
          tx.destination_account_id,
          tx.contact_id,
          tx.amount_minor,
          tx.date,
          tx.notes,
          tx.status || "POSTED",
          tx.attachment_url,
          JSON.stringify(tx.tags || []),
          tx.is_recurring || false,
          tx.created_by || null,
          tx.created_at,
          tx.updated_at,
          tx.voided_at || null,
          tx.voided_by || null,
          tx.restored_at || null,
          tx.restored_by || null,
        ]
      );
    }

    // 5.13 Loan Installments
    for (const li of payload.loanInstallments || []) {
      await client.query(
        `INSERT INTO accounting_loan_installments
           (id, loan_id, installment_number, due_date, principal_minor, interest_minor, total_minor, status, paid_date, payment_id, journal_entry_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          li.id,
          li.loan_id,
          li.installment_number,
          li.due_date,
          li.principal_minor || 0,
          li.interest_minor || 0,
          li.total_minor || 0,
          li.status || "PENDING",
          li.paid_date || null,
          li.payment_id || null,
          li.journal_entry_id || null,
        ]
      );
    }

    // 5.14 Payment Allocations
    for (const pa of payload.paymentAllocations || []) {
      await client.query(
        `INSERT INTO accounting_payment_allocations
           (id, payment_id, invoice_id, allocated_minor, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [pa.id, pa.payment_id, pa.invoice_id, pa.allocated_minor, pa.created_at]
      );
    }

    // 5.15 Transaction Attachments
    for (const att of payload.transactionAttachments || []) {
      await client.query(
        `INSERT INTO accounting_transaction_attachments
           (id, workspace_id, transaction_id, storage_key, file_name, file_size, file_type, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM users WHERE id = $8), $9, $10)`,
        [
          att.id,
          workspaceId,
          att.transaction_id,
          att.storage_key,
          att.file_name,
          att.file_size,
          att.file_type,
          att.created_by || null,
          att.created_at,
          att.updated_at,
        ]
      );
    }

    // 5.16 Budgets
    for (const b of payload.budgets || []) {
      await client.query(
        `INSERT INTO accounting_budgets
           (id, workspace_id, category_id, period_type, period_start, period_end, amount_minor, spent_minor, alert_threshold_percent, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          b.id,
          workspaceId,
          b.category_id,
          b.period_type || "MONTHLY",
          b.period_start,
          b.period_end,
          b.amount_minor,
          b.spent_minor || 0,
          b.alert_threshold_percent || 80,
          b.created_at,
          b.updated_at,
        ]
      );
    }

    // 5.17 Recurring Rules
    for (const r of payload.recurringRules || []) {
      await client.query(
        `INSERT INTO accounting_recurring_rules
           (id, workspace_id, title, type, category_id, amount_minor, frequency, next_due_date, financial_account_id, auto_post, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          r.id,
          workspaceId,
          r.title,
          r.type,
          r.category_id,
          r.amount_minor,
          r.frequency || "MONTHLY",
          r.next_due_date,
          r.financial_account_id,
          r.auto_post || false,
          r.status || "ACTIVE",
          r.created_at,
          r.updated_at,
        ]
      );
    }

    // 5.18 Reminders
    for (const rem of payload.reminders || []) {
      await client.query(
        `INSERT INTO accounting_reminders
           (id, workspace_id, user_id, title, description, type, due_date, entity_type, entity_id, status, dismissed_at, created_at, updated_at)
         VALUES ($1, $2, (SELECT id FROM users WHERE id = $3), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          rem.id,
          workspaceId,
          rem.user_id,
          rem.title,
          rem.description,
          rem.type,
          rem.due_date,
          rem.entity_type,
          rem.entity_id,
          rem.status || "PENDING",
          rem.dismissed_at || null,
          rem.created_at,
          rem.updated_at,
        ]
      );
    }

    // 5.19 Invoice Sequences
    for (const seq of payload.invoiceSequences || []) {
      await client.query(
        `INSERT INTO accounting_invoice_sequences (workspace_id, period, next_seq, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, period) DO UPDATE SET next_seq = EXCLUDED.next_seq`,
        [workspaceId, seq.period, seq.next_seq || 1, seq.updated_at]
      );
    }

    // 5.20 Workspace Settings
    if (payload.workspaceSettings && typeof payload.workspaceSettings === "object") {
      await client.query(
        `UPDATE accounting_workspaces SET settings = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(payload.workspaceSettings), workspaceId]
      );
    }

    // 6. Reconciliation verification: confirm active state matches target version totals
    const restoredSummary = await fetchWorkspaceFinancialSummary(workspaceId, client);
    const expectedSummary = version.financial_summary as FinancialSummary;

    if (restoredSummary.accountsCount !== expectedSummary.accountsCount) {
      throw new Error("Restoration reconciliation error: Account counts do not match original backup.");
    }
    if (restoredSummary.netBalanceMinor !== expectedSummary.netBalanceMinor) {
      throw new Error("Restoration reconciliation error: Net ledger balance does not match original backup.");
    }

    // 7. Update recovery version status to RESTORED
    await client.query(
      `UPDATE accounting_recovery_versions
       SET status = 'RESTORED', restored_at = NOW(), restored_by = $1
       WHERE id = $2`,
      [userId, version.id]
    );

    // 8. Record audit log
    await client.query(
      `INSERT INTO accounting_audit_logs
         (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
       VALUES ($1, $2, 'OWNER', 'COMPLETE_ACCOUNTING_RESTORE', 'accounting_recovery_versions', $3, $4, $5)`,
      [
        workspaceId,
        userId,
        version.id,
        JSON.stringify({
          preRestoreBackupId,
          hadPostResetActivity: hasActivity,
        }),
        JSON.stringify({
          restoredVersionId: version.id,
          versionNumber: version.version_number,
          restoredSummary,
        }),
      ]
    );

    return {
      success: true,
      restoredVersionId: version.id,
      preRestoreBackupId,
      financialSummary: restoredSummary,
    };
  });
}
