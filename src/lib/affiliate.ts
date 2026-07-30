import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { currentIdentity } from "./adminAuth";
import { supabaseJson } from "./supabaseAuth";

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
  const { data } = await supabaseJson(
    `/rest/v1/affiliate_profiles?user_id=eq.${encodeURIComponent(identity.id)}&select=*,affiliate_tiers(id,name)&limit=1`,
    {},
    true,
  );
  return { identity, affiliate: data?.[0] || null };
}

export async function requireApprovedAffiliate() {
  const result = await getAffiliateForCurrentUser();
  return result.affiliate?.status === "APPROVED" ? result : { ...result, affiliate: null };
}

function cookieSecret() {
  const secret = process.env.AFFILIATE_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Affiliate cookie signing is not configured.");
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
  const settingsResult = await supabaseJson(
    "/rest/v1/affiliate_settings?id=eq.true&select=affiliate_coupons_enabled,attribution_priority&limit=1",
    {},
    true,
  );
  const settings = settingsResult.data?.[0] || { affiliate_coupons_enabled: true, attribution_priority: "COUPON_THEN_COOKIE" };
  const referral = await currentReferral();
  const coupon = couponInput ? validAffiliateCode(couponInput) : null;
  const resolveCoupon = async () => {
    if (!coupon || !settings.affiliate_coupons_enabled) return null;
    const { data } = await supabaseJson(
      `/rest/v1/affiliate_profiles?coupon_code=eq.${encodeURIComponent(coupon)}&status=eq.APPROVED&select=id,coupon_code&limit=1`,
      {},
      true,
    );
    return data?.[0] ? { affiliateId: data[0].id, couponCode: data[0].coupon_code, source: "COUPON" } : null;
  };
  const resolveCookie = async () => {
    if (!referral) return null;
    const { data } = await supabaseJson(
      `/rest/v1/affiliate_profiles?id=eq.${encodeURIComponent(referral.affiliateId)}&status=eq.APPROVED&select=id&limit=1`,
      {},
      true,
    );
    return data?.[0] ? { affiliateId: data[0].id, campaign: referral.campaign || null, source: referral.source || "REFERRAL_LINK" } : null;
  };
  const resolveBusinessLead = async () => {
    const email = businessEmailInput?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    const emailHash = createHmac("sha256", cookieSecret()).update(email).digest("hex");
    const { data } = await supabaseJson(
      `/rest/v1/affiliate_business_leads?email_hash=eq.${emailHash}&status=in.(QUALIFIED,CONTACTED,QUOTATION_SENT,NEGOTIATION)&protection_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,affiliate_id&limit=1`,
      {},
      true,
    );
    return data?.[0] ? { affiliateId: data[0].affiliate_id, businessLeadId: data[0].id, source: "BUSINESS_LEAD" } : null;
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
  const { data } = await supabaseJson(
    `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,customer_id,customer_email,status,payment_status,currency,subtotal_minor,discount_minor,tax_minor,shipping_minor,affiliate_id,affiliate_source,affiliate_coupon_code,affiliate_attribution_method,affiliate_profiles!orders_affiliate_id_fkey(id,user_id,status,partner_type,commission_type,commission_value,temporary_commission_type,temporary_commission_value,temporary_commission_expires_at,tier_id),order_items(id,product_id,quantity,total_minor)&limit=1`,
    {},
    true,
  );
  const order = data?.[0];
  if (!order?.affiliate_id) return { skipped: "no-attribution" };
  const affiliate = Array.isArray(order.affiliate_profiles) ? order.affiliate_profiles[0] : order.affiliate_profiles;
  const existing = await supabaseJson(`/rest/v1/affiliate_commissions?order_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`, {}, true);
  const commission = existing.data?.[0];

  if (["CANCELLED", "REFUNDED"].includes(order.status) || ["FAILED", "REFUNDED"].includes(order.payment_status)) {
    if (commission && !["PAID", "REVERSED", "REJECTED"].includes(commission.status)) {
      await supabaseJson(`/rest/v1/affiliate_commissions?id=eq.${commission.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "REVERSED", reversal_reason: `Order ${order.status.toLowerCase()} / payment ${order.payment_status.toLowerCase()}`, updated_at: new Date().toISOString() }),
      }, true);
      await supabaseJson(`/rest/v1/affiliate_store_credits?order_id=eq.${encodeURIComponent(orderId)}&status=in.(PENDING,AVAILABLE)`, {
        method: "PATCH",
        body: JSON.stringify({ status: "REVERSED", reversal_reason: "The referred order was cancelled or refunded.", updated_at: new Date().toISOString() }),
      }, true).catch(() => undefined);
    }
    return { reversed: Boolean(commission) };
  }
  if (order.payment_status !== "SUCCEEDED" || affiliate?.status !== "APPROVED" || commission) {
    return { skipped: commission ? "already-created" : "not-eligible" };
  }

  const settingsResult = await supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=*", {}, true);
  const settings = settingsResult.data?.[0];
  let risk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (!settings.self_referrals_allowed && order.customer_id && order.customer_id === affiliate.user_id) risk = "HIGH";
  const profile = await supabaseJson(`/rest/v1/profiles?id=eq.${encodeURIComponent(affiliate.user_id)}&select=email&limit=1`, {}, true);
  if (!settings.self_referrals_allowed && profile.data?.[0]?.email?.toLowerCase() === order.customer_email?.toLowerCase()) risk = "HIGH";

  const tier = affiliate.tier_id
    ? (await supabaseJson(`/rest/v1/affiliate_tiers?id=eq.${affiliate.tier_id}&select=*&limit=1`, {}, true)).data?.[0]
    : null;
  const items: any[] = order.order_items || [];
  const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
  const rates = productIds.length
    ? (await supabaseJson(`/rest/v1/affiliate_product_rates?product_id=in.(${productIds.join(",")})&active=eq.true&select=*`, {}, true)).data || []
    : [];
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
  const eligibleAt = new Date(Date.now() + Number(settings.holding_period_days) * 86_400_000).toISOString();
  const { data: created } = await supabaseJson("/rest/v1/affiliate_commissions", {
    method: "POST",
    body: JSON.stringify({
      affiliate_id: affiliate.id,
      order_id: order.id,
      commissionable_minor: commissionable,
      commission_type: type,
      commission_value: value,
      commission_minor: amount,
      currency: order.currency,
      status: risk === "HIGH" ? "REJECTED" : "PENDING",
      referral_source: order.affiliate_coupon_code ? "COUPON" : order.affiliate_source || "REFERRAL_LINK",
      risk,
      eligible_at: eligibleAt,
      rejection_reason: risk === "HIGH" ? "Potential self-referral requires administrator review." : null,
      discount_minor: discount,
      excluded_tax_minor: settings.tax_commissionable ? 0 : Number(order.tax_minor),
      excluded_shipping_minor: settings.shipping_commissionable ? 0 : Number(order.shipping_minor),
      calculated_at: new Date().toISOString(),
      calculation_snapshot: {
        priority: ["AFFILIATE_PRODUCT","AFFILIATE_GENERAL","TIER_PRODUCT","TIER_GENERAL","PRODUCT_DEFAULT","PARTNER_TYPE","GLOBAL_DEFAULT"],
        items: breakdown,
        generalRate: general,
        attributionMethod: order.affiliate_attribution_method || (order.affiliate_coupon_code ? "AFFILIATE_COUPON" : "REFERRAL_COOKIE"),
      },
    }),
  }, true);
  if (risk === "HIGH") {
    await supabaseJson("/rest/v1/affiliate_fraud_flags", {
      method: "POST",
      body: JSON.stringify({ affiliate_id: affiliate.id, order_id: order.id, risk, reason_code: "POTENTIAL_SELF_REFERRAL" }),
    }, true);
  }
  return { created: created?.[0] || null };
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
  const secret = process.env.AFFILIATE_PAYOUT_ENCRYPTION_KEY;
  if (!secret) throw new Error("Affiliate payout encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}

export function maskPayoutDetails(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= 4 ? "••••" : `••••${clean.slice(-4)}`;
}
