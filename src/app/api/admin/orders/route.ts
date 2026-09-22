import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db/core";
import { syncCommissionForTrustedOrder } from "@/lib/affiliate";
import { sendOrderStatus } from "@/lib/customerEmails";

export const runtime = "nodejs";
const statuses = new Set(["PENDING","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"]);
const paymentStatuses = new Set(["PENDING","SUCCEEDED","FAILED","PARTIALLY_REFUNDED","REFUNDED"]);

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
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const sortParam = url.searchParams.get("sort");
    const sortOrder = sortParam === "oldest" ? "o.created_at ASC" : sortParam === "total" ? "o.total_minor DESC" : "o.created_at DESC";

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(COALESCE(o.order_number, o.number) ILIKE $${params.length} OR o.customer_email ILIKE $${params.length} OR o.customer_name ILIKE $${params.length})`);
    }

    if (status && statuses.has(status)) {
      params.push(status);
      whereClauses.push(`o.status = $${params.length}`);
    }

    if (paymentStatus && paymentStatuses.has(paymentStatus)) {
      params.push(paymentStatus);
      whereClauses.push(`o.payment_status = $${params.length}`);
    }

    if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      params.push(`${fromDate}T00:00:00.000Z`);
      whereClauses.push(`o.created_at >= $${params.length}`);
    }

    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      params.push(`${toDate}T23:59:59.999Z`);
      whereClauses.push(`o.created_at <= $${params.length}`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRes = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM orders o ${whereSql}`,
      params
    );
    const total = Number(countRes.rows[0]?.count || 0);

    const offset = (page - 1) * pageSize;
    const queryParams = [...params, pageSize, offset];

    const ordersRes = await pool.query(
      `SELECT 
        o.id, 
        COALESCE(o.order_number, o.number) as order_number, 
        o.customer_name, 
        o.customer_email, 
        COALESCE(o.customer_phone, o.customer_mobile) as customer_phone, 
        o.status, 
        o.payment_status, 
        o.currency, 
        o.subtotal_minor, 
        o.discount_minor, 
        o.tax_minor, 
        o.shipping_minor, 
        o.total_minor, 
        o.shipping_address, 
        o.billing_address, 
        o.courier, 
        o.tracking_number, 
        COALESCE(o.internal_notes, o.notes) as internal_notes, 
        o.created_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', oi.id,
                'product_name', COALESCE(oi.product_name, oi.title),
                'product_type', oi.product_type,
                'sku', oi.sku,
                'variant', oi.variant,
                'quantity', oi.quantity,
                'unit_price_minor', COALESCE(oi.unit_price_minor, oi.unit_price),
                'total_minor', COALESCE(oi.total_minor, oi.total_price)
              )
            )
            FROM order_items oi
            WHERE oi.order_id = o.id
          ),
          '[]'::json
        ) as order_items,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'provider', p.provider,
                'status', p.status,
                'provider_transaction_id', COALESCE(p.provider_payment_id, p.provider_order_id)
              )
            )
            FROM payments p
            WHERE p.order_id = o.id
          ),
          '[]'::json
        ) as payments
      FROM orders o
      ${whereSql}
      ORDER BY ${sortOrder}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    return Response.json({ data: ordersRes.rows, total, page, pageSize });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid order." }, { status: 400 });

    const beforeRes = await pool.query(
      `SELECT id, COALESCE(order_number, number) as order_number, customer_name, customer_email, status, courier, tracking_number FROM orders WHERE id = $1`,
      [body.id]
    );

    const before = beforeRes.rows[0];
    if (!before) return Response.json({ message: "Order not found." }, { status: 404 });

    const setClauses: string[] = ["updated_at = NOW()"];
    const params: any[] = [body.id];

    if (typeof body.status === "string" && statuses.has(body.status)) {
      params.push(body.status);
      setClauses.push(`status = $${params.length}`);
    }
    if (typeof body.courier === "string") {
      params.push(body.courier.trim().slice(0, 100) || null);
      setClauses.push(`courier = $${params.length}`);
    }
    if (typeof body.trackingNumber === "string") {
      params.push(body.trackingNumber.trim().slice(0, 150) || null);
      setClauses.push(`tracking_number = $${params.length}`);
    }
    if (typeof body.internalNotes === "string") {
      params.push(body.internalNotes.trim().slice(0, 5000) || null);
      setClauses.push(`internal_notes = $${params.length}`);
    }

    if (setClauses.length === 1) return Response.json({ message: "No valid changes." }, { status: 400 });

    const updateRes = await pool.query(
      `UPDATE orders SET ${setClauses.join(", ")} WHERE id = $1 RETURNING *`,
      params
    );
    const updated = updateRes.rows[0];

    const changes = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.courier !== undefined ? { courier: body.courier } : {}),
      ...(body.trackingNumber !== undefined ? { tracking_number: body.trackingNumber } : {}),
      ...(body.internalNotes !== undefined ? { internal_notes: body.internalNotes } : {}),
    };

    await syncCommissionForTrustedOrder(body.id);
    await audit(actor, "ORDER_UPDATED", "order", body.id, before, changes);

    if (changes.status && changes.status !== before.status) {
      await sendOrderStatus({
        id: body.id,
        number: before.order_number,
        name: before.customer_name,
        email: before.customer_email,
        status: changes.status,
        courier: changes.courier ?? before.courier,
        tracking: changes.tracking_number ?? before.tracking_number
      }).catch(() => false);
    }

    return Response.json({ data: updated });
  } catch (error) { return safeError(error); }
}
