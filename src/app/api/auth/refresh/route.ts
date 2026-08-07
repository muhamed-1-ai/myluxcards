import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validMutationOrigin } from "@/lib/adminAuth";
import { getSupabaseConfig } from "@/lib/supabaseAuth";

const safeNextPath = (value: string | null) => value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";

async function refreshSession(request: Request, redirectTo?: string) {
  const destination = redirectTo ? new URL(safeNextPath(redirectTo), request.url) : null;
  const reply = (body: { ok?: boolean; message?: string }, status: number) =>
    destination
      ? NextResponse.redirect(status === 200 ? destination : new URL(`/?login=1&next=${encodeURIComponent(destination.pathname + destination.search)}`, request.url))
      : NextResponse.json(body, { status });

  if (!redirectTo && !validMutationOrigin(request)) return reply({ message: "Invalid request origin." }, 403);
  const config = getSupabaseConfig();
  if (!config) return reply({ message: "Authentication is not configured." }, 503);

  const jar = await cookies();
  const refreshToken = jar.get("mlc_refresh_token")?.value;
  if (!refreshToken) return reply({ message: "Sign in required." }, 401);

  const upstream = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data.access_token) {
    const expired = reply({ message: "Sign in required." }, 401);
    expired.cookies.set("mlc_access_token", "", { httpOnly: true, path: "/", maxAge: 0 });
    expired.cookies.set("mlc_refresh_token", "", { httpOnly: true, path: "/api/auth", maxAge: 0 });
    return expired;
  }

  const secure = process.env.NODE_ENV === "production";
  const response = reply({ ok: true }, 200);
  response.cookies.set("mlc_access_token", data.access_token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: Math.min(data.expires_in || 3600, 3600),
  });
  if (data.refresh_token) response.cookies.set("mlc_refresh_token", data.refresh_token, {
    httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function POST(request: Request) {
  return refreshSession(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return refreshSession(request, url.searchParams.get("next") || "/dashboard");
}
