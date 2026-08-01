import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validMutationOrigin } from "@/lib/adminAuth";
import { getSupabaseConfig } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const config = getSupabaseConfig();
  if (!config) return NextResponse.json({ message: "Authentication is not configured." }, { status: 503 });

  const jar = await cookies();
  const refreshToken = jar.get("mlc_refresh_token")?.value;
  if (!refreshToken) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const upstream = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data.access_token) {
    const expired = NextResponse.json({ message: "Sign in required." }, { status: 401 });
    expired.cookies.set("mlc_access_token", "", { httpOnly: true, path: "/", maxAge: 0 });
    expired.cookies.set("mlc_refresh_token", "", { httpOnly: true, path: "/api/auth", maxAge: 0 });
    return expired;
  }

  const secure = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mlc_access_token", data.access_token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: Math.min(data.expires_in || 3600, 3600),
  });
  if (data.refresh_token) response.cookies.set("mlc_refresh_token", data.refresh_token, {
    httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
