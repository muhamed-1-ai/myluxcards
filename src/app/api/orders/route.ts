import { currentIdentity, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { sanitizeCustomerShippingData } from "@/lib/shipping";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) return Response.json({ message: "Please sign in." }, { status: 401 });

  try {
    const ordersRes = await pool.query<{
      id: string;
      order_number: string;
      customer_id: string | null;
      user_id: string | null;
      customer_name: string;
      customer_email: string;
      customer_phone: string | null;
      status: string;
      payment_status: string;
      currency: string;
      subtotal_minor: number;
      discount_minor: number;
      tax_minor: number;
      shipping_minor: number;
      total_minor: number;
      shipping_address: any;
      billing_address: any;
      courier: string | null;
      tracking_number: string | null;
      fulfillment_data: any;
      created_at: Date;
    }>(
      `select id, order_number, customer_id, user_id, customer_name, customer_email, customer_phone,
              status, payment_status, currency, subtotal_minor, discount_minor, tax_minor,
              shipping_minor, total_minor, shipping_address, billing_address, courier,
              tracking_number, fulfillment_data, created_at
       from orders
       where (customer_id = $1 or user_id = $1)
          or ((customer_id is null and user_id is null) and lower(customer_email) = lower($2))
       order by created_at desc
       limit 100`,
      [identity.id, identity.email]
    );

    if (ordersRes.rows.length === 0) {
      return Response.json({ data: [] });
    }

    const orderIds = ordersRes.rows.map((o) => o.id);

    const itemsRes = await pool.query<{
      id: string;
      order_id: string;
      product_name: string;
      sku: string | null;
      quantity: number;
      unit_price_minor: number;
      total_minor: number;
      customization: any;
    }>(
      `select id, order_id, product_name, sku, quantity, unit_price_minor, total_minor, customization
       from order_items
       where order_id = any($1::uuid[])
       order by id asc`,
      [orderIds]
    );

    const itemsByOrder: Record<string, any[]> = {};
    for (const item of itemsRes.rows) {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push({
        id: item.id,
        order_id: item.order_id,
        product_name: item.product_name || "Smart NFC Business Card",
        sku: item.sku || null,
        quantity: Number(item.quantity || 1),
        unit_price_minor: Number(item.unit_price_minor || 0),
        total_minor: Number(item.total_minor || 0),
        customization: item.customization || {},
      });
    }

    const orders = ordersRes.rows.map((o) => {
      // Customer-safe shipping view (strictly sanitizes internal notes and staff details)
      const shippingInfo = sanitizeCustomerShippingData(o, o.fulfillment_data);

      return {
        id: o.id,
        order_number: o.order_number,
        status: o.status || "PENDING",
        payment_status: o.payment_status || "PENDING",
        currency: o.currency || "INR",
        subtotal_minor: Number(o.subtotal_minor || 0),
        discount_minor: Number(o.discount_minor || 0),
        tax_minor: Number(o.tax_minor || 0),
        shipping_minor: Number(o.shipping_minor || 0),
        total_minor: Number(o.total_minor || 0),
        shipping_address: o.shipping_address || {},
        courier: shippingInfo.courier,
        tracking_number: shippingInfo.trackingNumber,
        shipping: shippingInfo,
        created_at: o.created_at ? (o.created_at instanceof Date ? o.created_at.toISOString() : new Date(o.created_at).toISOString()) : new Date().toISOString(),
        order_items: itemsByOrder[o.id] || [],
      };
    });

    return Response.json({ data: orders });
  } catch (error) {
    console.error("[Orders API] GET error:", error);
    return safeError(error);
  }
}
