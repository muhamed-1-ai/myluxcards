import { requireAdmin, safeError } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

async function count(path: string) {
  const { response } = await supabaseJson(path, { headers: { Prefer: "count=exact", Range: "0-0" } }, true);
  return Number(response.headers.get("content-range")?.split("/")[1] || 0);
}

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const statusNames = ["PENDING","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"];
    const [orders, todayOrders, customers, newCustomers, products, lowStock, failedPayments, unreadNotifications, recent, revenue, statuses] = await Promise.all([
      count("/rest/v1/orders?select=id"),
      count(`/rest/v1/orders?select=id&created_at=gte.${today.toISOString()}`),
      count("/rest/v1/profiles?select=id&role=eq.CUSTOMER"),
      count(`/rest/v1/profiles?select=id&role=eq.CUSTOMER&created_at=gte.${month.toISOString()}`),
      count("/rest/v1/products?select=id&archived_at=is.null"),
      count("/rest/v1/products?select=id&stock=lte.5&archived_at=is.null"),
      count("/rest/v1/payments?select=id&status=eq.FAILED"),
      count("/rest/v1/admin_notifications?select=id&read_at=is.null"),
      supabaseJson("/rest/v1/orders?select=id,order_number,customer_name,customer_email,status,payment_status,total_minor,currency,created_at&order=created_at.desc&limit=8", {}, true),
      supabaseJson("/rest/v1/orders?select=total_minor,currency,created_at,status,payment_status&payment_status=in.(SUCCEEDED,PARTIALLY_REFUNDED,REFUNDED)&order=created_at.asc&limit=5000", {}, true),
      Promise.all(statusNames.map(status => count(`/rest/v1/orders?select=id&status=eq.${status}`))),
    ]);
    const revenueRows = revenue.data || [];
    const revenueMonth = revenueRows.filter((row: { created_at: string }) => row.created_at >= month.toISOString())
      .reduce((sum: number, row: { total_minor: number }) => sum + row.total_minor, 0);
    const revenueToday = revenueRows.filter((row: { created_at: string }) => row.created_at >= today.toISOString())
      .reduce((sum: number, row: { total_minor: number }) => sum + row.total_minor, 0);
    return Response.json({
      stats: {
        orders, todayOrders, customers, newCustomers, products, lowStock, failedPayments,
        unreadNotifications, revenueTotal: revenueRows.reduce((sum: number, row: { total_minor: number }) => sum + row.total_minor, 0),
        revenueMonth, revenueToday,
        ...Object.fromEntries(statusNames.map((name, index) => [name.toLowerCase(), statuses[index]])),
      },
      charts: {
        orderStatus: statusNames.map((name, index) => ({ label: name, value: statuses[index] })),
        revenueByDay: Object.values(revenueRows.reduce((groups: Record<string, { label: string; value: number }>, row: { created_at: string; total_minor: number }) => {
          const key = row.created_at.slice(0, 10);
          groups[key] ||= { label: key, value: 0 };
          groups[key].value += row.total_minor;
          return groups;
        }, {})).slice(-30),
      },
      recentOrders: recent.data, currency: revenueRows[0]?.currency || "INR",
    });
  } catch (error) { return safeError(error); }
}
