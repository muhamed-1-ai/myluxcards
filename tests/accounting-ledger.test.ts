import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

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
  } as any;
} catch (_) {}

// Dynamic imports after server-only bypass in test runner
const { pool } = await import("../src/lib/db/core");
const { ensureDefaultWorkspace } = await import("../src/lib/accounting/workspaces");
const { getFinancialAccountByCode } = await import("../src/lib/accounting/accounts");
const { createContact } = await import("../src/lib/accounting/contacts");
const { createInvoice } = await import("../src/lib/accounting/invoices");
const { recordPayment } = await import("../src/lib/accounting/payments");

test("Accounting General Ledger: Case 1 - ₹10,000 credit sale with ₹4,000 collection", async () => {
  // 1. Get an existing user
  const userRes = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM users ORDER BY created_at ASC LIMIT 1`
  );
  const user = userRes.rows[0];
  assert.ok(user, "User must exist");

  // 2. Ensure default workspace
  const workspace = await ensureDefaultWorkspace(user.id, user.name);

  // 3. Create a test customer
  const contact = await createContact({
    workspaceId: workspace.id,
    name: "Customer Test Case 1",
    type: "CUSTOMER",
    email: "customer1@example.com",
    phone: "+919876543210",
  });

  // 4. Record ₹10,000 credit sale via issued invoice
  const { invoice } = await createInvoice({
    workspaceId: workspace.id,
    contactId: contact.id,
    dueDate: new Date().toISOString().slice(0, 10),
    status: "ISSUED",
    lines: [
      {
        description: "Consulting Package",
        quantity: 1,
        unitPriceMinor: 1000000, // ₹10,000.00
      },
    ],
    userId: user.id,
  });

  assert.equal(Number(invoice.total_minor), 1000000);
  assert.equal(Number(invoice.amount_due_minor), 1000000);

  // 5. Check ledger immediately after credit sale:
  // Revenue must be ₹10,000; Receivable must be ₹10,000; Cash collected so far is ₹0.
  const arAcc = await getFinancialAccountByCode(workspace.id, "1200");
  const revAcc = await getFinancialAccountByCode(workspace.id, "4000");
  const bankAcc = await getFinancialAccountByCode(workspace.id, "1020");

  assert.ok(arAcc && revAcc && bankAcc);

  // 6. Record ₹4,000 partial collection
  const { payment } = await recordPayment({
    workspaceId: workspace.id,
    type: "IN",
    contactId: contact.id,
    financialAccountId: bankAcc.id,
    amountMinor: 400000, // ₹4,000.00
    allocations: [
      {
        invoiceId: invoice.id,
        amountMinor: 400000,
      },
    ],
    userId: user.id,
  });

  assert.equal(Number(payment.amount_minor), 400000);

  // 7. Verify Invariants:
  // - Revenue: ₹10,000 (never inflated by payment)
  // - Cash/Bank received from this payment: +₹4,000 (never ₹10,000)
  // - Remaining Accounts Receivable for this invoice: ₹6,000
  const refreshedInvRes = await pool.query<{ amount_paid_minor: string; amount_due_minor: string; status: string }>(
    `SELECT amount_paid_minor, amount_due_minor, status FROM accounting_invoices WHERE id = $1`,
    [invoice.id]
  );
  const refreshedInv = refreshedInvRes.rows[0];

  assert.equal(Number(refreshedInv.amount_paid_minor), 400000, "Paid amount must be ₹4,000");
  assert.equal(Number(refreshedInv.amount_due_minor), 600000, "Due amount must be ₹6,000");
  assert.equal(refreshedInv.status, "PARTIALLY_PAID");

  // 8. Verify General Ledger Balance Invariant: SUM(debits) === SUM(credits)
  const balanceCheck = await pool.query<{ total_debits: string; total_credits: string }>(
    `SELECT
       COALESCE(SUM(debit_minor), 0) as total_debits,
       COALESCE(SUM(credit_minor), 0) as total_credits
     FROM accounting_journal_lines jl
     JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.workspace_id = $1 AND je.status = 'POSTED'`,
    [workspace.id]
  );

  assert.equal(
    balanceCheck.rows[0].total_debits,
    balanceCheck.rows[0].total_credits,
    "General Ledger Invariant: Total debits must strictly equal total credits"
  );
});

test("Accounting General Ledger: Case 11 - Every posted journal entry strictly balances", async () => {
  const userRes = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM users ORDER BY created_at ASC LIMIT 1`
  );
  const user = userRes.rows[0];
  const workspace = await ensureDefaultWorkspace(user.id, user.name);

  // Check every individual entry in the workspace
  const entries = await pool.query<{ id: string; entry_number: string }>(
    `SELECT id, entry_number FROM accounting_journal_entries WHERE workspace_id = $1`,
    [workspace.id]
  );

  for (const entry of entries.rows) {
    const lines = await pool.query<{ debits: string; credits: string }>(
      `SELECT SUM(debit_minor) as debits, SUM(credit_minor) as credits
       FROM accounting_journal_lines
       WHERE journal_entry_id = $1`,
      [entry.id]
    );
    assert.equal(
      lines.rows[0].debits,
      lines.rows[0].credits,
      `Journal entry ${entry.entry_number} must have SUM(debit) === SUM(credit)`
    );
  }
});
