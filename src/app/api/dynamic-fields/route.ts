import { currentIdentity } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ success: false, ok: false, error: "Unauthorized.", message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const statusFilter = statusParam ? statusParam.toUpperCase() : "ACTIVE";

  try {
    let query = `
      SELECT id, name, input_type as "inputType", is_required as "isRequired",
             status, sort_order as "sortOrder", options, config,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM lead_field_definitions
      WHERE (owner_user_id = $1 OR owner_user_id IN (SELECT created_by_admin_id FROM users WHERE id = $1)) AND status != 'ARCHIVED'
    `;

    if (statusFilter === "ACTIVE") {
      query += ` AND status = 'ACTIVE'`;
    }

    query += ` ORDER BY sort_order ASC, created_at ASC`;

    const result = await pool.query(query, [identity.id]);

    return Response.json({ success: true, ok: true, fields: result.rows, data: result.rows });
  } catch (error: any) {
    console.error("[Dynamic Fields GET Error]", error);
    return Response.json({ success: false, ok: false, error: error.message || "Failed to load dynamic fields." }, { status: 500 });
  }
}
