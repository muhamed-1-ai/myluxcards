import "server-only";
import webpush from "web-push";
import { pool } from "./db";

const DEFAULT_VAPID_PUBLIC =
  "BOszK1kUrgWO5VO8GUdES-6k7MFaDZ6ZBgv07FrSXnW9cCHmDbTJwT6wZUuRx1H-9_ifMJmRZUfyRccRM08Rdbk";
const DEFAULT_VAPID_PRIVATE =
  "52nmGN87l7kZPIXw79fFYEFbQufOGZWVl0UVMoadQk4";
const DEFAULT_VAPID_SUBJECT = "mailto:support@zappit.io";

const vapidPublicKey =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  DEFAULT_VAPID_PUBLIC;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE;
const vapidSubject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

try {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} catch (err) {
  console.error("[WebPush] Failed to initialize VAPID details:", err);
}

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  data?: {
    url?: string;
    followUpId?: string;
    leadId?: string;
    leadName?: string;
    type?: string;
    scheduledAt?: string;
    timestamp?: number;
    [key: string]: any;
  };
}

export interface StoredPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_name?: string | null;
  user_agent?: string | null;
}

/**
 * Sends a web push notification to a single subscription.
 * Automatically deletes subscriptions on 404/410 Gone.
 * Retries transient failures up to maxRetries times.
 */
export async function sendWebPushToSubscription(
  sub: StoredPushSubscription,
  payload: PushNotificationPayload,
  maxRetries = 2
): Promise<{ success: boolean; statusCode?: number; removed?: boolean; error?: string }> {
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  const notificationString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/badge-72x72.png",
    tag: payload.tag || "zappit-notification",
    renotify: payload.renotify ?? true,
    requireInteraction: payload.requireInteraction ?? false,
    data: payload.data || {},
  });

  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await webpush.sendNotification(pushSubscription, notificationString, {
        TTL: 86400, // 24 hours
        urgency: "high",
      });
      return { success: true, statusCode: res.statusCode };
    } catch (err: any) {
      const statusCode = err.statusCode || err.status;
      // If subscription expired or was cancelled by user agent
      if (statusCode === 404 || statusCode === 410) {
        console.warn(`[WebPush] Subscription expired or gone (${statusCode}). Deleting: ${sub.endpoint.slice(0, 40)}...`);
        try {
          await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]);
          return { success: false, statusCode, removed: true, error: "SUBSCRIPTION_EXPIRED" };
        } catch (dbErr) {
          console.error("[WebPush] Error deleting expired subscription:", dbErr);
          return { success: false, statusCode, removed: false, error: "SUBSCRIPTION_EXPIRED" };
        }
      }

      // Check if retryable (e.g. 429 rate limit or 5xx temporary server error)
      if ((statusCode === 429 || (statusCode >= 500 && statusCode < 600)) && attempt < maxRetries) {
        attempt++;
        const backoffMs = Math.min(2000 * Math.pow(2, attempt), 6000);
        console.warn(`[WebPush] Transient error (${statusCode}), retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      console.error(`[WebPush] Push delivery failed (${statusCode || "network"}):`, err?.message || err);
      return { success: false, statusCode, error: err?.message || "PUSH_FAILED" };
    }
  }

  return { success: false, error: "MAX_RETRIES_EXCEEDED" };
}

/**
 * Sends a push notification to all registered devices for a given user.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  try {
    const res = await pool.query<StoredPushSubscription>(
      `SELECT id, user_id, endpoint, p256dh, auth, device_name, user_agent
       FROM push_subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return { sent: 0, failed: 0, removed: 0 };
    }

    const results = await Promise.allSettled(
      res.rows.map((sub) => sendWebPushToSubscription(sub, payload))
    );

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.success) sent++;
        else {
          failed++;
          if (r.value.removed) removed++;
        }
      } else {
        failed++;
      }
    }

    return { sent, failed, removed };
  } catch (error) {
    console.error("[WebPush] Error delivering push to user:", error);
    return { sent: 0, failed: 0, removed: 0 };
  }
}
