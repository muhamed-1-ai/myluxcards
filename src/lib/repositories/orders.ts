import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";
import type { OrderRow } from "@/types/database";

export async function findOrderById(id: string, db?: Queryable): Promise<OrderRow | null> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<OrderRow>("select * from orders where id=$1", [id]);
    return res.rows[0] ?? null;
  }
  const order = await prisma.order.findUnique({
    where: { id },
  });
  if (!order) return null;
  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_id: order.customerId,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    customer_phone: order.customerPhone,
    status: order.status,
    payment_status: order.paymentStatus,
    currency: order.currency,
    subtotal_minor: order.subtotalMinor,
    discount_minor: order.discountMinor,
    tax_minor: order.taxMinor,
    shipping_minor: order.shippingMinor,
    total_minor: order.totalMinor,
    shipping_address: order.shippingAddress as Record<string, unknown>,
    billing_address: order.billingAddress as Record<string, unknown>,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  } as OrderRow;
}

export async function listUserOrders(userId: string, db?: Queryable): Promise<any[]> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<OrderRow>("select * from orders where customer_id=$1 order by created_at desc limit 100", [userId]);
    return res.rows;
  }
  const orders = await prisma.order.findMany({
    where: { customerId: userId },
    include: {
      orderItems: {
        select: {
          id: true,
          productName: true,
          sku: true,
          quantity: true,
          unitPriceMinor: true,
          totalMinor: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return orders.map(order => ({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    payment_status: order.paymentStatus,
    currency: order.currency,
    subtotal_minor: order.subtotalMinor,
    discount_minor: order.discountMinor,
    tax_minor: order.taxMinor,
    shipping_minor: order.shippingMinor,
    total_minor: order.totalMinor,
    shipping_address: order.shippingAddress,
    courier: order.courier,
    tracking_number: order.trackingNumber,
    created_at: order.createdAt,
    order_items: order.orderItems.map(item => ({
      id: item.id,
      product_name: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unit_price_minor: item.unitPriceMinor,
      total_minor: item.totalMinor,
    })),
  }));
}

export async function findUserOrderInvoice(id: string, customerId: string): Promise<any | null> {
  const order = await prisma.order.findFirst({
    where: { id, customerId },
    include: {
      orderItems: {
        select: {
          productName: true,
          sku: true,
          quantity: true,
          unitPriceMinor: true,
          totalMinor: true,
        },
      },
    },
  });
  if (!order) return null;
  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    customer_phone: order.customerPhone,
    status: order.status,
    payment_status: order.paymentStatus,
    currency: order.currency,
    subtotal_minor: order.subtotalMinor,
    discount_minor: order.discountMinor,
    tax_minor: order.taxMinor,
    shipping_minor: order.shippingMinor,
    total_minor: order.totalMinor,
    shipping_address: order.shippingAddress,
    created_at: order.createdAt,
    order_items: order.orderItems.map(item => ({
      product_name: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unit_price_minor: item.unitPriceMinor,
      total_minor: item.totalMinor,
    })),
  };
}
