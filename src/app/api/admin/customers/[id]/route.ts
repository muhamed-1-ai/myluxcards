import { requireAdmin, safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Customer not found." }, { status: 404 });
  try {
    // id=eq.${id}&role=eq.CUSTOMER
    const user = await prisma.user.findFirst({
      where: { id, role: "CUSTOMER" },
      include: { profile: true },
    });
    if (!user) return Response.json({ message: "Customer not found." }, { status: 404 });

    // owner_id=eq.${id}
    const cards = await prisma.digitalCard.findMany({
      where: { ownerId: id },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    // customer_id=eq.${id}
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      include: { orderItems: { select: { productName: true, quantity: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const support = await prisma.supportTicket.findMany({
      where: { customerEmail: user.email },
      select: { id: true, reference: true, topic: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { userId: id },
      select: { id: true, affiliateCode: true, couponCode: true, partnerType: true, status: true, createdAt: true },
    });

    const customerData = {
      id: user.id,
      email: user.email,
      name: user.name || "",
      phone: user.profile?.phone || null,
      role: user.role,
      status: user.status,
      disabled: user.disabled,
      must_change_password: user.mustChangePassword,
      internal_notes: user.profile?.internalNotes || null,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };

    const cardsData = cards.map(c => ({
      id: c.id,
      slug: c.slug,
      profile: c.profile,
      active: c.active,
      activated_at: c.activatedAt,
      expires_at: c.expiresAt,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    }));

    const ordersData = orders.map(o => ({
      id: o.id,
      order_number: o.orderNumber,
      status: o.status,
      payment_status: o.paymentStatus,
      currency: o.currency,
      total_minor: o.totalMinor,
      created_at: o.createdAt,
      order_items: o.orderItems.map(i => ({ product_name: i.productName, quantity: i.quantity })),
    }));

    const affiliateData = affiliate ? {
      id: affiliate.id,
      affiliate_code: affiliate.affiliateCode,
      coupon_code: affiliate.couponCode,
      partner_type: affiliate.partnerType,
      status: affiliate.status,
      created_at: affiliate.createdAt,
    } : null;

    return Response.json({
      customer: customerData,
      cards: cardsData,
      orders: ordersData,
      support,
      affiliate: affiliateData,
    });
  } catch (error) { return safeError(error); }
}
