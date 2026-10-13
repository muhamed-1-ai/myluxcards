import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendWebPushToUser } from "@/lib/webpush";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized access." }, { status: 401 });
  }

  try {
    const subRes = await pool.query<{ count: string }>(
      `SELECT count(*) FROM push_subscriptions WHERE user_id = $1`,
      [identity.id]
    );
    const subscriptionCount = parseInt(subRes.rows[0]?.count || "0", 10);

    // 1. Emit in-app notification via SSE
    await createNotification({
      userId: identity.id,
      type: "SYSTEM_ALERT",
      title: "Test Notification",
      body: "In-app delivery channel verified successfully.",
      entityType: "system_test",
      entityId: "test-notification",
      actionUrl: "/dashboard",
      metadata: { test: true, timestamp: Date.now() },
    });

    if (subscriptionCount === 0) {
      return NextResponse.json({
        ok: false,
        error: "NO_SUBSCRIPTIONS",
        message: "No push subscriptions registered for your user. Please click 'Enable Notifications' on this device first.",
        subscriptionCount: 0,
      });
    }

    // 2. Dispatch real Web Push through full backend-to-phone delivery path
    const pushResult = await sendWebPushToUser(identity.id, {
      title: "Zappit Push Test",
      body: "Real device push notifications are working on your device!",
      tag: "zappit-test-notification",
      data: {
        url: "/dashboard",
        test: true,
        timestamp: Date.now(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Test notification sent: ${pushResult.sent} device(s) delivered, ${pushResult.failed} failed.`,
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
