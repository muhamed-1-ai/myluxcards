import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Accounting Simplified Payment Accounts Regression Suite", async (t) => {
  let userId;
  let tenantBUserId;
  let workspaceId;
  let tenantBWorkspaceId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert.ok(userRes.rows.length >= 2, "Need at least 2 users for test");
    userId = userRes.rows[0].id;
    tenantBUserId = userRes.rows[1].id;

    // Create test workspace
    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Two Payment Accounts Test WS', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userId]
    );
    workspaceId = wsRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}')`,
      [workspaceId, userId]
    );

    // Create tenant B workspace
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Tenant B Isolated WS', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [tenantBUserId]
    );
    tenantBWorkspaceId = wsBRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}')`,
      [tenantBWorkspaceId, tenantBUserId]
    );
  });

  t.after(async () => {
    // Cleanup
    if (workspaceId) {
      await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [workspaceId]);
      await pool.query(`DELETE FROM accounting_transactions WHERE workspace_id = $1`, [workspaceId]);
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [workspaceId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [workspaceId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [workspaceId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [workspaceId]);
    }
    if (tenantBWorkspaceId) {
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [tenantBWorkspaceId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [tenantBWorkspaceId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [tenantBWorkspaceId]);
    }
    await pool.end();
  });

  await t.test("1. Seeding creates exactly TWO visible payment accounts starting at ₹0.00", async () => {
    // Seed using the canonical catalogue
    const catalogue = [
      { code: "1010", name: "Cash in Hand", type: "ASSET", subtype: "CASH", is_payment_account: true, account_role: "CASH" },
      { code: "1020", name: "Bank Account", type: "ASSET", subtype: "BANK", is_payment_account: true, account_role: "BANK" },
      { code: "1200", name: "Accounts Receivable", type: "ASSET", subtype: "RECEIVABLE", is_payment_account: false, account_role: "INTERNAL_LEDGER" },
      { code: "2000", name: "Accounts Payable", type: "LIABILITY", subtype: "PAYABLE", is_payment_account: false, account_role: "INTERNAL_LEDGER" },
      { code: "2500", name: "Loans & Borrowings", type: "LIABILITY", subtype: "LOAN", is_payment_account: false, account_role: "INTERNAL_LEDGER" },
      { code: "3000", name: "Owner's Equity & Capital", type: "EQUITY", subtype: "EQUITY", is_payment_account: false, account_role: "INTERNAL_LEDGER" },
      { code: "4000", name: "Sales & Operating Revenue", type: "REVENUE", subtype: "REVENUE", is_payment_account: false, account_role: "INTERNAL_LEDGER" },
      { code: "5000", name: "Operating Expenses", type: "EXPENSE", subtype: "EXPENSE", is_payment_account: false, account_role: "INTERNAL_LEDGER" },
      { code: "5100", name: "Interest Expense", type: "EXPENSE", subtype: "EXPENSE", is_payment_account: false, account_role: "INTERNAL_LEDGER" },
    ];

    for (const acc of catalogue) {
      await pool.query(
        `INSERT INTO accounting_financial_accounts
           (workspace_id, code, name, type, subtype, currency, is_system, is_active, is_payment_account, account_role, opening_balance_minor, current_balance_minor)
         VALUES ($1, $2, $3, $4, $5, 'INR', true, true, $6, $7, 0, 0)
         ON CONFLICT (workspace_id, code) DO UPDATE SET is_active = true`,
        [workspaceId, acc.code, acc.name, acc.type, acc.subtype, acc.is_payment_account, acc.account_role]
      );
    }

    // Verify payment accounts
    const paymentAccsRes = await pool.query(
      `SELECT * FROM accounting_financial_accounts
       WHERE workspace_id = $1 AND is_active = true AND is_payment_account = true
       ORDER BY code ASC`,
      [workspaceId]
    );

    assert.equal(paymentAccsRes.rows.length, 2, "Must have exactly 2 payment accounts");

    const cashAcc = paymentAccsRes.rows[0];
    const bankAcc = paymentAccsRes.rows[1];

    assert.equal(cashAcc.code, "1010");
    assert.equal(cashAcc.name, "Cash in Hand");
    assert.equal(cashAcc.subtype, "CASH");
    assert.equal(Number(cashAcc.current_balance_minor), 0, "Cash in Hand must start at ₹0.00");
    assert.equal(Number(cashAcc.opening_balance_minor), 0, "Cash in Hand opening balance must be 0");

    assert.equal(bankAcc.code, "1020");
    assert.equal(bankAcc.name, "Bank Account");
    assert.equal(bankAcc.subtype, "BANK");
    assert.equal(Number(bankAcc.current_balance_minor), 0, "Bank Account must start at ₹0.00");
    assert.equal(Number(bankAcc.opening_balance_minor), 0, "Bank Account opening balance must be 0");

    // Verify internal accounts are NOT marked as payment accounts
    const internalAccsRes = await pool.query(
      `SELECT code, name, is_payment_account FROM accounting_financial_accounts
       WHERE workspace_id = $1 AND code NOT IN ('1010', '1020')`,
      [workspaceId]
    );
    assert.equal(internalAccsRes.rows.length, 7, "Must have 7 internal ledger accounts");
    for (const r of internalAccsRes.rows) {
      assert.equal(r.is_payment_account, false, `${r.name} must NOT be a visible payment account`);
    }
  });

  await t.test("2. Re-seeding is idempotent and does not create duplicates or reset balances", async () => {
    // Re-run the exact insert
    for (const code of ["1010", "1020"]) {
      await pool.query(
        `INSERT INTO accounting_financial_accounts
           (workspace_id, code, name, type, subtype, currency, is_system, is_active, is_payment_account, account_role, opening_balance_minor, current_balance_minor)
         VALUES ($1, $2, 'Test', 'ASSET', 'CASH', 'INR', true, true, true, 'CASH', 0, 0)
         ON CONFLICT (workspace_id, code) DO UPDATE SET is_active = true`,
        [workspaceId, code]
      );
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM accounting_financial_accounts WHERE workspace_id = $1`,
      [workspaceId]
    );
    assert.equal(countRes.rows[0].count, 9, "Account count must remain strictly 9");
  });

  await t.test("3. Setting opening balance posts balanced journal against Owner Equity (3000)", async () => {
    const cashRes = await pool.query(
      `SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1010'`,
      [workspaceId]
    );
    const cashId = cashRes.rows[0].id;

    const equityRes = await pool.query(
      `SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '3000'`,
      [workspaceId]
    );
    const equityId = equityRes.rows[0].id;

    // Post opening balance of ₹10,000 (1000000 minor)
    const entryRes = await pool.query(
      `INSERT INTO accounting_journal_entries
         (workspace_id, entry_number, entry_date, entry_type, description, source_type, source_id, status, created_by)
       VALUES ($1, 'OB-001', CURRENT_DATE, 'OPENING_BALANCE', 'Opening balance for Cash in Hand', 'ACCOUNT', $2, 'POSTED', $3)
       RETURNING id`,
      [workspaceId, cashId, userId]
    );
    const entryId = entryRes.rows[0].id;

    // Balanced lines: Debit Cash 1000000, Credit Equity 1000000
    await pool.query(
      `INSERT INTO accounting_journal_lines
         (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES
         ($1, $2, 1000000, 0, 'Opening balance Cash'),
         ($1, $3, 0, 1000000, 'Opening equity funding')`,
      [entryId, cashId, equityId]
    );

    // Update balances
    await pool.query(
      `UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + 1000000, opening_balance_minor = 1000000 WHERE id = $1`,
      [cashId]
    );
    await pool.query(
      `UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + 1000000, opening_balance_minor = 1000000 WHERE id = $1`,
      [equityId]
    );

    // Verify Cash in Hand is ₹10,000
    const cashUpdated = await pool.query(`SELECT current_balance_minor, opening_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [cashId]);
    assert.equal(Number(cashUpdated.rows[0].current_balance_minor), 1000000);
    assert.equal(Number(cashUpdated.rows[0].opening_balance_minor), 1000000);

    // Available Balance must equal Cash in Hand + Bank Account = ₹10,000 + 0 = ₹10,000
    const availRes = await pool.query(
      `SELECT COALESCE(SUM(current_balance_minor), 0) as total
       FROM accounting_financial_accounts
       WHERE workspace_id = $1 AND is_active = true AND is_payment_account = true`,
      [workspaceId]
    );
    assert.equal(Number(availRes.rows[0].total), 1000000);
  });

  await t.test("4. Transfers between Cash in Hand and Bank Account preserve combined Available Balance", async () => {
    const cashRes = await pool.query(`SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1010'`, [workspaceId]);
    const bankRes = await pool.query(`SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1020'`, [workspaceId]);
    const cashId = cashRes.rows[0].id;
    const bankId = bankRes.rows[0].id;

    // Transfer ₹4,000 (400000 minor) from Cash in Hand to Bank Account
    const transferEntry = await pool.query(
      `INSERT INTO accounting_journal_entries
         (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, created_by)
       VALUES ($1, 'TR-001', CURRENT_DATE, 'TRANSFER', 'Transfer Cash to Bank', 'TRANSACTION', 'POSTED', $2)
       RETURNING id`,
      [workspaceId, userId]
    );
    const entryId = transferEntry.rows[0].id;

    // Debit Bank 400000, Credit Cash 400000
    await pool.query(
      `INSERT INTO accounting_journal_lines
         (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES
         ($1, $2, 400000, 0, 'Transfer In'),
         ($1, $3, 0, 400000, 'Transfer Out')`,
      [entryId, bankId, cashId]
    );

    // Update balances
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor - 400000 WHERE id = $1`, [cashId]);
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + 400000 WHERE id = $1`, [bankId]);

    // Check individual balances
    const cashAfter = await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [cashId]);
    const bankAfter = await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [bankId]);

    assert.equal(Number(cashAfter.rows[0].current_balance_minor), 600000, "Cash in Hand must be ₹6,000");
    assert.equal(Number(bankAfter.rows[0].current_balance_minor), 400000, "Bank Account must be ₹4,000");

    // Combined Available Balance must still equal exactly ₹10,000
    const availRes = await pool.query(
      `SELECT COALESCE(SUM(current_balance_minor), 0) as total
       FROM accounting_financial_accounts
       WHERE workspace_id = $1 AND is_active = true AND is_payment_account = true`,
      [workspaceId]
    );
    assert.equal(Number(availRes.rows[0].total), 1000000, "Combined Available Balance must remain strictly ₹10,000");
  });

  await t.test("5. Multi-tenant isolation: Tenant B cannot see or manipulate Tenant A payment accounts", async () => {
    // Seed Tenant B accounts
    await pool.query(
      `INSERT INTO accounting_financial_accounts
         (workspace_id, code, name, type, subtype, is_payment_account, account_role, current_balance_minor)
       VALUES
         ($1, '1010', 'Cash in Hand', 'ASSET', 'CASH', true, 'CASH', 0),
         ($1, '1020', 'Bank Account', 'ASSET', 'BANK', true, 'BANK', 0)`,
      [tenantBWorkspaceId]
    );

    // Tenant B available balance must be 0, unaffected by Workspace A's ₹10,000
    const tenantBAvail = await pool.query(
      `SELECT COALESCE(SUM(current_balance_minor), 0) as total
       FROM accounting_financial_accounts
       WHERE workspace_id = $1 AND is_active = true AND is_payment_account = true`,
      [tenantBWorkspaceId]
    );
    assert.equal(Number(tenantBAvail.rows[0].total), 0, "Tenant B available balance must be 0");
  });
});
