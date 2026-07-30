import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { supabaseJson } from "@/lib/supabaseAuth";
export const runtime = "nodejs";
export async function GET() {
  const actor=await requireAdmin();if(!actor)return Response.json({message:"Forbidden"},{status:403});
  try{const [settings,tiers]=await Promise.all([supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=*",{},true),supabaseJson("/rest/v1/affiliate_tiers?select=*&order=min_completed_orders.asc",{},true)]);return Response.json({data:settings.data?.[0],tiers:tiers.data||[]})}catch(error){return safeError(error)}
}
export async function PATCH(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const actor=await requireAdmin();if(!actor)return Response.json({message:"Forbidden"},{status:403});
  try{
    const body=await request.json().catch(()=>({}));const before=await supabaseJson("/rest/v1/affiliate_settings?id=eq.true&select=*",{},true);
    const allowed=["program_enabled","public_applications_enabled","allowed_partner_types","partner_type_rates","default_commission_type","default_commission_value","customer_referral_discount_bps","customer_referral_cash_enabled","attribution_window_days","business_lead_protection_days","minimum_payout_minor","holding_period_days","shipping_commissionable","tax_commissionable","discounts_reduce_basis","cancelled_commissionable","refunded_reverse","affiliate_coupons_enabled","coupon_stacking_allowed","self_referrals_allowed","tap_to_refer_enabled","automatic_tier_upgrades","attribution_policy","attribution_priority","payout_schedule","allowed_payout_methods","program_terms_url","support_email","terms_content","store_credit_expiry_days"];
    const input:Record<string,unknown>={};
    for(const key of allowed)if(body[key]!==undefined)input[key]=typeof body[key]==="string"?cleanText(body[key],key==="terms_content"?20000:1000):body[key];
    const partnerTypes=["CUSTOMER_REFERRER","CREATOR","BUSINESS_PARTNER","CAMPUS_AMBASSADOR"];
    if(input.allowed_partner_types!==undefined&&(!Array.isArray(input.allowed_partner_types)||input.allowed_partner_types.some(value=>!partnerTypes.includes(String(value)))))return Response.json({message:"Allowed partner types are invalid."},{status:400});
    const payoutMethods=["BANK_TRANSFER","UPI","PAYPAL","OTHER"];
    if(input.allowed_payout_methods!==undefined&&(!Array.isArray(input.allowed_payout_methods)||input.allowed_payout_methods.some(value=>!payoutMethods.includes(String(value)))))return Response.json({message:"Allowed payout methods are invalid."},{status:400});
    if(input.partner_type_rates!==undefined&&(typeof input.partner_type_rates!=="object"||Array.isArray(input.partner_type_rates)))return Response.json({message:"Partner rates are invalid."},{status:400});
    const integerKeys=["default_commission_value","customer_referral_discount_bps","attribution_window_days","business_lead_protection_days","minimum_payout_minor","holding_period_days"];
    if(integerKeys.some(key=>input[key]!==undefined&&(!Number.isSafeInteger(input[key])||Number(input[key])<0)))return Response.json({message:"One or more numeric settings are invalid."},{status:400});
    input.updated_by=actor.id;input.updated_at=new Date().toISOString();
    await supabaseJson("/rest/v1/affiliate_settings?id=eq.true",{method:"PATCH",body:JSON.stringify(input)},true);await audit(actor,"AFFILIATE_SETTINGS_UPDATED","affiliate_settings","global",before.data?.[0],input);return Response.json({ok:true});
  }catch(error){return safeError(error)}
}
