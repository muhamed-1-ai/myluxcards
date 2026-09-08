export interface NextAction {
  key: string;
  label: string;
  buttonText: string;
  color: string;
  subtext: string;
  targetTab?: string;
  isActionable: boolean;
  priority: number;
}

export function calculateNextAction(order: any): NextAction {
  const status = (order.status || order.shippingStatus || "PENDING").toUpperCase();
  const paymentStatus = (order.paymentStatus || order.payment_status || "UNPAID").toUpperCase();
  const fulfillment = order.fulfillment || order.fulfillment_data || {};
  const checklist = fulfillment.checklist || {};
  const shippingAddress = order.shippingAddress || order.shipping_address || {};
  const trackingNumber = order.trackingNumber || order.tracking_number || fulfillment.trackingNumber;

  // 1. Check Shipping Address missing details
  const missingAddr: string[] = [];
  if (!shippingAddress.recipientName && !shippingAddress.name && !order.customerName && !order.customer_name) missingAddr.push("Name");
  if (!shippingAddress.phone && !shippingAddress.mobile && !order.customerMobile && !order.customer_mobile) missingAddr.push("Phone");
  if (!shippingAddress.pinCode && !shippingAddress.pin_code && !shippingAddress.zip) missingAddr.push("PIN Code");
  if (!shippingAddress.house && !shippingAddress.street && !shippingAddress.address && !shippingAddress.line1) missingAddr.push("Address Line");

  // Checklist completion calculation
  const checklistKeys = ["paymentVerified", "qrVerified", "cardVerified", "stickersIncluded", "packagingIncluded"];
  const totalItems = checklistKeys.length;
  let checkedItems = 0;
  checklistKeys.forEach((k) => {
    if (checklist[k] || (k === "paymentVerified" && paymentStatus === "PAID")) {
      checkedItems++;
    }
  });

  // Priority 1: Payment Problem
  if (paymentStatus !== "PAID" && paymentStatus !== "CAPTURED" && paymentStatus !== "SUCCESS") {
    return {
      key: "PAYMENT_REQUIRED",
      label: "Verify Payment",
      buttonText: "VERIFY PAYMENT",
      color: "#ff4d4f",
      subtext: `Payment is currently ${paymentStatus}. Server verification required.`,
      targetTab: "workspace",
      isActionable: true,
      priority: 1,
    };
  }

  // Priority 2: Missing Required Customer / Shipping Info
  if (missingAddr.length > 0) {
    return {
      key: "SHIPPING_ADDRESS_MISSING",
      label: "Missing Address Info",
      buttonText: "ADD SHIPPING INFO",
      color: "#ff4d4f",
      subtext: `Missing: ${missingAddr.join(", ")}.`,
      targetTab: "workspace",
      isActionable: true,
      priority: 2,
    };
  }

  // Priority 3: Customization Problem / Requirement
  if (status === "CUSTOMIZATION") {
    return {
      key: "CUSTOMIZATION_REQUIRED",
      label: "Customization Required",
      buttonText: "OPEN CUSTOMIZATION",
      color: "#a855f7",
      subtext: "Order requires custom design / artwork approval.",
      targetTab: "workspace",
      isActionable: true,
      priority: 3,
    };
  }

  // Priority 4: QR Problem / Unverified
  if (!fulfillment.qrVerified && !checklist.qrVerified && status !== "SHIPPED" && status !== "DELIVERED") {
    return {
      key: "QR_NOT_READY",
      label: "QR Not Verified",
      buttonText: "VERIFY QR",
      color: "#f39c12",
      subtext: "Canonical profile QR link requires verification.",
      targetTab: "workspace",
      isActionable: true,
      priority: 4,
    };
  }

  // Priority 5: Card / NFC Production
  if ((status === "CARD_PRODUCTION" || (!fulfillment.cardVerified && !checklist.cardVerified)) && status !== "SHIPPED" && status !== "DELIVERED") {
    return {
      key: "CARD_PRODUCTION_REQUIRED",
      label: "Card Production Required",
      buttonText: "START PRODUCTION",
      color: "#3b82f6",
      subtext: "NFC card encoding / printing required.",
      targetTab: "workspace",
      isActionable: true,
      priority: 5,
    };
  }

  // Priority 6: Packing (Required or In Progress)
  if (status === "PACKAGING" || status === "NEW" || status === "PAYMENT_VERIFIED" || status === "PENDING" || status === "PROCESSING") {
    if (checkedItems === 0) {
      return {
        key: "PACKING_REQUIRED",
        label: "Start Packing",
        buttonText: "START PACKING",
        color: "#eab308",
        subtext: "Order ready to be packed in fulfillment.",
        targetTab: "packing",
        isActionable: true,
        priority: 6,
      };
    } else if (checkedItems < totalItems) {
      return {
        key: "PACKING_IN_PROGRESS",
        label: "Continue Packing",
        buttonText: "CONTINUE PACKING",
        color: "#f59e0b",
        subtext: `Packing is ${checkedItems} / ${totalItems} complete.`,
        targetTab: "packing",
        isActionable: true,
        priority: 6,
      };
    }
  }

  // Priority 7: Ready to Ship
  if (status === "PACKED" || status === "READY_TO_SHIP") {
    if (!trackingNumber) {
      return {
        key: "TRACKING_REQUIRED",
        label: "Add Tracking",
        buttonText: "ADD TRACKING",
        color: "#f97316",
        subtext: "Order packed. Courier tracking number required to ship.",
        targetTab: "shipping",
        isActionable: true,
        priority: 7,
      };
    }
    return {
      key: "READY_TO_SHIP",
      label: "Ship Order",
      buttonText: "SHIP ORDER",
      color: "#00E5FF",
      subtext: `Order packed & verified. Ready for dispatch via ${order.courier || fulfillment.courier || "Courier"}.`,
      targetTab: "shipping",
      isActionable: true,
      priority: 7,
    };
  }

  // Priority 8: Shipped
  if (status === "SHIPPED") {
    return {
      key: "SHIPPED",
      label: "Shipped",
      buttonText: "VIEW SHIPPING",
      color: "#22c55e",
      subtext: `Tracking #${trackingNumber || "N/A"}. In transit to customer.`,
      targetTab: "workspace",
      isActionable: false,
      priority: 8,
    };
  }

  // Priority 9: Delivered
  if (status === "DELIVERED") {
    return {
      key: "DELIVERED",
      label: "Delivered",
      buttonText: "VIEW ORDER",
      color: "#10b981",
      subtext: "Order successfully delivered to customer.",
      targetTab: "workspace",
      isActionable: false,
      priority: 9,
    };
  }

  // Default fallback
  return {
    key: "VIEW_ORDER",
    label: "Review Order",
    buttonText: "VIEW ORDER",
    color: "#888888",
    subtext: `Current status: ${status}`,
    targetTab: "workspace",
    isActionable: true,
    priority: 10,
  };
}
