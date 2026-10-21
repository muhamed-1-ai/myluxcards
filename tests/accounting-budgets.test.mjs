import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";
import { createRequire } from "node:module";

config({ path: ".env" });

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
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

// Dynamic imports after server-only bypass
const {
  getMonthDateRange,
  formatBudgetRecord,
  formatPeriodDate,
  createBudget,
  listBudgets,
} = await import("../src/lib/accounting/budgets.ts");
const { createCategory } = await import("../src/lib/accounting/categories.ts");
const { createContact, listContacts } = await import("../src/lib/accounting/contacts.ts");
const { seedDefaultChartOfAccounts, listFinancialAccounts } = await import("../src/lib/accounting/accounts.ts");

test("Accounting Budgets & Planning End-to-End Verification", async (t) => {
  let userAId, userBId, wsAId, wsBId;
  let testExpenseCatId, testIncomeCatId, testArchivedCatId;
  let testFinancialAccountId;
  const createdBudgetIds = [];
  const createdCatIds = [];
  const createdTxIds = [];
  const createdJeIds = [];

  t.before(async () => {
    // 1. Obtain test users
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Must have at least two users for isolation tests");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // 2. Create unique test Workspace A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Budget Test WS A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsAId, userAId]
    );

    // 3. Create unique test Workspace B
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Budget Test WS B', 'PERSONAL', 'INDIVIDUAL') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsBId, userBId]
    );

    // 4. Seed chart of accounts for Workspace A
    await seedDefaultChartOfAccounts(wsAId);
    const accounts = await listFinancialAccounts(wsAId);
    const cashAcc = accounts.find((a) => a.code === "1010") || accounts[0];
    testFinancialAccountId = cashAcc.id;

    // 5. Create categories in Workspace A for testing
    const expCat = await createCategory(wsAId, {
      name: "Office Supplies",
      type: "EXPENSE",
    });
    testExpenseCatId = expCat.id;
    createdCatIds.push(expCat.id);

    const incCat = await createCategory(wsAId, {
      name: "Consulting Revenue",
      type: "INCOME",
    });
    testIncomeCatId = incCat.id;
    createdCatIds.push(incCat.id);

    const archCat = await createCategory(wsAId, {
      name: "Old Marketing",
      type: "EXPENSE",
    });
    testArchivedCatId = archCat.id;
    createdCatIds.push(archCat.id);
    await pool.query(`UPDATE accounting_categories SET is_archived = true WHERE id = $1`, [archCat.id]);
  });

  t.after(async () => {
    // Cleanup transactions & journal entries
    if (createdTxIds.length > 0) {
      await pool.query(`DELETE FROM accounting_transactions WHERE id = ANY($1::uuid[])`, [createdTxIds]);
    }
    if (createdJeIds.length > 0) {
      await pool.query(`DELETE FROM accounting_journal_entries WHERE id = ANY($1::uuid[])`, [createdJeIds]);
    }
    // Cleanup budgets
    if (createdBudgetIds.length > 0) {
      await pool.query(`DELETE FROM accounting_budgets WHERE id = ANY($1::uuid[])`, [createdBudgetIds]);
    }
    // Cleanup categories
    if (createdCatIds.length > 0) {
      await pool.query(`DELETE FROM accounting_categories WHERE id = ANY($1::uuid[])`, [createdCatIds]);
    }
    // Cleanup financial accounts
    if (wsAId) {
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsAId]);
    }
    if (wsBId) {
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsBId]);
    }
    // Cleanup workspaces
    if (wsAId) {
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]);
    }
    if (wsBId) {
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]);
    }
    await pool.end();
    const { pool: sharedPool } = await import("../src/lib/db/index.ts");
    await sharedPool.end();
  });

  await t.test("1. Month parsing, leap years, February, and year transitions", () => {
    // Leap year February (2024 has 29 days)
    const feb2024 = getMonthDateRange("2024-02");
    assert.equal(feb2024.periodStart, "2024-02-01");
    assert.equal(feb2024.periodEnd, "2024-02-29");

    // Non-leap year February (2025 and 2026 have 28 days)
    const feb2025 = getMonthDateRange("2025-02");
    assert.equal(feb2025.periodStart, "2025-02-01");
    assert.equal(feb2025.periodEnd, "2025-02-28");

    const feb2026 = getMonthDateRange("2026-02");
    assert.equal(feb2026.periodStart, "2026-02-01");
    assert.equal(feb2026.periodEnd, "2026-02-28");

    // 30-day month (April)
    const apr2026 = getMonthDateRange("2026-04");
    assert.equal(apr2026.periodStart, "2026-04-01");
    assert.equal(apr2026.periodEnd, "2026-04-30");

    // 31-day month and year transition (December to January)
    const dec2026 = getMonthDateRange("2026-12");
    assert.equal(dec2026.periodStart, "2026-12-01");
    assert.equal(dec2026.periodEnd, "2026-12-31");

    const jan2027 = getMonthDateRange("2027-01");
    assert.equal(jan2027.periodStart, "2027-01-01");
    assert.equal(jan2027.periodEnd, "2027-01-31");

    // Invalid month formats must throw
    assert.throws(() => getMonthDateRange("2026-13"), /Invalid budget month format/);
    assert.throws(() => getMonthDateRange("2026-00"), /Invalid budget month format/);
    assert.throws(() => getMonthDateRange("invalid"), /Invalid budget month format/);
    assert.throws(() => getMonthDateRange(""), /Invalid budget month format/);
  });

  await t.test("2. Create Category Budget with ₹2000 and explicit month (Oct 2026)", async () => {
    const budget = await createBudget({
      workspaceId: wsAId,
      categoryId: testExpenseCatId,
      month: "2026-10",
      amountMinor: 200000, // ₹2000.00
      periodType: "MONTHLY",
    });

    createdBudgetIds.push(budget.id);

    assert.ok(budget.id, "Budget must have an ID");
    assert.equal(budget.workspace_id, wsAId);
    assert.equal(budget.category_id, testExpenseCatId);
    assert.equal(budget.category_name, "Office Supplies");
    assert.equal(budget.period_start, "2026-10-01");
    assert.equal(budget.period_end, "2026-10-31");
    assert.equal(budget.start_date, "2026-10-01");
    assert.equal(budget.end_date, "2026-10-31");
    assert.equal(budget.amount_minor, 200000);
    assert.equal(budget.spent_minor, 0);
    assert.equal(budget.remaining_minor, 200000);
    assert.equal(budget.percent_used, 0);
    assert.equal(budget.is_exceeded, false);

    // Verify raw PostgreSQL row has NOT NULL period_start and period_end
    const raw = await pool.query(
      `SELECT period_start, period_end, amount_minor FROM accounting_budgets WHERE id = $1`,
      [budget.id]
    );
    assert.equal(raw.rows.length, 1);
    assert.ok(raw.rows[0].period_start, "period_start must NOT be null in database");
    assert.ok(raw.rows[0].period_end, "period_end must NOT be null in database");
    assert.equal(Number(raw.rows[0].amount_minor), 200000);
  });

  await t.test("3. Create Overall Workspace Budget with category blank", async () => {
    const budget = await createBudget({
      workspaceId: wsAId,
      categoryId: undefined,
      month: "2026-10",
      amountMinor: 500000, // ₹5000.00
      periodType: "MONTHLY",
    });

    createdBudgetIds.push(budget.id);

    assert.ok(budget.id);
    assert.equal(budget.workspace_id, wsAId);
    assert.equal(budget.category_id, null);
    assert.equal(budget.category_name, "Overall Workspace Budget");
    assert.equal(budget.period_start, "2026-10-01");
    assert.equal(budget.period_end, "2026-10-31");
    assert.equal(budget.amount_minor, 500000);
  });

  await t.test("4. Validation: reject non-positive amounts, invalid categories, archived, and income categories", async () => {
    // Limit <= 0
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          month: "2026-11",
          amountMinor: 0,
        }),
      /positive monetary amount/
    );

    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          month: "2026-11",
          amountMinor: -500,
        }),
      /positive monetary amount/
    );

    // Missing month & missing period dates
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          amountMinor: 100000,
        }),
      /Budget month or period dates/
    );

    // Malformed category identifier
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          categoryId: "invalid-uuid-format",
          month: "2026-11",
          amountMinor: 100000,
        }),
      /Invalid category identifier format/
    );

    // Non-existent category (valid UUID format)
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          categoryId: "a0000000-0000-4000-a000-000000000000",
          month: "2026-11",
          amountMinor: 100000,
        }),
      /does not exist in this workspace/
    );

    // Archived category
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          categoryId: testArchivedCatId,
          month: "2026-11",
          amountMinor: 100000,
        }),
      /archived category/
    );

    // Non-expense category (INCOME)
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          categoryId: testIncomeCatId,
          month: "2026-11",
          amountMinor: 100000,
        }),
      /Budgets can only be set for Expense categories/
    );
  });

  await t.test("5. Idempotency double-submit guard and duplicate budget prevention", async () => {
    // 5a. Rapid resubmission within 10 seconds returns existing record (idempotency)
    const idempotentResult = await createBudget({
      workspaceId: wsAId,
      categoryId: testExpenseCatId,
      month: "2026-10",
      amountMinor: 200000,
    });
    assert.equal(idempotentResult.id, createdBudgetIds[0], "Should return existing budget on rapid double-submit");

    // 5b. Overall budget duplicate prevention
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          month: "2026-10",
          amountMinor: 750000, // different amount -> duplicate error
        }),
      /An overall workspace budget already exists for 2026-10/
    );

    // 5c. Category budget duplicate prevention with different amount
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsAId,
          categoryId: testExpenseCatId,
          month: "2026-10",
          amountMinor: 300000,
        }),
      /A budget for category "Office Supplies" already exists for 2026-10/
    );
  });

  await t.test("6. Database integrity: no expense created, no balance changed on budget creation", async () => {
    const txCountBefore = await pool.query(
      `SELECT count(*) FROM accounting_transactions WHERE workspace_id = $1`,
      [wsAId]
    );

    const b = await createBudget({
      workspaceId: wsAId,
      month: "2026-12",
      amountMinor: 150000,
    });
    createdBudgetIds.push(b.id);

    const txCountAfter = await pool.query(
      `SELECT count(*) FROM accounting_transactions WHERE workspace_id = $1`,
      [wsAId]
    );
    assert.equal(
      txCountBefore.rows[0].count,
      txCountAfter.rows[0].count,
      "Creating a budget must not insert transactions or alter ledger"
    );
  });

  await t.test("7. Dynamic spending calculations & inclusive month boundaries", async () => {
    // Create budget for November 2026
    const novBudget = await createBudget({
      workspaceId: wsAId,
      categoryId: testExpenseCatId,
      month: "2026-11",
      amountMinor: 100000, // ₹1000.00
    });
    createdBudgetIds.push(novBudget.id);

    // Insert 4 transactions:
    // T1: 2026-10-31 (day before period start) -> MUST NOT be counted
    // T2: 2026-11-01 (inclusive period start boundary) -> MUST be counted (₹200 = 20000)
    // T3: 2026-11-15 (inside period) -> MUST be counted (₹300 = 30000)
    // T4: 2026-11-30 (inclusive period end boundary) -> MUST be counted (₹400 = 40000)
    // T5: 2026-12-01 (day after period end) -> MUST NOT be counted
    const insertTx = async (date, amountMinor) => {
      const entryNum = "JE-TEST-" + Math.random().toString(36).slice(2, 10);
      const jeRes = await pool.query(
        `INSERT INTO accounting_journal_entries
           (workspace_id, entry_number, entry_date, entry_type, description, source_type, status)
         VALUES ($1, $2, $3, 'EXPENSE', 'Test boundary spending', 'TRANSACTION', 'POSTED')
         RETURNING id`,
        [wsAId, entryNum, date]
      );
      const jeId = jeRes.rows[0].id;
      createdJeIds.push(jeId);

      const res = await pool.query(
        `INSERT INTO accounting_transactions
           (workspace_id, journal_entry_id, financial_account_id, category_id, type, status, amount_minor, date, notes)
         VALUES ($1, $2, $3, $4, 'EXPENSE', 'POSTED', $5, $6, 'Test boundary spending')
         RETURNING id`,
        [wsAId, jeId, testFinancialAccountId, testExpenseCatId, amountMinor, date]
      );
      createdTxIds.push(res.rows[0].id);
    };

    await insertTx("2026-10-31", 99999); // Before
    await insertTx("2026-11-01", 20000); // Start boundary: ₹200
    await insertTx("2026-11-15", 30000); // Mid-month: ₹300
    await insertTx("2026-11-30", 40000); // End boundary: ₹400
    await insertTx("2026-12-01", 88888); // After

    // Fetch listBudgets - must dynamically calculate spent_minor = 20000 + 30000 + 40000 = 90000 (₹900)
    const allBudgets = await listBudgets(wsAId);
    const target = allBudgets.find((b) => b.id === novBudget.id);
    assert.ok(target, "November budget must be found in listBudgets");
    assert.equal(target.spent_minor, 90000, "Spent must equal sum of transactions within [2026-11-01, 2026-11-30]");
    assert.equal(target.remaining_minor, 10000, "Remaining must be 100000 - 90000 = 10000");
    assert.equal(target.percent_used, 90, "Percent used must be 90%");
    assert.equal(target.is_exceeded, false);

    // Add another transaction pushing over budget -> check is_exceeded flag
    await insertTx("2026-11-20", 20000); // + ₹200 => total ₹1100 (110000)
    const refreshedBudgets = await listBudgets(wsAId);
    const exceededTarget = refreshedBudgets.find((b) => b.id === novBudget.id);
    assert.equal(exceededTarget.spent_minor, 110000);
    assert.equal(exceededTarget.remaining_minor, -10000);
    assert.equal(exceededTarget.percent_used, 110);
    assert.equal(exceededTarget.is_exceeded, true);
  });

  await t.test("8. Workspace isolation: budgets and categories isolated between workspaces", async () => {
    // Workspace B cannot see Workspace A's budgets
    const wsBBudgets = await listBudgets(wsBId);
    assert.equal(wsBBudgets.length, 0, "Workspace B must not see any budgets of Workspace A");

    // Cannot use Workspace A category in Workspace B
    await assert.rejects(
      () =>
        createBudget({
          workspaceId: wsBId,
          categoryId: testExpenseCatId,
          month: "2026-10",
          amountMinor: 100000,
        }),
      /Selected category does not exist in this workspace/
    );
  });

  await t.test("9. Regression protection: People & Categories continue to work seamlessly", async () => {
    // Verify Add Person continues to work
    const person = await createContact({
      workspaceId: wsAId,
      name: "Budget Auditor Person",
      type: "VENDOR",
      email: "auditor@budgettest.com",
    });
    assert.ok(person.id);
    const people = await listContacts(wsAId);
    assert.ok(people.some((p) => p.name === "Budget Auditor Person"));

    // Cleanup person
    await pool.query(`DELETE FROM accounting_contacts WHERE id = $1`, [person.id]);

    // Verify Add Category continues to work
    const newCat = await createCategory(wsAId, {
      name: "Travel & Fleet",
      type: "EXPENSE",
    });
    assert.ok(newCat.id);
    createdCatIds.push(newCat.id);
  });
});
