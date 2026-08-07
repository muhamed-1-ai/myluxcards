import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseConfig, supabaseJson } from "./supabaseAuth";

export type AppRole = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
export type AdminIdentity = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  disabled: boolean;
  mustChangePassword: boolean;
};

export async function currentIdentity(): Promise<AdminIdentity | null> {
  const jar = await cookies();
  const accessToken = jar.get("mlc_access_token")?.value;
  const config = getSupabaseConfig();
  if (!accessToken || !config) return null;
  const auth = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!auth.ok) return null;
  const user = await auth.json();
  try {
    const { data } = await supabaseJson(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,name,role,disabled,must_change_password&limit=1`,
      {},
      true,
    );
    const profile = data?.[0];
    if (!profile || profile.disabled) return null;
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name || user.user_metadata?.name || profile.email.split("@")[0],
      role: profile.role,
      disabled: profile.disabled,
      mustChangePassword: profile.must_change_password,
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(superOnly = false) {
  const identity = await currentIdentity();
  if (!identity || (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN")) {
    return null;
  }
  if (superOnly && identity.role !== "SUPER_ADMIN") return null;
  return identity;
}

function normalizeHost(value: string | null) {
  if (!value) return "";
  return value.replace(/:(443|80)$/, "").toLowerCase();
}

export function validMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) return process.env.NODE_ENV !== "production";
  if (origin) {
    try { return normalizeHost(new URL(origin).host) === normalizedHost; } catch { return false; }
  }
  if (referer) {
    try { return normalizeHost(new URL(referer).host) === normalizedHost; } catch { return false; }
  }
  return process.env.NODE_ENV !== "production";
}

export async function requireAdminPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/?login=1&next=%2Fadmin");
  if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") redirect("/forbidden");
  if (identity.mustChangePassword) redirect("/reset-password?required=1");
  return identity;
}

export async function requestContext() {
  const incoming = await headers();
  return {
    ip: (incoming.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null,
    userAgent: incoming.get("user-agent")?.slice(0, 500) || null,
  };
}

export async function audit(
  actor: AdminIdentity,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown = null,
  after: unknown = null,
) {
  const context = await requestContext();
  const scrub = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(scrub);
    if (!value || typeof value !== "object") return value;
    const blocked = /password|token|secret|key|card|cvv|authorization/i;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !blocked.test(key))
      .map(([key, nested]) => [key, scrub(nested)]));
  };
  await supabaseJson("/rest/v1/admin_audit_logs", {
    method: "POST",
    body: JSON.stringify({
      actor_id: actor.id, actor_role: actor.role, action, entity_type: entityType,
      entity_id: entityId, before_summary: scrub(before), after_summary: scrub(after),
      ip_address: context.ip, user_agent: context.userAgent,
    }),
  }, true);
}

export function safeError(error: unknown) {
  console.error("Admin operation failed:", error);
  return Response.json({ message: "The request could not be completed." }, { status: 500 });
}
