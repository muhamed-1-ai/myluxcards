import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { dismissFollowUpReminder } from "@/lib/crm";

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
    const success = await dismissFollowUpReminder(identity.id, id);
    if (!success) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Follow-up not found, not scheduled, or unauthorized." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Reminder dismissed.",
    });
  } catch (error: any) {
    console.error("[Follow-Up Dismiss POST] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: error?.message || "Failed to dismiss reminder." },
      { status: 500 }
    );
  }
}
