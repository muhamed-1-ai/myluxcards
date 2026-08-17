import { getAffiliateForCurrentUser } from "@/lib/affiliate";
import { safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";
export const runtime="nodejs";

export async function GET(){
  const{identity,affiliate}=await getAffiliateForCurrentUser();if(!identity||!affiliate)return Response.json({message:"Forbidden"},{status:403});
  try{
    const commissions = await prisma.affiliateCommission.findMany({
      where: { affiliateId: affiliate.id },
      include: {
        order: {
          select: { orderNumber: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const rows = [
      ["order_reference","order_date","order_status","commissionable_minor","commission_type","commission_value","commission_minor","currency","commission_status","source","campaign","risk"],
      ...commissions.map(x => [
        x.order?.orderNumber,
        x.order?.createdAt,
        x.order?.status,
        Number(x.commissionableMinor),
        x.commissionType,
        x.commissionValue,
        Number(x.commissionMinor),
        x.currency,
        x.status,
        x.referralSource,
        x.campaign,
        x.risk,
      ]),
    ];
    return new Response(rows.map((r:any[])=>r.map(csv).join(",")).join("\r\n"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="my-affiliate-report-${new Date().toISOString().slice(0,10)}.csv"`}});
  }catch(error){return safeError(error)}
}
function csv(value:unknown){return`"${String(value??"").replace(/"/g,'""')}"`}
