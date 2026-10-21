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
  createBudget,
  listBudgets,
  getBudgetDetails,
  updateBudget,
  deleteBudget,
} = await import("../src/lib/accounting/budgets.ts");

const {
  createCategory,
} = await import("../src/lib/accounting/categories.ts");

const {
  createTransaction,
  voidTransaction,
} = await import("../src/lib/accounting/transactions.ts");

const {
  seedDefaultChartOfAccounts,
  listFinancialAccounts,
} = await import("../src/lib/accounting/accounts.ts");

const {
  createLoan,
  getLoanDetails,
  recordLoanInstallmentPayment,
  listLoans,
} = await import("../src/lib/accounting/loans.ts");

test("Accounting Redesign: Budgets & Loans Flow End-to-End", async (t) => {
  let userAId, userBId, wsAId, wsBId;
  let testParentCatId, testSubCatId;
  let testCashAccountId;
  let budgetAId;
  let testLoanId;
  const createdBudgetIds = [];
  const createdCatIds = [];
  const createdTxIds = [];
  const createdLoanIds = [];

  t.before(async () => {
    // 1. Get test users
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Need at least 2 users");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // 2. Create Workspace A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Redesign Test WS A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;

    // 3. Create Workspace B
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Redesign Test WS B', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;

    // 4. Seed chart of accounts for WS A and WS B
    await seedDefaultChartOfAccounts(wsAId, pool);
    await seedDefaultChartOfAccounts(wsBId, pool);

    const accs = await listFinancialAccounts(wsAId);
    const cashAcc = accs.find((a) => a.code === "1010" || a.type === "ASSET");
    assert(cashAcc, "Cash account must exist in WS A");
    testCashAccountId = cashAcc.id;

    // 5. Create Parent Category & Subcategory in WS A
    const parentCat = await createCategory(wsAId, {
      name: "Office & Facilities",
      type: "EXPENSE",
    });
    testParentCatId = parentCat.id;
    createdCatIds.push(testParentCatId);

    const subCat = await createCategory(wsAId, {
      name: "Office Decor",
      type: "EXPENSE",
      parentId: testParentCatId,
    });
    testSubCatId = subCat.id;
    createdCatIds.push(testSubCatId);
  });

  t.after(async () => {
    // Cleanup
    for (const id of createdTxIds) {
      await pool.query(`DELETE FROM accounting_journal_entry_lines WHERE journal_entry_id IN (SELECT journal_entry_id FROM accounting_transactions WHERE id = $1)`, [id]).catch(() => {});
      await pool.query(`DELETE FROM accounting_transactions WHERE id = $1`, [id]).catch(() => {});
    }
    for (const id of createdBudgetIds) {
      await pool.query(`DELETE FROM accounting_budgets WHERE id = $1`, [id]).catch(() => {});
    }
    for (const id of createdLoanIds) {
      await pool.query(`DELETE FROM accounting_loan_installments WHERE loan_id = $1`, [id]).catch(() => {});
      await pool.query(`DELETE FROM accounting_loans WHERE id = $1`, [id]).catch(() => {});
    }
    for (const id of createdCatIds) {
      await pool.query(`DELETE FROM accounting_categories WHERE id = $1`, [id]).catch(() => {});
    }
    if (wsAId) {
      await pool.query(`DELETE FROM accounting_journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [wsAId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsAId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_transactions WHERE workspace_id = $1`, [wsAId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsAId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]).catch(() => {});
    }
    if (wsBId) {
      await pool.query(`DELETE FROM accounting_journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [wsBId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsBId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_transactions WHERE workspace_id = $1`, [wsBId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsBId]).catch(() => {});
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]).catch(() => {});
    }
    await pool.end();
  });

  await t.test("1. Create Budget with custom name, custom icon, and verify fields", async () => {
    const budget = await createBudget({
      workspaceId: wsAId,
      name: "Headquarters Decor",
      icon: "🏢",
      categoryId: testParentCatId,
      amountMinor: 500000, // ₹5,000.00
      month: "2026-10",
      periodType: "MONTHLY",
    });

    assert.equal(budget.name, "Headquarters Decor");
    assert.equal(budget.icon, "🏢");
    assert.equal(budget.amount_minor, 500000);
    assert.equal(budget.period_start, "2026-10-01");
    assert.equal(budget.period_end, "2026-10-31");
    budgetAId = budget.id;
    createdBudgetIds.push(budgetAId);
  });

  await t.test("2. List Budgets computes accurate spent_minor, remaining_minor, and transaction_count", async () => {
    const list = await listBudgets(wsAId, "2026-10");
    const item = list.find((b) => b.id === budgetAId);
    assert(item, "Created budget must be in the list");
    assert.equal(item.name, "Headquarters Decor");
    assert.equal(item.icon, "🏢");
    assert.equal(item.spent_minor, 0);
    assert.equal(item.remaining_minor, 500000);
    assert.equal(item.percent_used, 0);
    assert.equal(item.is_exceeded, false);
    assert.equal(item.transaction_count, 0);
  });

  await t.test("3. Update Budget name, icon, and limit", async () => {
    const updated = await updateBudget(wsAId, budgetAId, {
      name: "Renovated Office Decor",
      icon: "🛋️",
      amountMinor: 600000, // ₹6,000.00
    });
    assert(updated);
    assert.equal(updated.name, "Renovated Office Decor");
    assert.equal(updated.icon, "🛋️");
    assert.equal(updated.amount_minor, 600000);
  });

  await t.test("4. Add expense under subcategory and verify parent budget aggregates it exactly once", async () => {
    // Create an expense under child subcategory "Office Decor"
    const tx = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 150000, // ₹1,500.00
      date: "2026-10-15",
      categoryId: testSubCatId, // child subcategory!
      financialAccountId: testCashAccountId,
      notes: "Wall art and lighting",
      isPaid: true,
      paymentStatus: "PAID",
      userId: userAId,
    });
    createdTxIds.push(tx.transaction.id);

    // Verify budget details
    const details = await getBudgetDetails(wsAId, budgetAId);
    assert(details, "Budget details must be found");
    assert.equal(details.budget.spent_minor, 150000, "Spent minor should reflect ₹1,500");
    assert.equal(details.budget.remaining_minor, 450000, "Remaining should be ₹4,500");
    assert.equal(details.budget.percent_used, 25, "Percent used should be 25%");
    assert.equal(details.budget.transaction_count, 1);
    assert.equal(details.transactions.length, 1);
    assert.equal(details.transactions[0].notes, "Wall art and lighting");
  });

  await t.test("5. Void expense via voidTransaction and verify budget balance is restored immediately", async () => {
    const txId = createdTxIds[0];
    const voidResult = await voidTransaction(wsAId, txId, "Testing void reversal", userAId);
    assert.equal(voidResult.status, "VOIDED");

    // Check budget details again
    const details = await getBudgetDetails(wsAId, budgetAId);
    assert(details);
    assert.equal(details.budget.spent_minor, 0, "Voided expense must not count towards spent");
    assert.equal(details.budget.remaining_minor, 600000, "Remaining should be restored to full ₹6,000");
    assert.equal(details.budget.percent_used, 0);
    assert.equal(details.budget.transaction_count, 0, "Voided transaction excluded from count");
    assert.equal(details.transactions.length, 0);
  });

  await t.test("6. Overspending calculation: spend > budget limit", async () => {
    // Add large expense ₹7,000 on ₹6,000 budget
    const tx = await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      amountMinor: 700000, // ₹7,000.00
      date: "2026-10-20",
      categoryId: testParentCatId,
      financialAccountId: testCashAccountId,
      notes: "High-end ergonomic desks",
      isPaid: true,
      paymentStatus: "PAID",
      userId: userAId,
    });
    createdTxIds.push(tx.transaction.id);

    const details = await getBudgetDetails(wsAId, budgetAId);
    assert(details);
    assert.equal(details.budget.spent_minor, 700000);
    assert.equal(details.budget.remaining_minor, -100000, "Negative remaining for overspending");
    assert.equal(details.budget.is_exceeded, true);
    assert(details.budget.percent_used > 100);
  });

  await t.test("7. Loans: Create Loan Receipt with interest and tenure", async () => {
    const { loan, installments } = await createLoan({
      workspaceId: wsAId,
      loanName: "HDFC Business Loan",
      principalMinor: 1200000, // ₹12,000.00
      interestRatePercent: 12, // 12% p.a.
      tenureMonths: 12,
      disbursementAccountId: testCashAccountId,
      startDate: "2026-10-01",
      userId: userAId,
    });

    assert.equal(Number(loan.principal_minor), 1200000);
    assert.equal(Number(loan.remaining_principal_minor), 1200000);
    assert.equal(loan.status, "ACTIVE");
    assert.equal(installments.length, 12, "Should have 12 installments generated");
    testLoanId = loan.id;
    createdLoanIds.push(testLoanId);

    // Verify in listLoans
    const loansList = await listLoans(wsAId);
    const foundLoan = loansList.find((l) => l.id === testLoanId);
    assert(foundLoan);
  });

  await t.test("8. Loans: Record Installment Repayment", async () => {
    const detailsBefore = await getLoanDetails(wsAId, testLoanId);
    assert(detailsBefore);
    const firstInst = detailsBefore.installments[0];
    assert.equal(firstInst.status, "PENDING");

    // Repay first installment
    const result = await recordLoanInstallmentPayment({
      workspaceId: wsAId,
      loanId: testLoanId,
      installmentNumber: firstInst.installment_number,
      paymentDate: "2026-10-21",
      financialAccountId: testCashAccountId,
      principalMinor: firstInst.principal_minor,
      interestMinor: firstInst.interest_minor,
      userId: userAId,
    });

    assert.equal(result.installment?.status, "PAID");
    assert.equal(result.loan.current_balance_minor, 1200000 - firstInst.principal_minor);

    // Verify getLoanDetails
    const detailsAfter = await getLoanDetails(wsAId, testLoanId);
    assert(detailsAfter);
    assert.equal(detailsAfter.loan.current_balance_minor, 1200000 - firstInst.principal_minor);
    assert.equal(detailsAfter.installments[0].status, "PAID");
  });

  await t.test("9. Multi-Tenant Workspace Isolation: WS B cannot access WS A budgets or loans", async () => {
    // Attempt to get WS A budget from WS B
    const bDetails = await getBudgetDetails(wsBId, budgetAId);
    assert.equal(bDetails, null, "WS B should NOT access WS A budget");

    // Attempt to update WS A budget from WS B
    await assert.rejects(
      async () => await updateBudget(wsBId, budgetAId, { name: "Hacked" }),
      /not found or unauthorized/i
    );

    // Attempt to delete WS A budget from WS B
    const deleteRes = await deleteBudget(wsBId, budgetAId);
    assert.equal(deleteRes, false, "WS B should NOT delete WS A budget");

    // Attempt to get WS A loan from WS B
    const loanDetails = await getLoanDetails(wsBId, testLoanId);
    assert.equal(loanDetails, null, "WS B should NOT access WS A loan");
  });
});
