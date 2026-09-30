import { currentIdentity, getLeadAccessFilter, requirePermission } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { NextRequest } from "next/server";
import { extractFollowUpTypeAndCleanNote } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await requirePermission("all_leads", request);
  if (!identity) {
    const user = await currentIdentity(request);
    if (!user) return Response.json({ error: "Unauthorized", message: "Not authenticated." }, { status: 401 });
    return Response.json({ error: "Forbidden", message: "Permission denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || searchParams.get("search") || "";
  const stage = searchParams.get("stage") || "";
  const source = searchParams.get("source") || "";
  const rawAssigned = searchParams.get("assignedUserId") || searchParams.get("userId") || "";
  const assignedUserId = /^[0-9a-f-]{36}$/i.test(rawAssigned) ? rawAssigned : "";
  const scopeFilter = searchParams.get("scope") || searchParams.get("scopeFilter") || "";
  const statusFilter = searchParams.get("status") || "";
  const dateFrom = searchParams.get("dateFrom") || searchParams.get("startDate") || "";
  const dateTo = searchParams.get("dateTo") || searchParams.get("endDate") || "";

  // Pagination parameters validation: max 100 limit, min 1
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const rawLimit = parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "10", 10);
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(100, rawLimit);

  const offset = (page - 1) * limit;

  const sortBy = searchParams.get("sortBy") || "created_at";
  const sortOrder = searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "ASC" : "DESC";

  const allowedSortColumns: Record<string, string> = {
    name: "l.name",
    company: "l.company_name",
    companyName: "l.company_name",
    contact: "l.contact_number",
    contactNumber: "l.contact_number",
    stage: "l.status",
    status: "l.status",
    assigned: "u.name",
    assignedUserName: "u.name",
    source: "l.source",
    created_at: "l.created_at",
    createdAt: "l.created_at",
    totalAmount: "COALESCE(l.total_amount, 0)",
  };

  const sortColumn = allowedSortColumns[sortBy] || "l.created_at";

  try {
    // Multi-tenant account access filter
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

    if (statusFilter) {
      if (statusFilter.toLowerCase() === "active") {
        whereClause += ` AND l.status NOT IN ('WON', 'LOST', 'CLOSED')`;
      } else if (statusFilter.toLowerCase() === "closed") {
        whereClause += ` AND l.status IN ('WON', 'LOST', 'CLOSED')`;
      } else {
        whereClause += ` AND l.status = $${paramIndex}`;
        params.push(statusFilter);
        paramIndex++;
      }
    }

    if (assignedUserId) {
      whereClause += ` AND l.assigned_user_id = $${paramIndex}`;
      params.push(assignedUserId);
      paramIndex++;
    }

    if (scopeFilter === "mine") {
      whereClause += ` AND (l.owner_user_id = $${paramIndex} OR l.assigned_user_id = $${paramIndex})`;
      params.push(identity.id);
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

    // Execute queries for total count on filtered dataset
    const countQuery = `SELECT COUNT(*)::int as total FROM leads l WHERE ${whereClause}`;
    const kpiQuery = `
      SELECT 
        SUM(CASE WHEN l.status NOT IN ('WON', 'LOST', 'CLOSED') THEN 1 ELSE 0 END)::int as open_pipeline,
        SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END)::int as won_leads,
        SUM(COALESCE(l.total_amount, 0))::float as expected_revenue,
        (SELECT COUNT(*)::int FROM lead_follow_ups f WHERE ${followUpOwnerFilter} AND f.status = 'SCHEDULED' AND DATE(f.scheduled_at) = CURRENT_DATE) as due_today
      FROM leads l
      WHERE ${whereClause}
    `;

    const [countRes, kpiRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(kpiQuery, params)
    ]);

    const total = countRes.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 0;

    // Auto-correct pagination offset if offset is past available total after record deletion
    let effectiveOffset = offset;
    let effectivePage = page;
    if (effectiveOffset >= total && total > 0) {
      effectivePage = totalPages;
      effectiveOffset = (effectivePage - 1) * limit;
    }

    const limitParamIdx = paramIndex;
    const offsetParamIdx = paramIndex + 1;
    const queryParams = [...params, limit, effectiveOffset];

    const dataQuery = `
      SELECT 
        l.id, l.name, l.company_name as "companyName", l.contact_number as "contactNumber", 
        l.email, l.status as "stage", l.source, l.created_at as "createdAt",
        l.owner_user_id as "ownerUserId", l.assigned_user_id as "assignedUserId", l.profile_image as "profileImage",
        u.name as "assignedUserName", u.email as "assignedUserEmail",
        l.address as "address",
        COALESCE(l.total_amount, 0)::float as "totalAmount",
        COALESCE(l.advance_amount, 0)::float as "advanceAmount",
        (SELECT f.note FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpNote",
        (SELECT f.scheduled_at FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpAt",
        (SELECT COALESCE(f.type, l.follow_up_type, 'CALL') FROM lead_follow_ups f WHERE f.lead_id = l.id AND ${followUpOwnerFilter} AND f.status = 'SCHEDULED' ORDER BY f.scheduled_at ASC LIMIT 1) as "nextFollowUpType",
        COALESCE(l.follow_up_type, 'CALL') as "followUpType",
        (SELECT a.description FROM lead_activities a WHERE a.lead_id = l.id AND ${activityOwnerFilter} AND a.type = 'REMARK' ORDER BY a.occurred_at DESC LIMIT 1) as "lastRemark"
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;

    const dataRes = await pool.query(dataQuery, queryParams);

    const kpis = {
      total,
      openPipeline: kpiRes.rows[0]?.open_pipeline || 0,
      wonLeads: kpiRes.rows[0]?.won_leads || 0,
      dueToday: kpiRes.rows[0]?.due_today || 0,
      expectedRevenue: kpiRes.rows[0]?.expected_revenue || 0,
    };

    const leads = dataRes.rows.map((row) => {
      const { type: parsedType, cleanNote: parsedNote } = extractFollowUpTypeAndCleanNote(
        row.nextFollowUpNote,
        row.followUpType || row.nextFollowUpType
      );
      return {
        ...row,
        nextFollowUpNote: parsedNote || null,
        nextFollowUpType: parsedType,
        followUpType: parsedType,
      };
    });

    const startRecord = total === 0 ? 0 : effectiveOffset + 1;
    const endRecord = Math.min(effectiveOffset + limit, total);
    const hasNextPage = effectivePage < totalPages;
    const hasPreviousPage = effectivePage > 1;

    return Response.json({
      success: true,
      count: total,
      total: total,
      accountId: identity.id,
      userId: identity.id,
      leads,
      kpis,
      pagination: {
        page: effectivePage,
        pageSize: limit,
        limit: limit,
        total,
        totalPages: total === 0 ? 1 : totalPages,
        hasNextPage,
        hasPreviousPage,
        start: startRecord,
        end: endRecord
      }
    });

  } catch (error: any) {
    console.error("LEADS SEARCH FAILED", error);
    return Response.json(
      {
        error: error.message || "Failed to search leads"
      },
      { status: 500 }
    );
  }
}


