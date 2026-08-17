import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";

export async function findAffiliateForUser(userId: string, db?: Queryable) {
  if (db && db !== (await import("../db")).pool) {
    return (await db.query("select ap.*,at.name as tier_name from affiliate_profiles ap left join affiliate_tiers at on at.id=ap.tier_id where ap.user_id=$1", [userId])).rows[0] ?? null;
  }
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: {
      tier: { select: { name: true } },
    },
  });
  if (!profile) return null;
  return {
    id: profile.id,
    user_id: profile.userId,
    status: profile.status,
    affiliate_code: profile.affiliateCode,
    coupon_code: profile.couponCode,
    tier_id: profile.tierId,
    tier_name: profile.tier?.name || null,
    commission_type: profile.commissionType,
    commission_value: profile.commissionValue,
    partner_type: profile.partnerType,
    display_name: profile.displayName,
    temporary_commission_type: profile.temporaryCommissionType,
    temporary_commission_value: profile.temporaryCommissionValue,
    temporary_commission_expires_at: profile.temporaryCommissionExpiresAt,
    approved_at: profile.approvedAt,
    approved_by: profile.approvedBy,
    suspended_at: profile.suspendedAt,
    rejection_reason: profile.rejectionReason,
    internal_notes: profile.internalNotes,
    payout_method: profile.payoutMethod,
    payout_details_ciphertext: profile.payoutDetailsCiphertext,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export async function findAffiliateByCode(code: string, db?: Queryable) {
  if (db && db !== (await import("../db")).pool) {
    return (await db.query("select * from affiliate_profiles where upper(affiliate_code)=upper($1) and status='APPROVED'", [code])).rows[0] ?? null;
  }
  const profile = await prisma.affiliateProfile.findFirst({
    where: {
      affiliateCode: { equals: code, mode: "insensitive" },
      status: "APPROVED",
    },
  });
  if (!profile) return null;
  return {
    id: profile.id,
    user_id: profile.userId,
    status: profile.status,
    affiliate_code: profile.affiliateCode,
    coupon_code: profile.couponCode,
    tier_id: profile.tierId,
    commission_type: profile.commissionType,
    commission_value: profile.commissionValue,
    partner_type: profile.partnerType,
    display_name: profile.displayName,
    temporary_commission_type: profile.temporaryCommissionType,
    temporary_commission_value: profile.temporaryCommissionValue,
    temporary_commission_expires_at: profile.temporaryCommissionExpiresAt,
    approved_at: profile.approvedAt,
    approved_by: profile.approvedBy,
    suspended_at: profile.suspendedAt,
    rejection_reason: profile.rejectionReason,
    internal_notes: profile.internalNotes,
    payout_method: profile.payoutMethod,
    payout_details_ciphertext: profile.payoutDetailsCiphertext,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}
