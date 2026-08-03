import { requireAdmin, safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Customer not found." }, { status: 404 });
  try {
    const profileRequest = supabaseJson(`/rest/v1/profiles?id=eq.${id}&role=eq.CUSTOMER&select=id,email,name,phone,role,status,disabled,must_change_password,internal_notes,created_at,updated_at&limit=1`, {}, true);
    const cardsRequest = supabaseJson(`/rest/v1/digital_cards?owner_id=eq.${id}&select=id,slug,profile,active,activated_at,expires_at,created_at,updated_at&order=updated_at.desc&limit=100`, {}, true);
    const ordersRequest = supabaseJson(`/rest/v1/orders?customer_id=eq.${id}&select=id,order_number,status,payment_status,currency,total_minor,created_at,order_items(product_name,quantity)&order=created_at.desc&limit=100`, {}, true);
    const [profile, cards, orders] = await Promise.all([profileRequest, cardsRequest, ordersRequest]);
    if (!profile.data?.[0]) return Response.json({ message: "Customer not found." }, { status: 404 });
    const support = await supabaseJson(`/rest/v1/support_tickets?customer_email=eq.${encodeURIComponent(profile.data[0].email)}&select=id,reference,topic,status,created_at&order=created_at.desc&limit=100`, {}, true).catch(() => ({ data: [] }));
    const affiliate = await supabaseJson(`/rest/v1/affiliate_profiles?user_id=eq.${id}&select=id,affiliate_code,coupon_code,partner_type,status,created_at&limit=1`, {}, true).catch(() => ({ data: [] }));
    return Response.json({ customer: profile.data[0], cards: cards.data || [], orders: orders.data || [], support: support.data || [], affiliate: affiliate.data?.[0] || null });
  } catch (error) { return safeError(error); }
}
