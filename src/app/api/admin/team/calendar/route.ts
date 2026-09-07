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

    let followUpQuery = `
      SELECT f.id, f.scheduled_at, f.note, f.status, f.completed_at, f.created_at,
             l.id as lead_id, l.name as lead_name, l.company_name, l.contact_number,
             u.id as user_id, u.name as user_name, u.email as user_email
      FROM lead_follow_ups f
      JOIN leads l ON l.id = f.lead_id
      JOIN users u ON u.id = f.owner_user_id
    `;

    let leadCountsQuery = `
      SELECT u.id as user_id, u.name as user_name, u.email as user_email,
             COUNT(l.id)::int as total_leads,
             COUNT(CASE WHEN l.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int as leads_today
      FROM users u
      LEFT JOIN leads l ON l.owner_user_id = u.id
    `;

    const followUpConditions: string[] = [];
    const leadCountConditions: string[] = [];
    const params: any[] = [];

    if (!isSuperAdmin) {
      params.push(admin.id);
      followUpConditions.push(`(u.created_by_admin_id = $${params.length} OR u.id = $${params.length})`);
      leadCountConditions.push(`(u.created_by_admin_id = $${params.length} OR u.id = $${params.length})`);
    }

    if (filterUserId) {
      params.push(filterUserId);
      followUpConditions.push(`u.id = $${params.length}`);
      leadCountConditions.push(`u.id = $${params.length}`);
    }

    if (followUpConditions.length > 0) {
      followUpQuery += ` WHERE ` + followUpConditions.join(" AND ");
    }
    followUpQuery += ` ORDER BY f.scheduled_at ASC LIMIT 200`;

    if (leadCountConditions.length > 0) {
      leadCountsQuery += ` WHERE ` + leadCountConditions.join(" AND ");
    }
    leadCountsQuery += ` GROUP BY u.id, u.name, u.email ORDER BY leads_today DESC`;

    const followUpsRes = await pool.query(followUpQuery, params);
    const leadCountsRes = await pool.query(leadCountsQuery, params);

    return NextResponse.json({
      followUps: followUpsRes.rows,
      teamLeadCounts: leadCountsRes.rows,
    });
  } catch (error) {
    return safeError(error);
  }
}
