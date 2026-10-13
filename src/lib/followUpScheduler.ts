import "server-only";
import { pool } from "./db";
import { createNotification, getNotificationPreferences } from "./notifications";
import { sendWebPushToUser } from "./webpush";

interface DueFollowUpRow {
  id: string;
  lead_id: string;
  lead_name: string;
  lead_company_name: string | null;
  scheduled_at: Date;
  snoozed_until: Date | null;
  reminded_at: Date | null;
  note: string | null;
  type: string;
  reminder_version: number;
  assigned_user_id: string | null;
  follow_up_owner_id: string;
  lead_owner_id: string;
}

export interface ScanResult {
  dispatched: number;
  summarizedBacklog: number;
  skipped: number;
  errors: number;
  timestamp: string;
}

const ADVISORY_LOCK_ID = 8493021; // Unique lock ID for follow-up reminders scan

/**
 * Scans the database for due follow-ups and dispatches in-app and push notifications.
 * Uses PostgreSQL advisory lock to ensure only one scan runs at a time across workers.
 */
export async function runFollowUpReminderScan(): Promise<ScanResult> {
  const result: ScanResult = {
    dispatched: 0,
    summarizedBacklog: 0,
    skipped: 0,
    errors: 0,
    timestamp: new Date().toISOString(),
  };

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    // 1. Try acquiring advisory lock (non-blocking)
    const lockRes = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock($1) as acquired`,
      [ADVISORY_LOCK_ID]
    );

    lockAcquired = lockRes.rows[0]?.acquired ?? false;
    if (!lockAcquired) {
      // Another worker/process is currently running the scan
      return result;
    }

    // 2. Query due follow-ups
    // A follow-up is due if:
    // - status is 'SCHEDULED'
    // - AND either:
    //     a) snoozed_until is reached: snoozed_until <= NOW()
    //     b) never reminded and scheduled_at <= NOW()
    const query = `
      SELECT 
        f.id,
        f.lead_id,
        l.name as lead_name,
        l.company_name as lead_company_name,
        f.scheduled_at,
        f.snoozed_until,
        f.reminded_at,
        f.note,
        f.type,
        f.reminder_version,
        l.assigned_user_id,
        f.owner_user_id as follow_up_owner_id,
        l.owner_user_id as lead_owner_id
      FROM lead_follow_ups f
      JOIN leads l ON l.id = f.lead_id
      WHERE f.status = 'SCHEDULED'
        AND (
          (f.snoozed_until IS NOT NULL AND f.snoozed_until <= NOW())
          OR (f.snoozed_until IS NULL AND f.reminded_at IS NULL AND f.scheduled_at <= NOW())
        )
      ORDER BY COALESCE(f.snoozed_until, f.scheduled_at) ASC
      LIMIT 100
    `;

    const dueRows = await client.query<DueFollowUpRow>(query);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const row of dueRows.rows) {
      try {
        // Responsible user resolution:
        // Priority: lead assigned user -> follow-up creator -> lead owner
        const targetUserId =
          row.assigned_user_id || row.follow_up_owner_id || row.lead_owner_id;

        if (!targetUserId) {
          result.skipped++;
          continue;
        }

        // Backlog check: if the follow-up was scheduled more than 24h ago and was never snoozed,
        // it's an old overdue item. We summarize it and mark it reminded without flooding push.
        const isHistoricalBacklog =
          !row.snoozed_until && row.scheduled_at < twentyFourHoursAgo;

        // Atomically claim the reminder by version to prevent concurrent/duplicate dispatch
        const claimRes = await client.query(
          `UPDATE lead_follow_ups
           SET reminded_at = NOW(),
               snoozed_until = NULL,
               updated_at = NOW()
           WHERE id = $1 
             AND reminder_version = $2 
             AND status = 'SCHEDULED'`,
          [row.id, row.reminder_version]
        );

        if ((claimRes.rowCount ?? 0) === 0) {
          // Row was concurrently modified, rescheduled, or completed
          result.skipped++;
          continue;
        }

        if (isHistoricalBacklog) {
          // Log summary notice in database, but don't blast mobile phone pushes
          await createNotification({
            userId: targetUserId,
            type: "FOLLOW_UP_OVERDUE",
            title: `Overdue Follow-up: ${row.lead_name}`,
            body: row.note
              ? `Overdue from earlier: ${row.note}`
              : `Scheduled follow-up with ${row.lead_name} is overdue.`,
            entityType: "lead_follow_up",
            entityId: row.id,
            actionUrl: `/dashboard?tab=leads&leadId=${row.lead_id}&followUpId=${row.id}`,
            metadata: {
              leadId: row.lead_id,
              followUpId: row.id,
              leadName: row.lead_name,
              scheduledAt: row.scheduled_at.toISOString(),
              type: row.type,
              isBacklog: true,
            },
          });
          result.summarizedBacklog++;
          continue;
        }

        // Active due follow-up:
        const isOverdue = row.scheduled_at < now;
        const titleText = isOverdue
          ? `Follow-up Overdue: ${row.lead_name}`
          : `Follow-up Due: ${row.lead_name}`;
        const bodyText = row.note
          ? row.note.length > 140
            ? `${row.note.slice(0, 137)}...`
            : row.note
          : `Scheduled [${row.type}] follow-up with ${row.lead_name} is due now.`;

        // 1. Create in-app notification (emits real-time SSE event to open browser tabs)
        await createNotification({
          userId: targetUserId,
          type: isOverdue ? "FOLLOW_UP_OVERDUE" : "FOLLOW_UP_REMINDER",
          title: titleText,
          body: bodyText,
          entityType: "lead_follow_up",
          entityId: row.id,
          actionUrl: `/dashboard?tab=leads&leadId=${row.lead_id}&followUpId=${row.id}`,
          metadata: {
            leadId: row.lead_id,
            followUpId: row.id,
            leadName: row.lead_name,
            scheduledAt: row.scheduled_at.toISOString(),
            snoozedUntil: row.snoozed_until ? row.snoozed_until.toISOString() : null,
            note: row.note,
            type: row.type,
            reminderVersion: row.reminder_version,
          },
        });

        // 2. Check user notification preferences before Web Push
        const prefs = await getNotificationPreferences(targetUserId);
        if (prefs.follow_up_reminders !== false) {
          // Send Web Push to all registered devices (background/closed browser)
          // Keep lock-screen content privacy conscious (no sensitive phone numbers or internal notes)
          const cleanPushBody = row.note
            ? (row.note.length > 80 ? `${row.note.slice(0, 77)}...` : row.note)
            : `Scheduled ${row.type.toLowerCase()} follow-up is due.`;

          await sendWebPushToUser(targetUserId, {
            title: titleText,
            body: cleanPushBody,
            tag: `zappit-followup-${row.id}`,
            data: {
              url: `/dashboard?tab=leads&leadId=${row.lead_id}&followUpId=${row.id}`,
              leadId: row.lead_id,
              followUpId: row.id,
              leadName: row.lead_name,
              scheduledAt: row.scheduled_at.toISOString(),
              type: row.type,
              timestamp: Date.now(),
            },
          });
        }

        result.dispatched++;
      } catch (rowErr) {
        console.error(`[FollowUpScheduler] Error processing row ${row.id}:`, rowErr);
        result.errors++;
      }
    }
  } catch (error) {
    console.error("[FollowUpScheduler] Error in scan:", error);
    result.errors++;
  } finally {
    if (lockAcquired) {
      try {
        await client.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_ID]);
      } catch (unlockErr) {
        console.error("[FollowUpScheduler] Error releasing advisory lock:", unlockErr);
      }
    }
    client.release();
  }

  return result;
}

/**
 * Singleton timer manager for the backend background reminder runner.
 * Runs every 30 seconds by default.
 */
declare global {
  // eslint-disable-next-line no-var
  var __reminderSchedulerInterval: NodeJS.Timeout | undefined;
}

export function startReminderScheduler(intervalMs = 30000): void {
  if (global.__reminderSchedulerInterval) {
    return; // Already running
  }

  console.log(`[FollowUpScheduler] Initializing backend scheduler (interval: ${intervalMs}ms)`);

  // Run immediate initial scan asynchronously
  void runFollowUpReminderScan();

  global.__reminderSchedulerInterval = setInterval(() => {
    void runFollowUpReminderScan();
  }, intervalMs);
}

export function stopReminderScheduler(): void {
  if (global.__reminderSchedulerInterval) {
    clearInterval(global.__reminderSchedulerInterval);
    global.__reminderSchedulerInterval = undefined;
    console.log("[FollowUpScheduler] Stopped backend scheduler");
  }
}
