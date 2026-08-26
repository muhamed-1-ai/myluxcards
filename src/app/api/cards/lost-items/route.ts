import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const cardId = url.searchParams.get("cardId");

  try {
    let query = `
      select i.id, i.card_id, i.name, i.category, i.description, i.color,
             i.contact_phone, i.use_default_contact, i.reward_enabled, i.reward_text,
             i.return_instructions, i.enabled, i.sort_order
      from card_lost_items i
      join digital_cards c on c.id = i.card_id
      where c.owner_id = $1
    `;
    const params: unknown[] = [identity.id];

    if (cardId && /^[0-9a-f-]{36}$/i.test(cardId)) {
      query += ` and i.card_id = $2`;
      params.push(cardId);
    }
    query += ` order by i.sort_order asc, i.created_at asc`;

    const result = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      category: string;
      description: string;
      color: string;
      contact_phone: string;
      use_default_contact: boolean;
      reward_enabled: boolean;
      reward_text: string;
      return_instructions: string;
      enabled: boolean;
      sort_order: number;
    }>(query, params);

    return Response.json({
      lostItems: result.rows.map((row) => ({
        id: row.id,
        cardId: row.card_id,
        name: row.name,
        category: row.category,
        description: row.description,
        color: row.color,
        contactPhone: row.contact_phone,
        useDefaultContact: row.use_default_contact,
        rewardEnabled: row.reward_enabled,
        rewardText: row.reward_text,
        returnInstructions: row.return_instructions,
        enabled: row.enabled,
        sortOrder: row.sort_order,
      })),
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const cardId = String(body.cardId || "");
    if (!/^[0-9a-f-]{36}$/i.test(cardId)) return Response.json({ message: "Valid cardId required." }, { status: 400 });

    // Verify card ownership
    const ownerCheck = await pool.query<{ id: string }>(
      `select id from digital_cards where id = $1 and owner_id = $2`,
      [cardId, identity.id]
    );
    if (ownerCheck.rows.length === 0) {
      return Response.json({ message: "Card not attached to signed-in account." }, { status: 403 });
    }

    const name = String(body.name || "Tagged Item").trim().slice(0, 120);
    const category = String(body.category || "Other").trim().slice(0, 50);
    const description = String(body.description || "").trim().slice(0, 500);
    const color = String(body.color || "").trim().slice(0, 50);
    const contactPhone = String(body.contactPhone || "").trim().slice(0, 30);
    const useDefaultContact = body.useDefaultContact !== false;
    const rewardEnabled = Boolean(body.rewardEnabled);
    const rewardText = String(body.rewardText || "").trim().slice(0, 1000);
    const returnInstructions = String(body.returnInstructions || "").trim().slice(0, 1000);
    const enabled = body.enabled !== false;

    const inserted = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      category: string;
      description: string;
      color: string;
      contact_phone: string;
      use_default_contact: boolean;
      reward_enabled: boolean;
      reward_text: string;
      return_instructions: string;
      enabled: boolean;
      sort_order: number;
    }>(
      `insert into card_lost_items (
        card_id, name, category, description, color,
        contact_phone, use_default_contact, reward_enabled, reward_text,
        return_instructions, enabled
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *`,
      [
        cardId, name, category, description, color,
        contactPhone, useDefaultContact, rewardEnabled, rewardText,
        returnInstructions, enabled,
      ]
    );

    const row = inserted.rows[0];
    return Response.json({
      lostItem: {
        id: row.id,
        cardId: row.card_id,
        name: row.name,
        category: row.category,
        description: row.description,
        color: row.color,
        contactPhone: row.contact_phone,
        useDefaultContact: row.use_default_contact,
        rewardEnabled: row.reward_enabled,
        rewardText: row.reward_text,
        returnInstructions: row.return_instructions,
        enabled: row.enabled,
        sortOrder: row.sort_order,
      },
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid item id required." }, { status: 400 });

    // IDOR protection: Verify item belongs to user's card
    const check = await pool.query<{ id: string }>(
      `select i.id from card_lost_items i join digital_cards c on c.id = i.card_id where i.id = $1 and c.owner_id = $2`,
      [id, identity.id]
    );
    if (check.rows.length === 0) {
      return Response.json({ message: "Item not found or unauthorized." }, { status: 404 });
    }

    const name = String(body.name || "Tagged Item").trim().slice(0, 120);
    const category = String(body.category || "Other").trim().slice(0, 50);
    const description = String(body.description || "").trim().slice(0, 500);
    const color = String(body.color || "").trim().slice(0, 50);
    const contactPhone = String(body.contactPhone || "").trim().slice(0, 30);
    const useDefaultContact = body.useDefaultContact !== false;
    const rewardEnabled = Boolean(body.rewardEnabled);
    const rewardText = String(body.rewardText || "").trim().slice(0, 1000);
    const returnInstructions = String(body.returnInstructions || "").trim().slice(0, 1000);
    const enabled = body.enabled !== false;

    const updated = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      category: string;
      description: string;
      color: string;
      contact_phone: string;
      use_default_contact: boolean;
      reward_enabled: boolean;
      reward_text: string;
      return_instructions: string;
      enabled: boolean;
      sort_order: number;
    }>(
      `update card_lost_items set
        name = $1, category = $2, description = $3, color = $4,
        contact_phone = $5, use_default_contact = $6, reward_enabled = $7,
        reward_text = $8, return_instructions = $9, enabled = $10, updated_at = now()
      where id = $11 returning *`,
      [
        name, category, description, color,
        contactPhone, useDefaultContact, rewardEnabled,
        rewardText, returnInstructions, enabled, id,
      ]
    );

    const row = updated.rows[0];
    return Response.json({
      lostItem: {
        id: row.id,
        cardId: row.card_id,
        name: row.name,
        category: row.category,
        description: row.description,
        color: row.color,
        contactPhone: row.contact_phone,
        useDefaultContact: row.use_default_contact,
        rewardEnabled: row.reward_enabled,
        rewardText: row.reward_text,
        returnInstructions: row.return_instructions,
        enabled: row.enabled,
        sortOrder: row.sort_order,
      },
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid item id required." }, { status: 400 });

    const deleted = await pool.query(
      `delete from card_lost_items i using digital_cards c where i.card_id = c.id and i.id = $1 and c.owner_id = $2 returning i.id`,
      [id, identity.id]
    );

    if (deleted.rows.length === 0) return Response.json({ message: "Item not found or unauthorized." }, { status: 404 });
    return Response.json({ ok: true, id });
  } catch (error) {
    return safeError(error);
  }
}
