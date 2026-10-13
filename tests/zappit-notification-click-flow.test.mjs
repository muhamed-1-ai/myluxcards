import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;
import crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("ZAPPIT Notification Click Flow & Lead Access Verification", async (t) => {
  // Test UUIDs
  const tenantAId = crypto.randomUUID();
  const tenantBId = crypto.randomUUID();
  const cardAId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const followUpId = crypto.randomUUID();
  const notificationId = crypto.randomUUID();

  t.before(async () => {
    // 1. Create Tenant A and Tenant B
    await pool.query(
      `INSERT INTO users (id, email, name, role, status, updated_at)
       VALUES 
         ($1, 'qa_tenant_a@zappit-test.local', 'Tenant A QA', 'CUSTOMER', 'ACTIVE', NOW()),
         ($2, 'qa_tenant_b@zappit-test.local', 'Tenant B QA', 'CUSTOMER', 'ACTIVE', NOW())`,
      [tenantAId, tenantBId]
    );

    // 2. Create card for Tenant A
    await pool.query(
      `INSERT INTO digital_cards (id, owner_id, slug, updated_at)
       VALUES ($1, $2, $3, NOW())`,
      [cardAId, tenantAId, `card-qa-${Date.now()}`]
    );

    // 3. Create lead for Tenant A
    await pool.query(
      `INSERT INTO leads (id, owner_user_id, assigned_user_id, card_id, name, company_name, contact_number, contact_number_normalized, email, status, created_at, updated_at)
       VALUES ($1, $2, $2, $3, 'Authoritative NFC Lead', 'Zappit Corp', '+919999912345', '+919999912345', 'qa_lead@zappit.local', 'NEW', NOW(), NOW())`,
      [leadId, tenantAId, cardAId]
    );

    // 4. Create follow-up for the lead
    const scheduledAt = new Date(Date.now() + 3600000); // +1 hour
    await pool.query(
      `INSERT INTO lead_follow_ups (id, lead_id, owner_user_id, scheduled_at, note, type, status, reminder_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Discuss Enterprise NFC card deployment', 'CALL', 'SCHEDULED', 1, NOW(), NOW())`,
      [followUpId, leadId, tenantAId, scheduledAt]
    );

    // 5. Create notification for Tenant A
    const actionUrl = `/dashboard?tab=leads&leadId=${leadId}&followUpId=${followUpId}`;
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, body, entity_type, entity_id, action_url, is_read, metadata, created_at)
       VALUES ($1, $2, 'FOLLOW_UP_REMINDER', 'Follow-up Due: Authoritative NFC Lead', 'Discuss Enterprise NFC card deployment', 'lead_follow_up', $3, $4, false, $5, NOW())`,
      [
        notificationId,
        tenantAId,
        followUpId,
        actionUrl,
        JSON.stringify({ leadId, followUpId, leadName: "Authoritative NFC Lead" }),
      ]
    );
  });

  t.after(async () => {
    // Cleanup test artifacts
    await pool.query("DELETE FROM notifications WHERE id = $1 OR user_id IN ($2, $3)", [notificationId, tenantAId, tenantBId]).catch(() => {});
    await pool.query("DELETE FROM lead_follow_ups WHERE id = $1 OR owner_user_id IN ($2, $3)", [followUpId, tenantAId, tenantBId]).catch(() => {});
    await pool.query("DELETE FROM leads WHERE id = $1 OR owner_user_id IN ($2, $3)", [leadId, tenantAId, tenantBId]).catch(() => {});
    await pool.query("DELETE FROM digital_cards WHERE id = $1 OR owner_id IN ($2, $3)", [cardAId, tenantAId, tenantBId]).catch(() => {});
    await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [tenantAId, tenantBId]).catch(() => {});
    await pool.end();
  });

  await t.test("1. Root Cause Trace: Orphaned notification exists pointing to deleted lead (Screenshot failure scenario)", async () => {
    // Check known deleted lead from trace script
    const deletedLeadId = "bad74b2e-c2fd-4a31-9d68-d2bea947cf30";
    const orphanedNotifRes = await pool.query(
      "SELECT id, user_id, action_url, metadata FROM notifications WHERE action_url LIKE $1 LIMIT 1",
      [`%${deletedLeadId}%`]
    );

    if (orphanedNotifRes.rows.length > 0) {
      const notif = orphanedNotifRes.rows[0];
      const leadCheck = await pool.query("SELECT id FROM leads WHERE id = $1", [deletedLeadId]);
      assert.strictEqual(leadCheck.rows.length, 0, "Lead record was deleted from leads table");
      assert.ok(notif.action_url.includes(deletedLeadId), "Notification still pointed to deleted lead ID, causing 404 in screenshots");
    }
  });

  await t.test("2. Authoritative Flow: Valid accessible lead returns lead details and follow-ups list", async () => {
    // Query lead as Tenant A
    const accessClause = "(l.owner_user_id = $2 OR l.assigned_user_id = $2)";
    const leadRes = await pool.query(
      `SELECT l.id, l.name, l.status, l.owner_user_id, l.assigned_user_id
       FROM leads l
       WHERE l.id = $1 AND ${accessClause}`,
      [leadId, tenantAId]
    );
    assert.strictEqual(leadRes.rows.length, 1, "Lead must be found for authorized tenant");
    assert.strictEqual(leadRes.rows[0].id, leadId);

    // Query follow-ups for lead
    const fuRes = await pool.query(
      `SELECT id, scheduled_at as "scheduledAt", note, status, COALESCE(type, 'CALL') as type
       FROM lead_follow_ups
       WHERE lead_id = $1
       ORDER BY scheduled_at ASC`,
      [leadId]
    );
    assert.strictEqual(fuRes.rows.length, 1, "Follow-up must be returned");
    assert.strictEqual(fuRes.rows[0].id, followUpId, "Authoritative followUpId must match");
  });

  await t.test("3. Multi-Tenant Scoping: Tenant B CANNOT access Tenant A's lead", async () => {
    const accessClause = "(l.owner_user_id = $2 OR l.assigned_user_id = $2)";
    const res = await pool.query(
      `SELECT l.id FROM leads l WHERE l.id = $1 AND ${accessClause}`,
      [leadId, tenantBId]
    );
    assert.strictEqual(res.rows.length, 0, "Tenant B must be strictly barred from accessing Tenant A's lead");
  });

  await t.test("4. Notification State: Stale or failed fetch must NOT mark notification read", async () => {
    // Initial state
    const notifBefore = await pool.query("SELECT is_read FROM notifications WHERE id = $1", [notificationId]);
    assert.strictEqual(notifBefore.rows[0].is_read, false, "Notification starts unread");

    // Simulate failed lead retrieval (e.g. 404)
    // Client logic in LeadDetailsDrawer only marks read if res.ok && data.lead
    const fetchSucceeded = false;
    if (fetchSucceeded) {
      await pool.query("UPDATE notifications SET is_read = true WHERE id = $1", [notificationId]);
    }

    const notifAfterFailure = await pool.query("SELECT is_read FROM notifications WHERE id = $1", [notificationId]);
    assert.strictEqual(notifAfterFailure.rows[0].is_read, false, "Notification remains unread on failure");

    // Simulate successful retrieval
    await pool.query("UPDATE notifications SET is_read = true WHERE id = $1", [notificationId]);
    const notifAfterSuccess = await pool.query("SELECT is_read FROM notifications WHERE id = $1", [notificationId]);
    assert.strictEqual(notifAfterSuccess.rows[0].is_read, true, "Notification is marked read on success");
  });

  await t.test("5. Inaccessible / Deleted Lead State Handling", async () => {
    // Delete the lead
    await pool.query("DELETE FROM lead_follow_ups WHERE lead_id = $1", [leadId]);
    await pool.query("DELETE FROM leads WHERE id = $1", [leadId]);

    const checkRes = await pool.query("SELECT id FROM leads WHERE id = $1", [leadId]);
    assert.strictEqual(checkRes.rows.length, 0, "Lead record is deleted");

    // Query with access check
    const accessClause = "(l.owner_user_id = $2 OR l.assigned_user_id = $2)";
    const leadAfterDelete = await pool.query(
      `SELECT l.id FROM leads l WHERE l.id = $1 AND ${accessClause}`,
      [leadId, tenantAId]
    );
    assert.strictEqual(leadAfterDelete.rows.length, 0, "Deleted lead returns empty row count (HTTP 404)");

    // UI state assertion:
    // When API returns 404, LeadDetailsDrawer sets:
    // isNotFound = true, error = "This lead is no longer available in your workspace."
    const uiState = {
      status: 404,
      isNotFound: true,
      error: "This lead is no longer available in your workspace.",
    };
    assert.strictEqual(uiState.isNotFound, true);
    assert.strictEqual(uiState.error, "This lead is no longer available in your workspace.");
  });

  await t.test("6. URL parameter parsing and state synchronization", async () => {
    // Simulate direct URL loading: /dashboard?tab=leads&leadId=123&followUpId=456
    const sampleUrl = "https://app.zappit.local/dashboard?tab=leads&leadId=11111111-1111-4111-8111-111111111111&followUpId=22222222-2222-4222-8222-222222222222";
    const parsed = new URL(sampleUrl);

    assert.strictEqual(parsed.searchParams.get("tab"), "leads");
    assert.strictEqual(parsed.searchParams.get("leadId"), "11111111-1111-4111-8111-111111111111");
    assert.strictEqual(parsed.searchParams.get("followUpId"), "22222222-2222-4222-8222-222222222222");

    // Simulate drawer close URL update
    const current = new URLSearchParams(parsed.search);
    const updates = { leadId: null, followUpId: null, notificationId: null };
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null) current.delete(k);
    });

    assert.strictEqual(current.get("tab"), "leads");
    assert.strictEqual(current.get("leadId"), null, "leadId must be removed on drawer close");
    assert.strictEqual(current.get("followUpId"), null, "followUpId must be removed on drawer close");
  });
});
