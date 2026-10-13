import { NextResponse } from "next/server";
import { currentIdentity } from "@/lib/adminAuth";
import { getDueFollowUpReminders } from "@/lib/crm";
import { startReminderScheduler, runFollowUpReminderScan } from "@/lib/followUpScheduler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized access." }, { status: 401 });
  }

  // Ensure singleton background scheduler is running
  startReminderScheduler();

  // Asynchronously trigger scan to claim any pending due follow-ups without waiting
  void runFollowUpReminderScan();

  try {
    const dueReminders = await getDueFollowUpReminders(identity.id);
    return NextResponse.json({ dueReminders });
  } catch (error: any) {
    console.error("[Due Follow-Up Reminders GET] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Failed to fetch due reminders." },
      { status: 500 }
    );
  }
}
