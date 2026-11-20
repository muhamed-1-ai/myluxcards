import { requireSuperAdmin, safeError, audit, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { getCanonicalUserQrUrl, getPublicCardUrl } from "@/lib/url";
import {
  normalizeShippingStatus,
  isValidHttpsTrackingUrl,
  mapShippingStatusToOrderStatus,
  VALID_SHIPPING_STATUSES,
  ShippingStatus,
} from "@/lib/shipping";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireSuperAdmin(request);
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const { id: orderId } = await params;

    // 1. Fetch Order with fulfillment and notes
    const orderRes = await pool.query(
      `SELECT id, order_number, user_id, customer_name, customer_email, customer_mobile,
              shipping_address, billing_address, currency, subtotal_minor, discount_minor,
              tax_minor, shipping_minor, total_minor, status, payment_status, courier,
              tracking_number, notes, internal_notes, fulfillment_data, created_at, updated_at
       FROM orders
       WHERE id = $1 OR order_number = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return Response.json({ message: "Order not found." }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // 2. Fetch Order Items with customization (finishes, name on card, materials)
    const itemsRes = await pool.query(
      `SELECT id, product_name, sku, quantity, unit_price_minor, total_minor, customization
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [order.id]
    );

    // 3. Fetch Payments for Server-Side Verification
    const paymentsRes = await pool.query(
      `SELECT id, provider, provider_payment_id, provider_order_id, amount_minor, currency, status, created_at
       FROM payments
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [order.id]
    );

    const hasSuccessfulPayment = paymentsRes.rows.some(
      (p) => p.status === "CAPTURED" || p.status === "SUCCESS" || p.status === "PAID"
    );
    const isPaymentVerifiedServerSide = order.payment_status === "PAID" || hasSuccessfulPayment;

    // 4. Fetch Customer User & Digital Card
    let digitalCard: any = null;
    let cardInfo: any = null;
    let userPhone: string | null = order.customer_mobile;

    if (order.user_id) {
      const userCardRes = await pool.query(
        `SELECT dc.id as digital_card_id, dc.slug, dc.active, dc.activated_at, p.phone
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         LEFT JOIN digital_cards dc ON dc.owner_id = u.id
         WHERE u.id = $1
         ORDER BY dc.created_at DESC
         LIMIT 1`,
        [order.user_id]
      );
      if (userCardRes.rows.length > 0) {
        const uRow = userCardRes.rows[0];
        if (uRow.phone) userPhone = uRow.phone;
        if (uRow.digital_card_id) {
          digitalCard = {
            id: uRow.digital_card_id,
            slug: uRow.slug,
            active: uRow.active,
            activatedAt: uRow.activated_at,
          };
        }
      }
    } else {
      const userByEmailRes = await pool.query(
        `SELECT u.id, p.phone, dc.id as digital_card_id, dc.slug, dc.active, dc.activated_at
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         LEFT JOIN digital_cards dc ON dc.owner_id = u.id
         WHERE lower(u.email) = lower($1)
         ORDER BY dc.created_at DESC
         LIMIT 1`,
        [order.customer_email]
      );
      if (userByEmailRes.rows.length > 0) {
        const uRow = userByEmailRes.rows[0];
        if (uRow.phone) userPhone = uRow.phone;
        if (uRow.digital_card_id) {
          digitalCard = {
            id: uRow.digital_card_id,
            slug: uRow.slug,
            active: uRow.active,
            activatedAt: uRow.activated_at,
          };
        }
      }
    }

    if (digitalCard) {
      const physicalCardRes = await pool.query(
        `SELECT id, status, created_at FROM cards WHERE digital_card_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [digitalCard.id]
      );
      cardInfo = {
        digitalCardId: digitalCard.id,
        slug: digitalCard.slug,
        active: digitalCard.active,
        activatedAt: digitalCard.activatedAt,
        publicProfileUrl: getPublicCardUrl(digitalCard.slug),
        physicalCard: physicalCardRes.rows[0] || null,
      };
    }

    // 5. Parse Shipping Address
    const rawAddr = order.shipping_address || {};
    const shippingAddress = {
      recipientName: rawAddr.recipientName || rawAddr.fullName || rawAddr.name || order.customer_name || "N/A",
      phone: rawAddr.phone || rawAddr.mobile || order.customer_mobile || userPhone || "N/A",
      alternatePhone: rawAddr.alternatePhone || rawAddr.altPhone || null,
      house: rawAddr.house || rawAddr.building || rawAddr.flat || rawAddr.line1 || "",
      street: rawAddr.street || rawAddr.area || rawAddr.line2 || "",
      locality: rawAddr.locality || rawAddr.landmark || "",
      city: rawAddr.city || rawAddr.town || "",
      district: rawAddr.district || "",
      state: rawAddr.state || "",
      pinCode: rawAddr.pinCode || rawAddr.pin_code || rawAddr.zip || rawAddr.postalCode || "",
      country: rawAddr.country || "India",
      deliveryInstructions: rawAddr.deliveryInstructions || rawAddr.notes || "",
    };

    const missingShippingFields: string[] = [];
    if (!shippingAddress.recipientName || shippingAddress.recipientName === "N/A") missingShippingFields.push("Recipient Name");
    if (!shippingAddress.phone || shippingAddress.phone === "N/A") missingShippingFields.push("Phone Number");
    if (!shippingAddress.house && !shippingAddress.street) missingShippingFields.push("House / Street Address");
    if (!shippingAddress.city) missingShippingFields.push("City");
    if (!shippingAddress.state) missingShippingFields.push("State");
    if (!shippingAddress.pinCode) missingShippingFields.push("PIN Code");

    // 6. QR Information
    const canonicalQrUrl = getCanonicalUserQrUrl({
      slug: digitalCard?.slug,
      id: order.user_id || order.id,
    });

    // 7. Parse Fulfillment Data & Dedicated Shipping Status
    const ful = order.fulfillment_data || {};
    const shippingStatus = normalizeShippingStatus(ful.shippingStatus || order.status);

    const checklist = {
      paymentVerified: isPaymentVerifiedServerSide,
      customerVerified: Boolean(ful.customerVerified ?? true),
      shippingAddressVerified: Boolean(ful.shippingAddressVerified ?? (missingShippingFields.length === 0)),
      productVerified: Boolean(ful.productVerified ?? true),
      qrGenerated: Boolean(ful.qrGenerated ?? true),
      qrVerified: Boolean(ful.qrVerified ?? false),
      nfcVerified: Boolean(ful.nfcVerified ?? false),
      cardVerified: Boolean(ful.cardVerified ?? false),
      cardProduced: Boolean(ful.cardProduced ?? false),
      cardQualityChecked: Boolean(ful.cardQualityChecked ?? false),
      stickersIncluded: Boolean(ful.stickersIncluded ?? true),
      packagingIncluded: Boolean(ful.packagingIncluded ?? true),
      labelGenerated: Boolean(ful.labelGenerated ?? false),
    };

    const missingRequirements: string[] = [];
    if (!isPaymentVerifiedServerSide) missingRequirements.push("Payment not verified");
    if (missingShippingFields.length > 0) missingRequirements.push(`Incomplete Shipping Address (${missingShippingFields.join(", ")})`);
    if (!checklist.qrVerified) missingRequirements.push("QR verification required");
    if (!checklist.cardVerified) missingRequirements.push("Card / NFC verification required");

    const totalChecklistCount = 5;
    let verifiedCount = 0;
    if (isPaymentVerifiedServerSide) verifiedCount++;
    if (missingShippingFields.length === 0) verifiedCount++;
    if (checklist.qrVerified) verifiedCount++;
    if (checklist.cardVerified) verifiedCount++;
    if (checklist.labelGenerated) verifiedCount++;

    const readinessPercentage = Math.round((verifiedCount / totalChecklistCount) * 100);
    const isReadyToShip = missingRequirements.length === 0;

    // Timeline & History
    const timeline = ful.timeline || [
      { status: "ORDER_PLACED", timestamp: order.created_at, note: "Order created in system" },
    ];
    if (isPaymentVerifiedServerSide && !timeline.some((t: any) => t.status === "PAYMENT_VERIFIED")) {
      timeline.push({ status: "PAYMENT_VERIFIED", timestamp: order.created_at, note: "Payment confirmed server-side" });
    }

    const shippingHistory = ful.shippingHistory || [];

    // Internal notes (hidden from customers)
    const internalNotes = order.internal_notes || ful.internalNotes || order.notes || "";

    return Response.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        userId: order.user_id,
        status: order.status,
        paymentStatus: order.payment_status,
        currency: order.currency || "INR",
        subtotalMinor: Number(order.subtotal_minor || 0),
        discountMinor: Number(order.discount_minor || 0),
        taxMinor: Number(order.tax_minor || 0),
        shippingMinor: Number(order.shipping_minor || 0),
        totalMinor: Number(order.total_minor || 0),
        courier: order.courier || ful.courier || null,
        trackingNumber: order.tracking_number || ful.trackingNumber || null,
        internalNotes,
        notes: order.notes || null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
      customer: {
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_mobile || userPhone,
      },
      shippingAddress,
      missingShippingFields,
      items: itemsRes.rows.map((it) => ({
        id: it.id,
        productName: it.product_name || "Smart NFC Business Card",
        sku: it.sku || null,
        quantity: Number(it.quantity || 1),
        unitPriceMinor: Number(it.unit_price_minor || 0),
        totalMinor: Number(it.total_minor || 0),
        customization: it.customization || {},
      })),
      payment: {
        isVerifiedServerSide: isPaymentVerifiedServerSide,
        status: order.payment_status,
        totalAmountMinor: Number(order.total_minor || 0),
        records: paymentsRes.rows.map((p) => ({
          id: p.id,
          provider: p.provider,
          providerPaymentId: p.provider_payment_id,
          providerOrderId: p.provider_order_id,
          amountMinor: Number(p.amount_minor || 0),
          status: p.status,
          createdAt: p.created_at,
        })),
      },
      qr: {
        url: canonicalQrUrl,
        slug: digitalCard?.slug || null,
        status: digitalCard?.slug ? "READY" : "PENDING_SLUG",
      },
      card: cardInfo,
      fulfillment: {
        checklist,
        shippingReadiness: {
          percentage: readinessPercentage,
          isReadyToShip,
          missingRequirements,
        },
        shippingStatus,
        courier: order.courier || ful.courier || "BlueDart",
        courierOther: ful.courierOther || "",
        trackingNumber: order.tracking_number || ful.trackingNumber || "",
        trackingUrl: ful.trackingUrl || "",
        weightKg: ful.weightKg || "0.25",
        dimensionsCm: ful.dimensionsCm || "15 x 10 x 2",
        shippingChargeMinor: ful.shippingChargeMinor || 0,
        dispatchedAt: ful.dispatchedAt || ful.shipmentDate || null,
        estimatedDeliveryAt: ful.estimatedDeliveryAt || ful.expectedDelivery || null,
        actualDeliveryAt: ful.actualDeliveryAt || null,
        internalNotes,
        timeline,
        shippingHistory,
        labels: ful.labels || [],
        updatedAt: order.updated_at,
      },
    });
  } catch (error) {
    console.error("[Ship Order API GET] Error:", error);
    return safeError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await requireSuperAdmin(request);
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  const client = await pool.connect();

  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));

    await client.query("BEGIN");

    // 1. Fetch current order with row lock to prevent race conditions
    const orderRes = await client.query(
      `SELECT id, order_number, status, payment_status, courier, tracking_number,
              internal_notes, fulfillment_data, updated_at
       FROM orders
       WHERE id = $1 OR order_number = $1
       FOR UPDATE`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return Response.json({ message: "Order not found." }, { status: 404 });
    }

    const order = orderRes.rows[0];
    const currentFul = order.fulfillment_data || {};
    const previousShippingStatus = normalizeShippingStatus(currentFul.shippingStatus || order.status);

    // 2. Concurrency Check (Optimistic Locking)
    if (body.expectedUpdatedAt) {
      const orderUpdatedTime = new Date(order.updated_at).getTime();
      const expectedTime = new Date(body.expectedUpdatedAt).getTime();
      if (!isNaN(orderUpdatedTime) && !isNaN(expectedTime) && Math.abs(orderUpdatedTime - expectedTime) > 1000) {
        await client.query("ROLLBACK");
        return Response.json(
          { message: "Shipping details were updated concurrently by another session. Please reload to view the latest status." },
          { status: 409 }
        );
      }
    }

    // 3. Validate Shipping Status
    let nextShippingStatus: ShippingStatus = previousShippingStatus;
    if (body.shippingStatus !== undefined) {
      if (!(VALID_SHIPPING_STATUSES as readonly string[]).includes(body.shippingStatus)) {
        await client.query("ROLLBACK");
        return Response.json(
          { message: `Invalid shipping status. Allowed statuses: ${VALID_SHIPPING_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      nextShippingStatus = body.shippingStatus as ShippingStatus;
    }

    // 4. Validate Courier and Tracking details
    let nextCourier = body.courier !== undefined ? String(body.courier).trim() : (order.courier || currentFul.courier || "");
    const courierOther = body.courierOther !== undefined ? String(body.courierOther).trim() : (currentFul.courierOther || "");
    if (nextCourier === "Other" && courierOther) {
      nextCourier = courierOther;
    }

    const nextTrackingNumber = body.trackingNumber !== undefined
      ? String(body.trackingNumber).trim()
      : (order.tracking_number || currentFul.trackingNumber || "");

    // When marking Shipped, Out for Delivery, or Delivered: Courier and Tracking Number are REQUIRED
    if (["Shipped", "Out for Delivery", "Delivered"].includes(nextShippingStatus)) {
      if (!nextCourier) {
        await client.query("ROLLBACK");
        return Response.json({ message: "Courier company is required when marking an order Shipped or Delivered." }, { status: 400 });
      }
      if (!nextTrackingNumber) {
        await client.query("ROLLBACK");
        return Response.json({ message: "Tracking / AWB number is required when marking an order Shipped or Delivered." }, { status: 400 });
      }
    }

    // 5. Validate Tracking Link (Optional, but must be HTTPS if provided)
    const nextTrackingUrl = body.trackingUrl !== undefined ? String(body.trackingUrl).trim() : (currentFul.trackingUrl || "");
    if (nextTrackingUrl && !isValidHttpsTrackingUrl(nextTrackingUrl)) {
      await client.query("ROLLBACK");
      return Response.json(
        { message: "Tracking link must be a valid HTTPS URL (e.g. https://track.provider.com/...). Insecure HTTP or invalid URLs are not allowed." },
        { status: 400 }
      );
    }

    // 6. Dates Management
    const nowIso = new Date().toISOString();
    let nextDispatchedAt = body.dispatchedAt !== undefined ? (body.dispatchedAt ? new Date(body.dispatchedAt).toISOString() : null) : (currentFul.dispatchedAt || null);
    let nextEstimatedDeliveryAt = body.estimatedDeliveryAt !== undefined ? (body.estimatedDeliveryAt ? new Date(body.estimatedDeliveryAt).toISOString() : null) : (currentFul.estimatedDeliveryAt || null);
    let nextActualDeliveryAt = body.actualDeliveryAt !== undefined ? (body.actualDeliveryAt ? new Date(body.actualDeliveryAt).toISOString() : null) : (currentFul.actualDeliveryAt || null);

    // Auto-record dispatch date when marked Shipped if not set
    if (nextShippingStatus === "Shipped" && !nextDispatchedAt) {
      nextDispatchedAt = nowIso;
    }

    // Auto-record actual delivery time when marked Delivered if not set
    if (nextShippingStatus === "Delivered" && !nextActualDeliveryAt) {
      nextActualDeliveryAt = nowIso;
    }

    // 7. Internal Shipping Notes (Strictly hidden from customers)
    const nextInternalNotes = body.internalNotes !== undefined
      ? String(body.internalNotes).trim()
      : (order.internal_notes || currentFul.internalNotes || "");

    // 8. Map to core Order Status without modifying payment status
    const mappedOrderStatus = mapShippingStatusToOrderStatus(nextShippingStatus, order.status);

    // 9. Checklist & Labels
    const updatedChecklist = {
      ...(currentFul.checklist || {}),
      ...(body.checklist || {}),
    };
    if (body.qrVerified !== undefined) updatedChecklist.qrVerified = Boolean(body.qrVerified);
    if (body.cardVerified !== undefined) updatedChecklist.cardVerified = Boolean(body.cardVerified);
    if (body.labelGenerated !== undefined) updatedChecklist.labelGenerated = Boolean(body.labelGenerated);

    // 10. Audit History & Timeline Logging
    const timeline = currentFul.timeline || [];
    const shippingHistory = currentFul.shippingHistory || [];

    const changeDetails: string[] = [];
    if (nextShippingStatus !== previousShippingStatus) {
      changeDetails.push(`Status changed from "${previousShippingStatus}" to "${nextShippingStatus}"`);
    }
    if (nextCourier !== (order.courier || currentFul.courier)) {
      changeDetails.push(`Courier set to "${nextCourier}"`);
    }
    if (nextTrackingNumber !== (order.tracking_number || currentFul.trackingNumber)) {
      changeDetails.push(`Tracking # set to "${nextTrackingNumber}"`);
    }
    if (nextTrackingUrl !== (currentFul.trackingUrl || "")) {
      changeDetails.push("Tracking URL updated");
    }
    if (nextDispatchedAt !== currentFul.dispatchedAt) {
      changeDetails.push(`Dispatch date: ${nextDispatchedAt ? nextDispatchedAt.slice(0, 10) : "cleared"}`);
    }
    if (nextEstimatedDeliveryAt !== currentFul.estimatedDeliveryAt) {
      changeDetails.push(`Estimated delivery: ${nextEstimatedDeliveryAt ? nextEstimatedDeliveryAt.slice(0, 10) : "cleared"}`);
    }
    if (nextActualDeliveryAt !== currentFul.actualDeliveryAt) {
      changeDetails.push(`Actual delivery: ${nextActualDeliveryAt}`);
    }
    if (nextInternalNotes !== (order.internal_notes || currentFul.internalNotes || "")) {
      changeDetails.push("Internal shipping notes updated");
    }

    const historyEntry = {
      previousStatus: previousShippingStatus,
      newStatus: nextShippingStatus,
      timestamp: nowIso,
      actor: identity.name || identity.email,
      details: changeDetails.length > 0 ? changeDetails.join("; ") : "Shipping record updated",
    };

    shippingHistory.push(historyEntry);

    // Add to operational timeline
    timeline.push({
      status: nextShippingStatus.toUpperCase().replace(/\s+/g, "_"),
      shippingStatus: nextShippingStatus,
      timestamp: nowIso,
      note: changeDetails.length > 0 ? changeDetails.join("; ") : `Updated shipping status to ${nextShippingStatus}`,
      actor: identity.name || identity.email,
    });

    // 11. Assemble Updated Fulfillment Data JSONB
    const updatedFulfillmentData = {
      ...currentFul,
      checklist: updatedChecklist,
      qrVerified: updatedChecklist.qrVerified,
      cardVerified: updatedChecklist.cardVerified,
      shippingStatus: nextShippingStatus,
      courier: nextCourier,
      courierOther: body.courier === "Other" ? courierOther : "",
      trackingNumber: nextTrackingNumber,
      trackingUrl: nextTrackingUrl,
      weightKg: body.weightKg !== undefined ? String(body.weightKg).trim() : (currentFul.weightKg || "0.25"),
      dimensionsCm: body.dimensionsCm !== undefined ? String(body.dimensionsCm).trim() : (currentFul.dimensionsCm || "15 x 10 x 2"),
      shippingChargeMinor: body.shippingChargeMinor !== undefined ? body.shippingChargeMinor : currentFul.shippingChargeMinor,
      dispatchedAt: nextDispatchedAt,
      shipmentDate: nextDispatchedAt,
      estimatedDeliveryAt: nextEstimatedDeliveryAt,
      expectedDelivery: nextEstimatedDeliveryAt,
      actualDeliveryAt: nextActualDeliveryAt,
      internalNotes: nextInternalNotes,
      labels: Array.isArray(body.labels) ? body.labels : (currentFul.labels || []),
      timeline,
      shippingHistory,
      updatedAt: nowIso,
    };

    // 12. Persist to Database within transaction
    // Check if dedicated shipping columns exist in the active schema, or update fulfillment_data + standard columns
    await client.query(
      `UPDATE orders
       SET status = $1,
           courier = $2,
           tracking_number = $3,
           internal_notes = $4,
           fulfillment_data = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [mappedOrderStatus, nextCourier, nextTrackingNumber, nextInternalNotes, JSON.stringify(updatedFulfillmentData), order.id]
    );

    // Also update dedicated shipping columns if they exist in schema
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_status') THEN
          UPDATE orders
          SET shipping_status = '${nextShippingStatus}',
              tracking_url = ${nextTrackingUrl ? `'${nextTrackingUrl.replace(/'/g, "''")}'` : "NULL"},
              dispatched_at = ${nextDispatchedAt ? `'${nextDispatchedAt}'::timestamptz` : "NULL"},
              estimated_delivery_at = ${nextEstimatedDeliveryAt ? `'${nextEstimatedDeliveryAt}'::timestamptz` : "NULL"},
              actual_delivery_at = ${nextActualDeliveryAt ? `'${nextActualDeliveryAt}'::timestamptz` : "NULL"}
          WHERE id = '${order.id}';
        END IF;
      END $$;
    `);

    await client.query("COMMIT");

    // 13. Super Admin Audit Logging
    await audit(
      identity,
      "UPDATE_ORDER_SHIPPING",
      "order",
      order.id,
      { shippingStatus: previousShippingStatus, courier: order.courier, trackingNumber: order.tracking_number },
      { shippingStatus: nextShippingStatus, courier: nextCourier, trackingNumber: nextTrackingNumber, changeDetails }
    );

    return Response.json({
      ok: true,
      message: "Shipping and courier details updated successfully.",
      shippingStatus: nextShippingStatus,
      orderStatus: mappedOrderStatus,
      fulfillment: updatedFulfillmentData,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Ship Order API POST] Error:", error);
    return safeError(error);
  } finally {
    client.release();
  }
}
