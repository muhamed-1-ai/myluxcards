import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ message: "Invalid lead ID." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const companyName = body.companyName !== undefined ? String(body.companyName || "").trim() : null;
    const contactNumber = String(body.contactNumber || "").trim();
    const email = body.email ? String(body.email || "").trim() : null;
    const profileImage = body.profileImage || null;
    const assignedUserId = body.assignedUserId || null;
    const status = body.status || null;

    if (!name || !contactNumber) {
      return Response.json({ message: "Lead name and contact number are required." }, { status: 400 });
    }

    const note = body.note ? String(body.note).trim() : null;

    // Ensure they have permission
    const permCheck = await pool.query<{ id: string; owner_user_id: string; status: string }>(
      `SELECT id, owner_user_id, status FROM leads 
       WHERE id = $1 AND (owner_user_id = $2 OR assigned_user_id = $2 OR owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $2) OR $3::text = 'SUPER_ADMIN')`,
      [id, identity.id, identity.role]
    );

    const existingLead = permCheck.rows[0];
    if (!existingLead) {
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    const previousStatus = existingLead.status;

    const result = await pool.query(
      `UPDATE leads
       SET name = $1, company_name = $2, contact_number = $3, email = $4, profile_image = COALESCE($5, profile_image), assigned_user_id = COALESCE($6, assigned_user_id), status = COALESCE($7, status), updated_at = NOW()
       WHERE id = $8
       RETURNING id, name, company_name, contact_number, email, status, source, profile_image as "profileImage", assigned_user_id as "assignedUserId", updated_at`,
      [name, companyName || null, contactNumber, email || null, profileImage, assignedUserId, status, id]
    );

    const lead = result.rows[0];
    if (!lead) {
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    // Log update activity
    if (status && status !== previousStatus) {
      const activityType = status === "CONVERTED" || status === "WON" ? "LEAD_WON" : status === "LOST" ? "LEAD_LOST" : "STAGE_CHANGED";
      void pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, from_value, to_value, description, occurred_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [existingLead.owner_user_id, id, activityType, previousStatus, status, `Stage updated from ${previousStatus} to ${status}`]
      );
    } else {
      void pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
         VALUES ($1, $2, 'LEAD_UPDATED', $3, NOW(), NOW())`,
        [existingLead.owner_user_id, id, `Updated lead details for ${lead.name}`]
      );
    }

    if (note) {
      void pool.query(
        `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
         VALUES ($1, $2, 'NOTE_ADDED', $3, NOW(), NOW())`,
        [existingLead.owner_user_id, id, note]
      );
    }

    return Response.json({
      ok: true,
      message: "Lead details updated successfully.",
      lead,
    });
  } catch (error: any) {
    console.error("[Lead Update API] Error:", error);
    return Response.json(
      { message: error.message || "Failed to update lead details." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ message: "Invalid lead ID." }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `DELETE FROM leads WHERE id = $1 AND owner_user_id = $2 RETURNING id, name`,
      [id, identity.id]
    );

    const deleted = result.rows[0];
    if (!deleted) {
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    return Response.json({
      ok: true,
      message: `Lead ${deleted.name} deleted successfully.`,
    });
  } catch (error: any) {
    console.error("[Lead Delete API] Error:", error);
    return Response.json(
      { message: error.message || "Failed to delete lead." },
      { status: 400 }
    );
  }
}
