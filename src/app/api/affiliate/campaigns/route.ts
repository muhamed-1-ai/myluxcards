import { cleanText, requireApprovedAffiliate, safeDestination } from "@/lib/affiliate";
import { safeError, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { affiliate } = await requireApprovedAffiliate();
  if (!affiliate) return Response.json({ message: "Only approved affiliates can create links." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const name = cleanText(body.name, 80);
    const source = cleanText(body.source, 80).replace(/[^a-zA-Z0-9 _.-]/g, "");
    const destination = safeDestination(body.destinationPath);
    if (name.length < 2) return Response.json({ message: "Enter a campaign name." }, { status: 400 });
    
    const campaign = await prisma.affiliateCampaign.create({
      data: {
        affiliateId: affiliate.id,
        name,
        source: source || null,
        destinationPath: destination,
      },
    });
    return Response.json({
      data: {
        id: campaign.id,
        affiliate_id: campaign.affiliateId,
        name: campaign.name,
        source: campaign.source,
        destination_path: campaign.destinationPath,
        active: campaign.active,
        created_at: campaign.createdAt,
        updated_at: campaign.updatedAt,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") return Response.json({ message: "Campaign names must be unique." }, { status: 409 });
    return safeError(error);
  }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { affiliate } = await requireApprovedAffiliate();
  if (!affiliate) return Response.json({ message: "Forbidden." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || typeof body.active !== "boolean") return Response.json({ message: "Invalid campaign." }, { status: 400 });
    
    const existing = await prisma.affiliateCampaign.findFirst({
      where: { id: body.id, affiliateId: affiliate.id },
    });
    if (!existing) return Response.json({ message: "Campaign not found." }, { status: 404 });

    const updated = await prisma.affiliateCampaign.update({
      where: { id: body.id },
      data: { active: body.active },
    });

    return Response.json({
      data: {
        id: updated.id,
        affiliate_id: updated.affiliateId,
        name: updated.name,
        source: updated.source,
        destination_path: updated.destinationPath,
        active: updated.active,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      },
    });
  } catch (error) { return safeError(error); }
}
