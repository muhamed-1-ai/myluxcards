import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { syncCommissionForTrustedOrder } from "@/lib/affiliate";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Please sign in." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const internalOrderId = String(body.orderId || "");
    const providerOrderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    if (!/^[0-9a-f-]{36}$/i.test(internalOrderId) || !verifyRazorpaySignature(providerOrderId, paymentId, signature)) {
      return Response.json({ message: "Payment verification failed." }, { status: 400 });
    }
    const order = await supabaseJson(`/rest/v1/orders?id=eq.${encodeURIComponent(internalOrderId)}&customer_id=eq.${identity.id}&select=id,payment_status&limit=1`, {}, true);
    if (!order.data?.[0]) return Response.json({ message: "Order not found." }, { status: 404 });
    const payment = await supabaseJson(`/rest/v1/payments?order_id=eq.${internalOrderId}&provider=eq.RAZORPAY&select=id,status,provider_transaction_id&limit=1`, {}, true);
    if (!payment.data?.[0]) return Response.json({ message: "Payment record not found." }, { status: 404 });
    if (payment.data[0].status === "SUCCEEDED") return Response.json({ ok: true });
    if (payment.data[0].provider_transaction_id !== providerOrderId) return Response.json({ message: "Payment order mismatch." }, { status: 400 });
    await supabaseJson(`/rest/v1/payments?id=eq.${payment.data[0].id}`, { method: "PATCH", body: JSON.stringify({ provider_transaction_id: paymentId, status: "SUCCEEDED", failure_reason: null }) }, true);
    await supabaseJson(`/rest/v1/orders?id=eq.${internalOrderId}`, { method: "PATCH", body: JSON.stringify({ payment_status: "SUCCEEDED", status: "CONFIRMED", updated_at: new Date().toISOString() }) }, true);
    await syncCommissionForTrustedOrder(internalOrderId).catch(() => null);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
