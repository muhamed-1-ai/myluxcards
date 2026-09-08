import { requireSuperAdmin, safeError, audit } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { buildPremiumQrSvg } from "@/lib/premiumQr";
import { getCanonicalUserQrUrl } from "@/lib/url";
import JSZip from "jszip";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const identity = await requireSuperAdmin();
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action, orderIds, status, label } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return Response.json({ message: "No orders selected." }, { status: 400 });
    }

    // 1. BULK QR ZIP GENERATION
    if (action === "qr_zip") {
      const ordersRes = await pool.query(
        `SELECT o.id, o.order_number, o.customer_name, o.user_id,
                dc.slug as digital_card_slug
         FROM orders o
         LEFT JOIN digital_cards dc ON dc.owner_id = o.user_id
         WHERE o.id = ANY($1::uuid[])`,
        [orderIds]
      );

      const zip = new JSZip();
      const qrFolder = zip.folder("ZAPPIT_QR_CODES");

      for (const order of ordersRes.rows) {
        const canonicalUrl = getCanonicalUserQrUrl({
          slug: order.digital_card_slug,
          id: order.user_id || order.id,
        });

        const svgContent = buildPremiumQrSvg(canonicalUrl, {
          showLabel: true,
          label: "SCAN ME",
        });

        const sanitizedCustomer = String(order.customer_name || "CUSTOMER")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_");
        const filenamePrefix = `ZAPPIT-${order.order_number}-${sanitizedCustomer}`;

        qrFolder?.file(`${filenamePrefix}.svg`, svgContent);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const base64 = zipBuffer.toString("base64");

      await audit(identity, "SUPER_ADMIN_BULK_QR_DOWNLOAD", "orders", orderIds.join(","), { count: orderIds.length });

      return Response.json({
        success: true,
        count: orderIds.length,
        fileName: `ZAPPIT_QRS_${new Date().toISOString().slice(0, 10)}.zip`,
        zipBase64: base64,
      });
    }

    // 2. BULK STATUS UPDATE
    if (action === "bulk_status") {
      if (!status || typeof status !== "string") {
        return Response.json({ message: "Status is required for bulk status update." }, { status: 400 });
      }

      const allowedStatuses = ["NEW", "PAYMENT_VERIFIED", "CUSTOMIZATION", "QR_READY", "CARD_PRODUCTION", "PACKAGING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "PACKED"];
      if (!allowedStatuses.includes(status)) {
        return Response.json({ message: `Invalid status: ${status}` }, { status: 400 });
      }

      await pool.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])`,
        [status, orderIds]
      );

      await audit(identity, "SUPER_ADMIN_BULK_STATUS_UPDATE", "orders", orderIds.join(","), { status, count: orderIds.length });

      return Response.json({
        success: true,
        message: `Successfully updated ${orderIds.length} orders to ${status}.`,
      });
    }

    // 3. BULK LABEL ADD/REMOVE
    if (action === "bulk_label") {
      if (!label || typeof label !== "string") {
        return Response.json({ message: "Label is required." }, { status: 400 });
      }

      const ordersRes = await pool.query(
        `SELECT id, fulfillment_data FROM orders WHERE id = ANY($1::uuid[])`,
        [orderIds]
      );

      for (const o of ordersRes.rows) {
        const ful = o.fulfillment_data || {};
        const existingLabels: string[] = Array.isArray(ful.labels) ? ful.labels : [];
        if (!existingLabels.includes(label)) {
          existingLabels.push(label);
        }
        await pool.query(
          `UPDATE orders
           SET fulfillment_data = jsonb_set(COALESCE(fulfillment_data, '{}'::jsonb), '{labels}', $1::jsonb)
           WHERE id = $2`,
          [JSON.stringify(existingLabels), o.id]
        );
      }

      await audit(identity, "SUPER_ADMIN_BULK_LABEL_ADDED", "orders", orderIds.join(","), { label, count: orderIds.length });

      return Response.json({
        success: true,
        message: `Successfully added label '${label}' to ${orderIds.length} orders.`,
      });
    }

    // 4. BULK CSV EXPORT
    if (action === "export_csv") {
      const ordersRes = await pool.query(
        `SELECT o.id, o.order_number, o.customer_name, o.customer_email, o.customer_mobile,
                o.shipping_address, o.status, o.payment_status, o.total_minor, o.currency,
                o.courier, o.tracking_number, o.created_at,
                (SELECT string_agg(product_name || ' (x' || quantity || ')', '; ') FROM order_items WHERE order_id = o.id) as items_summary
         FROM orders o
         WHERE o.id = ANY($1::uuid[])
         ORDER BY o.created_at DESC`,
        [orderIds]
      );

      const headers = ["Order Number", "Date", "Customer Name", "Phone", "Email", "Recipient", "Address", "City", "State", "PIN Code", "Country", "Products", "Total Amount", "Payment Status", "Order Status", "Courier", "Tracking Number"];

      const rows = ordersRes.rows.map((o) => {
        const addr = o.shipping_address || {};
        const fullAddr = [addr.house || addr.line1, addr.street || addr.line2, addr.locality].filter(Boolean).join(", ");
        const total = (Number(o.total_minor || 0) / 100).toFixed(2);
        const phone = addr.phone || addr.mobile || o.customer_mobile || "";
        const pin = addr.pinCode || addr.pin_code || addr.zip || "";

        return [
          o.order_number,
          new Date(o.created_at).toISOString().slice(0, 10),
          o.customer_name,
          phone,
          o.customer_email,
          addr.recipientName || addr.fullName || o.customer_name,
          fullAddr,
          addr.city || "",
          addr.state || "",
          pin,
          addr.country || "India",
          o.items_summary || "Smart Card",
          `${o.currency || "INR"} ${total}`,
          o.payment_status,
          o.status,
          o.courier || "",
          o.tracking_number || "",
        ].map((val) => `"${String(val || "").replace(/"/g, '""')}"`).join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      await audit(identity, "SUPER_ADMIN_BULK_CSV_EXPORT", "orders", orderIds.join(","), { count: orderIds.length });

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ZAPPIT_Shipping_Export_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return Response.json({ message: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("[Super Admin Orders Batch API] Error:", error);
    return safeError(error);
  }
}
