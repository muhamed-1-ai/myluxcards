import { createHmac } from "node:crypto";
import { cleanText, getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError, validMutationOrigin } from "@/lib/adminAuth";
import { notifyAffiliateAdmin } from "@/lib/affiliateNotifications";
import { prisma } from "@/lib/db/prisma";
export const runtime="nodejs";

export async function GET(){
  const{identity,affiliate}=await getAffiliateForCurrentUser();if(!identity||!affiliate||affiliate.status!=="APPROVED"||affiliate.partner_type!=="BUSINESS_PARTNER")return Response.json({message:"Forbidden"},{status:403});
  try{
    const leads = await prisma.affiliateBusinessLead.findMany({
      where: { affiliateId: affiliate.id },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return Response.json({
      data: leads.map(l => ({
        id: l.id,
        company_name: l.companyName,
        contact_person: l.contactPerson,
        business_email: l.businessEmail,
        phone: l.phone,
        estimated_quantity: l.estimatedQuantity,
        expected_purchase_date: l.expectedPurchaseDate,
        lead_source: l.leadSource,
        status: l.status,
        protection_expires_at: l.protectionExpiresAt,
        decision_reason: l.decisionReason,
        created_at: l.createdAt,
        products: l.product ? { name: l.product.name } : null,
      })),
    });
  }catch(error){return safeError(error)}
}

export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const{identity,affiliate}=await getAffiliateForCurrentUser();if(!identity||!affiliate||affiliate.status!=="APPROVED"||affiliate.partner_type!=="BUSINESS_PARTNER")return Response.json({message:"Only approved Business Partners can register leads."},{status:403});
  try{
    const body=await request.json().catch(()=>({}));const company=cleanText(body.companyName,180),contact=cleanText(body.contactPerson,140),email=cleanText(body.businessEmail,320).toLowerCase(),phone=cleanText(body.phone,30),source=cleanText(body.leadSource,100),notes=cleanText(body.notes,2000);const quantity=Number(body.estimatedQuantity);
    if(company.length<2||contact.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isSafeInteger(quantity)||quantity<1||body.consentConfirmed!==true)return Response.json({message:"Complete the legitimate business lead details and confirm consent."},{status:400});
    const normalizedCompany=company.toLowerCase().replace(/[^a-z0-9]/g,"");const emailHash=hash(email),phoneHash=phone?hash(phone.replace(/\D/g,"")):null;
    
    const duplicate = await prisma.affiliateBusinessLead.findFirst({
      where: {
        OR: [
          { emailHash },
          { normalizedCompany, phoneHash: phoneHash || "none" },
        ],
        status: { notIn: ["LOST", "EXPIRED", "REJECTED"] },
      },
      select: { id: true, affiliateId: true },
    });

    const lead = await prisma.affiliateBusinessLead.create({
      data: {
        affiliateId: affiliate.id,
        companyName: company,
        normalizedCompany,
        contactPerson: contact,
        businessEmail: email,
        emailHash,
        phone: phone || null,
        phoneHash,
        estimatedQuantity: quantity,
        productId: typeof body.productId === "string" && body.productId ? body.productId : null,
        expectedPurchaseDate: /^\d{4}-\d{2}-\d{2}$/.test(body.expectedPurchaseDate) ? new Date(body.expectedPurchaseDate) : null,
        notes: notes || null,
        consentConfirmedAt: new Date(),
        leadSource: source || null,
        status: "REGISTERED",
      },
    });

    if (duplicate) {
      await prisma.affiliateFraudFlag.create({
        data: {
          affiliateId: affiliate.id,
          risk: "MEDIUM",
          reasonCode: "DUPLICATE_BUSINESS_LEAD",
          details: { lead_id: lead.id, possible_duplicate_id: duplicate.id },
        },
      }).catch(() => null);
    }

    await notifyAffiliateAdmin(`affiliate-lead:${lead.id}`,"New Business Partner lead",`${identity.name} registered a corporate lead for ${company}.`,affiliate.id);
    return Response.json({data:{id:lead.id,status:lead.status,duplicateReview:Boolean(duplicate)}},{status:201});
  }catch(error){return safeError(error)}
}

function hash(value:string){
  const secret=process.env.AFFILIATE_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || "fallback_secret";
  return createHmac("sha256",secret).update(value).digest("hex");
}
