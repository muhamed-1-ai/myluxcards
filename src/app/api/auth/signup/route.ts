import { getSupabaseConfig, getSupabaseServiceConfig } from "@/lib/supabaseAuth";
import { validMutationOrigin } from "@/lib/adminAuth";
import { NextResponse } from "next/server";

async function createAndLoginUser(config: { url: string; anonKey: string }, cleanName: string, cleanEmail: string, password: string) {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return null;

  const create = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceConfig.serviceRoleKey,
      Authorization: `Bearer ${serviceConfig.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { name: cleanName, role: "CUSTOMER" },
    }),
    cache: "no-store",
  });
  const created = await create.json().catch(() => ({}));
  if (!create.ok) {
    return { error: created, status: create.status };
  }

  const login = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: cleanEmail, password }),
    cache: "no-store",
  });
  const loginData = await login.json().catch(() => ({}));
  return { loginData, loginStatus: login.status };
}

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
    const serviceResult = await createAndLoginUser(config, cleanName, cleanEmail, password);
    if (serviceResult) {
      if (serviceResult.error) {
        console.error("Service signup failed:", serviceResult.status, serviceResult.error);
        const fallbackMessage = "Unable to create your account right now. Please try again later.";
        const status = typeof serviceResult.status === "number" ? serviceResult.status : 500;
      const message = status === 429
          ? fallbackMessage
          : serviceResult.error?.message || serviceResult.error?.msg || serviceResult.error?.error_description || serviceResult.error?.error || fallbackMessage;
        return Response.json({ message }, { status: status >= 500 ? 502 : status });
      }

      const { loginData, loginStatus } = serviceResult;
      if (loginStatus === 200 && loginData.access_token) {
        const response = NextResponse.json(loginData);
        const secure = process.env.NODE_ENV === "production";
        response.cookies.set("mlc_access_token", loginData.access_token, {
          httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: Math.min(loginData.expires_in || 3600, 3600),
        });
        if (loginData.refresh_token) response.cookies.set("mlc_refresh_token", loginData.refresh_token, {
          httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 60 * 60 * 24 * 30,
        });
        return response;
      }

      return NextResponse.json({ message: "Your account was created. Please sign in using your email and password." });
    }

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
      const fallbackMessage = "Unable to create your account right now. Please try again later.";
      const message = upstream.status === 429
        ? fallbackMessage
        : data.message || data.msg || data.error_description || data.error || fallbackMessage;
      return Response.json({ message }, { status: upstream.status >= 500 ? 502 : upstream.status });
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
