/**
 * Zappit Courier & Shipping Management Core Utilities
 */

export const VALID_SHIPPING_STATUSES = [
  "Preparing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Delivery Failed",
  "Return in Transit",
  "Returned",
] as const;

export type ShippingStatus = (typeof VALID_SHIPPING_STATUSES)[number];

export const COMMON_COURIERS = [
  "BlueDart",
  "Delhivery",
  "DTDC",
  "India Post",
  "FedEx",
  "DHL",
  "Professional Couriers",
  "Speed Post",
  "Other",
] as const;

export type CommonCourier = (typeof COMMON_COURIERS)[number];

/**
 * Normalizes any legacy or variant shipping status string to a standard ShippingStatus.
 */
export function normalizeShippingStatus(rawStatus?: string | null): ShippingStatus {
  if (!rawStatus || typeof rawStatus !== "string") return "Preparing";
  const trimmed = rawStatus.trim();

  // Exact match
  if ((VALID_SHIPPING_STATUSES as readonly string[]).includes(trimmed)) {
    return trimmed as ShippingStatus;
  }

  const upper = trimmed.toUpperCase().replace(/[\s_-]+/g, "_");
  switch (upper) {
    case "SHIPPED":
    case "DISPATCHED":
    case "IN_TRANSIT":
      return "Shipped";
    case "OUT_FOR_DELIVERY":
    case "OUTFORDELIVERY":
      return "Out for Delivery";
    case "DELIVERED":
    case "COMPLETED":
      return "Delivered";
    case "DELIVERY_FAILED":
    case "FAILED_DELIVERY":
    case "FAILED":
      return "Delivery Failed";
    case "RETURN_IN_TRANSIT":
    case "RTO_IN_TRANSIT":
      return "Return in Transit";
    case "RETURNED":
    case "RTO":
    case "CANCELLED":
    case "REFUNDED":
      return "Returned";
    case "PREPARING":
    case "READY_TO_SHIP":
    case "PACKED":
    case "PACKAGING":
    case "CARD_PRODUCTION":
    case "QR_READY":
    case "CUSTOMIZATION":
    case "PAYMENT_VERIFIED":
    case "PROCESSING":
    case "NEW":
    case "PENDING":
    default:
      return "Preparing";
  }
}

/**
 * Validates tracking URL.
 * Only HTTPS URLs with a valid hostname are allowed. Server must never fetch this URL.
 */
export function isValidHttpsTrackingUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return true; // Optional field
  const trimmed = url.trim();
  if (!trimmed) return true;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && Boolean(parsed.hostname && parsed.hostname.includes("."));
  } catch {
    return false;
  }
}

/**
 * Maps shipping status to the core order status without affecting payment status or user access.
 */
export function mapShippingStatusToOrderStatus(shippingStatus: ShippingStatus, currentOrderStatus: string): string {
  switch (shippingStatus) {
    case "Preparing":
      // If order was already confirmed or processing, keep it, otherwise PROCESSING
      return currentOrderStatus === "NEW" || currentOrderStatus === "PENDING" ? "PROCESSING" : currentOrderStatus;
    case "Shipped":
      return "SHIPPED";
    case "Out for Delivery":
      return "SHIPPED";
    case "Delivered":
      return "DELIVERED";
    case "Delivery Failed":
      return "SHIPPED"; // Preserves order state as shipped while delivery issue is tracked
    case "Return in Transit":
      return "SHIPPED";
    case "Returned":
      return currentOrderStatus === "CANCELLED" || currentOrderStatus === "REFUNDED" ? currentOrderStatus : "PROCESSING";
  }
}

export interface CustomerShippingTimelineEvent {
  status: ShippingStatus;
  label: string;
  timestamp: string;
  note?: string;
}

export interface CustomerShippingSummary {
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippingStatus: ShippingStatus;
  dispatchedAt: string | null;
  estimatedDeliveryAt: string | null;
  actualDeliveryAt: string | null;
  isPreparing: boolean;
  timeline: CustomerShippingTimelineEvent[];
}

