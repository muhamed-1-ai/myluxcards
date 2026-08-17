import { requireAdmin, safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime = "nodejs";
export async function GET() {
  const actor = await requireAdmin(true); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try { const { data } = await supabaseJson("/rest/v1/admin_audit_logs?select=id,actor_id,actor_role,action,entity_type,entity_id,before_summary,after_summary,ip_address,user_agent,created_at&order=created_at.desc&limit=100", {}, true); return Response.json({ data }); }
  catch (error) { return safeError(error); }
}
