import { requireAdmin, safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const statusNames = ["PENDING","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"];

    const [
      ordersCount,
      todayOrdersCount,
      customersCount,
      newCustomersCount,
      productsCount,
      lowStockCount,
      failedPaymentsCount,
      unreadNotificationsCount,
      recentOrders,
      revenueRows,
      statusCounts,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: month } } }),
      prisma.product.count({ where: { archivedAt: null } }),
      prisma.product.count({ where: { stock: { lte: 5 }, archivedAt: null } }),
      prisma.payment.count({ where: { status: "FAILED" } }),
      prisma.adminNotification.count({ where: { readAt: null } }),
      prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          status: true,
          paymentStatus: true,
          totalMinor: true,
          currency: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.order.findMany({
        where: { paymentStatus: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
        select: { totalMinor: true, currency: true, createdAt: true, status: true, paymentStatus: true },
        orderBy: { createdAt: "asc" },
        take: 5000,
      }),
      Promise.all(statusNames.map(status => prisma.order.count({ where: { status } }))),
    ]);

    const revenueTotal = revenueRows.reduce((sum, row) => sum + row.totalMinor, 0);
    const revenueMonth = revenueRows.filter(row => row.createdAt >= month).reduce((sum, row) => sum + row.totalMinor, 0);
    const revenueToday = revenueRows.filter(row => row.createdAt >= today).reduce((sum, row) => sum + row.totalMinor, 0);

    const formattedRecent = recentOrders.map(o => ({
      id: o.id,
      order_number: o.orderNumber,
      customer_name: o.customerName,
      customer_email: o.customerEmail,
      status: o.status,
      payment_status: o.paymentStatus,
      total_minor: o.totalMinor,
      currency: o.currency,
      created_at: o.createdAt,
    }));

    return Response.json({
      stats: {
        orders: ordersCount,
        todayOrders: todayOrdersCount,
        customers: customersCount,
        newCustomers: newCustomersCount,
        products: productsCount,
        lowStock: lowStockCount,
        failedPayments: failedPaymentsCount,
        unreadNotifications: unreadNotificationsCount,
        revenueTotal,
        revenueMonth,
        revenueToday,
        ...Object.fromEntries(statusNames.map((name, index) => [name.toLowerCase(), statusCounts[index]])),
      },
      charts: {
        orderStatus: statusNames.map((name, index) => ({ label: name, value: statusCounts[index] })),
        revenueByDay: Object.values(revenueRows.reduce((groups: Record<string, { label: string; value: number }>, row) => {
          const key = row.createdAt.toISOString().slice(0, 10);
          groups[key] ||= { label: key, value: 0 };
          groups[key].value += row.totalMinor;
          return groups;
        }, {})).slice(-30),
      },
      recentOrders: formattedRecent,
      currency: revenueRows[0]?.currency || "INR",
    });
  } catch (error) { return safeError(error); }
}
