import { requireAdmin, safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime = "nodejs";
export async function GET() {
  const actor = await requireAdmin(); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try { const { data } = await supabaseJson("/rest/v1/payments?select=id,order_id,provider,provider_transaction_id,amount_minor,currency,status,failure_reason,refunded_minor,provider_created_at,created_at&order=created_at.desc&limit=100", {}, true); return Response.json({ data }); }
  catch (error) { return safeError(error); }
}
