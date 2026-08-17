import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return Response.json({ ok: false }, { status: 400 });

    const affiliate = await prisma.affiliateProfile.findFirst({
      where: { affiliateCode: code, status: "APPROVED" },
      select: { id: true, partnerType: true },
    });
    if (!affiliate) return Response.json({ ok: false }, { status: 404 });

    const settings = await prisma.affiliateSetting.findUnique({
      where: { id: true },
      select: { attributionWindowDays: true, businessLeadProtectionDays: true, programEnabled: true },
    });

    if (settings?.programEnabled === false) return Response.json({ ok: false });

    const days = Math.min(
      365,
      Math.max(
        1,
        affiliate.partnerType === "BUSINESS_PARTNER"
          ? settings?.businessLeadProtectionDays || 90
          : settings?.attributionWindowDays || 30
      )
    );

    let campaignId: string | null = null;
    if (body.campaign) {
      const camp = await prisma.affiliateCampaign.findFirst({
        where: { affiliateId: affiliate.id, name: body.campaign, active: true },
        select: { id: true },
      });
      campaignId = camp?.id || null;
      if (!camp) return Response.json({ ok: false });
    }

    let isUnique = false;
    if (body.visitorHash) {
      try {
        const existingVisitor = await prisma.affiliateVisitor.findUnique({
          where: {
            affiliateId_visitorHash: {
              affiliateId: affiliate.id,
              visitorHash: body.visitorHash,
            },
          },
        });
        if (!existingVisitor) {
          await prisma.affiliateVisitor.create({
            data: {
              affiliateId: affiliate.id,
              visitorHash: body.visitorHash,
            },
          });
          isUnique = true;
        }
      } catch {
        // ignore duplicate visitor race condition
      }
    }

    await prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        campaignId,
        visitorHash: body.visitorHash || null,
        isUnique,
        destinationPath: body.destinationPath || "/",
        campaign: body.campaign || null,
        source: body.source || null,
        referrerHost: body.referrerHost || null,
      },
    });

    return Response.json({
      ok: true,
      affiliateId: affiliate.id,
      days,
      campaignId,
    });
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
