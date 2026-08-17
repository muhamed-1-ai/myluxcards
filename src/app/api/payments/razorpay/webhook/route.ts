import { syncCommissionForTrustedOrder } from "@/lib/affiliate";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyRazorpayWebhook(raw, request.headers.get("x-razorpay-signature") || "")) return Response.json({ message: "Invalid signature." }, { status: 401 });
  const event = JSON.parse(raw || "{}");
  const entity = event?.payload?.payment?.entity;
  const providerOrderId = String(entity?.order_id || "");
  const providerPaymentId = String(entity?.id || "");
  
  const payment = providerOrderId ? await prisma.payment.findFirst({
    where: {
      provider: "RAZORPAY",
      OR: [
        { providerOrderId: providerOrderId },
        { providerPaymentId: providerOrderId },
        { providerPaymentId: providerPaymentId },
      ],
    },
    select: { id: true, orderId: true, status: true },
  }) : null;

  const internalOrderId = String(payment?.orderId || "");
  if (!/^[0-9a-f-]{36}$/i.test(internalOrderId)) return Response.json({ ok: true });

  if (event.event === "payment.captured") {
    await prisma.$transaction([
      prisma.payment.updateMany({
        where: { orderId: internalOrderId, provider: "RAZORPAY" },
        data: { providerPaymentId: String(entity.id), status: "SUCCEEDED", failureReason: null },
      }),
      prisma.order.update({
        where: { id: internalOrderId },
        data: { paymentStatus: "SUCCEEDED", status: "CONFIRMED" },
      }),
    ]);
    await syncCommissionForTrustedOrder(internalOrderId).catch(() => null);
  } else if (event.event === "payment.failed" && payment?.status !== "SUCCEEDED") {
    await prisma.$transaction([
      prisma.payment.updateMany({
        where: { orderId: internalOrderId, provider: "RAZORPAY" },
        data: { status: "FAILED", failureReason: String(entity?.error_description || "Payment failed").slice(0, 500) },
      }),
      prisma.order.update({
        where: { id: internalOrderId },
        data: { paymentStatus: "FAILED" },
      }),
    ]);
  }
  return Response.json({ ok: true });
}
