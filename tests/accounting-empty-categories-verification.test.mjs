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

const {
  createCategory,
  listCategories,
  seedDefaultCategories,
} = await import("../src/lib/accounting/categories.ts");
const { createWorkspace, getOrCreateDefaultWorkspace } = await import("../src/lib/accounting/workspaces.ts");
const { listFinancialAccounts } = await import("../src/lib/accounting/accounts.ts");
const { createTransaction, listTransactions } = await import("../src/lib/accounting/transactions.ts");
const { executeCompleteReset, previewResetImpact } = await import("../src/lib/accounting/recovery.ts");

test("Zero Preset Categories Verification Suite", async (t) => {
  let testUserId;
  let testWsBusinessId;
  let testWsPersonalId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    assert(userRes.rows.length >= 1, "Must have at least one test user");
    testUserId = userRes.rows[0].id;
  });

  t.after(async () => {
    if (testWsBusinessId) {
      await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [testWsBusinessId]);
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [testWsBusinessId]);
      await pool.query(`DELETE FROM accounting_transactions WHERE workspace_id = $1`, [testWsBusinessId]);
      await pool.query(`DELETE FROM accounting_categories WHERE workspace_id = $1`, [testWsBusinessId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [testWsBusinessId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [testWsBusinessId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWsBusinessId]);
    }
    if (testWsPersonalId) {
      await pool.query(`DELETE FROM accounting_categories WHERE workspace_id = $1`, [testWsPersonalId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [testWsPersonalId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [testWsPersonalId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWsPersonalId]);
    }
    await pool.end();
  });

  await t.test("1. New BUSINESS accounting workspace starts with exactly 0 customer categories", async () => {
    const ws = await createWorkspace(testUserId, {
      name: "Zero Cat Business Test",
      type: "BUSINESS",
      profileTemplate: "BUSINESS_OWNER",
    });
    testWsBusinessId = ws.id;

    const cats = await listCategories(testWsBusinessId);
    assert.equal(cats.length, 0, "New business workspace must have 0 categories");

    // Verify required bookkeeping accounts exist
    const accounts = await listFinancialAccounts(testWsBusinessId);
    assert(accounts.length >= 10, "Required bookkeeping accounts must be preserved");
    const codes = accounts.map((a) => a.code);
    assert(codes.includes("1010"), "Cash in Hand account 1010 must exist");
    assert(codes.includes("1020"), "Bank account 1020 must exist");
    assert(codes.includes("4000"), "Sales Revenue account 4000 must exist");
    assert(codes.includes("5000"), "Operating Expenses account 5000 must exist");
  });

  await t.test("2. New PERSONAL accounting workspace starts with exactly 0 customer categories", async () => {
    const ws = await createWorkspace(testUserId, {
      name: "Zero Cat Personal Test",
      type: "PERSONAL",
      profileTemplate: "INDIVIDUAL",
    });
    testWsPersonalId = ws.id;

    const cats = await listCategories(testWsPersonalId);
    assert.equal(cats.length, 0, "New personal workspace must have 0 categories");

    const accounts = await listFinancialAccounts(testWsPersonalId);
    assert(accounts.length >= 10, "Required bookkeeping accounts must exist for personal workspace");
  });

  await t.test("3. seedDefaultCategories is a safe no-op that never creates presets", async () => {
    await seedDefaultCategories(testWsBusinessId, "BUSINESS_OWNER");
    await seedDefaultCategories(testWsBusinessId, "SOLOPRENEUR");
    await seedDefaultCategories(testWsBusinessId, "BOTH");

    const cats = await listCategories(testWsBusinessId);
    assert.equal(cats.length, 0, "Categories must remain 0 after calling seedDefaultCategories");
  });

  let createdMainCat;
  let createdSubCat;
  await t.test("4. Customers can create their own custom categories and subcategories", async () => {
    createdMainCat = await createCategory(testWsBusinessId, {
      name: "Custom Software Revenue",
      type: "INCOME",
    });
    assert(createdMainCat.id, "Should create category");
    assert.equal(createdMainCat.is_system, false, "Customer category must have is_system = false");
    assert.equal(createdMainCat.name, "Custom Software Revenue");

    createdSubCat = await createCategory(testWsBusinessId, {
      name: "Mobile App Licenses",
      type: "INCOME",
      parentId: createdMainCat.id,
    });
    assert(createdSubCat.id, "Should create subcategory");
    assert.equal(createdSubCat.parent_id, createdMainCat.id);
    assert.equal(createdSubCat.is_system, false);

    const cats = await listCategories(testWsBusinessId);
    assert.equal(cats.length, 2, "Should have 2 categories (1 parent + 1 sub)");
  });

  await t.test("5. Accounting Reset clears customer categories back to 0 without recreating presets", async () => {
    // Post a test transaction first
    const accounts = await listFinancialAccounts(testWsBusinessId);
    const cashAcc = accounts.find((a) => a.code === "1010");

    await createTransaction({
      workspaceId: testWsBusinessId,
      type: "INCOME",
      amountMinor: 250000,
      date: "2026-10-27",
      financialAccountId: cashAcc.id,
      categoryId: createdSubCat.id,
      notes: "License sale test",
    });

    const txsBefore = await listTransactions(testWsBusinessId);
    assert.equal(txsBefore.transactions.length, 1);

    // Execute complete reset
    const resetResult = await executeCompleteReset(testWsBusinessId, testUserId, "Test wipe categories");
    assert(resetResult.recoveryVersionId, "Should create recovery version");

    // Categories must now be 0
    const catsAfter = await listCategories(testWsBusinessId);
    assert.equal(catsAfter.length, 0, "Categories must be 0 after accounting reset");

    // Bookkeeping accounts must still exist with 0 balances
    const accountsAfter = await listFinancialAccounts(testWsBusinessId);
    assert(accountsAfter.length >= 10, "Double-entry accounts must be re-initialized");
    for (const acc of accountsAfter) {
      assert.equal(Number(acc.current_balance_minor), 0, `Account ${acc.code} balance must be 0`);
    }
  });

  await t.test("6. Existing workspaces: historical used categories are strictly preserved", async () => {
    // Verify Hafiz Rahman pk's Finances workspace historical used categories
    const res = await pool.query(
      `SELECT c.id, c.name, c.is_archived,
         (SELECT count(*) FROM accounting_transactions t WHERE t.category_id = c.id) as txs
       FROM accounting_categories c
       WHERE c.id IN ('a02de254-9ef8-438c-b93e-31ea5d8fb1e2', '50d96511-8dff-48d4-a6de-59a2e1fe1dde')`
    );
    assert.equal(res.rows.length, 2, "Both historical categories must exist in DB");
    for (const row of res.rows) {
      assert.equal(row.is_archived, false, `Category ${row.name} must NOT be archived because it has historical transactions`);
      assert(Number(row.txs) > 0, `Category ${row.name} must have historical transactions`);
    }
  });
});
