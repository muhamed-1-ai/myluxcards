import "server-only";

import { currentIdentity, AdminIdentity } from "./adminAuth";
import { pool } from "./db";
import { normalizeEmail } from "./repositories/users";

/**
 * AUTHORITATIVE APPLICATION OWNER CONFIGURATION
 * 
 * Only the single primary owner account has authority to promote or remove administrators.
 * Ownership is bound strictly to the immutable database user ID and email address,
 * verified directly against the PostgreSQL users table and verified server session.
 * 
 * It CANNOT be established or overridden from:
 * - Client-submitted request bodies, query parameters, or form data
 * - Display names or headers
 * - Generic domain matching (@gmail.com)
 * - LocalStorage or client-side role flags
 * - First-to-register race conditions
 */
export const PRIMARY_OWNER_EMAIL = "muhammedfebincholayil@gmail.com";
export const PRIMARY_OWNER_USER_ID = "b8c2491d-3769-4850-86d9-1ff17eef2257";

export function getOwnerConfig() {
  const email = (process.env.APP_OWNER_EMAIL || process.env.OWNER_EMAIL || PRIMARY_OWNER_EMAIL).trim().toLowerCase();
  const userId = (process.env.APP_OWNER_USER_ID || process.env.OWNER_USER_ID || PRIMARY_OWNER_USER_ID).trim();
  return { email, userId };
}

/**
 * Resolves and verifies the authoritative owner record directly from the database.
 * Fails closed if the database does not contain an active, matching account.
 */
export async function resolveAuthoritativeOwnerRecord() {
  const { email, userId } = getOwnerConfig();

  const result = await pool.query<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    disabled: boolean;
  }>(
    `SELECT id, email, name, role, status, disabled
     FROM users
     WHERE id = $1 AND LOWER(email) = LOWER($2)`,
    [userId, email]
  );

  const owner = result.rows[0];
  if (!owner) {
    console.error("[OWNER_AUTH_ERROR] Configured owner account not found in database:", { userId, email });
    return null;
  }

  if (owner.disabled || owner.status === "DISABLED" || owner.status === "SUSPENDED") {
    console.error("[OWNER_AUTH_ERROR] Configured owner account is disabled or suspended:", { userId, email, status: owner.status });
    return null;
  }

  return owner;
}

/**
 * Checks whether a given user ID or email belongs to the protected primary owner account.
 */
export function isOwnerAccount(targetUserId: string | null | undefined, targetEmail?: string | null): boolean {
  if (!targetUserId && !targetEmail) return false;
  const { email, userId } = getOwnerConfig();

  if (targetUserId && targetUserId === userId) {
    return true;
  }
  if (targetEmail && normalizeEmail(targetEmail) === email) {
    return true;
  }
  return false;
}

/**
 * Checks whether the currently authenticated actor is the authoritative primary owner.
 */
export function isAuthoritativeOwner(identity: AdminIdentity | null): boolean {
  if (!identity) return false;
  const { email, userId } = getOwnerConfig();

  return (
    identity.id === userId &&
    normalizeEmail(identity.email) === email &&
    !identity.disabled &&
    identity.status === "ACTIVE"
  );
}

/**
 * Server guard: Enforces that the current request actor is the authenticated primary owner.
 * Returns the verified actor identity, or returns a 401/403 Response.
 */
export async function requireAuthoritativeOwner(req?: Request): Promise<
  { success: true; actor: AdminIdentity } | { success: false; response: Response }
> {
  const identity = await currentIdentity(req);
  if (!identity) {
    return {
      success: false,
      response: Response.json({ message: "Authentication required." }, { status: 401 }),
    };
  }

  // Authoritative identity check
  if (!isAuthoritativeOwner(identity)) {
    console.warn("[SECURITY_AUDIT] Non-owner attempted admin management action:", {
      actorId: identity.id,
      actorEmail: identity.email,
      actorRole: identity.role,
    });
    return {
      success: false,
      response: Response.json(
        { message: "Forbidden: Only the primary owner account (muhammedfebincholayil@gmail.com) can manage administrators." },
        { status: 403 }
      ),
    };
  }

  // Database verification check
  const authoritativeRecord = await resolveAuthoritativeOwnerRecord();
  if (!authoritativeRecord || authoritativeRecord.id !== identity.id) {
    return {
      success: false,
      response: Response.json(
        { message: "Owner authority configuration error. Please contact server administration." },
        { status: 500 }
      ),
    };
  }

  return { success: true, actor: identity };
}
