import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { cleanText } from "@/lib/affiliate";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
const statuses = new Set(["UNDER_REVIEW","QUALIFIED","CONTACTED","QUOTATION_SENT","NEGOTIATION","WON","LOST","EXPIRED","REJECTED"]);

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const leads = await prisma.affiliateBusinessLead.findMany({
      select: {
        id: true,
        affiliateId: true,
        companyName: true,
        contactPerson: true,
        businessEmail: true,
        phone: true,
        estimatedQuantity: true,
        notes: true,
        productId: true,
        status: true,
        protectionExpiresAt: true,
        decisionReason: true,
        reviewedBy: true,
        createdAt: true,
        updatedAt: true,
        affiliate: { select: { affiliateCode: true, displayName: true } },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const data = leads.map(l => ({
      id: l.id,
      affiliate_id: l.affiliateId,
      company_name: l.companyName,
      contact_name: l.contactPerson,
      contact_email: l.businessEmail,
      contact_phone: l.phone,
      estimated_quantity: l.estimatedQuantity,
      notes: l.notes,
      product_id: l.productId,
      status: l.status,
      protection_expires_at: l.protectionExpiresAt,
      decision_reason: l.decisionReason,
      reviewed_by: l.reviewedBy,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
      affiliate_profiles: l.affiliate ? { affiliate_code: l.affiliate.affiliateCode, display_name: l.affiliate.displayName } : null,
      products: l.product ? { name: l.product.name } : null,
    }));

    return Response.json({ data });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || !statuses.has(body.status)) return Response.json({ message: "Invalid lead action." }, { status: 400 });
    if (["LOST", "REJECTED"].includes(body.status) && cleanText(body.reason, 1000).length < 3) return Response.json({ message: "A decision reason is required." }, { status: 400 });

    const before = await prisma.affiliateBusinessLead.findUnique({ where: { id: body.id } });
    if (!before) return Response.json({ message: "Lead not found." }, { status: 404 });

    const settings = await prisma.affiliateSetting.findUnique({ where: { id: true }, select: { businessLeadProtectionDays: true } });
    const updateData: any = {
      status: body.status,
      reviewedBy: actor.id,
      decisionReason: cleanText(body.reason, 1000) || null,
    };

    if (body.status === "QUALIFIED") {
      const protectionDays = settings?.businessLeadProtectionDays || 90;
      updateData.protectionExpiresAt = new Date(Date.now() + protectionDays * 86400000);
    }

    await prisma.affiliateBusinessLead.update({
      where: { id: body.id },
      data: updateData,
    });

    await audit(actor, `AFFILIATE_LEAD_${body.status}`, "affiliate_business_lead", body.id, before, updateData);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
