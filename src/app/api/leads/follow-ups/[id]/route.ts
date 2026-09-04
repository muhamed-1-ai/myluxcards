import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { completeFollowUp, rescheduleFollowUp } from "@/lib/crm";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const action = String(body.action || "complete").toLowerCase();

    if (action === "complete") {
      const success = await completeFollowUp(identity.id, id);
      if (!success) return Response.json({ message: "Follow-up not found or already completed." }, { status: 404 });
      return Response.json({ ok: true, message: "Follow-up completed." });
    }

    if (action === "reschedule") {
      if (!body.scheduledAt) return Response.json({ message: "Please specify a new scheduled date." }, { status: 400 });
      const newScheduledAt = new Date(body.scheduledAt);
      if (isNaN(newScheduledAt.getTime())) return Response.json({ message: "Invalid scheduled date." }, { status: 400 });

      const success = await rescheduleFollowUp(identity.id, id, newScheduledAt);
      if (!success) return Response.json({ message: "Follow-up not found." }, { status: 404 });
      return Response.json({ ok: true, message: "Follow-up rescheduled." });
    }

    return Response.json({ message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("[Follow-Up Action API] Error:", error);
    return Response.json(
      { message: error.message || "Failed to update follow-up." },
      { status: 400 }
    );
  }
}
