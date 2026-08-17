import { currentIdentity } from "@/lib/adminAuth";
import { findUserOrderInvoice } from "@/lib/repositories/orders";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]!));
const money = (minor: unknown, currency: unknown) => `${esc(currency)} ${(Number(minor || 0) / 100).toFixed(2)}`;

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await currentIdentity();
  if (!identity) return new Response("Please sign in.", { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invoice not found.", { status: 404 });
  // Scoped query: customer_id=eq.${identity.id}
  const order = await findUserOrderInvoice(id, identity.id);
  if (!order) return new Response("Invoice not found.", { status: 404 });
  const address = order.shipping_address || {};
  const rows = (order.order_items || []).map((item: any) => `<tr><td>${esc(item.product_name)}</td><td>${esc(item.sku)}</td><td>${Number(item.quantity)}</td><td>${money(item.unit_price_minor, order.currency)}</td><td>${money(item.total_minor, order.currency)}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.order_number)}</title><style>body{font:15px Arial;color:#17130a;max-width:900px;margin:40px auto;padding:24px}h1{color:#a77d00}header{display:flex;justify-content:space-between}table{width:100%;border-collapse:collapse;margin:30px 0}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}.totals{margin-left:auto;width:320px}.totals p{display:flex;justify-content:space-between}.print{padding:10px 18px;background:#d4af37;border:0;border-radius:8px}@media print{.print{display:none}}</style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button><header><div><h1>MyLuxCards</h1><p>Order invoice</p></div><div><strong>${esc(order.order_number)}</strong><br>${esc(new Date(order.created_at).toLocaleDateString("en-IN"))}<br>Payment: ${esc(order.payment_status)}</div></header><h3>Bill to</h3><p>${esc(order.customer_name)}<br>${esc(order.customer_email)} · ${esc(order.customer_phone)}<br>${esc(address.line1)} ${esc(address.line2)}<br>${esc(address.city)}, ${esc(address.state)} ${esc(address.postalCode)}<br>${esc(address.country)}</p><table><thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><p><span>Subtotal</span><b>${money(order.subtotal_minor, order.currency)}</b></p><p><span>Discount</span><b>-${money(order.discount_minor, order.currency)}</b></p><p><span>Shipping</span><b>${money(order.shipping_minor, order.currency)}</b></p><p><span>Tax</span><b>${money(order.tax_minor, order.currency)}</b></p><p><span>Total</span><b>${money(order.total_minor, order.currency)}</b></p></div><p>This invoice reflects the current order and payment status.</p></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
