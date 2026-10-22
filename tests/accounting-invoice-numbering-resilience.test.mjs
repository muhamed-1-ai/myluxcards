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
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });

const {
  createInvoice,
  getInvoiceById,
  updateDraftInvoice,
  issueDraftInvoice,
} = await import("../src/lib/accounting/invoices.js");

const { createContact } = await import("../src/lib/accounting/contacts.js");
const { seedDefaultChartOfAccounts, getFinancialAccountByCode } = await import(
  "../src/lib/accounting/accounts.js"
);
const { collectInvoicePayment } = await import(
  "../src/lib/accounting/payments.js"
);

test("Accounting Invoices: Numbering Resilience, Alphanumeric TEST01, Sequences & Concurrency", async (t) => {
  let userId, wsAId, wsBId, contactAId, contactBId, bankAccAId;

  t.before(async () => {
    const userRes = await pool.query(
      `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`
    );
    assert(userRes.rows.length > 0, "A user is required for test");
    userId = userRes.rows[0].id;

    // Create Workspace A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Invoice Test WS A ${Date.now()}', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [userId]
    );
    wsAId = wsARes.rows[0].id;

    // Create Workspace B (for workspace isolation test)
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Invoice Test WS B ${Date.now()}', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [userId]
    );
    wsBId = wsBRes.rows[0].id;

    await seedDefaultChartOfAccounts(wsAId);
    await seedDefaultChartOfAccounts(wsBId);

    const bankAccA = await getFinancialAccountByCode(wsAId, "1020");
    assert(bankAccA, "Bank account 1020 must exist");
    bankAccAId = bankAccA.id;

    const contactA = await createContact({
      workspaceId: wsAId,
      name: "Febin Corp",
      type: "CUSTOMER",
      email: "febin@myluxcards.com",
    });
    contactAId = contactA.id;

    const contactB = await createContact({
      workspaceId: wsBId,
      name: "Second Corp",
      type: "CUSTOMER",
      email: "second@example.com",
    });
    contactBId = contactB.id;

    // Seed existing invoices in Workspace A:
    // 1. An alphanumeric invoice: INV-2026-TEST01 (The exact scenario reported)
    // 2. An existing numeric invoice: INV-2026-0001
    // 3. Another alphanumeric invoice: INV-2026-INST01
    // 4. An unusually large suffix invoice that must not crash: INV-2026-99999999999999
    await pool.query(
      `INSERT INTO accounting_invoices 
         (workspace_id, invoice_number, contact_id, issue_date, due_date, status, currency,
          subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, amount_due_minor,
          notes, internal_notes, share_token)
       VALUES 
         ($1, 'INV-2026-TEST01', $2, '2026-10-01', '2026-10-31', 'PAID', 'INR', 500000, 0, 0, 500000, 500000, 0, 'Test 01 note', 'Internal confidential', 'share-tok-test-01'),
         ($1, 'INV-2026-0001', $2, '2026-10-05', '2026-11-05', 'ISSUED', 'INR', 100000, 0, 0, 100000, 0, 100000, 'First invoice', NULL, 'share-tok-0001'),
         ($1, 'INV-2026-INST01', $2, '2026-10-10', '2026-11-10', 'DRAFT', 'INR', 200000, 0, 0, 200000, 0, 200000, 'Installment 01', NULL, 'share-tok-inst-01'),
         ($1, 'INV-2026-99999999999999', $2, '2026-10-12', '2026-11-12', 'DRAFT', 'INR', 300000, 0, 0, 300000, 0, 300000, 'Huge suffix', NULL, 'share-tok-huge')`,
      [wsAId, contactAId]
    );

    // Also insert a line item and payment for INV-2026-TEST01 to verify retention
    const test01InvRes = await pool.query(
      `SELECT id FROM accounting_invoices WHERE workspace_id = $1 AND invoice_number = 'INV-2026-TEST01'`,
      [wsAId]
    );
    const test01Id = test01InvRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_invoice_lines (invoice_id, description, quantity, unit_price_minor, total_minor, sort_order)
       VALUES ($1, 'Existing Special Item', 1, 500000, 500000, 1)`,
      [test01Id]
    );
  });

  t.after(async () => {
    for (const id of [wsAId, wsBId]) {
      if (id) {
        await pool.query(`DELETE FROM accounting_invoice_lines WHERE invoice_id IN (SELECT id FROM accounting_invoices WHERE workspace_id = $1)`, [id]);
        await pool.query(`DELETE FROM accounting_payment_allocations WHERE invoice_id IN (SELECT id FROM accounting_invoices WHERE workspace_id = $1)`, [id]);
        await pool.query(`DELETE FROM accounting_payments WHERE workspace_id = $1`, [id]);
        await pool.query(`DELETE FROM accounting_invoices WHERE workspace_id = $1`, [id]);
        await pool.query(`DELETE FROM accounting_invoice_sequences WHERE workspace_id = $1`, [id]);
        await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [id]);
        await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [id]);
        await pool.query(`DELETE FROM accounting_contacts WHERE workspace_id = $1`, [id]);
        await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [id]);
        await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [id]);
      }
    }
    await pool.end();
  });

  let createdDraftId;

  await t.test("1. Creating a new draft succeeds and does not fail on INV-2026-TEST01", async () => {
    // Before this fix, this exact call failed with invalid input syntax for type integer: "TEST01"
    const { invoice, lines } = await createInvoice({
      workspaceId: wsAId,
      contactId: contactAId,
      issueDate: "2026-10-22",
      dueDate: "2026-11-21",
      status: "DRAFT",
      notes: "Payment Instructions here",
      internalNotes: "Private team note",
      lines: [
        { description: "gold card", quantity: 12, unitPriceMinor: 200000 },
        { description: "white card", quantity: 1, unitPriceMinor: 211100 },
      ],
      userId,
    });

    assert.equal(invoice.status, "DRAFT");
    // Since INV-2026-0001 exists, next numeric sequence should be INV-2026-0002
    assert.equal(invoice.invoice_number, "INV-2026-0002");
    assert.equal(lines.length, 2);
    // 12 * 2000.00 = 24,000.00 (2400000) + 1 * 2111.00 (211100) = 26,111.00 (2611100)
    assert.equal(Number(invoice.total_minor), 2611100);
    createdDraftId = invoice.id;
  });

  await t.test("2. Creating and issuing an invoice directly succeeds and generates next sequential number", async () => {
    const { invoice, lines } = await createInvoice({
      workspaceId: wsAId,
      contactId: contactAId,
      issueDate: "2026-10-22",
      dueDate: "2026-11-21",
      status: "ISSUED",
      lines: [
        { description: "Consulting Hour", quantity: 2, unitPriceMinor: 50000 },
      ],
      userId,
    });

    assert.equal(invoice.status, "ISSUED");
    assert.equal(invoice.invoice_number, "INV-2026-0003");
    assert.equal(Number(invoice.total_minor), 100000);
    assert(invoice.posted_journal_entry_id, "Posted journal entry must exist");
  });

  await t.test("3. Issuing an existing draft updates status and posts journal entry", async () => {
    const { invoice } = await issueDraftInvoice(wsAId, createdDraftId, userId);
    assert.equal(invoice.status, "ISSUED");
    assert.equal(invoice.invoice_number, "INV-2026-0002"); // Retains its draft invoice number
    assert(invoice.posted_journal_entry_id, "Must have posted journal entry upon issuance");
  });

  await t.test("4. Existing alphanumeric invoice INV-2026-TEST01 opens with getInvoiceById intact", async () => {
    const test01Inv = (
      await pool.query(
        `SELECT id FROM accounting_invoices WHERE workspace_id = $1 AND invoice_number = 'INV-2026-TEST01'`,
        [wsAId]
      )
    ).rows[0];

    const data = await getInvoiceById(wsAId, test01Inv.id);
    assert(data, "Invoice data must exist");
    assert.equal(data.invoice.invoice_number, "INV-2026-TEST01");
    assert.equal(data.invoice.status, "PAID");
    assert.equal(data.lines.length, 1);
    assert.equal(data.lines[0].description, "Existing Special Item");
    assert.equal(data.contact?.name, "Febin Corp");
  });

  await t.test("5. Concurrent creations produce strictly unique invoice numbers without collision", async () => {
    const promises = Array.from({ length: 5 }).map((_, i) =>
      createInvoice({
        workspaceId: wsAId,
        contactId: contactAId,
        issueDate: "2026-10-22",
        status: "DRAFT",
        lines: [
          { description: `Concurrent Item ${i + 1}`, quantity: 1, unitPriceMinor: 10000 },
        ],
        userId,
      })
    );

    const results = await Promise.all(promises);
    const generatedNumbers = results.map((r) => r.invoice.invoice_number);
    const uniqueNumbers = new Set(generatedNumbers);

    assert.equal(
      uniqueNumbers.size,
      5,
      `All 5 invoice numbers must be unique. Generated: ${generatedNumbers.join(", ")}`
    );

    // Numbers must follow sequential sequence e.g. 0004, 0005, 0006, 0007, 0008
    for (const num of generatedNumbers) {
      assert(/^INV-2026-\d{4}$/.test(num), `Invoice number must match standard format: ${num}`);
    }
  });

  await t.test("6. Workspace isolation: Workspace B starts its own independent numbering sequence", async () => {
    const { invoice } = await createInvoice({
      workspaceId: wsBId,
      contactId: contactBId,
      issueDate: "2026-10-22",
      status: "DRAFT",
      lines: [
        { description: "Workspace B Item", quantity: 1, unitPriceMinor: 15000 },
      ],
      userId,
    });

    // Workspace B had no previous invoices, so it starts at 0001
    assert.equal(invoice.invoice_number, "INV-2026-0001");

    // Cross-workspace lookup must return null
    const crossCheck = await getInvoiceById(wsAId, invoice.id);
    assert.equal(crossCheck, null, "Workspace A must not access Workspace B invoice");
  });

  await t.test("7. Transaction atomicity: Failure during creation leaves NO orphan records", async () => {
    const countInvoicesBefore = parseInt(
      (await pool.query(`SELECT COUNT(*) FROM accounting_invoices WHERE workspace_id = $1`, [wsAId])).rows[0].count,
      10
    );
    const countLinesBefore = parseInt(
      (await pool.query(`SELECT COUNT(*) FROM accounting_invoice_lines`)).rows[0].count,
      10
    );

    // Attempt creation with invalid lines that should fail validation
    await assert.rejects(
      async () => {
        await createInvoice({
          workspaceId: wsAId,
          contactId: contactAId,
          issueDate: "2026-10-22",
          status: "DRAFT",
          lines: [], // Empty lines should reject immediately
          userId,
        });
      },
      { message: /must have at least one line item/ }
    );

    const countInvoicesAfter = parseInt(
      (await pool.query(`SELECT COUNT(*) FROM accounting_invoices WHERE workspace_id = $1`, [wsAId])).rows[0].count,
      10
    );
    const countLinesAfter = parseInt(
      (await pool.query(`SELECT COUNT(*) FROM accounting_invoice_lines`)).rows[0].count,
      10
    );

    assert.equal(countInvoicesAfter, countInvoicesBefore, "Invoice count must not change on error");
    assert.equal(countLinesAfter, countLinesBefore, "Line items count must not change on error");
  });
});
