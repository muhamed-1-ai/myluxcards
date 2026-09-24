import "server-only";

import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "../auth";
import { getAuthSecret } from "../authSecret";
import { findUserById } from "../repositories/users";
import type { AppRole, AccountStatus, FeaturePermissions } from "@/types/database";
import { normalizeFeaturePermissions } from "../permissionsRegistry";

export type AuthIdentity = {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  status: AccountStatus;
  disabled: boolean;
  mustChangePassword: boolean;
  createdByAdminId?: string | null;
  featurePermissions: FeaturePermissions;
  accountId: string; // Account/tenant identifier for multi-tenant isolation
};

/**
 * Centralized, single source of truth for Server-Side Authentication & Authorization.
 * Handles cookie resolution across production (HTTPS/proxy), staging, and local environments.
 * Strictly verifies database status & session_version to prevent stale or unauthorized access.
 */
export async function currentIdentity(req?: Request): Promise<AuthIdentity | null> {
  const secret = getAuthSecret();
  const isProd = process.env.NODE_ENV === "production";
  const requestPath = req ? new URL(req.url).pathname : "Server Component / Unknown";

  let userId: string | null = null;
  let tokenSessionVersion: number | undefined = undefined;
  let userRole: AppRole | undefined = undefined;

  try {
    // 1. Try primary NextAuth session resolution via getServerSession
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      userId = session.user.id;
      userRole = session.user.role as AppRole;
      tokenSessionVersion = session.user.sessionVersion;
    }

    // 2. Fallback: If req is provided and getServerSession missed (e.g. cookie name prefix mismatch behind SSL proxy), decode JWT directly
    if (!userId && req) {
      // Try secure cookie first, then non-secure fallback
      let jwtToken = await getToken({ req: req as any, secret, secureCookie: isProd });
      if (!jwtToken && isProd) {
        jwtToken = await getToken({ req: req as any, secret, secureCookie: false });
      }
      if (jwtToken?.userId) {
        userId = jwtToken.userId as string;
        userRole = jwtToken.role as AppRole;
        tokenSessionVersion = jwtToken.sessionVersion as number | undefined;
      }
    }

    if (!userId) {
      logAuthDebug({
        route: requestPath,
        session: false,
        userId: null,
        accountId: null,
        role: null,
        authorized: false,
        reason: "No session token or user ID found",
      });
      return null;
    }

    // 3. Database user verification
    const profile = await findUserById(userId);
    if (
      !profile ||
      profile.disabled ||
      profile.status === "DISABLED" ||
      profile.status === "SUSPENDED" ||
      (Number.isInteger(tokenSessionVersion) && profile.session_version !== tokenSessionVersion)
    ) {
      logAuthDebug({
        route: requestPath,
        session: true,
        userId,
        accountId: userId,
        role: profile?.role || null,
        authorized: false,
        reason: !profile
          ? "User not found in DB"
          : profile.disabled || profile.status !== "ACTIVE"
          ? `User status ${profile.status} (disabled=${profile.disabled})`
          : "Session version mismatch (token revoked)",
      });
      return null;
    }

    const featurePermissions: FeaturePermissions = normalizeFeaturePermissions(profile.feature_permissions);

    const identity: AuthIdentity = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      status: profile.status,
      disabled: profile.disabled,
      mustChangePassword: profile.must_change_password,
      createdByAdminId: profile.created_by_admin_id,
      featurePermissions,
      accountId: profile.id, // Primary tenant/account isolation ID
    };

    logAuthDebug({
      route: requestPath,
      session: true,
      userId: identity.id,
      accountId: identity.accountId,
      role: identity.role,
      authorized: true,
    });

    return identity;
  } catch (error) {
    console.error("[AUTH_ERROR] Error in currentIdentity:", error);
    logAuthDebug({
      route: requestPath,
      session: false,
      userId: null,
      accountId: null,
      role: null,
      authorized: false,
      reason: error instanceof Error ? error.message : "Unknown auth error",
    });
    return null;
  }
}

function logAuthDebug(data: {
  route: string;
  session: boolean;
  userId: string | null;
  accountId: string | null;
  role: string | null;
  authorized: boolean;
  reason?: string;
}) {
  console.log("[AUTH_DEBUG]", JSON.stringify(data));
}
