import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { getSupabaseConfig, supabaseJson } from "@/lib/supabaseAuth";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})); const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return Response.json({ message: "Use 12+ characters with upper, lower, number, and symbol." }, { status: 400 });
  }
  const config = getSupabaseConfig(); const token = (await cookies()).get("mlc_access_token")?.value;
  if (!config || !token) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const changed = await fetch(`${config.url}/auth/v1/user`, {
    method: "PUT", headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }), cache: "no-store",
  });
  if (!changed.ok) return Response.json({ message: "Password could not be changed." }, { status: 400 });
  await supabaseJson(`/rest/v1/profiles?id=eq.${identity.id}`, { method: "PATCH", body: JSON.stringify({ must_change_password: false }) }, true);
  return Response.json({ ok: true });
}
