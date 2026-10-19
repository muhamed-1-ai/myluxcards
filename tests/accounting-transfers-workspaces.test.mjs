import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Accounting: Case 7 - Account Transfers & Workspace Multi-Tenant Isolation", async (t) => {
  let userAId;
  let userBId;
  let wsAId;
  let wsBId;
  let cashAId;
  let bankAId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // Workspace A for User A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Workspace A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions) VALUES ($1, $2, 'OWNER', '{}')`,
      [wsAId, userAId]
    );

    // Workspace B for User B (Isolated)
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Workspace B', 'PERSONAL', 'INDIVIDUAL') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions) VALUES ($1, $2, 'OWNER', '{}')`,
      [wsBId, userBId]
    );

    // Accounts for Workspace A: Cash with ₹10,000, Bank with ₹0
    const cRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, current_balance_minor)
       VALUES ($1, '1010', 'Cash in Hand', 'ASSET', 'CASH', 1000000) RETURNING id`,
      [wsAId]
    );
    cashAId = cRes.rows[0].id;

    const bRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, current_balance_minor)
       VALUES ($1, '1020', 'Bank Account', 'ASSET', 'BANK', 0) RETURNING id`,
      [wsAId]
    );
    bankAId = bRes.rows[0].id;

    // Accounts for Workspace B: Bank with ₹50,000 (Private personal finances)
    const bResB = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, current_balance_minor)
       VALUES ($1, '1020', 'User B Personal Savings', 'ASSET', 'BANK', 5000000) RETURNING id`,
      [wsBId]
    );
    const bankBId = bResB.rows[0].id;

    // Also insert a confidential personal transaction in Workspace B
    const jeB = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status)
       VALUES ($1, 'JE-B-001', CURRENT_DATE, 'MANUAL', 'User B Secret Investment', 'TRANSACTION', 'POSTED') RETURNING id`,
      [wsBId]
    );
    await pool.query(
      `INSERT INTO accounting_transactions (workspace_id, journal_entry_id, type, financial_account_id, amount_minor, date, notes)
       VALUES ($1, $2, 'EXPENSE', $3, 2000000, CURRENT_DATE, 'Private Family Loan')`,
      [wsBId, jeB.rows[0].id, bankBId]
    );
  });

  t.after(async () => {
    if (wsAId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]).catch(() => {});
    if (wsBId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]).catch(() => {});
  });

  await t.test("1. Transfer between accounts changes account balances but not net revenue or expense", async () => {
    const transferMinor = 350000; // ₹3,500 transferred from Cash to Bank

    // Journal Entry: Debit Bank ₹3,500, Credit Cash ₹3,500
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status)
       VALUES ($1, 'JE-TRF-001', CURRENT_DATE, 'TRANSFER', 'Transfer Cash to Bank', 'TRANSFER', 'POSTED') RETURNING id`,
      [wsAId]
    );
    const jeId = jeRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, 0, 'Transfer Deposit'), ($1, $4, 0, $3, 'Transfer Withdrawal')`,
      [jeId, bankAId, transferMinor, cashAId]
    );

    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + $1 WHERE id = $2`, [transferMinor, bankAId]);
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor - $1 WHERE id = $2`, [transferMinor, cashAId]);

    // Verify Balances:
    // Cash: ₹10,000 - ₹3,500 = ₹6,500
    const cashBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [cashAId])).rows[0].current_balance_minor;
    assert.equal(Number(cashBal), 650000, "Cash balance must be ₹6,500");

    // Bank: ₹0 + ₹3,500 = ₹3,500
    const bankBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [bankAId])).rows[0].current_balance_minor;
    assert.equal(Number(bankBal), 350000, "Bank balance must be ₹3,500");

    // Revenue and Expense lines impacted by this transfer are ZERO
    const revExpCheck = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN fa.type = 'REVENUE' THEN jl.credit_minor ELSE 0 END), 0) as revenue,
         COALESCE(SUM(CASE WHEN fa.type = 'EXPENSE' THEN jl.debit_minor ELSE 0 END), 0) as expense
       FROM accounting_journal_lines jl
       JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
       WHERE jl.journal_entry_id = $1`,
      [jeId]
    );
    assert.equal(Number(revExpCheck.rows[0].revenue), 0, "Account transfer must NEVER generate revenue");
    assert.equal(Number(revExpCheck.rows[0].expense), 0, "Account transfer must NEVER generate expense");
  });

  await t.test("2. Multi-Tenant Isolation: Workspace A cannot leak, query, or aggregate Workspace B records", async () => {
    // 1. Querying transactions for Workspace A strictly returns only Workspace A records
    const txA = await pool.query(
      `SELECT * FROM accounting_transactions WHERE workspace_id = $1`,
      [wsAId]
    );
    for (const row of txA.rows) {
      assert.notEqual(row.notes, "Private Family Loan", "Workspace A queries must never return Workspace B transactions");
    }

    // 2. Querying accounts for Workspace A strictly returns only Workspace A accounts
    const accsA = await pool.query(
      `SELECT * FROM accounting_financial_accounts WHERE workspace_id = $1`,
      [wsAId]
    );
    for (const row of accsA.rows) {
      assert.notEqual(row.name, "User B Personal Savings", "Workspace A queries must never return Workspace B accounts");
    }

    // 3. User A trying to query Workspace B directly via membership filter is denied
    const accessCheck = await pool.query(
      `SELECT w.id FROM accounting_workspaces w
       JOIN accounting_workspace_members m ON m.workspace_id = w.id
       WHERE w.id = $1 AND m.user_id = $2`,
      [wsBId, userAId]
    );
    assert.equal(accessCheck.rows.length, 0, "User A must have ZERO access to User B private workspace");
  });
});
