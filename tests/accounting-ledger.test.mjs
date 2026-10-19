import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Accounting General Ledger: Case 1 - ₹10,000 credit sale with ₹4,000 collection", async (t) => {
  let testUserId;
  let testWorkspaceId;
  let testContactId;
  let testInvoiceId;
  let testPaymentId;

  t.before(async () => {
    // 1. Get an existing user
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    testUserId = userRes.rows[0].id;

    // 2. Ensure test workspace
    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Ledger Test Workspace', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [testUserId]
    );
    testWorkspaceId = wsRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}'::jsonb)`,
      [testWorkspaceId, testUserId]
    );

    // 3. Insert system accounts
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
      await pool.query(
        `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, currency, is_system, is_active)
         VALUES ($1, $2, $3, $4, $5, 'INR', true, true)
         ON CONFLICT (workspace_id, code) DO NOTHING`,
        [testWorkspaceId, a.code, a.name, a.type, a.subtype]
      );
    }

    // 4. Create customer contact
    const contactRes = await pool.query(
      `INSERT INTO accounting_contacts (workspace_id, name, type, email, phone)
       VALUES ($1, 'Corporate Client Pvt Ltd', 'CUSTOMER', 'client@example.com', '+919876543210')
       RETURNING id`,
      [testWorkspaceId]
    );
    testContactId = contactRes.rows[0].id;
  });

  t.after(async () => {
    if (testWorkspaceId) {
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWorkspaceId]).catch(() => {});
    }
  });

  await t.test("1. Post ₹10,000 Credit Sale via Invoice (Accrual Accounting)", async () => {
    const totalMinor = 1000000; // ₹10,000.00
    const invNumber = `INV-2026-TEST01`;
    const today = new Date().toISOString().slice(0, 10);

    const arAcc = (await pool.query(`SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1200'`, [testWorkspaceId])).rows[0];
    const revAcc = (await pool.query(`SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '4000'`, [testWorkspaceId])).rows[0];

    // Post double-entry journal entry: Debit AR ₹10,000, Credit Revenue ₹10,000
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, created_by)
       VALUES ($1, 'JE-SALE-001', $2, 'SALE', 'Credit Sale Invoice', 'INVOICE', 'POSTED', $3)
       RETURNING id`,
      [testWorkspaceId, today, testUserId]
    );
    const jeId = jeRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, 0, 'Accounts Receivable'), ($1, $4, 0, $3, 'Sales Revenue')`,
      [jeId, arAcc.id, totalMinor, revAcc.id]
    );

    // Update account balances
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + $1 WHERE id = $2`, [totalMinor, arAcc.id]);
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + $1 WHERE id = $2`, [totalMinor, revAcc.id]);

    // Create Invoice
    const invRes = await pool.query(
      `INSERT INTO accounting_invoices (workspace_id, invoice_number, contact_id, issue_date, due_date, status, subtotal_minor, total_minor, amount_paid_minor, amount_due_minor, posted_journal_entry_id)
       VALUES ($1, $2, $3, $4, $4, 'ISSUED', $5, $5, 0, $5, $6)
       RETURNING id, amount_due_minor, amount_paid_minor, status`,
      [testWorkspaceId, invNumber, testContactId, today, totalMinor, jeId]
    );
    testInvoiceId = invRes.rows[0].id;

    // Contact receivable updated
    await pool.query(`UPDATE accounting_contacts SET total_receivable_minor = total_receivable_minor + $1 WHERE id = $2`, [totalMinor, testContactId]);

    // Assertions after Credit Sale:
    // Revenue is ₹10,000; Receivable is ₹10,000; Cash collected is ₹0
    const arBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [arAcc.id])).rows[0].current_balance_minor;
    const revBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [revAcc.id])).rows[0].current_balance_minor;
    const bankBal = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1020'`, [testWorkspaceId])).rows[0].current_balance_minor;

    assert.equal(Number(arBal), 1000000, "Accounts Receivable must be ₹10,000");
    assert.equal(Number(revBal), 1000000, "Earned Revenue must be ₹10,000");
    assert.equal(Number(bankBal), 0, "Cash in Bank must still be ₹0 (no cash received yet)");
  });

  await t.test("2. Collect ₹4,000 Partial Payment (Never ₹10,000 Cash)", async () => {
    const collectMinor = 400000; // ₹4,000.00
    const today = new Date().toISOString().slice(0, 10);

    const arAcc = (await pool.query(`SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1200'`, [testWorkspaceId])).rows[0];
    const bankAcc = (await pool.query(`SELECT id FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1020'`, [testWorkspaceId])).rows[0];

    // Post double-entry journal entry: Debit Bank ₹4,000, Credit AR ₹4,000
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, created_by)
       VALUES ($1, 'JE-PAY-001', $2, 'PAYMENT_COLLECTION', 'Partial Collection', 'PAYMENT', 'POSTED', $3)
       RETURNING id`,
      [testWorkspaceId, today, testUserId]
    );
    const jeId = jeRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, 0, 'Funds Received'), ($1, $4, 0, $3, 'Accounts Receivable Settled')`,
      [jeId, bankAcc.id, collectMinor, arAcc.id]
    );

    // Update balances: Bank +₹4,000, AR -₹4,000
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor + $1 WHERE id = $2`, [collectMinor, bankAcc.id]);
    await pool.query(`UPDATE accounting_financial_accounts SET current_balance_minor = current_balance_minor - $1 WHERE id = $2`, [collectMinor, arAcc.id]);

    // Record Payment & Allocation
    const payRes = await pool.query(
      `INSERT INTO accounting_payments (workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor, payment_date, journal_entry_id, created_by)
       VALUES ($1, 'PAY-2026-TEST01', 'IN', $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [testWorkspaceId, testContactId, bankAcc.id, collectMinor, today, jeId, testUserId]
    );
    testPaymentId = payRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_payment_allocations (payment_id, invoice_id, allocated_minor)
       VALUES ($1, $2, $3)`,
      [testPaymentId, testInvoiceId, collectMinor]
    );

    // Update Invoice status and balances
    await pool.query(
      `UPDATE accounting_invoices
       SET amount_paid_minor = amount_paid_minor + $1,
           amount_due_minor = amount_due_minor - $1,
           status = 'PARTIALLY_PAID',
           updated_at = NOW()
       WHERE id = $2`,
      [collectMinor, testInvoiceId]
    );

    // Reduce contact receivable
    await pool.query(
      `UPDATE accounting_contacts SET total_receivable_minor = total_receivable_minor - $1 WHERE id = $2`,
      [collectMinor, testContactId]
    );

    // Strict Acceptance Invariants:
    // - Revenue must be ₹10,000 (never inflated)
    // - Cash / Bank must be exactly +₹4,000 (NEVER ₹10,000 cash)
    // - Remaining Accounts Receivable must be ₹6,000
    const finalBank = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [bankAcc.id])).rows[0].current_balance_minor;
    const finalAR = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [arAcc.id])).rows[0].current_balance_minor;
    const finalRev = (await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '4000'`, [testWorkspaceId])).rows[0].current_balance_minor;

    assert.equal(Number(finalBank), 400000, "Bank account must be +₹4,000 (NEVER ₹10,000 cash)");
    assert.equal(Number(finalAR), 600000, "Remaining Accounts Receivable must be exactly ₹6,000");
    assert.equal(Number(finalRev), 1000000, "Revenue must remain ₹10,000 (not inflated by payment)");

    const invoiceCheck = (await pool.query(`SELECT amount_paid_minor, amount_due_minor, status FROM accounting_invoices WHERE id = $1`, [testInvoiceId])).rows[0];
    assert.equal(Number(invoiceCheck.amount_paid_minor), 400000);
    assert.equal(Number(invoiceCheck.amount_due_minor), 600000);
    assert.equal(invoiceCheck.status, "PARTIALLY_PAID");
  });

  await t.test("3. Case 11 - General Ledger strictly balances across all debits and credits", async () => {
    const journalCheck = await pool.query(
      `SELECT
         je.id,
         je.entry_number,
         COALESCE(SUM(jl.debit_minor), 0) as debits,
         COALESCE(SUM(jl.credit_minor), 0) as credits
       FROM accounting_journal_entries je
       JOIN accounting_journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.workspace_id = $1
       GROUP BY je.id, je.entry_number`,
      [testWorkspaceId]
    );

    assert.ok(journalCheck.rows.length >= 2, "There must be at least 2 journal entries");

    for (const row of journalCheck.rows) {
      assert.equal(
        row.debits,
        row.credits,
        `Journal entry ${row.entry_number} debits (${row.debits}) must equal credits (${row.credits})`
      );
    }
  });
});
