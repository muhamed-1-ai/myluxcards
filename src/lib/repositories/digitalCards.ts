import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";
import type { DigitalCardRow } from "@/types/database";

export async function findDigitalCardBySlug(slug: string, db?: Queryable): Promise<DigitalCardRow | null> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<DigitalCardRow>("select * from digital_cards where slug=$1", [slug]);
    return res.rows[0] ?? null;
  }
  const card = await (prisma as any).digitalCard.findUnique({
    where: { slug },
  });
  if (!card) return null;
  return {
    id: card.id,
    owner_id: card.ownerId,
    slug: card.slug,
    profile: card.profile as Record<string, unknown>,
    design: card.design as Record<string, unknown>,
    active: card.active,
    activated_at: card.activatedAt,
    expires_at: card.expiresAt,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  } as DigitalCardRow;
}

export async function listDigitalCardsForOwner(ownerId: string, db?: Queryable): Promise<DigitalCardRow[]> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<DigitalCardRow>("select * from digital_cards where owner_id=$1 order by updated_at desc", [ownerId]);
    return res.rows;
  }
  const cards = await (prisma as any).digitalCard.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
  });
  return (cards as any[]).map((card: any) => ({
    id: card.id,
    owner_id: card.ownerId,
    slug: card.slug,
    profile: card.profile as Record<string, unknown>,
    design: card.design as Record<string, unknown>,
    active: card.active,
    activated_at: card.activatedAt,
    expires_at: card.expiresAt,
    created_at: card.createdAt,
    updated_at: card.updatedAt,
  })) as DigitalCardRow[];
}
