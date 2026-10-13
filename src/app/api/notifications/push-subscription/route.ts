import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized access." }, { status: 401 });
  }

  try {
    const res = await pool.query<{ count: string }>(
      `SELECT count(*) FROM push_subscriptions WHERE user_id = $1`,
      [identity.id]
    );
    const count = parseInt(res.rows[0]?.count || "0", 10);
    return NextResponse.json({ ok: true, count, subscribed: count > 0 });
  } catch (error: any) {
    console.error("[Push Subscription GET] Error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to check subscriptions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized access." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { subscription, deviceName } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Invalid push subscription object." },
        { status: 400 }
      );
    }

    const endpoint = String(subscription.endpoint);
    const p256dh = String(subscription.keys.p256dh);
    const auth = String(subscription.keys.auth);
    const userAgent = request.headers.get("user-agent") || null;
    const name = deviceName ? String(deviceName).slice(0, 100) : null;

    // Upsert subscription for this authenticated user
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name, user_agent, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (endpoint) DO UPDATE 
         SET user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             device_name = COALESCE(EXCLUDED.device_name, push_subscriptions.device_name),
             user_agent = COALESCE(EXCLUDED.user_agent, push_subscriptions.user_agent),
             updated_at = NOW()`,
      [identity.id, endpoint, p256dh, auth, name, userAgent]
    );

    return NextResponse.json({
      ok: true,
      message: "Push subscription registered successfully.",
    });
  } catch (error: any) {
    console.error("[Push Subscription POST] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Failed to register subscription." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized access." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const endpointParam = url.searchParams.get("endpoint");
    let endpoint = endpointParam;

    if (!endpoint) {
      const body = await request.json().catch(() => ({}));
      endpoint = body?.endpoint;
    }

    if (endpoint) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`,
        [endpoint, identity.id]
      );
    } else {
      // If no specific endpoint provided, remove all subscriptions for this user
      await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [identity.id]);
    }

    return NextResponse.json({
      ok: true,
      message: "Push subscription removed.",
    });
  } catch (error: any) {
    console.error("[Push Subscription DELETE] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Failed to delete subscription." },
      { status: 500 }
    );
  }
}
