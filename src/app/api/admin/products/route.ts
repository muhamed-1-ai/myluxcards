import { audit, requireAdmin, requireAuthenticatedUser, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAuthenticatedUser();
  if (!actor) return Response.json({ message: "Sign in required." }, { status: 401 });

  try {
    const result = await pool.query(`
      select 
        id, 
        title, 
        title as name, 
        slug, 
        price_minor, 
        price_minor as "priceMinor", 
        currency, 
        badge, 
        active, 
        metadata, 
        created_at as "createdAt"
      from products
      order by created_at desc
      limit 100
    `);

    return Response.json({ data: result.rows || [] });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.name || body.title || "").trim().slice(0, 160);
    const priceMinor = Number.isInteger(body.priceMinor) 
      ? Number(body.priceMinor) 
      : (Number.isInteger(body.price_minor) ? Number(body.price_minor) : null);

    if (!title || priceMinor === null || priceMinor < 0) {
      return Response.json({ message: "Name and valid price are required." }, { status: 400 });
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 10000) : null;
    const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase().slice(0, 10) : "INR";
    const badge = typeof body.badge === "string" ? body.badge.trim().slice(0, 50) : null;
    const active = typeof body.active === "boolean" ? body.active : true;

    const res = await pool.query(
      `insert into products (slug, title, description, price_minor, currency, badge, active)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, title, title as name, slug, price_minor, price_minor as "priceMinor", currency, badge, active, created_at as "createdAt"`,
      [slug, title, description, priceMinor, currency, badge, active]
    );

    const newProduct = res.rows[0];
    await audit(actor, "PRODUCT_CREATED", "product", newProduct.id, null, newProduct);

    return Response.json({ data: newProduct }, { status: 201 });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return Response.json({ message: "Invalid product id." }, { status: 400 });
    }

    const beforeRes = await pool.query(`select * from products where id = $1`, [body.id]);
    if (beforeRes.rows.length === 0) {
      return Response.json({ message: "Product not found." }, { status: 404 });
    }
    const before = beforeRes.rows[0];

    const title = typeof body.name === "string" ? body.name.trim().slice(0, 160) : (typeof body.title === "string" ? body.title.trim().slice(0, 160) : before.title);
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 10000) : before.description;
    const priceMinor = Number.isInteger(body.priceMinor) ? Number(body.priceMinor) : (Number.isInteger(body.price_minor) ? Number(body.price_minor) : before.price_minor);
    const active = typeof body.active === "boolean" ? body.active : (typeof body.archived === "boolean" ? !body.archived : before.active);

    const updateRes = await pool.query(
      `update products 
       set title = $1, description = $2, price_minor = $3, active = $4, updated_at = now()
       where id = $5
       returning id, title, title as name, slug, price_minor, price_minor as "priceMinor", currency, badge, active, updated_at as "updatedAt"`,
      [title, description, priceMinor, active, body.id]
    );

    const updated = updateRes.rows[0];
    await audit(actor, "PRODUCT_UPDATED", "product", body.id, before, updated);

    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return safeError(error);
  }
}
