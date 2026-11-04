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
    advanceAmount: "COALESCE(l.advance_amount, 0)",
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
      if (identity.role === "SUPER_ADMIN" && (assignedUserId === "me" || assignedUserId === identity.id)) {
        whereClause += ` AND (l.assigned_user_id = $${paramIndex} OR l.assigned_user_id IS NULL)`;
        params.push(identity.id);
        paramIndex++;
      } else if (assignedUserId !== "all") {
        whereClause += ` AND l.assigned_user_id = $${paramIndex}`;
        params.push(assignedUserId);
        paramIndex++;
      }
    }

    if (scopeFilter === "mine") {
      if (identity.role === "SUPER_ADMIN") {
        whereClause += ` AND (l.assigned_user_id = $${paramIndex} OR l.assigned_user_id IS NULL)`;
        params.push(identity.id);
        paramIndex++;
      } else {
        whereClause += ` AND (l.owner_user_id = $${paramIndex} OR l.assigned_user_id = $${paramIndex})`;
        params.push(identity.id);
        paramIndex++;
      }
    }

    if (dateFrom) {
      whereClause += ` AND l.created_at >= $${paramIndex}`;
      const dFrom = new Date(dateFrom.length === 10 ? `${dateFrom}T00:00:00.000Z` : dateFrom);
      params.push(isNaN(dFrom.getTime()) ? new Date(dateFrom).toISOString() : dFrom.toISOString());
      paramIndex++;
    }

    if (dateTo) {
      whereClause += ` AND l.created_at <= $${paramIndex}`;
      // Treat end date as inclusive for the full day in reporting timezone
      const dTo = new Date(dateTo.length === 10 ? `${dateTo}T23:59:59.999Z` : dateTo);
      params.push(isNaN(dTo.getTime()) ? new Date(dateTo).toISOString() : dTo.toISOString());
      paramIndex++;
    }

    const followUpOwnerFilter = identity.role === "SUPER_ADMIN" ? "1=1" : "f.owner_user_id = $1";
    const activityOwnerFilter = identity.role === "SUPER_ADMIN" ? "1=1" : "a.owner_user_id = $1";

    // Execute queries for total count and KPI aggregates on filtered dataset before pagination
    const countQuery = `SELECT COUNT(*)::int as total FROM leads l WHERE ${whereClause}`;
    const kpiQuery = `
      SELECT 
        SUM(CASE WHEN l.status NOT IN ('WON', 'LOST', 'CLOSED') THEN 1 ELSE 0 END)::int as open_pipeline,
        SUM(CASE WHEN l.status = 'WON' THEN 1 ELSE 0 END)::int as won_leads,
        COALESCE(SUM(l.total_amount), 0)::float as expected_revenue
      FROM leads l
      WHERE ${whereClause}
    `;

    // Query daily timeline for cumulative Total Leads, Open Pipeline, and Expected Revenue sparklines
    const timelineQuery = `
      SELECT 
        DATE(l.created_at) as "day",
        COUNT(*)::int as "total_leads",
        SUM(CASE WHEN l.status NOT IN ('WON', 'LOST', 'CLOSED') THEN 1 ELSE 0 END)::int as "open_leads",
        COALESCE(SUM(l.total_amount), 0)::float as "revenue"
      FROM leads l
      WHERE ${whereClause}
      GROUP BY DATE(l.created_at)
      ORDER BY "day" ASC
    `;

    // Query due today follow-ups scoped to matching leads for Due Today count & hourly cumulative sparkline
    const dueQuery = `
      SELECT 
        DATE_TRUNC('hour', f.scheduled_at) as "hour_bucket",
        COUNT(*)::int as "due_count"
      FROM lead_follow_ups f
      JOIN leads l ON l.id = f.lead_id
      WHERE ${whereClause}
        AND ${followUpOwnerFilter}
        AND f.status = 'SCHEDULED'
        AND DATE(f.scheduled_at) = CURRENT_DATE
      GROUP BY DATE_TRUNC('hour', f.scheduled_at)
      ORDER BY "hour_bucket" ASC
    `;

    // Query permission-scoped distinct assignees and sources across user's permitted leads (pre-filter scope)
    const optionsQuery = `
      SELECT DISTINCT u.id, u.name, u.email
      FROM leads l
      JOIN users u ON u.id = l.assigned_user_id
      WHERE ${accessFilter.whereClause}
      ORDER BY u.name ASC
    `;

    const sourceQuery = `
      SELECT DISTINCT l.source
      FROM leads l
      WHERE ${accessFilter.whereClause} AND l.source IS NOT NULL AND l.source != ''
      ORDER BY l.source ASC
    `;

    const [countRes, kpiRes, timelineRes, dueTimelineRes, assigneeRes, sourceRes] = await Promise.all([
      pool.query(countQuery, params),
      pool.query(kpiQuery, params),
      pool.query(timelineQuery, params),
      pool.query(dueQuery, params),
      pool.query(optionsQuery, accessFilter.params),
      pool.query(sourceQuery, accessFilter.params),
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
        l.owner_user_id as "ownerUserId", l.assigned_user_id as "assignedUserId", l.created_by_user_id as "createdByUserId", l.profile_image as "profileImage",
        u.name as "assignedUserName", u.email as "assignedUserEmail",
        COALESCE(l.address, '')::text as "address",
        COALESCE(l.total_amount, 0)::float as "totalAmount",
        COALESCE(l.advance_amount, 0)::float as "advanceAmount",
        COALESCE(l.payment_information, '{}'::jsonb) as "paymentInformation",
        COALESCE(l.products, '[]'::jsonb) as "products",
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

    // Build cumulative sparkline series from timeline aggregates
    let runningTotal = 0;
    let runningOpen = 0;
    let runningRev = 0;
    const totalLeadsSeries: { x: string; y: number }[] = [];
    const openPipelineSeries: { x: string; y: number }[] = [];
    const expectedRevenueSeries: { x: string; y: number }[] = [];

    const todayStr = new Date().toISOString().slice(0, 10);

    if (!timelineRes.rows || timelineRes.rows.length === 0) {
      totalLeadsSeries.push({ x: todayStr, y: 0 });
      openPipelineSeries.push({ x: todayStr, y: 0 });
      expectedRevenueSeries.push({ x: todayStr, y: 0 });
    } else {
      for (const row of timelineRes.rows) {
        const dStr = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day);
        runningTotal += Number(row.total_leads) || 0;
        runningOpen += Number(row.open_leads) || 0;
        runningRev += Number(row.revenue) || 0;
        totalLeadsSeries.push({ x: dStr, y: runningTotal });
        openPipelineSeries.push({ x: dStr, y: runningOpen });
        expectedRevenueSeries.push({ x: dStr, y: runningRev });
      }
    }

    // Build cumulative Due Today sparkline from matching follow-ups
    let runningDue = 0;
    const dueTodaySeries: { x: string; y: number }[] = [];
    const dueTodayCount = dueTimelineRes.rows.reduce(
      (sum: number, r: any) => sum + (Number(r.due_count) || 0),
      0
    );

    if (dueTimelineRes.rows.length === 0) {
      dueTodaySeries.push({ x: "09:00", y: 0 });
      dueTodaySeries.push({ x: "18:00", y: 0 });
    } else {
      for (const row of dueTimelineRes.rows) {
        runningDue += Number(row.due_count) || 0;
        const tStr = row.hour_bucket instanceof Date ? row.hour_bucket.toISOString() : String(row.hour_bucket);
        dueTodaySeries.push({ x: tStr, y: runningDue });
      }
    }

    const kpis = {
      total,
      openPipeline: kpiRes.rows[0]?.open_pipeline || 0,
      wonLeads: kpiRes.rows[0]?.won_leads || 0,
      dueToday: dueTodayCount,
      expectedRevenue: kpiRes.rows[0]?.expected_revenue || 0,
      series: {
        totalLeads: totalLeadsSeries,
        openPipeline: openPipelineSeries,
        dueToday: dueTodaySeries,
        expectedRevenue: expectedRevenueSeries,
      },
    };

    const filterOptions = {
      assignees: (assigneeRes.rows || []).map((r: any) => ({
        id: r.id,
        name: r.name || r.email || "User",
      })),
      sources: (sourceRes.rows || []).map((r: any) => r.source),
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
      filterOptions,
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


