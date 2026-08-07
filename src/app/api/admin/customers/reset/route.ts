import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { getSupabaseConfig, supabaseJson } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid customer." }, { status: 400 });
    const result = await supabaseJson(`/rest/v1/profiles?id=eq.${encodeURIComponent(body.id)}&role=eq.CUSTOMER&select=id,email&limit=1`, {}, true);
    const customer = result.data?.[0];
    if (!customer?.email) return Response.json({ message: "Customer not found." }, { status: 404 });
    const config = getSupabaseConfig();
    if (!config) return Response.json({ message: "Authentication is not configured." }, { status: 503 });
    const upstream = await fetch(`${config.url}/auth/v1/recover`, { method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: customer.email, redirect_to: `${new URL(request.url).origin}/reset-password` }), cache: "no-store" });
    if (!upstream.ok) return Response.json({ message: "Password-reset email could not be sent." }, { status: 502 });
    await audit(actor, "CUSTOMER_PASSWORD_RESET_SENT", "profile", customer.id, null, { email: customer.email });
    return Response.json({ ok: true, message: "Password-reset email sent." });
  } catch (error) { return safeError(error); }
}
