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

// Dynamic imports
const {
  createInvoice,
  updateDraftInvoice,
  issueDraftInvoice,
  getInvoiceById,
  getPublicInvoiceByShareToken,
  listInvoices,
} = await import("../src/lib/accounting/invoices.ts");

const { recordPayment } = await import("../src/lib/accounting/payments.ts");
const { seedDefaultChartOfAccounts, getFinancialAccountByCode } = await import("../src/lib/accounting/accounts.ts");
const { createContact } = await import("../src/lib/accounting/contacts.ts");

test("Accounting Invoices: Complete Draft, Lifecycle, Item Snapshots, Concurrency, and Detail View", async (t) => {
  let userId, wsId, contactId, bankAccId, arAccId, revAccId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    assert(userRes.rows.length > 0, "A user is required for test");
    userId = userRes.rows[0].id;

    // Create unique workspace
    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Invoice Detail WS ${Date.now()}', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [userId]
    );
    wsId = wsRes.rows[0].id;

    // Seed chart of accounts
    await seedDefaultChartOfAccounts(wsId);
    const bankAcc = await getFinancialAccountByCode(wsId, "1020");
    const arAcc = await getFinancialAccountByCode(wsId, "1200");
    const revAcc = await getFinancialAccountByCode(wsId, "4000");

    assert(bankAcc && arAcc && revAcc, "Standard accounts must exist");
    bankAccId = bankAcc.id;
    arAccId = arAcc.id;
    revAccId = revAcc.id;

    // Create customer through existing contact logic (no lead required)
    const contact = await createContact({
      workspaceId: wsId,
      name: "Global Tech Services",
      type: "CUSTOMER",
      email: "billing@globaltech.io",
      phone: "+919876543210",
      address: "Suite 404, Cyber Towers, Hyderabad",
    });
    contactId = contact.id;
  });

  t.after(async () => {
    if (wsId) {
      await pool.query(`DELETE FROM accounting_invoice_lines WHERE invoice_id IN (SELECT id FROM accounting_invoices WHERE workspace_id = $1)`, [wsId]);
      await pool.query(`DELETE FROM accounting_payment_allocations WHERE invoice_id IN (SELECT id FROM accounting_invoices WHERE workspace_id = $1)`, [wsId]);
      await pool.query(`DELETE FROM accounting_payments WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_invoices WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [wsId]);
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_contacts WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsId]);
    }
    await pool.end();
  });

  let draftInvoiceId;

  await t.test("1. Save as Draft: persists with status DRAFT and creates NO journal entries or balance changes", async () => {
    // 5 items @ ₹1,000 each = ₹5,000 (500000 minor)
    const { invoice, lines } = await createInvoice({
      workspaceId: wsId,
      contactId,
      issueDate: "2026-10-22",
      dueDate: "2026-11-21",
      status: "DRAFT",
      notes: "Payment due within 30 days. Transfer to HDFC Bank.",
      terms: "Net 30",
      internalNotes: "VIP client. Follow up with account manager before reminders.",
      lines: [
        {
          description: "Cloud Architecture Consulting",
          quantity: 5,
          unitPriceMinor: 100000, // ₹1,000.00
        },
      ],
      userId,
    });

    draftInvoiceId = invoice.id;
    assert.equal(invoice.status, "DRAFT");
    assert.equal(Number(invoice.total_minor), 500000); // 5 x 1000 = 5000
    assert.equal(Number(invoice.subtotal_minor), 500000);
    assert.equal(Number(invoice.amount_paid_minor), 0);
    assert.equal(Number(invoice.amount_due_minor), 500000);
    assert.equal(invoice.posted_journal_entry_id, null, "Draft must have no posted journal entry");
    assert.equal(lines.length, 1);
    assert.equal(lines[0].description, "Cloud Architecture Consulting");
    assert.equal(Number(lines[0].quantity), 5);
    assert.equal(Number(lines[0].unit_price_minor), 100000);
    assert.equal(Number(lines[0].total_minor), 500000);

    // Verify customer receivable balance has NOT changed
    const contactRes = await pool.query(`SELECT total_receivable_minor FROM accounting_contacts WHERE id = $1`, [contactId]);
    assert.equal(Number(contactRes.rows[0].total_receivable_minor), 0, "Draft invoice must not increase customer receivable");

    // Verify no journal entries posted in workspace
    const jeRes = await pool.query(`SELECT COUNT(*) as count FROM accounting_journal_entries WHERE workspace_id = $1`, [wsId]);
    assert.equal(Number(jeRes.rows[0].count), 0, "Draft invoice must not post any general ledger entry");
  });

  await t.test("2. Detail view: returns canonical invoice, lines, contact details, and payment history", async () => {
    const detail = await getInvoiceById(wsId, draftInvoiceId);
    assert.ok(detail, "Invoice detail must exist");
    assert.equal(detail.invoice.id, draftInvoiceId);
    assert.equal(detail.invoice.status, "DRAFT");
    assert.equal(detail.invoice.notes, "Payment due within 30 days. Transfer to HDFC Bank.");
    assert.equal(detail.invoice.internal_notes, "VIP client. Follow up with account manager before reminders.");

    // Contact details populated
    assert.ok(detail.contact, "Contact details must be populated");
    assert.equal(detail.contact.name, "Global Tech Services");
    assert.equal(detail.contact.email, "billing@globaltech.io");
    assert.equal(detail.contact.address, "Suite 404, Cyber Towers, Hyderabad");

    // Lines populated
    assert.equal(detail.lines.length, 1);
    assert.equal(Number(detail.lines[0].total_minor), 500000);

    // Payment history is empty for draft
    assert.equal(detail.payments.length, 0);
  });

  await t.test("3. Edit Draft: update lines, quantities, prices, notes without posting", async () => {
    // Add second item: 2 x ₹2,500 = ₹5,000. Total becomes ₹10,000 (1000000 minor)
    const { invoice: updated, lines: updatedLines } = await updateDraftInvoice({
      workspaceId: wsId,
      invoiceId: draftInvoiceId,
      notes: "Updated terms: 50% advance preferred",
      internalNotes: "Internal note updated: client requested revised line item",
      lines: [
        {
          description: "Cloud Architecture Consulting",
          quantity: 5,
          unitPriceMinor: 100000, // 5 x 1000 = 5000
        },
        {
          description: "DevOps Implementation Sprint",
          quantity: 2,
          unitPriceMinor: 250000, // 2 x 2500 = 5000
        },
      ],
      userId,
    });

    assert.equal(updated.status, "DRAFT");
    assert.equal(Number(updated.total_minor), 1000000); // ₹10,000
    assert.equal(Number(updated.amount_due_minor), 1000000);
    assert.equal(updated.notes, "Updated terms: 50% advance preferred");
    assert.equal(updated.internal_notes, "Internal note updated: client requested revised line item");
    assert.equal(updatedLines.length, 2);

    // Verify still no GL entries
    const jeRes = await pool.query(`SELECT COUNT(*) as count FROM accounting_journal_entries WHERE workspace_id = $1`, [wsId]);
    assert.equal(Number(jeRes.rows[0].count), 0, "Editing draft must not post any general ledger entry");
  });

  await t.test("4. Public Share Link: never exposes internal notes or private workspace data", async () => {
    const inv = (await pool.query(`SELECT share_token FROM accounting_invoices WHERE id = $1`, [draftInvoiceId])).rows[0];
    const pub = await getPublicInvoiceByShareToken(inv.share_token);

    assert.ok(pub, "Public share link must resolve");
    assert.equal(pub.invoice.id, draftInvoiceId);
    assert.equal(Number(pub.invoice.total_minor), 1000000);
    assert.equal(pub.invoice.notes, "Updated terms: 50% advance preferred");
    // Ensure internal notes is NOT exposed in public invoice
    assert.equal((pub.invoice).internal_notes, undefined, "Public invoice must NEVER expose internal_notes");
  });

  await t.test("5. Issue Draft Invoice: atomically posts AR Dr (1200), Revenue Cr (4000) and increments contact receivable", async () => {
    const { invoice: issued } = await issueDraftInvoice(wsId, draftInvoiceId, userId);

    assert.equal(issued.status, "ISSUED");
    assert.ok(issued.posted_journal_entry_id, "Issued invoice must have posted journal entry");

    // Verify GL entries: AR Dr 10,000, Revenue Cr 10,000
    const jeLines = (
      await pool.query(
        `SELECT jl.*, fa.code FROM accounting_journal_lines jl
         JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
         WHERE jl.journal_entry_id = $1 ORDER BY jl.debit_minor DESC`,
        [issued.posted_journal_entry_id]
      )
    ).rows;

    assert.equal(jeLines.length, 2);
    assert.equal(jeLines[0].code, "1200"); // AR
    assert.equal(Number(jeLines[0].debit_minor), 1000000);
    assert.equal(jeLines[1].code, "4000"); // Revenue
    assert.equal(Number(jeLines[1].credit_minor), 1000000);

    // Verify customer receivable balance updated
    const contactRes = await pool.query(`SELECT total_receivable_minor FROM accounting_contacts WHERE id = $1`, [contactId]);
    assert.equal(Number(contactRes.rows[0].total_receivable_minor), 1000000);
  });

  await t.test("6. Protection against rewriting issued invoices: updateDraftInvoice must reject non-draft", async () => {
    await assert.rejects(
      async () => {
        await updateDraftInvoice({
          workspaceId: wsId,
          invoiceId: draftInvoiceId,
          notes: "Attempting illegal rewrite of issued invoice",
          userId,
        });
      },
      /Only DRAFT invoices can be edited/,
      "Must reject modifying an issued invoice"
    );
  });

  await t.test("7. Partial payment collection: status becomes PARTIALLY_PAID and balance due decreases", async () => {
    // Collect ₹4,000 of the ₹10,000 invoice
    const payRes = await recordPayment({
      workspaceId: wsId,
      invoiceId: draftInvoiceId,
      contactId,
      financialAccountId: bankAccId,
      amountMinor: 400000,
      paymentMethod: "BANK_TRANSFER",
      referenceNumber: "NEFT-12345",
      notes: "First installment ₹4,000",
      userId,
    });

    assert.ok(payRes.payment);
    const detail = await getInvoiceById(wsId, draftInvoiceId);
    assert.equal(detail.invoice.status, "PARTIALLY_PAID");
    assert.equal(Number(detail.invoice.amount_paid_minor), 400000);
    assert.equal(Number(detail.invoice.amount_due_minor), 600000); // ₹6,000 remaining

    // Verify payment history in detail view
    assert.equal(detail.payments.length, 1);
    assert.equal(detail.payments[0].reference_number, "NEFT-12345");
    assert.equal(Number(detail.payments[0].allocated_minor), 400000);
  });

  await t.test("8. Full payment settlement: status becomes PAID and no further payments accepted", async () => {
    // Collect remaining ₹6,000
    await recordPayment({
      workspaceId: wsId,
      invoiceId: draftInvoiceId,
      contactId,
      financialAccountId: bankAccId,
      amountMinor: 600000,
      paymentMethod: "UPI",
      referenceNumber: "UPI-99988",
      notes: "Final settlement ₹6,000",
      userId,
    });

    const detail = await getInvoiceById(wsId, draftInvoiceId);
    assert.equal(detail.invoice.status, "PAID");
    assert.equal(Number(detail.invoice.amount_paid_minor), 1000000);
    assert.equal(Number(detail.invoice.amount_due_minor), 0);

    // 2 payments in history
    assert.equal(detail.payments.length, 2);

    // Attempting further payment collection on fully paid invoice must be rejected
    await assert.rejects(
      async () => {
        await recordPayment({
          workspaceId: wsId,
          invoiceId: draftInvoiceId,
          contactId,
          financialAccountId: bankAccId,
          amountMinor: 100000,
          userId,
        });
      },
      /Invoice .* is already fully paid/
    );
  });

  await t.test("9. Concurrency: 5 concurrent invoice creations generate strictly unique sequential numbers", async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      createInvoice({
        workspaceId: wsId,
        contactId,
        dueDate: "2026-11-30",
        status: "DRAFT",
        lines: [{ description: `Concurrent Item ${i}`, quantity: 1, unitPriceMinor: 10000 }],
        userId,
      })
    );

    const results = await Promise.all(promises);
    const invoiceNumbers = results.map((r) => r.invoice.invoice_number);
    const uniqueNumbers = new Set(invoiceNumbers);

    assert.equal(uniqueNumbers.size, 5, `All concurrent invoice numbers must be unique: ${invoiceNumbers.join(", ")}`);
    for (const num of invoiceNumbers) {
      assert.match(num, /^INV-\d{4}-\d{4}$/, `Invoice number ${num} must match format INV-YYYY-XXXX`);
    }
  });
});
