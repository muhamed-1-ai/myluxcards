import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { pool } from "./db";
import { findUserById } from "./repositories/users";

export type AdminRole = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";

export type AdminIdentity = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  disabled: boolean;
  mustChangePassword: boolean;
};

export async function currentIdentity(): Promise<AdminIdentity | null> {
  try {
    const session=await getServerSession(authOptions);
    if(!session?.user?.id||!Number.isInteger(session.user.sessionVersion))return null;
    const profile=await findUserById(session.user.id);
    if(!profile||profile.disabled||profile.status!=="ACTIVE"||profile.session_version!==session.user.sessionVersion)return null;
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      disabled: profile.disabled,
      mustChangePassword: profile.must_change_password,
    };
  } catch (error) {
    console.error("[Auth] currentIdentity error:", error);
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
  const host = value.replace(/:(443|80)$/, "").toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
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
  try {
    const incoming = await headers();
    return {
      ip: (incoming.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64) || null,
      userAgent: incoming.get("user-agent")?.slice(0, 500) || null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
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
  await pool.query(`insert into admin_audit_logs(actor_id,actor_role,action,entity_type,entity_id,before_summary,after_summary,ip_address,user_agent)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[actor.id,actor.role,action,entityType,entityId,JSON.stringify(scrub(before)),JSON.stringify(scrub(after)),context.ip,context.userAgent]);
}

export function safeError(error: unknown) {
  console.error("Admin operation failed:", error);
  return Response.json({ message: "The request could not be completed." }, { status: 500 });
}
