import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { recordAudit } from "@/lib/repositories/auditLogs";

function isSafeUrl(url: string): boolean {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("mailto:")
  );
}

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Sign in required." }, { status: 401 });

  const url = new URL(request.url);
  const cardId = url.searchParams.get("cardId");

  try {
    let query = `
      select p.id, p.card_id, p.name, p.description, p.price, p.currency,
             p.image_url, p.category, p.cta_label, p.cta_url, p.enabled, p.sort_order,
             p.created_at, p.updated_at
      from card_profile_products p
      join digital_cards c on c.id = p.card_id
      where c.owner_id = $1
    `;
    const params: unknown[] = [identity.id];

    if (cardId && /^[0-9a-f-]{36}$/i.test(cardId)) {
      query += ` and p.card_id = $2`;
      params.push(cardId);
    }
    query += ` order by p.sort_order asc, p.created_at asc`;

    const result = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      description: string;
      price: string;
      currency: string;
      image_url: string;
      category: string;
      cta_label: string;
      cta_url: string;
      enabled: boolean;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    return Response.json({
      products: result.rows.map((row) => ({
        id: row.id,
        cardId: row.card_id,
        name: row.name,
        description: row.description,
        price: row.price,
        currency: row.currency,
        imageUrl: row.image_url,
        category: row.category,
        ctaLabel: row.cta_label,
        ctaUrl: row.cta_url,
        enabled: row.enabled,
        sortOrder: row.sort_order,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
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

    const name = String(body.name || "").trim().slice(0, 150);
    if (!name) return Response.json({ message: "Product name is required." }, { status: 400 });

    const description = String(body.description || "").trim().slice(0, 3000);
    const price = String(body.price || "").trim().slice(0, 100);
    const currency = String(body.currency || "INR").trim().toUpperCase().slice(0, 10);
    const imageUrl = String(body.imageUrl || "").trim().slice(0, 2000);
    const category = String(body.category || "").trim().slice(0, 100);
    const ctaLabel = String(body.ctaLabel || "").trim().slice(0, 50);
    const ctaUrl = String(body.ctaUrl || "").trim().slice(0, 2000);
    const enabled = body.enabled !== false;

    if (ctaUrl && !isSafeUrl(ctaUrl)) {
      return Response.json({ message: "Invalid Call to Action URL. Only http, https, tel, or mailto URLs are allowed." }, { status: 400 });
    }

    // Get max sort_order
    const orderRes = await pool.query<{ max_order: number | null }>(
      `select max(sort_order) as max_order from card_profile_products where card_id = $1`,
      [cardId]
    );
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : ((orderRes.rows[0]?.max_order ?? -1) + 1);

    const insertRes = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      description: string;
      price: string;
      currency: string;
      image_url: string;
      category: string;
      cta_label: string;
      cta_url: string;
      enabled: boolean;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `insert into card_profile_products
       (card_id, name, description, price, currency, image_url, category, cta_label, cta_url, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [cardId, name, description, price, currency, imageUrl, category, ctaLabel, ctaUrl, enabled, sortOrder]
    );

    const product = insertRes.rows[0];

    await recordAudit({
      actorId: identity.id,
      actorRole: identity.role,
      action: "PROFILE_PRODUCT_CREATED",
      entityType: "card_profile_product",
      entityId: product.id,
      after: { cardId, name, price, currency, enabled },
    }).catch((err) => console.error("Audit log failed:", err));

    return Response.json({
      product: {
        id: product.id,
        cardId: product.card_id,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        imageUrl: product.image_url,
        category: product.category,
        ctaLabel: product.cta_label,
        ctaUrl: product.cta_url,
        enabled: product.enabled,
        sortOrder: product.sort_order,
        createdAt: product.created_at.toISOString(),
        updatedAt: product.updated_at.toISOString(),
      },
    }, { status: 201 });
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
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid product id required." }, { status: 400 });

    // Fetch existing product and verify owner
    const checkRes = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      description: string;
      price: string;
      currency: string;
      image_url: string;
      category: string;
      cta_label: string;
      cta_url: string;
      enabled: boolean;
      sort_order: number;
    }>(
      `select p.* from card_profile_products p
       join digital_cards c on c.id = p.card_id
       where p.id = $1 and c.owner_id = $2`,
      [id, identity.id]
    );

    if (checkRes.rows.length === 0) {
      return Response.json({ message: "Product not found or access denied." }, { status: 404 });
    }

    const existing = checkRes.rows[0];

    const name = body.name !== undefined ? String(body.name).trim().slice(0, 150) : existing.name;
    if (!name) return Response.json({ message: "Product name cannot be empty." }, { status: 400 });

    const description = body.description !== undefined ? String(body.description).trim().slice(0, 3000) : existing.description;
    const price = body.price !== undefined ? String(body.price).trim().slice(0, 100) : existing.price;
    const currency = body.currency !== undefined ? String(body.currency).trim().toUpperCase().slice(0, 10) : existing.currency;
    const imageUrl = body.imageUrl !== undefined ? String(body.imageUrl).trim().slice(0, 2000) : existing.image_url;
    const category = body.category !== undefined ? String(body.category).trim().slice(0, 100) : existing.category;
    const ctaLabel = body.ctaLabel !== undefined ? String(body.ctaLabel).trim().slice(0, 50) : existing.cta_label;
    const ctaUrl = body.ctaUrl !== undefined ? String(body.ctaUrl).trim().slice(0, 2000) : existing.cta_url;
    const enabled = body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled;
    const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : existing.sort_order;

    if (ctaUrl && !isSafeUrl(ctaUrl)) {
      return Response.json({ message: "Invalid Call to Action URL. Only http, https, tel, or mailto URLs are allowed." }, { status: 400 });
    }

    const updateRes = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      description: string;
      price: string;
      currency: string;
      image_url: string;
      category: string;
      cta_label: string;
      cta_url: string;
      enabled: boolean;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `update card_profile_products
       set name = $1, description = $2, price = $3, currency = $4, image_url = $5,
           category = $6, cta_label = $7, cta_url = $8, enabled = $9, sort_order = $10,
           updated_at = now()
       where id = $11
       returning *`,
      [name, description, price, currency, imageUrl, category, ctaLabel, ctaUrl, enabled, sortOrder, id]
    );

    const updated = updateRes.rows[0];

    const auditAction = existing.enabled !== enabled
      ? (enabled ? "PROFILE_PRODUCT_ENABLED" : "PROFILE_PRODUCT_HIDDEN")
      : "PROFILE_PRODUCT_UPDATED";

    await recordAudit({
      actorId: identity.id,
      actorRole: identity.role,
      action: auditAction,
      entityType: "card_profile_product",
      entityId: id,
      before: { name: existing.name, enabled: existing.enabled, price: existing.price },
      after: { name: updated.name, enabled: updated.enabled, price: updated.price },
    }).catch((err) => console.error("Audit log failed:", err));

    return Response.json({
      product: {
        id: updated.id,
        cardId: updated.card_id,
        name: updated.name,
        description: updated.description,
        price: updated.price,
        currency: updated.currency,
        imageUrl: updated.image_url,
        category: updated.category,
        ctaLabel: updated.cta_label,
        ctaUrl: updated.cta_url,
        enabled: updated.enabled,
        sortOrder: updated.sort_order,
        createdAt: updated.created_at.toISOString(),
        updatedAt: updated.updated_at.toISOString(),
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
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Valid product id required." }, { status: 400 });

    const checkRes = await pool.query<{
      id: string;
      card_id: string;
      name: string;
      image_url: string;
    }>(
      `select p.id, p.card_id, p.name, p.image_url
       from card_profile_products p
       join digital_cards c on c.id = p.card_id
       where p.id = $1 and c.owner_id = $2`,
      [id, identity.id]
    );

    if (checkRes.rows.length === 0) {
      return Response.json({ message: "Product not found or access denied." }, { status: 404 });
    }

    const existing = checkRes.rows[0];

    await pool.query(`delete from card_profile_products where id = $1`, [id]);

    await recordAudit({
      actorId: identity.id,
      actorRole: identity.role,
      action: "PROFILE_PRODUCT_DELETED",
      entityType: "card_profile_product",
      entityId: id,
      before: { id, cardId: existing.card_id, name: existing.name },
    }).catch((err) => console.error("Audit log failed:", err));

    return Response.json({ message: "Product permanently deleted." });
  } catch (error) {
    return safeError(error);
  }
}
