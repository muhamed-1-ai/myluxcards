import { cleanText, encryptSensitive, getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError, validMutationOrigin } from "@/lib/adminAuth";
import { notifyAffiliateAdmin } from "@/lib/affiliateNotifications";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { identity, affiliate } = await getAffiliateForCurrentUser();
  if (!identity || !affiliate || affiliate.status !== "APPROVED") return Response.json({ message: "Only approved affiliates can request payouts." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const program = await prisma.affiliateSetting.findUnique({
      where: { id: true },
      select: { customerReferralCashEnabled: true },
    });
    if (affiliate.partner_type === "CUSTOMER_REFERRER" && !program?.customerReferralCashEnabled) {
      return Response.json({ message: "Customer Referrer rewards are issued as store credit." }, { status: 400 });
    }
    const method = cleanText(body.method, 40).toUpperCase();
    const details = cleanText(body.details, 500);
    if (!["BANK_TRANSFER", "UPI", "PAYPAL", "OTHER"].includes(method) || details.length < 3) {
      return Response.json({ message: "Select a payout method and enter valid payout details." }, { status: 400 });
    }
    const ciphertext = encryptSensitive(details);
    
    await prisma.affiliateProfile.update({
      where: { id: affiliate.id },
      data: { payoutMethod: method, payoutDetailsCiphertext: ciphertext },
    });

    const result = await prisma.$queryRaw<Array<{ request_affiliate_payout: string }>>`
      SELECT request_affiliate_payout(${affiliate.id}::uuid, ${method}) AS request_affiliate_payout
    `;
    const payoutId = result[0]?.request_affiliate_payout;
    if (!payoutId) throw new Error("Payout request failed.");

    await prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { payoutDetailsSnapshotCiphertext: ciphertext },
    });

    await notifyAffiliateAdmin(`affiliate-payout:${payoutId}`, "Affiliate payout requested", `${identity.name} requested an affiliate payout.`, affiliate.id);
    return Response.json({ data: { id: payoutId, status: "REQUESTED" } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /below the configured minimum/i.test(error.message)
      ? error.message : "The payout request could not be completed.";
    if (message !== "The payout request could not be completed.") return Response.json({ message }, { status: 400 });
    return safeError(error);
  }
}
