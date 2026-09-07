import { requireSuperAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { getCanonicalUserQrUrl } from "@/lib/url";

export async function GET(request: Request) {
  const identity = await requireSuperAdmin();
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role")?.trim() || "ALL";
    const status = searchParams.get("status")?.trim() || "ALL";

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (search) {
      whereClauses.push(
        `(u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR p.phone ILIKE $${paramIdx} OR u.id::text = $${paramIdx} OR dc.slug ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (role !== "ALL") {
      whereClauses.push(`u.role = $${paramIdx}`);
      params.push(role);
      paramIdx++;
    }

    if (status !== "ALL") {
      whereClauses.push(`u.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(DISTINCT u.id)::int as total
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN LATERAL (
        SELECT id, slug FROM digital_cards WHERE owner_id = u.id ORDER BY created_at DESC LIMIT 1
      ) dc ON TRUE
      ${whereSql}
    `;

    const countRes = await pool.query<{ total: number }>(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    const dataQuery = `
      SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.status,
        u.disabled,
        u.created_at,
        u.created_by_admin_id,
        p.phone,
        p.internal_notes,
        dc.slug as digital_card_slug,
        dc.id as digital_card_id,
        dc.active as digital_card_active,
        dc.activated_at as digital_card_activated_at,
        COALESCE(lead_count.cnt, 0) as lead_count,
        COALESCE(order_count.cnt, 0) as order_count
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN LATERAL (
        SELECT id, slug, active, activated_at 
        FROM digital_cards 
        WHERE owner_id = u.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) dc ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as cnt FROM leads WHERE owner_user_id = u.id
      ) lead_count ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as cnt FROM orders WHERE user_id = u.id
      ) order_count ON TRUE
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const dataRes = await pool.query(dataQuery, [...params, limit, offset]);

    const users = dataRes.rows.map((row) => {
      const canonicalQrUrl = getCanonicalUserQrUrl({
        slug: row.digital_card_slug,
        id: row.id,
      });

      return {
        id: row.id,
        email: row.email,
        name: row.name || "Unnamed",
        role: row.role,
        status: row.status,
        disabled: row.disabled,
        createdAt: row.created_at,
        createdByAdminId: row.created_by_admin_id,
        phone: row.phone || null,
        internalNotes: row.internal_notes || null,
        digitalCard: row.digital_card_id
          ? {
              id: row.digital_card_id,
              slug: row.digital_card_slug,
              active: row.digital_card_active,
              activatedAt: row.digital_card_activated_at,
            }
          : null,
        leadCount: Number(row.lead_count || 0),
        orderCount: Number(row.order_count || 0),
        qrUrl: canonicalQrUrl,
        cardStatus: row.digital_card_id ? (row.digital_card_active ? "ACTIVE" : "INACTIVE") : "UNASSIGNED",
        qrStatus: row.digital_card_slug ? "READY" : "PENDING_SLUG",
      };
    });

    return Response.json({
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[Super Admin Users API] Error:", error);
    return safeError(error);
  }
}
