import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const types = new Set(["CREDIT", "DEBIT", "PARTIAL_REFUND", "RECOVERY"]);
    const reason = cleanText(body.reason, 1000);
    const amount = Number(body.amountMinor);
    if (typeof body.id !== "string" || !types.has(body.adjustmentType) || !Number.isSafeInteger(amount) || amount <= 0 || reason.length < 5) {
      return Response.json({ message: "Adjustment type, positive minor-unit amount, and a reason are required." }, { status: 400 });
    }

    const before = await prisma.affiliateCommission.findUnique({ where: { id: body.id } });
    if (!before) return Response.json({ message: "Commission not found." }, { status: 404 });

    const debit = ["DEBIT", "PARTIAL_REFUND", "RECOVERY"].includes(body.adjustmentType);
    const beforeMinor = Number(before.commissionMinor);
    const next = beforeMinor + (debit ? -amount : amount);
    if (next < 0) return Response.json({ message: "Adjustment cannot reduce commission below zero." }, { status: 400 });

    const created = await prisma.affiliateCommissionAdjustment.create({
      data: {
        commissionId: body.id,
        adjustmentType: body.adjustmentType,
        amountMinor: amount,
        reason,
        createdBy: actor.id,
      },
    });

    if (before.status !== "PAID") {
      const updateData: any = { commissionMinor: next };
      if (body.adjustmentType === "PARTIAL_REFUND") updateData.reversalReason = reason;

      await prisma.affiliateCommission.update({
        where: { id: body.id },
        data: updateData,
      });
    }

    const resultingMinor = before.status === "PAID" ? beforeMinor : next;
    await audit(actor, "AFFILIATE_COMMISSION_ADJUSTED", "affiliate_commission", body.id, before, {
      adjustment_id: created.id,
      adjustment_type: body.adjustmentType,
      amount_minor: amount,
      reason,
      resulting_commission_minor: resultingMinor,
    });

    return Response.json({
      data: {
        adjustmentId: created.id,
        resultingCommissionMinor: resultingMinor,
      },
    });
  } catch (error) { return safeError(error); }
}
