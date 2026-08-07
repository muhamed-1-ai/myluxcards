import { getSupabaseConfig, supabaseJson } from "@/lib/supabaseAuth";
import { NextResponse } from "next/server";
import { validMutationOrigin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const config = getSupabaseConfig();
  if (!config) return NextResponse.json({ message: "Authentication is not configured yet." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const upstream = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const errorText = String(data.code || data.error || data.error_description || data.msg || data.message || "").toLowerCase();
    const unconfirmed = errorText.includes("not confirmed") || errorText.includes("email_not_confirmed") || errorText.includes("confirm") || errorText.includes("verification");
    if (unconfirmed) {
      return NextResponse.json({ message: "Please confirm your email before signing in. You can request a new confirmation email below.", code: "EMAIL_NOT_CONFIRMED" }, { status: 403 });
    }
    return NextResponse.json({ message: "Email or password is incorrect." }, { status: upstream.status === 429 ? 429 : 401 });
  }
  let profile = null;
  try {
    const result = await supabaseJson(`/rest/v1/profiles?id=eq.${data.user.id}&select=role,disabled,must_change_password&limit=1`, {}, true);
    profile = result.data?.[0] || null;
  } catch { /* Migration may not be applied yet; customer login remains compatible. */ }
  if (profile?.disabled) return NextResponse.json({ message: "Email or password is incorrect." }, { status: 401 });
  const response = NextResponse.json({
    user: data.user,
    role: profile?.role || "CUSTOMER",
    mustChangePassword: Boolean(profile?.must_change_password),
  });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("mlc_access_token", data.access_token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: Math.min(data.expires_in || 3600, 3600),
  });
  if (data.refresh_token) response.cookies.set("mlc_refresh_token", data.refresh_token, {
    httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
