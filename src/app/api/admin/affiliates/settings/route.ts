import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const settings = await prisma.affiliateSetting.findUnique({ where: { id: true } });
    if (!settings) return Response.json({ message: "Affiliate settings have not been initialized." }, { status: 503 });

    const data = {
      id: true,
      program_enabled: settings.programEnabled,
      public_applications_enabled: settings.publicApplicationsEnabled,
      allowed_partner_types: settings.allowedPartnerTypes,
      partner_type_rates: settings.partnerTypeRates,
      default_commission_type: settings.defaultCommissionType,
      default_commission_value: settings.defaultCommissionValue,
      customer_referral_discount_bps: settings.customerReferralDiscountBps,
      customer_referral_cash_enabled: settings.customerReferralCashEnabled,
      attribution_window_days: settings.attributionWindowDays,
      business_lead_protection_days: settings.businessLeadProtectionDays,
      minimum_payout_minor: Number(settings.minimumPayoutMinor),
      holding_period_days: settings.holdingPeriodDays,
      shipping_commissionable: settings.shippingCommissionable,
      tax_commissionable: settings.taxCommissionable,
      discounts_reduce_basis: settings.discountsReduceBasis,
      cancelled_commissionable: settings.cancelledCommissionable,
      refunded_reverse: settings.refundedReverse,
      affiliate_coupons_enabled: settings.affiliateCouponsEnabled,
      coupon_stacking_allowed: settings.couponStackingAllowed,
      self_referrals_allowed: settings.selfReferralsAllowed,
      tap_to_refer_enabled: settings.tapToReferEnabled,
      automatic_tier_upgrades: settings.automaticTierUpgrades,
      attribution_policy: settings.attributionPolicy,
      attribution_priority: settings.attributionPriority,
      payout_schedule: settings.payoutSchedule,
      allowed_payout_methods: settings.allowedPayoutMethods,
      program_terms_url: settings.programTermsUrl,
      support_email: settings.supportEmail,
      terms_content: settings.termsContent,
      store_credit_expiry_days: settings.storeCreditExpiryDays,
      updated_by: settings.updatedBy,
      updated_at: settings.updatedAt,
    };

    return Response.json({ data });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const before = await prisma.affiliateSetting.findUnique({ where: { id: true } });

    const updateData: any = {};
    if (typeof body.program_enabled === "boolean") updateData.programEnabled = body.program_enabled;
    if (typeof body.public_applications_enabled === "boolean") updateData.publicApplicationsEnabled = body.public_applications_enabled;
    if (Array.isArray(body.allowed_partner_types)) updateData.allowedPartnerTypes = body.allowed_partner_types;
    if (body.partner_type_rates !== undefined) updateData.partnerTypeRates = body.partner_type_rates;
    if (typeof body.default_commission_type === "string") updateData.defaultCommissionType = body.default_commission_type;
    if (typeof body.default_commission_value === "number") updateData.defaultCommissionValue = body.default_commission_value;
    if (typeof body.customer_referral_discount_bps === "number") updateData.customerReferralDiscountBps = body.customer_referral_discount_bps;
    if (typeof body.customer_referral_cash_enabled === "boolean") updateData.customerReferralCashEnabled = body.customer_referral_cash_enabled;
    if (typeof body.attribution_window_days === "number") updateData.attributionWindowDays = body.attribution_window_days;
    if (typeof body.business_lead_protection_days === "number") updateData.businessLeadProtectionDays = body.business_lead_protection_days;
    if (typeof body.minimum_payout_minor === "number") updateData.minimumPayoutMinor = body.minimum_payout_minor;
    if (typeof body.holding_period_days === "number") updateData.holdingPeriodDays = body.holding_period_days;
    if (typeof body.shipping_commissionable === "boolean") updateData.shippingCommissionable = body.shipping_commissionable;
    if (typeof body.tax_commissionable === "boolean") updateData.taxCommissionable = body.tax_commissionable;
    if (typeof body.discounts_reduce_basis === "boolean") updateData.discountsReduceBasis = body.discounts_reduce_basis;
    if (typeof body.cancelled_commissionable === "boolean") updateData.cancelledCommissionable = body.cancelled_commissionable;
    if (typeof body.refunded_reverse === "boolean") updateData.refundedReverse = body.refunded_reverse;
    if (typeof body.affiliate_coupons_enabled === "boolean") updateData.affiliateCouponsEnabled = body.affiliate_coupons_enabled;
    if (typeof body.coupon_stacking_allowed === "boolean") updateData.couponStackingAllowed = body.coupon_stacking_allowed;
    if (typeof body.self_referrals_allowed === "boolean") updateData.selfReferralsAllowed = body.self_referrals_allowed;
    if (typeof body.tap_to_refer_enabled === "boolean") updateData.tapToReferEnabled = body.tap_to_refer_enabled;
    if (typeof body.automatic_tier_upgrades === "boolean") updateData.automaticTierUpgrades = body.automatic_tier_upgrades;
    if (typeof body.attribution_policy === "string") updateData.attributionPolicy = body.attribution_policy;
    if (typeof body.attribution_priority === "string") updateData.attributionPriority = body.attribution_priority;
    if (typeof body.payout_schedule === "string") updateData.payoutSchedule = body.payout_schedule;
    if (Array.isArray(body.allowed_payout_methods)) updateData.allowedPayoutMethods = body.allowed_payout_methods;
    if (typeof body.program_terms_url === "string") updateData.programTermsUrl = cleanText(body.program_terms_url, 1000);
    if (typeof body.support_email === "string") updateData.supportEmail = cleanText(body.support_email, 1000);
    if (typeof body.terms_content === "string") updateData.termsContent = cleanText(body.terms_content, 20000);
    if (typeof body.store_credit_expiry_days === "number") updateData.storeCreditExpiryDays = body.store_credit_expiry_days;

    const partnerTypes = ["CUSTOMER_REFERRER","CREATOR","BUSINESS_PARTNER","CAMPUS_AMBASSADOR"];
    if (updateData.allowedPartnerTypes !== undefined && (!Array.isArray(updateData.allowedPartnerTypes) || updateData.allowedPartnerTypes.some((v: any) => !partnerTypes.includes(String(v))))) {
      return Response.json({ message: "Allowed partner types are invalid." }, { status: 400 });
    }
    
    const payoutMethods = ["BANK_TRANSFER","UPI","PAYPAL","OTHER"];
    if (updateData.allowedPayoutMethods !== undefined && (!Array.isArray(updateData.allowedPayoutMethods) || updateData.allowedPayoutMethods.some((v: any) => !payoutMethods.includes(String(v))))) {
      return Response.json({ message: "Allowed payout methods are invalid." }, { status: 400 });
    }

    if (updateData.partnerTypeRates !== undefined && (typeof updateData.partnerTypeRates !== "object" || Array.isArray(updateData.partnerTypeRates))) {
      return Response.json({ message: "Partner rates are invalid." }, { status: 400 });
    }

    const integerKeys = ["defaultCommissionValue","customerReferralDiscountBps","attributionWindowDays","businessLeadProtectionDays","minimumPayoutMinor","holdingPeriodDays"];
    if (integerKeys.some(key => updateData[key] !== undefined && (!Number.isSafeInteger(updateData[key]) || Number(updateData[key]) < 0))) {
      return Response.json({ message: "One or more numeric settings are invalid." }, { status: 400 });
    }

    updateData.updatedBy = actor.id;

    await prisma.affiliateSetting.upsert({
      where: { id: true },
      create: { id: true, ...updateData },
      update: updateData,
    });

    await audit(actor, "AFFILIATE_SETTINGS_UPDATED", "affiliate_settings", "global", before, updateData);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
