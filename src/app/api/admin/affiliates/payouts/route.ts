import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { sendAffiliateEmail } from "@/lib/affiliateNotifications";
import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime="nodejs";
const statuses=new Set(["UNDER_REVIEW","APPROVED","PROCESSING","PAID","REJECTED","CANCELLED"]);
export async function PATCH(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const actor=await requireAdmin();if(!actor)return Response.json({message:"Forbidden"},{status:403});
  try{
    const body=await request.json().catch(()=>({}));if(typeof body.id!=="string"||!statuses.has(body.status))return Response.json({message:"Invalid payout action."},{status:400});
    if(body.status==="REJECTED"&&cleanText(body.reason,1000).length<3)return Response.json({message:"A rejection reason is required."},{status:400});
    if(body.status==="PAID"&&cleanText(body.transactionReference,200).length<3)return Response.json({message:"A transaction reference is required."},{status:400});
    const beforeResult=await supabaseJson(`/rest/v1/affiliate_payouts?id=eq.${encodeURIComponent(body.id)}&select=*,affiliate_profiles!affiliate_payouts_affiliate_id_fkey(id,profiles!affiliate_profiles_user_id_fkey(email,name))&limit=1`,{},true);const before=beforeResult.data?.[0];
    if(!before)return Response.json({message:"Payout not found."},{status:404});if(["PAID","CANCELLED"].includes(before.status))return Response.json({message:"This payout is already final."},{status:409});
    const changes:any={status:body.status,reviewed_by:actor.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString(),internal_note:cleanText(body.internalNote,2000)||null};
    if(body.status==="REJECTED")changes.rejection_reason=cleanText(body.reason,1000);if(body.status==="PAID"){changes.paid_at=new Date().toISOString();changes.transaction_reference=cleanText(body.transactionReference,200)}
    await supabaseJson(`/rest/v1/affiliate_payouts?id=eq.${body.id}`,{method:"PATCH",body:JSON.stringify(changes)},true);
    if(["REJECTED","CANCELLED"].includes(body.status))await supabaseJson(`/rest/v1/affiliate_commissions?id=in.(${await payoutCommissionIds(body.id)})`,{method:"PATCH",body:JSON.stringify({status:"APPROVED",updated_at:new Date().toISOString()})},true);
    if(body.status==="PAID")await supabaseJson(`/rest/v1/affiliate_commissions?id=in.(${await payoutCommissionIds(body.id)})`,{method:"PATCH",body:JSON.stringify({status:"PAID",payout_at:new Date().toISOString(),updated_at:new Date().toISOString()})},true);
    await audit(actor,`AFFILIATE_PAYOUT_${body.status}`,"affiliate_payout",body.id,before,changes);
    const profile=before.affiliate_profiles;const email=profile?.profiles?.email;if(email)await sendAffiliateEmail({eventKey:`affiliate-payout-${body.status.toLowerCase()}:${body.id}`,eventType:`PAYOUT_${body.status}`,recipient:email,subject:`Partner payout ${body.status.toLowerCase()}`,heading:`Payout ${body.status}`,message:body.status==="REJECTED"?changes.rejection_reason:`Your payout request is now ${body.status.toLowerCase()}.`,affiliateId:profile.id,actionPath:"/partners/dashboard/payouts"});
    return Response.json({ok:true});
  }catch(error){return safeError(error)}
}
async function payoutCommissionIds(id:string){const {data}=await supabaseJson(`/rest/v1/affiliate_payout_items?payout_id=eq.${encodeURIComponent(id)}&select=commission_id`,{},true);return(data||[]).map((x:any)=>x.commission_id).join(",")||"00000000-0000-0000-0000-000000000000"}
