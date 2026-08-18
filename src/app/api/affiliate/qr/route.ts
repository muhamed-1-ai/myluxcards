import { buildPremiumQrSvg } from "@/lib/premiumQr";
import { cleanText, requireApprovedAffiliate, safeDestination } from "@/lib/affiliate";
import { safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";
import { getAppOrigin } from "@/lib/url";
export const runtime="nodejs";

export async function GET(request:Request){
  const{affiliate}=await requireApprovedAffiliate();if(!affiliate)return Response.json({message:"Forbidden"},{status:403});
  try{
    const appUrl=getAppOrigin(request);
    const url=new URL(request.url);const destination=safeDestination(url.searchParams.get("destination"));const campaign=cleanText(url.searchParams.get("campaign"),80).replace(/[^a-zA-Z0-9 _.-]/g,"");const source=cleanText(url.searchParams.get("source"),80).replace(/[^a-zA-Z0-9 _.-]/g,"");
    if(campaign){const active=await supabaseJson(`/rest/v1/affiliate_campaigns?affiliate_id=eq.${affiliate.id}&name=eq.${encodeURIComponent(campaign)}&active=eq.true&select=id&limit=1`,{},true);if(!active.data?.[0])return Response.json({message:"Campaign not found."},{status:404})}
    if(destination.startsWith("/products/")){const slug=destination.split("/")[2]?.split("?")[0];const product=await supabaseJson(`/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&active=eq.true&archived_at=is.null&select=id&limit=1`,{},true);if(!product.data?.[0])return Response.json({message:"Product not found."},{status:404})}
    const referral=new URL(destination,appUrl);referral.searchParams.set("ref",affiliate.affiliate_code);if(campaign)referral.searchParams.set("campaign",campaign);if(source)referral.searchParams.set("source",source);
    const svg = buildPremiumQrSvg(referral.toString(), { showLabel: true, label: "SCAN ME" });
    return new Response(svg,{headers:{"Content-Type":"image/svg+xml","Content-Disposition":`attachment; filename="mylux-partner-${affiliate.affiliate_code}.svg"`,"Cache-Control":"private, no-store"}});
  }catch(error){return safeError(error)}
}
