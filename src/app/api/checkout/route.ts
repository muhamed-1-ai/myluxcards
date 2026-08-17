import { randomBytes } from "node:crypto";
import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { resolveAffiliateAttribution } from "@/lib/affiliate";
import { notifySuperAdminsOfOrder } from "@/lib/orderNotifications";
import { createRazorpayOrder } from "@/lib/razorpay";
import { sendOrderConfirmation } from "@/lib/customerEmails";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const CATALOG: Record<string,{name:string;type:"NFC_CARD";sku:string;priceMinor:number}> = {
  "nfc-card": { name:"Premium NFC Card", type:"NFC_CARD", sku:"MLC-NFC-PREMIUM", priceMinor:149900 },
  "custom-nfc-card": { name:"Custom NFC Card", type:"NFC_CARD", sku:"MLC-NFC-CUSTOM", priceMinor:149900 },
};
const methods = new Set(["UPI","Card","Net Banking","Cash on Delivery"]);
const clean=(value:unknown,max=200)=>String(value||"").trim().slice(0,max);
const cleanOrderLogo=(value:unknown)=>{
  const text=String(value||"").trim();
  return /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=\r\n]+$/i.test(text)&&text.length<=3_000_000?text:"";
};
type CheckoutItem={id:string;name:string;type:"NFC_CARD";sku:string;priceMinor:number;quantity:number;variant:Record<string,unknown>};
const customMaterialPrices:Record<string,number>={"White PVC":79900,"Matte Black PVC":89900};

