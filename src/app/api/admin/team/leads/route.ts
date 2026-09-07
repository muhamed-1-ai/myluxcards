import { NextResponse } from "next/server";
import { requireAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterUserId = searchParams.get("userId");
    const filterStage = searchParams.get("stage");
    const filterStatus = searchParams.get("status");

    const isSuperAdmin = admin.role === "SUPER_ADMIN";

    let query = `
      SELECT l.id, l.name, l.company_name, l.contact_number, l.email, l.status, l.source,
             l.first_submitted_at, l.last_submitted_at, l.created_at, l.updated_at,
             u.id as user_id, u.name as user_name, u.email as user_email
      FROM leads l
      JOIN users u ON u.id = l.owner_user_id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (!isSuperAdmin) {
      params.push(admin.id);
      conditions.push(`(u.created_by_admin_id = $${params.length} OR u.id = $${params.length})`);
    }

    if (filterUserId) {
      params.push(filterUserId);
      conditions.push(`u.id = $${params.length}`);
    }

    if (filterStage) {
      params.push(filterStage);
      conditions.push(`l.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(" AND ");
    }

    query += ` ORDER BY l.created_at DESC LIMIT 200`;

    const result = await pool.query(query, params);

    return NextResponse.json({ leads: result.rows });
  } catch (error) {
    return safeError(error);
  }
}
