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

const {
  createInvoice,
  updateDraftInvoice,
  issueDraftInvoice,
  getInvoiceById,
  listInvoices,
  getInvoiceSettings,
  updateInvoiceSettings,
  createDirectSale,
  convertDirectSaleToInvoice,
  getPublicInvoiceByShareToken,
} = await import("../src/lib/accounting/invoices.ts");

const { recordPayment } = await import("../src/lib/accounting/payments.ts");
const { seedDefaultChartOfAccounts, listFinancialAccounts } = await import("../src/lib/accounting/accounts.ts");
const { generateInvoiceHtml } = await import("../src/lib/accounting/invoicePdfTemplate.ts");

test("Enhanced Invoices: Branding, Snapshots, Warranty, Payments & Direct Sales Verification", async (t) => {
  let userAId, userBId, wsAId, wsBId;
  let contactAId, cashAccountAId, bankAccountAId;

  t.before(async () => {
    // 1. Obtain test users
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Must have at least two users for isolation tests");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // 2. Create test Workspace A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Invoice Test Workspace A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsAId, userAId]
    );
    await seedDefaultChartOfAccounts(wsAId, pool);

    // 3. Create test Workspace B (for permission & isolation checks)
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Invoice Test Workspace B', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsBId, userBId]
    );
    await seedDefaultChartOfAccounts(wsBId, pool);

    // 4. Retrieve payment accounts for WS A
    const accountsA = await listFinancialAccounts(wsAId);
    const cash = accountsA.find((a) => a.code === "1010");
    const bank = accountsA.find((a) => a.code === "1020");
    assert(cash && bank, "Workspace A must have Cash (1010) and Bank (1020) accounts");
    cashAccountAId = cash.id;
    bankAccountAId = bank.id;

    // 5. Create test customer contact in WS A
    const contactRes = await pool.query(
      `INSERT INTO accounting_contacts (workspace_id, name, type, email, phone, address, is_active)
       VALUES ($1, 'Acme Retail Customer', 'CUSTOMER', 'customer@acme.com', '+91 98765 11111', '123 MG Road, Bangalore', true)
       RETURNING id`,
      [wsAId]
    );
    contactAId = contactRes.rows[0].id;
  });

  t.after(async () => {
    // Clean up created workspaces in reverse dependency order
    const cleanWorkspace = async (wsId) => {
      if (!wsId) return;
      await pool.query(
        `DELETE FROM accounting_payment_allocations WHERE payment_id IN (SELECT id FROM accounting_payments WHERE workspace_id = $1)`,
        [wsId]
      );
      await pool.query(`DELETE FROM accounting_payments WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_sales WHERE workspace_id = $1`, [wsId]);
      await pool.query(
        `DELETE FROM accounting_invoice_lines WHERE invoice_id IN (SELECT id FROM accounting_invoices WHERE workspace_id = $1)`,
        [wsId]
      );
      await pool.query(`DELETE FROM accounting_invoices WHERE workspace_id = $1`, [wsId]);
      await pool.query(
        `DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`,
        [wsId]
      );
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_contacts WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsId]);
    };

    await cleanWorkspace(wsAId);
    await cleanWorkspace(wsBId);

    await pool.end();
    const { pool: sharedPool } = await import("../src/lib/db/index.ts");
    await sharedPool.end();
  });

  // TEST 1: Business Branding & Invoice Settings Persistence
  await t.test("1. Business branding and settings persistence & isolation", async () => {
    // Initial fetch should fallback to workspace name
    const initialSettings = await getInvoiceSettings(wsAId);
    assert.equal(initialSettings.business_name, "Invoice Test Workspace A");
    assert.equal(initialSettings.invoice_prefix, "INV");

    // Update settings with complete customer branding
    const updated = await updateInvoiceSettings(wsAId, {
      business_name: "Apex Electronics Pvt Ltd",
      logo_url: "https://example.com/branding/apex-logo.png",
      address: "Tower 4, Electronic City, Bengaluru, KA 560100",
      phone: "+91 80 4455 6677",
      email: "billing@apexelectronics.com",
      website: "https://apexelectronics.com",
      tax_id: "29AABCA1234A1Z5",
      tax_label: "GSTIN",
      default_notes: "Thank you for shopping with Apex! For NEFT/RTGS: Bank A/C 9988776655.",
      default_terms: "Net 15",
      default_warranty_terms: "Standard 1-year replacement warranty on manufacturing faults.",
      invoice_prefix: "APEX",
      next_sequence: 101,
    });

    assert.equal(updated.business_name, "Apex Electronics Pvt Ltd");
    assert.equal(updated.logo_url, "https://example.com/branding/apex-logo.png");
    assert.equal(updated.tax_id, "29AABCA1234A1Z5");
    assert.equal(updated.invoice_prefix, "APEX");
    assert.equal(updated.default_terms, "Net 15");

    // Workspace B settings must remain isolated
    const wsBSettings = await getInvoiceSettings(wsBId);
    assert.equal(wsBSettings.business_name, "Invoice Test Workspace B");
    assert.equal(wsBSettings.invoice_prefix, "INV");
    assert.equal(wsBSettings.logo_url, null);
  });

  // TEST 2: Invoice Creation with Warranty Information & Models
  await t.test("2. Line items with Model, SKU, Serial Number, and Warranty sections", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

    const { invoice, lines } = await createInvoice({
      workspaceId: wsAId,
      contactId: contactAId,
      issueDate: today,
      dueDate,
      status: "DRAFT",
      notes: "Handle with care - fragile electronics",
      terms: "Net 15",
      internalNotes: "VIP Customer - approved by Sales Manager",
      lines: [
        {
          description: "UltraBook Pro Laptop 16-inch",
          quantity: 1,
          unitPriceMinor: 8500000, // ₹85,000
          model: "UB-PRO-16-M3",
          sku: "LAP-8500",
          serialNumber: "SN-2026-998877",
          warrantyType: "MANUFACTURER",
          warrantyDurationMonths: 24,
          warrantyStartDate: today,
          warrantyCoverage: "Hardware defects and battery replacement",
          warrantyExclusions: "Liquid ingress and accidental drops",
          warrantyContact: "support@laptopbrand.com or 1800-444-123",
        },
        {
          description: "USB-C Fast Charging Hub",
          quantity: 2,
          unitPriceMinor: 250000, // ₹2,500 each = ₹5,000
          sku: "ACC-HUB-01",
          warrantyType: "SELLER",
          warrantyDurationMonths: 6,
          warrantyStartDate: today,
          warrantyCoverage: "Overvoltage failure",
          warrantyContact: "Apex Support Desk",
        },
        {
          description: "Annual Device Setup & Onsite Tuneup",
          quantity: 1,
          unitPriceMinor: 300000, // ₹3,000
          warrantyType: "NONE", // Services have no warranty
        },
      ],
      userId: userAId,
    });

    assert.equal(invoice.status, "DRAFT");
    assert.equal(Number(invoice.total_minor), 8500000 + 500000 + 300000); // ₹93,000
    assert.equal(Number(invoice.amount_due_minor), 9300000);
    assert.equal(Number(invoice.amount_paid_minor), 0);
    assert.equal(invoice.internal_notes, "VIP Customer - approved by Sales Manager");

    assert.equal(lines.length, 3);
    assert.equal(lines[0].model, "UB-PRO-16-M3");
    assert.equal(lines[0].serial_number, "SN-2026-998877");
    assert.equal(lines[0].warranty_type, "MANUFACTURER");
    assert.equal(lines[0].warranty_duration_months, 24);
    assert(lines[0].warranty_end_date, "Warranty end date should be computed");

    assert.equal(lines[2].warranty_type, "NONE");
    assert.equal(lines[2].warranty_duration_months, null);
  });

  // TEST 3: Snapshot Immutability upon Issuance
  await t.test("3. Seller & Customer Snapshots are frozen at issuance and never mutated", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Create and issue invoice
    const { invoice: issuedInv } = await createInvoice({
      workspaceId: wsAId,
      contactId: contactAId,
      issueDate: today,
      dueDate: today,
      status: "ISSUED",
      lines: [
        {
          description: "Precision Test Instrument",
          quantity: 1,
          unitPriceMinor: 1000000, // ₹10,000
        },
      ],
      userId: userAId,
    });

    assert.equal(issuedInv.status, "ISSUED");
    assert(issuedInv.seller_snapshot, "Seller snapshot must exist on issued invoice");
    assert.equal(issuedInv.seller_snapshot.business_name, "Apex Electronics Pvt Ltd");
    assert.equal(issuedInv.seller_snapshot.tax_id, "29AABCA1234A1Z5");
    assert.equal(issuedInv.seller_snapshot.logo_url, "https://example.com/branding/apex-logo.png");

    assert(issuedInv.customer_snapshot, "Customer snapshot must exist on issued invoice");
    assert.equal(issuedInv.customer_snapshot.name, "Acme Retail Customer");
    assert.equal(issuedInv.customer_snapshot.email, "customer@acme.com");

    // 2. Now change business settings
    await updateInvoiceSettings(wsAId, {
      business_name: "Completely Different Company Name",
      logo_url: null,
      tax_id: "00XXXXX0000X0Z0",
    });

    // 3. Now change contact's name and email in contacts table
    await pool.query(
      `UPDATE accounting_contacts SET name = 'Renamed Contact', email = 'newemail@acme.com' WHERE id = $1`,
      [contactAId]
    );

    // 4. Retrieve the issued invoice from database and verify it was NOT rewritten
    const retrieved = await getInvoiceById(wsAId, issuedInv.id);
    assert(retrieved, "Invoice must be retrievable");
    assert.equal(
      retrieved.invoice.seller_snapshot?.business_name,
      "Apex Electronics Pvt Ltd",
      "Historical seller snapshot business name must NOT be rewritten"
    );
    assert.equal(
      retrieved.invoice.seller_snapshot?.tax_id,
      "29AABCA1234A1Z5",
      "Historical seller snapshot tax ID must NOT be rewritten"
    );
    assert.equal(
      retrieved.invoice.seller_snapshot?.logo_url,
      "https://example.com/branding/apex-logo.png",
      "Historical seller logo must NOT be rewritten"
    );
    assert.equal(
      retrieved.invoice.customer_snapshot?.name,
      "Acme Retail Customer",
      "Historical customer snapshot name must NOT be rewritten"
    );

    // Revert settings and contact for subsequent tests
    await updateInvoiceSettings(wsAId, {
      business_name: "Apex Electronics Pvt Ltd",
      logo_url: "https://example.com/branding/apex-logo.png",
      tax_id: "29AABCA1234A1Z5",
      invoice_prefix: "APEX",
    });
    await pool.query(
      `UPDATE accounting_contacts SET name = 'Acme Retail Customer', email = 'customer@acme.com' WHERE id = $1`,
      [contactAId]
    );
  });

  // TEST 4: Unique Numbering with Configured Prefix & Concurrency Guard
  await t.test("4. Safe sequential invoice numbering with zero collision under concurrent issue", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Fire 5 concurrent invoice creations
    const promises = Array.from({ length: 5 }).map((_, i) =>
      createInvoice({
        workspaceId: wsAId,
        contactId: contactAId,
        issueDate: today,
        dueDate: today,
        status: "DRAFT",
        lines: [
          {
            description: `Concurrent Test Item ${i + 1}`,
            quantity: 1,
            unitPriceMinor: 100000,
          },
        ],
        userId: userAId,
      })
    );

    const results = await Promise.all(promises);
    const invoiceNumbers = results.map((r) => r.invoice.invoice_number);

    // Verify all start with configured prefix
    const year = new Date().getFullYear().toString();
    for (const num of invoiceNumbers) {
      assert(
        num.startsWith(`APEX-${year}-`),
        `Invoice number ${num} must start with configured prefix APEX-${year}-`
      );
    }

    // Verify all 5 are completely unique (no collision)
    const uniqueSet = new Set(invoiceNumbers);
    assert.equal(uniqueSet.size, 5, "All concurrently generated invoice numbers must be unique");
  });

  // TEST 5: Keep Payments Accurate - Partial & Full Payments (₹10,000 invoice with ₹4,000 received -> ₹6,000 outstanding)
  await t.test("5. Payment precision: ₹10,000 invoice with ₹4,000 received leaves ₹6,000 balance without double revenue", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Create and issue invoice for ₹10,000
    const { invoice: inv10k } = await createInvoice({
      workspaceId: wsAId,
      contactId: contactAId,
      issueDate: today,
      dueDate: today,
      status: "ISSUED",
      lines: [
        {
          description: "Enterprise Server Appliance",
          quantity: 1,
          unitPriceMinor: 1000000, // ₹10,000 = 1000000 minor units
        },
      ],
      userId: userAId,
    });

    assert.equal(Number(inv10k.total_minor), 1000000);
    assert.equal(Number(inv10k.amount_paid_minor), 0);
    assert.equal(Number(inv10k.amount_due_minor), 1000000);
    assert.equal(inv10k.status, "ISSUED");

    // Check contact receivable is ₹10,000
    const contactCheck1 = await pool.query(`SELECT total_receivable_minor FROM accounting_contacts WHERE id = $1`, [contactAId]);
    const receivableBefore = Number(contactCheck1.rows[0].total_receivable_minor);

    // Check revenue account 4000
    const revCheck1 = await pool.query(
      `SELECT current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '4000'`,
      [wsAId]
    );
    const revenueBefore = Number(revCheck1.rows[0].current_balance_minor);

    // 2. Record Partial Payment of ₹4,000 (400000 minor) to Bank Account
    const pay1 = await recordPayment({
      workspaceId: wsAId,
      contactId: contactAId,
      financialAccountId: bankAccountAId,
      amountMinor: 400000,
      paymentMethod: "BANK_TRANSFER",
      allocations: [{ invoiceId: inv10k.id, amountMinor: 400000 }],
      userId: userAId,
    });
    assert(pay1.payment, "Payment 1 recorded");

    // Fetch invoice status after partial payment
    const partialInvData = await getInvoiceById(wsAId, inv10k.id);
    assert(partialInvData, "Invoice must exist");
    const partialInv = partialInvData.invoice;
    assert.equal(partialInv.status, "PARTIALLY_PAID", "Invoice status must be PARTIALLY_PAID");
    assert.equal(Number(partialInv.amount_paid_minor), 400000, "Paid amount must be ₹4,000");
    assert.equal(Number(partialInv.amount_due_minor), 600000, "Outstanding balance must be exactly ₹6,000");

    // Verify contact receivable reduced by ₹4,000
    const contactCheck2 = await pool.query(`SELECT total_receivable_minor FROM accounting_contacts WHERE id = $1`, [contactAId]);
    assert.equal(Number(contactCheck2.rows[0].total_receivable_minor), receivableBefore - 400000);

    // Verify revenue was NOT re-posted on payment collection!
    const revCheck2 = await pool.query(
      `SELECT current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '4000'`,
      [wsAId]
    );
    assert.equal(Number(revCheck2.rows[0].current_balance_minor), revenueBefore, "Revenue must not change on collection");

    // 3. Record Second Payment of ₹6,000 (600000 minor) to settle in full
    const pay2 = await recordPayment({
      workspaceId: wsAId,
      contactId: contactAId,
      financialAccountId: bankAccountAId,
      amountMinor: 600000,
      paymentMethod: "BANK_TRANSFER",
      allocations: [{ invoiceId: inv10k.id, amountMinor: 600000 }],
      userId: userAId,
    });
    assert(pay2.payment, "Payment 2 recorded");

    const settledInvData = await getInvoiceById(wsAId, inv10k.id);
    assert(settledInvData, "Invoice must exist");
    const settledInv = settledInvData.invoice;
    assert.equal(settledInv.status, "PAID", "Invoice status must be PAID");
    assert.equal(Number(settledInv.amount_paid_minor), 1000000, "Paid amount must be ₹10,000");
    assert.equal(Number(settledInv.amount_due_minor), 0, "Outstanding balance must be 0");

    // Verify revenue STILL unchanged
    const revCheck3 = await pool.query(
      `SELECT current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = '4000'`,
      [wsAId]
    );
    assert.equal(Number(revCheck3.rows[0].current_balance_minor), revenueBefore, "Revenue must not be duplicated on settlement");
  });

  // TEST 6: Connect Walk-in Direct Sale & Convert to Invoice without duplicate revenue
  await t.test("6. Walk-in Direct Sale conversion reconciles and does NOT post duplicate journal entries", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Count existing journal entries in WS A before direct sale
    const jeCountRes1 = await pool.query(
      `SELECT COUNT(*) as count FROM accounting_journal_entries WHERE workspace_id = $1`,
      [wsAId]
    );
    const initialJEs = parseInt(jeCountRes1.rows[0].count, 10);

    // 1. Record Walk-in Direct Sale of ₹15,000 (1500000 minor) paid in Cash
    const { sale } = await createDirectSale({
      workspaceId: wsAId,
      contactId: contactAId,
      date: today,
      amountMinor: 1500000,
      financialAccountId: cashAccountAId,
      paymentMethod: "CASH",
      notes: "Walk-in over the counter sale of 4K monitor",
      userId: userAId,
    });

    assert.equal(sale.status, "COMPLETED");
    assert.equal(Number(sale.total_minor), 1500000);
    assert.equal(Number(sale.paid_minor), 1500000);

    // Check that direct sale created exactly 1 journal entry (Cash Dr, Revenue Cr)
    const jeCountRes2 = await pool.query(
      `SELECT COUNT(*) as count FROM accounting_journal_entries WHERE workspace_id = $1`,
      [wsAId]
    );
    const jesAfterSale = parseInt(jeCountRes2.rows[0].count, 10);
    assert.equal(jesAfterSale, initialJEs + 1, "Direct sale must post exactly 1 journal entry");

    // 2. Conversion validation: item lines total must reconcile with direct sale total
    await assert.rejects(
      async () => {
        await convertDirectSaleToInvoice({
          workspaceId: wsAId,
          saleId: sale.id,
          lines: [
            {
              description: "4K Monitor",
              quantity: 1,
              unitPriceMinor: 1000000, // Discrepancy: ₹10,000 instead of ₹15,000
            },
          ],
          userId: userAId,
        });
      },
      /must exactly match direct sale total/i,
      "Conversion must reject when line totals do not reconcile"
    );

    // 3. Convert successfully with itemised warranty details
    const { invoice: convertedInv, lines: convertedLines, sale: updatedSale } = await convertDirectSaleToInvoice({
      workspaceId: wsAId,
      saleId: sale.id,
      contactId: contactAId,
      notes: "Tax Invoice for counter sale",
      lines: [
        {
          description: "Dell UltraSharp 32-inch 4K Monitor",
          quantity: 1,
          unitPriceMinor: 1500000,
          model: "U3223QE",
          sku: "MON-DELL-32",
          serialNumber: "SN-MON-998811",
          warrantyType: "MANUFACTURER",
          warrantyDurationMonths: 36,
          warrantyStartDate: today,
          warrantyCoverage: "Zero bright pixel defect guarantee and 3-year advanced exchange",
          warrantyContact: "1800-425-4026",
        },
      ],
      userId: userAId,
    });

    assert.equal(convertedInv.status, "PAID", "Converted invoice must be marked PAID");
    assert.equal(Number(convertedInv.total_minor), 1500000);
    assert.equal(Number(convertedInv.amount_paid_minor), 1500000);
    assert.equal(Number(convertedInv.amount_due_minor), 0);
    assert.equal(convertedInv.direct_sale_id, sale.id, "Invoice must be linked to direct sale");
    assert.equal(updatedSale.invoice_id, convertedInv.id, "Direct sale must be linked to invoice");

    assert.equal(convertedLines.length, 1);
    assert.equal(convertedLines[0].warranty_type, "MANUFACTURER");
    assert.equal(convertedLines[0].warranty_duration_months, 36);

    // CRUCIAL: Check that converting did NOT create a second journal entry!
    const jeCountRes3 = await pool.query(
      `SELECT COUNT(*) as count FROM accounting_journal_entries WHERE workspace_id = $1`,
      [wsAId]
    );
    const jesAfterConversion = parseInt(jeCountRes3.rows[0].count, 10);
    assert.equal(
      jesAfterConversion,
      jesAfterSale,
      "Converting direct sale to invoice must NOT create another journal entry or duplicate revenue"
    );

    // Cannot convert the same direct sale twice
    await assert.rejects(
      async () => {
        await convertDirectSaleToInvoice({
          workspaceId: wsAId,
          saleId: sale.id,
          userId: userAId,
        });
      },
      /already linked to invoice/i,
      "Cannot convert already-invoiced direct sale"
    );
  });

  // TEST 7: Professional PDF / HTML Generator Verification (Multipage & Long Warranty)
  await t.test("7. Professional clean white A4 PDF/HTML document generation", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Create a 25-item multipage invoice with long descriptions
    const manyLines = Array.from({ length: 25 }).map((_, i) => ({
      description: `Component Hardware Module Item #${i + 1} with extended industrial description and specifications`,
      quantity: 2,
      unitPriceMinor: 50000,
      model: `MOD-${i + 1}`,
      sku: `SKU-${i + 1}`,
      serialNumber: `SN-MOD-${i + 1}`,
      warrantyType: i % 2 === 0 ? "SELLER" : "NONE",
      warrantyDurationMonths: i % 2 === 0 ? 12 : undefined,
      warrantyCoverage: i % 2 === 0 ? "Standard factory replacement" : undefined,
    }));

    const { invoice: multiInv, lines: multiLines } = await createInvoice({
      workspaceId: wsAId,
      contactId: contactAId,
      issueDate: today,
      dueDate: today,
      status: "ISSUED",
      notes: "Please transfer payment to Apex Bank Account.\nIFSC: HDFC0001234",
      warrantyTerms: "All goods inspected before dispatch. Claims must be filed within 14 days of fault detection.",
      internalNotes: "CONFIDENTIAL: Internal margin 22% - do not disclose to customer.",
      lines: manyLines,
      userId: userAId,
    });

    const settings = await getInvoiceSettings(wsAId);
    const seller = multiInv.seller_snapshot || settings;
    const customer = multiInv.customer_snapshot;

    const html = generateInvoiceHtml(multiInv, multiLines, seller, customer, []);

    // Assertions on the generated HTML
    assert(html.includes("<!DOCTYPE html>"), "Must be a valid HTML document");
    assert(html.includes("@page {"), "Must define print page margins");
    assert(html.includes("display: table-header-group"), "Must repeat table headers on print");
    assert(html.includes("page-break-inside: avoid"), "Must prevent row clipping");
    assert(html.includes("Apex Electronics Pvt Ltd"), "Must contain customer's own company branding");
    assert(html.includes("29AABCA1234A1Z5"), "Must contain business GSTIN");
    assert(html.includes("Acme Retail Customer"), "Must contain customer billing details");
    assert(html.includes("Hardware Module Item #25"), "Must render all 25 items");
    assert(html.includes("🛡️ Seller Warranty"), "Must render warranty callouts");
    assert(html.includes("Claims must be filed within 14 days"), "Must render warranty policy terms");

    // Critical privacy assertion: internalNotes MUST NOT be in the rendered document!
    assert(!html.includes("CONFIDENTIAL: Internal margin"), "Internal notes must NEVER appear in printable invoice HTML");
  });

  // TEST 8: Sharing & Unguessable Revocable Token Privacy
  await t.test("8. Share token access is authorized, unguessable, and strictly omits internal notes", async () => {
    const today = new Date().toISOString().slice(0, 10);

    const { invoice: secretInv } = await createInvoice({
      workspaceId: wsAId,
      contactId: contactAId,
      issueDate: today,
      dueDate: today,
      status: "ISSUED",
      notes: "Public note for customer",
      internalNotes: "PRIVATE INVESTIGATION NOTE: Customer has slow payment history",
      lines: [
        {
          description: "Consulting Hour",
          quantity: 1,
          unitPriceMinor: 500000,
        },
      ],
      userId: userAId,
    });

    assert(secretInv.share_token, "Invoice must have a secure share token");
    assert(secretInv.share_token.length >= 32, "Share token must be at least 32 characters (16 random bytes hex)");

    // Retrieve via public function
    const publicData = await getPublicInvoiceByShareToken(secretInv.share_token);
    assert(publicData, "Public invoice must be retrievable with valid token");
    assert.equal(publicData.invoice.notes, "Public note for customer");

    // Internal notes must be completely omitted from public view object
    assert.equal(
      publicData.invoice.internal_notes,
      undefined,
      "Public invoice object must NOT contain internal_notes"
    );

    // Invalid token returns null
    const invalidTokenData = await getPublicInvoiceByShareToken("totally-fake-token-12345");
    assert.equal(invalidTokenData, null, "Invalid share token must return null");
  });
});
