import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";

export async function findProfile(id: string, db?: Queryable) {
  if (db && db !== (await import("../db")).pool) {
    return (await db.query("select p.id,u.email,u.name,u.image,u.role,u.status,u.disabled,u.must_change_password,p.phone,p.created_at,p.updated_at from profiles p join users u on u.id=p.id where p.id=$1", [id])).rows[0] ?? null;
  }
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          email: true,
          name: true,
          image: true,
          role: true,
          status: true,
          disabled: true,
          mustChangePassword: true,
        },
      },
    },
  });
  if (!profile || !profile.user) return null;
  return {
    id: profile.id,
    email: profile.user.email,
    name: profile.user.name,
    image: profile.user.image,
    role: profile.user.role,
    status: profile.user.status,
    disabled: profile.user.disabled,
    must_change_password: profile.user.mustChangePassword,
    phone: profile.phone,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}
