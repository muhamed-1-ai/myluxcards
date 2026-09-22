import { requireAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db/core";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin(true);
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const res = await pool.query(
      `SELECT id, actor_id, actor_role, action, COALESCE(entity_type, 'system') as entity_type, entity_id, before_summary, after_summary, ip_address, user_agent, created_at 
       FROM admin_audit_logs 
       ORDER BY created_at DESC 
       LIMIT 100`
    );
    return Response.json({ data: res.rows });
  } catch (error) {
    return safeError(error);
  }
}
