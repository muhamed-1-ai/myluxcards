import { createHmac } from "node:crypto";
import { cleanText, getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError, validMutationOrigin } from "@/lib/adminAuth";
import { notifyAffiliateAdmin } from "@/lib/affiliateNotifications";
import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime="nodejs";
export async function GET(){
  const{identity,affiliate}=await getAffiliateForCurrentUser();if(!identity||!affiliate||affiliate.status!=="APPROVED"||affiliate.partner_type!=="BUSINESS_PARTNER")return Response.json({message:"Forbidden"},{status:403});
  try{const{data}=await supabaseJson(`/rest/v1/affiliate_business_leads?affiliate_id=eq.${affiliate.id}&select=id,company_name,contact_person,business_email,phone,estimated_quantity,expected_purchase_date,lead_source,status,protection_expires_at,decision_reason,created_at,products(name)&order=created_at.desc&limit=200`,{},true);return Response.json({data:data||[]})}catch(error){return safeError(error)}
}
export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const{identity,affiliate}=await getAffiliateForCurrentUser();if(!identity||!affiliate||affiliate.status!=="APPROVED"||affiliate.partner_type!=="BUSINESS_PARTNER")return Response.json({message:"Only approved Business Partners can register leads."},{status:403});
  try{
    const body=await request.json().catch(()=>({}));const company=cleanText(body.companyName,180),contact=cleanText(body.contactPerson,140),email=cleanText(body.businessEmail,320).toLowerCase(),phone=cleanText(body.phone,30),source=cleanText(body.leadSource,100),notes=cleanText(body.notes,2000);const quantity=Number(body.estimatedQuantity);
    if(company.length<2||contact.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isSafeInteger(quantity)||quantity<1||body.consentConfirmed!==true)return Response.json({message:"Complete the legitimate business lead details and confirm consent."},{status:400});
    const normalizedCompany=company.toLowerCase().replace(/[^a-z0-9]/g,"");const emailHash=hash(email),phoneHash=phone?hash(phone.replace(/\D/g,"")):null;
    const duplicate=await supabaseJson(`/rest/v1/affiliate_business_leads?or=(email_hash.eq.${emailHash},and(normalized_company.eq.${encodeURIComponent(normalizedCompany)},phone_hash.eq.${phoneHash||"none"}))&status=not.in.(LOST,EXPIRED,REJECTED)&select=id,affiliate_id&limit=1`,{},true);
    const{data}=await supabaseJson("/rest/v1/affiliate_business_leads",{method:"POST",body:JSON.stringify({affiliate_id:affiliate.id,company_name:company,normalized_company:normalizedCompany,contact_person:contact,business_email:email,email_hash:emailHash,phone:phone||null,phone_hash:phoneHash,estimated_quantity:quantity,product_id:typeof body.productId==="string"&&body.productId?body.productId:null,expected_purchase_date:/^\d{4}-\d{2}-\d{2}$/.test(body.expectedPurchaseDate)?body.expectedPurchaseDate:null,notes:notes||null,consent_confirmed_at:new Date().toISOString(),lead_source:source||null,status:"REGISTERED"})},true);const lead=data?.[0];
    if(duplicate.data?.[0])await supabaseJson("/rest/v1/affiliate_fraud_flags",{method:"POST",body:JSON.stringify({affiliate_id:affiliate.id,risk:"MEDIUM",reason_code:"DUPLICATE_BUSINESS_LEAD",details:{lead_id:lead.id,possible_duplicate_id:duplicate.data[0].id}})},true);
    await notifyAffiliateAdmin(`affiliate-lead:${lead.id}`,"New Business Partner lead",`${identity.name} registered a corporate lead for ${company}.`,affiliate.id);return Response.json({data:{id:lead.id,status:lead.status,duplicateReview:Boolean(duplicate.data?.[0])}},{status:201});
  }catch(error){return safeError(error)}
}
function hash(value:string){const secret=process.env.AFFILIATE_COOKIE_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw new Error("Lead hashing is not configured.");return createHmac("sha256",secret).update(value).digest("hex")}
