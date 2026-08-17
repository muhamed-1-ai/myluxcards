import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText, generateAffiliateCode, validAffiliateCode } from "@/lib/affiliate";
import { sendAffiliateEmail } from "@/lib/affiliateNotifications";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
const statuses = new Set(["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "DISABLED"]);

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    
    const where: any = {};
    if (id) where.id = id;
    if (status && statuses.has(status)) where.status = status;

    const affiliates = await prisma.affiliateProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        tier: true,
        applications: true,
      },
    });

    const ids = affiliates.map(x => x.id);

    const [commissions, clicks, orders, payouts, fraud, tiers] = await Promise.all([
      ids.length ? prisma.affiliateCommission.findMany({ where: { affiliateId: { in: ids } } }) : [],
      ids.length ? prisma.affiliateClick.findMany({ where: { affiliateId: { in: ids } }, select: { id: true, affiliateId: true, isUnique: true, createdAt: true, campaign: true, source: true } }) : [],
      ids.length ? prisma.order.findMany({ where: { affiliateId: { in: ids } }, select: { id: true, affiliateId: true, orderNumber: true, status: true, paymentStatus: true, currency: true, totalMinor: true, createdAt: true } }) : [],
      ids.length ? prisma.affiliatePayout.findMany({ where: { affiliateId: { in: ids } }, select: { id: true, affiliateId: true, amountMinor: true, currency: true, status: true, payoutMethod: true, transactionReference: true, requestedAt: true, paidAt: true }, orderBy: { requestedAt: "desc" } }) : [],
      ids.length ? prisma.affiliateFraudFlag.findMany({ where: { affiliateId: { in: ids } }, orderBy: { createdAt: "desc" } }) : [],
      prisma.affiliateTier.findMany({ orderBy: { minCompletedOrders: "asc" } }),
    ]);

    const formatted = affiliates.map(a => ({
      id: a.id,
      user_id: a.userId,
      affiliate_code: a.affiliateCode,
      coupon_code: a.couponCode,
      partner_type: a.partnerType,
      status: a.status,
      commission_type: a.commissionType,
      commission_value: a.commissionValue,
      tier_id: a.tierId,
      rejection_reason: a.rejectionReason,
      suspended_at: a.suspendedAt,
      approved_at: a.approvedAt,
      approved_by: a.approvedBy,
      internal_notes: a.internalNotes,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
      profiles: a.user ? {
        id: a.user.id,
        email: a.user.email,
        name: a.user.name || null,
        created_at: a.user.createdAt,
      } : null,
      affiliate_tiers: a.tier ? { id: a.tier.id, name: a.tier.name } : null,
      affiliate_applications: a.applications.map(app => ({
        id: app.id,
        affiliate_id: app.affiliateId,
        user_id: app.userId,
        partner_type: app.partnerType,
        status: app.status,
        promotional_methods: app.promotionMethod,
        website_url: app.websiteUrl,
        social_channels: app.instagramUsername || app.youtubeUrl || app.otherSocialUrl || null,
        audience_size: app.estimatedAudienceSize,
        application_notes: app.reason,
        decision_reason: app.decisionReason,
        decided_at: app.decidedAt,
        created_at: app.createdAt,
      })),
      commissions: commissions.filter(x => x.affiliateId === a.id).map(c => ({
        id: c.id, affiliate_id: c.affiliateId, order_id: c.orderId, commissionable_minor: Number(c.commissionableMinor),
        commission_type: c.commissionType, commission_value: c.commissionValue, commission_minor: Number(c.commissionMinor),
        currency: c.currency, status: c.status, referral_source: c.referralSource, campaign: c.campaign, risk: c.risk,
        created_at: c.createdAt, approved_at: c.approvedAt, payout_at: c.payoutAt,
      })),
      clicks: clicks.filter(x => x.affiliateId === a.id).map(c => ({
        affiliate_id: c.affiliateId, is_unique: c.isUnique, created_at: c.createdAt, campaign: c.campaign, source: c.source,
      })),
      orders: orders.filter(x => x.affiliateId === a.id).map(o => ({
        id: o.id, affiliate_id: o.affiliateId, order_number: o.orderNumber, status: o.status, payment_status: o.paymentStatus,
        currency: o.currency, total_minor: o.totalMinor, created_at: o.createdAt,
      })),
      payouts: payouts.filter(x => x.affiliateId === a.id).map(p => ({
        id: p.id, affiliate_id: p.affiliateId, amount_minor: Number(p.amountMinor), currency: p.currency, status: p.status,
        payout_method: p.payoutMethod, transaction_reference: p.transactionReference, requested_at: p.requestedAt, paid_at: p.paidAt,
      })),
      fraudFlags: fraud.filter(x => x.affiliateId === a.id).map(f => ({
        id: f.id, affiliate_id: f.affiliateId, flag_type: f.reasonCode, severity: f.risk, details: f.details, resolved: Boolean(f.resolvedAt), created_at: f.createdAt,
      })),
    }));

    const formattedTiers = tiers.map(t => ({
      id: t.id, name: t.name, min_completed_orders: t.minCompletedOrders, min_revenue_minor: Number(t.minApprovedRevenueMinor),
      default_commission_type: t.commissionType, default_commission_value: t.commissionValue, created_at: t.createdAt,
    }));

    return Response.json({ data: formatted, tiers: formattedTiers });
  } catch (error) { return safeError(error); }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const email = cleanText(body.email, 320).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: "Enter a valid invitation email." }, { status: 400 });
    const eventKey = `affiliate-invitation:${createHash(email)}:${Date.now()}`;
    await sendAffiliateEmail({
      eventKey, eventType: "AFFILIATE_INVITATION", recipient: email,
      subject: "You are invited to the MyLuxCards Affiliate Program",
      heading: "Affiliate invitation",
      message: "Create or sign in to your MyLuxCards account and submit your affiliate application for administrator review.",
      actionPath: "/affiliate/apply",
    });
    await audit(actor, "AFFILIATE_INVITATION_SENT", "affiliate_invitation", email, null, { email });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid affiliate." }, { status: 400 });

    const before = await prisma.affiliateProfile.findUnique({
      where: { id: body.id },
      include: {
        user: { select: { email: true, name: true } },
      },
    });
    if (!before) return Response.json({ message: "Affiliate not found." }, { status: 404 });

    const updateData: any = {};
    let action = "AFFILIATE_UPDATED";
    if (typeof body.status === "string" && statuses.has(body.status)) {
      if (body.status === "REJECTED" && cleanText(body.reason, 1000).length < 3) return Response.json({ message: "A rejection reason is required." }, { status: 400 });
      updateData.status = body.status;
      updateData.rejectionReason = body.status === "REJECTED" ? cleanText(body.reason, 1000) : null;
      updateData.suspendedAt = body.status === "SUSPENDED" ? new Date() : null;
      if (body.status === "APPROVED") {
        const nameHint = before.user?.name || undefined;
        updateData.affiliateCode = before.affiliateCode || await uniqueCode(nameHint);
        updateData.approvedAt = new Date();
        updateData.approvedBy = actor.id;
      }
      action = `AFFILIATE_${body.status}`;
    }

    if (body.replaceCode === true) {
      const nameHint = before.user?.name || undefined;
      updateData.affiliateCode = await uniqueCode(nameHint);
      action = "AFFILIATE_CODE_REPLACED";
    }

    if (body.affiliateCode !== undefined) {
      const code = validAffiliateCode(body.affiliateCode);
      if (!code) return Response.json({ message: "Affiliate code must contain 6–12 letters, numbers, underscores, or hyphens." }, { status: 400 });
      updateData.affiliateCode = code;
    }

    if (body.couponCode !== undefined) {
      const coupon = body.couponCode ? validAffiliateCode(body.couponCode) : null;
      if (body.couponCode && !coupon) return Response.json({ message: "Coupon code is invalid." }, { status: 400 });
      const effectivePartnerType = String(body.partnerType || before.partnerType);
      if (coupon && !["CREATOR","BUSINESS_PARTNER"].includes(effectivePartnerType)) return Response.json({ message: "Coupons are available only to Creator and Business Partner accounts." }, { status: 400 });
      updateData.couponCode = coupon;
    }

    if (body.tierId !== undefined) updateData.tierId = typeof body.tierId === "string" && body.tierId ? body.tierId : null;
    if (body.partnerType !== undefined) {
      if (!["CUSTOMER_REFERRER","CREATOR","BUSINESS_PARTNER","CAMPUS_AMBASSADOR"].includes(body.partnerType)) return Response.json({ message: "Invalid partner type." }, { status: 400 });
      updateData.partnerType = body.partnerType;
    }

    if (body.commissionType !== undefined) {
      if (!["PERCENT_BPS", "FIXED_ORDER_MINOR", "FIXED_PRODUCT_MINOR", "PRODUCT_PERCENT_BPS"].includes(body.commissionType)) return Response.json({ message: "Invalid commission type." }, { status: 400 });
      updateData.commissionType = body.commissionType;
    }

    if (body.commissionValue !== undefined) {
      if (body.commissionValue !== null && (!Number.isSafeInteger(body.commissionValue) || body.commissionValue < 0)) return Response.json({ message: "Invalid commission value." }, { status: 400 });
      updateData.commissionValue = body.commissionValue;
    }

    if (typeof body.internalNotes === "string") updateData.internalNotes = cleanText(body.internalNotes, 5000) || null;

    const updated = await prisma.affiliateProfile.update({
      where: { id: body.id },
      data: updateData,
    });

    if (updateData.status) {
      await prisma.affiliateApplication.updateMany({
        where: { affiliateId: body.id, status: { in: ["PENDING", "SUSPENDED"] } },
        data: {
          status: updateData.status,
          decisionReason: updateData.rejectionReason || cleanText(body.reason, 1000) || null,
          decidedAt: new Date(),
          decidedBy: actor.id,
        },
      });
    }

    await audit(actor, action, "affiliate", body.id, before, updateData);

    const email = before.user?.email;
    if (email && updateData.status) {
      await sendAffiliateEmail({
        eventKey: `${action.toLowerCase()}:${body.id}:${Date.now()}`,
        eventType: action,
        recipient: email,
        subject: `Affiliate application ${String(updateData.status).toLowerCase()}`,
        heading: `Affiliate status: ${updateData.status}`,
        message: updateData.status === "APPROVED" ? "Your affiliate account is approved. Your referral links are ready in the dashboard." : String(updateData.rejectionReason || `Your affiliate status changed to ${updateData.status}.`),
        affiliateId: body.id,
        actionPath: "/partners/dashboard",
      });
    }

    return Response.json({
      data: {
        id: updated.id,
        user_id: updated.userId,
        affiliate_code: updated.affiliateCode,
        coupon_code: updated.couponCode,
        partner_type: updated.partnerType,
        status: updated.status,
        commission_type: updated.commissionType,
        commission_value: updated.commissionValue,
        tier_id: updated.tierId,
        rejection_reason: updated.rejectionReason,
        suspended_at: updated.suspendedAt,
        approved_at: updated.approvedAt,
        approved_by: updated.approvedBy,
        internal_notes: updated.internalNotes,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") return Response.json({ message: "Affiliate or coupon code is already in use." }, { status: 409 });
    return safeError(error);
  }
}

async function uniqueCode(name?: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateAffiliateCode(name);
    const existing = await prisma.affiliateProfile.findUnique({ where: { affiliateCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique affiliate code.");
}

function createHash(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
