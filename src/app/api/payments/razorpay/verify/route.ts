import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { syncCommissionForTrustedOrder } from "@/lib/affiliate";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { prisma } from "@/lib/db/prisma";

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
    // customer_id=eq.${identity.id}
    const order = await prisma.order.findFirst({
      where: { id: internalOrderId, customerId: identity.id },
      select: { id: true, paymentStatus: true },
    });
    if (!order) return Response.json({ message: "Order not found." }, { status: 404 });
    
    const payment = await prisma.payment.findFirst({
      where: { orderId: internalOrderId, provider: "RAZORPAY" },
      select: { id: true, status: true, providerPaymentId: true, providerOrderId: true },
    });
    if (!payment) return Response.json({ message: "Payment record not found." }, { status: 404 });
    if (payment.status === "SUCCEEDED") return Response.json({ ok: true });
    if (payment.providerOrderId !== providerOrderId && payment.providerPaymentId !== providerOrderId) return Response.json({ message: "Payment order mismatch." }, { status: 400 });
    
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: paymentId,
          status: "SUCCEEDED",
          failureReason: null,
        },
      }),
      prisma.order.update({
        where: { id: internalOrderId },
        data: {
          // payment_status: "SUCCEEDED"
          paymentStatus: "SUCCEEDED",
          status: "CONFIRMED",
        },
      }),
    ]);

    await syncCommissionForTrustedOrder(internalOrderId).catch(() => null);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
