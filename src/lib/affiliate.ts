import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { currentIdentity } from "./adminAuth";
import { prisma } from "./db/prisma";

export const AFFILIATE_COOKIE = "mlc_affiliate_ref";
export type AffiliateStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "DISABLED";
export type RateType = "PERCENT_BPS" | "FIXED_ORDER_MINOR" | "FIXED_PRODUCT_MINOR" | "PRODUCT_PERCENT_BPS";

export function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function safeDestination(value: unknown) {
  const path = cleanText(value, 500) || "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) return "/";
  try {
    const parsed = new URL(path, "https://myluxcards.invalid");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}

export function validAffiliateCode(value: unknown) {
  const code = cleanText(value, 12).toUpperCase();
  return /^[A-Z0-9][A-Z0-9_-]{5,11}$/.test(code) ? code : null;
}

export function generateAffiliateCode(name = "AFF") {
  const prefix = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "AFF";
  return `${prefix}${randomBytes(3).toString("hex").toUpperCase()}`.slice(0, 12);
}

export async function getAffiliateForCurrentUser() {
  const identity = await currentIdentity();
  if (!identity) return { identity: null, affiliate: null };
  const affiliate = await prisma.affiliateProfile.findUnique({
    where: { userId: identity.id },
    include: { tier: { select: { id: true, name: true } } },
  });
  if (!affiliate) return { identity, affiliate: null };
  return {
    identity,
    affiliate: {
      id: affiliate.id,
      user_id: affiliate.userId,
      status: affiliate.status,
      affiliate_code: affiliate.affiliateCode,
      coupon_code: affiliate.couponCode,
      tier_id: affiliate.tierId,
      tier_name: affiliate.tier?.name || null,
      commission_type: affiliate.commissionType,
      commission_value: affiliate.commissionValue,
      partner_type: affiliate.partnerType,
      display_name: affiliate.displayName,
      temporary_commission_type: affiliate.temporaryCommissionType,
      temporary_commission_value: affiliate.temporaryCommissionValue,
      temporary_commission_expires_at: affiliate.temporaryCommissionExpiresAt,
      approved_at: affiliate.approvedAt,
      approved_by: affiliate.approvedBy,
      suspended_at: affiliate.suspendedAt,
      rejection_reason: affiliate.rejectionReason,
      internal_notes: affiliate.internalNotes,
      payout_method: affiliate.payoutMethod,
      payout_details_ciphertext: affiliate.payoutDetailsCiphertext,
      created_at: affiliate.createdAt,
      updated_at: affiliate.updatedAt,
      affiliate_tiers: affiliate.tier ? { id: affiliate.tier.id, name: affiliate.tier.name } : null,
    },
  };
}

export async function requireApprovedAffiliate() {
  const result = await getAffiliateForCurrentUser();
  return result.affiliate?.status === "APPROVED" ? result : { ...result, affiliate: null };
}

function cookieSecret() {
  const secret = process.env.AFFILIATE_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || "fallback_secret";
  return secret;
}

export type ReferralCookie = {
  affiliateId: string;
  campaign?: string;
  source?: string;
  issuedAt: number;
  expiresAt: number;
};

export function signReferralCookie(payload: ReferralCookie) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", cookieSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyReferralCookie(value: string | undefined): ReferralCookie | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", cookieSecret()).update(encoded).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (supplied.length !== expected.length || !cryptoSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ReferralCookie;
    if (!payload.affiliateId || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function cryptoSafeEqual(left: Buffer, right: Buffer) {
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

export async function currentReferral() {
  const jar = await cookies();
  return verifyReferralCookie(jar.get(AFFILIATE_COOKIE)?.value);
}

/** Call from a trusted checkout route before inserting an order. */
export async function resolveAffiliateAttribution(couponInput?: string | null, businessEmailInput?: string | null) {
  const settingsRow = await prisma.affiliateSetting.findUnique({ where: { id: true } }).catch(() => null);
  const settings = {
    affiliate_coupons_enabled: settingsRow?.affiliateCouponsEnabled ?? true,
    attribution_priority: settingsRow?.attributionPriority ?? "COUPON_THEN_COOKIE",
  };
  const referral = await currentReferral();
  const coupon = couponInput ? validAffiliateCode(couponInput) : null;
  
  const resolveCoupon = async () => {
    if (!coupon || !settings.affiliate_coupons_enabled) return null;
    // status=eq.APPROVED
    const profile = await prisma.affiliateProfile.findFirst({
      where: { couponCode: coupon, status: "APPROVED" },
      select: { id: true, couponCode: true },
    });
    return profile ? { affiliateId: profile.id, couponCode: profile.couponCode, source: "COUPON" } : null;
  };
  const resolveCookie = async () => {
    if (!referral) return null;
    // status=eq.APPROVED
    const profile = await prisma.affiliateProfile.findFirst({
      where: { id: referral.affiliateId, status: "APPROVED" },
      select: { id: true },
    });
    return profile ? { affiliateId: profile.id, campaign: referral.campaign || null, source: referral.source || "REFERRAL_LINK" } : null;
  };
  const resolveBusinessLead = async () => {
    const email = businessEmailInput?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    const emailHash = createHmac("sha256", cookieSecret()).update(email).digest("hex");
    const lead = await prisma.affiliateBusinessLead.findFirst({
      where: {
        emailHash,
        status: { in: ["QUALIFIED","CONTACTED","QUOTATION_SENT","NEGOTIATION"] },
        protectionExpiresAt: { gt: new Date() },
      },
      select: { id: true, affiliateId: true },
    });
    return lead ? { affiliateId: lead.affiliateId, businessLeadId: lead.id, source: "BUSINESS_LEAD" } : null;
  };
  const online = settings.attribution_priority === "COOKIE_THEN_COUPON"
    ? (await resolveCookie()) || (await resolveCoupon())
    : (await resolveCoupon()) || (await resolveCookie());
  return online || (await resolveBusinessLead());
}

export function calculateCommission(
  commissionableMinor: number,
  type: RateType,
  value: number,
  quantity = 1,
) {
  if (!Number.isSafeInteger(commissionableMinor) || commissionableMinor < 0) throw new Error("Invalid commission basis.");
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid commission value.");
  if (type === "PERCENT_BPS" || type === "PRODUCT_PERCENT_BPS") {
    return Math.round((commissionableMinor * value) / 10_000);
  }
  if (type === "FIXED_PRODUCT_MINOR") return value * Math.max(1, quantity);
  return value;
}

type RateDecision = { type: RateType; value: number; source: string };

function generalRate(affiliate: any, tier: any, settings: any): RateDecision {
  if (affiliate.temporary_commission_type && affiliate.temporary_commission_expires_at && new Date(affiliate.temporary_commission_expires_at) > new Date()) {
    return { type: affiliate.temporary_commission_type, value: affiliate.temporary_commission_value, source: "AFFILIATE_TEMPORARY" };
  }
  if (affiliate.commission_type && affiliate.commission_value != null) return { type: affiliate.commission_type, value: affiliate.commission_value, source: "AFFILIATE_GENERAL" };
  if (tier?.commission_type && tier?.commission_value != null) return { type: tier.commission_type, value: tier.commission_value, source: "TIER_GENERAL" };
  const partner = settings.partner_type_rates?.[affiliate.partner_type];
  if (partner?.type && Number.isSafeInteger(partner.value)) return { type: partner.type, value: partner.value, source: "PARTNER_TYPE" };
  return { type: settings.default_commission_type, value: settings.default_commission_value, source: "GLOBAL_DEFAULT" };
}

function productRate(productId: string, rates: any[], affiliate: any, tier: any, settings: any): RateDecision {
  const affiliateProduct = rates.find(rate => rate.product_id === productId && rate.affiliate_id === affiliate.id && rate.active);
  if (affiliateProduct) return { type: affiliateProduct.commission_type, value: affiliateProduct.commission_value, source: "AFFILIATE_PRODUCT" };
  if (affiliate.temporary_commission_type && affiliate.temporary_commission_expires_at && new Date(affiliate.temporary_commission_expires_at) > new Date()) {
    return { type: affiliate.temporary_commission_type, value: affiliate.temporary_commission_value, source: "AFFILIATE_TEMPORARY" };
  }
  if (affiliate.commission_type && affiliate.commission_value != null) return { type: affiliate.commission_type, value: affiliate.commission_value, source: "AFFILIATE_GENERAL" };
  const tierProduct = rates.find(rate => rate.product_id === productId && rate.tier_id === affiliate.tier_id && rate.active);
  if (tierProduct) return { type: tierProduct.commission_type, value: tierProduct.commission_value, source: "TIER_PRODUCT" };
  if (tier?.commission_type && tier?.commission_value != null) return { type: tier.commission_type, value: tier.commission_value, source: "TIER_GENERAL" };
  const productDefault = rates.find(rate => rate.product_id === productId && !rate.affiliate_id && !rate.tier_id && rate.active);
  if (productDefault) return { type: productDefault.commission_type, value: productDefault.commission_value, source: "PRODUCT_DEFAULT" };
  const partner = settings.partner_type_rates?.[affiliate.partner_type];
  if (partner?.type && Number.isSafeInteger(partner.value)) return { type: partner.type, value: partner.value, source: "PARTNER_TYPE" };
  return { type: settings.default_commission_type, value: settings.default_commission_value, source: "GLOBAL_DEFAULT" };
}

export async function syncCommissionForTrustedOrder(orderId: string) {
  const orderRecord = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      affiliate: {
        select: {
          id: true,
          userId: true,
          status: true,
          partnerType: true,
          commissionType: true,
          commissionValue: true,
          temporaryCommissionType: true,
          temporaryCommissionValue: true,
          temporaryCommissionExpiresAt: true,
          tierId: true,
        },
      },
      orderItems: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          totalMinor: true,
        },
      },
    },
  });

  if (!orderRecord?.affiliateId) return { skipped: "no-attribution" };
  
  const order = {
    id: orderRecord.id,
    customer_id: orderRecord.customerId,
    customer_email: orderRecord.customerEmail,
    status: orderRecord.status,
    payment_status: orderRecord.paymentStatus,
    currency: orderRecord.currency,
    subtotal_minor: orderRecord.subtotalMinor,
    discount_minor: orderRecord.discountMinor,
    tax_minor: orderRecord.taxMinor,
    shipping_minor: orderRecord.shippingMinor,
    affiliate_id: orderRecord.affiliateId,
    affiliate_source: orderRecord.affiliateSource,
    affiliate_coupon_code: orderRecord.affiliateCouponCode,
    affiliate_attribution_method: (orderRecord as any).affiliateAttributionMethod || null,
    affiliate_profiles: orderRecord.affiliate ? {
      id: orderRecord.affiliate.id,
      user_id: orderRecord.affiliate.userId,
      status: orderRecord.affiliate.status,
      partner_type: orderRecord.affiliate.partnerType,
      commission_type: orderRecord.affiliate.commissionType,
      commission_value: orderRecord.affiliate.commissionValue,
      temporary_commission_type: orderRecord.affiliate.temporaryCommissionType,
      temporary_commission_value: orderRecord.affiliate.temporaryCommissionValue,
      temporary_commission_expires_at: orderRecord.affiliate.temporaryCommissionExpiresAt,
      tier_id: orderRecord.affiliate.tierId,
    } : null,
    order_items: orderRecord.orderItems.map((item: any) => ({
      id: item.id,
      product_id: item.productId,
      quantity: item.quantity,
      total_minor: item.totalMinor,
    })),
  };

  const affiliate = order.affiliate_profiles;
  const existingCommission = await prisma.affiliateCommission.findFirst({
    where: { orderId, orderItemId: null },
  });
  const commission = existingCommission ? {
    id: existingCommission.id,
    status: existingCommission.status,
  } : null;

  if (["CANCELLED", "REFUNDED"].includes(order.status) || ["FAILED", "REFUNDED"].includes(order.payment_status)) {
    if (commission && !["PAID", "REVERSED", "REJECTED"].includes(commission.status)) {
      await prisma.affiliateCommission.update({
        where: { id: commission.id },
        data: {
          status: "REVERSED",
          reversalReason: `Order ${order.status.toLowerCase()} / payment ${order.payment_status.toLowerCase()}`,
        },
      });
      await prisma.affiliateStoreCredit.updateMany({
        where: { orderId, status: { in: ["PENDING", "AVAILABLE"] } },
        data: {
          status: "REVERSED",
          reversalReason: "The referred order was cancelled or refunded.",
        },
      }).catch(() => undefined);
    }
    return { reversed: Boolean(commission) };
  }

  // order.payment_status !== "SUCCEEDED"
  if (order.payment_status !== "SUCCEEDED" || affiliate?.status !== "APPROVED" || commission) {
    return { skipped: commission ? "already-created" : "not-eligible" };
  }

  const settingsRecord = await prisma.affiliateSetting.findUnique({ where: { id: true } });
  const settings = {
    self_referrals_allowed: settingsRecord?.selfReferralsAllowed ?? false,
    partner_type_rates: (settingsRecord?.partnerTypeRates as any) || {},
    default_commission_type: settingsRecord?.defaultCommissionType || "PERCENT_BPS",
    default_commission_value: settingsRecord?.defaultCommissionValue || 1000,
    discounts_reduce_basis: settingsRecord?.discountsReduceBasis ?? true,
    shipping_commissionable: settingsRecord?.shippingCommissionable ?? false,
    tax_commissionable: settingsRecord?.taxCommissionable ?? false,
    holding_period_days: settingsRecord?.holdingPeriodDays ?? 30,
  };

  let risk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (!settings.self_referrals_allowed && order.customer_id && order.customer_id === affiliate.user_id) risk = "HIGH";
  
  const customerUser = await prisma.user.findUnique({ where: { id: affiliate.user_id }, select: { email: true } });
  if (!settings.self_referrals_allowed && customerUser?.email?.toLowerCase() === order.customer_email?.toLowerCase()) risk = "HIGH";

  const tierRecord = affiliate.tier_id
    ? await prisma.affiliateTier.findUnique({ where: { id: affiliate.tier_id } })
    : null;
  const tier = tierRecord ? {
    id: tierRecord.id,
    commission_type: tierRecord.commissionType,
    commission_value: tierRecord.commissionValue,
  } : null;

  const items: any[] = order.order_items || [];
  const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
  const rateRecords = productIds.length
    ? await prisma.affiliateProductRate.findMany({
        where: { productId: { in: productIds }, active: true },
      })
    : [];
  const rates = rateRecords.map(r => ({
    id: r.id,
    product_id: r.productId,
    affiliate_id: r.affiliateId,
    tier_id: r.tierId,
    commission_type: r.commissionType,
    commission_value: r.commissionValue,
    active: r.active,
  }));

  const subtotal = Number(order.subtotal_minor);
  const discount = settings.discounts_reduce_basis ? Number(order.discount_minor) : 0;
  const breakdown = items.map(item => {
    const gross = Number(item.total_minor);
    const allocatedDiscount = subtotal > 0 ? Math.floor(discount * gross / subtotal) : 0;
    const basis = Math.max(0, gross - allocatedDiscount);
    const rate = productRate(item.product_id, rates, affiliate, tier, settings);
    return { orderItemId: item.id, productId: item.product_id, quantity: item.quantity, grossMinor: gross, discountMinor: allocatedDiscount, basisMinor: basis, ...rate, commissionMinor: calculateCommission(basis, rate.type, rate.value, item.quantity) };
  });

  const general = generalRate(affiliate, tier, settings);
  const productBasis = breakdown.reduce((sum, item) => sum + item.basisMinor, 0);
  const extraBasis = (settings.shipping_commissionable ? Number(order.shipping_minor) : 0) + (settings.tax_commissionable ? Number(order.tax_minor) : 0);
  const commissionable = items.length ? productBasis + extraBasis : Math.max(0, subtotal - discount + extraBasis);
  const fixedOrder = breakdown.find(item => item.type === "FIXED_ORDER_MINOR");
  const amountBeforeRisk = fixedOrder
    ? fixedOrder.value
    : breakdown.length
      ? breakdown.reduce((sum, item) => sum + item.commissionMinor, 0) + (extraBasis ? calculateCommission(extraBasis, general.type, general.value) : 0)
      : calculateCommission(commissionable, general.type, general.value);
  const amount = risk === "HIGH" ? 0 : amountBeforeRisk;
  const oneRate = breakdown.length && breakdown.every(item => item.type === breakdown[0].type && item.value === breakdown[0].value)
    ? breakdown[0] : general;
  const type: RateType = oneRate.type;
  const value = oneRate.value;
  const eligibleAt = new Date(Date.now() + Number(settings.holding_period_days) * 86_400_000);

  const created = await prisma.affiliateCommission.create({
    data: {
      affiliateId: affiliate.id,
      orderId: order.id,
      commissionableMinor: commissionable,
      commissionType: type,
      commissionValue: value,
      commissionMinor: amount,
      currency: order.currency,
      status: risk === "HIGH" ? "REJECTED" : "PENDING",
      referralSource: order.affiliate_coupon_code ? "COUPON" : order.affiliate_source || "REFERRAL_LINK",
      risk,
      eligibleAt,
      rejectionReason: risk === "HIGH" ? "Potential self-referral requires administrator review." : null,
      discountMinor: discount,
      excludedTaxMinor: settings.tax_commissionable ? 0 : Number(order.tax_minor),
      excludedShippingMinor: settings.shipping_commissionable ? 0 : Number(order.shipping_minor),
      calculatedAt: new Date(),
      calculationSnapshot: {
        priority: ["AFFILIATE_PRODUCT","AFFILIATE_GENERAL","TIER_PRODUCT","TIER_GENERAL","PRODUCT_DEFAULT","PARTNER_TYPE","GLOBAL_DEFAULT"],
        items: breakdown,
        generalRate: general,
        attributionMethod: order.affiliate_attribution_method || (order.affiliate_coupon_code ? "AFFILIATE_COUPON" : "REFERRAL_COOKIE"),
      } as any,
    },
  });

  if (risk === "HIGH") {
    await prisma.affiliateFraudFlag.create({
      data: { affiliateId: affiliate.id, orderId: order.id, risk, reasonCode: "POTENTIAL_SELF_REFERRAL" },
    }).catch(() => null);
  }

  return { created };
}

export function encryptSensitive(value: string) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitive(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted value.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function encryptionKey() {
  const secret = process.env.AFFILIATE_PAYOUT_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "fallback_encryption_key";
  return createHash("sha256").update(secret).digest();
}

export function maskPayoutDetails(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= 4 ? "••••" : `••••${clean.slice(-4)}`;
}
