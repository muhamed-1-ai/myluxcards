import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { snoozeFollowUp } from "@/lib/crm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "Unauthorized access." }, { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid follow-up ID." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const minutes = Number(body?.minutes) || 15;

    const result = await snoozeFollowUp(identity.id, id, minutes);
    if (!result.success) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Follow-up not found, not scheduled, or unauthorized." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Follow-up reminder snoozed for ${minutes} minutes.`,
      snoozedUntil: result.snoozedUntil,
    });
  } catch (error: any) {
    console.error("[Follow-Up Snooze POST] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Failed to snooze follow-up." },
      { status: 500 }
    );
  }
}
