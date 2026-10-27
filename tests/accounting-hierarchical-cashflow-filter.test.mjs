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
    paths: []
  };
} catch (_) {}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

test("Hierarchical Category Filtering for Zappit Cash Flow Suite", async (t) => {
  let userAId, userBId;
  let wsAId, wsBId;
  let cashAccId, bankAccId, revAccId, expAccId;
  let catTravelId, catFuelId, catTicketsId, catSalesId, catOfficeId;
  let catWsBId;

  const { pool: corePool } = await import("../src/lib/db/core.ts");
  const { getDashboardMetrics } = await import("../src/lib/accounting/reports.ts");

  t.before(async () => {
    // 1. Create Users
    const uA = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('cf_filter_test_a_${Date.now()}@example.com', 'User A', 'USER')
       RETURNING id`
    );
    userAId = uA.rows[0].id;

    const uB = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('cf_filter_test_b_${Date.now()}@example.com', 'User B', 'USER')
       RETURNING id`
    );
    userBId = uB.rows[0].id;

    // 2. Create Workspace A & B
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id, currency)
       VALUES ('Workspace A Filter Test', 'BUSINESS', $1, 'INR')
       RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [wsAId, userAId]
    );

    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id, currency)
       VALUES ('Workspace B Filter Test', 'BUSINESS', $1, 'INR')
       RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [wsBId, userBId]
    );

    // 3. Financial Accounts in Workspace A
    const cashRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '1010', 'Cash on Hand', 'ASSET', 'CASH', true, 500000)
       RETURNING id`,
      [wsAId]
    );
    cashAccId = cashRes.rows[0].id;

    const bankRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '1020', 'Business Bank Account', 'ASSET', 'BANK', true, 1000000)
       RETURNING id`,
      [wsAId]
    );
    bankAccId = bankRes.rows[0].id;

    const revRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '4000', 'Sales Revenue', 'REVENUE', 'REVENUE', true, 0)
       RETURNING id`,
      [wsAId]
    );
    revAccId = revRes.rows[0].id;

    const expRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '5000', 'Operating Expenses', 'EXPENSE', 'EXPENSE', true, 0)
       RETURNING id`,
      [wsAId]
    );
    expAccId = expRes.rows[0].id;

    // 4. Categories in Workspace A
    // Main category Travel (EXPENSE)
    const travelRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, sort_order)
       VALUES ($1, 'Travel', 'travel', 'EXPENSE', 1)
       RETURNING id`,
      [wsAId]
    );
    catTravelId = travelRes.rows[0].id;

    // Subcategory Fuel under Travel
    const fuelRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, parent_id, name, slug, type, sort_order)
       VALUES ($1, $2, 'Fuel', 'fuel', 'EXPENSE', 1)
       RETURNING id`,
      [wsAId, catTravelId]
    );
    catFuelId = fuelRes.rows[0].id;

    // Subcategory Tickets under Travel
    const ticketsRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, parent_id, name, slug, type, sort_order)
       VALUES ($1, $2, 'Tickets', 'tickets', 'EXPENSE', 2)
       RETURNING id`,
      [wsAId, catTravelId]
    );
    catTicketsId = ticketsRes.rows[0].id;

    // Main category Sales Revenue (INCOME, no children)
    const salesRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, sort_order)
       VALUES ($1, 'Sales Revenue', 'sales-revenue', 'INCOME', 1)
       RETURNING id`,
      [wsAId]
    );
    catSalesId = salesRes.rows[0].id;

    // Main category Office & Utilities (EXPENSE, no children, no transactions)
    const officeRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, sort_order)
       VALUES ($1, 'Office & Utilities', 'office-utilities', 'EXPENSE', 3)
       RETURNING id`,
      [wsAId]
    );
    catOfficeId = officeRes.rows[0].id;

    // Category in Workspace B
    const wsBCatRes = await pool.query(
      `INSERT INTO accounting_categories (workspace_id, name, slug, type, sort_order)
       VALUES ($1, 'Foreign Category', 'foreign-cat', 'EXPENSE', 1)
       RETURNING id`,
      [wsBId]
    );
    catWsBId = wsBCatRes.rows[0].id;

    // Helper to insert posted transaction + journal entry + journal lines
    async function insertTx({ dateOffsetDays, type, categoryId, amountMinor, isDebitCash }) {
      const jeRes = await pool.query(
        `INSERT INTO accounting_journal_entries
           (workspace_id, entry_number, entry_date, entry_type, description, source_type, status)
         VALUES ($1, 'JE-' || gen_random_uuid(), CURRENT_DATE - ${dateOffsetDays}, 'TRANSACTION', 'Test Entry', 'TRANSACTION', 'POSTED')
         RETURNING id, entry_date`,
        [wsAId]
      );
      const jeId = jeRes.rows[0].id;
      const entryDate = jeRes.rows[0].entry_date;

      if (isDebitCash) {
        // Money in (Debit Bank, Credit Revenue)
        await pool.query(
          `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor)
           VALUES ($1, $2, $3, 0), ($1, $4, 0, $3)`,
          [jeId, bankAccId, amountMinor, revAccId]
        );
      } else {
        // Money out (Debit Expense, Credit Bank)
        await pool.query(
          `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor)
           VALUES ($1, $2, $3, 0), ($1, $4, 0, $3)`,
          [jeId, expAccId, amountMinor, bankAccId]
        );
      }

      await pool.query(
        `INSERT INTO accounting_transactions
           (workspace_id, journal_entry_id, type, category_id, financial_account_id, amount_minor, date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'POSTED')`,
        [wsAId, jeId, type, categoryId, bankAccId, amountMinor, entryDate]
      );
    }

    // 1. Direct Travel: 5,000 minor (Day -3)
    await insertTx({ dateOffsetDays: 3, type: "EXPENSE", categoryId: catTravelId, amountMinor: 5000, isDebitCash: false });

    // 2. Fuel (sub of Travel): 3,000 minor (Day -2)
    await insertTx({ dateOffsetDays: 2, type: "EXPENSE", categoryId: catFuelId, amountMinor: 3000, isDebitCash: false });

    // 3. Tickets (sub of Travel): 2,000 minor (Day -1)
    await insertTx({ dateOffsetDays: 1, type: "EXPENSE", categoryId: catTicketsId, amountMinor: 2000, isDebitCash: false });

    // 4. Sales Revenue (INCOME): 20,000 minor (Day -2)
    await insertTx({ dateOffsetDays: 2, type: "INCOME", categoryId: catSalesId, amountMinor: 20000, isDebitCash: true });

    // 5. Uncategorized Expense: 4,000 minor (Day -1)
    await insertTx({ dateOffsetDays: 1, type: "EXPENSE", categoryId: null, amountMinor: 4000, isDebitCash: false });

    // 6. Uncategorized Income: 6,000 minor (Day -1)
    await insertTx({ dateOffsetDays: 1, type: "INCOME", categoryId: null, amountMinor: 6000, isDebitCash: true });
  });

  t.after(async () => {
    await pool.end();
    await corePool.end();
  });

  await t.test("1. All Categories returns full unfiltered cash flow totals and preserves existing behavior", async () => {
    const metrics = await getDashboardMetrics(wsAId, { period: "month" });

    // Unfiltered totals
    // Total In: 20,000 (Sales) + 6,000 (Uncategorized) = 26,000 minor
    assert.equal(metrics.moneyReceivedMinor, 26000, "Unfiltered money received must be 26,000");
    // Total Out: 5,000 (Travel) + 3,000 (Fuel) + 2,000 (Tickets) + 4,000 (Uncategorized) = 14,000 minor
    assert.equal(metrics.moneyPaidMinor, 14000, "Unfiltered money paid must be 14,000");

    assert.equal(metrics.cashFlowInflowMinor, 26000);
    assert.equal(metrics.cashFlowOutflowMinor, 14000);
    assert.equal(metrics.cashFlowNetMinor, 12000);

    // Sum of daily trend buckets matches total
    const trendIn = (metrics.cashFlowTrend || []).reduce((sum, b) => sum + b.inflow_minor, 0);
    const trendOut = (metrics.cashFlowTrend || []).reduce((sum, b) => sum + b.outflow_minor, 0);
    assert.equal(trendIn, 26000, "Table / trend series inflow matches total inflow");
    assert.equal(trendOut, 14000, "Table / trend series outflow matches total outflow");
  });

  await t.test("2. Main Category + All Subcategories includes direct entries and children exactly once", async () => {
    const metrics = await getDashboardMetrics(wsAId, {
      period: "month",
      categoryId: catTravelId,
      subcategoryId: "all",
    });

    // Money In for Travel: 0
    assert.equal(metrics.cashFlowInflowMinor, 0, "No inflow for Travel");
    // Money Out: Direct Travel (5,000) + Fuel (3,000) + Tickets (2,000) = 10,000
    assert.equal(metrics.cashFlowOutflowMinor, 10000, "Total outflow for Travel + all subcategories is exactly 10,000");
    // Net flow: 0 - 10,000 = -10,000
    assert.equal(metrics.cashFlowNetMinor, -10000, "Negative net flow clearly reflected");

    // Unrelated metrics remain UNCHANGED
    assert.equal(metrics.moneyReceivedMinor, 26000, "Unrelated dashboard Money In remains 26,000");
    assert.equal(metrics.moneyPaidMinor, 14000, "Unrelated dashboard Money Out remains 14,000");

    // Trend series sum
    const trendOut = (metrics.cashFlowTrend || []).reduce((sum, b) => sum + b.outflow_minor, 0);
    assert.equal(trendOut, 10000, "Table and trend series agree with panel total");
    assert.equal(metrics.cashFlowFilter?.filterLabel, "Travel (All subcategories)");
  });

  await t.test("3. Main Category + Specific Subcategory excludes direct parent and sibling entries", async () => {
    const metrics = await getDashboardMetrics(wsAId, {
      period: "month",
      categoryId: catTravelId,
      subcategoryId: catFuelId,
    });

    assert.equal(metrics.cashFlowInflowMinor, 0);
    // Only Fuel (3,000) included. Direct Travel (5,000) and Tickets (2,000) excluded!
    assert.equal(metrics.cashFlowOutflowMinor, 3000, "Outflow includes only Fuel entries");
    assert.equal(metrics.cashFlowNetMinor, -3000);
    assert.equal(metrics.cashFlowFilter?.filterLabel, "Travel → Fuel");

    const trendOut = (metrics.cashFlowTrend || []).reduce((sum, b) => sum + b.outflow_minor, 0);
    assert.equal(trendOut, 3000, "Trend series sum matches exactly 3,000");
  });

  await t.test("4. Category without children and no activity returns 0 and empty trend", async () => {
    const metrics = await getDashboardMetrics(wsAId, {
      period: "month",
      categoryId: catOfficeId,
      subcategoryId: "all",
    });

    assert.equal(metrics.cashFlowInflowMinor, 0);
    assert.equal(metrics.cashFlowOutflowMinor, 0);
    assert.equal(metrics.cashFlowNetMinor, 0);

    const hasActivity = (metrics.cashFlowTrend || []).some((b) => b.inflow_minor > 0 || b.outflow_minor > 0);
    assert.equal(hasActivity, false, "Correctly signals no cash activity for this selection");
  });

  await t.test("5. Income-only category returns positive net cash flow and 0 outflow", async () => {
    const metrics = await getDashboardMetrics(wsAId, {
      period: "month",
      categoryId: catSalesId,
      subcategoryId: "all",
    });

    assert.equal(metrics.cashFlowInflowMinor, 20000);
    assert.equal(metrics.cashFlowOutflowMinor, 0);
    assert.equal(metrics.cashFlowNetMinor, 20000);

    const trendIn = (metrics.cashFlowTrend || []).reduce((sum, b) => sum + b.inflow_minor, 0);
    assert.equal(trendIn, 20000);
  });

  await t.test("6. Uncategorized selection returns uncategorized entries and excludes transfers", async () => {
    const metrics = await getDashboardMetrics(wsAId, {
      period: "month",
      categoryId: "uncategorized",
    });

    assert.equal(metrics.cashFlowInflowMinor, 6000, "Uncategorized income is 6,000");
    assert.equal(metrics.cashFlowOutflowMinor, 4000, "Uncategorized expense is 4,000");
    assert.equal(metrics.cashFlowNetMinor, 2000, "Net flow is +2,000");
    assert.equal(metrics.cashFlowFilter?.filterLabel, "Uncategorized");
  });

  await t.test("7. Combined date and category filters properly bound aggregation", async () => {
    // Filter to only 2 days ago (which should have Fuel: 3000 and Sales: 20000)
    const today = new Date();
    const dayMinus2 = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const metrics = await getDashboardMetrics(wsAId, {
      period: "custom",
      startDate: dayMinus2,
      endDate: dayMinus2,
      categoryId: catTravelId,
      subcategoryId: "all",
    });

    // On day -2, only Fuel (3,000) occurred. Direct Travel (day -3) and Tickets (day -1) are excluded!
    assert.equal(metrics.cashFlowOutflowMinor, 3000);
    assert.equal(metrics.cashFlowInflowMinor, 0);
  });

  await t.test("8. Security & validation: Rejects cross-workspace category and invalid hierarchy", async () => {
    // 8a. Category belonging to Workspace B queried against Workspace A -> 404
    await assert.rejects(
      async () => {
        await getDashboardMetrics(wsAId, { categoryId: catWsBId });
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        assert.match(err.message, /Selected category does not exist in this workspace/);
        return true;
      }
    );

    // 8b. Selected category is a subcategory, not a main category -> 400
    await assert.rejects(
      async () => {
        await getDashboardMetrics(wsAId, { categoryId: catFuelId });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Selected category is a subcategory/);
        return true;
      }
    );

    // 8c. Subcategory does not belong to main category -> 400
    await assert.rejects(
      async () => {
        await getDashboardMetrics(wsAId, { categoryId: catSalesId, subcategoryId: catFuelId });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /does not belong to category/);
        return true;
      }
    );

    // 8d. Subcategory requested with uncategorized -> 400
    await assert.rejects(
      async () => {
        await getDashboardMetrics(wsAId, { categoryId: "uncategorized", subcategoryId: catFuelId });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Subcategories are not applicable for uncategorized/);
        return true;
      }
    );

    // 8e. Subcategory requested without a main category -> 400
    await assert.rejects(
      async () => {
        await getDashboardMetrics(wsAId, { categoryId: "all", subcategoryId: catFuelId });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /A main category must be selected/);
        return true;
      }
    );
  });
});
