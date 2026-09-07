import { requireSuperAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET() {
  const identity = await requireSuperAdmin();
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    // 1. Operational order counts by status
    const statusCountsRes = await pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::int as count FROM orders GROUP BY status`
    );

    // 2. Operational payment status counts
    const paymentCountsRes = await pool.query<{ payment_status: string; count: string }>(
      `SELECT payment_status, COUNT(*)::int as count FROM orders GROUP BY payment_status`
    );

    // 3. Orders needing attention (e.g. UNPAID, missing address, unverified QR/card, PENDING, READY_TO_SHIP)
    const attentionRes = await pool.query(
      `SELECT id, order_number, customer_name, customer_email, customer_mobile, status, payment_status, total_minor, shipping_address, fulfillment_data, created_at
       FROM orders
       WHERE payment_status != 'PAID'
          OR status IN ('PENDING', 'PROCESSING', 'READY_TO_PACK', 'PACKED', 'READY_TO_SHIP')
          OR (fulfillment_data->>'qrVerified')::boolean IS NOT TRUE
          OR (fulfillment_data->>'cardVerified')::boolean IS NOT TRUE
       ORDER BY created_at DESC
       LIMIT 50`
    );

    const counts: Record<string, number> = {
      NEW: 0,
      PENDING: 0,
      PROCESSING: 0,
      IN_PRODUCTION: 0,
      READY_TO_PACK: 0,
      PACKED: 0,
      READY_TO_SHIP: 0,
      SHIPPED: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
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

      if (o.payment_status !== "PAID") missingFields.push("Payment Not Verified");
      if (!addr.pinCode && !addr.pin_code && !addr.zip) missingFields.push("PIN Code");
      if (!addr.phone && !addr.customerMobile && !o.customer_mobile) missingFields.push("Phone");
      if (!addr.house && !addr.street && !addr.address) missingFields.push("Street Address");
      if (!ful.qrVerified) missingFields.push("QR Verification");
      if (!ful.cardVerified) missingFields.push("Card Verification");

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
        isReadyToShip: missingFields.length === 0 && o.status === "READY_TO_SHIP",
      };
    });

    return Response.json({
      counts,
      paymentCounts,
      needingAttention,
    });
  } catch (error) {
    console.error("[Fulfillment Command Center API] Error:", error);
    return safeError(error);
  }
}
