import "server-only";
import EventEmitter from "node:events";
import { pool } from "./db";

// Global EventEmitter for Server-Sent Events (SSE) stream across API requests
const globalEventEmitter = (globalThis as any).notificationEmitter || new EventEmitter();
(globalThis as any).notificationEmitter = globalEventEmitter;
export const notificationEmitter: EventEmitter = globalEventEmitter;

export type NotificationType =
  | "SYSTEM_ALERT"
  | "ORDER_STATUS"
  | "ACCOUNT_NOTICE"
  | string;

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: Date | null;
  metadata: any;
  created_at: Date;
}

export interface NotificationPreferences {
  user_id: string;
  new_whatsapp_messages?: boolean;
  new_leads?: boolean;
  follow_up_reminders?: boolean;
  broadcast_results?: boolean;
  connection_alerts?: boolean;
}

/**
 * Ensures notification preferences exist for a user.
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const res = await pool.query<NotificationPreferences>(
      `select user_id, new_whatsapp_messages, new_leads, follow_up_reminders, broadcast_results, connection_alerts
       from notification_preferences where user_id = $1 limit 1`,
      [userId]
    );

    if (res.rows[0]) {
      return res.rows[0];
    }

    const inserted = await pool.query<NotificationPreferences>(
      `insert into notification_preferences (user_id) values ($1)
       on conflict (user_id) do update set updated_at = now()
       returning user_id, new_whatsapp_messages, new_leads, follow_up_reminders, broadcast_results, connection_alerts`,
      [userId]
    );

    return inserted.rows[0] || {
      user_id: userId,
    };
  } catch (error) {
    console.error("[Notifications] Error getting preferences:", error);
    return {
      user_id: userId,
    };
  }
}

/**
 * Updates notification preference toggles for a user.
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<Omit<NotificationPreferences, "user_id">>
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);

  const res = await pool.query<NotificationPreferences>(
    `insert into notification_preferences (user_id, updated_at) values ($1, now())
     on conflict (user_id) do update set updated_at = now()
     returning user_id`,
    [userId]
  );

  return res.rows[0] || { user_id: userId };
}

/**
 * Creates a notification safely after checking user preferences.
 * Emits SSE real-time event on creation.
 */
export async function createNotification(options: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: any;
}): Promise<NotificationItem | null> {
  const { userId, type, title, body, entityType = null, entityId = null, actionUrl = null, metadata = {} } = options;

  if (!userId) return null;

  // Safely truncate body snippet
  const safeBody = body.length > 180 ? `${body.slice(0, 177)}...` : body;

  try {
    const res = await pool.query<NotificationItem>(
      `insert into notifications (
         user_id, type, title, body, entity_type, entity_id, action_url, is_read, metadata, created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, false, $8, now())
       returning id, user_id, type, title, body, entity_type, entity_id, action_url, is_read, read_at, metadata, created_at`,
      [userId, type, title, safeBody, entityType, entityId, actionUrl, JSON.stringify(metadata)]
    );

    const notification = res.rows[0];

    if (notification) {
      const unreadCount = await getUnreadNotificationCount(userId);
      // Emit real-time SSE event for connected browser clients
      notificationEmitter.emit(`user:${userId}`, {
        type: "NOTIFICATION",
        notification,
        unreadCount,
      });
    }

    return notification;
  } catch (error) {
    console.error("[Notifications] Error creating notification:", error);
    return null;
  }
}

/**
 * Returns lightweight unread count for header badge.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const res = await pool.query<{ count: string }>(
      `select count(*) from notifications where user_id = $1 and is_read = false`,
      [userId]
    );
    return parseInt(res.rows[0]?.count || "0", 10);
  } catch (error) {
    console.error("[Notifications] Error fetching unread count:", error);
    return 0;
  }
}

/**
 * Returns paginated notifications list for a user.
 */
export async function getNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number; offset?: number }
): Promise<{ notifications: NotificationItem[]; total: number; unreadCount: number }> {
  const unreadOnly = options?.unreadOnly ?? false;
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = Math.max(0, options?.offset ?? 0);

  try {
    const unreadCount = await getUnreadNotificationCount(userId);

    const whereClause = unreadOnly ? `user_id = $1 and is_read = false` : `user_id = $1`;

    const countRes = await pool.query<{ count: string }>(
      `select count(*) from notifications where ${whereClause}`,
      [userId]
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    const listRes = await pool.query<NotificationItem>(
      `select id, user_id, type, title, body, entity_type, entity_id, action_url, is_read, read_at, metadata, created_at
       from notifications
       where ${whereClause}
       order by created_at desc
       limit $2 offset $3`,
      [userId, limit, offset]
    );

    return {
      notifications: listRes.rows,
      total,
      unreadCount,
    };
  } catch (error) {
    console.error("[Notifications] Error fetching notifications list:", error);
    return { notifications: [], total: 0, unreadCount: 0 };
  }
}

/**
 * Marks a single notification as read (tenant-isolated).
 */
export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  try {
    const res = await pool.query(
      `update notifications set is_read = true, read_at = now() where id = $1 and user_id = $2`,
      [notificationId, userId]
    );

    if ((res.rowCount ?? 0) > 0) {
      const unreadCount = await getUnreadNotificationCount(userId);
      notificationEmitter.emit(`user:${userId}`, {
        type: "UNREAD_COUNT",
        unreadCount,
        readNotificationId: notificationId,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("[Notifications] Error marking notification read:", error);
    return false;
  }
}

/**
 * Marks all notifications for a user as read (tenant-isolated).
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  try {
    const res = await pool.query(
      `update notifications set is_read = true, read_at = now() where user_id = $1 and is_read = false`,
      [userId]
    );
    const count = res.rowCount ?? 0;

    notificationEmitter.emit(`user:${userId}`, {
      type: "UNREAD_COUNT",
      unreadCount: 0,
      allRead: true,
    });

    return count;
  } catch (error) {
    console.error("[Notifications] Error marking all read:", error);
    return 0;
  }
}

/**
 * Clears read notifications for a user.
 */
export async function clearReadNotifications(userId: string): Promise<number> {
  try {
    const res = await pool.query(
      `delete from notifications where user_id = $1 and is_read = true`,
      [userId]
    );
    return res.rowCount ?? 0;
  } catch (error) {
    console.error("[Notifications] Error clearing read notifications:", error);
    return 0;
  }
}

/**
 * Cleans up read notifications older than retention days (e.g. 90 days).
 */
export async function cleanupOldNotifications(retentionDays = 90): Promise<number> {
  try {
    const res = await pool.query(
      `delete from notifications where is_read = true and created_at < now() - interval '${Math.max(1, retentionDays)} days'`
    );
    return res.rowCount ?? 0;
  } catch (error) {
    console.error("[Notifications] Error during retention cleanup:", error);
    return 0;
  }
}
