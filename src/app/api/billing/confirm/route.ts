import { NextResponse } from "next/server";
import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { supabaseJson } from "@/lib/supabaseAuth";
import { activatePlanEntitlementsForOrder } from "@/lib/billingEntitlements";
import { findUserById } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ message: "Please sign in." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const orderId = String(body.orderId || "").trim();
    const providerOrderId = String(body.razorpay_order_id || "").trim();
    const paymentId = String(body.razorpay_payment_id || "").trim();
    const signature = String(body.razorpay_signature || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json({ message: "Invalid order identifier." }, { status: 400 });
    }

    // 1. Fetch order and verify ownership
    const orderRes = await supabaseJson(
      `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&customer_id=eq.${encodeURIComponent(identity.id)}&select=id,status,payment_status&limit=1`,
      {},
      true
    );
    const order = orderRes.data?.[0];
    if (!order) {
      return NextResponse.json({ message: "Order not found." }, { status: 404 });
    }

    // 2. If signature provided, verify cryptographically
    if (providerOrderId && paymentId && signature) {
      if (!verifyRazorpaySignature(providerOrderId, paymentId, signature)) {
        return NextResponse.json({ message: "Payment verification failed: invalid signature." }, { status: 400 });
      }

      // Update payment record
      const paymentRes = await supabaseJson(
        `/rest/v1/payments?order_id=eq.${encodeURIComponent(orderId)}&provider=eq.RAZORPAY&select=id,status,provider_transaction_id&limit=1`,
        {},
        true
      );
      if (paymentRes.data?.[0]) {
        await supabaseJson(
          `/rest/v1/payments?id=eq.${paymentRes.data[0].id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              provider_transaction_id: paymentId,
              status: "SUCCEEDED",
              failure_reason: null,
            }),
          },
          true
        );
      }

      await supabaseJson(
        `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            payment_status: "SUCCEEDED",
            status: "CONFIRMED",
            updated_at: new Date().toISOString(),
          }),
        },
        true
      );
    } else if (order.payment_status !== "SUCCEEDED") {
      // Cannot activate without verified payment or prior SUCCEEDED status
      return NextResponse.json(
        { message: "Payment has not been confirmed by payment provider." },
        { status: 400 }
      );
    }

    // 3. Activate plan entitlements
    const activation = await activatePlanEntitlementsForOrder(orderId);
    const freshUser = await findUserById(identity.id);

    return NextResponse.json({
      ok: true,
      activated: activation.activated,
      planId: activation.planId || null,
      featurePermissions: freshUser?.feature_permissions || null,
    });
  } catch (error) {
    return safeError(error);
  }
}

