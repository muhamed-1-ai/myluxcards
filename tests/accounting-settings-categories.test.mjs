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

// Dynamic imports after server-only bypass in test runner
const {
  createCategory,
  updateCategory,
  listCategories,
  archiveCategory,
  restoreCategory,
} = await import("../src/lib/accounting/categories.ts");
const { createContact, listContacts } = await import("../src/lib/accounting/contacts.ts");
const { seedDefaultChartOfAccounts, listFinancialAccounts } = await import("../src/lib/accounting/accounts.ts");
const { createTransaction, updateTransaction, listTransactions } = await import("../src/lib/accounting/transactions.ts");
const { createBudget, listBudgets } = await import("../src/lib/accounting/budgets.ts");
const { getDashboardMetrics } = await import("../src/lib/accounting/reports.ts");

test("Accounting Settings: Categories & Subcategories End-to-End Verification", async (t) => {
  let userAId, userBId, wsAId, wsBId;
  const createdCatIds = [];
  const createdContactIds = [];
  const createdTxIds = [];
  const createdJeIds = [];
  const createdBudgetIds = [];
  let testAccountId;

  t.before(async () => {
    // Obtain test users
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Must have at least two users for isolation tests");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // Create unique Workspace A for User A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Category Test WS A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsAId, userAId]
    );

    // Create unique Workspace B for User B
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Category Test WS B', 'PERSONAL', 'INDIVIDUAL') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsBId, userBId]
    );
    // Seed chart of accounts for Workspace A
    await seedDefaultChartOfAccounts(wsAId);
    const accounts = await listFinancialAccounts(wsAId);
    const cashAcc = accounts.find((a) => a.code === "1010") || accounts[0];
    testAccountId = cashAcc.id;
  });

  t.after(async () => {
    // Cleanup transactions, journals, budgets in strict dependency order
    if (createdTxIds.length > 0) {
      await pool.query(`DELETE FROM accounting_transactions WHERE id = ANY($1::uuid[])`, [createdTxIds]);
    }
    if (createdJeIds.length > 0) {
      await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id = ANY($1::uuid[])`, [createdJeIds]);
      await pool.query(`DELETE FROM accounting_journal_entries WHERE id = ANY($1::uuid[])`, [createdJeIds]);
    }
    if (createdBudgetIds.length > 0) {
      await pool.query(`DELETE FROM accounting_budgets WHERE id = ANY($1::uuid[])`, [createdBudgetIds]);
    }
    // Cleanup created test categories, contacts and workspaces
    if (createdCatIds.length > 0) {
      await pool.query(`DELETE FROM accounting_categories WHERE id = ANY($1::uuid[])`, [createdCatIds]);
    }
    if (createdContactIds.length > 0) {
      await pool.query(`DELETE FROM accounting_contacts WHERE id = ANY($1::uuid[])`, [createdContactIds]);
    }
    if (wsAId) {
      await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [wsAId]);
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]);
    }
    if (wsBId) {
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]);
    }
    await pool.end();
    const { pool: sharedPool } = await import("../src/lib/db/index.ts");
    await sharedPool.end();
  });

  await t.test("1. Create top-level root categories without parent (both INCOME and EXPENSE)", async () => {
    const expenseCat = await createCategory(wsAId, {
      name: "Food & Groceries",
      type: "EXPENSE",
    });
    assert.ok(expenseCat.id);
    createdCatIds.push(expenseCat.id);
    assert.equal(expenseCat.name, "Food & Groceries");
    assert.equal(expenseCat.type, "EXPENSE");
    assert.equal(expenseCat.parent_id, null, "Root category parent_id must be null");
    assert.equal(expenseCat.is_archived, false);
    assert.equal(expenseCat.workspace_id, wsAId);

    const incomeCat = await createCategory(wsAId, {
      name: "Consulting Retainers",
      type: "INCOME",
    });
    assert.ok(incomeCat.id);
    createdCatIds.push(incomeCat.id);
    assert.equal(incomeCat.name, "Consulting Retainers");
    assert.equal(incomeCat.type, "INCOME");
    assert.equal(incomeCat.parent_id, null);
  });

  await t.test("2. Create valid subcategory under existing parent category", async () => {
    const parent = createdCatIds[0]; // "Food & Groceries"
    const subCat = await createCategory(wsAId, {
      name: "Organic Produce",
      type: "EXPENSE",
      parentId: parent,
    });
    assert.ok(subCat.id);
    createdCatIds.push(subCat.id);
    assert.equal(subCat.name, "Organic Produce");
    assert.equal(subCat.type, "EXPENSE");
    assert.equal(subCat.parent_id, parent, "Subcategory must store parent_id");
  });

  await t.test("3. Reject invalid category names or types", async () => {
    await assert.rejects(
      async () => {
        await createCategory(wsAId, {
          name: " ",
          type: "EXPENSE",
        });
      },
      /Category name is required/
    );

    await assert.rejects(
      async () => {
        await createCategory(wsAId, {
          name: "Invalid Type Cat",
          type: "LIABILITY",
        });
      },
      /Invalid category type/
    );
  });

  await t.test("4. Reject invalid parent category (cross-type or cross-workspace)", async () => {
    const incomeParent = createdCatIds[1]; // "Consulting Retainers" (INCOME)

    // Cannot make an EXPENSE category a child of an INCOME category
    await assert.rejects(
      async () => {
        await createCategory(wsAId, {
          name: "Invalid Child Type",
          type: "EXPENSE",
          parentId: incomeParent,
        });
      },
      /does not match child category type/
    );

    // Cannot use a parent from a different workspace
    const foreignCatRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type)
       VALUES ($1, 'Workspace B Root Cat', 'ws-b-cat', 'EXPENSE') RETURNING id`,
      [wsBId]
    );
    const foreignCatId = foreignCatRes.rows[0].id;
    createdCatIds.push(foreignCatId);

    await assert.rejects(
      async () => {
        await createCategory(wsAId, {
          name: "Cross Workspace Child",
          type: "EXPENSE",
          parentId: foreignCatId,
        });
      },
      /Parent category not found in this workspace/
    );
  });

  await t.test("5. Idempotent double-submit guard prevents duplicate records", async () => {
    const catA = await createCategory(wsAId, {
      name: "Double Submit Category",
      type: "EXPENSE",
    });
    createdCatIds.push(catA.id);

    // Immediate second submit returns the same category record
    const catB = await createCategory(wsAId, {
      name: "Double Submit Category",
      type: "EXPENSE",
    });
    assert.equal(catA.id, catB.id, "Second immediate submission must return existing category ID");
  });

  await t.test("6. Duplicate name check rejects duplicates with readable error", async () => {
    // Backdate the first category beyond the 10-second double-submit window
    await pool.query(
      `UPDATE accounting_categories SET created_at = NOW() - INTERVAL '30 seconds' WHERE id = $1`,
      [createdCatIds[0]]
    );

    await assert.rejects(
      async () => {
        await createCategory(wsAId, {
          name: "food & groceries",
          type: "EXPENSE",
        });
      },
      /already exists/
    );
  });

  await t.test("7. Archive and restore categories correctly updates is_archived", async () => {
    const catToArchive = createdCatIds[0];

    const archived = await archiveCategory(wsAId, catToArchive);
    assert.equal(archived.is_archived, true);

    const listWithoutArchived = await listCategories(wsAId, { includeArchived: false });
    assert.equal(
      listWithoutArchived.some((c) => c.id === catToArchive),
      false,
      "Archived category must not appear when includeArchived is false"
    );

    const listWithArchived = await listCategories(wsAId, { includeArchived: true });
    assert.equal(
      listWithArchived.some((c) => c.id === catToArchive && c.is_archived === true),
      true,
      "Archived category must appear when includeArchived is true"
    );

    const restored = await restoreCategory(wsAId, catToArchive);
    assert.equal(restored.is_archived, false);
  });

  await t.test("8. Workspace isolation: Workspace A categories never appear in Workspace B", async () => {
    const wsBCats = await listCategories(wsBId, { includeArchived: true });
    const leaked = wsBCats.find((c) => c.name === "Food & Groceries");
    assert.equal(leaked, undefined, "Workspace A category must NOT leak to Workspace B");
  });

  await t.test("9. Workspace RBAC: VIEWER cannot create categories, non-member is rejected", async () => {
    const { getAuthorizedWorkspace } = await import("../src/lib/accounting/workspaces.ts");

    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'VIEWER', '{}')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'VIEWER'`,
      [wsAId, userBId]
    );

    // VIEWER requesting MANAGER role access must return null (denied)
    const viewerAttempt = await getAuthorizedWorkspace(userBId, wsAId, "MANAGER");
    assert.equal(viewerAttempt, null, "VIEWER member must not be authorized for MANAGER actions (createCategory)");

    // VIEWER requesting VIEWER role access must succeed
    const viewerReadAttempt = await getAuthorizedWorkspace(userBId, wsAId, "VIEWER");
    assert.ok(viewerReadAttempt, "VIEWER member must be authorized to read categories");
  });

  await t.test("10. People regression test: Add Person / Contact works with blank phone and email", async () => {
    const contact = await createContact({
      workspaceId: wsAId,
      name: "Verified Person No Details",
      type: "PERSONAL",
      phone: "",
      email: "   ",
    });
    assert.ok(contact.id);
    createdContactIds.push(contact.id);
    assert.equal(contact.phone, null);
    assert.equal(contact.email, null);

    const contacts = await listContacts(wsAId, {});
    const found = contacts.find((c) => c.id === contact.id);
    assert.ok(found, "Newly created person must appear in list");
    assert.equal(Number(found.total_receivable_minor), 0);
    assert.equal(Number(found.total_payable_minor), 0);
  });

  await t.test("11. Duplicate subcategory name within same parent is rejected, but allowed under different parents", async () => {
    // Parent 1: Utilities Hierarchy
    const parent1 = await createCategory(wsAId, { name: "Utilities Hierarchy", type: "EXPENSE" });
    createdCatIds.push(parent1.id);

    // Subcategory: Phone Bill
    const sub1 = await createCategory(wsAId, { name: "Phone Bill", type: "EXPENSE", parentId: parent1.id });
    createdCatIds.push(sub1.id);
    assert.equal(sub1.parent_id, parent1.id);

    // Duplicate check within parent 1 (case & whitespace normalized): "  phone bill  "
    await pool.query(`UPDATE accounting_categories SET created_at = NOW() - INTERVAL '30 seconds' WHERE id = $1`, [sub1.id]);
    await assert.rejects(
      async () => {
        await createCategory(wsAId, { name: "  phone bill  ", type: "EXPENSE", parentId: parent1.id });
      },
      /already exists/
    );

    // Parent 2: Office Expenses
    const parent2 = await createCategory(wsAId, { name: "Office Expenses", type: "EXPENSE" });
    createdCatIds.push(parent2.id);

    // SAME subcategory name "Phone Bill" under parent 2 MUST SUCCEED!
    const sub2 = await createCategory(wsAId, { name: "Phone Bill", type: "EXPENSE", parentId: parent2.id });
    assert.ok(sub2.id);
    createdCatIds.push(sub2.id);
    assert.equal(sub2.parent_id, parent2.id);
    assert.equal(sub2.name, "Phone Bill");
  });

  await t.test("12. Reject 3rd level nesting (cannot create subcategory under a subcategory)", async () => {
    const subCat = createdCatIds[createdCatIds.length - 1]; // sub2
    await assert.rejects(
      async () => {
        await createCategory(wsAId, {
          name: "Deep 3rd Level Child",
          type: "EXPENSE",
          parentId: subCat,
        });
      },
      /Subcategories cannot have child categories/
    );
  });

  await t.test("13. Rejection of self-parenting and circular hierarchy", async () => {
    const parentCat = createdCatIds[createdCatIds.length - 2];
    await assert.rejects(
      async () => {
        await updateCategory(wsAId, parentCat, { parentId: parentCat });
      },
      /A category cannot be its own parent/
    );
  });

  await t.test("14. Parent archiving hides children from active list, preserving child individual archive state", async () => {
    const mainP = await createCategory(wsAId, { name: "Vehicle Fleet", type: "EXPENSE" });
    createdCatIds.push(mainP.id);
    const childA = await createCategory(wsAId, { name: "Petrol Fleet", type: "EXPENSE", parentId: mainP.id });
    createdCatIds.push(childA.id);
    const childB = await createCategory(wsAId, { name: "Maintenance Fleet", type: "EXPENSE", parentId: mainP.id });
    createdCatIds.push(childB.id);

    // Separately archive childB
    await archiveCategory(wsAId, childB.id);

    // Active categories: should contain mainP, childA (but NOT childB)
    let activeCats = await listCategories(wsAId, { includeArchived: false });
    assert.ok(activeCats.some((c) => c.id === mainP.id));
    assert.ok(activeCats.some((c) => c.id === childA.id));
    assert.ok(!activeCats.some((c) => c.id === childB.id));

    // Now archive the parent mainP
    await archiveCategory(wsAId, mainP.id);

    // Active categories: neither mainP NOR childA should appear now!
    activeCats = await listCategories(wsAId, { includeArchived: false });
    assert.ok(!activeCats.some((c) => c.id === mainP.id));
    assert.ok(!activeCats.some((c) => c.id === childA.id), "Child A must not appear when parent is archived");
    assert.ok(!activeCats.some((c) => c.id === childB.id));

    // Now restore parent mainP
    await restoreCategory(wsAId, mainP.id);

    // Active categories: mainP and childA should reappear, but childB should REMAIN archived!
    activeCats = await listCategories(wsAId, { includeArchived: false });
    assert.ok(activeCats.some((c) => c.id === mainP.id));
    assert.ok(activeCats.some((c) => c.id === childA.id));
    assert.ok(!activeCats.some((c) => c.id === childB.id), "Separately archived child B must remain archived when parent restored");
  });

  await t.test("15. Subcategory restore rejected if parent is currently archived", async () => {
    const parentX = await createCategory(wsAId, { name: "Archived Parent Test", type: "EXPENSE" });
    createdCatIds.push(parentX.id);
    const childX = await createCategory(wsAId, { name: "Archived Child Test", type: "EXPENSE", parentId: parentX.id });
    createdCatIds.push(childX.id);

    await archiveCategory(wsAId, childX.id);
    await archiveCategory(wsAId, parentX.id);

    await assert.rejects(
      async () => {
        await restoreCategory(wsAId, childX.id);
      },
      /Please restore the parent category first/
    );

    // Restore parent first
    await restoreCategory(wsAId, parentX.id);
    // Now child restore succeeds
    const restoredChild = await restoreCategory(wsAId, childX.id);
    assert.equal(restoredChild.is_archived, false);
  });

  await t.test("16. Transaction recording under main category vs subcategory and reports rollup", async () => {
    const rollParent = await createCategory(wsAId, { name: "Travel & Commute", type: "EXPENSE" });
    createdCatIds.push(rollParent.id);
    const rollChild = await createCategory(wsAId, { name: "Fuel & Gas", type: "EXPENSE", parentId: rollParent.id });
    createdCatIds.push(rollChild.id);

    // 1. Transaction recorded directly under main category (₹100)
    const { transaction: tx1 } = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 10000,
      financialAccountId: testAccountId,
      categoryId: rollParent.id,
      paymentStatus: "PAID",
      date: "2026-10-15",
      notes: "Direct main category expense",
    });
    createdTxIds.push(tx1.id);
    if (tx1.journal_entry_id) createdJeIds.push(tx1.journal_entry_id);

    // 2. Transaction recorded under subcategory (₹250)
    const { transaction: tx2 } = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 25000,
      financialAccountId: testAccountId,
      categoryId: rollChild.id,
      paymentStatus: "PAID",
      date: "2026-10-16",
      notes: "Subcategory child expense",
    });
    createdTxIds.push(tx2.id);
    if (tx2.journal_entry_id) createdJeIds.push(tx2.journal_entry_id);

    // Query listTransactions filtered by parent category ID: must return BOTH tx1 and tx2!
    const filteredTxs = await listTransactions(wsAId, { categoryId: rollParent.id });
    assert.equal(filteredTxs.transactions.length, 2, "Filtering by parent category must return both direct and subcategory transactions");

    // Query listTransactions filtered by subcategory ID: must return only tx2!
    const subTxs = await listTransactions(wsAId, { categoryId: rollChild.id });
    assert.equal(subTxs.transactions.length, 1, "Filtering by subcategory must return only child transactions");
    assert.equal(subTxs.transactions[0].id, tx2.id);
    assert.equal(subTxs.transactions[0].parent_category_name, "Travel & Commute");

    // Check dashboard metrics rollup: Total expense for 'Travel & Commute' must be 100 + 250 = 350
    const metrics = await getDashboardMetrics(wsAId);
    const catMetric = metrics.categoryBreakdown.find((e) => e.categoryName === "Travel & Commute");
    assert.ok(catMetric, "Parent category Travel & Commute must appear in breakdown");
    assert.equal(catMetric.amountMinor, 35000, "Spending must rollup to ₹350 without double counting");

    // Reclassify tx2 using updateTransaction (change to parent)
    const updatedTx = await updateTransaction(wsAId, tx2.id, { categoryId: rollParent.id });
    assert.equal(updatedTx.category_id, rollParent.id);
  });

  await t.test("17. Parent budget spent calculation includes direct and child transactions without double counting", async () => {
    const bParent = await createCategory(wsAId, { name: "Marketing Budget Test", type: "EXPENSE" });
    createdCatIds.push(bParent.id);
    const bChild = await createCategory(wsAId, { name: "Social Media Ads", type: "EXPENSE", parentId: bParent.id });
    createdCatIds.push(bChild.id);

    // Direct transaction: ₹500
    const { transaction: txA } = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 50000,
      financialAccountId: testAccountId,
      categoryId: bParent.id,
      paymentStatus: "PAID",
      date: "2026-10-05",
    });
    createdTxIds.push(txA.id);
    if (txA.journal_entry_id) createdJeIds.push(txA.journal_entry_id);

    // Child transaction: ₹700
    const { transaction: txB } = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 70000,
      financialAccountId: testAccountId,
      categoryId: bChild.id,
      paymentStatus: "PAID",
      date: "2026-10-10",
    });
    createdTxIds.push(txB.id);
    if (txB.journal_entry_id) createdJeIds.push(txB.journal_entry_id);

    // Create budget on parent category with limit ₹2000
    const budget = await createBudget({
      workspaceId: wsAId,
      categoryId: bParent.id,
      amountMinor: 200000,
      month: "2026-10",
      periodType: "MONTHLY",
    });
    createdBudgetIds.push(budget.id);

    // Check spent calculation in listBudgets
    const budgets = await listBudgets(wsAId);
    const foundBudget = budgets.find((b) => b.id === budget.id);
    assert.ok(foundBudget);
    assert.equal(foundBudget.spent_minor, 120000, "Parent budget spent must equal direct (₹500) + child (₹700) = ₹1200");
    assert.equal(foundBudget.remaining_minor, 80000, "Remaining must be ₹2000 - ₹1200 = ₹800");
  });
});
