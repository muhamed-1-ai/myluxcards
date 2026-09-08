import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const cardId = String(body.cardId || "");
    const productIds = Array.isArray(body.productIds) ? body.productIds.map(String) : [];

    if (!/^[0-9a-f-]{36}$/i.test(cardId)) {
      return Response.json({ message: "Valid cardId required." }, { status: 400 });
    }

    // Verify card ownership
    const ownerCheck = await pool.query<{ id: string }>(
      `select id from digital_cards where id = $1 and owner_id = $2`,
      [cardId, identity.id]
    );
    if (ownerCheck.rows.length === 0) {
      return Response.json({ message: "Card not attached to signed-in account." }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let index = 0; index < productIds.length; index++) {
        const pId = productIds[index];
        if (/^[0-9a-f-]{36}$/i.test(pId)) {
          await client.query(
            `update card_profile_products
             set sort_order = $1, updated_at = now()
             where id = $2 and card_id = $3`,
            [index, pId, cardId]
          );
        }
      }
      await client.query("COMMIT");
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }

    return Response.json({ message: "Product order updated successfully." });
  } catch (error) {
    return safeError(error);
  }
}
