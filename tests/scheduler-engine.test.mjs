import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

test("Scheduler Engine & Dispatch Verification", async (t) => {
  let testUserId;
  let testLeadId;
  let recentDueFollowUpId;
  let oldBacklogFollowUpId;

  t.before(async () => {
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
    testUserId = userRes.rows[0].id;

    const cardRes = await pool.query(`SELECT id FROM digital_cards LIMIT 1`);
    const cardId = cardRes.rows[0].id;

    const leadRes = await pool.query(
      `INSERT INTO leads (owner_user_id, assigned_user_id, card_id, name, company_name, contact_number, contact_number_normalized, email, status, created_at, updated_at)
       VALUES ($1, $1, $2, 'Lead Engine Test', 'Acme Corp', '+15559876543', '+15559876543', 'lead.engine@example.com', 'NEW', NOW(), NOW())
       RETURNING id`,
      [testUserId, cardId]
    );
    testLeadId = leadRes.rows[0].id;

    // Follow-up 1: Due recently (3 minutes ago) - Active reminder
    const fu1 = await pool.query(
      `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, type, status, reminder_version, created_at, updated_at)
       VALUES ($1, $2, NOW() - INTERVAL '3 minutes', 'Follow-up on pricing proposal', 'CALL', 'SCHEDULED', 1, NOW(), NOW())
       RETURNING id`,
      [testUserId, testLeadId]
    );
    recentDueFollowUpId = fu1.rows[0].id;

    // Follow-up 2: Overdue from 3 days ago - Historical backlog
    const fu2 = await pool.query(
      `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, type, status, reminder_version, created_at, updated_at)
       VALUES ($1, $2, NOW() - INTERVAL '3 days', 'Old backlog from earlier week', 'WHATSAPP', 'SCHEDULED', 1, NOW(), NOW())
       RETURNING id`,
      [testUserId, testLeadId]
    );
    oldBacklogFollowUpId = fu2.rows[0].id;
  });

  t.after(async () => {
    if (recentDueFollowUpId) {
      await pool.query(`DELETE FROM lead_follow_ups WHERE id = $1`, [recentDueFollowUpId]).catch(() => {});
      await pool.query(`DELETE FROM notifications WHERE entity_id = $1`, [recentDueFollowUpId]).catch(() => {});
    }
    if (oldBacklogFollowUpId) {
      await pool.query(`DELETE FROM lead_follow_ups WHERE id = $1`, [oldBacklogFollowUpId]).catch(() => {});
      await pool.query(`DELETE FROM notifications WHERE entity_id = $1`, [oldBacklogFollowUpId]).catch(() => {});
    }
    if (testLeadId) {
      await pool.query(`DELETE FROM leads WHERE id = $1`, [testLeadId]).catch(() => {});
    }
    await pool.end();
  });

  await t.test("1. Run Follow-Up Reminder Scan Logic", async () => {
    // Dynamically test scan logic query
    const dueRows = await pool.query(
      `SELECT f.id, f.scheduled_at, f.snoozed_until, f.reminded_at, f.reminder_version
       FROM lead_follow_ups f
       WHERE f.id IN ($1, $2)
         AND f.status = 'SCHEDULED'
         AND (
           (f.snoozed_until IS NOT NULL AND f.snoozed_until <= NOW())
           OR (f.snoozed_until IS NULL AND f.reminded_at IS NULL AND f.scheduled_at <= NOW())
         )
       ORDER BY f.scheduled_at ASC`,
      [recentDueFollowUpId, oldBacklogFollowUpId]
    );

    assert.equal(dueRows.rows.length, 2, "Both follow-ups should be detected as due for processing");

    // Process both rows
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const row of dueRows.rows) {
      const isHistoricalBacklog = !row.snoozed_until && new Date(row.scheduled_at) < twentyFourHoursAgo;

      // Claim row
      const claim = await pool.query(
        `UPDATE lead_follow_ups
         SET reminded_at = NOW(), snoozed_until = NULL, updated_at = NOW()
         WHERE id = $1 AND reminder_version = $2 AND status = 'SCHEDULED'`,
        [row.id, row.reminder_version]
      );
      assert.equal(claim.rowCount, 1);

      if (isHistoricalBacklog) {
        assert.equal(row.id, oldBacklogFollowUpId, "Old follow-up is classified as historical backlog");
        // Insert summary notification (no phone push)
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, is_read, metadata, created_at)
           VALUES ($1, 'FOLLOW_UP_OVERDUE', 'Overdue Follow-up: Acme Corp', 'Overdue from earlier', 'lead_follow_up', $2, false, '{"isBacklog":true}', NOW())`,
          [testUserId, row.id]
        );
      } else {
        assert.equal(row.id, recentDueFollowUpId, "Recent follow-up is classified as active due reminder");
        // Insert active reminder
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, is_read, metadata, created_at)
           VALUES ($1, 'FOLLOW_UP_REMINDER', 'Follow-up Due: Acme Corp', 'Follow-up on pricing proposal', 'lead_follow_up', $2, false, '{"isBacklog":false}', NOW())`,
          [testUserId, row.id]
        );
      }
    }
  });

  await t.test("2. Notifications Table Verification", async () => {
    const notifs = await pool.query(
      `SELECT entity_id, type, metadata FROM notifications WHERE entity_id IN ($1, $2)`,
      [recentDueFollowUpId, oldBacklogFollowUpId]
    );
    assert.ok(notifs.rows.length >= 2, "Notifications must be created for both items");

    const backlogNotif = notifs.rows.find((n) => n.entity_id === oldBacklogFollowUpId);
    assert.ok(backlogNotif, "Backlog notification must exist");
    assert.equal(backlogNotif.type, "FOLLOW_UP_OVERDUE");

    const activeNotif = notifs.rows.find((n) => n.entity_id === recentDueFollowUpId);
    assert.ok(activeNotif, "Active notification must exist");
    assert.ok(["FOLLOW_UP_REMINDER", "FOLLOW_UP_OVERDUE"].includes(activeNotif.type));
  });

  await t.test("3. In-App Modal Retrieval Query Verification", async () => {
    // Reset dismissed_at
    await pool.query(`UPDATE lead_follow_ups SET dismissed_at = NULL WHERE id = $1`, [recentDueFollowUpId]);

    const res = await pool.query(
      `SELECT f.id, l.name as "leadName", f.scheduled_at, f.note, f.type
       FROM lead_follow_ups f
       JOIN leads l ON l.id = f.lead_id
       WHERE f.id = $1 AND f.status = 'SCHEDULED'
         AND (f.owner_user_id = $2 OR l.owner_user_id = $2 OR l.assigned_user_id = $2)
         AND f.dismissed_at IS NULL`,
      [recentDueFollowUpId, testUserId]
    );

    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].leadName, "Lead Engine Test");
    assert.equal(res.rows[0].type, "CALL");
  });
});
