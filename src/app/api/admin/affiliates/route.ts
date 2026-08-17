import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText, generateAffiliateCode, validAffiliateCode } from "@/lib/affiliate";
import { sendAffiliateEmail } from "@/lib/affiliateNotifications";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";
const statuses = new Set(["PENDING", "APPROVED", "REJECTED", "SUSPENDED", "DISABLED"]);

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const status = url.searchParams.get("status");
    let path = "/rest/v1/affiliate_profiles?select=*,profiles!affiliate_profiles_user_id_fkey(id,email,name,created_at),affiliate_tiers(id,name),affiliate_applications(*)";
    if (id) path += `&id=eq.${encodeURIComponent(id)}`;
    if (status && statuses.has(status)) path += `&status=eq.${status}`;
    path += "&order=created_at.desc&limit=500";
    const { data } = await supabaseJson(path, {}, true);
    const ids = (data || []).map((x: any) => x.id);
    const [commissions, clicks, orders, payouts, fraud, tiers] = await Promise.all([
      ids.length ? supabaseJson(`/rest/v1/affiliate_commissions?affiliate_id=in.(${ids.join(",")})&select=*`, {}, true) : { data: [] },
      ids.length ? supabaseJson(`/rest/v1/affiliate_clicks?affiliate_id=in.(${ids.join(",")})&select=affiliate_id,is_unique,created_at,campaign,source`, {}, true) : { data: [] },
      ids.length ? supabaseJson(`/rest/v1/orders?affiliate_id=in.(${ids.join(",")})&select=id,affiliate_id,order_number,status,payment_status,currency,total_minor,created_at`, {}, true) : { data: [] },
      ids.length ? supabaseJson(`/rest/v1/affiliate_payouts?affiliate_id=in.(${ids.join(",")})&select=id,affiliate_id,amount_minor,currency,status,payout_method,transaction_reference,requested_at,paid_at&order=requested_at.desc`, {}, true) : { data: [] },
      ids.length ? supabaseJson(`/rest/v1/affiliate_fraud_flags?affiliate_id=in.(${ids.join(",")})&select=*&order=created_at.desc`, {}, true) : { data: [] },
      supabaseJson("/rest/v1/affiliate_tiers?select=*&order=min_completed_orders.asc", {}, true),
    ]);
    return Response.json({ data: (data || []).map((profile: any) => ({
      ...profile,
      commissions: commissions.data?.filter((x: any) => x.affiliate_id === profile.id) || [],
      clicks: clicks.data?.filter((x: any) => x.affiliate_id === profile.id) || [],
      orders: orders.data?.filter((x: any) => x.affiliate_id === profile.id) || [],
      payouts: payouts.data?.filter((x: any) => x.affiliate_id === profile.id) || [],
      fraudFlags: fraud.data?.filter((x: any) => x.affiliate_id === profile.id) || [],
    })), tiers: tiers.data || [] });
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
    const beforeResult = await supabaseJson(`/rest/v1/affiliate_profiles?id=eq.${encodeURIComponent(body.id)}&select=*,profiles!affiliate_profiles_user_id_fkey(email,name)&limit=1`, {}, true);
    const before = beforeResult.data?.[0];
    if (!before) return Response.json({ message: "Affiliate not found." }, { status: 404 });
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let action = "AFFILIATE_UPDATED";
    if (typeof body.status === "string" && statuses.has(body.status)) {
      if (body.status === "REJECTED" && cleanText(body.reason, 1000).length < 3) return Response.json({ message: "A rejection reason is required." }, { status: 400 });
      changes.status = body.status;
      changes.rejection_reason = body.status === "REJECTED" ? cleanText(body.reason, 1000) : null;
      changes.suspended_at = body.status === "SUSPENDED" ? new Date().toISOString() : null;
      if (body.status === "APPROVED") {
        changes.affiliate_code = before.affiliate_code || await uniqueCode(before.profiles?.name);
        changes.approved_at = new Date().toISOString(); changes.approved_by = actor.id;
      }
      action = `AFFILIATE_${body.status}`;
    }
    if (body.replaceCode === true) { changes.affiliate_code = await uniqueCode(before.profiles?.name); action = "AFFILIATE_CODE_REPLACED"; }
    if (body.affiliateCode !== undefined) {
      const code = validAffiliateCode(body.affiliateCode);
      if (!code) return Response.json({ message: "Affiliate code must contain 6–12 letters, numbers, underscores, or hyphens." }, { status: 400 });
      changes.affiliate_code = code;
    }
    if (body.couponCode !== undefined) {
      const coupon = body.couponCode ? validAffiliateCode(body.couponCode) : null;
      if (body.couponCode && !coupon) return Response.json({ message: "Coupon code is invalid." }, { status: 400 });
      const effectivePartnerType = String(body.partnerType || before.partner_type);
      if (coupon && !["CREATOR","BUSINESS_PARTNER"].includes(effectivePartnerType)) return Response.json({ message: "Coupons are available only to Creator and Business Partner accounts." }, { status: 400 });
      changes.coupon_code = coupon;
    }
    if (body.tierId !== undefined) changes.tier_id = typeof body.tierId === "string" && body.tierId ? body.tierId : null;
    if (body.partnerType !== undefined) {
      if (!["CUSTOMER_REFERRER","CREATOR","BUSINESS_PARTNER","CAMPUS_AMBASSADOR"].includes(body.partnerType)) return Response.json({ message: "Invalid partner type." }, { status: 400 });
      changes.partner_type = body.partnerType;
    }
    if (body.commissionType !== undefined) {
      if (!["PERCENT_BPS", "FIXED_ORDER_MINOR", "FIXED_PRODUCT_MINOR", "PRODUCT_PERCENT_BPS"].includes(body.commissionType)) return Response.json({ message: "Invalid commission type." }, { status: 400 });
      changes.commission_type = body.commissionType;
    }
    if (body.commissionValue !== undefined) {
      if (body.commissionValue !== null && (!Number.isSafeInteger(body.commissionValue) || body.commissionValue < 0)) return Response.json({ message: "Invalid commission value." }, { status: 400 });
      changes.commission_value = body.commissionValue;
    }
    if (typeof body.internalNotes === "string") changes.internal_notes = cleanText(body.internalNotes, 5000) || null;
    const { data } = await supabaseJson(`/rest/v1/affiliate_profiles?id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", body: JSON.stringify(changes) }, true);
    if (changes.status) {
      await supabaseJson(`/rest/v1/affiliate_applications?affiliate_id=eq.${encodeURIComponent(body.id)}&status=in.(PENDING,SUSPENDED)`, {
        method: "PATCH",
        body: JSON.stringify({ status: changes.status, decision_reason: changes.rejection_reason || cleanText(body.reason, 1000) || null, decided_at: new Date().toISOString(), decided_by: actor.id, updated_at: new Date().toISOString() }),
      }, true);
    }
    await audit(actor, action, "affiliate", body.id, before, changes);
    const email = before.profiles?.email;
    if (email && changes.status) await sendAffiliateEmail({
      eventKey: `${action.toLowerCase()}:${body.id}:${Date.now()}`,
      eventType: action,
      recipient: email,
      subject: `Affiliate application ${String(changes.status).toLowerCase()}`,
      heading: `Affiliate status: ${changes.status}`,
      message: changes.status === "APPROVED" ? "Your affiliate account is approved. Your referral links are ready in the dashboard." : String(changes.rejection_reason || `Your affiliate status changed to ${changes.status}.`),
      affiliateId: body.id,
      actionPath: "/partners/dashboard",
    });
    return Response.json({ data: data?.[0] });
  } catch (error) {
    if ((error as { status?: number }).status === 409) return Response.json({ message: "Affiliate or coupon code is already in use." }, { status: 409 });
    return safeError(error);
  }
}

async function uniqueCode(name?: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateAffiliateCode(name);
    const existing = await supabaseJson(`/rest/v1/affiliate_profiles?affiliate_code=eq.${code}&select=id&limit=1`, {}, true);
    if (!existing.data?.length) return code;
  }
  throw new Error("Could not generate a unique affiliate code.");
}
function createHash(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
