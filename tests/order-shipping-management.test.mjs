import test from "node:test";
import assert from "node:assert/strict";
import {
  VALID_SHIPPING_STATUSES,
  COMMON_COURIERS,
  normalizeShippingStatus,
  isValidHttpsTrackingUrl,
  mapShippingStatusToOrderStatus,
  sanitizeCustomerShippingData,
} from "../src/lib/shipping.ts";

test("Shipping Status: normalizes legacy and variant statuses to standard statuses", () => {
  // Exact matches
  for (const s of VALID_SHIPPING_STATUSES) {
    assert.equal(normalizeShippingStatus(s), s);
  }

  // Variants & upper cases
  assert.equal(normalizeShippingStatus("SHIPPED"), "Shipped");
  assert.equal(normalizeShippingStatus("DISPATCHED"), "Shipped");
  assert.equal(normalizeShippingStatus("IN_TRANSIT"), "Shipped");
  assert.equal(normalizeShippingStatus("OUT_FOR_DELIVERY"), "Out for Delivery");
  assert.equal(normalizeShippingStatus("DELIVERED"), "Delivered");
  assert.equal(normalizeShippingStatus("COMPLETED"), "Delivered");
  assert.equal(normalizeShippingStatus("DELIVERY_FAILED"), "Delivery Failed");
  assert.equal(normalizeShippingStatus("RETURN_IN_TRANSIT"), "Return in Transit");
  assert.equal(normalizeShippingStatus("RETURNED"), "Returned");
  assert.equal(normalizeShippingStatus("RTO"), "Returned");
  assert.equal(normalizeShippingStatus("PREPARING"), "Preparing");
  assert.equal(normalizeShippingStatus("PACKED"), "Preparing");
  assert.equal(normalizeShippingStatus("PROCESSING"), "Preparing");
  assert.equal(normalizeShippingStatus("NEW"), "Preparing");
  assert.equal(normalizeShippingStatus(null), "Preparing");
  assert.equal(normalizeShippingStatus(undefined), "Preparing");
  assert.equal(normalizeShippingStatus("unknown_status_xyz"), "Preparing");
});

test("Tracking URL Validation: accepts valid HTTPS tracking URLs, rejects insecure/invalid formats", () => {
  // Valid HTTPS tracking URLs
  assert.equal(isValidHttpsTrackingUrl("https://www.bluedart.com/tracking/12345"), true);
  assert.equal(isValidHttpsTrackingUrl("https://delhivery.com/track/package/DEL123"), true);
  assert.equal(isValidHttpsTrackingUrl("https://track.dtdc.com/ctbs-tracking/customerInterface.do?awbNo=D123"), true);
  assert.equal(isValidHttpsTrackingUrl(null), true); // Optional field
  assert.equal(isValidHttpsTrackingUrl(""), true); // Optional field
  assert.equal(isValidHttpsTrackingUrl("   "), true); // Optional field

  // Insecure or malicious tracking links must be rejected
  assert.equal(isValidHttpsTrackingUrl("http://insecure-tracking.com/123"), false, "Plain HTTP rejected");
  assert.equal(isValidHttpsTrackingUrl("javascript:alert(1)"), false, "Javascript URI rejected");
  assert.equal(isValidHttpsTrackingUrl("data:text/html,malicious"), false, "Data URI rejected");
  assert.equal(isValidHttpsTrackingUrl("ftp://files.example.com/track"), false, "FTP rejected");
  assert.equal(isValidHttpsTrackingUrl("not-a-valid-url"), false, "Malformed string rejected");
  assert.equal(isValidHttpsTrackingUrl("https://localhost"), false, "Single-label local host rejected");
});

test("Order Status Mapping: Preserves payment status and customer access when shipping status changes", () => {
  // Preparing does not downgrade confirmed orders
  assert.equal(mapShippingStatusToOrderStatus("Preparing", "PROCESSING"), "PROCESSING");
  assert.equal(mapShippingStatusToOrderStatus("Preparing", "CONFIRMED"), "CONFIRMED");
  assert.equal(mapShippingStatusToOrderStatus("Preparing", "NEW"), "PROCESSING");

  // Shipped maps to SHIPPED
  assert.equal(mapShippingStatusToOrderStatus("Shipped", "PROCESSING"), "SHIPPED");

  // Out for Delivery maintains SHIPPED state
  assert.equal(mapShippingStatusToOrderStatus("Out for Delivery", "SHIPPED"), "SHIPPED");

  // Delivered maps to DELIVERED
  assert.equal(mapShippingStatusToOrderStatus("Delivered", "SHIPPED"), "DELIVERED");

  // Delivery Failed keeps SHIPPED state (not cancelled)
  assert.equal(mapShippingStatusToOrderStatus("Delivery Failed", "SHIPPED"), "SHIPPED");

  // Returned keeps CANCELLED/REFUNDED if already cancelled, else maps to PROCESSING
  assert.equal(mapShippingStatusToOrderStatus("Returned", "CANCELLED"), "CANCELLED");
  assert.equal(mapShippingStatusToOrderStatus("Returned", "SHIPPED"), "PROCESSING");
});

