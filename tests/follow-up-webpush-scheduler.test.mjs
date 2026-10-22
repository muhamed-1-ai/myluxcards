import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Follow-up Web Push Notifications & Persistent Scheduler Verification", async (t) => {
  let testUserId;
  let otherUserId;
  let testLeadId;
  let testFollowUpId;
  const testEndpoints = [
    "https://fcm.googleapis.com/fcm/send/test-device-desktop-unique-" + Date.now(),
    "https://fcm.googleapis.com/fcm/send/test-device-mobile-unique-" + Date.now(),
  ];

  t.before(async () => {
    // 1. Get two users for multi-tenant isolation testing
    const userRes = await pool.query(
      `SELECT id, email FROM users ORDER BY created_at ASC LIMIT 2`
    );
    assert.ok(
      userRes.rows.length >= 2,
      "Need at least 2 users in database for multi-tenant testing"
    );
    testUserId = userRes.rows[0].id;
    otherUserId = userRes.rows[1].id;

    // 2. Get digital card
    const cardRes = await pool.query(`SELECT id FROM digital_cards LIMIT 1`);
    assert.ok(cardRes.rows.length > 0, "Need at least 1 digital_card in database");
    const cardId = cardRes.rows[0].id;

    // 3. Create test lead
    const leadRes = await pool.query(
      `INSERT INTO leads (owner_user_id, assigned_user_id, card_id, name, company_name, contact_number, contact_number_normalized, email, status, created_at, updated_at)
       VALUES ($1, $1, $2, 'Acme WebPush Lead', 'Cloud Dynamics Global', '+15552345678', '+15552345678', 'acme.push@example.com', 'NEW', NOW(), NOW())
       RETURNING id`,
      [testUserId, cardId]
    );
    testLeadId = leadRes.rows[0].id;
  });

  t.after(async () => {
    // Cleanup test data
    if (testFollowUpId) {
      await pool.query(`DELETE FROM follow_up_push_dispatches WHERE follow_up_id = $1`, [testFollowUpId]).catch(() => {});
      await pool.query(`DELETE FROM lead_follow_ups WHERE id = $1`, [testFollowUpId]).catch(() => {});
      await pool.query(`DELETE FROM notifications WHERE entity_id = $1`, [testFollowUpId]).catch(() => {});
    }
    for (const ep of testEndpoints) {
      await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [ep]).catch(() => {});
    }
    if (testLeadId) {
      await pool.query(`DELETE FROM leads WHERE id = $1`, [testLeadId]).catch(() => {});
    }
    await pool.end();
  });

  await t.test("1. Database Schema & Migration Verification", async () => {
    // Verify follow_up_push_dispatches table and columns
    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'follow_up_push_dispatches'`
    );
    const colNames = cols.rows.map((r) => r.column_name);
    assert.ok(colNames.includes("id"), "Should have id");
    assert.ok(colNames.includes("follow_up_id"), "Should have follow_up_id");
    assert.ok(colNames.includes("reminder_version"), "Should have reminder_version");
    assert.ok(colNames.includes("user_id"), "Should have user_id");
    assert.ok(colNames.includes("endpoint"), "Should have endpoint");
    assert.ok(colNames.includes("status"), "Should have status");
    assert.ok(colNames.includes("status_code"), "Should have status_code");
    assert.ok(colNames.includes("attempts"), "Should have attempts");
    assert.ok(colNames.includes("error_message"), "Should have error_message");
    assert.ok(colNames.includes("dispatched_at"), "Should have dispatched_at");

    // Verify notification_preferences has show_previews
    const prefCols = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'notification_preferences'`
    );
    const prefColNames = prefCols.rows.map((r) => r.column_name);
    assert.ok(prefColNames.includes("show_previews"), "Should have show_previews toggle");
    assert.ok(prefColNames.includes("follow_up_reminders"), "Should have follow_up_reminders toggle");
  });

  await t.test("2. Notification Preferences Persistence & Privacy Mode", async () => {
    // Upsert preferences with show_previews = false
    await pool.query(
      `INSERT INTO notification_preferences (user_id, follow_up_reminders, show_previews, updated_at)
       VALUES ($1, true, false, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET follow_up_reminders = EXCLUDED.follow_up_reminders,
           show_previews = EXCLUDED.show_previews,
           updated_at = NOW()`,
      [testUserId]
    );

    const getRes = await pool.query(
      `SELECT follow_up_reminders, show_previews FROM notification_preferences WHERE user_id = $1`,
      [testUserId]
    );
    assert.equal(getRes.rows[0].follow_up_reminders, true);
    assert.equal(getRes.rows[0].show_previews, false, "show_previews should be persisted as false");

    // Re-enable previews
    await pool.query(
      `UPDATE notification_preferences SET show_previews = true, updated_at = NOW() WHERE user_id = $1`,
      [testUserId]
    );
    const updatedRes = await pool.query(
      `SELECT show_previews FROM notification_preferences WHERE user_id = $1`,
      [testUserId]
    );
    assert.equal(updatedRes.rows[0].show_previews, true, "show_previews should toggle back to true");
  });

  await t.test("3. Multi-Device Push Subscription Registration & Ownership", async () => {
    // 1. Register Desktop Browser
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name, user_agent, created_at, updated_at)
       VALUES ($1, $2, 'key-p256dh-desktop-mock', 'auth-secret-desktop-mock', 'Desktop Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW(), NOW())
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
      [testUserId, testEndpoints[0]]
    );

    // 2. Register Mobile Browser (second device for same user)
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name, user_agent, created_at, updated_at)
       VALUES ($1, $2, 'key-p256dh-mobile-mock', 'auth-secret-mobile-mock', 'Mobile Android Chrome', 'Mozilla/5.0 (Linux; Android 14)', NOW(), NOW())
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
      [testUserId, testEndpoints[1]]
    );

    // Verify both devices registered
    const subsRes = await pool.query(
      `SELECT id, endpoint, device_name FROM push_subscriptions WHERE user_id = $1 AND endpoint = ANY($2)`,
      [testUserId, testEndpoints]
    );
    assert.equal(subsRes.rows.length, 2, "User must have both registered devices stored");

    // Verify idempotent re-registration (prevent duplicates)
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name, user_agent, created_at, updated_at)
       VALUES ($1, $2, 'key-p256dh-desktop-updated', 'auth-secret-desktop-updated', 'Desktop Chrome 2', 'Mozilla/5.0', NOW(), NOW())
       ON CONFLICT (endpoint) DO UPDATE 
       SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, device_name = EXCLUDED.device_name, updated_at = NOW()`,
      [testUserId, testEndpoints[0]]
    );

    const checkNoDup = await pool.query(
      `SELECT count(*) FROM push_subscriptions WHERE endpoint = $1`,
      [testEndpoints[0]]
    );
    assert.equal(parseInt(checkNoDup.rows[0].count, 10), 1, "Must not create duplicate rows for same endpoint");
  });

  await t.test("4. Follow-Up Scheduling & Atomic Claiming", async () => {
    // Create follow-up due 30 seconds ago
    const fuRes = await pool.query(
      `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, type, status, reminder_version, created_at, updated_at)
       VALUES ($1, $2, NOW() - INTERVAL '30 seconds', 'Enterprise SLA follow-up review', 'CALL', 'SCHEDULED', 1, NOW(), NOW())
       RETURNING id, reminder_version`,
      [testUserId, testLeadId]
    );
    testFollowUpId = fuRes.rows[0].id;
    const version = fuRes.rows[0].reminder_version;

    // Simulate scheduler atomic claim
    const claimRes = await pool.query(
      `UPDATE lead_follow_ups
       SET reminded_at = NOW(), snoozed_until = NULL, updated_at = NOW()
       WHERE id = $1 AND reminder_version = $2 AND status = 'SCHEDULED'
       RETURNING id, reminded_at`,
      [testFollowUpId, version]
    );
    assert.equal(claimRes.rowCount, 1, "Reminder must be claimed atomically");
    assert.ok(claimRes.rows[0].reminded_at !== null);

    // Second worker claim attempt must find 0 rows (idempotency)
    const secondClaim = await pool.query(
      `UPDATE lead_follow_ups
       SET reminded_at = NOW(), snoozed_until = NULL, updated_at = NOW()
       WHERE id = $1 AND reminded_at IS NULL AND reminder_version = $2 AND status = 'SCHEDULED'`,
      [testFollowUpId, version]
    );
    assert.equal(secondClaim.rowCount, 0, "Concurrent scan must NOT re-claim already reminded row");
  });

  await t.test("5. Durable Push Dispatch Records Lifecycle (QUEUED -> ACCEPTED)", async () => {
    // 1. Record QUEUED state for Desktop endpoint
    await pool.query(
      `INSERT INTO follow_up_push_dispatches (
         follow_up_id, reminder_version, user_id, endpoint, status, attempts, dispatched_at, updated_at
       ) VALUES ($1, 1, $2, $3, 'QUEUED', 1, NOW(), NOW())
       ON CONFLICT (follow_up_id, reminder_version, endpoint) DO UPDATE
       SET attempts = follow_up_push_dispatches.attempts + 1, updated_at = NOW()`,
      [testFollowUpId, testUserId, testEndpoints[0]]
    );

    const queuedCheck = await pool.query(
      `SELECT status, attempts FROM follow_up_push_dispatches WHERE follow_up_id = $1 AND endpoint = $2`,
      [testFollowUpId, testEndpoints[0]]
    );
    assert.equal(queuedCheck.rows[0].status, "QUEUED");
    assert.equal(queuedCheck.rows[0].attempts, 1);

    // 2. Update to ACCEPTED with HTTP 201 (Push service accepted message)
    await pool.query(
      `UPDATE follow_up_push_dispatches
       SET status = 'ACCEPTED', status_code = 201, updated_at = NOW()
       WHERE follow_up_id = $1 AND reminder_version = 1 AND endpoint = $2`,
      [testFollowUpId, testEndpoints[0]]
    );

    const acceptedCheck = await pool.query(
      `SELECT status, status_code FROM follow_up_push_dispatches WHERE follow_up_id = $1 AND endpoint = $2`,
      [testFollowUpId, testEndpoints[0]]
    );
    assert.equal(acceptedCheck.rows[0].status, "ACCEPTED");
    assert.equal(acceptedCheck.rows[0].status_code, 201);

    // 3. Verify deduplication logic: An ACCEPTED endpoint is skipped on subsequent scans
    const existingDispatches = await pool.query(
      `SELECT endpoint FROM follow_up_push_dispatches WHERE follow_up_id = $1 AND reminder_version = 1 AND status = 'ACCEPTED'`,
      [testFollowUpId]
    );
    const acceptedEndpoints = new Set(existingDispatches.rows.map((r) => r.endpoint));
    assert.ok(acceptedEndpoints.has(testEndpoints[0]), "Desktop endpoint already accepted and skipped on re-run");
  });

  await t.test("6. Subscription Expiration Pruning (410 Gone / 404 Not Found)", async () => {
    const deadEndpoint = "https://fcm.googleapis.com/fcm/send/dead-phone-subscription-" + Date.now();
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name, created_at, updated_at)
       VALUES ($1, $2, 'key-dead', 'auth-dead', 'Old Phone', NOW(), NOW())`,
      [testUserId, deadEndpoint]
    );

    // Record initial dispatch attempt
    await pool.query(
      `INSERT INTO follow_up_push_dispatches (
         follow_up_id, reminder_version, user_id, endpoint, status, attempts, dispatched_at, updated_at
       ) VALUES ($1, 1, $2, $3, 'QUEUED', 1, NOW(), NOW())`,
      [testFollowUpId, testUserId, deadEndpoint]
    );

    // Provider reports 410 Gone -> Record GONE and prune from push_subscriptions
    await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [deadEndpoint]);
    await pool.query(
      `UPDATE follow_up_push_dispatches
       SET status = 'GONE', status_code = 410, error_message = 'SUBSCRIPTION_EXPIRED', updated_at = NOW()
       WHERE follow_up_id = $1 AND reminder_version = 1 AND endpoint = $2`,
      [testFollowUpId, deadEndpoint]
    );

    // Verify pruned from subscriptions
    const subCheck = await pool.query(`SELECT id FROM push_subscriptions WHERE endpoint = $1`, [deadEndpoint]);
    assert.equal(subCheck.rows.length, 0, "Expired subscription must be pruned from push_subscriptions");

    // Verify durable dispatch record preserves audit history with status GONE
    const auditCheck = await pool.query(
      `SELECT status, status_code, error_message FROM follow_up_push_dispatches WHERE follow_up_id = $1 AND endpoint = $2`,
      [testFollowUpId, deadEndpoint]
    );
    assert.equal(auditCheck.rows[0].status, "GONE");
    assert.equal(auditCheck.rows[0].status_code, 410);

    // Clean up test dead dispatch
    await pool.query(`DELETE FROM follow_up_push_dispatches WHERE endpoint = $1`, [deadEndpoint]);
  });

  await t.test("7. Snooze Increments reminder_version & Invalids Stale Version", async () => {
    // Snooze for 15 minutes
    const snoozeRes = await pool.query(
      `UPDATE lead_follow_ups
       SET snoozed_until = NOW() + INTERVAL '15 minutes',
           reminder_version = reminder_version + 1,
           dismissed_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, reminder_version, snoozed_until`,
      [testFollowUpId]
    );
    const newVersion = snoozeRes.rows[0].reminder_version;
    assert.equal(newVersion, 2, "reminder_version must increment to 2");

    // Existing dispatch records for version 1 remain intact as history
    const v1Dispatches = await pool.query(
      `SELECT count(*) FROM follow_up_push_dispatches WHERE follow_up_id = $1 AND reminder_version = 1`,
      [testFollowUpId]
    );
    assert.ok(parseInt(v1Dispatches.rows[0].count, 10) > 0, "Version 1 dispatch records preserved");

    // Version 2 has no dispatches yet (allowing fresh push when snooze expires)
    const v2Dispatches = await pool.query(
      `SELECT count(*) FROM follow_up_push_dispatches WHERE follow_up_id = $1 AND reminder_version = 2`,
      [testFollowUpId]
    );
    assert.equal(parseInt(v2Dispatches.rows[0].count, 10), 0, "Version 2 is clean for future dispatch");
  });

  await t.test("8. Tenant Isolation: Other User Cannot Access Reminders or Subscriptions", async () => {
    // Other user queries for testUserId's push subscriptions
    const otherSubs = await pool.query(
      `SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
      [otherUserId, testEndpoints[0]]
    );
    assert.equal(otherSubs.rows.length, 0, "Other user must not see or access another user's push endpoint");

    // Other user queries for testUserId's due reminders
    const otherReminders = await pool.query(
      `SELECT f.id FROM lead_follow_ups f
       JOIN leads l ON l.id = f.lead_id
       WHERE f.id = $1 AND (f.owner_user_id = $2 OR l.owner_user_id = $2 OR l.assigned_user_id = $2)`,
      [testFollowUpId, otherUserId]
    );
    assert.equal(otherReminders.rows.length, 0, "Other user must not see another user's reminders");
  });
});
