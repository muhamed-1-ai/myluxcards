import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";
export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin(true);
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const settings = await prisma.websiteSetting.findUnique({ where: { id: true } });
    if (!settings) return Response.json({ data: null });
    return Response.json({
      data: {
        id: true,
        business_name: settings.businessName,
        support_email: settings.supportEmail,
        support_phone: settings.supportPhone,
        order_notification_email: settings.orderNotificationEmail,
        currency: settings.currency,
        low_stock_threshold: settings.lowStockThreshold,
        maintenance_message: settings.maintenanceMessage,
        terms_url: settings.termsUrl,
        privacy_url: settings.privacyUrl,
        updated_by: settings.updatedBy,
        updated_at: settings.updatedAt,
      },
    });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(true);
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const updateData: any = {};
    if (typeof body.business_name === "string") updateData.businessName = body.business_name.trim().slice(0, 1000);
    if (typeof body.support_email === "string") updateData.supportEmail = body.support_email.trim().slice(0, 1000);
    if (typeof body.support_phone === "string") updateData.supportPhone = body.support_phone.trim().slice(0, 1000);
    if (typeof body.order_notification_email === "string") updateData.orderNotificationEmail = body.order_notification_email.trim().slice(0, 1000);
    if (typeof body.currency === "string") updateData.currency = body.currency.trim().toUpperCase().slice(0, 3);
    if (typeof body.low_stock_threshold === "number") updateData.lowStockThreshold = body.low_stock_threshold;
    if (typeof body.maintenance_message === "string") updateData.maintenanceMessage = body.maintenance_message.trim().slice(0, 1000);
    if (typeof body.terms_url === "string") updateData.termsUrl = body.terms_url.trim().slice(0, 1000);
    if (typeof body.privacy_url === "string") updateData.privacyUrl = body.privacy_url.trim().slice(0, 1000);

    if (updateData.lowStockThreshold !== undefined && (!Number.isInteger(updateData.lowStockThreshold) || updateData.lowStockThreshold < 0 || updateData.lowStockThreshold > 100000)) {
      return Response.json({ message: "Low-stock threshold is invalid." }, { status: 400 });
    }
    if (updateData.currency !== undefined && !/^[A-Z]{3}$/.test(updateData.currency)) {
      return Response.json({ message: "Currency must be a three-letter ISO code." }, { status: 400 });
    }

    const before = await prisma.websiteSetting.findUnique({ where: { id: true } });
    updateData.updatedBy = actor.id;

    await prisma.websiteSetting.upsert({
      where: { id: true },
      create: { id: true, ...updateData },
      update: updateData,
    });

    await audit(actor, "WEBSITE_SETTINGS_UPDATED", "website_settings", "global", before, updateData);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
