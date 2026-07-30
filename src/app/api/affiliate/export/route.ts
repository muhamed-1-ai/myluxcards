import { getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime="nodejs";
export async function GET(){
  const{identity,affiliate}=await getAffiliateForCurrentUser();if(!identity||!affiliate)return Response.json({message:"Forbidden"},{status:403});
  try{const{data}=await supabaseJson(`/rest/v1/affiliate_commissions?affiliate_id=eq.${affiliate.id}&select=order_id,commissionable_minor,commission_type,commission_value,commission_minor,currency,status,referral_source,campaign,risk,created_at,orders!affiliate_commissions_order_id_fkey(order_number,status,created_at)&order=created_at.desc&limit=10000`,{},true);
    const rows=[["order_reference","order_date","order_status","commissionable_minor","commission_type","commission_value","commission_minor","currency","commission_status","source","campaign","risk"],...(data||[]).map((x:any)=>[x.orders?.order_number,x.orders?.created_at,x.orders?.status,x.commissionable_minor,x.commission_type,x.commission_value,x.commission_minor,x.currency,x.status,x.referral_source,x.campaign,x.risk])];
    return new Response(rows.map((r:any[])=>r.map(csv).join(",")).join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="my-affiliate-report-${new Date().toISOString().slice(0,10)}.csv"`}});
  }catch(error){return safeError(error)}
}
function csv(value:unknown){return`"${String(value??"").replace(/"/g,'""')}"`}
