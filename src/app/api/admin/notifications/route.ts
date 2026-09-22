import { requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db/core";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize")) || 25));
    const offset = (page - 1) * pageSize;

    const countRes = await pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM admin_notifications");
    const total = Number(countRes.rows[0]?.count || 0);

    const listRes = await pool.query(
      `SELECT id, type, title, message, order_id, read_at, email_recipient, emailed_at, email_error, created_at 
       FROM admin_notifications 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return Response.json({ data: listRes.rows, page, pageSize, total });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid notification." }, { status: 400 });

    const readAt = body.read === false ? null : new Date().toISOString();
    const updateRes = await pool.query(
      `UPDATE admin_notifications SET read_at = $1 WHERE id = $2 RETURNING *`,
      [readAt, body.id]
    );

    if (!updateRes.rows[0]) return Response.json({ message: "Notification not found." }, { status: 404 });
    return Response.json({ data: updateRes.rows[0] });
  } catch (error) { return safeError(error); }
}
