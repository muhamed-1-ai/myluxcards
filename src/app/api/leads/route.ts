import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { createManualLead } from "@/lib/crm";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Query primary or first card belonging to the user
    const cardRes = await pool.query<{ id: string }>(
      `SELECT id FROM digital_cards WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [identity.id]
    );

    const cardId = cardRes.rows[0]?.id;
    if (!cardId) {
      return Response.json({ message: "Please create a digital card first." }, { status: 400 });
    }

    const result = await createManualLead(identity.id, cardId, {
      name: body.name,
      companyName: body.companyName,
      contactNumber: body.contactNumber,
      email: body.email,
    });

    return Response.json({
      ok: true,
      message: "Lead added successfully.",
      lead: result.lead,
    });
  } catch (error: any) {
    console.error("[Manual Lead API] Error:", error);
    return Response.json(
      { message: error.message || "Failed to add lead." },
      { status: 400 }
    );
  }
}
