import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

test("Accounting Overview Final Layout & Commitments Test Suite", async (t) => {
  let userId;
  let workspaceId;

  const { pool: corePool } = await import("../src/lib/db/core.ts");
  const { getDashboardMetrics } = await import("../src/lib/accounting/reports.ts");

  t.before(async () => {
    // Create test user and workspace
    const uRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('final_test_${Date.now()}@example.com', 'Final Test User', 'USER')
       RETURNING id`
    );
    userId = uRes.rows[0].id;

    const ws = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Commitments Test Workspace', 'BUSINESS', $1)
       RETURNING id`,
      [userId]
    );
    workspaceId = ws.rows[0].id;

    // Create an unpaid invoice (Customer Receivable or Vendor Bill)
    const invRes = await pool.query(
      `INSERT INTO accounting_invoices (workspace_id, invoice_number, issue_date, due_date, subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor, status)
       VALUES ($1, 'INV-TEST-001', CURRENT_DATE - 5, CURRENT_DATE - 2, 450000, 0, 0, 450000, 0, 450000, 'ISSUED')
       RETURNING id`,
      [workspaceId]
    );
    const invoiceId = invRes.rows[0].id;

    // Create a reminder that references this exact invoice (should be deduplicated)
    await pool.query(
      `INSERT INTO accounting_reminders (workspace_id, user_id, title, due_date, type, entity_type, entity_id, status)
       VALUES ($1, $2, 'Duplicate Bill Reminder', CURRENT_DATE - 2, 'INVOICE_DUE', 'INVOICE', $3, 'PENDING')`,
      [workspaceId, userId, invoiceId]
    );

    // Create a future reminder without invoice
    await pool.query(
      `INSERT INTO accounting_reminders (workspace_id, user_id, title, due_date, type, status)
       VALUES ($1, $2, 'AWS Cloud Services - ₹2,500', CURRENT_DATE + 5, 'BILL_DUE', 'PENDING')`,
      [workspaceId, userId]
    );

    // Create another reminder with amount in title
    await pool.query(
      `INSERT INTO accounting_reminders (workspace_id, user_id, title, due_date, type, status)
       VALUES ($1, $2, 'Server EMI due ₹1,200', CURRENT_DATE + 10, 'LOAN_EMI', 'PENDING')`,
      [workspaceId, userId]
    );
  });

  t.after(async () => {
    await pool.end();
    await corePool.end();
  });

  await t.test("1. Upcoming commitments deduplicate invoice and reminder by entity_id", async () => {
    const metrics = await getDashboardMetrics(workspaceId, { period: "month" });
    assert.ok(metrics.upcomingCommitments, "upcomingCommitments must be defined");

    // We inserted 1 invoice + 1 reminder pointing to that invoice + 1 AWS reminder + 1 EMI reminder.
    // The duplicate reminder pointing to the invoice must be deduplicated. Total should be 3.
    assert.equal(
      metrics.upcomingCommitments.length,
      3,
      "Duplicate commitment with matching entity_id must be deduplicated"
    );

    // The overdue item should be first
    assert.equal(metrics.upcomingCommitments[0].is_overdue, true, "First item must be overdue item");
    assert.equal(metrics.upcomingCommitments[0].amount_minor, 450000);

    // The EMI reminder with amount in title should have extracted amount 120,000 minor (1200 * 100)
    const emiItem = metrics.upcomingCommitments.find((c) => c.title.includes("EMI"));
    assert.ok(emiItem, "EMI reminder should be in commitments");
    assert.equal(emiItem.amount_minor, 120000, "Amount must be extracted from title when minor is 0");
  });

  await t.test("2. Overview UI component does not render Runway, Incurred Expenses, or Net Business Profit", () => {
    const componentPath = path.resolve(process.cwd(), "src/components/accounting/AccountingOverview.tsx");
    const code = fs.readFileSync(componentPath, "utf-8");

    // Verify Runway is NOT in the UI
    assert.equal(code.includes("Runway"), false, "AccountingOverview must not mention or render Runway");
    // Verify Incurred Expenses card is NOT in the UI
    assert.equal(code.includes("Incurred Expenses"), false, "AccountingOverview must not render Incurred Expenses card");
    // Verify Net Business Profit card is NOT in the UI
    assert.equal(code.includes("Net Business Profit"), false, "AccountingOverview must not render Net Business Profit card");

    // Verify Row 1: Available Balance, Money Received, Money Paid
    assert.ok(code.includes("Available Balance"), "Row 1 must have Available Balance");
    assert.ok(code.includes("Money Received"), "Row 1 must have Money Received");
    assert.ok(code.includes("Money Paid"), "Row 1 must have Money Paid");

    // Verify Row 2: Owed to Me, I Owe
    assert.ok(code.includes("Owed to Me"), "Row 2 must have Owed to Me");
    assert.ok(code.includes("I Owe"), "Row 2 must have I Owe");

    // Verify Row 3: Cash Flow, Upcoming Bills
    assert.ok(code.includes("Cash Flow"), "Row 3 must have Cash Flow");
    assert.ok(code.includes("Upcoming Bills"), "Row 3 must have Upcoming Bills");

    // Verify Row 4: Recent Transactions
    assert.ok(code.includes("Recent Transactions"), "Row 4 must have Recent Transactions");
  });

  await t.test("3. CSS layout conforms to the 4-row desktop specifications", () => {
    const cssPath = path.resolve(process.cwd(), "src/components/accounting/accounting.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Grid row 1: 3 columns
    assert.ok(css.includes(".acc-top-three-grid"), "Must define .acc-top-three-grid");
    assert.ok(css.includes("repeat(3, minmax(0, 1fr))"), "Row 1 must be 3 columns");

    // Grid row 2: 2 columns
    assert.ok(css.includes(".acc-outstanding-grid"), "Must define .acc-outstanding-grid");
    assert.ok(css.includes("repeat(2, minmax(0, 1fr))"), "Row 2 must be 2 columns");

    // Grid row 3: Cash Flow ~61% and Upcoming Bills ~39%
    assert.ok(css.includes(".acc-main-split"), "Must define .acc-main-split");
    assert.ok(css.includes("minmax(0, 61fr) minmax(0, 39fr)"), "Row 3 must be ~61% and ~39%");

    // Palette tokens
    assert.ok(css.includes("#000000"), "Page background token #000000 must be defined");
    assert.ok(css.includes("#141414"), "Card background token #141414 must be defined");
    assert.ok(css.includes("#1C1C1C"), "Surface token #1C1C1C must be defined");
    assert.ok(css.includes("#303030"), "Border token #303030 must be defined");
    assert.ok(css.includes("#174EA6"), "Primary blue button token #174EA6 must be defined");
    assert.ok(css.includes("#2583FF"), "Chart blue token #2583FF must be defined");
  });
});
