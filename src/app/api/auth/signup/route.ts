import { getSupabaseConfig } from "@/lib/supabaseAuth";
import { validMutationOrigin } from "@/lib/adminAuth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { name, email, password } = await request.json().catch(() => ({}));
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return Response.json({ message: "Enter a valid name and email address." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return Response.json({ message: "Password must contain 8 to 128 characters." }, { status: 400 });
  }
  const config = getSupabaseConfig();
  if (!config) return Response.json({ message: "Authentication is not configured yet." }, { status: 503 });

  try {
    const upstream = await fetch(`${config.url}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        // Role is deliberately fixed server-side. Browser-supplied metadata is ignored.
        data: { name: cleanName, role: "CUSTOMER" },
      }),
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("Supabase signup failed:", upstream.status, data);
      return Response.json({
        message: data.message || data.msg || data.error_description || data.error || "Account creation is temporarily unavailable.",
      }, { status: upstream.status >= 500 ? 502 : upstream.status });
    }

    const response = NextResponse.json(data, { status: upstream.status });
    if (data.access_token) {
      const secure = process.env.NODE_ENV === "production";
      response.cookies.set("mlc_access_token", data.access_token, {
        httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: Math.min(data.expires_in || 3600, 3600),
      });
      if (data.refresh_token) response.cookies.set("mlc_refresh_token", data.refresh_token, {
        httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (error) {
    console.error("Supabase signup request failed:", error);
    return Response.json({ message: "Authentication service is unavailable. Please try again shortly." }, { status: 502 });
  }
}
