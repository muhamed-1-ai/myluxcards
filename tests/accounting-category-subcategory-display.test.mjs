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

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

test("Category & Subcategory Hierarchy and Display Test Suite", async (t) => {
  let userId;
  let workspaceAId;
  let workspaceBId;
  let cashAccountId;
  let cashAccountBId;
  let foodCatId;
  let teaSnacksSubcatId;
  let foodOtherSubcatId;
  let utilitiesCatId;
  let utilsOtherSubcatId;
  let salesCatId;

  const { pool: corePool } = await import("../src/lib/db/core.ts");
  const { resolveTransactionCategory } = await import("../src/lib/accounting/categoryResolver.ts");
  const { createTransaction, updateTransaction, listTransactions } = await import("../src/lib/accounting/transactions.ts");
  const { getDashboardMetrics, generateTransactionsExport } = await import("../src/lib/accounting/reports.ts");
  const { seedDefaultChartOfAccounts, listFinancialAccounts } = await import("../src/lib/accounting/accounts.ts");

  t.before(async () => {
    // 1. Create test user
    const uRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('category_test_${Date.now()}@example.com', 'Category Test User', 'USER')
       RETURNING id`
    );
    userId = uRes.rows[0].id;

    // 2. Create Workspace A and Workspace B
    const wsA = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Category Workspace A', 'BUSINESS', $1)
       RETURNING id`,
      [userId]
    );
    workspaceAId = wsA.rows[0].id;

    const wsB = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Category Workspace B', 'BUSINESS', $1)
       RETURNING id`,
      [userId]
    );
    workspaceBId = wsB.rows[0].id;

    await seedDefaultChartOfAccounts(workspaceAId);
    await seedDefaultChartOfAccounts(workspaceBId);

    const accountsA = await listFinancialAccounts(workspaceAId);
    const cashA = accountsA.find((a) => a.code === "1010");
    assert.ok(cashA, "Cash account 1010 must exist in Workspace A");
    cashAccountId = cashA.id;

    const accountsB = await listFinancialAccounts(workspaceBId);
    const cashB = accountsB.find((a) => a.code === "1010");
    assert.ok(cashB, "Cash account 1010 must exist in Workspace B");
    cashAccountBId = cashB.id;

    // 3. Create Categories in Workspace A:
    // Food (main)
    const foodRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type)
       VALUES ($1, 'Food', 'food', 'EXPENSE')
       RETURNING id`,
      [workspaceAId]
    );
    foodCatId = foodRes.rows[0].id;

    // Tea & Snacks (sub of Food)
    const teaRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, parent_id)
       VALUES ($1, 'Tea & Snacks', 'tea-snacks', 'EXPENSE', $2)
       RETURNING id`,
      [workspaceAId, foodCatId]
    );
    teaSnacksSubcatId = teaRes.rows[0].id;

    // Other (sub of Food)
    const foodOtherRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, parent_id)
       VALUES ($1, 'Other', 'food-other', 'EXPENSE', $2)
       RETURNING id`,
      [workspaceAId, foodCatId]
    );
    foodOtherSubcatId = foodOtherRes.rows[0].id;

    // Utilities (main)
    const utilsRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type)
       VALUES ($1, 'Utilities', 'utilities', 'EXPENSE')
       RETURNING id`,
      [workspaceAId]
    );
    utilitiesCatId = utilsRes.rows[0].id;

    // Other (sub of Utilities) - duplicate name under different parent!
    const utilsOtherRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, parent_id)
       VALUES ($1, 'Other', 'utils-other', 'EXPENSE', $2)
       RETURNING id`,
      [workspaceAId, utilitiesCatId]
    );
    utilsOtherSubcatId = utilsOtherRes.rows[0].id;

    // Sales Revenue (main INCOME)
    const salesRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type)
       VALUES ($1, 'Sales Revenue', 'sales-revenue', 'INCOME')
       RETURNING id`,
      [workspaceAId]
    );
    salesCatId = salesRes.rows[0].id;
  });

  t.after(async () => {
    try {
      await pool.query(
        `DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (
           SELECT id FROM accounting_journal_entries WHERE workspace_id IN ($1, $2)
         )`,
        [workspaceAId, workspaceBId]
      );
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id IN ($1, $2)`, [workspaceAId, workspaceBId]);
      await pool.query(`DELETE FROM accounting_transactions WHERE workspace_id IN ($1, $2)`, [workspaceAId, workspaceBId]);
      await pool.query(`DELETE FROM accounting_categories WHERE workspace_id IN ($1, $2)`, [workspaceAId, workspaceBId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id IN ($1, $2)`, [workspaceAId, workspaceBId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id IN ($1, $2)`, [workspaceAId, workspaceBId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    } finally {
      await pool.end();
      await corePool.end();
    }
  });

  await t.test("1. Unit: resolveTransactionCategory rules", () => {
    // A: Main category with subcategory
    const withSub = resolveTransactionCategory({
      main_category_name: "Food",
      subcategory_name: "Tea & Snacks",
    });
    assert.equal(withSub.category, "Food");
    assert.equal(withSub.subcategory, "Tea & Snacks");
    assert.equal(withSub.hasCategory, true);
    assert.equal(withSub.hasSubcategory, true);

    // B: Main category only
    const mainOnly = resolveTransactionCategory({
      main_category_name: "Food",
      subcategory_name: null,
    });
    assert.equal(mainOnly.category, "Food");
    assert.equal(mainOnly.subcategory, "—");
    assert.equal(mainOnly.hasCategory, true);
    assert.equal(mainOnly.hasSubcategory, false);

    // C: Uncategorized
    const uncategorized = resolveTransactionCategory({
      main_category_name: null,
      subcategory_name: null,
    });
    assert.equal(uncategorized.category, "Uncategorized");
    assert.equal(uncategorized.subcategory, "—");
    assert.equal(uncategorized.hasCategory, false);
    assert.equal(uncategorized.hasSubcategory, false);

    // D: Legacy relational fields (parent_category_name & category_name)
    const legacyWithSub = resolveTransactionCategory({
      parent_category_name: "Food",
      category_name: "Tea & Snacks",
    });
    assert.equal(legacyWithSub.category, "Food");
    assert.equal(legacyWithSub.subcategory, "Tea & Snacks");

    const legacyMainOnly = resolveTransactionCategory({
      parent_category_name: null,
      category_name: "Food",
    });
    assert.equal(legacyMainOnly.category, "Food");
    assert.equal(legacyMainOnly.subcategory, "—");
  });

  await t.test("2. Integration: Record transaction with Main Category only", async () => {
    const { transaction } = await createTransaction({
      workspaceId: workspaceAId,
      type: "EXPENSE",
      amountMinor: 25000, // ₹250.00
      financialAccountId: cashAccountId,
      categoryId: foodCatId,
      mainCategoryId: foodCatId,
      notes: "Office groceries",
      userId,
    });

    assert.equal(transaction.main_category_name, "Food");
    assert.equal(transaction.subcategory_name, null);

    const display = resolveTransactionCategory(transaction);
    assert.equal(display.category, "Food");
    assert.equal(display.subcategory, "—");
  });

  await t.test("3. Integration: Record transaction with Subcategory (Food → Tea & Snacks)", async () => {
    const { transaction } = await createTransaction({
      workspaceId: workspaceAId,
      type: "EXPENSE",
      amountMinor: 12000, // ₹120.00
      financialAccountId: cashAccountId,
      mainCategoryId: foodCatId,
      subcategoryId: teaSnacksSubcatId,
      notes: "Evening samosas & tea",
      userId,
    });

    assert.equal(transaction.main_category_name, "Food");
    assert.equal(transaction.subcategory_name, "Tea & Snacks");

    const display = resolveTransactionCategory(transaction);
    assert.equal(display.category, "Food");
    assert.equal(display.subcategory, "Tea & Snacks");
    assert.equal(display.hasSubcategory, true);
  });

  await t.test("4. Integration: Record Uncategorized transaction", async () => {
    const { transaction } = await createTransaction({
      workspaceId: workspaceAId,
      type: "EXPENSE",
      amountMinor: 5000, // ₹50.00
      financialAccountId: cashAccountId,
      notes: "Cash miscellaneous expense",
      userId,
    });

    assert.equal(transaction.main_category_name, null);
    assert.equal(transaction.subcategory_name, null);

    const display = resolveTransactionCategory(transaction);
    assert.equal(display.category, "Uncategorized");
    assert.equal(display.subcategory, "—");
  });

  await t.test("5. Integration: Duplicate subcategory names under different parents", async () => {
    // Food -> Other
    const tx1 = (await createTransaction({
      workspaceId: workspaceAId,
      type: "EXPENSE",
      amountMinor: 8000,
      financialAccountId: cashAccountId,
      mainCategoryId: foodCatId,
      subcategoryId: foodOtherSubcatId,
      notes: "Other food",
      userId,
    })).transaction;

    // Utilities -> Other
    const tx2 = (await createTransaction({
      workspaceId: workspaceAId,
      type: "EXPENSE",
      amountMinor: 9500,
      financialAccountId: cashAccountId,
      mainCategoryId: utilitiesCatId,
      subcategoryId: utilsOtherSubcatId,
      notes: "Other utilities",
      userId,
    })).transaction;

    const display1 = resolveTransactionCategory(tx1);
    const display2 = resolveTransactionCategory(tx2);

    assert.equal(display1.category, "Food");
    assert.equal(display1.subcategory, "Other");

    assert.equal(display2.category, "Utilities");
    assert.equal(display2.subcategory, "Other");
  });

  await t.test("6. Integration: Reject invalid parent-child combination", async () => {
    // Attempting to pair "Food" main category with "Utilities -> Other" subcategory
    await assert.rejects(
      async () => {
        await createTransaction({
          workspaceId: workspaceAId,
          type: "EXPENSE",
          amountMinor: 10000,
          financialAccountId: cashAccountId,
          mainCategoryId: foodCatId,
          subcategoryId: utilsOtherSubcatId, // does NOT belong to Food!
          userId,
        });
      },
      /does not belong to category/
    );
  });

  await t.test("7. Integration: Cross-workspace isolation rejected", async () => {
    // Attempting to use a category from Workspace A in Workspace B
    await assert.rejects(
      async () => {
        await createTransaction({
          workspaceId: workspaceBId,
          type: "EXPENSE",
          amountMinor: 10000,
          financialAccountId: cashAccountBId,
          categoryId: foodCatId, // from Workspace A!
          userId,
        });
      },
      /does not exist in this workspace/
    );
  });

  await t.test("8. Integration: Update transaction and change category", async () => {
    const { transaction } = await createTransaction({
      workspaceId: workspaceAId,
      type: "EXPENSE",
      amountMinor: 15000,
      financialAccountId: cashAccountId,
      mainCategoryId: foodCatId,
      subcategoryId: teaSnacksSubcatId,
      notes: "Original entry",
      userId,
    });

    assert.equal(transaction.main_category_name, "Food");
    assert.equal(transaction.subcategory_name, "Tea & Snacks");

    // Update to Utilities with subcategory Other
    const updated = await updateTransaction(workspaceAId, transaction.id, {
      mainCategoryId: utilitiesCatId,
      subcategoryId: utilsOtherSubcatId,
      notes: "Updated to Utilities",
    });

    assert.equal(updated.main_category_name, "Utilities");
    assert.equal(updated.subcategory_name, "Other");
    const updatedDisplay = resolveTransactionCategory(updated);
    assert.equal(updatedDisplay.category, "Utilities");
    assert.equal(updatedDisplay.subcategory, "Other");
  });

  await t.test("9. Integration: Dashboard recent transactions & CSV Export", async () => {
    const metrics = await getDashboardMetrics(workspaceAId);
    assert.ok(metrics.recentTransactions.length > 0, "Recent transactions populated");
    
    // Check that each recent transaction resolves both category and subcategory
    for (const tx of metrics.recentTransactions) {
      const cInfo = resolveTransactionCategory(tx);
      assert.ok(typeof cInfo.category === "string" && cInfo.category.length > 0, "Category is string");
      assert.ok(typeof cInfo.subcategory === "string" && cInfo.subcategory.length > 0, "Subcategory is string");
    }

    // Check CSV export contains both "Category" and "Subcategory" headers
    const exportResult = await generateTransactionsExport(workspaceAId, "csv", { status: "POSTED" });
    const csvContent = exportResult.buffer.toString("utf8");
    const headerLine = csvContent.split("\n")[0];
    assert.ok(headerLine.includes("Category"), 'CSV export header contains Category column');
    assert.ok(headerLine.includes("Subcategory"), 'CSV export header contains Subcategory column');
  });
});
