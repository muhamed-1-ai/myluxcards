import { NextResponse } from "next/server";
import { requireManagedUserOwnership, validMutationOrigin, audit, safeError } from "@/lib/adminAuth";
import { updateUserPermissions, updateUserStatus, updateUserNickname } from "@/lib/repositories/users";
import { pool } from "@/lib/db";
import { getCanonicalUserQrUrl, getPublicCardUrl } from "@/lib/url";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const authResult = await requireManagedUserOwnership(params.id);
    if (!authResult) {
      return NextResponse.json({ message: "Forbidden or user not found" }, { status: 403 });
    }

    const { managedUser } = authResult;

    // 1. Profile details
    const profileRes = await pool.query(
      `SELECT phone, internal_notes FROM profiles WHERE id = $1`,
      [managedUser.id]
    );
    const profile = profileRes.rows[0] || {};

    // 2. Digital card & physical cards
    const digitalCardRes = await pool.query(
      `SELECT id, slug, active, activated_at, created_at
       FROM digital_cards
       WHERE owner_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [managedUser.id]
    );
    const digitalCard = digitalCardRes.rows[0] || null;

    let physicalCards: any[] = [];
    let profileProducts: any[] = [];
    if (digitalCard) {
      const [cardsRes, productsRes] = await Promise.all([
        pool.query(
          `SELECT id, status, created_at FROM cards WHERE digital_card_id = $1 ORDER BY created_at DESC`,
          [digitalCard.id]
        ),
        pool.query(
          `SELECT id, name, description, price, currency, image_url, category, cta_label, cta_url, enabled, sort_order, created_at
           FROM card_profile_products
           WHERE card_id = $1
           ORDER BY sort_order ASC, created_at ASC`,
          [digitalCard.id]
        ),
      ]);
      physicalCards = cardsRes.rows;
      profileProducts = productsRes.rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        imageUrl: p.image_url,
        category: p.category,
        ctaLabel: p.cta_label,
        ctaUrl: p.cta_url,
        enabled: p.enabled,
        sortOrder: p.sort_order,
        createdAt: p.created_at,
      }));
    }

    // 3. User Orders
    const ordersRes = await pool.query(
      `SELECT id, order_number, status, payment_status, currency, total_minor, courier, tracking_number, shipping_address, created_at
       FROM orders
       WHERE user_id = $1 OR lower(customer_email) = lower($2)
       ORDER BY created_at DESC`,
      [managedUser.id, managedUser.email]
    );

    // Parse shipping address from latest order if present
    const latestOrder = ordersRes.rows[0];
    const rawAddr = latestOrder?.shipping_address || {};
    const shippingAddress = {
      recipientName: rawAddr.recipientName || rawAddr.fullName || rawAddr.name || managedUser.name || null,
      phone: rawAddr.phone || rawAddr.mobile || profile.phone || null,
      alternatePhone: rawAddr.alternatePhone || rawAddr.altPhone || null,
      house: rawAddr.house || rawAddr.building || rawAddr.flat || rawAddr.line1 || null,
      street: rawAddr.street || rawAddr.area || rawAddr.line2 || null,
      locality: rawAddr.locality || rawAddr.landmark || null,
      city: rawAddr.city || rawAddr.town || null,
      district: rawAddr.district || null,
      state: rawAddr.state || null,
      pinCode: rawAddr.pinCode || rawAddr.pin_code || rawAddr.zip || null,
      country: rawAddr.country || "India",
      deliveryInstructions: rawAddr.deliveryInstructions || rawAddr.notes || null,
    };

    const qrUrl = getCanonicalUserQrUrl({
      slug: digitalCard?.slug,
      id: managedUser.id,
    });

    return NextResponse.json({
      user: managedUser,
      profile: {
        phone: profile.phone || null,
        internalNotes: profile.internal_notes || null,
      },
      shippingAddress,
      qr: {
        url: qrUrl,
        slug: digitalCard?.slug || null,
        status: digitalCard?.slug ? "READY" : "PENDING_SLUG",
      },
      card: digitalCard
        ? {
            id: digitalCard.id,
            slug: digitalCard.slug,
            active: digitalCard.active,
            activatedAt: digitalCard.activated_at,
            publicProfileUrl: getPublicCardUrl(digitalCard.slug),
            physicalCards,
            profileProducts,
          }
        : null,
      orders: ordersRes.rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status || "PENDING",
        paymentStatus: o.payment_status || "UNPAID",
        currency: o.currency || "INR",
        totalMinor: Number(o.total_minor || 0),
        courier: o.courier || null,
        trackingNumber: o.tracking_number || null,
        createdAt: o.created_at,
        cardStatus: digitalCard?.active ? "ACTIVE" : "UNASSIGNED",
        shippingStatus: o.courier && o.tracking_number ? "DISPATCHED" : o.status,
      })),
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    if (!validMutationOrigin(request)) {
      return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
    }

    const params = await props.params;
    const authResult = await requireManagedUserOwnership(params.id);
    if (!authResult) {
      return NextResponse.json({ message: "Forbidden or user not found" }, { status: 403 });
    }

    const { identity, managedUser } = authResult;
    const body = await request.json();
    const { name, status, featurePermissions } = body;

    let updatedUser = managedUser;

    if (name && typeof name === "string") {
      updatedUser = await updateUserNickname(managedUser.id, name);
    }

    if (status && typeof status === "string" && ["ACTIVE", "PENDING_PAYMENT", "SUSPENDED", "DISABLED"].includes(status)) {
      const oldStatus = managedUser.status;
      updatedUser = await updateUserStatus(managedUser.id, status);
      const actionName = status === "SUSPENDED" ? "USER_SUSPENDED" : status === "ACTIVE" ? "USER_ACTIVATED" : "USER_STATUS_CHANGED";
      await audit(identity, actionName, "users", managedUser.id, { status: oldStatus }, { status });
    }

    if (featurePermissions && typeof featurePermissions === "object") {
      const oldPermissions = managedUser.feature_permissions;
      updatedUser = await updateUserPermissions(managedUser.id, featurePermissions);
      await audit(identity, "USER_PERMISSION_CHANGED", "users", managedUser.id, { permissions: oldPermissions }, { permissions: featurePermissions });
    }

    await audit(identity, "USER_UPDATED", "users", managedUser.id, managedUser, updatedUser);

    return NextResponse.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    if (!validMutationOrigin(request)) {
      return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
    }

    const params = await props.params;
    const authResult = await requireManagedUserOwnership(params.id);
    if (!authResult) {
      return NextResponse.json({ message: "Forbidden or user not found" }, { status: 403 });
    }

    const { identity, managedUser } = authResult;
    const updatedUser = await updateUserStatus(managedUser.id, "DISABLED");

    await audit(identity, "USER_DISABLED", "users", managedUser.id, { status: managedUser.status }, { status: "DISABLED" });

    return NextResponse.json({ message: "User account disabled successfully", user: updatedUser });
  } catch (error) {
    return safeError(error);
  }
}
