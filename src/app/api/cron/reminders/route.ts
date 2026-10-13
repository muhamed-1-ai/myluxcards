import { NextResponse } from "next/server";
import { runFollowUpReminderScan } from "@/lib/followUpScheduler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const url = new URL(request.url);
      const secretParam = url.searchParams.get("secret");

      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : secretParam;
      if (token !== cronSecret) {
        return NextResponse.json({ error: "UNAUTHORIZED", message: "Invalid cron secret" }, { status: 401 });
      }
    }

    const stats = await runFollowUpReminderScan();
    return NextResponse.json({ ok: true, stats });
  } catch (error: any) {
    console.error("[Cron Reminders API] Error running scan:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
