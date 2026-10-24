import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    path: serverOnlyPath,
    children: [],
    paths: [],
  };
} catch (_) {}

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

// Dynamic imports
const {
  createTransaction,
  listTransactions,
  voidTransaction,
  restoreTransaction,
} = await import("../src/lib/accounting/transactions.ts");
const { setAccountOpeningBalance, getFinancialAccountByCode } = await import("../src/lib/accounting/accounts.ts");
const { generateTransactionsExport, getDashboardMetrics } = await import("../src/lib/accounting/reports.ts");

test("Accounting Voided Expenses & Restorations Suite", async (t) => {
  let userAId;
  let userBId;
  let wsAId;
  let wsBId;
  let cashAccountId;
  let expenseAccountId;
  let categoryFoodId;
  let testExpenseTx;

  t.before(async () => {
    // 1. Fetch existing users
    const usersRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(usersRes.rows.length >= 2, "Requires at least 2 users in database");
    userAId = usersRes.rows[0].id;
    userBId = usersRes.rows[1].id;

    // 2. Setup Workspace A (Owner: User A)
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Test Workspace Void Restore A', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}'::jsonb)`,
      [wsAId, userAId]
    );

    // 3. Setup Workspace B (Owner: User B, for cross-tenant isolation testing)
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Test Workspace Void Restore B', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}'::jsonb)`,
      [wsBId, userBId]
    );

    // 4. Seed standard chart of accounts in Workspace A
    const accounts = [
      { code: "1010", name: "Cash in Hand", type: "ASSET", subtype: "CASH" },
      { code: "1020", name: "Main Bank Account", type: "ASSET", subtype: "BANK" },
      { code: "1200", name: "Accounts Receivable", type: "ASSET", subtype: "RECEIVABLE" },
      { code: "2000", name: "Accounts Payable", type: "LIABILITY", subtype: "PAYABLE" },
      { code: "3000", name: "Owner Equity", type: "EQUITY", subtype: "EQUITY" },
      { code: "4000", name: "Sales Revenue", type: "REVENUE", subtype: "REVENUE" },
      { code: "5000", name: "Operating Expenses", type: "EXPENSE", subtype: "EXPENSE" },
    ];

    for (const a of accounts) {
      const res = await pool.query(
        `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, currency, is_system, is_active)
         VALUES ($1, $2, $3, $4, $5, 'INR', true, true)
         ON CONFLICT (workspace_id, code) DO NOTHING
         RETURNING id`,
        [wsAId, a.code, a.name, a.type, a.subtype]
      );
      if (a.code === "1010") cashAccountId = res.rows[0]?.id;
      if (a.code === "5000") expenseAccountId = res.rows[0]?.id;
    }

    if (!cashAccountId) {
      const cRes = await pool.query(`SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1010'`, [wsAId]);
      cashAccountId = cRes.rows[0].id;
    }

    // 5. Seed Category in Workspace A
    const catRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type)
       VALUES ($1, 'Office Supplies', 'office-supplies', 'EXPENSE')
       RETURNING id`,
      [wsAId]
    );
    categoryFoodId = catRes.rows[0].id;

    // 6. Set opening balance of ₹1,000 (100,000 minor) in Cash in Hand
    await setAccountOpeningBalance(wsAId, cashAccountId, 100000, userAId);
  });

  t.after(async () => {
    if (wsAId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]).catch(() => {});
    if (wsBId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]).catch(() => {});
  });

  await t.test("1. Baseline: opening balance is ₹1,000 (100,000 minor)", async () => {
    const acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 100000, "Cash balance should be 100,000 minor (₹1,000)");

    const initialList = await listTransactions(wsAId, { status: "POSTED" });
    assert.equal(initialList.transactions.length, 0, "No transactions initially in All Transactions");
    assert.equal(initialList.total, 0, "Initial active total is 0");

    const initialVoided = await listTransactions(wsAId, { status: "VOIDED" });
    assert.equal(initialVoided.transactions.length, 0, "No voided transactions initially in Voided tab");
    assert.equal(initialVoided.total, 0, "Initial voided total is 0");
  });

  await t.test("2. Expense Creation: create ₹100 (10,000 minor) cash expense -> balance becomes ₹900", async () => {
    const created = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 10000, // ₹100.00
      date: "2026-10-24",
      financialAccountId: cashAccountId,
      categoryId: categoryFoodId,
      notes: "Stationery and printing",
      userId: userAId,
    });

    testExpenseTx = created.transaction;
    assert.equal(testExpenseTx.status, "POSTED", "Expense should be POSTED");
    assert.equal(Number(testExpenseTx.amount_minor), 10000, "Amount is 10,000 minor");

    // Cash balance should now be ₹900 (90,000 minor)
    const acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 90000, "Cash balance should be 90,000 minor (₹900)");

    // All Transactions contains this active expense
    const activeList = await listTransactions(wsAId, { status: "POSTED" });
    assert.equal(activeList.transactions.length, 1, "All Transactions should show 1 active transaction");
    assert.equal(activeList.total, 1, "Active total is 1");
    assert.equal(activeList.transactions[0].id, testExpenseTx.id);

    // Voided tab does NOT contain this active expense
    const voidedList = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE" });
    assert.equal(voidedList.transactions.length, 0, "Voided tab should show 0 expenses");
    assert.equal(voidedList.total, 0, "Voided total is 0");
  });

  await t.test("3. Cancel behavior leaves everything unchanged", async () => {
    // If user opens confirmation dialog and cancels, no changes are committed
    const activeList = await listTransactions(wsAId, { status: "POSTED" });
    assert.equal(activeList.total, 1, "Active transactions total remains 1");

    const acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 90000, "Cash balance remains ₹900");
  });

  await t.test("4. Confirmed Void: moves expense to Voided, restores cash to ₹1,000, preserves audit", async () => {
    const voidedResult = await voidTransaction(wsAId, testExpenseTx.id, "Incorrect invoice entry", userAId);
    assert.equal(voidedResult.status, "VOIDED", "Status updated to VOIDED");
    assert.ok(voidedResult.voided_at, "voided_at timestamp should be set");
    assert.equal(voidedResult.voided_by, userAId, "voided_by should be userAId");

    // Cash balance should be reversed once back to ₹1,000 (100,000 minor)
    const acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 100000, "Cash balance should be reversed to 100,000 minor (₹1,000)");

    // Expense account (5000) balance should be reversed once back to ₹0
    const expAcc = await getFinancialAccountByCode(wsAId, "5000");
    assert.equal(Number(expAcc.current_balance_minor), 0, "Operating expense account should be reversed to 0");

    // All Transactions must EXCLUDE the voided expense
    const activeList = await listTransactions(wsAId, { status: "POSTED" });
    assert.equal(activeList.transactions.length, 0, "All Transactions should now exclude voided expense");
    assert.equal(activeList.total, 0, "Active total is 0");

    // Voided tab must INCLUDE the voided expense
    const voidedList = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE" });
    assert.equal(voidedList.transactions.length, 1, "Voided tab should include the voided expense");
    assert.equal(voidedList.total, 1, "Voided total is 1");
    assert.equal(voidedList.transactions[0].id, testExpenseTx.id);
    assert.equal(voidedList.transactions[0].status, "VOIDED");
    assert.ok(voidedList.transactions[0].voided_at, "voided_at present in list query");
    assert.ok(voidedList.transactions[0].voided_by_name, "voided_by_name present in list query");

    // Audit Log verified
    const auditRes = await pool.query(
      `SELECT * FROM accounting_audit_logs WHERE entity_id = $1 AND action = 'TRANSACTION_VOIDED'`,
      [testExpenseTx.id]
    );
    assert.equal(auditRes.rows.length, 1, "Audit log for TRANSACTION_VOIDED must be created");
  });

  await t.test("5. Confirmed Restore: returns expense to All Transactions, cash back to ₹900, applies effect exactly once", async () => {
    const restoredResult = await restoreTransaction(wsAId, testExpenseTx.id, "Restored by test user", userAId);
    assert.equal(restoredResult.status, "POSTED", "Status updated back to POSTED");
    assert.ok(restoredResult.restored_at, "restored_at timestamp should be set");
    assert.equal(restoredResult.restored_by, userAId, "restored_by should be userAId");

    // Cash balance should be decremented by ₹100 once (back to ₹900)
    const acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 90000, "Cash balance should be 90,000 minor (₹900) after restoration");

    // Expense account (5000) balance should be ₹100 (10,000 minor)
    const expAcc = await getFinancialAccountByCode(wsAId, "5000");
    assert.equal(Number(expAcc.current_balance_minor), 10000, "Operating expense account should be 10,000 minor (₹100)");

    // All Transactions should show the restored expense
    const activeList = await listTransactions(wsAId, { status: "POSTED" });
    assert.equal(activeList.transactions.length, 1, "All Transactions should show restored expense");
    assert.equal(activeList.total, 1, "Active total is 1");
    assert.equal(activeList.transactions[0].id, testExpenseTx.id);

    // Voided tab should now be empty
    const voidedList = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE" });
    assert.equal(voidedList.transactions.length, 0, "Voided tab should now have 0 expenses");
    assert.equal(voidedList.total, 0, "Voided total is 0");

    // Audit Log verified
    const auditRes = await pool.query(
      `SELECT * FROM accounting_audit_logs WHERE entity_id = $1 AND action = 'TRANSACTION_RESTORED'`,
      [testExpenseTx.id]
    );
    assert.equal(auditRes.rows.length, 1, "Audit log for TRANSACTION_RESTORED must be created");
  });

  await t.test("6. Repeated void/restore cycles: ₹900 -> ₹1,000 -> ₹900 -> ₹1,000 -> ₹900 with balanced ledger", async () => {
    // Cycle 2: Void again
    await voidTransaction(wsAId, testExpenseTx.id, "Second void", userAId);
    let acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 100000, "Cycle 2 void: Cash is ₹1,000");

    let voidedList = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE" });
    assert.equal(voidedList.total, 1);
    let activeList = await listTransactions(wsAId, { status: "POSTED" });
    assert.equal(activeList.total, 0);

    // Cycle 2: Restore again
    await restoreTransaction(wsAId, testExpenseTx.id, "Second restore", userAId);
    acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 90000, "Cycle 2 restore: Cash is ₹900");

    voidedList = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE" });
    assert.equal(voidedList.total, 0);
    activeList = await listTransactions(wsAId, { status: "POSTED" });
    assert.equal(activeList.total, 1);

    // Cycle 3: Void again
    await voidTransaction(wsAId, testExpenseTx.id, "Third void", userAId);
    acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 100000, "Cycle 3 void: Cash is ₹1,000");

    // Cycle 3: Restore again
    await restoreTransaction(wsAId, testExpenseTx.id, "Third restore", userAId);
    acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 90000, "Cycle 3 restore: Cash is ₹900");

    // Verify all journal entries in Workspace A strictly balance (Debits == Credits)
    const balancedCheck = await pool.query(
      `SELECT jl.journal_entry_id, SUM(jl.debit_minor) as debits, SUM(jl.credit_minor) as credits
       FROM accounting_journal_lines jl
       JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.workspace_id = $1
       GROUP BY jl.journal_entry_id`,
      [wsAId]
    );

    assert(balancedCheck.rows.length > 0, "Journal entries should exist");
    for (const row of balancedCheck.rows) {
      assert.equal(
        row.debits,
        row.credits,
        `Journal entry ${row.journal_entry_id} must have equal debits and credits (${row.debits} == ${row.credits})`
      );
    }
  });

  await t.test("7. Duplicate requests and concurrent actions prevention", async () => {
    // Current status is POSTED. Calling restoreTransaction should reject cleanly!
    await assert.rejects(
      async () => {
        await restoreTransaction(wsAId, testExpenseTx.id, "Duplicate restore", userAId);
      },
      /Transaction is already active/,
      "Restoring an active transaction must be rejected"
    );

    // Void it
    await voidTransaction(wsAId, testExpenseTx.id, "Void for duplicate test", userAId);

    // Calling voidTransaction again should reject cleanly!
    await assert.rejects(
      async () => {
        await voidTransaction(wsAId, testExpenseTx.id, "Duplicate void", userAId);
      },
      /Transaction is already voided/,
      "Voiding an already-voided transaction must be rejected"
    );

    // Concurrent void attempts: one should succeed and second must fail
    await restoreTransaction(wsAId, testExpenseTx.id, "Restore before concurrent test", userAId);
    const results = await Promise.allSettled([
      voidTransaction(wsAId, testExpenseTx.id, "Concurrent void 1", userAId),
      voidTransaction(wsAId, testExpenseTx.id, "Concurrent void 2", userAId),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1, "Exactly one concurrent void request must succeed");
    assert.equal(rejected.length, 1, "The second concurrent void request must be rejected");

    // Cash balance is now ₹1,000, not double-reversed!
    const acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 100000, "Cash balance is exactly ₹1,000, no double-reversal");
  });

  await t.test("8. Server failures leave consistent records", async () => {
    // Attempting void with invalid transaction ID
    await assert.rejects(
      async () => {
        await voidTransaction(wsAId, "00000000-0000-0000-0000-000000000000", "Bad ID", userAId);
      },
      /Transaction not found/,
      "Non-existent transaction must fail cleanly"
    );

    // Attempting restore with invalid transaction ID
    await assert.rejects(
      async () => {
        await restoreTransaction(wsAId, "00000000-0000-0000-0000-000000000000", "Bad ID", userAId);
      },
      /Transaction not found/,
      "Non-existent transaction must fail cleanly"
    );

    // Database remains consistent
    const acc = await getFinancialAccountByCode(wsAId, "1010");
    assert.equal(Number(acc.current_balance_minor), 100000, "Cash balance remains consistent");
  });

  await t.test("9. Search, Categories filter, and Pagination", async () => {
    // Current status is VOIDED. Restore it, and add another expense
    await restoreTransaction(wsAId, testExpenseTx.id, "Restore for search test", userAId);

    const expense2 = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 5000,
      financialAccountId: cashAccountId,
      notes: "Lunch catering",
      userId: userAId,
    });

    // Void expense 2
    await voidTransaction(wsAId, expense2.transaction.id, "Void catering", userAId);

    // Search active by note 'printing'
    const searchActive = await listTransactions(wsAId, { status: "POSTED", search: "printing" });
    assert.equal(searchActive.transactions.length, 1);
    assert.equal(searchActive.transactions[0].id, testExpenseTx.id);

    // Search voided by note 'catering'
    const searchVoided = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE", search: "catering" });
    assert.equal(searchVoided.transactions.length, 1);
    assert.equal(searchVoided.transactions[0].id, expense2.transaction.id);

    // Search voided by non-matching query
    const searchVoidedNone = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE", search: "nonexistent" });
    assert.equal(searchVoidedNone.transactions.length, 0);
    assert.equal(searchVoidedNone.total, 0);

    // Pagination test
    const page1 = await listTransactions(wsAId, { status: "VOIDED", type: "EXPENSE", limit: 1, offset: 0 });
    assert.equal(page1.transactions.length, 1);
    assert.equal(page1.total, 1, "Total represents full dataset count");
  });

  await t.test("10. Active vs Voided Exports", async () => {
    // Active CSV export
    const activeExport = await generateTransactionsExport(wsAId, "csv", { status: "POSTED" });
    assert.ok(activeExport.filename.includes("zappit_transactions_"), "Filename starts with zappit_transactions_");
    const activeCsvText = activeExport.buffer.toString("utf8");
    assert.ok(activeCsvText.includes("Stationery and printing"), "Active export includes active transaction");
    assert.ok(!activeCsvText.includes("Lunch catering"), "Active export excludes voided expense");

    // Voided CSV export
    const voidedExport = await generateTransactionsExport(wsAId, "csv", { status: "VOIDED", type: "EXPENSE" });
    assert.ok(voidedExport.filename.includes("zappit_voided_expenses_"), "Filename starts with zappit_voided_expenses_");
    const voidedCsvText = voidedExport.buffer.toString("utf8");
    assert.ok(voidedCsvText.includes("Lunch catering"), "Voided export contains voided expense");
    assert.ok(!voidedCsvText.includes("Stationery and printing"), "Voided export excludes active transaction");
  });

  await t.test("11. Dashboard Reports do not double-adjust totals", async () => {
    const metrics = await getDashboardMetrics(wsAId);
    // In Workspace A:
    // Opening balance: Cash = 100,000 (₹1,000)
    // Expense 1: ₹100 (Stationery, active)
    // Expense 2: ₹50 (Catering, voided)
    // Cash balance: 100,000 - 10,000 = 90,000 (₹900)
    assert.equal(metrics.availableBalanceMinor, 90000, "Available balance is ₹900");
    // Incurred expense should be exactly ₹100 (10,000 minor) - NOT affected by voided expense or reversal entry!
    assert.equal(metrics.incurredExpenseMinor, 10000, "Incurred expense is strictly ₹100, voided expense excluded");
    // Money paid should be exactly ₹100 (10,000 minor) - reversal entry is NOT counted as cash_in!
    assert.equal(metrics.moneyPaidMinor, 10000, "Cash paid is ₹100");
    assert.equal(metrics.moneyReceivedMinor, 0, "Cash received is ₹0 (voiding does not generate fake cash inflow)");
  });

  await t.test("12. Security & Cross-tenant Isolation Rejection", async () => {
    // User B in Workspace B attempts to void Workspace A's transaction
    await assert.rejects(
      async () => {
        await voidTransaction(wsBId, testExpenseTx.id, "Malicious void attempt", userBId);
      },
      /Transaction not found/,
      "Cross-workspace void must be rejected"
    );

    // User B in Workspace B attempts to restore Workspace A's transaction
    await assert.rejects(
      async () => {
        await restoreTransaction(wsBId, testExpenseTx.id, "Malicious restore attempt", userBId);
      },
      /Transaction not found/,
      "Cross-workspace restore must be rejected"
    );
  });
});
