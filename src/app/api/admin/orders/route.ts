import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";
import { syncCommissionForTrustedOrder } from "@/lib/affiliate";
import { sendOrderStatus } from "@/lib/customerEmails";

export const runtime = "nodejs";
const statuses = new Set(["PENDING","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"]);
const paymentStatuses = new Set(["PENDING","SUCCEEDED","FAILED","PARTIALLY_REFUNDED","REFUNDED"]);
const productTypes = new Set(["NFC_CARD","QR_LOST_FOUND","ACCESSORY","OTHER"]);

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize")) || 20));
    const search = url.searchParams.get("search")?.trim().slice(0, 100);
    const status = url.searchParams.get("status");
    const paymentStatus = url.searchParams.get("paymentStatus");
    const productType = url.searchParams.get("productType");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    
    const where: any = {};
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status && statuses.has(status)) where.status = status;
    if (paymentStatus && paymentStatuses.has(paymentStatus)) where.paymentStatus = paymentStatus;
    if (productType && productTypes.has(productType)) {
      where.orderItems = { some: { productType } };
    }
    if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(`${fromDate}T00:00:00.000Z`) };
    }
    if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(`${toDate}T23:59:59.999Z`) };
    }

    const orderBy: any = url.searchParams.get("sort") === "oldest"
      ? { createdAt: "asc" }
      : url.searchParams.get("sort") === "total"
        ? { totalMinor: "desc" }
        : { createdAt: "desc" };

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          orderItems: {
            select: {
              id: true,
              productName: true,
              productType: true,
              sku: true,
              variant: true,
              quantity: true,
              unitPriceMinor: true,
              totalMinor: true,
            },
          },
          payments: {
            select: {
              provider: true,
              status: true,
              providerPaymentId: true,
            },
          },
        },
      }),
    ]);

    const formatted = orders.map(o => ({
      id: o.id,
      order_number: o.orderNumber,
      customer_name: o.customerName,
      customer_email: o.customerEmail,
      customer_phone: o.customerPhone,
      status: o.status,
      payment_status: o.paymentStatus,
      currency: o.currency,
      subtotal_minor: o.subtotalMinor,
      discount_minor: o.discountMinor,
      tax_minor: o.taxMinor,
      shipping_minor: o.shippingMinor,
      total_minor: o.totalMinor,
      shipping_address: o.shippingAddress,
      billing_address: o.billingAddress,
      courier: o.courier,
      tracking_number: o.trackingNumber,
      internal_notes: o.internalNotes,
      created_at: o.createdAt,
      order_items: o.orderItems.map(i => ({
        id: i.id,
        product_name: i.productName,
        product_type: i.productType,
        sku: i.sku,
        variant: i.variant,
        quantity: i.quantity,
        unit_price_minor: i.unitPriceMinor,
        total_minor: i.totalMinor,
      })),
      payments: o.payments.map(p => ({
        provider: p.provider,
        status: p.status,
        provider_transaction_id: p.providerPaymentId,
      })),
    }));

    return Response.json({ data: formatted, total, page, pageSize });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid order." }, { status: 400 });
    const updateData: any = {};
    if (typeof body.status === "string" && statuses.has(body.status)) updateData.status = body.status;
    if (typeof body.courier === "string") updateData.courier = body.courier.trim().slice(0, 100) || null;
    if (typeof body.trackingNumber === "string") updateData.trackingNumber = body.trackingNumber.trim().slice(0, 150) || null;
    if (typeof body.internalNotes === "string") updateData.internalNotes = body.internalNotes.trim().slice(0, 5000) || null;
    if (!Object.keys(updateData).length) return Response.json({ message: "No valid changes." }, { status: 400 });
    
    const before = await prisma.order.findUnique({
      where: { id: body.id },
      select: { id: true, orderNumber: true, customerName: true, customerEmail: true, status: true, courier: true, trackingNumber: true },
    });
    if (!before) return Response.json({ message: "Order not found." }, { status: 404 });

    const updated = await prisma.order.update({
      where: { id: body.id },
      data: updateData,
    });

    await syncCommissionForTrustedOrder(body.id);
    await audit(actor, "ORDER_UPDATED", "order", body.id, before, updateData);
    
    if (updateData.status && updateData.status !== before.status) {
      await sendOrderStatus({
        id: body.id,
        number: before.orderNumber,
        name: before.customerName,
        email: before.customerEmail,
        status: updateData.status,
        courier: updateData.courier ?? before.courier,
        tracking: updateData.trackingNumber ?? before.trackingNumber,
      }).catch(() => false);
    }
    
    return Response.json({
      data: {
        id: updated.id,
        order_number: updated.orderNumber,
        status: updated.status,
        courier: updated.courier,
        tracking_number: updated.trackingNumber,
        internal_notes: updated.internalNotes,
      },
    });
  } catch (error) { return safeError(error); }
}
