import { requireSuperAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { calculateNextAction } from "@/lib/nextActionEngine";

export async function GET(request: Request) {
  const identity = await requireSuperAdmin();
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const queueParam = url.searchParams.get("queue");

    // 1. Operational order counts by status
    const statusCountsRes = await pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::int as count FROM orders GROUP BY status`
    );

    // 2. Operational payment status counts
    const paymentCountsRes = await pool.query<{ payment_status: string; count: string }>(
      `SELECT payment_status, COUNT(*)::int as count FROM orders GROUP BY payment_status`
    );

    // 3. Today's stats query
    const todayRes = await pool.query(
      `SELECT 
        COUNT(*)::int as today_orders,
        COALESCE(SUM(total_minor), 0)::bigint as today_sales,
        COUNT(*) FILTER (WHERE status IN ('READY_TO_SHIP', 'SHIPPED') AND DATE(created_at) = CURRENT_DATE)::int as ready_or_shipped_today,
        COUNT(*) FILTER (WHERE status = 'SHIPPED' AND DATE(updated_at) = CURRENT_DATE)::int as shipped_today
       FROM orders
       WHERE DATE(created_at) = CURRENT_DATE`
    );

    // 4. Queue Specific Queries (oldest first for packing / shipping queues)
    let whereClause = `WHERE payment_status != 'PAID'
          OR status IN ('PENDING', 'NEW', 'PROCESSING', 'CUSTOMIZATION', 'QR_READY', 'CARD_PRODUCTION', 'PACKAGING', 'PACKED', 'READY_TO_SHIP')
          OR (fulfillment_data->>'qrVerified')::boolean IS NOT TRUE
          OR (fulfillment_data->>'cardVerified')::boolean IS NOT TRUE`;
    let orderByClause = `ORDER BY created_at DESC`;

    if (queueParam === "packing") {
      whereClause = `WHERE status IN ('PACKAGING', 'PENDING', 'NEW', 'PROCESSING', 'PAYMENT_VERIFIED') AND payment_status = 'PAID'`;
      orderByClause = `ORDER BY created_at ASC`;
    } else if (queueParam === "shipping") {
      whereClause = `WHERE status IN ('READY_TO_SHIP', 'PACKED') AND payment_status = 'PAID'`;
      orderByClause = `ORDER BY created_at ASC`;
    }

    const attentionRes = await pool.query(
      `SELECT id, order_number, customer_name, customer_email, customer_mobile, status, payment_status, total_minor, shipping_address, fulfillment_data, tracking_number, courier, created_at
       FROM orders
       ${whereClause}
       ${orderByClause}
       LIMIT 50`
    );

    const counts: Record<string, number> = {
      NEW: 0,
      PAYMENT_VERIFIED: 0,
      CUSTOMIZATION: 0,
      QR_READY: 0,
      CARD_PRODUCTION: 0,
      PACKAGING: 0,
      READY_TO_SHIP: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      PENDING: 0,
      PROCESSING: 0,
      PACKED: 0,
      CANCELLED: 0,
      RTO: 0,
    };

    for (const r of statusCountsRes.rows) {
      if (r.status) counts[r.status] = Number(r.count || 0);
    }

    const paymentCounts: Record<string, number> = {
      PAID: 0,
      UNPAID: 0,
      PENDING: 0,
      FAILED: 0,
      REFUNDED: 0,
    };
    for (const r of paymentCountsRes.rows) {
      if (r.payment_status) paymentCounts[r.payment_status] = Number(r.count || 0);
    }

    const needingAttention = attentionRes.rows.map((o) => {
      const ful = o.fulfillment_data || {};
      const addr = o.shipping_address || {};
      const missingFields: string[] = [];
      let severity: "CRITICAL" | "ATTENTION" | "WAITING" = "ATTENTION";

      if (o.payment_status !== "PAID") {
        missingFields.push("Payment Not Verified");
        severity = "CRITICAL";
      }
      if (!addr.pinCode && !addr.pin_code && !addr.zip) {
        missingFields.push("PIN Code");
        severity = "CRITICAL";
      }
      if (!addr.phone && !addr.customerMobile && !o.customer_mobile) {
        missingFields.push("Phone");
        severity = "CRITICAL";
      }
      if (!addr.house && !addr.street && !addr.address) {
        missingFields.push("Street Address");
        severity = "CRITICAL";
      }
      if (!ful.qrVerified) {
        missingFields.push("QR Verification");
        if (severity !== "CRITICAL") severity = "ATTENTION";
      }
      if (!ful.cardVerified) {
        missingFields.push("Card / NFC Verification");
        if (severity !== "CRITICAL") severity = "ATTENTION";
      }
      if (o.status === "READY_TO_SHIP" && !o.tracking_number) {
        missingFields.push("Tracking Number Missing");
        if (severity !== "CRITICAL") severity = "ATTENTION";
      }

      if (missingFields.length === 0) {
        severity = "WAITING";
      }

      const nextAction = calculateNextAction({
        status: o.status,
        paymentStatus: o.payment_status,
        fulfillment_data: ful,
        shipping_address: addr,
        customerName: o.customer_name,
        customerMobile: o.customer_mobile,
        trackingNumber: o.tracking_number,
        courier: o.courier,
      });

      return {
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.customer_name,
        customerEmail: o.customer_email,
        customerMobile: o.customer_mobile,
        status: o.status,
        paymentStatus: o.payment_status,
        totalMinor: Number(o.total_minor || 0),
        createdAt: o.created_at,
        missingFields,
        severity,
        isReadyToShip: missingFields.length === 0 && (o.status === "READY_TO_SHIP" || o.status === "PACKED"),
        nextAction,
      };
    });

    const todayData = todayRes.rows[0] || {};

    return Response.json({
      counts,
      paymentCounts,
      today: {
        todayOrders: Number(todayData.today_orders || 0),
        todaySalesMinor: Number(todayData.today_sales || 0),
        ordersToFulfill: (counts.NEW || 0) + (counts.PAYMENT_VERIFIED || 0) + (counts.CUSTOMIZATION || 0) + (counts.QR_READY || 0) + (counts.CARD_PRODUCTION || 0) + (counts.PACKAGING || 0) + (counts.PENDING || 0),
        readyToShip: (counts.READY_TO_SHIP || 0) + (counts.PACKED || 0),
        shippedToday: Number(todayData.shipped_today || 0),
      },
      needingAttention,
    });
  } catch (error) {
    console.error("[Fulfillment Command Center API] Error:", error);
    return safeError(error);
  }
}
