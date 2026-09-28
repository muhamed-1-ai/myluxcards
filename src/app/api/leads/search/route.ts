import { currentIdentity, getLeadAccessFilter, requirePermission } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ error: "Unauthorized", message: "Not authenticated." }, { status: 401 });
    return Response.json({ error: "Forbidden", message: "Permission denied." }, { status: 403 });
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
    // STEP 3 & STEP 5: Shared multi-tenant account access filter
    const accessFilter = getLeadAccessFilter(identity, "l");
    let whereClause = accessFilter.whereClause;
    const params: any[] = [...accessFilter.params];
    let paramIndex = accessFilter.paramCount + 1;

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

    const followUpOwnerFilter = identity.role === "SUPER_ADMIN" ? "1=1" : "f.owner_user_id = $1";
    const activityOwnerFilter = identity.role === "SUPER_ADMIN" ? "1=1" : "a.owner_user_id = $1";

    // Execute queries
    const countQuery = `SELECT COUNT(*)::int as total FROM leads l WHERE ${whereClause}`;
    const kpiQuery = `
      SELECT 
        SUM(CASE WHEN l.status != 'WON' AND l.status != 'LOST' THEN 1 ELSE 0 END)::int as open_pipeline,
        SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END)::int as won_leads,
        0::int as expected_revenue,
        (SELECT COUNT(*)::int FROM lead_follow_ups f WHERE ${followUpOwnerFilter} AND f.status = 'SCHEDULED' AND DATE(f.scheduled_at) = CURRENT_DATE) as due_today
      FROM leads l
      WHERE ${whereClause}
    `;

    const limitParamIdx = paramIndex;
    const offsetParamIdx = paramIndex + 1;
    const queryParams = [...params, limit, offset];

    const dataQuery = `
      SELECT 
        l.id, l.name, l.company_name as "companyName", l.contact_number as "contactNumber", 
        l.email, l.status as "stage", l.source, l.created_at as "createdAt",
        l.owner_user_id as "ownerUserId", l.assigned_user_id as "assignedUserId", l.profile_image as "profileImage",
        u.name as "assignedUserName", u.email as "assignedUserEmail",
        (SELECT f.note FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpNote",
        (SELECT f.scheduled_at FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpAt",
        (SELECT a.description FROM lead_activities a WHERE a.lead_id = l.id AND ${activityOwnerFilter} AND a.type = 'REMARK' ORDER BY a.occurred_at DESC LIMIT 1) as "lastRemark"
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;

    const [countRes, kpiRes, dataRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(kpiQuery, params),
      pool.query(dataQuery, queryParams)
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

    // STEP 6: Debug logging before returning response
    console.log("[LEADS_SEARCH]", {
      userId: identity.id,
      accountId: identity.id,
      search: q,
      filters: { stage, source, assignedUserId, dateFrom, dateTo }
    });

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
    // STEP 6: Log error & return structured JSON response
    console.error("LEADS SEARCH FAILED", error);
    return Response.json(
      {
        error: error.message || "Failed to search leads"
      },
      { status: 500 }
    );
  }
}

