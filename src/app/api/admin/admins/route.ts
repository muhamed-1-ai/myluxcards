import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { getSupabaseServiceConfig, supabaseJson } from "@/lib/supabaseAuth";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export async function GET() {
  const actor = await requireAdmin(true); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const { data } = await supabaseJson("/rest/v1/profiles?select=id,email,name,role,disabled,created_at&role=in.(ADMIN,SUPER_ADMIN)&order=created_at.desc", {}, true);
    return Response.json({ data });
  } catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(true); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})); const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: "Enter a valid email." }, { status: 400 });
    const token = randomBytes(32).toString("hex"); const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Buffer.from(digest).toString("hex");
    await supabaseJson("/rest/v1/admin_invites", { method: "POST", body: JSON.stringify({ email, role: "ADMIN", token_hash: tokenHash, invited_by: actor.id, expires_at: new Date(Date.now() + 86400000).toISOString() }) }, true);
    await audit(actor, "ADMIN_INVITED", "admin_invite", email, null, { email, role: "ADMIN" });
    // Token is intentionally not returned. Email delivery requires a configured provider/template.
    return Response.json({ message: "Invite recorded. Configure the email provider before distributing invites." }, { status: 201 });
  } catch (error) { return safeError(error); }
}
export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(true); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || body.id === actor.id) return Response.json({ message: "Invalid target." }, { status: 400 });
    const before = await supabaseJson(`/rest/v1/profiles?id=eq.${body.id}&select=id,role,disabled&limit=1`, {}, true);
    const target = before.data?.[0]; if (!target || target.role === "SUPER_ADMIN") return Response.json({ message: "Super Admin accounts cannot be changed here." }, { status: 403 });
    const changes: Record<string, unknown> = { role_version: Date.now() };
    if (body.role === "ADMIN" || body.role === "CUSTOMER") changes.role = body.role;
    if (typeof body.disabled === "boolean") { changes.disabled = body.disabled; changes.status = body.disabled ? "DISABLED" : "ACTIVE"; }
    await supabaseJson(`/rest/v1/profiles?id=eq.${body.id}`, { method: "PATCH", body: JSON.stringify(changes) }, true);
    const config = getSupabaseServiceConfig();
    if (config && typeof body.disabled === "boolean") {
      await fetch(`${config.url}/auth/v1/admin/users/${body.id}`, {
        method: "PUT",
        headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ban_duration: body.disabled ? "876000h" : "none" }),
      });
    }
    await audit(actor, "ADMIN_ACCESS_CHANGED", "profile", body.id, target, changes);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
