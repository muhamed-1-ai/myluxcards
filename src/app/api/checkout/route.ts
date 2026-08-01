import { randomBytes } from "node:crypto";
import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { resolveAffiliateAttribution } from "@/lib/affiliate";
import { notifySuperAdminsOfOrder } from "@/lib/orderNotifications";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

const CATALOG: Record<string,{name:string;type:"NFC_CARD";sku:string;priceMinor:number}> = {
  "nfc-card": { name:"Premium NFC Card", type:"NFC_CARD", sku:"MLC-NFC-PREMIUM", priceMinor:149900 },
  "custom-nfc-card": { name:"Custom NFC Card", type:"NFC_CARD", sku:"MLC-NFC-CUSTOM", priceMinor:149900 },
};
const methods = new Set(["UPI","Card","Net Banking","Cash on Delivery"]);
const clean=(value:unknown,max=200)=>String(value||"").trim().slice(0,max);
type CheckoutItem={id:string;name:string;type:"NFC_CARD";sku:string;priceMinor:number;quantity:number;variant:Record<string,unknown>};

export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const identity=await currentIdentity();
  if(!identity)return Response.json({message:"Please sign in before placing your order."},{status:401});
  let orderId="";
  try{
    const body=await request.json().catch(()=>({}));
    const customer=body.customer||{}, address=body.shippingAddress||{};
    const name=clean(customer.name,120), email=clean(customer.email,254).toLowerCase(), phone=clean(customer.phone,30);
    if(name.length<2||email!==identity.email.toLowerCase()||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7)return Response.json({message:"Enter the signed-in customer's valid name, email, and phone number."},{status:400});
    const shippingAddress={line1:clean(address.line1,200),line2:clean(address.line2,200),city:clean(address.city,100),state:clean(address.state,100),postalCode:clean(address.postalCode,20),country:clean(address.country,100)};
    if(!shippingAddress.line1||!shippingAddress.city||!shippingAddress.state||!shippingAddress.postalCode||!shippingAddress.country)return Response.json({message:"Complete all required delivery-address fields."},{status:400});
    const method=clean(body.paymentMethod,40);if(!methods.has(method))return Response.json({message:"Choose a valid payment method."},{status:400});
    if(!Array.isArray(body.items)||!body.items.length||body.items.length>20)return Response.json({message:"Your cart is empty or too large."},{status:400});
    const items:CheckoutItem[]=body.items.map((input:any)=>{
      const id=clean(input.id,80), product=CATALOG[id], quantity=Math.min(10,Math.max(1,Math.floor(Number(input.quantity)||1)));
      if(!product)throw new Error("UNAVAILABLE_PRODUCT");
      const design=input.design&&typeof input.design==="object"?Object.fromEntries(Object.entries(input.design).slice(0,20).map(([key,value])=>[clean(key,40),clean(value,200)])):{};
      return {...product,id,quantity,variant:{details:clean(input.details,300),design}};
    });
    const subtotal=items.reduce((sum,item)=>sum+item.priceMinor*item.quantity,0), shipping=0, tax=0, discount=0, total=subtotal+shipping+tax-discount;
    const attribution=await resolveAffiliateAttribution(clean(body.couponCode,50)||null,email);
    const orderNumber=`MLC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const orderPayload:any={order_number:orderNumber,customer_id:identity.id,customer_name:name,customer_email:email,customer_phone:phone,status:"PENDING",payment_status:"PENDING",currency:"INR",subtotal_minor:subtotal,discount_minor:discount,tax_minor:tax,shipping_minor:shipping,total_minor:total,shipping_address:shippingAddress,billing_address:shippingAddress,internal_notes:`Checkout payment method: ${method}`};
    if(attribution){
      orderPayload.affiliate_id=attribution.affiliateId;orderPayload.affiliate_source=attribution.source;orderPayload.affiliate_coupon_code=(attribution as any).couponCode||null;orderPayload.affiliate_lead_id=(attribution as any).businessLeadId||null;orderPayload.affiliate_attributed_at=new Date().toISOString();
      if((attribution as any).campaign){const campaign=await supabaseJson(`/rest/v1/affiliate_campaigns?affiliate_id=eq.${attribution.affiliateId}&name=eq.${encodeURIComponent((attribution as any).campaign)}&select=id&limit=1`,{},true);orderPayload.affiliate_campaign_id=campaign.data?.[0]?.id||null;}
    }
    const created=await supabaseJson("/rest/v1/orders",{method:"POST",body:JSON.stringify(orderPayload)},true);orderId=created.data?.[0]?.id;
    if(!orderId)throw new Error("Order creation failed.");
    await supabaseJson("/rest/v1/order_items",{method:"POST",body:JSON.stringify(items.map(item=>({order_id:orderId,product_name:item.name,product_type:item.type,sku:item.sku,variant:item.variant,quantity:item.quantity,unit_price_minor:item.priceMinor})))},true);
    await supabaseJson("/rest/v1/payments",{method:"POST",body:JSON.stringify({order_id:orderId,provider:method.toUpperCase().replaceAll(" ","_"),provider_transaction_id:`PENDING-${orderId}`,amount_minor:total,currency:"INR",status:"PENDING"})},true);
    await notifySuperAdminsOfOrder({eventKey:`new-order:${orderId}`,orderId,orderNumber,customerName:name,customerEmail:email,items:items.map(item=>({name:item.name,quantity:item.quantity})),totalMinor:total,currency:"INR",paymentStatus:"PENDING",shippingLocation:[shippingAddress.city,shippingAddress.state,shippingAddress.country].join(", ")}).catch(()=>null);
    return Response.json({ok:true,orderId,orderNumber,totalMinor:total,currency:"INR"},{status:201});
  }catch(error:any){
    if(orderId)await supabaseJson(`/rest/v1/orders?id=eq.${orderId}`,{method:"DELETE"},true).catch(()=>null);
    if(error?.message==="UNAVAILABLE_PRODUCT")return Response.json({message:"One of the products is unavailable. Remove it and try again."},{status:400});
    return safeError(error);
  }
}
