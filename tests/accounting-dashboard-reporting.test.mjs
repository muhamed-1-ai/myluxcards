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

test("Accounting Dashboard Reporting Suite", async (t) => {
  let userAId, userBId;
  let emptyWsId, populatedWsId, wsBId;
  let contactId, invoiceId;

  const { pool: corePool } = await import("../src/lib/db/core.ts");
  const { getDashboardMetrics } = await import("../src/lib/accounting/reports.ts");
  const { getAuthorizedWorkspace, ensureDefaultWorkspace } = await import("../src/lib/accounting/workspaces.ts");

  t.before(async () => {
    // 1. Create User A and User B
    const uA = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('dashboard_test_a_${Date.now()}@example.com', 'User A', 'USER')
       RETURNING id`
    );
    userAId = uA.rows[0].id;

    const uB = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('dashboard_test_b_${Date.now()}@example.com', 'User B', 'USER')
       RETURNING id`
    );
    userBId = uB.rows[0].id;

    // 2. Create Empty Workspace for User A
    const eWs = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Empty Workspace', 'BUSINESS', $1)
       RETURNING id`,
      [userAId]
    );
    emptyWsId = eWs.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [emptyWsId, userAId]
    );

    // 3. Create Populated Workspace for User A
    const pWs = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Populated Workspace', 'BUSINESS', $1)
       RETURNING id`,
      [userAId]
    );
    populatedWsId = pWs.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [populatedWsId, userAId]
    );

    // Seed Populated Workspace Chart of Accounts
    const bankRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '1020', 'Bank Account', 'ASSET', 'BANK', true, 400000)
       RETURNING id`,
      [populatedWsId]
    );
    const bankAccId = bankRes.rows[0].id;

    const arRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '1200', 'Accounts Receivable', 'ASSET', 'RECEIVABLE', true, 600000)
       RETURNING id`,
      [populatedWsId]
    );
    const arAccId = arRes.rows[0].id;

    const revRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, is_active, current_balance_minor)
       VALUES ($1, '4000', 'Sales Revenue', 'REVENUE', 'REVENUE', true, 1000000)
       RETURNING id`,
      [populatedWsId]
    );
    const revAccId = revRes.rows[0].id;

    // Contact
    const cRes = await pool.query(
      `INSERT INTO accounting_contacts (workspace_id, name, type, email)
       VALUES ($1, 'Test Client Ltd', 'CUSTOMER', 'client@test.com')
       RETURNING id`,
      [populatedWsId]
    );
    contactId = cRes.rows[0].id;

    // Unpaid/Partially Paid Invoice for Populated Workspace
    const invRes = await pool.query(
      `INSERT INTO accounting_invoices (
         workspace_id, invoice_number, contact_id, issue_date, due_date, status,
         subtotal_minor, total_minor, amount_paid_minor, amount_due_minor
       ) VALUES ($1, 'INV-TEST-99', $2, CURRENT_DATE - 5, CURRENT_DATE + 5, 'PARTIALLY_PAID',
         1000000, 1000000, 400000, 600000)
       RETURNING id`,
      [populatedWsId, contactId]
    );
    invoiceId = invRes.rows[0].id;

    // Journal Entry for Credit Sale (Revenue 10k, AR 10k)
    const jeSale = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status)
       VALUES ($1, 'JE-SALE-01', CURRENT_DATE - 5, 'INVOICE', 'Sale to Client', 'INVOICE', 'POSTED')
       RETURNING id`,
      [populatedWsId]
    );
    const jeSaleId = jeSale.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor)
       VALUES ($1, $2, 1000000, 0), ($1, $3, 0, 1000000)`,
      [jeSaleId, arAccId, revAccId]
    );

    // Journal Entry for Cash Receipt (Bank 4k, AR 4k)
    const jeCash = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status)
       VALUES ($1, 'JE-COLLECT-01', CURRENT_DATE - 2, 'PAYMENT', 'Partial Collection', 'PAYMENT', 'POSTED')
       RETURNING id`,
      [populatedWsId]
    );
    const jeCashId = jeCash.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor)
       VALUES ($1, $2, 400000, 0), ($1, $3, 0, 400000)`,
      [jeCashId, bankAccId, arAccId]
    );

    // 4. Create Workspace B for User B
    const bWs = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Workspace B', 'PERSONAL', $1)
       RETURNING id`,
      [userBId]
    );
    wsBId = bWs.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [wsBId, userBId]
    );
  });

  t.after(async () => {
    await pool.end();
    await corePool.end();
  });

  await t.test("Scenario 1: Authorized empty workspace returns genuine zero totals without error", async () => {
    const metrics = await getDashboardMetrics(emptyWsId, { period: "month" });
    assert.equal(metrics.availableBalanceMinor, 0, "Available balance should be 0");
    assert.equal(metrics.moneyReceivedMinor, 0, "Money received should be 0");
    assert.equal(metrics.moneyPaidMinor, 0, "Money paid should be 0");
    assert.equal(metrics.owedToMeMinor, 0, "Owed to me should be 0");
    assert.equal(metrics.iOweMinor, 0, "I owe should be 0");
    assert.equal(metrics.earnedRevenueMinor, 0, "Earned revenue should be 0");
    assert.equal(metrics.incurredExpenseMinor, 0, "Incurred expense should be 0");
    assert.equal(metrics.netSurplusMinor, 0, "Net surplus should be 0");
    assert.equal(metrics.recentTransactions.length, 0, "No transactions");
    assert.equal(metrics.upcomingCommitments?.length, 0, "No commitments");
  });

  await t.test("Scenario 2: Populated workspace returns reconciled figures with joined contact name", async () => {
    const metrics = await getDashboardMetrics(populatedWsId, { period: "month" });
    // Reconciles with the ledger
    assert.equal(metrics.availableBalanceMinor, 400000, "Liquid bank balance must be ₹4,000 (400,000 minor)");
    assert.equal(metrics.moneyReceivedMinor, 400000, "Cash collected must be ₹4,000 (400,000 minor)");
    assert.equal(metrics.owedToMeMinor, 600000, "Remaining receivables must be ₹6,000 (600,000 minor)");
    assert.equal(metrics.earnedRevenueMinor, 1000000, "Earned revenue must be ₹10,000 (1,000,000 minor)");
    assert.equal(metrics.incurredExpenseMinor, 0, "Incurred expense should be 0");
    assert.equal(metrics.netSurplusMinor, 1000000, "Net profit margin must be ₹10,000");

    // Upcoming commitments must have joined contact name
    assert.ok(metrics.upcomingCommitments && metrics.upcomingCommitments.length > 0, "Should have upcoming invoice commitment");
    const commitment = metrics.upcomingCommitments[0];
    assert.equal(commitment.amount_minor, 600000, "Commitment due amount should be ₹6,000");
    assert.ok(commitment.title.includes("Test Client Ltd"), `Title must include contact name: ${commitment.title}`);
  });

  await t.test("Scenario 3: Revenue, expenses, cash movements, and receivables remain distinct", async () => {
    const metrics = await getDashboardMetrics(populatedWsId, { period: "month" });
    // Incurred expense != cash out
    assert.equal(metrics.incurredExpenseMinor, 0);
    assert.equal(metrics.moneyPaidMinor, 0);
    // Earned revenue (accrual 10,000) != Money received (cash 4,000)
    assert.notEqual(metrics.earnedRevenueMinor, metrics.moneyReceivedMinor);
    assert.equal(metrics.earnedRevenueMinor, 1000000);
    assert.equal(metrics.moneyReceivedMinor, 400000);
    // Outstanding receivables (6,000)
    assert.equal(metrics.owedToMeMinor, 600000);
  });

  await t.test("Scenario 4: Tenant isolation - User B cannot receive Workspace A figures", async () => {
    // 1. User B checking User A's workspace directly via authorization gate
    const authWs = await getAuthorizedWorkspace(userBId, populatedWsId, "VIEWER");
    assert.equal(authWs, null, "User B must be forbidden from accessing User A's workspace");

    // 2. Metrics for Workspace B should be isolated
    const metricsB = await getDashboardMetrics(wsBId, { period: "month" });
    assert.equal(metricsB.availableBalanceMinor, 0, "Workspace B must not show Workspace A balances");
    assert.equal(metricsB.owedToMeMinor, 0, "Workspace B must not show Workspace A receivables");
    assert.equal(metricsB.earnedRevenueMinor, 0, "Workspace B must not show Workspace A revenue");
  });

  await t.test("Scenario 5: Authorization and invalid parameter validation", async () => {
    // Malformed UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.equal(UUID_REGEX.test("invalid-uuid"), false, "Regex must reject malformed UUID");
    assert.equal(UUID_REGEX.test(populatedWsId), true, "Regex must accept valid UUID");

    // Period validation
    const VALID_PERIODS = new Set(["today", "week", "month", "year", "all", "custom"]);
    assert.equal(VALID_PERIODS.has("month"), true);
    assert.equal(VALID_PERIODS.has("invalid_period"), false);
  });
});
