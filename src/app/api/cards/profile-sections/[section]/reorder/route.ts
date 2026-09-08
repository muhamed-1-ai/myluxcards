import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

const SECTION_TABLES: Record<string, string> = {
  services: "card_profile_services",
  portfolio: "card_profile_portfolio",
  gallery: "card_profile_gallery",
  videos: "card_profile_videos",
  "payment-links": "card_profile_payment_links",
  documents: "card_profile_documents",
  achievements: "card_profile_achievements",
  certifications: "card_profile_certifications",
  products: "card_profile_products",
};

export async function PATCH(request: Request, props: { params: Promise<{ section: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const { section } = await props.params;
  const tableName = SECTION_TABLES[section];
  if (!tableName) return Response.json({ message: "Invalid section identifier for reorder." }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const cardId = String(body.cardId || "");
    if (!/^[0-9a-f-]{36}$/i.test(cardId)) return Response.json({ message: "Valid cardId required." }, { status: 400 });

    // Verify ownership
    const ownerCheck = await pool.query<{ id: string }>(
      `select id from digital_cards where id = $1 and owner_id = $2`,
      [cardId, identity.id]
    );
    if (ownerCheck.rows.length === 0) {
      return Response.json({ message: "Card not attached to signed-in account." }, { status: 403 });
    }

    let itemsToUpdate: Array<{ id: string; sortOrder: number }> = [];

    if (Array.isArray(body.itemIds)) {
      itemsToUpdate = body.itemIds
        .filter((id: unknown) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))
        .map((id: string, idx: number) => ({ id, sortOrder: idx }));
    } else if (Array.isArray(body.items)) {
      itemsToUpdate = body.items
        .filter((item: any) => item && typeof item.id === "string" && /^[0-9a-f-]{36}$/i.test(item.id))
        .map((item: any, idx: number) => ({
          id: item.id,
          sortOrder: typeof item.sortOrder === "number" ? Math.max(0, Math.floor(item.sortOrder)) : idx,
        }));
    }

    if (itemsToUpdate.length === 0) {
      return Response.json({ message: "No valid items provided for reordering." }, { status: 400 });
    }

    // Execute updates in transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of itemsToUpdate) {
        await client.query(
          `update ${tableName} set sort_order = $1, updated_at = now() where id = $2 and card_id = $3`,
          [item.sortOrder, item.id, cardId]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return Response.json({ ok: true, count: itemsToUpdate.length });
  } catch (error) {
    return safeError(error);
  }
}
