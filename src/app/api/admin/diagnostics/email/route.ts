import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { getEmailConfigDiagnostics, sendTransactionalEmail } from "@/lib/email/transactional";
import { validEmail } from "@/lib/authService";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request): Promise<boolean> {
  // 1. Secret token authorization (CRON_SECRET or ADMIN_DIAGNOSTICS_KEY)
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_DIAGNOSTICS_KEY;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const adminKey = request.headers.get("x-admin-key");
    const url = new URL(request.url);
    const secretParam = url.searchParams.get("secret");

    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (bearerToken === cronSecret || adminKey === cronSecret || secretParam === cronSecret) {
      return true;
    }
  }

  // 2. Admin session authorization
  const actor = await requireAdmin(true, request).catch(() => null);
  return Boolean(actor && (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN"));
}

export async function GET(request: Request) {
  const authorized = await isAuthorized(request);
  if (!authorized) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const diagnostics = getEmailConfigDiagnostics();

    // Query recent recovery token deliveries without exposing token hashes
    const query = `
      select
        t.id,
        u.email,
        t.delivery_status,
        t.delivery_provider,
        t.delivery_error,
        t.delivery_message_id,
        t.created_at,
        t.sent_at,
        t.expires_at,
        t.consumed_at
      from auth_action_tokens t
      left join users u on u.id = t.user_id
      where t.purpose = 'PASSWORD_RESET'
      order by t.created_at desc
      limit 20
    `;
    const recent = await pool.query(query);

    return NextResponse.json({
      ok: true,
      diagnostics,
      recentDeliveries: recent.rows,
    });
  } catch (error) {
    console.error("[Diagnostics][Email] Error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authorized = await isAuthorized(request);
  if (!authorized) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";

    if (!to || !validEmail(to)) {
      return NextResponse.json(
        { ok: false, message: "Valid recipient email address is required in body.to" },
        { status: 400 }
      );
    }

    const result = await sendTransactionalEmail({
      to,
      subject: "ZAPPIT Diagnostic Email Delivery Test",
      text: `Hello,\n\nThis is a diagnostic test email from your ZAPPIT application to verify live transactional email delivery.\n\nTimestamp: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 8px;">
          <h2 style="color: #38bdf8; margin-top: 0;">ZAPPIT Diagnostic Test Email</h2>
          <p>This is a live diagnostic verification email dispatched from your ZAPPIT application.</p>
          <p style="color: #94a3b8; font-size: 13px;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    return NextResponse.json({
      ok: result.ok,
      provider: result.provider,
      messageId: result.messageId || null,
      error: result.error || null,
    });
  } catch (error) {
    console.error("[Diagnostics][Email][SendTest] Error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
