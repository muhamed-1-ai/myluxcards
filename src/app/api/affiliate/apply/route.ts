import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { notifyAffiliateAdmin, sendAffiliateEmail } from "@/lib/affiliateNotifications";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Authentication required." }, { status: 401 });
  try {
    const profile = await prisma.affiliateProfile.findUnique({
      where: { userId: identity.id },
      select: {
        id: true,
        status: true,
        affiliateCode: true,
        rejectionReason: true,
        applications: {
          select: {
            id: true,
            status: true,
            decisionReason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return Response.json({
      data: profile
        ? {
            id: profile.id,
            status: profile.status,
            affiliate_code: profile.affiliateCode,
            rejection_reason: profile.rejectionReason,
            affiliate_applications: profile.applications.map(a => ({
              id: a.id,
              status: a.status,
              decision_reason: a.decisionReason,
              created_at: a.createdAt,
            })),
          }
        : null,
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Please sign in before applying." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const fullName = cleanText(body.fullName, 120);
    const phone = cleanText(body.phone, 30);
    const country = cleanText(body.country, 100);
    const region = cleanText(body.region, 100);
    const promotionMethod = cleanText(body.promotionMethod, 150);
    const reason = cleanText(body.reason, 2000);
    const partnerType = cleanText(body.partnerType, 40);
    const partnerTypes = new Set(["CUSTOMER_REFERRER", "CREATOR", "BUSINESS_PARTNER", "CAMPUS_AMBASSADOR"]);
    const audience = body.estimatedAudienceSize === "" || body.estimatedAudienceSize == null
      ? null : Number(body.estimatedAudienceSize);
    if (fullName.length < 2 || !country || !promotionMethod || !partnerTypes.has(partnerType) || reason.length < 20 || body.acceptTerms !== true) {
      return Response.json({ message: "Complete all required fields and accept the program terms." }, { status: 400 });
    }
    if (audience !== null && (!Number.isSafeInteger(audience) || audience < 0 || audience > 2_000_000_000)) {
      return Response.json({ message: "Estimated audience size is invalid." }, { status: 400 });
    }
    const urls = {
      website_url: safeOptionalUrl(body.websiteUrl),
      youtube_url: safeOptionalUrl(body.youtubeUrl),
      other_social_url: safeOptionalUrl(body.otherSocialUrl),
    };
    if (urls.website_url === false || urls.youtube_url === false || urls.other_social_url === false) {
      return Response.json({ message: "Website and social links must be valid HTTPS URLs." }, { status: 400 });
    }
    const programSettings = await prisma.affiliateSetting.findUnique({
      where: { id: true },
      select: { programEnabled: true, publicApplicationsEnabled: true, allowedPartnerTypes: true },
    });
    if (!programSettings?.programEnabled || !programSettings?.publicApplicationsEnabled) {
      return Response.json({ message: "Partner applications are currently closed." }, { status: 403 });
    }
    const allowedTypes = (programSettings.allowedPartnerTypes as string[]) || [];
    if (!allowedTypes.includes(partnerType)) {
      return Response.json({ message: "That partner type is not currently accepting applications." }, { status: 400 });
    }

    const existingAffiliate = await prisma.affiliateProfile.findUnique({
      where: { userId: identity.id },
      select: { id: true, status: true },
    });

    if (existingAffiliate && ["PENDING", "APPROVED", "SUSPENDED"].includes(existingAffiliate.status)) {
      return Response.json({ message: "You already have an active affiliate application." }, { status: 409 });
    }

    let affiliate = existingAffiliate;
    if (!affiliate) {
      affiliate = await prisma.affiliateProfile.create({
        data: { userId: identity.id, status: "PENDING", partnerType, displayName: fullName },
        select: { id: true, status: true },
      });
    } else {
      affiliate = await prisma.affiliateProfile.update({
        where: { id: affiliate.id },
        data: { status: "PENDING", partnerType, displayName: fullName, rejectionReason: null },
        select: { id: true, status: true },
      });
    }

    const application = await prisma.affiliateApplication.create({
      data: {
        affiliateId: affiliate.id,
        userId: identity.id,
        fullName,
        email: identity.email,
        phone: phone || null,
        country,
        region: region || null,
        websiteUrl: urls.website_url || null,
        instagramUsername: cleanText(body.instagramUsername, 100) || null,
        youtubeUrl: urls.youtube_url || null,
        businessName: cleanText(body.businessName, 160) || null,
        promotionMethod,
        partnerType,
        otherSocialUrl: urls.other_social_url || null,
        estimatedAudienceSize: audience,
        reason,
        termsAcceptedAt: new Date(),
        status: "PENDING",
      },
    });

    await Promise.allSettled([
      notifyAffiliateAdmin(`affiliate-application:${application.id}`, "New affiliate application", `${fullName} submitted an affiliate application.`, affiliate.id),
      sendAffiliateEmail({
        eventKey: `affiliate-application:${application.id}:ack`,
        eventType: "APPLICATION_RECEIVED",
        recipient: identity.email,
        subject: "We received your affiliate application",
        heading: "Application received",
        message: "Your MyLuxCards affiliate application is pending administrator review.",
        affiliateId: affiliate.id,
        actionPath: "/partners/dashboard",
      }),
    ]);
    return Response.json({ data: { id: application.id, status: "PENDING" } }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return Response.json({ message: "You already have an active affiliate application." }, { status: 409 });
    }
    return safeError(error);
  }
}

function safeOptionalUrl(value: unknown): string | null | false {
  const text = cleanText(value, 500);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : false;
  } catch {
    return false;
  }
}
