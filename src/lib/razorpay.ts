import { createHmac, timingSafeEqual } from "node:crypto";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return keyId && keySecret ? { keyId, keySecret } : null;
}

export async function createRazorpayOrder(input: { amount: number; currency: string; receipt: string; orderId: string }) {
  const config = razorpayConfig();
  if (!config) throw new Error("PAYMENTS_NOT_CONFIGURED");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: input.amount, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: { internal_order_id: input.orderId } }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id) throw new Error(data?.error?.description || "PAYMENT_PROVIDER_ERROR");
  return { id: String(data.id), keyId: config.keyId };
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string) {
  const config = razorpayConfig();
  if (!config || !orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", config.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const received = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return received.length === expectedBytes.length && timingSafeEqual(received, expectedBytes);
}

export function verifyRazorpayWebhook(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return received.length === expectedBytes.length && timingSafeEqual(received, expectedBytes);
}
