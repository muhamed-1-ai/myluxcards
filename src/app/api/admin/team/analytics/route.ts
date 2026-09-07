import { NextResponse } from "next/server";
import { requireAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = admin.role === "SUPER_ADMIN";

    let totalsQuery = `
      SELECT
        COUNT(l.id)::int as total_leads,
        COUNT(CASE WHEN l.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int as leads_today,
        COUNT(CASE WHEN l.created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int as leads_week,
        COUNT(CASE WHEN l.created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int as leads_month,
        COUNT(CASE WHEN l.status IN ('CONVERTED', 'WON') THEN 1 END)::int as converted_leads,
        COUNT(CASE WHEN l.status IN ('LOST', 'LOB') THEN 1 END)::int as lost_leads
      FROM leads l
      JOIN users u ON u.id = l.owner_user_id
    `;

    let userBreakdownQuery = `
      SELECT
        u.id as user_id, u.name as user_name, u.email as user_email,
        COUNT(l.id)::int as total_leads,
        COUNT(CASE WHEN l.status IN ('CONVERTED', 'WON') THEN 1 END)::int as converted_leads,
        COUNT(CASE WHEN l.status IN ('LOST', 'LOB') THEN 1 END)::int as lost_leads
      FROM users u
      LEFT JOIN leads l ON l.owner_user_id = u.id
    `;

    const params: any[] = [];
    if (!isSuperAdmin) {
      params.push(admin.id);
      totalsQuery += ` WHERE (u.created_by_admin_id = $1 OR u.id = $1)`;
      userBreakdownQuery += ` WHERE (u.created_by_admin_id = $1 OR u.id = $1)`;
    }

    userBreakdownQuery += ` GROUP BY u.id, u.name, u.email ORDER BY total_leads DESC`;

    const totalsRes = await pool.query(totalsQuery, params);
    const breakdownRes = await pool.query(userBreakdownQuery, params);

    return NextResponse.json({
      totals: totalsRes.rows[0] || { total_leads: 0, leads_today: 0, leads_week: 0, leads_month: 0, converted_leads: 0, lost_leads: 0 },
      userBreakdown: breakdownRes.rows,
    });
  } catch (error) {
    return safeError(error);
  }
}
