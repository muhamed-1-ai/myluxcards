import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

// Read database URL from environment or .env
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Follow-up Reminders & Web Push System Verification", async (t) => {
  // Test context variables
  let testUserId;
  let otherUserId;
  let testLeadId;
  let testFollowUpId;

  t.before(async () => {
    // 1. Fetch test users and a card from database
    const userRes = await pool.query(
      `SELECT id, email FROM users ORDER BY created_at ASC LIMIT 2`
    );
    assert.ok(userRes.rows.length >= 2, "Need at least 2 users in database for multi-tenant isolation testing");
    testUserId = userRes.rows[0].id;
    otherUserId = userRes.rows[1].id;

    const cardRes = await pool.query(`SELECT id FROM digital_cards LIMIT 1`);
    assert.ok(cardRes.rows.length > 0, "Need at least 1 digital_card in database");
    const cardId = cardRes.rows[0].id;

    // 2. Create a test lead for testUserId
    const leadRes = await pool.query(
      `INSERT INTO leads (owner_user_id, assigned_user_id, card_id, name, company_name, contact_number, contact_number_normalized, email, status, created_at, updated_at)
       VALUES ($1, $1, $2, 'Test Lead AutoRemind', 'Zappit Diagnostics Inc', '+15551234567', '+15551234567', 'test.lead@example.com', 'NEW', NOW(), NOW())
       RETURNING id`,
      [testUserId, cardId]
    );
    testLeadId = leadRes.rows[0].id;
  });

  t.after(async () => {
    // Cleanup test records
    if (testFollowUpId) {
      await pool.query(`DELETE FROM lead_follow_ups WHERE id = $1`, [testFollowUpId]).catch(() => {});
      await pool.query(`DELETE FROM lead_activities WHERE entity_id = $1`, [testFollowUpId]).catch(() => {});
    }
    if (testLeadId) {
      await pool.query(`DELETE FROM leads WHERE id = $1`, [testLeadId]).catch(() => {});
    }
    await pool.end();
  });

  await t.test("1. Database Schema & Migration Verification", async () => {
    // Verify notifications table
    const notifCols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications'`
    );
    const colNames = notifCols.rows.map((r) => r.column_name);
    assert.ok(colNames.includes("id"), "notifications should have id");
    assert.ok(colNames.includes("user_id"), "notifications should have user_id");
    assert.ok(colNames.includes("type"), "notifications should have type");
    assert.ok(colNames.includes("is_read"), "notifications should have is_read");

    // Verify push_subscriptions table
    const pushCols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'push_subscriptions'`
    );
    const pushColNames = pushCols.rows.map((r) => r.column_name);
    assert.ok(pushColNames.includes("endpoint"), "push_subscriptions should have endpoint");
    assert.ok(pushColNames.includes("p256dh"), "push_subscriptions should have p256dh");
    assert.ok(pushColNames.includes("auth"), "push_subscriptions should have auth");

    // Verify lead_follow_ups reminder columns
    const fuCols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'lead_follow_ups'`
    );
    const fuColNames = fuCols.rows.map((r) => r.column_name);
    assert.ok(fuColNames.includes("reminded_at"), "lead_follow_ups should have reminded_at");
    assert.ok(fuColNames.includes("snoozed_until"), "lead_follow_ups should have snoozed_until");
    assert.ok(fuColNames.includes("dismissed_at"), "lead_follow_ups should have dismissed_at");
    assert.ok(fuColNames.includes("reminder_version"), "lead_follow_ups should have reminder_version");
  });

  await t.test("2. Follow-Up Scheduling & Future Non-Premature Triggering", async () => {
    // Create a follow-up scheduled 5 minutes into the future
    const futureDate = new Date(Date.now() + 5 * 60 * 1000);
    const fuRes = await pool.query(
      `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, type, status, reminder_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'Discussion on Enterprise NFC Package', 'CALL', 'SCHEDULED', 1, NOW(), NOW())
       RETURNING id, scheduled_at, status`,
      [testUserId, testLeadId, futureDate]
    );
    testFollowUpId = fuRes.rows[0].id;

    // Dynamically test due check: Should NOT be due right now
    const dueCheck = await pool.query(
      `SELECT id FROM lead_follow_ups 
       WHERE id = $1 AND status = 'SCHEDULED' 
         AND (
           (snoozed_until IS NOT NULL AND snoozed_until <= NOW())
           OR (snoozed_until IS NULL AND reminded_at IS NULL AND scheduled_at <= NOW())
         )`,
      [testFollowUpId]
    );
    assert.equal(dueCheck.rows.length, 0, "Future follow-up must NOT trigger prematurely");
  });

  await t.test("3. Instant Due Transition & Scheduler Scan Idempotency", async () => {
    // Set scheduled_at to 10 seconds ago (now due)
    await pool.query(
      `UPDATE lead_follow_ups SET scheduled_at = NOW() - INTERVAL '10 seconds' WHERE id = $1`,
      [testFollowUpId]
    );

    // Verify due check triggers
    const dueCheck = await pool.query(
      `SELECT id, scheduled_at, reminder_version FROM lead_follow_ups 
       WHERE id = $1 AND status = 'SCHEDULED' 
         AND (
           (snoozed_until IS NOT NULL AND snoozed_until <= NOW())
           OR (snoozed_until IS NULL AND reminded_at IS NULL AND scheduled_at <= NOW())
         )`,
      [testFollowUpId]
    );
    assert.equal(dueCheck.rows.length, 1, "Follow-up must be detected as due");

    // Simulate scheduler atomic claim
    const claimRes = await pool.query(
      `UPDATE lead_follow_ups 
       SET reminded_at = NOW(), snoozed_until = NULL, updated_at = NOW()
       WHERE id = $1 AND reminder_version = $2 AND status = 'SCHEDULED'
       RETURNING id, reminded_at`,
      [testFollowUpId, dueCheck.rows[0].reminder_version]
    );
    assert.equal(claimRes.rowCount, 1, "Scheduler must claim the reminder atomically");
    assert.ok(claimRes.rows[0].reminded_at !== null);

    // Re-scanning immediately must be idempotent (0 rows claimed)
    const secondScan = await pool.query(
      `SELECT id FROM lead_follow_ups 
       WHERE id = $1 AND status = 'SCHEDULED' 
         AND (
           (snoozed_until IS NOT NULL AND snoozed_until <= NOW())
           OR (snoozed_until IS NULL AND reminded_at IS NULL AND scheduled_at <= NOW())
         )`,
      [testFollowUpId]
    );
    assert.equal(secondScan.rows.length, 0, "Subsequent scan must NOT re-claim already reminded follow-up");
  });

  await t.test("4. Multi-Tenant and User Authorization Isolation", async () => {
    // Reset reminded_at for due reminder querying
    await pool.query(`UPDATE lead_follow_ups SET reminded_at = NULL, dismissed_at = NULL WHERE id = $1`, [testFollowUpId]);

    // Authorized user (testUserId) query
    const authQuery = `
      SELECT f.id, l.name as "leadName"
      FROM lead_follow_ups f
      JOIN leads l ON l.id = f.lead_id
      WHERE f.status = 'SCHEDULED'
        AND (f.owner_user_id = $1 OR l.owner_user_id = $1 OR l.assigned_user_id = $1)
        AND f.id = $2
    `;
    const userRes = await pool.query(authQuery, [testUserId, testFollowUpId]);
    assert.equal(userRes.rows.length, 1, "Authorized owner must see their reminder");

    // Unauthorized user (otherUserId) query
    const otherRes = await pool.query(authQuery, [otherUserId, testFollowUpId]);
    assert.equal(otherRes.rows.length, 0, "Other user must NOT see another tenant's reminder");
  });

  await t.test("5. Snooze 15 Minutes Workflow (Preserves Scheduled Deadline)", async () => {
    // Record original scheduled_at
    const origRes = await pool.query(`SELECT scheduled_at, reminder_version FROM lead_follow_ups WHERE id = $1`, [testFollowUpId]);
    const origScheduledAt = origRes.rows[0].scheduled_at.toISOString();
    const origVersion = origRes.rows[0].reminder_version;

    // Snooze for 15 minutes
    const snoozeRes = await pool.query(
      `UPDATE lead_follow_ups
       SET snoozed_until = NOW() + INTERVAL '15 minutes',
           dismissed_at = NULL,
           reminder_version = reminder_version + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, scheduled_at, snoozed_until, reminder_version`,
      [testFollowUpId]
    );

    const snoozed = snoozeRes.rows[0];
    assert.equal(snoozed.scheduled_at.toISOString(), origScheduledAt, "Original scheduled_at MUST be preserved");
    assert.ok(snoozed.snoozed_until > new Date(), "snoozed_until must be in the future");
    assert.equal(snoozed.reminder_version, origVersion + 1, "reminder_version must increment");

    // While snoozed, the follow-up must NOT appear in due reminders
    const dueDuringSnooze = await pool.query(
      `SELECT f.id FROM lead_follow_ups f
       WHERE f.id = $1 AND f.status = 'SCHEDULED'
         AND (
           (f.snoozed_until IS NOT NULL AND f.snoozed_until <= NOW())
           OR (f.snoozed_until IS NULL AND f.scheduled_at <= NOW())
         )`,
      [testFollowUpId]
    );
    assert.equal(dueDuringSnooze.rows.length, 0, "Follow-up must be hidden while snoozed");
  });

  await t.test("6. Dismiss / Acknowledge Workflow", async () => {
    // Clear snooze and make it due now
    await pool.query(
      `UPDATE lead_follow_ups 
       SET snoozed_until = NULL, scheduled_at = NOW() - INTERVAL '5 seconds', reminded_at = NOW()
       WHERE id = $1`,
      [testFollowUpId]
    );

    // Dismiss the reminder
    const dismissRes = await pool.query(
      `UPDATE lead_follow_ups SET dismissed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, status, dismissed_at`,
      [testFollowUpId]
    );
    assert.equal(dismissRes.rows[0].status, "SCHEDULED", "Dismiss must NOT complete or cancel follow-up");
    assert.ok(dismissRes.rows[0].dismissed_at !== null, "dismissed_at must be set");

    // Due query filter check: dismissed reminders are suppressed from the in-app modal
    const modalQuery = `
      SELECT f.id FROM lead_follow_ups f
      WHERE f.id = $1 AND f.status = 'SCHEDULED'
        AND (
          (f.snoozed_until IS NOT NULL AND f.snoozed_until <= NOW())
          OR (f.snoozed_until IS NULL AND f.scheduled_at <= NOW())
        )
        AND (
          f.dismissed_at IS NULL
          OR (f.snoozed_until IS NOT NULL AND f.snoozed_until > f.dismissed_at)
        )
    `;
    const checkDismiss = await pool.query(modalQuery, [testFollowUpId]);
    assert.equal(checkDismiss.rows.length, 0, "Dismissed reminder must not re-open in modal");
  });

  await t.test("7. Rescheduling Invalidation and Reset", async () => {
    const newScheduledDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour later
    const vRes = await pool.query(`SELECT reminder_version FROM lead_follow_ups WHERE id = $1`, [testFollowUpId]);
    const currentVersion = vRes.rows[0].reminder_version;

    // Reschedule
    const resched = await pool.query(
      `UPDATE lead_follow_ups
       SET scheduled_at = $1,
           status = 'SCHEDULED',
           reminded_at = NULL,
           snoozed_until = NULL,
           dismissed_at = NULL,
           reminder_version = reminder_version + 1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, scheduled_at, reminded_at, snoozed_until, dismissed_at, reminder_version`,
      [newScheduledDate, testFollowUpId]
    );

    const row = resched.rows[0];
    assert.equal(row.reminded_at, null, "reminded_at must be reset to NULL on reschedule");
    assert.equal(row.snoozed_until, null, "snoozed_until must be reset to NULL on reschedule");
    assert.equal(row.dismissed_at, null, "dismissed_at must be reset to NULL on reschedule");
    assert.equal(row.reminder_version, currentVersion + 1, "reminder_version must increment");
  });

  await t.test("8. Complete Follow-Up Invalidation", async () => {
    const compRes = await pool.query(
      `UPDATE lead_follow_ups
       SET status = 'COMPLETED', completed_at = NOW(), reminder_version = reminder_version + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, completed_at`,
      [testFollowUpId]
    );
    assert.equal(compRes.rows[0].status, "COMPLETED");
    assert.ok(compRes.rows[0].completed_at !== null);

    // Completed follow-ups must never be returned as due
    const dueComp = await pool.query(
      `SELECT id FROM lead_follow_ups WHERE id = $1 AND status = 'SCHEDULED'`,
      [testFollowUpId]
    );
    assert.equal(dueComp.rows.length, 0, "Completed follow-up must never trigger reminders");
  });

  await t.test("9. Web Push Subscription Upsert and Clean Removal", async () => {
    const testEndpoint = "https://fcm.googleapis.com/fcm/send/test-device-endpoint-unique-12345";
    const testP256dh = "BCV_test_p256dh_key_sample_string";
    const testAuth = "test_auth_secret_sample";

    // Insert subscription
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name, user_agent, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Automated Test Browser', 'TestAgent/1.0', NOW(), NOW())
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
      [testUserId, testEndpoint, testP256dh, testAuth]
    );

    const checkSub = await pool.query(`SELECT id, user_id FROM push_subscriptions WHERE endpoint = $1`, [testEndpoint]);
    assert.equal(checkSub.rows.length, 1);
    assert.equal(checkSub.rows[0].user_id, testUserId);

    // Cleanly remove subscription
    await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [testEndpoint]);
    const checkDeleted = await pool.query(`SELECT id FROM push_subscriptions WHERE endpoint = $1`, [testEndpoint]);
    assert.equal(checkDeleted.rows.length, 0, "Subscription should be removed cleanly");
  });
});
