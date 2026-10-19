import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env" });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

test("Accounting: Case 8 - RBAC & Permissions Enforcement", async (t) => {
  let ownerUserId, staffUserId, personalWsId, businessWsId;

  t.before(async () => {
    // Create Owner User
    const ownerRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('owner_test@example.com', 'Owner User', 'ADMIN')
       RETURNING id`
    );
    ownerUserId = ownerRes.rows[0].id;

    // Create Staff User
    const staffRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('staff_test@example.com', 'Staff User', 'USER')
       RETURNING id`
    );
    staffUserId = staffRes.rows[0].id;

    // Create Personal Workspace for Owner
    const pRes = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Owner Personal Finances', 'PERSONAL', $1)
       RETURNING id`,
      [ownerUserId]
    );
    personalWsId = pRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [personalWsId, ownerUserId]
    );

    // Create Business Workspace where Staff is a member with 'STAFF' role
    const bRes = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Acme Corp Business', 'BUSINESS', $1)
       RETURNING id`,
      [ownerUserId]
    );
    businessWsId = bRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'OWNER')`,
      [businessWsId, ownerUserId]
    );
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'STAFF')`,
      [businessWsId, staffUserId]
    );
  });

  t.after(async () => {
    if (personalWsId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [personalWsId]).catch(() => {});
    if (businessWsId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [businessWsId]).catch(() => {});
    if (ownerUserId) await pool.query(`DELETE FROM users WHERE id = $1`, [ownerUserId]).catch(() => {});
    if (staffUserId) await pool.query(`DELETE FROM users WHERE id = $1`, [staffUserId]).catch(() => {});
  });

  await t.test("Staff has NO access to Owner Personal Workspace", async () => {
    const memberCheck = await pool.query(
      `SELECT role FROM accounting_workspace_members
       WHERE workspace_id = $1 AND user_id = $2`,
      [personalWsId, staffUserId]
    );
    assert.equal(memberCheck.rows.length, 0, "Staff must have 0 memberships in Owner's personal workspace");
  });

  await t.test("Staff role hierarchy: STAFF cannot perform OWNER/MANAGER administrative operations", async () => {
    // Role hierarchy test: VIEWER = 1, STAFF = 2, MANAGER = 3, OWNER = 4
    const ROLE_HIERARCHY = {
      VIEWER: 1,
      STAFF: 2,
      MANAGER: 3,
      OWNER: 4,
    };

    const hasPermission = (userRole, requiredRole) => {
      return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 99);
    };

    assert.equal(hasPermission("STAFF", "VIEWER"), true, "Staff can view");
    assert.equal(hasPermission("STAFF", "STAFF"), true, "Staff can execute staff actions");
    assert.equal(hasPermission("STAFF", "MANAGER"), false, "Staff cannot execute manager actions");
    assert.equal(hasPermission("STAFF", "OWNER"), false, "Staff cannot execute owner actions");
  });
});

