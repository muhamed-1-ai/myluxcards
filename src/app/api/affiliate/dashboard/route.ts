import { getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function GET() {
  const { identity, affiliate } = await getAffiliateForCurrentUser();
  if (!identity) return Response.json({ message: "Authentication required." }, { status: 401 });
  if (!affiliate) return Response.json({ profile: null });
  try {
    const id = encodeURIComponent(affiliate.id);
    const [clicks, orders, commissions, campaigns, payouts, settings, products, materials, credits, rewards] = await Promise.all([
      supabaseJson(`/rest/v1/affiliate_clicks?affiliate_id=eq.${id}&select=id,campaign_id,is_unique,campaign,source,destination_path,created_at&order=created_at.desc&limit=1000`, {}, true),
      supabaseJson(`/rest/v1/orders?affiliate_id=eq.${id}&select=id,order_number,customer_name,customer_email,status,payment_status,currency,subtotal_minor,total_minor,affiliate_campaign_id,affiliate_source,affiliate_coupon_code,created_at,order_items(product_name,quantity)&order=created_at.desc&limit=500`, {}, true),
      supabaseJson(`/rest/v1/affiliate_commissions?affiliate_id=eq.${id}&select=id,order_id,commissionable_minor,commission_type,commission_value,commission_minor,currency,status,referral_source,campaign,risk,created_at,approved_at,payout_at&order=created_at.desc&limit=500`, {}, true),
      supabaseJson(`/rest/v1/affiliate_campaigns?affiliate_id=eq.${id}&select=id,name,source,destination_path,active,created_at&order=created_at.desc&limit=200`, {}, true),
      supabaseJson(`/rest/v1/affiliate_payouts?affiliate_id=eq.${id}&select=id,amount_minor,currency,status,payout_method,transaction_reference,rejection_reason,requested_at,paid_at&order=requested_at.desc&limit=100`, {}, true),
      supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=attribution_window_days,minimum_payout_minor,holding_period_days,payout_schedule,program_terms_url&limit=1", {}, true),
      supabaseJson("/rest/v1/products?active=eq.true&archived_at=is.null&select=id,name,slug,product_type,currency&order=name.asc&limit=200", {}, true),
      supabaseJson("/rest/v1/affiliate_materials?active=eq.true&select=id,title,material_type,description,storage_url,promotional_text,created_at&order=created_at.desc&limit=100", {}, true),
      supabaseJson(`/rest/v1/affiliate_store_credits?affiliate_id=eq.${id}&select=id,amount_minor,currency,status,expires_at,created_at&order=created_at.desc&limit=500`, {}, true),
      supabaseJson(`/rest/v1/affiliate_rewards?affiliate_id=eq.${id}&select=id,status,created_at,fulfilled_at,affiliate_reward_definitions(name,description,required_delivered_orders)&order=created_at.desc&limit=100`, {}, true),
    ]);
    const safeOrders = (orders.data || []).map((order: Record<string, unknown>) => ({
      ...order,
      customer_name: maskName(String(order.customer_name || "")),
      customer_email: maskEmail(String(order.customer_email || "")),
    }));
    const currency = commissions.data?.[0]?.currency || orders.data?.[0]?.currency || "INR";
    return Response.json({
      profile: {
        id: affiliate.id, status: affiliate.status, affiliateCode: affiliate.affiliate_code,
        couponCode: affiliate.coupon_code, tier: affiliate.affiliate_tiers?.name || null, partnerType: affiliate.partner_type,
        rejectionReason: affiliate.rejection_reason,
      },
      stats: summarize(clicks.data || [], orders.data || [], commissions.data || []),
      clicks: clicks.data || [], orders: safeOrders, commissions: commissions.data || [],
      campaigns: (campaigns.data || []).map((campaign:any)=>({
        ...campaign,
        clicks:(clicks.data||[]).filter((click:any)=>click.campaign_id===campaign.id).length,
        uniqueVisitors:(clicks.data||[]).filter((click:any)=>click.campaign_id===campaign.id&&click.is_unique).length,
        conversions:(orders.data||[]).filter((order:any)=>order.affiliate_campaign_id===campaign.id).length,
        revenueMinor:(orders.data||[]).filter((order:any)=>order.affiliate_campaign_id===campaign.id&&order.payment_status==="SUCCEEDED").reduce((sum:number,order:any)=>sum+Number(order.total_minor||0),0),
      })), payouts: payouts.data || [], settings: settings.data?.[0] || {},
      products: products.data || [], materials: materials.data || [], credits: credits.data || [], rewards: rewards.data || [], currency,
      appUrl: process.env.APP_URL?.replace(/\/$/, "") || null,
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
