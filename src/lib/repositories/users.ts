import "server-only";
import { pool } from "../db";
import type { Queryable } from "../db/types";
import type { UserRow, FeaturePermissions } from "@/types/database";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const publicColumns = "id,email,normalized_email,name,email_verified_at,image,role,status,disabled,must_change_password,session_version,created_by_admin_id,feature_permissions,dashboard_layout,terms_accepted,privacy_accepted,cookie_consent,terms_version,privacy_version,cookie_version,legal_accepted_at,last_login_at,created_at,updated_at";

export async function findUserById(id: string, db: Queryable = pool) {
  return (await db.query<UserRow>(`select ${publicColumns} from users where id=$1`, [id])).rows[0] ?? null;
}

export async function findUserByEmail(email: string, db: Queryable = pool) {
  return (await db.query<UserRow>(`select ${publicColumns} from users where normalized_email=$1`, [normalizeEmail(email)])).rows[0] ?? null;
}

export async function findCredentialUser(email: string, db: Queryable = pool) {
  return (await db.query<UserRow>("select * from users where normalized_email=$1", [normalizeEmail(email)])).rows[0] ?? null;
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
  await db.query(`update users set feature_permissions=$1::jsonb, updated_at=now() where id=$2`, [JSON.stringify(permissions), userId]);
  return findUserById(userId, db);
}

export async function updateUserStatus(userId: string, status: string, db: Queryable = pool) {
  const disabled = status === "DISABLED" || status === "SUSPENDED";
  await db.query(`update users set status=$1, disabled=$2, updated_at=now() where id=$3`, [status, disabled, userId]);
  return findUserById(userId, db);
}

export async function updateUserDashboardLayout(userId: string, layout: string, db: Queryable = pool) {
  await db.query(`update users set dashboard_layout=$1, updated_at=now() where id=$2`, [layout, userId]);
  return findUserById(userId, db);
}

export async function updateUserNickname(userId: string, name: string, db: Queryable = pool) {
  await db.query(`update users set name=$1, updated_at=now() where id=$2`, [name, userId]);
  return findUserById(userId, db);
}

export async function updateUserLegalConsent(userId: string, termsVersion: string, privacyVersion: string, cookieVersion: string, db: Queryable = pool) {
  await db.query(
    `update users set terms_accepted=true, privacy_accepted=true, cookie_consent=true, terms_version=$1, privacy_version=$2, cookie_version=$3, legal_accepted_at=now(), updated_at=now() where id=$4`,
    [termsVersion, privacyVersion, cookieVersion, userId]
  );
  return findUserById(userId, db);
}