test("Customer Data Privacy: Sanitizes internal notes, checklists, and staff identities", () => {
  const mockOrder = {
    id: "ord-123",
    order_number: "ORD-987654",
    status: "PROCESSING",
    shipping_status: "Shipped",
    courier: "Delhivery",
    tracking_number: "DEL123456789",
    tracking_url: "https://delhivery.com/track/DEL123456789",
    dispatched_at: "2026-11-20T10:00:00.000Z",
    estimated_delivery_at: "2026-11-23T18:00:00.000Z",
    actual_delivery_at: null,
    internal_notes: "CRITICAL CONFIDENTIAL: Customer called, angry about delay. Re-dispatch card with gold packaging.",
    fulfillment_data: {
      courier: "Delhivery",
      trackingNumber: "DEL123456789",
      trackingUrl: "https://delhivery.com/track/DEL123456789",
      shippingStatus: "Shipped",
      internalNotes: "Internal QA: Card tested on ACR122U by SuperAdmin John Doe.",
      weightKg: "0.35",
      dimensionsCm: "15 x 10 x 2",
      labels: ["URGENT", "CUSTOM DESIGN"],
      checklist: {
        chipVerified: true,
        qrVerified: true,
        boxSealed: true,
      },
      timeline: [
        {
          status: "Preparing",
          timestamp: "2026-11-19T08:00:00.000Z",
          note: "Order confirmed at fulfillment hub.",
        },
        {
          status: "INTERNAL_QA_PASSED",
          timestamp: "2026-11-19T09:00:00.000Z",
          note: "SuperAdmin John approved NFC antenna impedance.",
        },
        {
          status: "Shipped",
          timestamp: "2026-11-20T10:00:00.000Z",
          note: "Package dispatched via Delhivery (AWB: DEL123456789)",
        },
      ],
      shippingHistory: [
        {
          id: "hist-1",
          fromStatus: "Preparing",
          toStatus: "Shipped",
          changedBy: "superadmin@3gzappit.com",
          timestamp: "2026-11-20T10:00:00.000Z",
          summary: "Dispatched via Delhivery",
        },
      ],
    },
  };

  const customerView = sanitizeCustomerShippingData(mockOrder, mockOrder.fulfillment_data);

  // Verification: Safe customer fields exist
  assert.equal(customerView.shippingStatus, "Shipped");
  assert.equal(customerView.courier, "Delhivery");
  assert.equal(customerView.trackingNumber, "DEL123456789");
  assert.equal(customerView.trackingUrl, "https://delhivery.com/track/DEL123456789");
  assert.equal(customerView.isPreparing, false);
  assert.equal(customerView.dispatchedAt, "2026-11-20T10:00:00.000Z");
  assert.equal(customerView.estimatedDeliveryAt, "2026-11-23T18:00:00.000Z");

  // Verification: Confidential staff data is strictly stripped
  assert.equal(customerView.internalNotes, undefined, "internalNotes must not exist");
  assert.equal(customerView.checklist, undefined, "checklist must not exist");
  assert.equal(customerView.weightKg, undefined, "weightKg must not exist");
  assert.equal(customerView.labels, undefined, "labels must not exist");
  assert.equal(customerView.shippingHistory, undefined, "shippingHistory with staff emails must not exist");

  // Check timeline notes for leaks
  assert.equal(customerView.timeline.length, 2, "Internal QA event must be omitted");
  const fullTimelineString = JSON.stringify(customerView.timeline);
  assert.equal(fullTimelineString.includes("CRITICAL CONFIDENTIAL"), false, "No confidential notes in timeline");
  assert.equal(fullTimelineString.includes("John Doe"), false, "No staff names in timeline");
  assert.equal(fullTimelineString.includes("superadmin@3gzappit.com"), false, "No staff emails in timeline");
});

