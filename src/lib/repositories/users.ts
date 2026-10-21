import "server-only";
import { pool } from "../db";
import type { Queryable } from "../db/types";
import type { UserRow, FeaturePermissions } from "@/types/database";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const publicColumns = "id,email,name,role,status,disabled,must_change_password,session_version,created_by_admin_id,feature_permissions,created_at,updated_at";

export async function findUserById(id: string, db: Queryable = pool) {
  return (await db.query<UserRow>(`select ${publicColumns} from users where id=$1`, [id])).rows[0] ?? null;
}

export async function findUserByEmail(email: string, db: Queryable = pool) {
  return (await db.query<UserRow>(`select ${publicColumns} from users where LOWER(email)=$1`, [normalizeEmail(email)])).rows[0] ?? null;
}

export async function findCredentialUser(email: string, db: Queryable = pool) {
  return (await db.query<UserRow>(`select ${publicColumns},password_hash from users where LOWER(email)=$1`, [normalizeEmail(email)])).rows[0] ?? null;
}

export interface FindManagedUsersOptions {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export async function findManagedUsersByAdmin(
  adminId: string,
  optionsOrSuper: boolean | FindManagedUsersOptions = false,
  db: Queryable = pool
) {
  const options: FindManagedUsersOptions =
    typeof optionsOrSuper === "object" && optionsOrSuper !== null
      ? optionsOrSuper
      : {};

  const conditions: string[] = [];
  const params: any[] = [];

  if (options.status && options.status !== "ALL") {
    params.push(options.status.toUpperCase());
    conditions.push(`u.status = $${params.length}`);
  }

  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim().toLowerCase()}%`;
    params.push(term);
    conditions.push(`(LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitSql = options.limit && options.limit > 0 ? `LIMIT ${Number(options.limit)}` : "";
  const offsetSql = options.offset && options.offset > 0 ? `OFFSET ${Number(options.offset)}` : "";

  // Explicit projection: NEVER expose password_hash or sensitive secrets in directory queries
  const query = `
    SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.status,
      u.disabled,
      u.created_at,
      u.updated_at,
      u.created_by_admin_id,
      u.feature_permissions,
      p.phone,
      dc.slug as digital_card_slug
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN LATERAL (
      SELECT slug FROM digital_cards WHERE owner_id = u.id ORDER BY created_at DESC LIMIT 1
    ) dc ON TRUE
    ${whereSql}
    ORDER BY u.created_at DESC
    ${limitSql}
    ${offsetSql}
  `;

  return (await db.query<UserRow & { phone?: string; digital_card_slug?: string }>(query, params)).rows;
}

export async function findManagedUserById(
  adminId: string,
  targetUserId: string,
  isSuperAdmin = false,
  db: Queryable = pool
) {
  // Authorized operational admins and super admins can view directory user details
  return findUserById(targetUserId, db);
}

export async function updateUserPermissions(userId: string, permissions: Record<string, boolean>, db: Queryable = pool) {
  await db.query(`update users set feature_permissions=$1::jsonb, session_version=session_version+1, updated_at=now() where id=$2`, [JSON.stringify(permissions), userId]);
  return findUserById(userId, db);
}

export async function updateUserStatus(userId: string, status: string, db: Queryable = pool) {
  const disabled = status === "DISABLED" || status === "SUSPENDED";
  await db.query(`update users set status=$1, disabled=$2, session_version=session_version+1, updated_at=now() where id=$3`, [status, disabled, userId]);
  return findUserById(userId, db);
}

export async function updateUserDashboardLayout(userId: string, layout: string, db: Queryable = pool) {
  await db.query(`update users set updated_at=now() where id=$1`, [userId]);
  return findUserById(userId, db);
}

export async function updateUserNickname(userId: string, name: string, db: Queryable = pool) {
  await db.query(`update users set name=$1, updated_at=now() where id=$2`, [name, userId]);
  return findUserById(userId, db);
}

export async function updateUserLegalConsent(userId: string, termsVersion: string, privacyVersion: string, cookieVersion: string, db: Queryable = pool) {
  await db.query(
    `update users set updated_at=now() where id=$1`,
    [userId]
  );
  return findUserById(userId, db);
}

export async function getUserDashboardPreferences(userId: string, db: Queryable = pool) {
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB`);
    const res = await db.query<{ dashboard_preferences: any }>(
      `SELECT dashboard_preferences FROM users WHERE id=$1`,
      [userId]
    );
    return res.rows[0]?.dashboard_preferences ?? null;
  } catch (error) {
    console.error("[getUserDashboardPreferences] Error:", error);
    return null;
  }
}

export async function updateUserDashboardPreferences(userId: string, prefs: any, db: Queryable = pool) {
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB`);
    await db.query(
      `UPDATE users SET dashboard_preferences=$1::jsonb, updated_at=now() WHERE id=$2`,
      [JSON.stringify(prefs), userId]
    );
    return true;
  } catch (error) {
    console.error("[updateUserDashboardPreferences] Error:", error);
    return false;
  }
}
