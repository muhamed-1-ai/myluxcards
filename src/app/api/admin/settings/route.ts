import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime = "nodejs";
export async function GET() {
  const actor = await requireAdmin(true); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try { const { data } = await supabaseJson("/rest/v1/website_settings?id=eq.true&select=*", {}, true); return Response.json({ data: data?.[0] }); }
  catch (error) { return safeError(error); }
}
export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(true); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})); const allowed = ["business_name","support_email","support_phone","order_notification_email","currency","low_stock_threshold","maintenance_message","terms_url","privacy_url"];
    const input = Object.fromEntries(allowed.filter(key => typeof body[key] === (key === "low_stock_threshold" ? "number" : "string")).map(key => [key, typeof body[key] === "string" ? body[key].trim().slice(0, 1000) : body[key]]));
    if (input.low_stock_threshold !== undefined && (!Number.isInteger(input.low_stock_threshold) || Number(input.low_stock_threshold) < 0 || Number(input.low_stock_threshold) > 100000)) {
      return Response.json({ message: "Low-stock threshold is invalid." }, { status: 400 });
    }
    if (typeof input.currency === "string") input.currency = input.currency.toUpperCase();
    if (input.currency !== undefined && !/^[A-Z]{3}$/.test(String(input.currency))) {
      return Response.json({ message: "Currency must be a three-letter ISO code." }, { status: 400 });
    }
    const before = await supabaseJson("/rest/v1/website_settings?id=eq.true&select=*", {}, true);
    input.updated_by = actor.id; input.updated_at = new Date().toISOString();
    await supabaseJson("/rest/v1/website_settings?id=eq.true", { method: "PATCH", body: JSON.stringify(input) }, true);
    await audit(actor, "WEBSITE_SETTINGS_UPDATED", "website_settings", "global", before.data?.[0], input);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
