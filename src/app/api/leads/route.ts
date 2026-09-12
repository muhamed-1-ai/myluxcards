import { currentIdentity, requirePermission, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { createManualLead } from "@/lib/crm";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await requirePermission("leads");
  if (!identity) {
    const user = await currentIdentity();
    if (!user) return Response.json({ message: "Unauthorized." }, { status: 401 });
    return Response.json({ message: "Leads feature is disabled for your account." }, { status: 403 });
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
      profileImage: body.profileImage,
      assignedUserId: body.assignedUserId,
      status: body.status,
      source: body.source || "MANUAL",
    });

    const leadId = result.lead.id;

    // Update optional extended fields (address, total_amount, advance_amount)
    if (body.address || body.totalAmount !== undefined || body.advanceAmount !== undefined) {
      await pool.query(
        `UPDATE leads SET 
          address = COALESCE($1, address), 
          total_amount = COALESCE($2, total_amount), 
          advance_amount = COALESCE($3, advance_amount),
          updated_at = NOW() 
         WHERE id = $4`,
        [body.address || null, body.totalAmount || 0, body.advanceAmount || 0, leadId]
      );
    }

    // Save initial remark if provided
    if (body.remark && typeof body.remark === "string" && body.remark.trim().length > 0) {
      await pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
         VALUES ($1, $2, 'REMARK', $3, NOW(), NOW())`,
        [identity.id, leadId, body.remark.trim().slice(0, 1000)]
      );
    }

    // Schedule initial follow-up if provided
    if (body.followUpDate) {
      const scheduledAt = new Date(body.followUpDate);
      if (!isNaN(scheduledAt.getTime())) {
        const note = body.followUpNote ? `[${body.followUpType || "Call"}] ${body.followUpNote.trim()}` : `[${body.followUpType || "Call"}] Initial follow-up`;
        await pool.query(
          `INSERT INTO lead_follow_ups (owner_user_id, lead_id, scheduled_at, note, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'SCHEDULED', NOW(), NOW())`,
          [identity.id, leadId, scheduledAt, note]
        );
      }
    }

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
