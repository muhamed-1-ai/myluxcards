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
    const email = body.email ? String(body.email || "").trim().toLowerCase() : null;

    if (!name || !contactNumber) {
      return Response.json({ message: "Lead name and contact number are required." }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE leads
       SET name = $1, company_name = $2, contact_number = $3, email = $4, updated_at = NOW()
       WHERE id = $5 AND owner_user_id = $6
       RETURNING id, name, company_name, contact_number, email, status, source, updated_at`,
      [name, companyName || null, contactNumber, email || null, id, identity.id]
    );

    const lead = result.rows[0];
    if (!lead) {
      return Response.json({ message: "Lead not found or access denied." }, { status: 404 });
    }

    // Log update activity
    void pool.query(
      `INSERT INTO lead_activities (owner_user_id, lead_id, type, description, occurred_at, created_at)
       VALUES ($1, $2, 'LEAD_UPDATED', $3, NOW(), NOW())`,
      [identity.id, id, `Updated lead details for ${lead.name}`]
    );

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
