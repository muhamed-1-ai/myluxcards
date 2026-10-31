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
const { createContact, listContacts, getContactById } = await import("../src/lib/accounting/contacts.ts");
const { createInvoice, updateDraftInvoice, issueDraftInvoice, getInvoiceById } = await import("../src/lib/accounting/invoices.ts");
const { seedDefaultChartOfAccounts } = await import("../src/lib/accounting/accounts.ts");

test("Accounting: Invoice Customers & People Connection End-to-End Verification", async (t) => {
  let userAId, userBId, wsAId, wsBId;
  const createdContactIds = [];
  const createdInvoiceIds = [];

  t.before(async () => {
    // 1. Obtain test users
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Must have at least two users for isolation tests");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // 2. Create unique test Workspace A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Invoice Customers Conn WS A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
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
       VALUES ($1, 'Invoice Customers Conn WS B', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
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
  });

  t.after(async () => {
    // Cleanup invoices & lines
    if (createdInvoiceIds.length > 0) {
      await pool.query(`DELETE FROM accounting_invoice_lines WHERE invoice_id = ANY($1::uuid[])`, [createdInvoiceIds]);
      await pool.query(`DELETE FROM accounting_invoices WHERE id = ANY($1::uuid[])`, [createdInvoiceIds]);
    }
    // Cleanup contacts
    if (createdContactIds.length > 0) {
      await pool.query(`DELETE FROM accounting_contacts WHERE id = ANY($1::uuid[])`, [createdContactIds]);
    }
    // Cleanup workspaces
    if (wsAId) {
      await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [wsAId]);
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]);
    }
    if (wsBId) {
      await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [wsBId]);
      await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]);
    }
    await pool.end();
    const { pool: sharedPool } = await import("../src/lib/db/index.ts");
    await sharedPool.end();
  });

  await t.test("1. A customer created in People can be selected in an invoice", async () => {
    // Create customer via People service
    const contact = await createContact({
      workspaceId: wsAId,
      name: "Al-Noor Electronics",
      type: "CUSTOMER",
      email: "info@alnoor.com",
      phone: "+91 98765 11111",
      address: "12 Commercial Street, Bangalore",
    });
    assert.ok(contact.id);
    createdContactIds.push(contact.id);

    // Verify contact listed in People
    const peopleList = await listContacts(wsAId);
    const found = peopleList.find((c) => c.id === contact.id);
    assert.ok(found, "Customer must appear in People list");
    assert.equal(found.name, "Al-Noor Electronics");

    // Create an invoice with this contact selected
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      contactId: contact.id,
      dueDate: "2026-11-30",
      status: "DRAFT",
      lines: [
        { description: "NFC Smart Cards Batch", quantity: 10, unitPriceMinor: 50000 },
      ],
      userId: userAId,
    });
    assert.ok(invoice.id);
    createdInvoiceIds.push(invoice.id);
    assert.equal(invoice.contact_id, contact.id, "Invoice must store selected contact ID");

    // Fetch invoice with full details
    const detail = await getInvoiceById(wsAId, invoice.id);
    assert.ok(detail);
    assert.ok(detail.contact, "Invoice must resolve contact details");
    assert.equal(detail.contact.name, "Al-Noor Electronics");
    assert.equal(detail.contact.email, "info@alnoor.com");
  });

  await t.test("2. A customer created from an invoice appears in People immediately with 0 balance", async () => {
    const entriesBefore = await pool.query(
      `SELECT COUNT(*) FROM accounting_journal_entries WHERE workspace_id = $1`,
      [wsAId]
    );

    // Simulate saving new customer from invoice
    const newCustomer = await createContact({
      workspaceId: wsAId,
      name: "Apex Global Logistics",
      type: "CUSTOMER",
      email: "billing@apexlogistics.io",
      phone: "+91 91234 56789",
      address: "Warehouse 4, Port Zone, Kochi",
    });
    assert.ok(newCustomer.id);
    createdContactIds.push(newCustomer.id);

    // Verify immediate visibility in People
    const people = await listContacts(wsAId);
    const apexInPeople = people.find((c) => c.id === newCustomer.id);
    assert.ok(apexInPeople, "Customer created from invoice must appear in People");
    assert.equal(Number(apexInPeople.total_receivable_minor), 0, "No initial debt on creation");
    assert.equal(Number(apexInPeople.total_payable_minor), 0, "No initial payable on creation");

    // Verify no unintended financial entries created
    const entriesAfter = await pool.query(
      `SELECT COUNT(*) FROM accounting_journal_entries WHERE workspace_id = $1`,
      [wsAId]
    );
    assert.equal(entriesBefore.rows[0].count, entriesAfter.rows[0].count, "Customer creation must not create journal entries");
  });

  await t.test("3. Selected customer persists after saving and reopening a draft", async () => {
    const customer = await getContactById(wsAId, createdContactIds[1]);
    assert.ok(customer);

    // Create draft invoice
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      contactId: customer.id,
      dueDate: "2026-12-15",
      status: "DRAFT",
      notes: "Draft for review",
      lines: [
        { description: "Custom Branding Setup", quantity: 1, unitPriceMinor: 250000 },
      ],
      userId: userAId,
    });
    createdInvoiceIds.push(invoice.id);

    // Reopen draft
    const reopened1 = await getInvoiceById(wsAId, invoice.id);
    assert.ok(reopened1);
    assert.equal(reopened1.invoice.contact_id, customer.id);
    assert.equal(reopened1.contact?.name, customer.name);

    // Update draft with line changes, keeping contact
    const { invoice: updated } = await updateDraftInvoice({
      workspaceId: wsAId,
      invoiceId: invoice.id,
      notes: "Updated draft notes",
      lines: [
        { description: "Custom Branding Setup", quantity: 1, unitPriceMinor: 250000 },
        { description: "Rush Delivery", quantity: 1, unitPriceMinor: 50000 },
      ],
      userId: userAId,
    });

    assert.equal(updated.contact_id, customer.id, "Contact ID must persist after draft update");
    const reopened2 = await getInvoiceById(wsAId, invoice.id);
    assert.equal(reopened2.invoice.contact_id, customer.id);
    assert.equal(reopened2.contact?.name, customer.name);
  });

  await t.test("4. Duplicate names remain distinguishable", async () => {
    // Create two contacts with same name "Rahul Sharma", but distinct phone/email
    const rahul1 = await createContact({
      workspaceId: wsAId,
      name: "Rahul Sharma",
      type: "CUSTOMER",
      phone: "+91 98111 22233",
      email: "rahul.sharma1@example.com",
    });
    createdContactIds.push(rahul1.id);

    const rahul2 = await createContact({
      workspaceId: wsAId,
      name: "Rahul Sharma",
      type: "CUSTOMER",
      phone: "+91 98444 55566",
      email: "rahul.sharma2@example.com",
    });
    createdContactIds.push(rahul2.id);

    assert.notEqual(rahul1.id, rahul2.id, "Different contacts with same name must have distinct IDs");

    // Invoices created for each Rahul Sharma
    const { invoice: inv1 } = await createInvoice({
      workspaceId: wsAId,
      contactId: rahul1.id,
      dueDate: "2026-11-20",
      status: "ISSUED",
      lines: [{ description: "Card Order A", quantity: 1, unitPriceMinor: 100000 }],
      userId: userAId,
    });
    createdInvoiceIds.push(inv1.id);

    const { invoice: inv2 } = await createInvoice({
      workspaceId: wsAId,
      contactId: rahul2.id,
      dueDate: "2026-11-20",
      status: "ISSUED",
      lines: [{ description: "Card Order B", quantity: 1, unitPriceMinor: 300000 }],
      userId: userAId,
    });
    createdInvoiceIds.push(inv2.id);

    // Verify balances track to the exact corresponding person
    const r1After = await getContactById(wsAId, rahul1.id);
    const r2After = await getContactById(wsAId, rahul2.id);

    assert.equal(Number(r1After.total_receivable_minor), 100000, "Rahul 1 balance must reflect Invoice 1");
    assert.equal(Number(r2After.total_receivable_minor), 300000, "Rahul 2 balance must reflect Invoice 2");
  });

  await t.test("5. Duplicate phone/email detection and supplier multi-role compatibility", async () => {
    // Existing customer with phone "+91 91234 56789" (Apex Global Logistics)
    await assert.rejects(
      async () => {
        await createContact({
          workspaceId: wsAId,
          name: "Apex Duplicate Attempt",
          type: "CUSTOMER",
          phone: "+91 91234 56789",
        });
      },
      (err) => {
        assert.equal(err.code, "DUPLICATE_CONTACT");
        assert.ok(err.existingContact);
        assert.equal(err.existingContact.name, "Apex Global Logistics");
        return true;
      }
    );

    // Create a vendor/supplier in People
    const vendorSupplier = await createContact({
      workspaceId: wsAId,
      name: "Global Chip Supplier Ltd",
      type: "VENDOR",
      phone: "+91 97777 88888",
      email: "sales@globalchips.com",
    });
    createdContactIds.push(vendorSupplier.id);

    // Set a supplier payable (e.g. from purchases or simulated)
    await pool.query(
      `UPDATE accounting_contacts SET total_payable_minor = 500000 WHERE id = $1`,
      [vendorSupplier.id]
    );

    // If this supplier also buys cards as a customer, select them on an invoice
    const { invoice: invSup } = await createInvoice({
      workspaceId: wsAId,
      contactId: vendorSupplier.id,
      dueDate: "2026-12-01",
      status: "ISSUED",
      lines: [{ description: "Prototype Samples", quantity: 2, unitPriceMinor: 75000 }],
      userId: userAId,
    });
    createdInvoiceIds.push(invSup.id);

    // Verify: supplier history & payable preserved, while receivable balance added
    const supplierAfter = await getContactById(wsAId, vendorSupplier.id);
    assert.equal(supplierAfter.type, "VENDOR", "Original type preserved");
    assert.equal(Number(supplierAfter.total_payable_minor), 500000, "Payable history preserved");
    assert.equal(Number(supplierAfter.total_receivable_minor), 150000, "Receivable from invoice added to Owed to Me");
  });

  await t.test("6. Customer billing details snapshot captured upon invoice issuance", async () => {
    const contact = await createContact({
      workspaceId: wsAId,
      name: "Snapshot Test Customer",
      type: "CUSTOMER",
      phone: "+91 95555 44444",
      email: "snapshot@client.com",
      address: "Original Address 100",
    });
    createdContactIds.push(contact.id);

    // Issue invoice
    const { invoice } = await createInvoice({
      workspaceId: wsAId,
      contactId: contact.id,
      dueDate: "2026-11-25",
      status: "ISSUED",
      lines: [{ description: "Branded NFC", quantity: 1, unitPriceMinor: 120000 }],
      userId: userAId,
    });
    createdInvoiceIds.push(invoice.id);

    // Verify snapshot was created
    const fetched = await getInvoiceById(wsAId, invoice.id);
    assert.ok(fetched.invoice.customer_snapshot);
    assert.equal(fetched.invoice.customer_snapshot.name, "Snapshot Test Customer");
    assert.equal(fetched.invoice.customer_snapshot.address, "Original Address 100");

    // Later contact update in People
    await pool.query(
      `UPDATE accounting_contacts SET name = 'Renamed Customer', address = 'New Address 200' WHERE id = $1`,
      [contact.id]
    );

    // Re-verify issued invoice retains original snapshot
    const fetchedAfter = await getInvoiceById(wsAId, invoice.id);
    assert.equal(fetchedAfter.invoice.customer_snapshot.name, "Snapshot Test Customer", "Issued invoice snapshot must remain immutable");
    assert.equal(fetchedAfter.invoice.customer_snapshot.address, "Original Address 100");
  });

  await t.test("7. Cross-workspace customer IDs are rejected", async () => {
    // Create customer in Workspace B
    const contactB = await createContact({
      workspaceId: wsBId,
      name: "Workspace B Private Customer",
      type: "CUSTOMER",
      email: "b.private@corp.com",
    });
    createdContactIds.push(contactB.id);

    // Attempting to create invoice in Workspace A using contact from Workspace B must be rejected
    await assert.rejects(
      async () => {
        await createInvoice({
          workspaceId: wsAId,
          contactId: contactB.id,
          dueDate: "2026-11-30",
          status: "DRAFT",
          lines: [{ description: "Cross workspace breach attempt", quantity: 1, unitPriceMinor: 50000 }],
          userId: userAId,
        });
      },
      /Selected customer does not exist in this workspace/
    );

    // Attempting to update draft in Workspace A with contact from Workspace B must also be rejected
    const { invoice: draftA } = await createInvoice({
      workspaceId: wsAId,
      dueDate: "2026-11-30",
      status: "DRAFT",
      lines: [{ description: "Valid Line", quantity: 1, unitPriceMinor: 50000 }],
      userId: userAId,
    });
    createdInvoiceIds.push(draftA.id);

    await assert.rejects(
      async () => {
        await updateDraftInvoice({
          workspaceId: wsAId,
          invoiceId: draftA.id,
          contactId: contactB.id,
          userId: userAId,
        });
      },
      /Selected customer does not exist in this workspace/
    );
  });
});

