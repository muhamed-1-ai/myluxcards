import { syncCommissionForTrustedOrder } from "@/lib/affiliate";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyRazorpayWebhook(raw, request.headers.get("x-razorpay-signature") || "")) return Response.json({ message: "Invalid signature." }, { status: 401 });
  const event = JSON.parse(raw || "{}");
  const entity = event?.payload?.payment?.entity;
  const providerOrderId = String(entity?.order_id || "");
  const providerPaymentId = String(entity?.id || "");
  const payment = providerOrderId ? await supabaseJson(`/rest/v1/payments?provider=eq.RAZORPAY&or=(provider_transaction_id.eq.${encodeURIComponent(providerOrderId)},provider_transaction_id.eq.${encodeURIComponent(providerPaymentId)})&select=id,order_id,status&limit=1`, {}, true) : { data: [] };
  const internalOrderId = String(payment.data?.[0]?.order_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(internalOrderId)) return Response.json({ ok: true });
  if (event.event === "payment.captured") {
    await supabaseJson(`/rest/v1/payments?order_id=eq.${internalOrderId}&provider=eq.RAZORPAY`, { method: "PATCH", body: JSON.stringify({ provider_transaction_id: String(entity.id), status: "SUCCEEDED", failure_reason: null }) }, true);
    await supabaseJson(`/rest/v1/orders?id=eq.${internalOrderId}`, { method: "PATCH", body: JSON.stringify({ payment_status: "SUCCEEDED", status: "CONFIRMED", updated_at: new Date().toISOString() }) }, true);
    await syncCommissionForTrustedOrder(internalOrderId).catch(() => null);
  } else if (event.event === "payment.failed" && payment.data?.[0]?.status !== "SUCCEEDED") {
    await supabaseJson(`/rest/v1/payments?order_id=eq.${internalOrderId}&provider=eq.RAZORPAY`, { method: "PATCH", body: JSON.stringify({ status: "FAILED", failure_reason: String(entity?.error_description || "Payment failed").slice(0, 500) }) }, true);
    await supabaseJson(`/rest/v1/orders?id=eq.${internalOrderId}`, { method: "PATCH", body: JSON.stringify({ payment_status: "FAILED", updated_at: new Date().toISOString() }) }, true);
  }
  return Response.json({ ok: true });
}
