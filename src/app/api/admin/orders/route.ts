import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";
import { syncCommissionForTrustedOrder } from "@/lib/affiliate";

export const runtime = "nodejs";
const statuses = new Set(["PENDING","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"]);
const paymentStatuses = new Set(["PENDING","SUCCEEDED","FAILED","PARTIALLY_REFUNDED","REFUNDED"]);
const productTypes = new Set(["NFC_CARD","QR_LOST_FOUND","ACCESSORY","OTHER"]);

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize")) || 20));
    const search = url.searchParams.get("search")?.trim().slice(0, 100);
    const status = url.searchParams.get("status");
    const paymentStatus = url.searchParams.get("paymentStatus");
    const productType = url.searchParams.get("productType");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const sort = url.searchParams.get("sort") === "oldest" ? "created_at.asc" : url.searchParams.get("sort") === "total" ? "total_minor.desc" : "created_at.desc";
    let path = "/rest/v1/orders?select=id,order_number,customer_name,customer_email,customer_phone,status,payment_status,currency,subtotal_minor,discount_minor,tax_minor,shipping_minor,total_minor,shipping_address,billing_address,courier,tracking_number,internal_notes,created_at,order_items(id,product_name,product_type,sku,variant,quantity,unit_price_minor,total_minor),payments(provider,status,provider_transaction_id)";
    if (search) path += `&or=(order_number.ilike.*${encodeURIComponent(search)}*,customer_email.ilike.*${encodeURIComponent(search)}*,customer_name.ilike.*${encodeURIComponent(search)}*)`;
    if (status && statuses.has(status)) path += `&status=eq.${status}`;
    if (paymentStatus && paymentStatuses.has(paymentStatus)) path += `&payment_status=eq.${paymentStatus}`;
    if (productType && productTypes.has(productType)) path += `&order_items.product_type=eq.${productType}`;
    if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) path += `&created_at=gte.${fromDate}T00:00:00.000Z`;
    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) path += `&created_at=lte.${toDate}T23:59:59.999Z`;
    const from = (page - 1) * pageSize;
    const { data, response } = await supabaseJson(`${path}&order=${sort}`, {
      headers: { Prefer: "count=exact", Range: `${from}-${from + pageSize - 1}` },
    }, true);
    return Response.json({ data, total: Number(response.headers.get("content-range")?.split("/")[1] || 0), page, pageSize });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid order." }, { status: 400 });
    const changes: Record<string, string | null> = {};
    if (typeof body.status === "string" && statuses.has(body.status)) changes.status = body.status;
    if (typeof body.courier === "string") changes.courier = body.courier.trim().slice(0, 100) || null;
    if (typeof body.trackingNumber === "string") changes.tracking_number = body.trackingNumber.trim().slice(0, 150) || null;
    if (typeof body.internalNotes === "string") changes.internal_notes = body.internalNotes.trim().slice(0, 5000) || null;
    if (!Object.keys(changes).length) return Response.json({ message: "No valid changes." }, { status: 400 });
    const before = await supabaseJson(`/rest/v1/orders?id=eq.${encodeURIComponent(body.id)}&select=id,status,courier,tracking_number&limit=1`, {}, true);
    if (!before.data?.[0]) return Response.json({ message: "Order not found." }, { status: 404 });
    const { data } = await supabaseJson(`/rest/v1/orders?id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", body: JSON.stringify(changes) }, true);
    await syncCommissionForTrustedOrder(body.id);
    await audit(actor, "ORDER_UPDATED", "order", body.id, before.data[0], changes);
    return Response.json({ data: data?.[0] });
  } catch (error) { return safeError(error); }
}
