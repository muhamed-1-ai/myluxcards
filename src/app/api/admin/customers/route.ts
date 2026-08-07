import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url); const search = url.searchParams.get("search")?.trim().slice(0, 100);
    let path = "/rest/v1/profiles?select=id,email,name,phone,role,status,disabled,created_at&role=eq.CUSTOMER";
    if (search) path += `&or=(email.ilike.*${encodeURIComponent(search)}*,name.ilike.*${encodeURIComponent(search)}*)`;
    const { data, response } = await supabaseJson(`${path}&order=created_at.desc`, { headers: { Prefer: "count=exact", Range: "0-49" } }, true);
    return Response.json({ data, total: Number(response.headers.get("content-range")?.split("/")[1] || 0) });
  } catch (error) { return safeError(error); }
}
export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid request." }, { status: 400 });
    const before = await supabaseJson(`/rest/v1/profiles?id=eq.${body.id}&role=eq.CUSTOMER&select=id,email,disabled,must_change_password&limit=1`, {}, true);
    if (!before.data?.[0]) return Response.json({ message: "Customer not found." }, { status: 404 });
    if (body.forcePasswordReset === true) {
      await supabaseJson(`/rest/v1/profiles?id=eq.${body.id}&role=eq.CUSTOMER`, { method: "PATCH", body: JSON.stringify({ must_change_password: true, role_version: Date.now() }) }, true);
      await audit(actor, "CUSTOMER_PASSWORD_CHANGE_REQUIRED", "profile", body.id, before.data[0], { must_change_password: true });
      return Response.json({ ok: true, message: "Customer will be required to change their password at next sign-in." });
    }
    if (typeof body.disabled !== "boolean") return Response.json({ message: "Invalid request." }, { status: 400 });
    await supabaseJson(`/rest/v1/profiles?id=eq.${body.id}&role=eq.CUSTOMER`, { method: "PATCH", body: JSON.stringify({ disabled: body.disabled, status: body.disabled ? "DISABLED" : "ACTIVE", role_version: Date.now() }) }, true);
    await audit(actor, body.disabled ? "CUSTOMER_DISABLED" : "CUSTOMER_REACTIVATED", "profile", body.id, before.data[0], { disabled: body.disabled });
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
