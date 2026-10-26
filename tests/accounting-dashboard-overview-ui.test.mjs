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

test("Accounting Dashboard Overview & Period Aggregation Test Suite", async (t) => {
  let userId;
  let workspaceId;
  let emptyWorkspaceId;
  let bankAccId, cashAccId, arAccId, apAccId, revAccId, expAccId;

  const { pool: corePool } = await import("../src/lib/db/core.ts");
  const { getDashboardMetrics } = await import("../src/lib/accounting/reports.ts");

  t.before(async () => {
    // Create test user
    const uRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('overview_test_${Date.now()}@example.com', 'Overview Test User', 'USER')
       RETURNING id`
    );
    userId = uRes.rows[0].id;

    // Create empty workspace
    const emptyWs = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Empty Overview Workspace', 'BUSINESS', $1)
       RETURNING id`,
      [userId]
    );
    emptyWorkspaceId = emptyWs.rows[0].id;

    // Create active workspace
    const ws = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Active Overview Workspace', 'BUSINESS', $1)
       RETURNING id`,
      [userId]
    );
    workspaceId = ws.rows[0].id;

    // Seed accounts
    const bank = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '1020', 'Bank Account', 'ASSET', 'BANK', true, 500000)
       RETURNING id`,
      [workspaceId]
    );
    bankAccId = bank.rows[0].id;

    const cash = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '1010', 'Cash in Hand', 'ASSET', 'CASH', true, 200000)
       RETURNING id`,
      [workspaceId]
    );
    cashAccId = cash.rows[0].id;

    const ar = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '1200', 'Accounts Receivable', 'ASSET', 'RECEIVABLE', true, 300000)
       RETURNING id`,
      [workspaceId]
    );
    arAccId = ar.rows[0].id;

    const ap = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '2000', 'Accounts Payable', 'LIABILITY', 'PAYABLE', true, 150000)
       RETURNING id`,
      [workspaceId]
    );
    apAccId = ap.rows[0].id;

    const rev = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '4000', 'Sales Revenue', 'REVENUE', 'REVENUE', true, 800000)
       RETURNING id`,
      [workspaceId]
    );
    revAccId = rev.rows[0].id;

    const exp = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '5000', 'Office Supplies', 'EXPENSE', 'EXPENSE', true, 100000)
       RETURNING id`,
      [workspaceId]
    );
    expAccId = exp.rows[0].id;

    // Seed cash flow transactions:
    // Today: cash in 50,000 minor (debit bank, credit rev)
    const jeToday = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, source_type, description, status)
       VALUES ($1, 'JE-OVERVIEW-01', CURRENT_DATE, 'SALE', 'SALE', 'Today sale cash', 'POSTED')
       RETURNING id`,
      [workspaceId]
    );
    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor)
       VALUES ($1, $2, 50000, 0), ($1, $3, 0, 50000)`,
      [jeToday.rows[0].id, bankAccId, revAccId]
    );

    // 3 days ago: cash out 20,000 minor (debit exp, credit cash)
    const jePast = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, source_type, description, status)
       VALUES ($1, 'JE-OVERVIEW-02', CURRENT_DATE - 3, 'EXPENSE', 'EXPENSE', 'Supplies cash payment', 'POSTED')
       RETURNING id`,
      [workspaceId]
    );
    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor)
       VALUES ($1, $2, 20000, 0), ($1, $3, 0, 20000)`,
      [jePast.rows[0].id, expAccId, cashAccId]
    );
  });

  t.after(async () => {
    await pool.end();
    await corePool.end();
  });

  await t.test("1. Available Liquid Balance sums active Cash, Bank & UPI accounts", async () => {
    const metrics = await getDashboardMetrics(workspaceId, { period: "month" });
    // Bank (500k) + Cash (200k) = 700k
    assert.equal(metrics.availableBalanceMinor, 700000, "Available liquid balance must be ₹7,000 (700,000 minor)");
    assert.equal(metrics.owedToMeMinor, 300000, "Receivables 1200 must be ₹3,000");
    assert.equal(metrics.iOweMinor, 150000, "Payables 2000 must be ₹1,500");
  });

  await t.test("2. Period 'today' aggregates exactly 1 bucket matching period cash totals", async () => {
    const metrics = await getDashboardMetrics(workspaceId, { period: "today" });
    assert.equal(metrics.moneyReceivedMinor, 50000, "Today cash in must be ₹500");
    assert.equal(metrics.moneyPaidMinor, 0, "Today cash out must be 0");

    assert.ok(metrics.cashFlowTrend, "cashFlowTrend must be defined");
    assert.equal(metrics.cashFlowTrend.length, 1, "Must have exactly 1 bucket for 'today'");
    assert.equal(metrics.cashFlowTrend[0].label, "Today");
    assert.equal(metrics.cashFlowTrend[0].inflow_minor, 50000);
    assert.equal(metrics.cashFlowTrend[0].outflow_minor, 0);
    assert.equal(metrics.cashFlowTrend[0].net_minor, 50000);
  });

  await t.test("3. Period 'week' aggregates 7 daily buckets whose totals match moneyReceived & moneyPaid", async () => {
    const metrics = await getDashboardMetrics(workspaceId, { period: "week" });
    assert.equal(metrics.moneyReceivedMinor, 50000, "Week cash in must be ₹500");
    assert.equal(metrics.moneyPaidMinor, 20000, "Week cash out must be ₹200");

    assert.ok(metrics.cashFlowTrend, "cashFlowTrend must be defined");
    assert.equal(metrics.cashFlowTrend.length, 8, "Must cover 7-8 daily buckets for the week window");

    const totalBucketIn = metrics.cashFlowTrend.reduce((sum, b) => sum + b.inflow_minor, 0);
    const totalBucketOut = metrics.cashFlowTrend.reduce((sum, b) => sum + b.outflow_minor, 0);

    assert.equal(totalBucketIn, metrics.moneyReceivedMinor, "Sum of daily bucket inflows must equal moneyReceivedMinor");
    assert.equal(totalBucketOut, metrics.moneyPaidMinor, "Sum of daily bucket outflows must equal moneyPaidMinor");
  });

  await t.test("4. Period 'month' daily buckets reconcile with monthly totals and omit future periods", async () => {
    const metrics = await getDashboardMetrics(workspaceId, { period: "month" });
    assert.ok(metrics.cashFlowTrend, "cashFlowTrend must be defined");
    const now = new Date();
    const currentMaxDay = now.getUTCDate();
    assert.equal(metrics.cashFlowTrend.length, currentMaxDay, "Must have daily buckets through current day of month");

    const totalBucketIn = metrics.cashFlowTrend.reduce((sum, b) => sum + b.inflow_minor, 0);
    const totalBucketOut = metrics.cashFlowTrend.reduce((sum, b) => sum + b.outflow_minor, 0);

    assert.equal(totalBucketIn, metrics.moneyReceivedMinor, "Daily bucket inflows must reconcile with moneyReceivedMinor");
    assert.equal(totalBucketOut, metrics.moneyPaidMinor, "Daily bucket outflows must reconcile with moneyPaidMinor");

    // Check that every bucket has non-empty label
    for (const b of metrics.cashFlowTrend) {
      assert.ok(b.label, "Day number label must be present");
    }
  });

  await t.test("5. Empty workspace returns genuine zeroes across all cards and buckets", async () => {
    const metrics = await getDashboardMetrics(emptyWorkspaceId, { period: "month" });
    assert.equal(metrics.availableBalanceMinor, 0);
    assert.equal(metrics.moneyReceivedMinor, 0);
    assert.equal(metrics.moneyPaidMinor, 0);
    assert.equal(metrics.owedToMeMinor, 0);
    assert.equal(metrics.iOweMinor, 0);
    assert.equal(metrics.earnedRevenueMinor, 0);
    assert.equal(metrics.incurredExpenseMinor, 0);
    assert.equal(metrics.netSurplusMinor, 0);

    for (const b of metrics.cashFlowTrend || []) {
      assert.equal(b.inflow_minor, 0);
      assert.equal(b.outflow_minor, 0);
      assert.equal(b.net_minor, 0);
    }
  });
});
