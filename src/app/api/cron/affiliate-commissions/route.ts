import { prisma } from "@/lib/db/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.AFFILIATE_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const pendingCommissions = await prisma.affiliateCommission.findMany({
    where: {
      status: "PENDING",
      eligibleAt: { lte: now },
    },
    include: {
      affiliate: {
        select: { partnerType: true },
      },
    },
    take: 500,
  });

  let approved = 0;
  const changedAffiliates = new Set<string>();
  for (const item of pendingCommissions) {
    const order = await prisma.order.findFirst({
      where: { id: item.orderId, status: "DELIVERED", paymentStatus: "SUCCEEDED" },
      select: { id: true },
    });
    if (!order) continue;
    
    await prisma.affiliateCommission.updateMany({
      where: { id: item.id, status: "PENDING" },
      data: { status: "APPROVED", approvedAt: now },
    });

    if (item.affiliate?.partnerType === "CUSTOMER_REFERRER") await createStoreCredit(item);
    changedAffiliates.add(item.affiliateId);
    approved += 1;
  }
  for (const affiliateId of changedAffiliates) await checkEligibility(affiliateId);
  return Response.json({ scanned: pendingCommissions.length, approved, affiliatesChecked: changedAffiliates.size });
}

async function createStoreCredit(item: any) {
  const settings = await prisma.affiliateSetting.findUnique({ where: { id: true } });
  const expires = settings?.storeCreditExpiryDays ? new Date(Date.now() + Number(settings.storeCreditExpiryDays) * 86_400_000) : null;
  await prisma.affiliateStoreCredit.create({
    data: {
      affiliateId: item.affiliateId,
      orderId: item.orderId,
      amountMinor: item.commissionMinor,
      currency: item.currency,
      status: "AVAILABLE",
      expiresAt: expires,
    },
  }).catch(() => null);
}

async function checkEligibility(affiliateId: string) {
  const delivered = await prisma.order.count({
    where: { affiliateId, status: "DELIVERED", paymentStatus: "SUCCEEDED" },
  });

  const definitions = await prisma.affiliateRewardDefinition.findMany({
    where: { active: true, requiredDeliveredOrders: { lte: delivered } },
    select: { id: true, name: true, description: true },
  });

  for (const definition of definitions) {
    try {
      await prisma.affiliateReward.create({
        data: { affiliateId, rewardDefinitionId: definition.id, status: "ELIGIBLE" },
      });
      await prisma.adminNotification.create({
        data: {
          eventKey: `affiliate-reward:${affiliateId}:${definition.id}`,
          type: "AFFILIATE_REWARD",
          title: "Partner reward eligibility",
          message: `A partner reached ${definition.name}.`,
        },
      });
    } catch { /* Ignore duplicates */ }
  }

  const suggested = await prisma.affiliateTier.findFirst({
    where: { active: true, minCompletedOrders: { lte: delivered } },
    select: { id: true, name: true, minCompletedOrders: true },
    orderBy: { minCompletedOrders: "desc" },
  });

  const profile = await prisma.affiliateProfile.findUnique({
    where: { id: affiliateId },
    select: { tierId: true },
  });

  if (suggested && profile?.tierId !== suggested.id) {
    await prisma.adminNotification.create({
      data: {
        eventKey: `affiliate-tier-suggestion:${affiliateId}:${suggested.id}`,
        type: "AFFILIATE_TIER",
        title: "Partner tier upgrade available",
        message: `A partner qualifies for ${suggested.name}.`,
      },
    }).catch(() => null);
  }
}
