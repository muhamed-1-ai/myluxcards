import { NextResponse } from "next/server";

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

export function getSupabaseServiceConfig() {
  const base = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return base && serviceRoleKey ? { ...base, serviceRoleKey } : null;
}

export async function supabaseJson(
  path: string,
  init: RequestInit = {},
  service = false,
) {
  const config = service ? getSupabaseServiceConfig() : getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  const key: string = service && "serviceRoleKey" in config
    ? String(config.serviceRoleKey)
    : config.anonKey;
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.msg || data?.error_description || "Database request failed.");
    Object.assign(error, { status: response.status, details: data });
    throw error;
  }
  return { data, response };
}

export async function supabaseAuthRequest(
  path: string,
  init: RequestInit,
  accessToken?: string,
) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json(
      { message: "Authentication is not configured yet." },
      { status: 503 },
    );
  }

  const response = await fetch(`${config.url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
