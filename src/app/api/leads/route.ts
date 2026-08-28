import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { LeadStatus } from "@/lib/leads";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const statusFilter = searchParams.get("status")?.trim().toUpperCase() || "ALL";
  const sortBy = searchParams.get("sort")?.trim().toLowerCase() || "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
  const offset = (page - 1) * limit;

  try {
    // 1. Fetch real-time summary counts for the owner
    const summaryRes = await pool.query<{
      total: string;
      new_count: string;
      follow_up_count: string;
      won_count: string;
    }>(
      `select
         count(*) filter (where status <> 'ARCHIVED') as total,
         count(*) filter (where status = 'NEW') as new_count,
         count(*) filter (where status = 'FOLLOW_UP') as follow_up_count,
         count(*) filter (where status = 'WON') as won_count
       from card_leads
       where owner_user_id = $1`,
      [identity.id]
    );

    const summaryRow = summaryRes.rows[0] || { total: "0", new_count: "0", follow_up_count: "0", won_count: "0" };
    const summary = {
      total: parseInt(summaryRow.total || "0", 10),
      newCount: parseInt(summaryRow.new_count || "0", 10),
      followUpCount: parseInt(summaryRow.follow_up_count || "0", 10),
      wonCount: parseInt(summaryRow.won_count || "0", 10),
    };

    // 2. Build filtered list query
    const whereConditions: string[] = ["l.owner_user_id = $1"];
    const queryParams: any[] = [identity.id];
    let paramIdx = 2;

    if (statusFilter !== "ALL") {
      whereConditions.push(`l.status = $${paramIdx}`);
      queryParams.push(statusFilter);
      paramIdx++;
    } else {
      whereConditions.push(`l.status <> 'ARCHIVED'`);
    }

    if (search) {
      whereConditions.push(
        `(l.name ilike $${paramIdx} or l.company ilike $${paramIdx} or l.phone ilike $${paramIdx} or l.email ilike $${paramIdx})`
      );
      queryParams.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = whereConditions.join(" and ");

    let orderByClause = "l.created_at desc";
    if (sortBy === "oldest") orderByClause = "l.created_at asc";
    else if (sortBy === "follow_up") orderByClause = "l.next_follow_up_at asc nulls last, l.created_at desc";

    // Count total filtered records
    const countRes = await pool.query<{ count: string }>(
      `select count(*) from card_leads l where ${whereClause}`,
      queryParams
    );
    const totalRecords = parseInt(countRes.rows[0]?.count || "0", 10);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    // Fetch paginated leads
    const leadsRes = await pool.query<{
      id: string;
      card_id: string;
      owner_user_id: string;
      name: string;
      email: string | null;
      phone: string | null;
      phone_normalized: string | null;
      company: string | null;
      message: string | null;
      status: LeadStatus;
      source: string;
      next_follow_up_at: Date | null;
      notes: string | null;
      submission_count: number;
      consent_at: Date;
      last_seen_at: Date;
      created_at: Date;
      updated_at: Date;
      card_slug: string | null;
    }>(
      `select l.id, l.card_id, l.owner_user_id, l.name, l.email, l.phone, l.phone_normalized,
              l.company, l.message, l.status, l.source, l.next_follow_up_at, l.notes,
              l.submission_count, l.consent_at, l.last_seen_at, l.created_at, l.updated_at,
              c.slug as card_slug
       from card_leads l
       left join digital_cards c on c.id = l.card_id
       where ${whereClause}
       order by ${orderByClause}
       limit $${paramIdx} offset $${paramIdx + 1}`,
      [...queryParams, limit, offset]
    );

    return Response.json({
      summary,
      leads: leadsRes.rows,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    return safeError(error);
  }
}
