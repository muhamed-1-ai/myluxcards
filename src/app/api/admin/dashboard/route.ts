import { requireAdmin, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db/core";

export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });

  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const statusNames = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

    const [
      ordersRes,
      todayOrdersRes,
      customersRes,
      newCustomersRes,
      productsRes,
      lowStockRes,
      failedPaymentsRes,
      unreadNotificationsRes,
      recentRes,
      revenueRes,
      statusCountsRes,
    ] = await Promise.all([
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM orders"),
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM orders WHERE created_at >= $1", [today.toISOString()]),
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM users WHERE role = 'CUSTOMER'"),
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM users WHERE role = 'CUSTOMER' AND created_at >= $1", [month.toISOString()]),
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM products WHERE archived_at IS NULL"),
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM products WHERE stock <= 5 AND archived_at IS NULL"),
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM payments WHERE status = 'FAILED'"),
      pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM admin_notifications WHERE read_at IS NULL"),
      pool.query(`SELECT id, COALESCE(order_number, number) as order_number, customer_name, customer_email, status, payment_status, total_minor, currency, created_at FROM orders ORDER BY created_at DESC LIMIT 8`),
      pool.query(`SELECT total_minor, currency, created_at, status, payment_status FROM orders WHERE payment_status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED') ORDER BY created_at ASC LIMIT 5000`),
      Promise.all(statusNames.map(status => pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM orders WHERE status = $1", [status]))),
    ]);

    const orders = Number(ordersRes.rows[0]?.count || 0);
    const todayOrders = Number(todayOrdersRes.rows[0]?.count || 0);
    const customers = Number(customersRes.rows[0]?.count || 0);
    const newCustomers = Number(newCustomersRes.rows[0]?.count || 0);
    const products = Number(productsRes.rows[0]?.count || 0);
    const lowStock = Number(lowStockRes.rows[0]?.count || 0);
    const failedPayments = Number(failedPaymentsRes.rows[0]?.count || 0);
    const unreadNotifications = Number(unreadNotificationsRes.rows[0]?.count || 0);
    const statuses = statusCountsRes.map(res => Number(res.rows[0]?.count || 0));

    const revenueRows = revenueRes.rows || [];
    const revenueMonth = revenueRows
      .filter((row: any) => new Date(row.created_at) >= month)
      .reduce((sum: number, row: any) => sum + (row.total_minor || 0), 0);
    const revenueToday = revenueRows
      .filter((row: any) => new Date(row.created_at) >= today)
      .reduce((sum: number, row: any) => sum + (row.total_minor || 0), 0);

    return Response.json({
      stats: {
        orders,
        todayOrders,
        customers,
        newCustomers,
        products,
        lowStock,
        failedPayments,
        unreadNotifications,
        revenueTotal: revenueRows.reduce((sum: number, row: any) => sum + (row.total_minor || 0), 0),
        revenueMonth,
        revenueToday,
        ...Object.fromEntries(statusNames.map((name, index) => [name.toLowerCase(), statuses[index]])),
      },
      charts: {
        orderStatus: statusNames.map((name, index) => ({ label: name, value: statuses[index] })),
        revenueByDay: Object.values(
          revenueRows.reduce((groups: Record<string, { label: string; value: number }>, row: any) => {
            const key = new Date(row.created_at).toISOString().slice(0, 10);
            groups[key] ||= { label: key, value: 0 };
            groups[key].value += row.total_minor || 0;
            return groups;
          }, {})
        ).slice(-30),
      },
      recentOrders: recentRes.rows,
      currency: revenueRows[0]?.currency || "INR",
    });
  } catch (error) {
    return safeError(error);
  }
}
