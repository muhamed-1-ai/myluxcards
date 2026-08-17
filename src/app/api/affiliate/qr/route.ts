import QRCode from "qrcode";
import { cleanText, requireApprovedAffiliate, safeDestination } from "@/lib/affiliate";
import { safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";
export const runtime="nodejs";

const buildGoldQrSvg = (text: string, colors: { dark: string; light: string }) => {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const moduleSize = 8;
  const margin = 16;
  const totalSize = size * moduleSize + margin * 2;
  const rects: string[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.data[y * size + x]) {
        const px = margin + x * moduleSize;
        const py = margin + y * moduleSize;
        rects.push(
          `<rect x="${px}" y="${py}" width="${moduleSize}" height="${moduleSize}" rx="${moduleSize / 2}" ry="${moduleSize / 2}" />`
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">` +
    `<rect width="100%" height="100%" fill="${colors.light}"/>` +
    `<rect x="${margin - 1}" y="${margin - 1}" width="${size * moduleSize + 2}" height="${size * moduleSize + 2}" rx="16" fill="none" stroke="${colors.dark}" stroke-width="2"/>` +
    `<g fill="${colors.dark}">` +
    rects.join("") +
    `</g>` +
    `</svg>`;
};

export async function GET(request:Request){
  const{affiliate}=await requireApprovedAffiliate();if(!affiliate)return Response.json({message:"Forbidden"},{status:403});
  try{
    const appUrl=process.env.APP_URL?.replace(/\/$/,"");if(!appUrl)return Response.json({message:"APP_URL is not configured."},{status:503});
    const url=new URL(request.url);const destination=safeDestination(url.searchParams.get("destination"));const campaign=cleanText(url.searchParams.get("campaign"),80).replace(/[^a-zA-Z0-9 _.-]/g,"");const source=cleanText(url.searchParams.get("source"),80).replace(/[^a-zA-Z0-9 _.-]/g,"");
    if(campaign){const active=await prisma.affiliateCampaign.findFirst({where:{affiliateId:affiliate.id,name:campaign,active:true},select:{id:true}});if(!active)return Response.json({message:"Campaign not found."},{status:404})}
    if(destination.startsWith("/products/")){const slug=destination.split("/")[2]?.split("?")[0]||"";const product=await prisma.product.findFirst({where:{slug,active:true,archivedAt:null},select:{id:true}});if(!product)return Response.json({message:"Product not found."},{status:404})}
    const referral=new URL(destination,appUrl as string);referral.searchParams.set("ref",affiliate.affiliate_code||"");if(campaign)referral.searchParams.set("campaign",campaign);if(source)referral.searchParams.set("source",source);
    const svg = buildGoldQrSvg(referral.toString(), { dark: "#d4af37", light: "#000000" });
    return new Response(svg,{headers:{"Content-Type":"image/svg+xml","Content-Disposition":`attachment; filename="mylux-partner-${affiliate.affiliate_code}.svg"`,"Cache-Control":"private, no-store"}});
  }catch(error){return safeError(error)}
}
