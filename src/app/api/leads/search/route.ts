import { currentIdentity } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Unauthorized" }, { status: 401 });
  if (!identity.featurePermissions?.leads && identity.role !== "SUPER_ADMIN" && identity.role !== "ADMIN") {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const stage = searchParams.get("stage") || "";
  const source = searchParams.get("source") || "";
  const assignedUserId = searchParams.get("assignedUserId") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25")));
  const offset = (page - 1) * limit;

  try {
    let whereClause = "1=1";
    const params: any[] = [];
    let paramIndex = 1;

    // Security constraints based on role
    if (identity.role === "SUPER_ADMIN") {
      // Super Admin: All leads
    } else if (identity.role === "ADMIN") {
      // Admin: Own leads + Managed users' leads
      whereClause += ` AND (l.owner_user_id = $${paramIndex} OR l.assigned_user_id = $${paramIndex} OR l.owner_user_id IN (SELECT id FROM users WHERE created_by_admin_id = $${paramIndex}))`;
      params.push(identity.id);
      paramIndex++;
    } else {
      // Normal User: Own leads or leads assigned to them
      whereClause += ` AND (l.owner_user_id = $${paramIndex} OR l.assigned_user_id = $${paramIndex})`;
      params.push(identity.id);
      paramIndex++;
    }

    // Filters
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
    const dataQuery = `
      SELECT 
        l.id, l.name, l.company_name as "companyName", l.contact_number as "contactNumber", 
        l.email, l.status as "stage", l.source, l.created_at as "createdAt",
        l.owner_user_id as "ownerUserId", l.assigned_user_id as "assignedUserId", l.profile_image as "profileImage",
        u.name as "assignedUserName",
        (SELECT note FROM lead_follow_ups WHERE lead_id = l.id AND status = 'SCHEDULED' ORDER BY scheduled_at ASC LIMIT 1) as "nextFollowUpNote",
        (SELECT scheduled_at FROM lead_follow_ups WHERE lead_id = l.id AND status = 'SCHEDULED' ORDER BY scheduled_at ASC LIMIT 1) as "nextFollowUpAt",
        (SELECT description FROM lead_activities WHERE lead_id = l.id AND type = 'REMARK' ORDER BY occurred_at DESC LIMIT 1) as "lastRemark"
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const [countRes, dataRes] = await Promise.all([
      pool.query(countQuery, params.slice(0, paramIndex - 1)), // Use params without limit/offset for count
      pool.query(dataQuery, params)
    ]);

    const total = countRes.rows[0]?.total || 0;
    const leads = dataRes.rows;

    return Response.json({
      leads,
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
