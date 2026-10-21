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

const DATABASE_URL = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

// Dynamic imports after server-only bypass
const { recordPayment, reversePayment, listPayments } = await import("../src/lib/accounting/payments.ts");
const { createInvoice, getInvoiceById, listInvoices } = await import("../src/lib/accounting/invoices.ts");
const { seedDefaultChartOfAccounts, listFinancialAccounts } = await import("../src/lib/accounting/accounts.ts");
const { createContact } = await import("../src/lib/accounting/contacts.ts");

test("Sales & Invoices: Collect & Confirm Collection End-to-End Verification", async (t) => {
  let userAId, userBId, wsAId, wsBId;
  let testContactAId, bankAccountAId, bankAccountBId;
  const createdInvoiceIds = [];
  const createdPaymentIds = [];

  t.before(async () => {
    // 1. Obtain test users
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Must have at least two users for isolation tests");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // 2. Create unique test Workspace A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Invoice Collection Test WS A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
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
       VALUES ($1, 'Invoice Collection Test WS B', 'PERSONAL', 'INDIVIDUAL') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsBId, userBId]
    );

    // 4. Seed chart of accounts for both workspaces
    await seedDefaultChartOfAccounts(wsAId);
    await seedDefaultChartOfAccounts(wsBId);

    const accountsA = await listFinancialAccounts(wsAId);
    const bankA = accountsA.find((a) => a.code === "1020") || accountsA[0];
    bankAccountAId = bankA.id;

    const accountsB = await listFinancialAccounts(wsBId);
    const bankB = accountsB.find((a) => a.code === "1020") || accountsB[0];
    bankAccountBId = bankB.id;

    // 5. Create test customer contact in Workspace A
    const contact = await createContact({
      workspaceId: wsAId,
      name: "Acme Industrial Client",
      type: "CUSTOMER",
      email: "billing@acme.com",
    });
    testContactAId = contact.id;
  });

  t.after(async () => {
    // Cleanup allocations
    if (createdPaymentIds.length > 0) {
      await pool.query(`DELETE FROM accounting_payment_allocations WHERE payment_id = ANY($1::uuid[])`, [createdPaymentIds]);
      await pool.query(`DELETE FROM accounting_payments WHERE id = ANY($1::uuid[])`, [createdPaymentIds]);
    }
    // Cleanup invoices & lines
    if (createdInvoiceIds.length > 0) {
      await pool.query(`DELETE FROM accounting_invoice_lines WHERE invoice_id = ANY($1::uuid[])`, [createdInvoiceIds]);
      await pool.query(`DELETE FROM accounting_invoices WHERE id = ANY($1::uuid[])`, [createdInvoiceIds]);
    }
    // Cleanup journal lines & entries
    if (wsAId) {
      await pool.query(
        `DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`,
        [wsAId]
      );
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_contacts WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]);
    }
    if (wsBId) {
      await pool.query(
        `DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`,
        [wsBId]
      );
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]);
    }
    await pool.end();
    const { pool: sharedPool } = await import("../src/lib/db/index.ts");
    await sharedPool.end();
  });

  const getBankBalance = async (accId) => {
    const res = await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [accId]);
    return Number(res.rows[0]?.current_balance_minor || 0);
  };

  const getRevenueBalance = async (wsId) => {
    const res = await pool.query(
      `SELECT current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '4000'`,
      [wsId]
    );
    return Number(res.rows[0]?.current_balance_minor || 0);
  };

  const getArBalance = async (wsId) => {
    const res = await pool.query(
      `SELECT current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '1200'`,
      [wsId]
    );
    return Number(res.rows[0]?.current_balance_minor || 0);
  };

  await t.test("1. Full payment of a ₹12,00,000 invoice created as DRAFT: atomic issuance & settlement", async () => {
    const bankBefore = await getBankBalance(bankAccountAId);
    const revBefore = await getRevenueBalance(wsAId);
    const arBefore = await getArBalance(wsAId);

    // Create ₹12,00,000 DRAFT invoice (120000000 minor)
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      contactId: testContactAId,
      status: "DRAFT",
      dueDate: "2026-11-20",
      lines: [
        { description: "Commercial Solar Power Installation", quantity: 1, unitPriceMinor: 120000000 },
      ],
    });
    createdInvoiceIds.push(invoice.id);
    assert.equal(invoice.status, "DRAFT");
    assert.equal(Number(invoice.total_minor), 120000000);
    assert.equal(Number(invoice.amount_due_minor), 120000000);
    assert.equal(Number(invoice.amount_paid_minor), 0);

    // Collect full ₹12,00,000
    const result = await recordPayment({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      amountMinor: 120000000,
      financialAccountId: bankAccountAId,
      paymentDate: "2026-10-20",
      notes: `Collection for ${invoice.invoice_number}`,
    });
    createdPaymentIds.push(result.payment.id);

    // 1. Verify Payment & Allocation records
    assert.ok(result.payment.id);
    assert.equal(Number(result.payment.amount_minor), 120000000);
    assert.equal(result.allocations.length, 1);
    assert.equal(result.allocations[0].invoice_id, invoice.id);
    assert.equal(Number(result.allocations[0].allocated_minor), 120000000);

    // 2. Verify Invoice updated state
    const updated = await getInvoiceById(wsAId, invoice.id);
    assert.equal(updated.invoice.status, "PAID");
    assert.equal(Number(updated.invoice.amount_paid_minor), 120000000);
    assert.equal(Number(updated.invoice.amount_due_minor), 0);
    assert.ok(updated.invoice.posted_journal_entry_id, "Must be atomically issued with journal entry");

    // 3. Verify Financial Ledger balances
    const bankAfter = await getBankBalance(bankAccountAId);
    const revAfter = await getRevenueBalance(wsAId);
    const arAfter = await getArBalance(wsAId);

    assert.equal(bankAfter, bankBefore + 120000000, "Bank balance must increase by exactly ₹12,00,000");
    assert.equal(revAfter, revBefore + 120000000, "Revenue must be recognized once for ₹12,00,000");
    assert.equal(arAfter, arBefore, "Accounts receivable net delta must be zero (accrual debited, collection credited)");
  });

  await t.test("2. A ₹10,000 invoice with ₹4,000 already paid: collecting ₹6,000 settles it and increases bank only by ₹6,000", async () => {
    // Create an already-issued invoice for ₹10,000 (1000000 minor)
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      contactId: testContactAId,
      status: "ISSUED",
      dueDate: "2026-11-25",
      lines: [
        { description: "Annual Software License", quantity: 1, unitPriceMinor: 1000000 },
      ],
    });
    createdInvoiceIds.push(invoice.id);

    // Collect first installment of ₹4,000 (400000 minor)
    const p1 = await recordPayment({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      amountMinor: 400000,
      financialAccountId: bankAccountAId,
    });
    createdPaymentIds.push(p1.payment.id);

    const midInvoice = await getInvoiceById(wsAId, invoice.id);
    assert.equal(midInvoice.invoice.status, "PARTIALLY_PAID");
    assert.equal(Number(midInvoice.invoice.amount_paid_minor), 400000);
    assert.equal(Number(midInvoice.invoice.amount_due_minor), 600000);

    const bankBeforeSettlement = await getBankBalance(bankAccountAId);
    const revBeforeSettlement = await getRevenueBalance(wsAId);

    // Now collect remaining ₹6,000 to fully settle
    const p2 = await recordPayment({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      amountMinor: 600000,
      financialAccountId: bankAccountAId,
    });
    createdPaymentIds.push(p2.payment.id);

    // 1. Verify Invoice state
    const settledInvoice = await getInvoiceById(wsAId, invoice.id);
    assert.equal(settledInvoice.invoice.status, "PAID");
    assert.equal(Number(settledInvoice.invoice.amount_paid_minor), 1000000);
    assert.equal(Number(settledInvoice.invoice.amount_due_minor), 0);

    // 2. Verify Bank and Revenue
    const bankAfterSettlement = await getBankBalance(bankAccountAId);
    const revAfterSettlement = await getRevenueBalance(wsAId);

    assert.equal(
      bankAfterSettlement,
      bankBeforeSettlement + 600000,
      "Bank balance must increase only by the second installment (₹6,000)"
    );
    assert.equal(
      revAfterSettlement,
      revBeforeSettlement,
      "Revenue must NOT be posted again for already-issued invoice"
    );
  });

  await t.test("3. Partial payment leaves status as PARTIALLY_PAID with correct remaining balance", async () => {
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      contactId: testContactAId,
      status: "ISSUED",
      dueDate: "2026-11-30",
      lines: [
        { description: "Hardware Server Provisioning", quantity: 1, unitPriceMinor: 5000000 }, // ₹50,000
      ],
    });
    createdInvoiceIds.push(invoice.id);

    const bankBefore = await getBankBalance(bankAccountAId);

    const p = await recordPayment({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      amountMinor: 2000000, // ₹20,000
      financialAccountId: bankAccountAId,
    });
    createdPaymentIds.push(p.payment.id);

    const updated = await getInvoiceById(wsAId, invoice.id);
    assert.equal(updated.invoice.status, "PARTIALLY_PAID");
    assert.equal(Number(updated.invoice.amount_paid_minor), 2000000);
    assert.equal(Number(updated.invoice.amount_due_minor), 3000000);

    const bankAfter = await getBankBalance(bankAccountAId);
    assert.equal(bankAfter, bankBefore + 2000000);
  });

  await t.test("4. Idempotency guard and rejection of collection on already-paid invoice", async () => {
    // Create and fully settle an invoice
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      contactId: testContactAId,
      status: "ISSUED",
      dueDate: "2026-11-30",
      lines: [{ description: "Consulting Hour", quantity: 1, unitPriceMinor: 500000 }], // ₹5,000
    });
    createdInvoiceIds.push(invoice.id);

    const idempKey = `IDEMP-${Date.now()}-${Math.random()}`;
    const p1 = await recordPayment({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      amountMinor: 500000,
      financialAccountId: bankAccountAId,
      idempotencyKey: idempKey,
    });
    createdPaymentIds.push(p1.payment.id);

    // Rapid second call with same idempotency key
    const p2 = await recordPayment({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      amountMinor: 500000,
      financialAccountId: bankAccountAId,
      idempotencyKey: idempKey,
    });
    assert.equal(p2.payment.id, p1.payment.id, "Must return existing payment on idempotency hit");

    // Attempting another collection against now-settled invoice must throw
    await assert.rejects(
      () =>
        recordPayment({
          workspaceId: wsAId,
          invoiceId: invoice.id,
          amountMinor: 100000,
          financialAccountId: bankAccountAId,
        }),
      /already fully paid/
    );
  });

  await t.test("5. Overpayment and non-positive amounts rejected", async () => {
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      status: "ISSUED",
      dueDate: "2026-11-30",
      lines: [{ description: "Office Maintenance", quantity: 1, unitPriceMinor: 200000 }], // ₹2,000
    });
    createdInvoiceIds.push(invoice.id);

    // Overpayment (attempting ₹3,000 on ₹2,000 due)
    await assert.rejects(
      () =>
        recordPayment({
          workspaceId: wsAId,
          invoiceId: invoice.id,
          amountMinor: 300000,
          financialAccountId: bankAccountAId,
        }),
      /Overpayment prevented/
    );

    // Zero / Negative amount
    await assert.rejects(
      () =>
        recordPayment({
          workspaceId: wsAId,
          invoiceId: invoice.id,
          amountMinor: 0,
          financialAccountId: bankAccountAId,
        }),
      /greater than zero/
    );

    await assert.rejects(
      () =>
        recordPayment({
          workspaceId: wsAId,
          invoiceId: invoice.id,
          amountMinor: -100,
          financialAccountId: bankAccountAId,
        }),
      /greater than zero/
    );
  });

  await t.test("6. Forced intermediate failure rolls back transaction completely", async () => {
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      status: "ISSUED",
      dueDate: "2026-11-30",
      lines: [{ description: "Security Audit", quantity: 1, unitPriceMinor: 1500000 }], // ₹15,000
    });
    createdInvoiceIds.push(invoice.id);

    const bankBefore = await getBankBalance(bankAccountAId);

    // Use a non-existent account ID in workspace
    await assert.rejects(
      () =>
        recordPayment({
          workspaceId: wsAId,
          invoiceId: invoice.id,
          amountMinor: 1500000,
          financialAccountId: "b0000000-0000-4000-a000-000000000000",
        }),
      /Deposit\/disbursement financial account not found/
    );

    // Verify invoice and bank balances are untouched
    const invAfter = await getInvoiceById(wsAId, invoice.id);
    assert.equal(invAfter.invoice.status, "ISSUED");
    assert.equal(Number(invAfter.invoice.amount_paid_minor), 0);
    assert.equal(Number(invAfter.invoice.amount_due_minor), 1500000);

    const bankAfter = await getBankBalance(bankAccountAId);
    assert.equal(bankAfter, bankBefore, "Bank balance must not change on failure");
  });

  await t.test("7. Traceable payment reversal restores invoice balance and bank balance", async () => {
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      status: "ISSUED",
      dueDate: "2026-11-30",
      lines: [{ description: "Retainer Fee", quantity: 1, unitPriceMinor: 800000 }], // ₹8,000
    });
    createdInvoiceIds.push(invoice.id);

    const bankInitial = await getBankBalance(bankAccountAId);

    const { payment } = await recordPayment({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      amountMinor: 800000,
      financialAccountId: bankAccountAId,
      notes: "Initial retainer collection",
    });
    createdPaymentIds.push(payment.id);

    const bankPaid = await getBankBalance(bankAccountAId);
    assert.equal(bankPaid, bankInitial + 800000);

    const settledInv = await getInvoiceById(wsAId, invoice.id);
    assert.equal(settledInv.invoice.status, "PAID");

    // Traceably reverse payment
    await reversePayment(wsAId, payment.id, "Customer cheque bounced");

    // 1. Bank balance restored
    const bankReversed = await getBankBalance(bankAccountAId);
    assert.equal(bankReversed, bankInitial, "Bank balance must decrease back to initial balance");

    // 2. Invoice balance and status restored
    const restoredInv = await getInvoiceById(wsAId, invoice.id);
    assert.equal(restoredInv.invoice.status, "ISSUED");
    assert.equal(Number(restoredInv.invoice.amount_paid_minor), 0);
    assert.equal(Number(restoredInv.invoice.amount_due_minor), 800000);

    // 3. Payment record notes tagged with reversal
    const payCheck = await pool.query(`SELECT notes FROM accounting_payments WHERE id = $1`, [payment.id]);
    assert.ok(payCheck.rows[0].notes.includes("[REVERSED: Customer cheque bounced]"));
  });

  await t.test("8. Workspace isolation: cannot collect cross-workspace invoices or deposit into foreign accounts", async () => {
    // Create invoice in Workspace A
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      status: "ISSUED",
      dueDate: "2026-11-30",
      lines: [{ description: "Workspace A Task", quantity: 1, unitPriceMinor: 500000 }],
    });
    createdInvoiceIds.push(invoice.id);

    // Workspace B attempts to collect Workspace A's invoice
    await assert.rejects(
      () =>
        recordPayment({
          workspaceId: wsBId,
          invoiceId: invoice.id,
          amountMinor: 500000,
          financialAccountId: bankAccountBId,
        }),
      /not found in workspace/
    );

    // Workspace A attempts to deposit into Workspace B's bank account
    await assert.rejects(
      () =>
        recordPayment({
          workspaceId: wsAId,
          invoiceId: invoice.id,
          amountMinor: 500000,
          financialAccountId: bankAccountBId,
        }),
      /financial account not found in workspace/
    );
  });
});
