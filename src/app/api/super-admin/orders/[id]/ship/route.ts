import { requireSuperAdmin, safeError, audit } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { getCanonicalUserQrUrl, getPublicCardUrl } from "@/lib/url";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireSuperAdmin();
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const { id: orderId } = await params;

    // 1. Fetch Order
    const orderRes = await pool.query(
      `SELECT id, order_number, user_id, customer_name, customer_email, customer_mobile,
              shipping_address, billing_address, currency, subtotal_minor, discount_minor,
              tax_minor, shipping_minor, total_minor, status, payment_status, courier,
              tracking_number, notes, fulfillment_data, created_at, updated_at
       FROM orders
       WHERE id = $1 OR order_number = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return Response.json({ message: "Order not found." }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // 2. Fetch Order Items
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

    // Server-side payment check: payment is verified if status == 'PAID' or payment record status == 'CAPTURED'/'SUCCESS'
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
      // Lookup user by email if user_id is missing
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

    // 5. Parse Shipping Address & Validate Required Fields
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

    // 7. Parse Fulfillment Data & Readiness
    const ful = order.fulfillment_data || {};
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

    const totalChecklistCount = 5; // Core mandatory items: Payment, Address, QR, Card, Label
    let verifiedCount = 0;
    if (isPaymentVerifiedServerSide) verifiedCount++;
    if (missingShippingFields.length === 0) verifiedCount++;
    if (checklist.qrVerified) verifiedCount++;
    if (checklist.cardVerified) verifiedCount++;
    if (checklist.labelGenerated) verifiedCount++;

    const readinessPercentage = Math.round((verifiedCount / totalChecklistCount) * 100);
    const isReadyToShip = missingRequirements.length === 0;

    // Timeline entries
    const timeline = ful.timeline || [
      { status: "ORDER_PLACED", timestamp: order.created_at, note: "Order created in system" },
    ];
    if (isPaymentVerifiedServerSide && !timeline.some((t: any) => t.status === "PAYMENT_VERIFIED")) {
      timeline.push({ status: "PAYMENT_VERIFIED", timestamp: order.created_at, note: "Payment confirmed server-side" });
    }

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
        courier: order.courier || ful.courier || "Standard Courier",
        trackingNumber: order.tracking_number || ful.trackingNumber || "",
        trackingUrl: ful.trackingUrl || "",
        weightKg: ful.weightKg || "0.25",
        dimensionsCm: ful.dimensionsCm || "15 x 10 x 2",
        shippingChargeMinor: ful.shippingChargeMinor || 0,
        shipmentDate: ful.shipmentDate || null,
        expectedDelivery: ful.expectedDelivery || null,
        timeline,
        labels: ful.labels || [],
      },
    });
  } catch (error) {
    console.error("[Ship Order API GET] Error:", error);
    return safeError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requireSuperAdmin();
  if (!identity) {
    return Response.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
  }

  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));

    // 1. Fetch current order
    const orderRes = await pool.query(`SELECT id, status, fulfillment_data FROM orders WHERE id = $1 OR order_number = $1`, [orderId]);
    if (orderRes.rows.length === 0) {
      return Response.json({ message: "Order not found." }, { status: 404 });
    }

    const order = orderRes.rows[0];
    const currentFul = order.fulfillment_data || {};

    const nextStatus = body.status || order.status;
    const nextCourier = body.courier !== undefined ? body.courier : currentFul.courier;
    const nextTrackingNumber = body.trackingNumber !== undefined ? body.trackingNumber : currentFul.trackingNumber;

    // Merge fulfillment data
    const updatedChecklist = {
      ...(currentFul.checklist || {}),
      ...(body.checklist || {}),
    };

    if (body.qrVerified !== undefined) updatedChecklist.qrVerified = Boolean(body.qrVerified);
    if (body.cardVerified !== undefined) updatedChecklist.cardVerified = Boolean(body.cardVerified);
    if (body.labelGenerated !== undefined) updatedChecklist.labelGenerated = Boolean(body.labelGenerated);

    const timeline = currentFul.timeline || [];
    if (body.timelineEvent) {
      timeline.push({
        status: body.timelineEvent.status || nextStatus,
        timestamp: new Date().toISOString(),
        note: body.timelineEvent.note || `Updated status to ${nextStatus}`,
        actor: identity.name,
      });
    } else if (nextStatus !== order.status) {
      timeline.push({
        status: nextStatus,
        timestamp: new Date().toISOString(),
        note: `Status changed from ${order.status} to ${nextStatus}`,
        actor: identity.name,
      });
    }

    const updatedFulfillmentData = {
      ...currentFul,
      checklist: updatedChecklist,
      qrVerified: updatedChecklist.qrVerified,
      cardVerified: updatedChecklist.cardVerified,
      courier: nextCourier,
      trackingNumber: nextTrackingNumber,
      trackingUrl: body.trackingUrl !== undefined ? body.trackingUrl : currentFul.trackingUrl,
      weightKg: body.weightKg !== undefined ? body.weightKg : currentFul.weightKg,
      dimensionsCm: body.dimensionsCm !== undefined ? body.dimensionsCm : currentFul.dimensionsCm,
      shippingChargeMinor: body.shippingChargeMinor !== undefined ? body.shippingChargeMinor : currentFul.shippingChargeMinor,
      shipmentDate: body.shipmentDate !== undefined ? body.shipmentDate : currentFul.shipmentDate,
      expectedDelivery: body.expectedDelivery !== undefined ? body.expectedDelivery : currentFul.expectedDelivery,
      labels: Array.isArray(body.labels) ? body.labels : (currentFul.labels || []),
      shippingStatus: nextStatus,
      timeline,
      updatedAt: new Date().toISOString(),
    };

    // Update database
    await pool.query(
      `UPDATE orders
       SET status = $1,
           courier = $2,
           tracking_number = $3,
           fulfillment_data = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [nextStatus, nextCourier, nextTrackingNumber, JSON.stringify(updatedFulfillmentData), order.id]
    );

    // Audit log
    await audit(identity, "UPDATE_ORDER_FULFILLMENT", "order", order.id, { status: order.status }, { status: nextStatus, fulfillment: updatedFulfillmentData });

    return Response.json({
      ok: true,
      message: "Order fulfillment updated successfully.",
      status: nextStatus,
      fulfillment: updatedFulfillmentData,
    });
  } catch (error) {
    console.error("[Ship Order API POST] Error:", error);
    return safeError(error);
  }
}
