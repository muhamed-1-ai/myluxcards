import { getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const { identity, affiliate } = await getAffiliateForCurrentUser();
  if (!identity) return Response.json({ message: "Authentication required." }, { status: 401 });
  if (!affiliate) return Response.json({ profile: null });
  try {
    const id = affiliate.id;
    const [clicks, orders, commissions, campaigns, payouts, settings, products, materials, credits, rewards] = await Promise.all([
      prisma.affiliateClick.findMany({
        where: { affiliateId: id },
        select: { id: true, campaignId: true, isUnique: true, campaign: true, source: true, destinationPath: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.order.findMany({
        where: { affiliateId: id },
        select: {
          id: true, orderNumber: true, customerName: true, customerEmail: true, status: true, paymentStatus: true, currency: true, subtotalMinor: true, totalMinor: true, affiliateCampaignId: true, affiliateSource: true, affiliateCouponCode: true, createdAt: true,
          orderItems: { select: { productName: true, quantity: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.affiliateCommission.findMany({
        where: { affiliateId: id },
        select: { id: true, orderId: true, commissionableMinor: true, commissionType: true, commissionValue: true, commissionMinor: true, currency: true, status: true, referralSource: true, campaign: true, risk: true, createdAt: true, approvedAt: true, payoutAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.affiliateCampaign.findMany({
        where: { affiliateId: id },
        select: { id: true, name: true, source: true, destinationPath: true, active: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.affiliatePayout.findMany({
        where: { affiliateId: id },
        select: { id: true, amountMinor: true, currency: true, status: true, payoutMethod: true, transactionReference: true, rejectionReason: true, requestedAt: true, paidAt: true },
        orderBy: { requestedAt: "desc" },
        take: 100,
      }),
      prisma.affiliateSetting.findUnique({
        where: { id: true },
        select: { attributionWindowDays: true, minimumPayoutMinor: true, holdingPeriodDays: true, payoutSchedule: true, programTermsUrl: true },
      }),
      prisma.product.findMany({
        where: { active: true, archivedAt: null },
        select: { id: true, name: true, slug: true, productType: true, currency: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
      prisma.affiliateMaterial.findMany({
        where: { active: true },
        select: { id: true, title: true, materialType: true, description: true, storageUrl: true, promotionalText: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.affiliateStoreCredit.findMany({
        where: { affiliateId: id },
        select: { id: true, amountMinor: true, currency: true, status: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.affiliateReward.findMany({
        where: { affiliateId: id },
        select: {
          id: true, status: true, createdAt: true, fulfilledAt: true,
          rewardDefinition: { select: { name: true, description: true, requiredDeliveredOrders: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const formattedClicks = clicks.map(c => ({
      id: c.id,
      campaign_id: c.campaignId,
      is_unique: c.isUnique,
      campaign: c.campaign,
      source: c.source,
      destination_path: c.destinationPath,
      created_at: c.createdAt,
    }));

    const formattedOrders = orders.map(o => ({
      id: o.id,
      order_number: o.orderNumber,
      customer_name: maskName(o.customerName),
      customer_email: maskEmail(o.customerEmail),
      status: o.status,
      payment_status: o.paymentStatus,
      currency: o.currency,
      subtotal_minor: o.subtotalMinor,
      total_minor: o.totalMinor,
      affiliate_campaign_id: o.affiliateCampaignId,
      affiliate_source: o.affiliateSource,
      affiliate_coupon_code: o.affiliateCouponCode,
      created_at: o.createdAt,
      order_items: o.orderItems.map(i => ({ product_name: i.productName, quantity: i.quantity })),
    }));

    const formattedCommissions = commissions.map(c => ({
      id: c.id,
      order_id: c.orderId,
      commissionable_minor: Number(c.commissionableMinor),
      commission_type: c.commissionType,
      commission_value: c.commissionValue,
      commission_minor: Number(c.commissionMinor),
      currency: c.currency,
      status: c.status,
      referral_source: c.referralSource,
      campaign: c.campaign,
      risk: c.risk,
      created_at: c.createdAt,
      approved_at: c.approvedAt,
      payout_at: c.payoutAt,
    }));

    const formattedCampaigns = campaigns.map(c => {
      const campClicks = clicks.filter(click => click.campaignId === c.id);
      const campOrders = orders.filter(order => order.affiliateCampaignId === c.id);
      return {
        id: c.id,
        name: c.name,
        source: c.source,
        destination_path: c.destinationPath,
        active: c.active,
        created_at: c.createdAt,
        clicks: campClicks.length,
        uniqueVisitors: campClicks.filter(click => click.isUnique).length,
        conversions: campOrders.length,
        revenueMinor: campOrders.filter(order => order.paymentStatus === "SUCCEEDED").reduce((sum, order) => sum + Number(order.totalMinor || 0), 0),
      };
    });

    const formattedPayouts = payouts.map(p => ({
      id: p.id,
      amount_minor: Number(p.amountMinor),
      currency: p.currency,
      status: p.status,
      payout_method: p.payoutMethod,
      transaction_reference: p.transactionReference,
      rejection_reason: p.rejectionReason,
      requested_at: p.requestedAt,
      paid_at: p.paidAt,
    }));

    const formattedSettings = settings ? {
      attribution_window_days: settings.attributionWindowDays,
      minimum_payout_minor: Number(settings.minimumPayoutMinor),
      holding_period_days: settings.holdingPeriodDays,
      payout_schedule: settings.payoutSchedule,
      program_terms_url: settings.programTermsUrl,
    } : {};

    const formattedProducts = products.map(p => ({
      id: p.id, name: p.name, slug: p.slug, product_type: p.productType, currency: p.currency,
    }));

    const formattedMaterials = materials.map(m => ({
      id: m.id, title: m.title, material_type: m.materialType, description: m.description, storage_url: m.storageUrl, promotional_text: m.promotionalText, created_at: m.createdAt,
    }));

    const formattedCredits = credits.map(c => ({
      id: c.id, amount_minor: Number(c.amountMinor), currency: c.currency, status: c.status, expires_at: c.expiresAt, created_at: c.createdAt,
    }));

    const formattedRewards = rewards.map(r => ({
      id: r.id, status: r.status, created_at: r.createdAt, fulfilled_at: r.fulfilledAt,
      affiliate_reward_definitions: r.rewardDefinition ? {
        name: r.rewardDefinition.name, description: r.rewardDefinition.description, required_delivered_orders: r.rewardDefinition.requiredDeliveredOrders,
      } : null,
    }));

    const currency = formattedCommissions[0]?.currency || formattedOrders[0]?.currency || "INR";

    return Response.json({
      profile: {
        id: affiliate.id, status: affiliate.status, affiliateCode: affiliate.affiliate_code,
        couponCode: affiliate.coupon_code, tier: affiliate.affiliate_tiers?.name || null, partnerType: affiliate.partner_type,
        rejectionReason: affiliate.rejection_reason,
      },
      stats: summarize(formattedClicks, formattedOrders, formattedCommissions),
      clicks: formattedClicks, orders: formattedOrders, commissions: formattedCommissions,
      campaigns: formattedCampaigns, payouts: formattedPayouts, settings: formattedSettings,
      products: formattedProducts, materials: formattedMaterials, credits: formattedCredits, rewards: formattedRewards, currency,
      appUrl: process.env.APP_URL?.replace(/\/$/, "") || null,
      commerceReady: process.env.AFFILIATE_COMMERCE_LIVE === "true",
    });
  } catch (error) {
    return safeError(error);
  }
}

function summarize(clicks: any[], orders: any[], commissions: any[]) {
  const sum = (items: any[], key: string) => items.reduce((total, item) => total + Number(item[key] || 0), 0);
  const byStatus = (status: string) => commissions.filter(item => item.status === status);
  return {
    totalClicks: clicks.length,
    uniqueVisitors: clicks.filter(item => item.is_unique).length,
    referredCustomers: new Set(orders.map(item => item.customer_email)).size,
    totalOrders: orders.length,
    pendingOrders: orders.filter(item => item.status === "PENDING").length,
    confirmedOrders: orders.filter(item => ["CONFIRMED", "PROCESSING", "SHIPPED"].includes(item.status)).length,
    deliveredOrders: orders.filter(item => item.status === "DELIVERED").length,
    cancelledOrders: orders.filter(item => ["CANCELLED", "REFUNDED"].includes(item.status)).length,
    conversionRate: clicks.length ? (orders.length / clicks.length) * 100 : 0,
    referredRevenueMinor: sum(orders.filter(item => item.payment_status === "SUCCEEDED"), "total_minor"),
    pendingCommissionMinor: sum(byStatus("PENDING"), "commission_minor"),
    approvedCommissionMinor: sum(byStatus("APPROVED"), "commission_minor"),
    paidCommissionMinor: sum(byStatus("PAID"), "commission_minor"),
    reversedCommissionMinor: sum(byStatus("REVERSED"), "commission_minor"),
    availablePayoutMinor: sum(byStatus("APPROVED"), "commission_minor"),
  };
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Customer";
  return `${local.slice(0, 1)}${"•".repeat(Math.min(5, Math.max(1, local.length - 1)))}@${domain}`;
}
function maskName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.slice(0, 1)}.` : parts[0] || "Customer";
}
