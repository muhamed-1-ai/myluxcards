import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { sendAffiliateEmail } from "@/lib/affiliateNotifications";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
const statuses = new Set(["UNDER_REVIEW","APPROVED","PROCESSING","PAID","REJECTED","CANCELLED"]);

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || !statuses.has(body.status)) return Response.json({ message: "Invalid payout action." }, { status: 400 });
    if (body.status === "REJECTED" && cleanText(body.reason, 1000).length < 3) return Response.json({ message: "A rejection reason is required." }, { status: 400 });
    if (body.status === "PAID" && cleanText(body.transactionReference, 200).length < 3) return Response.json({ message: "A transaction reference is required." }, { status: 400 });

    const before = await prisma.affiliatePayout.findUnique({
      where: { id: body.id },
      include: {
        affiliate: {
          include: {
            user: { select: { email: true, name: true } },
          },
        },
        payoutItems: { select: { commissionId: true } },
      },
    });

    if (!before) return Response.json({ message: "Payout not found." }, { status: 404 });
    if (["PAID", "CANCELLED"].includes(before.status)) return Response.json({ message: "This payout is already final." }, { status: 409 });

    const updateData: any = {
      status: body.status,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      internalNote: cleanText(body.internalNote, 2000) || null,
    };

    if (body.status === "REJECTED") updateData.rejectionReason = cleanText(body.reason, 1000);
    if (body.status === "PAID") {
      updateData.paidAt = new Date();
      updateData.transactionReference = cleanText(body.transactionReference, 200);
    }

    await prisma.affiliatePayout.update({
      where: { id: body.id },
      data: updateData,
    });

    const commissionIds = before.payoutItems.map(i => i.commissionId);

    if (["REJECTED", "CANCELLED"].includes(body.status) && commissionIds.length) {
      await prisma.affiliateCommission.updateMany({
        where: { id: { in: commissionIds } },
        data: { status: "APPROVED" },
      });
    }

    if (body.status === "PAID" && commissionIds.length) {
      await prisma.affiliateCommission.updateMany({
        where: { id: { in: commissionIds } },
        data: { status: "PAID", payoutAt: new Date() },
      });
    }

    await audit(actor, `AFFILIATE_PAYOUT_${body.status}`, "affiliate_payout", body.id, before, updateData);

    const email = before.affiliate?.user?.email;
    if (email) {
      await sendAffiliateEmail({
        eventKey: `affiliate-payout-${body.status.toLowerCase()}:${body.id}`,
        eventType: `PAYOUT_${body.status}`,
        recipient: email,
        subject: `Partner payout ${body.status.toLowerCase()}`,
        heading: `Payout ${body.status}`,
        message: body.status === "REJECTED" ? updateData.rejectionReason : `Your payout request is now ${body.status.toLowerCase()}.`,
        affiliateId: before.affiliate.id,
        actionPath: "/partners/dashboard/payouts",
      });
    }

    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
