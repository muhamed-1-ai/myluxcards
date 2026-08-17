import { requireAdmin, safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const type = new URL(request.url).searchParams.get("type") || "affiliates";

    let headers: string[] = [];
    let rowsData: unknown[][] = [];

    if (type === "affiliates") {
      headers = ["affiliate_id", "name", "email", "partner_type", "status", "affiliate_code", "coupon_code", "tier", "created_at", "approved_at"];
      const data = await prisma.affiliateProfile.findMany({
        take: 10000,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true, name: true } }, tier: { select: { name: true } } },
      });
      rowsData = data.map(x => [
        x.id,
        x.user?.name || null,
        x.user?.email || null,
        x.partnerType,
        x.status,
        x.affiliateCode,
        x.couponCode,
        x.tier?.name || null,
        x.createdAt,
        x.approvedAt,
      ]);
    } else if (type === "clicks") {
      headers = ["affiliate_id", "unique", "landing_page", "campaign", "source", "referrer_host", "created_at"];
      const data = await prisma.affiliateClick.findMany({
        take: 10000,
        orderBy: { createdAt: "desc" },
        select: { affiliateId: true, isUnique: true, destinationPath: true, campaign: true, source: true, referrerHost: true, createdAt: true },
      });
      rowsData = data.map(x => [x.affiliateId, x.isUnique, x.destinationPath, x.campaign, x.source, x.referrerHost, x.createdAt]);
    } else if (type === "orders") {
      headers = ["order_reference", "affiliate_id", "order_status", "payment_status", "currency", "subtotal_minor", "discount_minor", "total_minor", "source", "attribution_method", "created_at"];
      const data = await prisma.order.findMany({
        where: { affiliateId: { not: null } },
        take: 10000,
        orderBy: { createdAt: "desc" },
        select: { orderNumber: true, affiliateId: true, status: true, paymentStatus: true, currency: true, subtotalMinor: true, discountMinor: true, totalMinor: true, affiliateSource: true, affiliateAttributionMethod: true, createdAt: true },
      });
      rowsData = data.map(x => [x.orderNumber, x.affiliateId, x.status, x.paymentStatus, x.currency, x.subtotalMinor, x.discountMinor, x.totalMinor, x.affiliateSource, x.affiliateAttributionMethod, x.createdAt]);
    } else if (type === "commissions") {
      headers = ["commission_id", "affiliate_id", "order_id", "basis_minor", "type", "value", "amount_minor", "currency", "status", "source", "campaign", "risk", "created_at"];
      const data = await prisma.affiliateCommission.findMany({
        take: 10000,
        orderBy: { createdAt: "desc" },
        select: { id: true, affiliateId: true, orderId: true, commissionableMinor: true, commissionType: true, commissionValue: true, commissionMinor: true, currency: true, status: true, referralSource: true, campaign: true, risk: true, createdAt: true },
      });
      rowsData = data.map(x => [x.id, x.affiliateId, x.orderId, Number(x.commissionableMinor), x.commissionType, x.commissionValue, Number(x.commissionMinor), x.currency, x.status, x.referralSource, x.campaign, x.risk, x.createdAt]);
    } else if (type === "payouts") {
      headers = ["payout_id", "affiliate_id", "amount_minor", "currency", "status", "method", "transaction_reference", "requested_at", "paid_at"];
      const data = await prisma.affiliatePayout.findMany({
        take: 10000,
        orderBy: { requestedAt: "desc" },
        select: { id: true, affiliateId: true, amountMinor: true, currency: true, status: true, payoutMethod: true, transactionReference: true, requestedAt: true, paidAt: true },
      });
      rowsData = data.map(x => [x.id, x.affiliateId, Number(x.amountMinor), x.currency, x.status, x.payoutMethod, x.transactionReference, x.requestedAt, x.paidAt]);
    } else if (type === "leads") {
      headers = ["lead_id", "affiliate_id", "company", "quantity", "status", "protection_expires_at", "source", "created_at"];
      const data = await prisma.affiliateBusinessLead.findMany({
        take: 10000,
        orderBy: { createdAt: "desc" },
        select: { id: true, affiliateId: true, companyName: true, estimatedQuantity: true, status: true, protectionExpiresAt: true, leadSource: true, createdAt: true },
      });
      rowsData = data.map(x => [x.id, x.affiliateId, x.companyName, x.estimatedQuantity, x.status, x.protectionExpiresAt, x.leadSource, x.createdAt]);
    } else if (type === "fraud") {
      headers = ["flag_id", "affiliate_id", "order_id", "risk", "reason_code", "resolved_at", "decision_reason", "created_at"];
      const data = await prisma.affiliateFraudFlag.findMany({
        take: 10000,
        orderBy: { createdAt: "desc" },
        select: { id: true, affiliateId: true, orderId: true, risk: true, reasonCode: true, resolvedAt: true, decisionReason: true, createdAt: true },
      });
      rowsData = data.map(x => [x.id, x.affiliateId, x.orderId, x.risk, x.reasonCode, x.resolvedAt, x.decisionReason, x.createdAt]);
    } else if (type === "campaigns") {
      headers = ["campaign_id", "affiliate_id", "name", "source", "destination", "active", "created_at"];
      const data = await prisma.affiliateCampaign.findMany({
        take: 10000,
        orderBy: { createdAt: "desc" },
        select: { id: true, affiliateId: true, name: true, source: true, destinationPath: true, active: true, createdAt: true },
      });
      rowsData = data.map(x => [x.id, x.affiliateId, x.name, x.source, x.destinationPath, x.active, x.createdAt]);
    } else {
      return Response.json({ message: "Unknown report." }, { status: 400 });
    }

    const rows = [headers, ...rowsData];
    return new Response(rows.map(row => row.map(csv).join(",")).join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="partner-${type}-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch (error) { return safeError(error); }
}

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
