import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
const types = new Set(["NFC_CARD","QR_LOST_FOUND","ACCESSORY","OTHER"]);

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        productType: true,
        sku: true,
        priceMinor: true,
        salePriceMinor: true,
        currency: true,
        stock: true,
        lowStockThreshold: true,
        active: true,
        featured: true,
        archivedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const data = products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      product_type: p.productType,
      sku: p.sku,
      price_minor: p.priceMinor,
      sale_price_minor: p.salePriceMinor,
      currency: p.currency,
      stock: p.stock,
      low_stock_threshold: p.lowStockThreshold,
      active: p.active,
      featured: p.featured,
      archived_at: p.archivedAt,
      created_at: p.createdAt,
    }));

    return Response.json({ data });
  } catch (error) { return safeError(error); }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
    const priceMinor = Number.isInteger(body.priceMinor) && Number(body.priceMinor) >= 0 ? Number(body.priceMinor) : undefined;
    if (!name || priceMinor === undefined) return Response.json({ message: "Name and valid price are required." }, { status: 400 });

    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${crypto.randomUUID().slice(0,8)}`;
    const productType = typeof body.productType === "string" && types.has(body.productType) ? body.productType : "NFC_CARD";
    const sku = typeof body.sku === "string" ? body.sku.trim().slice(0, 100) || null : null;
    const stock = Number.isInteger(body.stock) && Number(body.stock) >= 0 ? Number(body.stock) : 0;
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 10000) : "";
    const active = typeof body.active === "boolean" ? body.active : true;
    const featured = typeof body.featured === "boolean" ? body.featured : false;

    const created = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        productType,
        sku,
        priceMinor,
        stock,
        active,
        featured,
      },
    });

    const formatted = {
      id: created.id,
      name: created.name,
      slug: created.slug,
      product_type: created.productType,
      sku: created.sku,
      price_minor: created.priceMinor,
      stock: created.stock,
      active: created.active,
      featured: created.featured,
      created_at: created.createdAt,
    };

    await audit(actor, "PRODUCT_CREATED", "product", created.id, null, formatted);
    return Response.json({ data: formatted }, { status: 201 });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid product." }, { status: 400 });

    const before = await prisma.product.findUnique({
      where: { id: body.id },
      select: { id: true, name: true, priceMinor: true, stock: true, active: true, archivedAt: true },
    });
    if (!before) return Response.json({ message: "Product not found." }, { status: 404 });

    const updateData: any = {};
    if (typeof body.name === "string") updateData.name = body.name.trim().slice(0, 160);
    if (typeof body.description === "string") updateData.description = body.description.trim().slice(0, 10000);
    if (typeof body.productType === "string" && types.has(body.productType)) updateData.productType = body.productType;
    if (typeof body.sku === "string") updateData.sku = body.sku.trim().slice(0, 100) || null;
    if (Number.isInteger(body.priceMinor) && Number(body.priceMinor) >= 0) updateData.priceMinor = body.priceMinor;
    if (Number.isInteger(body.stock) && Number(body.stock) >= 0) updateData.stock = body.stock;
    if (typeof body.active === "boolean") updateData.active = body.active;
    if (typeof body.featured === "boolean") updateData.featured = body.featured;
    if (typeof body.archived === "boolean") {
      updateData.archivedAt = body.archived ? new Date() : null;
      updateData.active = !body.archived;
    }

    await prisma.product.update({
      where: { id: body.id },
      data: updateData,
    });

    await audit(actor, "PRODUCT_UPDATED", "product", body.id, before, updateData);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
