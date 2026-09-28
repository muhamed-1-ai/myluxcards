import { currentIdentity, requirePermission } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ message: "Unauthorized" }, { status: 401 });
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const stage = searchParams.get("stage") || "";
  const source = searchParams.get("source") || "";
  const rawAssigned = searchParams.get("assignedUserId") || searchParams.get("userId") || "";
  const assignedUserId = /^[0-9a-f-]{36}$/i.test(rawAssigned) ? rawAssigned : "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25")));
  const offset = (page - 1) * limit;

  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "ASC" : "DESC";

  const allowedSortColumns: Record<string, string> = {
    "name": "l.name",
    "company": "l.company_name",
    "contact": "l.contact_number",
    "stage": "l.status",
    "assigned": "u.name",
    "source": "l.source",
    "created_at": "l.created_at",
    "totalAmount": "l.created_at"
  };

  const sortColumn = allowedSortColumns[sortBy] || "l.created_at";

  try {
    // MULTI-TENANT ACCOUNT ISOLATION
    let whereClause = "(l.owner_user_id = $1 OR l.assigned_user_id = $1)";
    const params: any[] = [];
    let paramIndex = 1;

    if (identity.role === "SUPER_ADMIN") {
      whereClause = "1=1";
    } else if (identity.role === "ADMIN") {
      whereClause = "(l.owner_user_id = $1 OR l.owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $1) OR l.assigned_user_id = $1)";
      params.push(identity.id);
      paramIndex = 2;
    } else {
      params.push(identity.id);
      paramIndex = 2;
    }

    // Optional Filters
    if (q) {
      whereClause += ` AND (
        l.name ILIKE $${paramIndex} OR 
        l.company_name ILIKE $${paramIndex} OR 
        l.email ILIKE $${paramIndex} OR 
        l.contact_number ILIKE $${paramIndex}
      )`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (stage) {
      whereClause += ` AND l.status = $${paramIndex}`;
      params.push(stage);
      paramIndex++;
    }

    if (source) {
      whereClause += ` AND l.source = $${paramIndex}`;
      params.push(source);
      paramIndex++;
    }

    if (assignedUserId) {
      whereClause += ` AND l.assigned_user_id = $${paramIndex}`;
      params.push(assignedUserId);
      paramIndex++;
    }

    if (dateFrom) {
      whereClause += ` AND l.created_at >= $${paramIndex}`;
      params.push(new Date(dateFrom).toISOString());
      paramIndex++;
    }

    if (dateTo) {
      whereClause += ` AND l.created_at <= $${paramIndex}`;
      params.push(new Date(dateTo).toISOString());
      paramIndex++;
    }

    // Execute queries
    const countQuery = `SELECT COUNT(*)::int as total FROM leads l WHERE ${whereClause}`;
    const followUpOwnerFilter = identity.role === "SUPER_ADMIN" ? "1=1" : "f.owner_user_id = $1";
    const kpiQuery = `
      SELECT 
        SUM(CASE WHEN l.status != 'WON' AND l.status != 'LOST' THEN 1 ELSE 0 END)::int as open_pipeline,
        SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END)::int as won_leads,
        0::int as expected_revenue,
        (SELECT COUNT(*)::int FROM lead_follow_ups f WHERE ${followUpOwnerFilter} AND f.status = 'SCHEDULED' AND DATE(f.scheduled_at) = CURRENT_DATE) as due_today
      FROM leads l
      WHERE ${whereClause}
    `;

    const ownerSelectSubquery = identity.role === "SUPER_ADMIN" ? "l.owner_user_id" : "$1";
    const dataQuery = `
      SELECT 
        l.id, l.name, l.company_name as "companyName", l.contact_number as "contactNumber", 
        l.email, l.status as "stage", l.source, l.created_at as "createdAt",
        l.owner_user_id as "ownerUserId", l.assigned_user_id as "assignedUserId", l.profile_image as "profileImage",
        u.name as "assignedUserName", u.email as "assignedUserEmail",
        (SELECT note FROM lead_follow_ups WHERE lead_id = l.id AND (${followUpOwnerFilter}) AND status = 'SCHEDULED' ORDER BY scheduled_at ASC LIMIT 1) as "nextFollowUpNote",
        (SELECT scheduled_at FROM lead_follow_ups WHERE lead_id = l.id AND (${followUpOwnerFilter}) AND status = 'SCHEDULED' ORDER BY scheduled_at ASC LIMIT 1) as "nextFollowUpAt",
        (SELECT description FROM lead_activities WHERE lead_id = l.id AND (${followUpOwnerFilter}) AND type = 'REMARK' ORDER BY occurred_at DESC LIMIT 1) as "lastRemark"
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const [countRes, kpiRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, paramIndex - 1)),
      pool.query(kpiQuery, params.slice(0, paramIndex - 1)),
      pool.query(dataQuery, params)
    ]);

    const total = countRes.rows[0]?.total || 0;
    const kpis = {
      total,
      openPipeline: kpiRes.rows[0]?.open_pipeline || 0,
      wonLeads: kpiRes.rows[0]?.won_leads || 0,
      dueToday: kpiRes.rows[0]?.due_today || 0,
      expectedRevenue: kpiRes.rows[0]?.expected_revenue || 0,
    };

    const leads = dataRes.rows;

    return Response.json({
      success: true,
      count: total,
      accountId: identity.id,
      userId: identity.id,
      leads,
      kpis,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error("[Leads Search API] Error:", error);
    return Response.json({ message: "Failed to search leads" }, { status: 500 });
  }
}

