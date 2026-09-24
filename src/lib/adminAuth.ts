import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { pool } from "./db";
import { findUserById, findManagedUserById } from "./repositories/users";
import { AppRole, AccountStatus, FeaturePermissions } from "@/types/database";
import { FeatureKey, isFeatureAllowed, normalizeFeaturePermissions } from "@/lib/permissionsRegistry";

export type AdminRole = AppRole;

export type AdminIdentity = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: AccountStatus;
  disabled: boolean;
  mustChangePassword: boolean;
  createdByAdminId?: string | null;
  featurePermissions: FeaturePermissions;
  terms_accepted?: boolean;
  privacy_accepted?: boolean;
  cookie_consent?: boolean;
  terms_version?: string | null;
  privacy_version?: string | null;
  cookie_version?: string | null;
  legal_accepted_at?: Date | null;
};

import { currentIdentity as currentIdentityCore } from "@/lib/auth/currentIdentity";

export async function currentIdentity(): Promise<AdminIdentity | null>;
export async function currentIdentity(req?: Request): Promise<AdminIdentity | null>;
export async function currentIdentity(req?: Request): Promise<AdminIdentity | null> {
  // Verification delegate to core auth engine.
  // Ensures profile.disabled, profile.status === "DISABLED", profile.session_version !== session.user.sessionVersion are verified.
  const identity = await currentIdentityCore(req);
  if (!identity) return null;

  return {
    id: identity.id,
    email: identity.email,
    name: identity.name,
    role: identity.role,
    status: identity.status,
    disabled: identity.disabled,
    mustChangePassword: identity.mustChangePassword,
    createdByAdminId: identity.createdByAdminId,
    featurePermissions: identity.featurePermissions,
  };
}

export async function requireAuthenticatedUser(): Promise<AdminIdentity | null> {
  return currentIdentity();
}

export async function requireAdmin(options?: boolean | { allowSuper?: boolean }) {
  const identity = await currentIdentity();
  if (!identity) return null;
  const allowSuper = typeof options === "boolean" ? options : options?.allowSuper ?? true;
  if (identity.role === "ADMIN" || (allowSuper && identity.role === "SUPER_ADMIN")) {
    return identity;
  }
  return null;
}

export async function requireSuperAdmin() {
  const identity = await currentIdentity();
  if (!identity || identity.role !== "SUPER_ADMIN") {
    return null;
  }
  return identity;
}

export async function requirePermission(permission: FeatureKey): Promise<AdminIdentity | null> {
  const identity = await currentIdentity();
  if (!identity) return null;
  if (identity.role === "SUPER_ADMIN" || identity.role === "ADMIN") {
    return identity;
  }
  if (!isFeatureAllowed(identity.featurePermissions, permission, identity.role)) {
    return null;
  }
  return identity;
}

export async function requireManagedUserOwnership(targetUserId: string) {
  const identity = await currentIdentity();
  if (!identity) return null;
  if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") return null;

  const isSuperAdmin = identity.role === "SUPER_ADMIN";
  const managedUser = await findManagedUserById(identity.id, targetUserId, isSuperAdmin);
  if (!managedUser) return null;
  return { identity, managedUser };
}

function normalizeHost(value: string | null) {
  if (!value) return "";
  const firstHost = value.split(",")[0].trim();
  const hostWithoutPort = firstHost.replace(/:[0-9]+$/, "").toLowerCase();
  return hostWithoutPort.startsWith("www.") ? hostWithoutPort.slice(4) : hostWithoutPort;
}

export function validMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

  const normalizedHost = normalizeHost(host);
  let normalizedOrigin = "";
  if (origin) {
    try {
      normalizedOrigin = normalizeHost(new URL(origin).host);
    } catch {}
  }
  let normalizedReferer = "";
  if (referer) {
    try {
      normalizedReferer = normalizeHost(new URL(referer).host);
    } catch {}
  }

  // If origin is present, verify against host or referer
  if (normalizedOrigin) {
    if (!normalizedHost) return true;
    if (normalizedOrigin === normalizedHost) return true;
    if (normalizedReferer && normalizedOrigin === normalizedReferer) return true;
    return false;
  }

  // If referer is present without origin, verify against host
  if (normalizedReferer) {
    if (!normalizedHost) return true;
    if (normalizedReferer === normalizedHost) return true;
    return false;
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

export async function requireSuperAdminPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/?login=1&next=%2Fsuper-admin");
  if (identity.role !== "SUPER_ADMIN") redirect("/forbidden");
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
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !blocked.test(key))
        .map(([key, nested]) => [key, scrub(nested)])
    );
  };
  await pool.query(
    `insert into admin_audit_logs(actor_id,actor_role,action,entity_type,entity_id,before_summary,after_summary,ip_address,user_agent)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      actor.id,
      actor.role,
      action,
      entityType,
      entityId,
      JSON.stringify(scrub(before)),
      JSON.stringify(scrub(after)),
      context.ip,
      context.userAgent,
    ]
  );
}

export function safeError(error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[API_ERROR]", {
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
    ...context,
  });
  return Response.json({ message: "The request could not be completed." }, { status: 500 });
}
