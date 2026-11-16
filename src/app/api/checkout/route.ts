import { randomBytes } from "node:crypto";
import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { resolveAffiliateAttribution } from "@/lib/affiliate";
import { notifySuperAdminsOfOrder } from "@/lib/orderNotifications";
import { createRazorpayOrder } from "@/lib/razorpay";
import { sendOrderConfirmation } from "@/lib/customerEmails";
import { supabaseJson } from "@/lib/supabaseAuth";
import { normalizeEmail } from "@/lib/repositories/users";
import { resolveCardFinishId, CARD_FINISHES } from "@/lib/billingPlans";

export const runtime = "nodejs";

const CATALOG: Record<string, { name: string; type: "NFC_CARD" | "PLAN"; sku: string; priceMinor: number }> = {
  "nfc-card": { name: "Premium NFC Card", type: "NFC_CARD", sku: "MLC-NFC-PREMIUM", priceMinor: 149900 },
  "custom-nfc-card": { name: "Custom NFC Card", type: "NFC_CARD", sku: "MLC-NFC-CUSTOM", priceMinor: 149900 },
  "plan-lite": { name: "Zappit Lite Plan", type: "PLAN", sku: "ZAP-PLAN-LITE", priceMinor: 199900 },
  "plan-pro": { name: "Zappit Pro Plan", type: "PLAN", sku: "ZAP-PLAN-PRO", priceMinor: 299900 },
  "bundle-standard": { name: "Zappit Lite Plan", type: "PLAN", sku: "ZAP-PLAN-LITE", priceMinor: 199900 },
  "bundle-crm": { name: "Zappit Pro Plan", type: "PLAN", sku: "ZAP-PLAN-PRO", priceMinor: 299900 },
};
const methods = new Set(["UPI", "Card", "Net Banking", "Cash on Delivery"]);
const clean = (value: unknown, max = 200) => String(value || "").trim().slice(0, max);
const cleanOrderLogo = (value: unknown) => {
  const text = String(value || "").trim();
  return /^data:image\/(?:png|jpeg);base64,[a-z0-9+/=\r\n]+$/i.test(text) && text.length <= 3_000_000 ? text : "";
};
type CheckoutItem = { id: string; name: string; type: "NFC_CARD" | "PLAN"; sku: string; priceMinor: number; quantity: number; variant: Record<string, unknown> };
const customMaterialPrices: Record<string, number> = { "White PVC": 99900, "Matte Black PVC": 119900 };

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Please sign in before placing your order." }, { status: 401 });
  let orderId = "";
  try {
    const body = await request.json().catch(() => ({}));
    const customer = body.customer || {}, address = body.shippingAddress || {};
    const name = clean(customer.name, 120), jobTitle = clean(customer.jobTitle, 100), email = clean(customer.email, 254), phone = clean(customer.phone, 30);
    if (name.length < 2 || normalizeEmail(email) !== normalizeEmail(identity.email) || !/^\S+@\S+\.\S+$/.test(email) || phone.length < 7) return Response.json({ message: "Enter the signed-in customer's valid name, email, and phone number." }, { status: 400 });
    const shippingAddress = { jobTitle, line1: clean(address.line1, 200), line2: clean(address.line2, 200), city: clean(address.city, 100), state: clean(address.state, 100), postalCode: clean(address.postalCode, 20), country: clean(address.country, 100) };
    if (!shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode || !shippingAddress.country) return Response.json({ message: "Complete all required delivery-address fields." }, { status: 400 });
    const method = clean(body.paymentMethod, 40); if (!methods.has(method)) return Response.json({ message: "Choose a valid payment method." }, { status: 400 });
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20) return Response.json({ message: "Your cart is empty or too large." }, { status: 400 });
    const items: CheckoutItem[] = body.items.map((input: any) => {
      let id = clean(input.id, 80);
      if (id.startsWith("bundle-standard") || id === "lite") id = "plan-lite";
      if (id.startsWith("bundle-crm") || id === "pro") id = "plan-pro";
      const product = CATALOG[id], quantity = Math.min(10, Math.max(1, Math.floor(Number(input.quantity) || 1)));
      if (!product) throw new Error("UNAVAILABLE_PRODUCT");

      let finishName: string | undefined = undefined;
      let finishId: string | undefined = undefined;

      if (product.type === "PLAN") {
        const rawFinish = input.cardFinish || input.cardFinishId || input.finish || body.cardFinish || body.finish || "black";
        const resolvedFinish = resolveCardFinishId(rawFinish);
        if (!resolvedFinish) {
          throw new Error("INVALID_CARD_FINISH");
        }
        finishId = resolvedFinish;
        finishName = CARD_FINISHES[resolvedFinish].name;
      }

      const design = input.design && typeof input.design === "object" ? Object.fromEntries(Object.entries(input.design).slice(0, 20).map(([key, value]) => [clean(key, 40), key === "logoData" ? cleanOrderLogo(value) : clean(value, 200)])) : {};
      const material = clean(input.design?.material || finishName, 80);
      const priceMinor = id === "custom-nfc-card" ? (customMaterialPrices[material] + 49900 + (input.design?.expertDesign === true ? 49900 : 0)) : product.priceMinor;
      if (!Number.isSafeInteger(priceMinor)) throw new Error("UNAVAILABLE_PRODUCT");
      const productName = finishName ? `${product.name} (${finishName})` : product.name;
      return { ...product, name: productName, id, priceMinor, quantity, variant: { details: clean(input.details, 300), cardFinish: finishName, cardFinishId: finishId, finish: finishName, design: { ...design, material: material || finishName, expertDesign: input.design?.expertDesign === true } } };
    });
    const subtotal = items.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0), shipping = 0, tax = 0, discount = 0, total = subtotal + shipping + tax - discount;
    const attribution = await resolveAffiliateAttribution(clean(body.couponCode, 50) || null, email);
    const orderNumber = `MLC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const chosenFinish = items.find((i) => i.variant?.cardFinish)?.variant?.cardFinish;
    const chosenFinishId = items.find((i) => i.variant?.cardFinishId)?.variant?.cardFinishId;

    const fulfillmentData: Record<string, any> = {
      physicalCardRequired: true,
      cardFinish: chosenFinish || null,
      cardFinishId: chosenFinishId || null,
    };

    const notesSummary = [
      chosenFinish ? `Card Finish: ${chosenFinish}` : null,
      `Checkout payment method: ${method}`,
    ].filter(Boolean).join(" | ");

    const orderPayload: any = { order_number: orderNumber, customer_id: identity.id, customer_name: name, customer_email: email, customer_phone: phone, status: "PENDING", payment_status: "PENDING", currency: "INR", subtotal_minor: subtotal, discount_minor: discount, tax_minor: tax, shipping_minor: shipping, total_minor: total, shipping_address: shippingAddress, billing_address: shippingAddress, fulfillment_data: fulfillmentData, internal_notes: notesSummary };
    if (attribution) {
      orderPayload.affiliate_id = attribution.affiliateId; orderPayload.affiliate_source = attribution.source; orderPayload.affiliate_coupon_code = (attribution as any).couponCode || null; orderPayload.affiliate_lead_id = (attribution as any).businessLeadId || null; orderPayload.affiliate_attributed_at = new Date().toISOString();
      if ((attribution as any).campaign) { const campaign = await supabaseJson(`/rest/v1/affiliate_campaigns?affiliate_id=eq.${attribution.affiliateId}&name=eq.${encodeURIComponent((attribution as any).campaign)}&select=id&limit=1`, {}, true); orderPayload.affiliate_campaign_id = campaign.data?.[0]?.id || null; }
    }
    const created = await supabaseJson("/rest/v1/orders", { method: "POST", body: JSON.stringify(orderPayload) }, true); orderId = created.data?.[0]?.id;
    if (!orderId) throw new Error("Order creation failed.");
    await supabaseJson("/rest/v1/order_items", { method: "POST", body: JSON.stringify(items.map(item => ({ order_id: orderId, product_name: item.name, product_type: item.type, sku: item.sku, variant: item.variant, quantity: item.quantity, unit_price_minor: item.priceMinor }))) }, true);
    let paymentCheckout: null | { provider: "RAZORPAY"; keyId: string; providerOrderId: string } = null;
    if (method === "Cash on Delivery") {
      await supabaseJson("/rest/v1/payments", { method: "POST", body: JSON.stringify({ order_id: orderId, provider: "CASH_ON_DELIVERY", provider_transaction_id: `COD-${orderId}`, amount_minor: total, currency: "INR", status: "PENDING" }) }, true);
    } else {
      const providerOrder = await createRazorpayOrder({ amount: total, currency: "INR", receipt: orderNumber, orderId });
      await supabaseJson("/rest/v1/payments", { method: "POST", body: JSON.stringify({ order_id: orderId, provider: "RAZORPAY", provider_transaction_id: providerOrder.id, amount_minor: total, currency: "INR", status: "PENDING", provider_created_at: new Date().toISOString() }) }, true);
      paymentCheckout = { provider: "RAZORPAY", keyId: providerOrder.keyId, providerOrderId: providerOrder.id };
    }
    await notifySuperAdminsOfOrder({ eventKey: `new-order:${orderId}`, orderId, orderNumber, customerName: name, customerEmail: email, items: items.map(item => ({ name: item.name, quantity: item.quantity })), totalMinor: total, currency: "INR", paymentStatus: "PENDING", shippingLocation: [shippingAddress.city, shippingAddress.state, shippingAddress.country].join(", ") }).catch(() => null);
    await sendOrderConfirmation({ id: orderId, number: orderNumber, name, email, totalMinor: total, currency: "INR", paymentStatus: "PENDING" }).catch(() => false);
    return Response.json({ ok: true, orderId, orderNumber, totalMinor: total, currency: "INR", paymentCheckout }, { status: 201 });
  } catch (error: any) {
    if (orderId) await supabaseJson(`/rest/v1/orders?id=eq.${orderId}`, { method: "DELETE" }, true).catch(() => null);
    if (error?.message === "INVALID_CARD_FINISH") return Response.json({ message: "Please select a valid card finish (Velvet Matte Black PVC or Ceramic White PVC)." }, { status: 400 });
    if (error?.message === "UNAVAILABLE_PRODUCT") return Response.json({ message: "One of the products is unavailable. Remove it and try again." }, { status: 400 });
    if (error?.message === "PAYMENTS_NOT_CONFIGURED") return Response.json({ message: "Online payment is temporarily unavailable. Choose cash on delivery or contact support." }, { status: 503 });
    return safeError(error);
  }
}
