import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";

export async function findProviderAccount(provider: string, providerAccountId: string, db?: Queryable) {
  if (db && db !== (await import("../db")).pool) {
    return (await db.query("select id,user_id,type,provider,provider_account_id,created_at,updated_at from accounts where provider=$1 and provider_account_id=$2", [provider, providerAccountId])).rows[0] ?? null;
  }
  const account = await (prisma as any).account.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId },
    },
  });
  if (!account) return null;
  return {
    id: account.id,
    user_id: account.userId,
    type: account.type,
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

export async function linkProviderAccount(userId: string, provider: string, providerAccountId: string, type = "oauth", db?: Queryable) {
  if (db && db !== (await import("../db")).pool) {
    return (await db.query("insert into accounts(user_id,type,provider,provider_account_id) values($1,$2,$3,$4) returning id,user_id,type,provider,provider_account_id,created_at,updated_at", [userId, type, provider, providerAccountId])).rows[0];
  }
  const account = await (prisma as any).account.create({
    data: {
      userId,
      provider,
      providerAccountId,
      type,
    },
  });
  return {
    id: account.id,
    user_id: account.userId,
    type: account.type,
    provider: account.provider,
    provider_account_id: account.providerAccountId,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}
