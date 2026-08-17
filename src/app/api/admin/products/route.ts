import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
const types = new Set(["NFC_CARD","QR_LOST_FOUND","ACCESSORY","OTHER"]);
function productInput(body: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  if (typeof body.name === "string") result.name = body.name.trim().slice(0, 160);
  if (typeof body.description === "string") result.description = body.description.trim().slice(0, 10000);
  if (typeof body.productType === "string" && types.has(body.productType)) result.product_type = body.productType;
  if (typeof body.sku === "string") result.sku = body.sku.trim().slice(0, 100) || null;
  if (Number.isInteger(body.priceMinor) && Number(body.priceMinor) >= 0) result.price_minor = body.priceMinor;
  if (Number.isInteger(body.stock) && Number(body.stock) >= 0) result.stock = body.stock;
  if (typeof body.active === "boolean") result.active = body.active;
  if (typeof body.featured === "boolean") result.featured = body.featured;
  return result;
}
export async function GET() {
  const actor = await requireAdmin(); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try { const { data } = await supabaseJson("/rest/v1/products?select=id,name,slug,product_type,sku,price_minor,sale_price_minor,currency,stock,low_stock_threshold,active,featured,archived_at,created_at&order=created_at.desc&limit=100", {}, true); return Response.json({ data }); }
  catch (error) { return safeError(error); }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})); const input = productInput(body);
    if (!input.name || input.price_minor === undefined) return Response.json({ message: "Name and valid price are required." }, { status: 400 });
    input.slug = `${String(input.name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${crypto.randomUUID().slice(0,8)}`;
    const { data } = await supabaseJson("/rest/v1/products", { method: "POST", body: JSON.stringify(input) }, true);
    await audit(actor, "PRODUCT_CREATED", "product", data?.[0]?.id || null, null, input);
    return Response.json({ data: data?.[0] }, { status: 201 });
  } catch (error) { return safeError(error); }
}
export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(); if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})); if (typeof body.id !== "string") return Response.json({ message: "Invalid product." }, { status: 400 });
    const input = productInput(body); if (typeof body.archived === "boolean") { input.archived_at = body.archived ? new Date().toISOString() : null; input.active = !body.archived; }
    const before = await supabaseJson(`/rest/v1/products?id=eq.${body.id}&select=id,name,price_minor,stock,active,archived_at&limit=1`, {}, true);
    if (!before.data?.[0]) return Response.json({ message: "Product not found." }, { status: 404 });
    await supabaseJson(`/rest/v1/products?id=eq.${body.id}`, { method: "PATCH", body: JSON.stringify(input) }, true);
    await audit(actor, "PRODUCT_UPDATED", "product", body.id, before.data[0], input); return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
