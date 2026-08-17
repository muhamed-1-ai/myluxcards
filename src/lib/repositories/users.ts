import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";
import type { UserRow } from "@/types/database";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findUserById(id: string, db?: Queryable): Promise<UserRow | null> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<UserRow>(
      "select id,email,normalized_email,name,email_verified_at,image,role,status,disabled,must_change_password,session_version,last_login_at,created_at,updated_at from users where id=$1",
      [id]
    );
    return res.rows[0] ?? null;
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      name: true,
      emailVerifiedAt: true,
      image: true,
      role: true,
      status: true,
      disabled: true,
      mustChangePassword: true,
      sessionVersion: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    normalized_email: user.normalizedEmail,
    name: user.name,
    email_verified_at: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    image: user.image,
    role: user.role,
    status: user.status,
    disabled: user.disabled,
    must_change_password: user.mustChangePassword,
    session_version: user.sessionVersion,
    last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  } as unknown as UserRow;
}

export async function findUserByEmail(email: string, db?: Queryable): Promise<UserRow | null> {
  const norm = normalizeEmail(email);
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<UserRow>(
      "select id,email,normalized_email,name,email_verified_at,image,role,status,disabled,must_change_password,session_version,last_login_at,created_at,updated_at from users where normalized_email=$1",
      [norm]
    );
    return res.rows[0] ?? null;
  }
  const user = await prisma.user.findUnique({
    where: { normalizedEmail: norm },
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      name: true,
      emailVerifiedAt: true,
      image: true,
      role: true,
      status: true,
      disabled: true,
      mustChangePassword: true,
      sessionVersion: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    normalized_email: user.normalizedEmail,
    name: user.name,
    email_verified_at: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    image: user.image,
    role: user.role,
    status: user.status,
    disabled: user.disabled,
    must_change_password: user.mustChangePassword,
    session_version: user.sessionVersion,
    last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  } as unknown as UserRow;
}

export async function findCredentialUser(email: string, db?: Queryable): Promise<UserRow | null> {
  const norm = normalizeEmail(email);
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<UserRow>("select * from users where normalized_email=$1", [norm]);
    return res.rows[0] ?? null;
  }
  const user = await prisma.user.findUnique({
    where: { normalizedEmail: norm },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    normalized_email: user.normalizedEmail,
    name: user.name,
    password_hash: user.passwordHash,
    email_verified_at: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    image: user.image,
    role: user.role,
    status: user.status,
    disabled: user.disabled,
    must_change_password: user.mustChangePassword,
    session_version: user.sessionVersion,
    last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  } as unknown as UserRow;
}
