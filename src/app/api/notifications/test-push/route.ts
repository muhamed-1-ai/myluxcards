import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendWebPushToUser } from "@/lib/webpush";

// In-memory rate limiting map: userId -> last test push timestamp (ms)
const testPushRateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized access." }, { status: 401 });
  }

  // Rate limit check
  const now = Date.now();
  const lastSent = testPushRateLimitMap.get(identity.id) || 0;
  if (now - lastSent < RATE_LIMIT_WINDOW_MS) {
    const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - lastSent)) / 1000);
    return NextResponse.json(
      {
        ok: false,
        error: "RATE_LIMITED",
        message: `Please wait ${waitSeconds}s before requesting another test notification.`,
      },
      { status: 429 }
    );
  }
  testPushRateLimitMap.set(identity.id, now);

  try {
    const body = await request.json().catch(() => ({}));
    const targetEndpoint = body?.endpoint ? String(body.endpoint) : undefined;

    const subRes = await pool.query<{ count: string }>(
      `SELECT count(*) FROM push_subscriptions WHERE user_id = $1`,
      [identity.id]
    );
    const subscriptionCount = parseInt(subRes.rows[0]?.count || "0", 10);

    // 1. Emit in-app notification via SSE (independent channel)
    await createNotification({
      userId: identity.id,
      type: "SYSTEM_ALERT",
      title: "Test Notification",
      body: "In-app delivery channel verified successfully.",
      entityType: "system_test",
      entityId: "test-notification",
      actionUrl: "/dashboard",
      metadata: { test: true, timestamp: now },
    });

    if (subscriptionCount === 0) {
      return NextResponse.json({
        ok: false,
        error: "NO_SUBSCRIPTIONS",
        message: "No push subscriptions registered for your user. Please click 'Enable follow-up notifications' on this device first.",
        subscriptionCount: 0,
      });
    }

    // 2. Dispatch real Web Push through full backend-to-push-service-to-device flow
    const pushResult = await sendWebPushToUser(
      identity.id,
      {
        title: "Zappit Push Test",
        body: "Real device push notifications are working on your device!",
        icon: "/brand/zappit-mark.png",
        badge: "/brand/zappit-mark.png",
        tag: "zappit-test-notification",
        data: {
          url: "/dashboard",
          test: true,
          timestamp: now,
        },
      },
      { targetEndpoint }
    );

    const isSuccess = pushResult.sent > 0;
    return NextResponse.json({
      ok: isSuccess,
      message: isSuccess
        ? `Test notification sent: ${pushResult.sent} device(s) delivered.`
        : `Could not deliver push notification to device(s): ${pushResult.failed} failed.`,
      stats: pushResult,
      subscriptionCount,
    });
  } catch (error: any) {
    console.error("[Test Push POST] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Failed to dispatch test notification." },
      { status: 500 }
    );
  }
}
