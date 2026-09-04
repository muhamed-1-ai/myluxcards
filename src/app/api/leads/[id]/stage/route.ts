import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { updateLeadStage, LeadStage } from "@/lib/crm";

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
    const targetStage = String(body.stage || body.status || "").toUpperCase() as LeadStage;

    const result = await updateLeadStage(identity.id, id, targetStage);
    return Response.json({
      ok: true,
      message: `Lead moved to ${targetStage}`,
      ...result,
    });
  } catch (error: any) {
    console.error("[Lead Stage API] Error:", error);
    return Response.json(
      { message: error.message || "Failed to update lead stage." },
      { status: 400 }
    );
  }
}