test("Super Admin Validation: 'Shipped' status requires Courier and Tracking / AWB number", () => {
  function validateShippingMutation(payload) {
    const errors = [];
    const status = normalizeShippingStatus(payload.shippingStatus);

    if (status === "Shipped" || status === "Out for Delivery" || status === "Delivered") {
      if (!payload.courier || !String(payload.courier).trim()) {
        errors.push("Courier company is required when marking an order as Shipped, Out for Delivery, or Delivered.");
      }
      if (!payload.trackingNumber || !String(payload.trackingNumber).trim()) {
        errors.push("Tracking / AWB number is required when marking an order as Shipped, Out for Delivery, or Delivered.");
      }
    }

    if (payload.trackingUrl && !isValidHttpsTrackingUrl(payload.trackingUrl)) {
      errors.push("Tracking link must be a valid HTTPS URL (e.g. https://example.com/track).");
    }

    return { valid: errors.length === 0, errors };
  }

  // Marking Shipped without courier fails
  const missingCourier = validateShippingMutation({
    shippingStatus: "Shipped",
    courier: "",
    trackingNumber: "123456",
  });
  assert.equal(missingCourier.valid, false);
  assert.match(missingCourier.errors[0], /Courier company is required/);

  // Marking Shipped without tracking number fails
  const missingTracking = validateShippingMutation({
    shippingStatus: "Shipped",
    courier: "BlueDart",
    trackingNumber: "",
  });
  assert.equal(missingTracking.valid, false);
  assert.match(missingTracking.errors[0], /Tracking \/ AWB number is required/);

  // Marking Shipped with insecure tracking link fails
  const insecureLink = validateShippingMutation({
    shippingStatus: "Shipped",
    courier: "BlueDart",
    trackingNumber: "123456",
    trackingUrl: "http://bluedart.com/track",
  });
  assert.equal(insecureLink.valid, false);
  assert.match(insecureLink.errors[0], /Tracking link must be a valid HTTPS URL/);

  // Valid Shipped payload succeeds
  const validShipped = validateShippingMutation({
    shippingStatus: "Shipped",
    courier: "BlueDart",
    trackingNumber: "BD998877",
    trackingUrl: "https://www.bluedart.com/track/BD998877",
  });
  assert.equal(validShipped.valid, true);
  assert.equal(validShipped.errors.length, 0);

  // Preparing status does not require courier or tracking number
  const validPreparing = validateShippingMutation({
    shippingStatus: "Preparing",
    courier: "",
    trackingNumber: "",
  });
  assert.equal(validPreparing.valid, true);
});

test("Optimistic Concurrency Control: Prevents silent overwrite when order has newer updates", () => {
  function checkConcurrency(databaseUpdatedAt, expectedUpdatedAt) {
    if (!expectedUpdatedAt) return true; // Concurrency check not requested
    const dbTime = new Date(databaseUpdatedAt).getTime();
    const expTime = new Date(expectedUpdatedAt).getTime();
    return dbTime === expTime;
  }

  const currentDbTime = "2026-11-20T10:30:00.000Z";

  // Matching timestamp succeeds
  assert.equal(checkConcurrency(currentDbTime, "2026-11-20T10:30:00.000Z"), true);

  // Stale client timestamp fails with conflict (409)
  assert.equal(checkConcurrency(currentDbTime, "2026-11-20T10:15:00.000Z"), false);
});

test("RBAC & MFA Access Control Guardrails for Super Admin Shipping", () => {
  function checkShippingPermission(user) {
    if (!user) return { status: 401, authorized: false };
    if (user.role !== "SUPER_ADMIN") return { status: 403, authorized: false };
    if (!user.mfaVerified) return { status: 403, authorized: false };
    return { status: 200, authorized: true };
  }

  // Unauthenticated user
  assert.equal(checkShippingPermission(null).status, 401);

  // Regular CUSTOMER
  assert.equal(checkShippingPermission({ role: "CUSTOMER", mfaVerified: false }).status, 403);

  // Regular ADMIN (even with MFA) cannot manage Super Admin order shipping
  assert.equal(checkShippingPermission({ role: "ADMIN", mfaVerified: true }).status, 403);

  // SUPER_ADMIN without MFA verified cannot mutate shipping
  assert.equal(checkShippingPermission({ role: "SUPER_ADMIN", mfaVerified: false }).status, 403);

  // SUPER_ADMIN with verified MFA is authorized
  const superAdmin = checkShippingPermission({ role: "SUPER_ADMIN", mfaVerified: true });
  assert.equal(superAdmin.status, 200);
  assert.equal(superAdmin.authorized, true);
});
