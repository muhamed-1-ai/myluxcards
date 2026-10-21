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

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

// Dynamic imports after server-only bypass in test runner
const { createContact, listContacts, getContactById } = await import("../src/lib/accounting/contacts.ts");

test("Accounting Contacts: Add Person / Contact End-to-End Verification", async (t) => {
  let userAId, userBId, wsAId, wsBId;
  const createdContactIds = [];

  t.before(async () => {
    // Obtain test users
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Must have at least two users for isolation tests");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // Create unique Workspace A for User A
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Add Person Test WS A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsAId, userAId]
    );

    // Create unique Workspace B for User B
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Add Person Test WS B', 'PERSONAL', 'INDIVIDUAL') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{}')`,
      [wsBId, userBId]
    );
  });

  t.after(async () => {
    // Cleanup created test contacts and workspaces
    if (createdContactIds.length > 0) {
      await pool.query(`DELETE FROM accounting_contacts WHERE id = ANY($1::uuid[])`, [createdContactIds]);
    }
    if (wsAId) {
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsAId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]);
    }
    if (wsBId) {
      await pool.query(`DELETE FROM accounting_workspace_members WHERE workspace_id = $1`, [wsBId]);
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]);
    }
    await pool.end();
    const { pool: sharedPool } = await import("../src/lib/db/index.ts");
    await sharedPool.end();
  });

  await t.test("1. Create contact with Name and Personal type only, with phone/email blank", async () => {
    const contact = await createContact({
      workspaceId: wsAId,
      name: "Omar Personal Friend",
      type: "PERSONAL",
      phone: "   ",
      email: "",
    });

    assert.ok(contact.id, "Contact ID must be returned");
    createdContactIds.push(contact.id);
    assert.equal(contact.name, "Omar Personal Friend");
    assert.equal(contact.type, "PERSONAL");
    assert.equal(contact.phone, null, "Blank phone must be normalized to null");
    assert.equal(contact.email, null, "Blank email must be normalized to null");
    assert.equal(contact.workspace_id, wsAId);

    // Verify in database directly
    const dbRes = await pool.query(`SELECT * FROM accounting_contacts WHERE id = $1`, [contact.id]);
    assert.equal(dbRes.rows.length, 1);
    assert.equal(dbRes.rows[0].name, "Omar Personal Friend");
    assert.equal(dbRes.rows[0].phone, null);
    assert.equal(dbRes.rows[0].email, null);
  });

  await t.test("2. Create every supported contact type (CUSTOMER, VENDOR, PERSONAL)", async () => {
    const types = ["CUSTOMER", "VENDOR", "PERSONAL"];
    for (const type of types) {
      const contact = await createContact({
        workspaceId: wsAId,
        name: `Test Contact ${type}`,
        type: type,
      });
      assert.ok(contact.id);
      createdContactIds.push(contact.id);
      assert.equal(contact.type, type);

      const dbRow = await getContactById(wsAId, contact.id);
      assert.ok(dbRow);
      assert.equal(dbRow.type, type);
    }
  });

  await t.test("3. Reject invalid contact types or missing names", async () => {
    await assert.rejects(
      async () => {
        await createContact({
          workspaceId: wsAId,
          name: "  ",
          type: "CUSTOMER",
        });
      },
      /Full Name is required/
    );

    await assert.rejects(
      async () => {
        await createContact({
          workspaceId: wsAId,
          name: "Invalid Type Contact",
          type: "UNKNOWN_TYPE",
        });
      },
      /Invalid contact type/
    );
  });

  await t.test("4. Normalize phone and reject invalid email syntax", async () => {
    // Invalid email
    await assert.rejects(
      async () => {
        await createContact({
          workspaceId: wsAId,
          name: "Bad Email Contact",
          type: "CUSTOMER",
          email: "not-an-email",
        });
      },
      /valid email address/
    );

    // Valid email and phone normalization
    const contact = await createContact({
      workspaceId: wsAId,
      name: "Valid Contact Details",
      type: "CUSTOMER",
      email: "VALID.CONTACT@EXAMPLE.COM",
      phone: "+91 98765 43210",
    });
    createdContactIds.push(contact.id);
    assert.equal(contact.email, "valid.contact@example.com", "Email must be lowercased and trimmed");
    assert.ok(contact.phone_normalized, "Normalized phone must be stored");
  });

  await t.test("5. Contacts appear in All People with zero balances and without any transactions", async () => {
    const allContacts = await listContacts(wsAId, {});
    assert.ok(allContacts.length >= 4, "All created contacts must appear in All People list");

    const personal = allContacts.find((c) => c.name === "Omar Personal Friend");
    assert.ok(personal, "Personal contact must be in list");
    assert.equal(Number(personal.total_receivable_minor), 0);
    assert.equal(Number(personal.total_payable_minor), 0);

    // Verify filter tabs logic:
    // onlyWithBalances=true must exclude 0-balance contacts
    const withBalances = await listContacts(wsAId, { onlyWithBalances: true });
    assert.equal(
      withBalances.some((c) => c.id === personal.id),
      false,
      "Zero-balance contact must not appear in onlyWithBalances"
    );

    // type filter works
    const personalOnly = await listContacts(wsAId, { type: "PERSONAL" });
    assert.ok(personalOnly.every((c) => c.type === "PERSONAL"));
  });

  await t.test("6. No unintended ledger entries or payment history created when adding contact", async () => {
    const ledgerBefore = await pool.query(
      `SELECT COUNT(*) FROM accounting_journal_entries WHERE workspace_id = $1`,
      [wsAId]
    );
    const paymentsBefore = await pool.query(
      `SELECT COUNT(*) FROM accounting_payments WHERE workspace_id = $1`,
      [wsAId]
    );

    const contact = await createContact({
      workspaceId: wsAId,
      name: "Silent Contact No Ledger",
      type: "CUSTOMER",
    });
    createdContactIds.push(contact.id);

    const ledgerAfter = await pool.query(
      `SELECT COUNT(*) FROM accounting_journal_entries WHERE workspace_id = $1`,
      [wsAId]
    );
    const paymentsAfter = await pool.query(
      `SELECT COUNT(*) FROM accounting_payments WHERE workspace_id = $1`,
      [wsAId]
    );

    assert.equal(ledgerBefore.rows[0].count, ledgerAfter.rows[0].count, "Ledger entries count must not change");
    assert.equal(paymentsBefore.rows[0].count, paymentsAfter.rows[0].count, "Payment history count must not change");
  });

  await t.test("7. Idempotent double-submit guard prevents duplicate records", async () => {
    const contactA = await createContact({
      workspaceId: wsAId,
      name: "Double Submit Guard Test",
      type: "VENDOR",
      email: "doublesubmit@example.com",
    });
    createdContactIds.push(contactA.id);

    // Immediate second submit with same details returns existing record
    const contactB = await createContact({
      workspaceId: wsAId,
      name: "Double Submit Guard Test",
      type: "VENDOR",
      email: "doublesubmit@example.com",
    });

    assert.equal(contactA.id, contactB.id, "Second immediate submission must return existing contact ID");
  });

  await t.test("8. Workspace isolation: Workspace A contacts never appear in Workspace B", async () => {
    const contactsInB = await listContacts(wsBId, {});
    const leakedContact = contactsInB.find((c) => c.name === "Omar Personal Friend");
    assert.equal(leakedContact, undefined, "Workspace A contact must NOT appear in Workspace B");
  });

  await t.test("9. Workspace RBAC: VIEWER cannot create contacts, non-member is rejected", async () => {
    const { getAuthorizedWorkspace } = await import("../src/lib/accounting/workspaces.ts");

    // Add User B as VIEWER in Workspace A
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'VIEWER', '{}')
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'VIEWER'`,
      [wsAId, userBId]
    );

    // VIEWER requesting STAFF role access must return null (denied)
    const viewerAttempt = await getAuthorizedWorkspace(userBId, wsAId, "STAFF");
    assert.equal(viewerAttempt, null, "VIEWER member must not be authorized for STAFF role actions (createContact)");

    // VIEWER requesting VIEWER role access must succeed
    const viewerReadAttempt = await getAuthorizedWorkspace(userBId, wsAId, "VIEWER");
    assert.ok(viewerReadAttempt, "VIEWER member must be authorized for read/list operations");

    // Non-member (random UUID) requesting any access must return null
    const nonMemberAttempt = await getAuthorizedWorkspace("00000000-0000-0000-0000-000000000000", wsAId, "VIEWER");
    assert.equal(nonMemberAttempt, null, "Non-member must be denied all access");
  });

  await t.test("10. Balance field mapping compatibility for PeopleView frontend", async () => {
    const contact = await getContactById(wsAId, createdContactIds[0]);
    assert.ok(contact);

    // Verify database schema column names
    assert.equal(typeof contact.total_receivable_minor, "string");
    assert.equal(typeof contact.total_payable_minor, "string");

    // Verify converted numbers for PeopleView format
    const receivable = Number(contact.total_receivable_minor ?? 0);
    const payable = Number(contact.total_payable_minor ?? 0);
    assert.equal(receivable, 0);
    assert.equal(payable, 0);
  });

  await t.test("11. CSS verification: Alert styles and contrast support in dark/light themes", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const cssPath = path.resolve("src/components/accounting/accounting.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    assert.ok(css.includes(".acc-alert {"), "Must include .acc-alert base class");
    assert.ok(css.includes(".acc-alert-danger {"), "Must include .acc-alert-danger error styling");
    assert.ok(css.includes(".acc-alert-success {"), "Must include .acc-alert-success success styling");
    assert.ok(css.includes("var(--acc-danger-soft)"), "Danger alert must reference --acc-danger-soft");
    assert.ok(css.includes("var(--acc-success-soft)"), "Success alert must reference --acc-success-soft");
    assert.ok(css.includes("--acc-danger-soft: #FEF2F2"), "Light theme must define --acc-danger-soft");
    assert.ok(css.includes('--acc-danger-soft: rgba(239, 68, 68, 0.15)'), "Dark theme must define --acc-danger-soft");
  });
});