export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const identity=await currentIdentity();
  if(!identity)return Response.json({message:"Please sign in before placing your order."},{status:401});
  try{
    const body=await request.json().catch(()=>({}));
    const customer=body.customer||{}, address=body.shippingAddress||{};
    const name=clean(customer.name,120), jobTitle=clean(customer.jobTitle,100), email=clean(customer.email,254).toLowerCase(), phone=clean(customer.phone,30);
    if(name.length<2||email!==identity.email.toLowerCase()||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7)return Response.json({message:"Enter the signed-in customer's valid name, email, and phone number."},{status:400});
    const shippingAddress={jobTitle,line1:clean(address.line1,200),line2:clean(address.line2,200),city:clean(address.city,100),state:clean(address.state,100),postalCode:clean(address.postalCode,20),country:clean(address.country,100)};
    if(!shippingAddress.line1||!shippingAddress.city||!shippingAddress.state||!shippingAddress.postalCode||!shippingAddress.country)return Response.json({message:"Complete all required delivery-address fields."},{status:400});
    const method=clean(body.paymentMethod,40);if(!methods.has(method))return Response.json({message:"Choose a valid payment method."},{status:400});
    if(!Array.isArray(body.items)||!body.items.length||body.items.length>20)return Response.json({message:"Your cart is empty or too large."},{status:400});
    const items:CheckoutItem[]=body.items.map((input:any)=>{
      const id=clean(input.id,80), product=CATALOG[id], quantity=Math.min(10,Math.max(1,Math.floor(Number(input.quantity)||1)));
      if(!product)throw new Error("UNAVAILABLE_PRODUCT");
      const design=input.design&&typeof input.design==="object"?Object.fromEntries(Object.entries(input.design).slice(0,20).map(([key,value])=>[clean(key,40),key==="logoData"?cleanOrderLogo(value):clean(value,200)])):{};
      const material=clean(input.design?.material,80);
      const priceMinor=id==="custom-nfc-card"?(customMaterialPrices[material]+49900+(input.design?.expertDesign===true?49900:0)):product.priceMinor;
      if(!Number.isSafeInteger(priceMinor))throw new Error("UNAVAILABLE_PRODUCT");
      return {...product,id,priceMinor,quantity,variant:{details:clean(input.details,300),design:{...design,expertDesign:input.design?.expertDesign===true}}};
    });
    const subtotal=items.reduce((sum,item)=>sum+item.priceMinor*item.quantity,0), shipping=0, tax=0, discount=0, total=subtotal+shipping+tax-discount;
    const attribution=await resolveAffiliateAttribution(clean(body.couponCode,50)||null,email);
    const orderNumber=`MLC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    
    let affiliateCampaignId: string | null = null;
    if(attribution && (attribution as any).campaign){
      const campaign = await prisma.affiliateCampaign.findFirst({
        where: { affiliateId: attribution.affiliateId, name: (attribution as any).campaign },
        select: { id: true },
      });
      affiliateCampaignId = campaign?.id || null;
    }

    const { orderId, paymentCheckout } = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: identity.id,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          status: "PENDING",
          paymentStatus: "PENDING",
          currency: "INR",
          subtotalMinor: subtotal,
          discountMinor: discount,
          taxMinor: tax,
          shippingMinor: shipping,
          totalMinor: total,
          shippingAddress: shippingAddress as any,
          billingAddress: shippingAddress as any,
          internalNotes: `Checkout payment method: ${method}`,
          affiliateId: attribution?.affiliateId || null,
          affiliateSource: attribution?.source || null,
          affiliateCouponCode: (attribution as any)?.couponCode || null,
          affiliateLeadId: (attribution as any)?.businessLeadId || null,
          affiliateAttributedAt: attribution ? new Date() : null,
          affiliateCampaignId,
        },
      });

      await tx.orderItem.createMany({
        data: items.map(item => ({
          orderId: order.id,
          productName: item.name,
          productType: item.type,
          sku: item.sku,
          variant: item.variant as any,
          quantity: item.quantity,
          unitPriceMinor: item.priceMinor,
          totalMinor: item.quantity * item.priceMinor,
        })),
      });

      let checkoutInfo: null | { provider: "RAZORPAY"; keyId: string; providerOrderId: string } = null;
      if (method === "Cash on Delivery") {
        await tx.payment.create({
          data: {
            orderId: order.id,
            provider: "CASH_ON_DELIVERY",
            providerOrderId: `COD-${order.id}`,
            idempotencyKey: `COD-${order.id}`,
            amountMinor: total,
            currency: "INR",
            status: "PENDING",
          },
        });
      } else {
        const providerOrder = await createRazorpayOrder({ amount: total, currency: "INR", receipt: orderNumber, orderId: order.id });
        await tx.payment.create({
          data: {
            orderId: order.id,
            provider: "RAZORPAY",
            providerOrderId: providerOrder.id,
            providerPaymentId: providerOrder.id,
            idempotencyKey: providerOrder.id,
            amountMinor: total,
            currency: "INR",
            status: "PENDING",
            providerCreatedAt: new Date(),
          },
        });
        checkoutInfo = { provider: "RAZORPAY", keyId: providerOrder.keyId, providerOrderId: providerOrder.id };
      }
      return { orderId: order.id, paymentCheckout: checkoutInfo };
    });

    await notifySuperAdminsOfOrder({eventKey:`new-order:${orderId}`,orderId,orderNumber,customerName:name,customerEmail:email,items:items.map(item=>({name:item.name,quantity:item.quantity})),totalMinor:total,currency:"INR",paymentStatus:"PENDING",shippingLocation:[shippingAddress.city,shippingAddress.state,shippingAddress.country].join(", ")}).catch(()=>null);
    await sendOrderConfirmation({id:orderId,number:orderNumber,name,email,totalMinor:total,currency:"INR",paymentStatus:"PENDING"}).catch(()=>false);
    return Response.json({ok:true,orderId,orderNumber,totalMinor:total,currency:"INR",paymentCheckout},{status:201});
  }catch(error:any){
    if(error?.message==="UNAVAILABLE_PRODUCT")return Response.json({message:"One of the products is unavailable. Remove it and try again."},{status:400});
    if(error?.message==="PAYMENTS_NOT_CONFIGURED")return Response.json({message:"Online payment is temporarily unavailable. Choose cash on delivery or contact support."},{status:503});
    return safeError(error);
  }
}
