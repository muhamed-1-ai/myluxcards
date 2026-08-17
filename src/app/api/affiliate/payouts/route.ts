import { cleanText, encryptSensitive, getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError, validMutationOrigin } from "@/lib/adminAuth";
import { notifyAffiliateAdmin } from "@/lib/affiliateNotifications";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { identity, affiliate } = await getAffiliateForCurrentUser();
  if (!identity || !affiliate || affiliate.status !== "APPROVED") return Response.json({ message: "Only approved affiliates can request payouts." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const program = await supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=customer_referral_cash_enabled&limit=1", {}, true);
    if (affiliate.partner_type === "CUSTOMER_REFERRER" && !program.data?.[0]?.customer_referral_cash_enabled) {
      return Response.json({ message: "Customer Referrer rewards are issued as store credit." }, { status: 400 });
    }
    const method = cleanText(body.method, 40).toUpperCase();
    const details = cleanText(body.details, 500);
    if (!["BANK_TRANSFER", "UPI", "PAYPAL", "OTHER"].includes(method) || details.length < 3) {
      return Response.json({ message: "Select a payout method and enter valid payout details." }, { status: 400 });
    }
    const ciphertext = encryptSensitive(details);
    await supabaseJson(`/rest/v1/affiliate_profiles?id=eq.${affiliate.id}`, {
      method: "PATCH", body: JSON.stringify({ payout_method: method, payout_details_ciphertext: ciphertext, updated_at: new Date().toISOString() }),
    }, true);
    const { data } = await supabaseJson("/rest/v1/rpc/request_affiliate_payout", {
      method: "POST", body: JSON.stringify({ p_affiliate: affiliate.id, p_method: method }),
    }, true);
    const payoutId = typeof data === "string" ? data : data?.[0]?.request_affiliate_payout || data;
    await supabaseJson(`/rest/v1/affiliate_payouts?id=eq.${encodeURIComponent(String(payoutId))}`, {
      method: "PATCH", body: JSON.stringify({ payout_details_snapshot_ciphertext: ciphertext }),
    }, true);
    await notifyAffiliateAdmin(`affiliate-payout:${payoutId}`, "Affiliate payout requested", `${identity.name} requested an affiliate payout.`, affiliate.id);
    return Response.json({ data: { id: payoutId, status: "REQUESTED" } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && /below the configured minimum/i.test(error.message)
      ? error.message : "The payout request could not be completed.";
    if (message !== "The payout request could not be completed.") return Response.json({ message }, { status: 400 });
    return safeError(error);
  }
}