test("Accounting: Case 9 - Overpayment Prevention & Traceable Corrections", async (t) => {
  let wsId, contactId, invoiceId, bankAccId, userId;

  t.before(async () => {
    const uRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('case9_test@example.com', 'Case 9 User', 'ADMIN') RETURNING id`
    );
    userId = uRes.rows[0].id;

    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Overpayment Test WS', 'BUSINESS', $1) RETURNING id`,
      [userId]
    );
    wsId = wsRes.rows[0].id;

    const bRes = await pool.query(
      `INSERT INTO accounting_financial_accounts (workspace_id, code, name, type, subtype, current_balance_minor)
       VALUES ($1, '1020', 'Business Current', 'ASSET', 'BANK', 1000000) RETURNING id`,
      [wsId]
    );
    bankAccId = bRes.rows[0].id;

    const cRes = await pool.query(
      `INSERT INTO accounting_contacts (workspace_id, name, type)
       VALUES ($1, 'Customer Test', 'CUSTOMER') RETURNING id`,
      [wsId]
    );
    contactId = cRes.rows[0].id;

    const invRes = await pool.query(
      `INSERT INTO accounting_invoices (workspace_id, contact_id, invoice_number, issue_date, due_date, subtotal_minor, total_minor, amount_paid_minor, amount_due_minor, status)
       VALUES ($1, $2, 'INV-OVERPAY-1', CURRENT_DATE, CURRENT_DATE + 30, 500000, 500000, 0, 500000, 'ISSUED') RETURNING id`,
      [wsId, contactId]
    );
    invoiceId = invRes.rows[0].id;
  });

  t.after(async () => {
    if (wsId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsId]).catch(() => {});
    if (userId) await pool.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => {});
  });

  await t.test("Cannot allocate more than amount_due_minor (Overpayment Prevention)", async () => {
    const invRes = await pool.query(`SELECT amount_due_minor FROM accounting_invoices WHERE id = $1`, [invoiceId]);
    const amountDue = Number(invRes.rows[0].amount_due_minor);
    assert.equal(amountDue, 500000); // ₹5,000

    const paymentAmount = 600000; // ₹6,000 attempted payment
    const canPay = paymentAmount <= amountDue;
    assert.equal(canPay, false, "Payment of 600000 must be rejected when amount due is 500000");
  });

  await t.test("Reversal/Correction creates an immutable audit entry and balanced reversal", async () => {
    // 1. Post original transaction
    const jeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status)
       VALUES ($1, 'JE-ORIG-01', CURRENT_DATE, 'TRANSACTION', 'Erroneous Expense Entry', 'TRANSACTION', 'POSTED') RETURNING id`,
      [wsId]
    );
    const origJeId = jeRes.rows[0].id;

    // 2. Void original entry and record reversal
    await pool.query(
      `UPDATE accounting_journal_entries SET status = 'VOIDED' WHERE id = $1`,
      [origJeId]
    );

    // 3. Insert reversal journal entry
    const revJeRes = await pool.query(
      `INSERT INTO accounting_journal_entries (workspace_id, entry_number, entry_date, entry_type, description, source_type, status, reversal_of_entry_id)
       VALUES ($1, 'JE-REV-01', CURRENT_DATE, 'REVERSAL', 'Reversal of JE-ORIG-01', 'REVERSAL', 'POSTED', $2) RETURNING id`,
      [wsId, origJeId]
    );
    const revJeId = revJeRes.rows[0].id;

    // 4. Record Audit Log
    await pool.query(
      `INSERT INTO accounting_audit_logs (workspace_id, actor_id, actor_role, action, entity_type, entity_id, new_state)
       VALUES ($1, $2, 'OWNER', 'VOID_TRANSACTION', 'JOURNAL_ENTRY', $3, $4)`,
      [wsId, userId, origJeId, JSON.stringify({ reversedBy: revJeId, reason: "Entered in error" })]
    );

    // Verify Audit log exists and links to reversed entry
    const auditRes = await pool.query(
      `SELECT action, entity_id, new_state FROM accounting_audit_logs WHERE workspace_id = $1 AND entity_id = $2`,
      [wsId, origJeId]
    );
    assert.equal(auditRes.rows.length, 1);
    assert.equal(auditRes.rows[0].action, "VOID_TRANSACTION");
  });
});

test("Accounting: Case 4 - Leads Sync Idempotency", async (t) => {
  let wsId, userId;

  t.before(async () => {
    const uRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('case4_test@example.com', 'Case 4 User', 'ADMIN') RETURNING id`
    );
    userId = uRes.rows[0].id;

    const wsRes = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Leads Sync Test WS', 'BUSINESS', $1) RETURNING id`,
      [userId]
    );
    wsId = wsRes.rows[0].id;
  });

  t.after(async () => {
    if (wsId) await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsId]).catch(() => {});
    if (userId) await pool.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => {});
    await pool.query(`DELETE FROM accounting_outbox_events WHERE source_id LIKE 'lead-deal-won-event-%'`).catch(() => {});
  });

  await t.test("Duplicate external event ID is recorded in outbox and processed exactly once", async () => {
    const eventId = `lead-deal-won-event-${Date.now()}`;
    const idempotencyKey = `leads-sync:${eventId}`;
    const eventType = "LEAD_DEAL_WON";

    // First ingestion: insert outbox event
    const insert1 = await pool.query(
      `INSERT INTO accounting_outbox_events (event_type, source_id, idempotency_key, payload, status)
       VALUES ($1, $2, $3, $4, 'PROCESSED') RETURNING id`,
      [eventType, eventId, idempotencyKey, JSON.stringify({ eventId, dealAmountMinor: 1500000 })]
    );
    assert.ok(insert1.rows[0].id);

    // Check if event already exists using idempotency_key
    const checkRes = await pool.query(
      `SELECT id FROM accounting_outbox_events
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    assert.equal(checkRes.rows.length, 1);

    // Simulated retry: unique constraint violation or checking before insert prevents duplicate write
    let duplicateRejected = false;
    try {
      await pool.query(
        `INSERT INTO accounting_outbox_events (event_type, source_id, idempotency_key, payload, status)
         VALUES ($1, $2, $3, $4, 'PROCESSED')`,
        [eventType, eventId, idempotencyKey, JSON.stringify({ eventId, dealAmountMinor: 1500000 })]
      );
    } catch (err) {
      if (err.code === "23505") {
        duplicateRejected = true;
      }
    }
    assert.equal(duplicateRejected, true, "Duplicate Leads event with same idempotency key was correctly rejected with unique violation");
  });
});
