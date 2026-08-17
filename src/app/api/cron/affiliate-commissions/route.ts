import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.AFFILIATE_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const now = new Date().toISOString();
  const { data } = await supabaseJson(
    `/rest/v1/affiliate_commissions?status=eq.PENDING&eligible_at=lte.${encodeURIComponent(now)}&select=id,order_id,affiliate_id,commission_minor,currency,affiliate_profiles(partner_type)&limit=500`,
    {},
    true,
  );
  let approved = 0;
  const changedAffiliates = new Set<string>();
  for (const item of data || []) {
    const order = await supabaseJson(`/rest/v1/orders?id=eq.${item.order_id}&status=eq.DELIVERED&payment_status=eq.SUCCEEDED&select=id&limit=1`, {}, true);
    if (!order.data?.[0]) continue;
    await supabaseJson(`/rest/v1/affiliate_commissions?id=eq.${item.id}&status=eq.PENDING`, {
      method: "PATCH", body: JSON.stringify({ status: "APPROVED", approved_at: now, updated_at: now }),
    }, true);
    if (item.affiliate_profiles?.partner_type === "CUSTOMER_REFERRER") await createStoreCredit(item);
    changedAffiliates.add(item.affiliate_id);
    approved += 1;
  }
  for (const affiliateId of changedAffiliates) await checkEligibility(affiliateId);
  return Response.json({ scanned: data?.length || 0, approved, affiliatesChecked: changedAffiliates.size });
}

async function createStoreCredit(item: any) {
  const settings = (await supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=store_credit_expiry_days&limit=1", {}, true)).data?.[0];
  const expires = settings?.store_credit_expiry_days ? new Date(Date.now() + Number(settings.store_credit_expiry_days) * 86_400_000).toISOString() : null;
  await supabaseJson("/rest/v1/affiliate_store_credits", {
    method: "POST",
    body: JSON.stringify({ affiliate_id: item.affiliate_id, order_id: item.order_id, amount_minor: item.commission_minor, currency: item.currency, status: "AVAILABLE", expires_at: expires }),
  }, true).catch(error => { if ((error as { status?: number }).status !== 409) throw error; });
}

async function checkEligibility(affiliateId: string) {
  const orders = await supabaseJson(`/rest/v1/orders?affiliate_id=eq.${affiliateId}&status=eq.DELIVERED&payment_status=eq.SUCCEEDED&select=id&limit=10000`, {}, true);
  const delivered = orders.data?.length || 0;
  const definitions = await supabaseJson(`/rest/v1/affiliate_reward_definitions?active=eq.true&required_delivered_orders=lte.${delivered}&select=id,name,description`, {}, true);
  for (const definition of definitions.data || []) {
    try {
      await supabaseJson("/rest/v1/affiliate_rewards", {
        method: "POST", body: JSON.stringify({ affiliate_id: affiliateId, reward_definition_id: definition.id, status: "ELIGIBLE" }),
      }, true);
      await supabaseJson("/rest/v1/admin_notifications", {
        method: "POST",
        body: JSON.stringify({ event_key: `affiliate-reward:${affiliateId}:${definition.id}`, type: "AFFILIATE_REWARD", title: "Partner reward eligibility", message: `A partner reached ${definition.name}.` }),
      }, true);
    } catch (error) { if ((error as { status?: number }).status !== 409) throw error; }
  }
  const tiers = await supabaseJson(`/rest/v1/affiliate_tiers?active=eq.true&min_completed_orders=lte.${delivered}&select=id,name,min_completed_orders&order=min_completed_orders.desc&limit=1`, {}, true);
  const profile = await supabaseJson(`/rest/v1/affiliate_profiles?id=eq.${affiliateId}&select=tier_id&limit=1`, {}, true);
  const suggested = tiers.data?.[0];
  if (suggested && profile.data?.[0]?.tier_id !== suggested.id) {
    await supabaseJson("/rest/v1/admin_notifications", {
      method: "POST",
      body: JSON.stringify({ event_key: `affiliate-tier-suggestion:${affiliateId}:${suggested.id}`, type: "AFFILIATE_TIER", title: "Partner tier upgrade available", message: `A partner qualifies for ${suggested.name}.` }),
    }, true).catch(error => { if ((error as { status?: number }).status !== 409) throw error; });
  }
}
