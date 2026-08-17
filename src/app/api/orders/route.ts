import { currentIdentity, safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Please sign in." }, { status: 401 });
  try {
    const { data } = await supabaseJson(`/rest/v1/orders?customer_id=eq.${identity.id}&select=id,order_number,status,payment_status,currency,subtotal_minor,discount_minor,tax_minor,shipping_minor,total_minor,shipping_address,courier,tracking_number,created_at,order_items(id,product_name,sku,quantity,unit_price_minor,total_minor)&order=created_at.desc&limit=100`, {}, true);
    return Response.json({ data: data || [] });
  } catch (error) { return safeError(error); }
}
