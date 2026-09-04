import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { scheduleFollowUp } from "@/lib/crm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.scheduledAt) {
      return Response.json({ message: "Please select a scheduled date and time." }, { status: 400 });
    }

    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      return Response.json({ message: "Invalid scheduled date and time." }, { status: 400 });
    }

    const item = await scheduleFollowUp(identity.id, id, scheduledAt, body.note);
    return Response.json({
      ok: true,
      message: "Follow-up scheduled successfully.",
      followUp: item,
    });
  } catch (error: any) {
    console.error("[Schedule Follow-Up API] Error:", error);
    return Response.json(
      { message: error.message || "Failed to schedule follow-up." },
      { status: 400 }
    );
  }
}
