import { requireAdmin, safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";
export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const payments = await prisma.payment.findMany({
      select: {
        id: true,
        orderId: true,
        provider: true,
        providerPaymentId: true,
        amountMinor: true,
        currency: true,
        status: true,
        failureReason: true,
        refundedMinor: true,
        providerCreatedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const data = payments.map(p => ({
      id: p.id,
      order_id: p.orderId,
      provider: p.provider,
      provider_transaction_id: p.providerPaymentId,
      amount_minor: p.amountMinor,
      currency: p.currency,
      status: p.status,
      failure_reason: p.failureReason,
      refunded_minor: p.refundedMinor,
      provider_created_at: p.providerCreatedAt,
      created_at: p.createdAt,
    }));

    return Response.json({ data });
  } catch (error) { return safeError(error); }
}
