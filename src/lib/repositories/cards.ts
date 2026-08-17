import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";
import { hashCardToken } from "../security/cardTokens";
export { newPublicCardToken, hashCardToken } from "../security/cardTokens";

export async function findPhysicalCardByToken(token: string, db?: Queryable) {
  if (db && db !== (await import("../db")).pool) {
    return (await db.query("select id,owner_id,digital_card_id,status,replacement_card_id,activated_at from cards where public_token_hash=$1", [hashCardToken(token)])).rows[0] ?? null;
  }
  const card = await prisma.card.findUnique({
    where: { publicTokenHash: hashCardToken(token) },
    select: {
      id: true,
      ownerId: true,
      digitalCardId: true,
      status: true,
      replacementCardId: true,
      activatedAt: true,
    },
  });
  if (!card) return null;
  return {
    id: card.id,
    owner_id: card.ownerId,
    digital_card_id: card.digitalCardId,
    status: card.status,
    replacement_card_id: card.replacementCardId,
    activated_at: card.activatedAt,
  };
}
