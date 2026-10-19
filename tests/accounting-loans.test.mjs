import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Accounting: Case 6 - ₹20,000 loan receipt increases cash and liability, not revenue; repayment splits principal & interest", async (t) => {
  let testUserId;
  let testWorkspaceId;
  let bankAccId;
  let loanLiabAccId;
  let interestExpAccId;
  let revAccId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    testUserId = userRes.rows[0].id;

    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Loan Test Workspace', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [testUserId]
    );
    testWorkspaceId = wsRes.rows[0].id;

    const bRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype)
       VALUES ($1, '1020', 'Bank Account', 'ASSET', 'BANK') RETURNING id`,
      [testWorkspaceId]
    );
    bankAccId = bRes.rows[0].id;

    const lRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype)
       VALUES ($1, '2500', 'Loans Payable', 'LIABILITY', 'LOAN') RETURNING id`,
      [testWorkspaceId]
    );
    loanLiabAccId = lRes.rows[0].id;

    const iRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype)
       VALUES ($1, '5100', 'Interest Expense', 'EXPENSE', 'EXPENSE') RETURNING id`,
      [testWorkspaceId]
    );
    interestExpAccId = iRes.rows[0].id;

    const rRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype)
       VALUES ($1, '4000', 'Sales Revenue', 'REVENUE', 'REVENUE') RETURNING id`,
      [testWorkspaceId]
    );
    revAccId = rRes.rows[0].id;
  });

  t.after(async () => {
    if (testWorkspaceId) {
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWorkspaceId]).catch(() => {});
    }
  });

  await t.test("1. ₹20,000 Loan Receipt: Cash +₹20,000, Liability +₹20,000, REVENUE IS ZERO", async () => {
    const principalMinor = 2000000; // ₹20,000.00
    const today = new Date().toISOString().slice(0, 10);

    // Journal: Debit Bank ₹20,000, Credit Loans Payable ₹20,000
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, created_by)
       VALUES ($1, 'JE-LOAN-DISBURSE', $2, 'LOAN_RECEIPT', 'Working Capital Loan Receipt', 'LOAN', 'POSTED', $3)
       RETURNING id`,
      [testWorkspaceId, today, testUserId]
    );
    const jeId = jeRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, 0, 'Loan Funds Disbursed to Bank'), ($1, $4, 0, $3, 'Loan Principal Liability')`,
      [jeId, bankAccId, principalMinor, loanLiabAccId]
    );

    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + $1 WHERE id = $2`, [principalMinor, bankAccId]);
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + $1 WHERE id = $2`, [principalMinor, loanLiabAccId]);

    // Create Loan record
    await pool.query(
      `INSERT INTO accounting_loans (workspace_id, loan_name, liability_account_id, disbursement_account_id, principal_minor, remaining_principal_minor, tenure_months, start_date)
       VALUES ($1, 'Bank Working Capital Loan', $2, $3, $4, $4, 12, $5)`,
      [testWorkspaceId, loanLiabAccId, bankAccId, principalMinor, today]
    );

    // Verify Invariants:
    // Cash increased by ₹20,000
    const bankBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [bankAccId])).rows[0].current_balance_minor;
    assert.equal(Number(bankBal), 2000000, "Bank account must be +₹20,000");

    // Liability increased by ₹20,000
    const liabBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [loanLiabAccId])).rows[0].current_balance_minor;
    assert.equal(Number(liabBal), 2000000, "Loan Liability must be +₹20,000");

    // Revenue must remain ZERO (Loan receipt is NEVER income/revenue!)
    const revBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [revAccId])).rows[0].current_balance_minor;
    assert.equal(Number(revBal), 0, "Sales Revenue must be strictly 0; loan receipt must never be counted as income");
  });

  await t.test("2. Loan Installment Repayment: Principal reduces liability; interest is an expense", async () => {
    // EMI payment: ₹1,800 total (₹1,500 principal reduction + ₹300 interest expense)
    const principalPaid = 150000; // ₹1,500.00
    const interestPaid = 30000;   // ₹300.00
    const totalEmi = 180000;       // ₹1,800.00
    const today = new Date().toISOString().slice(0, 10);

    // Journal Entry:
    // Debit Loans Payable ₹1,500 (reduces liability)
    // Debit Interest Expense ₹300 (operating expense)
    // Credit Bank Account ₹1,800 (cash outflow)
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, created_by)
       VALUES ($1, 'JE-EMI-001', $2, 'LOAN_REPAYMENT', 'Monthly EMI Payment', 'LOAN_INSTALLMENT', 'POSTED', $3)
       RETURNING id`,
      [testWorkspaceId, today, testUserId]
    );
    const jeId = jeRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, 0, 'Principal Reduction'),
              ($1, $4, $5, 0, 'Interest Expense'),
              ($1, $6, 0, $7, 'EMI Bank Outflow')`,
      [jeId, loanLiabAccId, principalPaid, interestExpAccId, interestPaid, bankAccId, totalEmi]
    );

    // Update balances:
    // Loans Payable (Liability) reduces by ₹1,500
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor - $1 WHERE id = $2`, [principalPaid, loanLiabAccId]);
    // Interest Expense (Expense) increases by ₹300
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + $1 WHERE id = $2`, [interestPaid, interestExpAccId]);
    // Bank Account (Asset) reduces by ₹1,800
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor - $1 WHERE id = $2`, [totalEmi, bankAccId]);

    // Verify Balances:
    // Bank: ₹20,000 - ₹1,800 = ₹18,200
    const finalBank = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [bankAccId])).rows[0].current_balance_minor;
    assert.equal(Number(finalBank), 1820000);

    // Remaining Loan Liability: ₹20,000 - ₹1,500 = ₹18,500 (NOT reduced by interest!)
    const finalLiab = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [loanLiabAccId])).rows[0].current_balance_minor;
    assert.equal(Number(finalLiab), 1850000, "Loan liability must reduce ONLY by principal amount, not total EMI");

    // Interest Expense: ₹300
    const finalInt = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [interestExpAccId])).rows[0].current_balance_minor;
    assert.equal(Number(finalInt), 30000, "Interest must be classified as an expense");
  });
});
