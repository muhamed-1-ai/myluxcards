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

export async function findManagedUsersByAdmin(adminId: string, isSuperAdmin = false, db: Queryable = pool) {
  const query = `
    SELECT u.*, p.phone, dc.slug as digital_card_slug
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN LATERAL (
      SELECT slug FROM digital_cards WHERE owner_id = u.id ORDER BY created_at DESC LIMIT 1
    ) dc ON TRUE
    ${isSuperAdmin ? "" : "WHERE u.created_by_admin_id = $1"}
    ORDER BY u.created_at DESC
  `;
  return (await db.query<UserRow & { phone?: string; digital_card_slug?: string }>(query, isSuperAdmin ? [] : [adminId])).rows;
}

export async function findManagedUserById(adminId: string, targetUserId: string, isSuperAdmin = false, db: Queryable = pool) {
  if (isSuperAdmin) {
    return findUserById(targetUserId, db);
  }
  return (await db.query<UserRow>(`select ${publicColumns} from users where id=$1 and created_by_admin_id=$2`, [targetUserId, adminId])).rows[0] ?? null;
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
