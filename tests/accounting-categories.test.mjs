import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Accounting: Case 3 (Dynamic Category & Budget) & Case 10 (Archived Category Safeguards)", async (t) => {
  let testUserId;
  let testWorkspaceId;
  let expenseAccId;
  let cashAccId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    testUserId = userRes.rows[0].id;

    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Category Test Workspace', 'BUSINESS', 'INR', 'Asia/Kolkata', 'INDIVIDUAL')
       RETURNING id`,
      [testUserId]
    );
    testWorkspaceId = wsRes.rows[0].id;

    const cashRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype)
       VALUES ($1, '1010', 'Cash', 'ASSET', 'CASH') RETURNING id`,
      [testWorkspaceId]
    );
    cashAccId = cashRes.rows[0].id;

    const expRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype)
       VALUES ($1, '5000', 'Operating Expenses', 'EXPENSE', 'EXPENSE') RETURNING id`,
      [testWorkspaceId]
    );
    expenseAccId = expRes.rows[0].id;
  });

  t.after(async () => {
    if (testWorkspaceId) {
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWorkspaceId]).catch(() => {});
    }
  });

  await t.test("Case 3: ₹1,500 school expense in a dynamically created category appears in search, budgets and reports", async () => {
    // 1. User dynamically creates category "School & Education Fees"
    const catName = "School & Education Fees";
    const catRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, icon, color)
       VALUES ($1, $2, 'school-education-fees', 'EXPENSE', 'BookOpen', '#3B82F6')
       RETURNING id, name, is_archived`,
      [testWorkspaceId, catName]
    );
    const category = catRes.rows[0];
    assert.equal(category.name, catName);
    assert.equal(category.is_archived, false);

    // 2. Search finds dynamically created category
    const searchRes = await pool.query(
      `SELECT * FROM accounting_categories WHERE workspace_id = $1 AND LOWER(name) LIKE '%school%'`,
      [testWorkspaceId]
    );
    assert.equal(searchRes.rows.length, 1);
    assert.equal(searchRes.rows[0].id, category.id);

    // 3. User sets monthly budget of ₹5,000 for this category
    const budgetRes = await pool.query(
      `INSERT INTO accounting_budgets (workspace_id, category_id, period_type, period_start, period_end, amount_minor, alert_threshold_percent)
       VALUES ($1, $2, 'MONTHLY', '2026-10-01', '2026-10-31', 500000, 80)
       RETURNING id, amount_minor`,
      [testWorkspaceId, category.id]
    );
    assert.equal(Number(budgetRes.rows[0].amount_minor), 500000);

    // 4. Record ₹1,500 school expense
    const expenseMinor = 150000; // ₹1,500.00
    const today = '2026-10-15';

    // Journal Entry: Debit Expense ₹1,500, Credit Cash ₹1,500
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, created_by)
       VALUES ($1, 'JE-SCH-01', $2, 'EXPENSE', 'Term 1 School Books', 'TRANSACTION', 'POSTED', $3)
       RETURNING id`,
      [testWorkspaceId, today, testUserId]
    );
    const jeId = jeRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, 0, 'School Expense'), ($1, $4, 0, $3, 'Cash Outflow')`,
      [jeId, expenseAccId, expenseMinor, cashAccId]
    );

    // Insert user transaction
    await pool.query(
      `INSERT INTO accounting_transactions (workspace_id, journal_entry_id, type, category_id, financial_account_id, amount_minor, date, notes)
       VALUES ($1, $2, 'EXPENSE', $3, $4, $5, $6, 'School books and supplies')`,
      [testWorkspaceId, jeId, category.id, cashAccId, expenseMinor, today]
    );

    // 5. Verify budget spent recalculation reflects ₹1,500
    const spentRes = await pool.query(
      `SELECT COALESCE(SUM(amount_minor), 0) as spent
       FROM accounting_transactions
       WHERE workspace_id = $1 AND category_id = $2 AND date >= '2026-10-01' AND date <= '2026-10-31'`,
      [testWorkspaceId, category.id]
    );
    assert.equal(Number(spentRes.rows[0].spent), 150000, "Budget spent must reflect ₹1,500");

    // 6. Verify report category spending includes this category
    const reportCatRes = await pool.query(
      `SELECT c.name, SUM(t.amount_minor) as total
       FROM accounting_transactions t
       JOIN accounting_categories c ON c.id = t.category_id
       WHERE t.workspace_id = $1
       GROUP BY c.name`,
      [testWorkspaceId]
    );
    assert.equal(reportCatRes.rows[0].name, catName);
    assert.equal(Number(reportCatRes.rows[0].total), 150000);
  });

  await t.test("Case 10: Archived category safeguards historical references and reports", async () => {
    // 1. Find the category
    const cat = (await pool.query(`SELECT id FROM accounting_categories WHERE workspace_id = $1 LIMIT 1`, [testWorkspaceId])).rows[0];

    // 2. Archive category (soft archive, never hard deleted)
    await pool.query(
      `UPDATE accounting_categories SET is_archived = true WHERE id = $1`,
      [cat.id]
    );

    // 3. For new transactions (active only), category is excluded
    const activeCats = await pool.query(
      `SELECT * FROM accounting_categories WHERE workspace_id = $1 AND is_archived = false`,
      [testWorkspaceId]
    );
    assert.equal(activeCats.rows.length, 0, "Archived category must not appear in active category list for new entries");

    // 4. In historical reports, transaction and category reference remain intact
    const historicalTx = await pool.query(
      `SELECT t.*, c.name as category_name, c.is_archived
       FROM accounting_transactions t
       JOIN accounting_categories c ON c.id = t.category_id
       WHERE t.workspace_id = $1`,
      [testWorkspaceId]
    );
    assert.equal(historicalTx.rows.length, 1);
    assert.equal(historicalTx.rows[0].category_name, "School & Education Fees");
    assert.equal(historicalTx.rows[0].is_archived, true, "Historical transaction retains link to archived category");
  });
});
