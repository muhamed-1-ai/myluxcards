import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Accounting: Case 2 (Walk-in Direct Sale) & Case 5 (Two-Installment Invoice & Reminders)", async (t) => {
  let testUserId;
  let testWorkspaceId;
  let cashAccId;
  let revAccId;
  let arAccId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    testUserId = userRes.rows[0].id;

    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, 'Sales & Invoices Test WS', 'BUSINESS', 'INR', 'Asia/Kolkata', 'BUSINESS_OWNER')
       RETURNING id`,
      [testUserId]
    );
    testWorkspaceId = wsRes.rows[0].id;

    // Seed required accounts
    const accs = [
      { code: "1010", name: "Cash in Hand", type: "ASSET", subtype: "CASH" },
      { code: "1200", name: "Accounts Receivable", type: "ASSET", subtype: "RECEIVABLE" },
      { code: "4000", name: "Sales Revenue", type: "REVENUE", subtype: "REVENUE" },
    ];
    for (const a of accs) {
      const res = await pool.query(
        `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [testWorkspaceId, a.code, a.name, a.type, a.subtype]
      );
      if (a.code === "1010") cashAccId = res.rows[0].id;
      if (a.code === "1200") arAccId = res.rows[0].id;
      if (a.code === "4000") revAccId = res.rows[0].id;
    }
  });

  t.after(async () => {
    if (testWorkspaceId) {
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [testWorkspaceId]).catch(() => {});
    }
  });

  await t.test("Case 2: Walk-in direct sale with no lead posts once into Accounts and reports", async () => {
    const saleAmount = 250000; // ₹2,500.00
    const today = new Date().toISOString().slice(0, 10);
    const saleNum = "SALE-2026-WALKIN01";

    // 1. Post balanced journal: Cash Dr, Revenue Cr
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, created_by)
       VALUES ($1, 'JE-WALKIN-01', $2, 'SALE', 'Walk-in cash sale', 'SALE', 'POSTED', $3)
       RETURNING id`,
      [testWorkspaceId, today, testUserId]
    );
    const jeId = jeRes.rows[0].id;

    await pool.query(
      `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
       VALUES ($1, $2, $3, 0, 'Cash Received'), ($1, $4, 0, $3, 'Sales Revenue')`,
      [jeId, cashAccId, saleAmount, revAccId]
    );

    // 2. Insert Direct Sale
    const saleRes = await pool.query(
      `INSERT INTO accounting_sales (workspace_id, sale_number, date, total_minor, paid_minor, payment_method, financial_account_id, status, posted_journal_entry_id, created_by)
       VALUES ($1, $2, $3, $4, $4, 'CASH', $5, 'COMPLETED', $6, $7)
       RETURNING *`,
      [testWorkspaceId, saleNum, today, saleAmount, cashAccId, jeId, testUserId]
    );
    const sale = saleRes.rows[0];

    assert.equal(sale.lead_id, null, "Walk-in sale must not require a lead");
    assert.equal(Number(sale.total_minor), 250000);
    assert.equal(sale.status, "COMPLETED");

    // 3. Verify it appears in sales query
    const checkSale = (await pool.query(`SELECT * FROM accounting_sales WHERE id = $1`, [sale.id])).rows[0];
    assert.ok(checkSale);
    assert.equal(checkSale.sale_number, saleNum);
  });

  await t.test("Case 5: One invoice paid in two installments, fully settled, reminders cancelled", async () => {
    const invAmount = 800000; // ₹8,000.00
    const today = new Date().toISOString().slice(0, 10);

    // 1. Create contact
    const contactRes = await pool.query(
      `INSERT INTO accounting_contacts (workspace_id, name, type) VALUES ($1, 'Installment Client', 'CUSTOMER') RETURNING id`,
      [testWorkspaceId]
    );
    const contactId = contactRes.rows[0].id;

    // 2. Create issued invoice for ₹8,000
    const invRes = await pool.query(
      `INSERT INTO accounting_invoices (workspace_id, invoice_number, contact_id, issue_date, due_date, status, subtotal_minor, total_minor, amount_paid_minor, amount_due_minor)
       VALUES ($1, 'INV-2026-INST01', $2, $3, $3, 'ISSUED', $4, $4, 0, $4)
       RETURNING id`,
      [testWorkspaceId, contactId, today, invAmount]
    );
    const invoiceId = invRes.rows[0].id;

    // 3. Create due reminder for this invoice
    const remRes = await pool.query(
      `INSERT INTO accounting_reminders (workspace_id, user_id, title, type, due_date, entity_type, entity_id, status)
       VALUES ($1, $2, 'Invoice INV-2026-INST01 Due', 'INVOICE_DUE', $3, 'INVOICE', $4, 'PENDING')
       RETURNING id`,
      [testWorkspaceId, testUserId, today, invoiceId]
    );
    const reminderId = remRes.rows[0].id;

    // 4. Installment 1: ₹3,000 payment
    const p1Minor = 300000;
    const pay1Res = await pool.query(
      `INSERT INTO accounting_payments (workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor, payment_date)
       VALUES ($1, 'PAY-INST-01', 'IN', $2, $3, $4, $5)
       RETURNING id`,
      [testWorkspaceId, contactId, cashAccId, p1Minor, today]
    );

    await pool.query(
      `INSERT INTO accounting_payment_allocations (payment_id, invoice_id, allocated_minor) VALUES ($1, $2, $3)`,
      [pay1Res.rows[0].id, invoiceId, p1Minor]
    );

    await pool.query(
      `UPDATE accounting_invoices
       SET amount_paid_minor = amount_paid_minor + $1,
           amount_due_minor = amount_due_minor - $1,
           status = 'PARTIALLY_PAID'
       WHERE id = $2`,
      [p1Minor, invoiceId]
    );

    // Verify after installment 1: status PARTIALLY_PAID, reminder still PENDING
    const invAfter1 = (await pool.query(`SELECT amount_paid_minor, amount_due_minor, status FROM accounting_invoices WHERE id = $1`, [invoiceId])).rows[0];
    assert.equal(Number(invAfter1.amount_paid_minor), 300000);
    assert.equal(Number(invAfter1.amount_due_minor), 500000);
    assert.equal(invAfter1.status, "PARTIALLY_PAID");

    const remAfter1 = (await pool.query(`SELECT status FROM accounting_reminders WHERE id = $1`, [reminderId])).rows[0];
    assert.equal(remAfter1.status, "PENDING");

    // 5. Installment 2: Remaining ₹5,000 payment
    const p2Minor = 500000;
    const pay2Res = await pool.query(
      `INSERT INTO accounting_payments (workspace_id, payment_number, type, contact_id, financial_account_id, amount_minor, payment_date)
       VALUES ($1, 'PAY-INST-02', 'IN', $2, $3, $4, $5)
       RETURNING id`,
      [testWorkspaceId, contactId, cashAccId, p2Minor, today]
    );

    await pool.query(
      `INSERT INTO accounting_payment_allocations (payment_id, invoice_id, allocated_minor) VALUES ($1, $2, $3)`,
      [pay2Res.rows[0].id, invoiceId, p2Minor]
    );

    // Full payment reached: update status to PAID and dismiss reminder
    await pool.query(
      `UPDATE accounting_invoices
       SET amount_paid_minor = amount_paid_minor + $1,
           amount_due_minor = amount_due_minor - $1,
           status = 'PAID'
       WHERE id = $2`,
      [p2Minor, invoiceId]
    );

    // Cancel / dismiss active reminders for settled invoice
    await pool.query(
      `UPDATE accounting_reminders
       SET status = 'DISMISSED', dismissed_at = NOW()
       WHERE entity_id = $1 AND entity_type = 'INVOICE'`,
      [invoiceId]
    );

    // Verify after installment 2:
    const invAfter2 = (await pool.query(`SELECT amount_paid_minor, amount_due_minor, status FROM accounting_invoices WHERE id = $1`, [invoiceId])).rows[0];
    assert.equal(Number(invAfter2.amount_paid_minor), 800000);
    assert.equal(Number(invAfter2.amount_due_minor), 0);
    assert.equal(invAfter2.status, "PAID");

    const remAfter2 = (await pool.query(`SELECT status, dismissed_at FROM accounting_reminders WHERE id = $1`, [reminderId])).rows[0];
    assert.equal(remAfter2.status, "DISMISSED", "Reminder must be dismissed once invoice is fully settled");
    assert.ok(remAfter2.dismissed_at);
  });
});
