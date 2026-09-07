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

    const isSuperAdmin = admin.role === "SUPER_ADMIN";

    let query = `
      SELECT
        COALESCE(l.lob_reason, la.to_value, 'Unspecified') as reason,
        COUNT(l.id)::int as count
      FROM leads l
      JOIN users u ON u.id = l.owner_user_id
      LEFT JOIN lead_activities la ON la.lead_id = l.id AND la.type = 'LOB_REASON_SET'
      WHERE l.status IN ('LOST', 'LOB')
    `;

    const params: any[] = [];

    if (!isSuperAdmin) {
      params.push(admin.id);
      query += ` AND (u.created_by_admin_id = $${params.length} OR u.id = $${params.length})`;
    }

    if (filterUserId) {
      params.push(filterUserId);
      query += ` AND u.id = $${params.length}`;
    }

    query += ` GROUP BY reason ORDER BY count DESC`;

    const result = await pool.query(query, params);

    return NextResponse.json({ lobReasons: result.rows });
  } catch (error) {
    return safeError(error);
  }
}
