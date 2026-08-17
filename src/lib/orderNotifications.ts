import { prisma } from "./db/prisma";

type OrderNotification = {
  eventKey: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; quantity: number }>;
  totalMinor: number;
  currency: string;
  paymentStatus: string;
  shippingLocation: string;
};

/** Call only after a server-side checkout or verified provider webhook has persisted the order. */
export async function notifySuperAdminsOfOrder(order: OrderNotification) {
  const recipient = process.env.SUPER_ADMIN_NOTIFICATION_EMAIL?.trim();
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const title = `New order ${order.orderNumber}`;
  const message = `${order.customerName} placed ${order.items.length} item line(s) for ${order.currency} ${(order.totalMinor / 100).toFixed(2)}.`;

  try {
    await prisma.adminNotification.create({
      data: {
        eventKey: order.eventKey,
        type: "NEW_ORDER",
        title,
        message,
        orderId: order.orderId,
        emailRecipient: recipient || null,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") return { duplicate: true };
    throw error;
  }

  if (!recipient || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !appUrl) {
    return { created: true, email: "not-configured" as const };
  }

  const safeOrderUrl = `${appUrl}/admin?section=orders&order=${encodeURIComponent(order.orderId)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": order.eventKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [recipient],
      subject: title,
      html: `<h1>${escapeHtml(title)}</h1>
        <p><strong>Customer:</strong> ${escapeHtml(order.customerName)} (${escapeHtml(order.customerEmail)})</p>
        <p><strong>Products:</strong> ${order.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(", ")}</p>
        <p><strong>Total:</strong> ${escapeHtml(order.currency)} ${(order.totalMinor / 100).toFixed(2)}</p>
        <p><strong>Payment:</strong> ${escapeHtml(order.paymentStatus)}</p>
        <p><strong>Shipping:</strong> ${escapeHtml(order.shippingLocation)}</p>
        <p><a href="${escapeHtml(safeOrderUrl)}">Open order securely</a></p>`,
    }),
    cache: "no-store",
  });

  await prisma.adminNotification.update({
    where: { eventKey: order.eventKey },
    data: response.ok
      ? { emailedAt: new Date(), emailError: null }
      : { emailError: `Delivery failed (${response.status})` },
  }).catch(() => null);

  if (!response.ok) throw new Error("Order notification email delivery failed.");
  return { created: true, email: "sent" as const };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}