/**
 * Sanitizes fulfillment and order data into customer-safe view.
 * Strictly strips internal notes, operational checklists, weight, and staff actor names.
 */
export function sanitizeCustomerShippingData(order: any, rawFulfillmentData?: any): CustomerShippingSummary {
  const ful = rawFulfillmentData || order.fulfillment_data || order.fulfillment || {};
  
  // Resolve shipping status
  const rawStatus = order.shipping_status || ful.shippingStatus || order.status;
  const shippingStatus = normalizeShippingStatus(rawStatus);

  // Tracking link - only include if valid HTTPS
  const rawUrl = order.tracking_url || ful.trackingUrl || null;
  const trackingUrl = isValidHttpsTrackingUrl(rawUrl) && rawUrl?.trim() ? rawUrl.trim() : null;

  // Courier & Tracking Number
  const courier = order.courier || ful.courier || null;
  const trackingNumber = order.tracking_number || ful.trackingNumber || null;

  // Dates
  const dispatchedAt = order.dispatched_at || ful.dispatchedAt || ful.shipmentDate || null;
  const estimatedDeliveryAt = order.estimated_delivery_at || ful.estimatedDeliveryAt || ful.expectedDelivery || null;
  const actualDeliveryAt = order.actual_delivery_at || ful.actualDeliveryAt || null;

  // Customer safe timeline
  const rawTimeline: any[] = Array.isArray(ful.timeline) ? ful.timeline : [];
  const customerTimeline: CustomerShippingTimelineEvent[] = [];

  // Always start with order placement
  customerTimeline.push({
    status: "Preparing",
    label: "Order Confirmed",
    timestamp: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString(),
    note: "Your order has been confirmed and received by our fulfillment center.",
  });

  // Check if timeline contains customer-safe events
  for (const ev of rawTimeline) {
    if (!ev || typeof ev !== "object") continue;
    const evStatus = normalizeShippingStatus(ev.status || ev.shippingStatus);
    
    // Filter out internal events like QR_VERIFIED, CARD_VERIFIED, LABEL_GENERATED
    if (["Shipped", "Out for Delivery", "Delivered", "Delivery Failed", "Return in Transit", "Returned"].includes(evStatus)) {
      customerTimeline.push({
        status: evStatus,
        label: evStatus,
        timestamp: ev.timestamp ? new Date(ev.timestamp).toISOString() : new Date().toISOString(),
        note: evStatus === "Shipped" 
          ? `Package dispatched via ${courier || "courier"}${trackingNumber ? ` (AWB: ${trackingNumber})` : ""}`
          : evStatus === "Out for Delivery"
          ? "Package is out for delivery with your local delivery agent."
          : evStatus === "Delivered"
          ? "Package has been delivered to your address."
          : ev.note && !ev.note.toLowerCase().includes("admin") && !ev.note.toLowerCase().includes("internal")
          ? ev.note
          : undefined,
      });
    }
  }

  // Deduplicate consecutive timeline events with same status
  const dedupedTimeline: CustomerShippingTimelineEvent[] = [];
  for (const ev of customerTimeline) {
    const last = dedupedTimeline[dedupedTimeline.length - 1];
    if (!last || last.status !== ev.status) {
      dedupedTimeline.push(ev);
    }
  }

  return {
    courier,
    trackingNumber,
    trackingUrl,
    shippingStatus,
    dispatchedAt: dispatchedAt ? new Date(dispatchedAt).toISOString() : null,
    estimatedDeliveryAt: estimatedDeliveryAt ? new Date(estimatedDeliveryAt).toISOString() : null,
    actualDeliveryAt: actualDeliveryAt ? new Date(actualDeliveryAt).toISOString() : null,
    isPreparing: shippingStatus === "Preparing",
    timeline: dedupedTimeline,
  };
}
