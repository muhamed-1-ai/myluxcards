"use client";

import { useState, useEffect, useCallback } from "react";
import { buildPremiumQrSvg, svgToHighResPngBlob } from "@/lib/premiumQr";
import { calculateNextAction } from "@/lib/nextActionEngine";
import {
  VALID_SHIPPING_STATUSES,
  COMMON_COURIERS,
  ShippingStatus,
  normalizeShippingStatus,
  isValidHttpsTrackingUrl,
} from "@/lib/shipping";

interface ShipOrderWorkspaceProps {
  orderId: string;
  onBack?: () => void;
  onViewCustomer?: (userId: string) => void;
  onOpenPacking?: (orderId: string) => void;
  onOpenShipping?: (orderId: string) => void;
}

const OPERATIONAL_LABELS = [
  "URGENT",
  "CUSTOM DESIGN",
  "REPLACEMENT",
  "GIFT",
  "PREPAID",
  "COD",
  "INTERNATIONAL",
];

const SHIPPING_STATUS_COLORS: Record<ShippingStatus, { bg: string; color: string; border: string }> = {
  "Preparing": { bg: "rgba(0, 102, 255, 0.15)", color: "#00E5FF", border: "#0066FF" },
  "Shipped": { bg: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", border: "#0ea5e9" },
  "Out for Delivery": { bg: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "#a855f7" },
  "Delivered": { bg: "rgba(34, 197, 94, 0.15)", color: "#4ade80", border: "#22c55e" },
  "Delivery Failed": { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "#ef4444" },
  "Return in Transit": { bg: "rgba(249, 115, 22, 0.15)", color: "#fb923c", border: "#f97316" },
  "Returned": { bg: "rgba(156, 163, 175, 0.15)", color: "#9ca3af", border: "#6b7280" },
};

export default function ShipOrderWorkspace({
  orderId,
  onBack,
  onViewCustomer,
  onOpenPacking,
  onOpenShipping,
}: ShipOrderWorkspaceProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showPrintPack, setShowPrintPack] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Dedicated Shipping Form State
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>("Preparing");
  const [courier, setCourier] = useState<string>("BlueDart");
  const [courierOther, setCourierOther] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [dispatchedAt, setDispatchedAt] = useState("");
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState("");
  const [actualDeliveryAt, setActualDeliveryAt] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [weightKg, setWeightKg] = useState("0.25");
  const [dimensionsCm, setDimensionsCm] = useState("15 x 10 x 2");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Checklists
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [qrVerified, setQrVerified] = useState(false);
  const [cardVerified, setCardVerified] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  const loadOrderDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/super-admin/orders/${orderId}/ship`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load order details");
      }
      const json = await res.json();
      setData(json);

      // Populate shipping states
      const ful = json.fulfillment || {};
      const statusValue = normalizeShippingStatus(ful.shippingStatus || json.order?.status);
      setShippingStatus(statusValue);

      const rawCourier = json.order?.courier || ful.courier || "BlueDart";
      if ((COMMON_COURIERS as readonly string[]).includes(rawCourier)) {
        setCourier(rawCourier);
        setCourierOther("");
      } else if (rawCourier) {
        setCourier("Other");
        setCourierOther(rawCourier);
      } else {
        setCourier("BlueDart");
        setCourierOther("");
      }

      setTrackingNumber(json.order?.trackingNumber || ful.trackingNumber || "");
      setTrackingUrl(ful.trackingUrl || "");
      setDispatchedAt(ful.dispatchedAt ? ful.dispatchedAt.slice(0, 10) : "");
      setEstimatedDeliveryAt(ful.estimatedDeliveryAt ? ful.estimatedDeliveryAt.slice(0, 10) : "");
      setActualDeliveryAt(ful.actualDeliveryAt ? ful.actualDeliveryAt.slice(0, 10) : "");
      setInternalNotes(json.order?.internalNotes || ful.internalNotes || "");
      setWeightKg(ful.weightKg || "0.25");
      setDimensionsCm(ful.dimensionsCm || "15 x 10 x 2");
      setActiveLabels(ful.labels || []);
      setChecklist(ful.checklist || {});
      setQrVerified(Boolean(ful.checklist?.qrVerified));
      setCardVerified(Boolean(ful.checklist?.cardVerified));
    } catch (e: any) {
      setError(e.message || "Failed to load order.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderDetails();
  }, [loadOrderDetails]);

  // Client validation before saving
  const validateForm = (targetStatus: ShippingStatus, targetCourier: string, targetCourierOther: string, targetTracking: string, targetUrl: string) => {
    const errors: string[] = [];
    const effectiveCourier = targetCourier === "Other" ? targetCourierOther.trim() : targetCourier.trim();

    if (["Shipped", "Out for Delivery", "Delivered"].includes(targetStatus)) {
      if (!effectiveCourier) {
        errors.push("Courier partner name is required when status is Shipped or Delivered.");
      }
      if (!targetTracking.trim()) {
        errors.push("Tracking / AWB number is required when status is Shipped or Delivered.");
      }
    }

    if (targetUrl && !isValidHttpsTrackingUrl(targetUrl)) {
      errors.push("Tracking link must be a valid HTTPS URL (starting with https://).");
    }

    return errors;
  };

  const saveFulfillment = async (overrides: Partial<any> = {}) => {
    setSaving(true);
    setError("");
    setSaveSuccess("");
    setValidationErrors([]);

    const targetStatus = overrides.shippingStatus || shippingStatus;
    const targetCourier = overrides.courier || courier;
    const targetCourierOther = overrides.courierOther !== undefined ? overrides.courierOther : courierOther;
    const targetTracking = overrides.trackingNumber !== undefined ? overrides.trackingNumber : trackingNumber;
    const targetUrl = overrides.trackingUrl !== undefined ? overrides.trackingUrl : trackingUrl;

    const errors = validateForm(targetStatus, targetCourier, targetCourierOther, targetTracking, targetUrl);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        shippingStatus: targetStatus,
        courier: targetCourier,
        courierOther: targetCourierOther,
        trackingNumber: targetTracking,
        trackingUrl: targetUrl,
        dispatchedAt: overrides.dispatchedAt !== undefined ? overrides.dispatchedAt : dispatchedAt,
        estimatedDeliveryAt: overrides.estimatedDeliveryAt !== undefined ? overrides.estimatedDeliveryAt : estimatedDeliveryAt,
        actualDeliveryAt: overrides.actualDeliveryAt !== undefined ? overrides.actualDeliveryAt : actualDeliveryAt,
        internalNotes: overrides.internalNotes !== undefined ? overrides.internalNotes : internalNotes,
        weightKg: overrides.weightKg || weightKg,
        dimensionsCm: overrides.dimensionsCm || dimensionsCm,
        labels: overrides.labels || activeLabels,
        qrVerified: overrides.qrVerified !== undefined ? overrides.qrVerified : qrVerified,
        cardVerified: overrides.cardVerified !== undefined ? overrides.cardVerified : cardVerified,
        checklist: {
          ...checklist,
          ...(overrides.checklist || {}),
          qrVerified: overrides.qrVerified !== undefined ? overrides.qrVerified : qrVerified,
          cardVerified: overrides.cardVerified !== undefined ? overrides.cardVerified : cardVerified,
        },
        expectedUpdatedAt: data?.fulfillment?.updatedAt || data?.order?.updatedAt,
      };

      const res = await fetch(`/api/super-admin/orders/${orderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to save shipping details");
      }

      setSaveSuccess("Shipping details and history updated successfully.");
      await loadOrderDetails();
    } catch (e: any) {
      setError(e.message || "Failed to update shipping details.");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(`${label} copied to clipboard!`);
    setTimeout(() => setCopyFeedback(""), 2500);
  };

  const downloadQr = async (format: "png" | "svg") => {
    if (!qrSvgString) return;
    const filename = `ZAPPIT-QR-${order.orderNumber}.${format}`;
    if (format === "svg") {
      const blob = new Blob([qrSvgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = await svgToHighResPngBlob(qrSvgString, 1500);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div style={{ color: "#fff", padding: "60px 20px", textAlign: "center", background: "#050505", minHeight: "100vh" }}>
        <div style={{ fontSize: "24px", marginBottom: "12px" }}>⏳</div>
        <p style={{ fontSize: "16px", color: "#aaa" }}>Loading Order Workspace...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ color: "#ff4d4f", padding: "60px 20px", textAlign: "center", background: "#050505", minHeight: "100vh" }}>
        <h3>Error Loading Order</h3>
        <p>{error || "Order not found."}</p>
        <button onClick={onBack} style={{ padding: "8px 18px", background: "#333", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 700 }}>
          ← Back to Orders List
        </button>
      </div>
    );
  }

  const { order, customer, shippingAddress, missingShippingFields, items, payment, qr, card, fulfillment } = data;
  const isPaymentVerified = payment?.isVerifiedServerSide;
  const readiness = fulfillment?.shippingReadiness || { percentage: 0, isReadyToShip: false, missingRequirements: [] };
  const qrSvgString = qr?.url ? buildPremiumQrSvg(qr.url, { label: "3G ZAPPIT" }) : "";
  const currentStatusStyle = SHIPPING_STATUS_COLORS[shippingStatus] || SHIPPING_STATUS_COLORS["Preparing"];

  const nextAction = calculateNextAction({
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillment_data: fulfillment,
    shipping_address: shippingAddress,
    customerName: customer.name,
    customerMobile: customer.phone,
    trackingNumber: trackingNumber || order.trackingNumber,
    courier: courier === "Other" ? courierOther : courier,
  });

  const fullAddressString = [
    shippingAddress.recipientName,
    `Phone: ${shippingAddress.phone}`,
    shippingAddress.alternatePhone ? `Alt Phone: ${shippingAddress.alternatePhone}` : "",
    shippingAddress.house,
    shippingAddress.street,
    shippingAddress.locality,
    `${shippingAddress.city} ${shippingAddress.district ? `(${shippingAddress.district})` : ""}`,
    `${shippingAddress.state} - ${shippingAddress.pinCode}`,
    shippingAddress.country,
    shippingAddress.deliveryInstructions ? `Instructions: ${shippingAddress.deliveryInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div style={{ background: "var(--admin-bg, #050505)", color: "var(--admin-text, #fff)", minHeight: "100vh", padding: "24px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Top Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", gap: "12px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "16px" }}>
        <div>
          <button
            onClick={onBack}
            style={{ background: "transparent", color: "#00E5FF", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "700", marginBottom: "6px", display: "inline-flex", alignItems: "center", gap: "4px", padding: 0 }}
          >
            ← Back to Orders List
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "26px", margin: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
              Order #{order.orderNumber}
            </h1>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: "20px",
                background: currentStatusStyle.bg,
                color: currentStatusStyle.color,
                border: `1px solid ${currentStatusStyle.border}`,
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: currentStatusStyle.color }} />
              {shippingStatus}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: "13px" }}>
            Customer: <strong style={{ color: "#fff" }}>{customer.name}</strong> ({customer.email})
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {order.userId && onViewCustomer && (
            <button onClick={() => onViewCustomer(order.userId)} style={quickBtnStyle}>
              👤 Customer Profile
            </button>
          )}
          {qr?.url && (
            <a href={qr.url} target="_blank" rel="noopener noreferrer" style={{ ...quickBtnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              🌐 Live Card ↗
            </a>
          )}
          <button onClick={() => copyToClipboard(fullAddressString, "Full Address")} style={quickBtnStyle}>
            📋 Copy Address
          </button>
          <button onClick={() => setShowLabelModal(true)} style={quickBtnStyle}>
            🏷️ Shipping Label
          </button>
          <button onClick={() => setShowPrintPack(true)} style={{ ...quickBtnStyle, background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", fontWeight: 800, border: "none" }}>
            🖨️ Packing Slip
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {saveSuccess && (
        <div style={{ background: "#135200", border: "1px solid #52c41a", color: "#d9f7be", padding: "12px 16px", borderRadius: "8px", fontWeight: 700, marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>✓ {saveSuccess}</span>
          <button onClick={() => setSaveSuccess("")} style={{ background: "transparent", border: "none", color: "#d9f7be", cursor: "pointer", fontWeight: "bold" }}>✕</button>
        </div>
      )}

      {error && (
        <div style={{ background: "#431418", border: "1px solid #ff4d4f", color: "#ffccc7", padding: "12px 16px", borderRadius: "8px", fontWeight: 700, marginBottom: "20px" }}>
          ⚠️ {error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div style={{ background: "#431418", border: "1px solid #ff4d4f", color: "#ffccc7", padding: "14px 18px", borderRadius: "8px", marginBottom: "20px" }}>
          <strong style={{ display: "block", marginBottom: "6px" }}>⚠️ Please correct the following errors before saving:</strong>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {copyFeedback && (
        <div style={{ background: "rgba(0, 229, 255, 0.2)", border: "1px solid #00E5FF", color: "#00E5FF", padding: "10px 16px", borderRadius: "6px", fontWeight: 700, marginBottom: "16px" }}>
          ✓ {copyFeedback}
        </div>
      )}

      {/* Main Grid: Shipping Management + Order Context */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
        
        {/* ========================================================
            CARD 1: COURIER & SHIPPING MANAGEMENT (Primary Edit Form)
           ======================================================== */}
        <div style={{ ...cardBoxStyle, gridColumn: "1 / -1", border: "1px solid #0066FF66", background: "linear-gradient(180deg, rgba(0, 102, 255, 0.04) 0%, rgba(0,0,0,0.5) 100%)" }}>
          <div style={cardHeaderStyle}>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                🚚 Manage Shipping &amp; Courier Dispatch
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#aaa" }}>
                Update shipping status, courier details, tracking numbers, and delivery dates. Payment status remains unaffected.
              </p>
            </div>
            <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "6px", background: currentStatusStyle.bg, color: currentStatusStyle.color, border: `1px solid ${currentStatusStyle.border}`, fontWeight: 800 }}>
              {shippingStatus}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            
            {/* Field: Shipping Status */}
            <div>
              <label style={fieldLabelStyle}>
                Shipping Status <span style={{ color: "#ff4d4f" }}>*</span>
              </label>
              <select
                value={shippingStatus}
                onChange={(e) => {
                  const newStat = e.target.value as ShippingStatus;
                  setShippingStatus(newStat);
                  // Auto-populate dates on status transition if empty
                  if (newStat === "Shipped" && !dispatchedAt) {
                    setDispatchedAt(new Date().toISOString().slice(0, 10));
                  }
                  if (newStat === "Delivered" && !actualDeliveryAt) {
                    setActualDeliveryAt(new Date().toISOString().slice(0, 10));
                  }
                }}
                style={inputStyle}
              >
                {VALID_SHIPPING_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <small style={{ color: "#888", display: "block", marginTop: "4px", fontSize: "11px" }}>
                Separate from payment status. Customer sees real-time updates.
              </small>
            </div>

            {/* Field: Courier Partner */}
            <div>
              <label style={fieldLabelStyle}>
                Courier Partner <span style={{ color: "#ff4d4f" }}>*</span>
              </label>
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                style={inputStyle}
              >
                {COMMON_COURIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {courier === "Other" && (
                <div style={{ marginTop: "8px" }}>
                  <input
                    type="text"
                    value={courierOther}
                    onChange={(e) => setCourierOther(e.target.value)}
                    placeholder="Enter Custom Courier Name"
                    style={{ ...inputStyle, borderColor: "#00E5FF" }}
                  />
                </div>
              )}
            </div>

            {/* Field: Tracking / AWB Number */}
            <div>
              <label style={fieldLabelStyle}>
                Tracking / AWB Number {["Shipped", "Out for Delivery", "Delivered"].includes(shippingStatus) && <span style={{ color: "#ff4d4f" }}>*</span>}
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. 1294829104"
                  style={inputStyle}
                />
                {trackingNumber && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(trackingNumber, "Tracking #")}
                    style={{ ...miniBtnStyle, whiteSpace: "nowrap" }}
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>

            {/* Field: HTTPS Tracking Link */}
            <div>
              <label style={fieldLabelStyle}>
                Tracking Link (Optional HTTPS)
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="url"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://track.provider.com/..."
                  style={{
                    ...inputStyle,
                    borderColor: trackingUrl && !isValidHttpsTrackingUrl(trackingUrl) ? "#ff4d4f" : undefined,
                  }}
                />
                {trackingUrl && isValidHttpsTrackingUrl(trackingUrl) && (
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...miniBtnStyle,
                      display: "inline-flex",
                      alignItems: "center",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Test ↗
                  </a>
                )}
              </div>
              <small style={{ color: trackingUrl && !isValidHttpsTrackingUrl(trackingUrl) ? "#ff4d4f" : "#888", display: "block", marginTop: "4px", fontSize: "11px" }}>
                {trackingUrl && !isValidHttpsTrackingUrl(trackingUrl) ? "Must start with https://" : "Customer will see a direct 'Track Package' button"}
              </small>
            </div>
          </div>

          {/* Dates Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "16px", padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <label style={fieldLabelStyle}>Dispatch Date</label>
              <input
                type="date"
                value={dispatchedAt}
                onChange={(e) => setDispatchedAt(e.target.value)}
                style={inputStyle}
              />
              <small style={{ color: "#888", fontSize: "11px" }}>Date package left fulfillment center</small>
            </div>

            <div>
              <label style={fieldLabelStyle}>Estimated Delivery Date</label>
              <input
                type="date"
                value={estimatedDeliveryAt}
                onChange={(e) => setEstimatedDeliveryAt(e.target.value)}
                style={inputStyle}
              />
              <small style={{ color: "#888", fontSize: "11px" }}>Shared with customer as estimated date</small>
            </div>

            <div>
              <label style={fieldLabelStyle}>Actual Delivery Date</label>
              <input
                type="date"
                value={actualDeliveryAt}
                onChange={(e) => setActualDeliveryAt(e.target.value)}
                style={inputStyle}
              />
              <small style={{ color: "#888", fontSize: "11px" }}>Auto-recorded when marked Delivered</small>
            </div>
          </div>

          {/* Internal Notes (Hidden from customer) */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ ...fieldLabelStyle, display: "flex", justifyContent: "space-between" }}>
              <span>🔒 Internal Shipping Notes (Staff Only)</span>
              <span style={{ color: "#fa8c16", fontWeight: "normal", fontSize: "11px" }}>Strictly hidden from customers</span>
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Add internal dispatch logs, courier pickup notes, package handover details, or exception records..."
              rows={3}
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          {/* Action Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: "12px", color: "#888" }}>
              Last updated: {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : "N/A"}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={loadOrderDetails}
                disabled={saving}
                style={secondaryBtnStyle}
              >
                Reset Changes
              </button>
              <button
                type="button"
                onClick={() => saveFulfillment()}
                disabled={saving}
                style={{
                  ...primaryBtnStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 24px",
                  fontSize: "14px",
                }}
              >
                {saving ? "Saving Changes..." : "💾 Save Shipping Details"}
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================
            CARD 2: RECIPIENT & DELIVERY ADDRESS
           ======================================================== */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>📍 Delivery Address &amp; Contact</h3>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => copyToClipboard(shippingAddress.phone, "Phone")} style={miniBtnStyle}>Copy Phone</button>
              <button onClick={() => copyToClipboard(fullAddressString, "Address")} style={miniBtnStyle}>Copy Full Address</button>
            </div>
          </div>

          {missingShippingFields.length > 0 && (
            <div style={{ background: "#2a1215", border: "1px solid #ff4d4f", padding: "10px", borderRadius: "6px", marginBottom: "14px", color: "#ff4d4f", fontSize: "12px" }}>
              <strong>⚠️ INCOMPLETE DELIVERY ADDRESS:</strong>
              <br />
              Missing: {missingShippingFields.join(", ")}
            </div>
          )}

          <div style={{ fontSize: "13px", lineHeight: "1.7" }}>
            <p style={{ margin: "0 0 6px" }}>
              <strong style={{ color: "#aaa" }}>Recipient:</strong> <span style={{ color: "#fff", fontWeight: 700 }}>{shippingAddress.recipientName}</span>
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <strong style={{ color: "#aaa" }}>Phone:</strong> {shippingAddress.phone} {shippingAddress.alternatePhone && `(Alt: ${shippingAddress.alternatePhone})`}
            </p>
            <p style={{ margin: "0 0 6px" }}>
              <strong style={{ color: "#aaa" }}>Email:</strong> {customer.email}
            </p>

            <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", padding: "12px", borderRadius: "6px", marginTop: "10px" }}>
              <strong style={{ color: "#00E5FF", fontSize: "11px", letterSpacing: "0.5px" }}>DELIVERY ADDRESS:</strong>
              <p style={{ margin: "4px 0 0", color: "#fff", whiteSpace: "pre-line" }}>
                {[
                  shippingAddress.house,
                  shippingAddress.street,
                  shippingAddress.locality,
                  `${shippingAddress.city} ${shippingAddress.state} ${shippingAddress.pinCode}`,
                  shippingAddress.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {shippingAddress.deliveryInstructions && (
                <p style={{ margin: "6px 0 0", color: "#00E5FF", fontSize: "12px" }}>
                  <em>Note: {shippingAddress.deliveryInstructions}</em>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            CARD 3: PURCHASED CARDS & SELECTED FINISHES
           ======================================================== */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>💳 Purchased Cards &amp; Finishes</h3>
            <span style={{ fontSize: "12px", color: "#888" }}>{items.length} items</span>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((it: any) => {
              const custom = it.customization || {};
              const finish = custom.finish || custom.material || custom.cardFinish || custom.color || null;
              const printedName = custom.printedName || custom.name || custom.fullName || null;
              const title = custom.title || custom.designation || null;
              const company = custom.company || custom.organization || null;

              return (
                <li
                  key={it.id}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div>
                      <strong style={{ color: "#fff", fontSize: "14px" }}>{it.productName}</strong>
                      <div style={{ color: "#888", fontSize: "12px" }}>
                        Qty: <strong style={{ color: "#fff" }}>{it.quantity}</strong> {it.sku ? `| SKU: ${it.sku}` : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: "#00E5FF", fontSize: "14px" }}>
                      ₹{(it.totalMinor / 100).toFixed(2)}
                    </div>
                  </div>

                  {/* Selected Finishes & Customization Details */}
                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 10px", borderRadius: "6px", fontSize: "12px", color: "#bbb", marginTop: "6px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "6px" }}>
                      {finish && (
                        <div>
                          <span style={{ color: "#888", fontSize: "11px" }}>Finish / Material: </span>
                          <strong style={{ color: "#00E5FF" }}>{finish}</strong>
                        </div>
                      )}
                      {printedName && (
                        <div>
                          <span style={{ color: "#888", fontSize: "11px" }}>Name to Print: </span>
                          <strong style={{ color: "#fff" }}>{printedName}</strong>
                        </div>
                      )}
                      {title && (
                        <div>
                          <span style={{ color: "#888", fontSize: "11px" }}>Title: </span>
                          <strong style={{ color: "#ccc" }}>{title}</strong>
                        </div>
                      )}
                      {company && (
                        <div>
                          <span style={{ color: "#888", fontSize: "11px" }}>Company: </span>
                          <strong style={{ color: "#ccc" }}>{company}</strong>
                        </div>
                      )}
                    </div>
                    {custom.notes && (
                      <div style={{ marginTop: "4px", fontSize: "11px", color: "#fa8c16" }}>
                        Custom Note: {custom.notes}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px", marginTop: "12px", fontSize: "12px", color: "#aaa" }}>
            <strong>Payment Status: </strong>
            <span style={{ color: isPaymentVerified ? "#52c41a" : "#ff4d4f", fontWeight: 700 }}>
              {order.paymentStatus}
            </span>
            <span style={{ margin: "0 8px" }}>•</span>
            <strong>Total: </strong>₹{(order.totalMinor / 100).toFixed(2)}
          </div>
        </div>

        {/* ========================================================
            CARD 4: SHIPPING AUDIT & TIMELINE HISTORY
           ======================================================== */}
        <div style={{ ...cardBoxStyle, gridColumn: "1 / -1" }}>
          <div style={cardHeaderStyle}>
            <h3>📜 Shipping History &amp; Audit Trail</h3>
            <span style={{ fontSize: "12px", color: "#888" }}>
              {(fulfillment?.shippingHistory || []).length} recorded update events
            </span>
          </div>

          {(!fulfillment?.shippingHistory || fulfillment.shippingHistory.length === 0) ? (
            <p style={{ color: "#888", fontSize: "13px", margin: 0 }}>
              No shipping status modifications recorded yet. Updates made above will be appended here.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {fulfillment.shippingHistory.map((hist: any, idx: number) => {
                const prevStyle = SHIPPING_STATUS_COLORS[normalizeShippingStatus(hist.previousStatus)];
                const newStyle = SHIPPING_STATUS_COLORS[normalizeShippingStatus(hist.newStatus)];

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      background: "rgba(0,0,0,0.3)",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.06)",
                      fontSize: "12.5px",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: "4px", background: prevStyle.bg, color: prevStyle.color, fontSize: "11px", fontWeight: 700 }}>
                          {hist.previousStatus}
                        </span>
                        <span style={{ color: "#888" }}>➔</span>
                        <span style={{ padding: "2px 8px", borderRadius: "4px", background: newStyle.bg, color: newStyle.color, fontSize: "11px", fontWeight: 700 }}>
                          {hist.newStatus}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: "#ddd" }}>{hist.details}</p>
                    </div>

                    <div style={{ textAlign: "right", fontSize: "11.5px", color: "#888", minWidth: "160px" }}>
                      <div>{new Date(hist.timestamp).toLocaleString()}</div>
                      {hist.actor && <div style={{ color: "#00E5FF", marginTop: "2px" }}>By: {hist.actor}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Shipping Label Modal */}
      {showLabelModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "500px" }}>
            <h3 style={{ margin: "0 0 12px" }}>🏷️ Shipping Label Preview</h3>
            <div style={{ background: "#fff", color: "#000", padding: "20px", borderRadius: "6px", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.5", margin: "16px 0" }}>
              <div style={{ borderBottom: "2px solid #000", paddingBottom: "8px", marginBottom: "8px", fontWeight: "bold" }}>
                3G ZAPPIT FULFILLMENT CENTER
              </div>
              <div><strong>SHIP TO:</strong></div>
              <div>{shippingAddress.recipientName}</div>
              <div>Phone: {shippingAddress.phone}</div>
              <div>{shippingAddress.house} {shippingAddress.street}</div>
              <div>{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pinCode}</div>
              <div style={{ marginTop: "12px", borderTop: "1px dashed #000", paddingTop: "8px" }}>
                <div>ORDER #: {order.orderNumber}</div>
                <div>COURIER: {courier === "Other" ? courierOther : courier}</div>
                <div>AWB #: {trackingNumber || "PENDING"}</div>
                {dispatchedAt && <div>DISPATCH DATE: {dispatchedAt}</div>}
                {estimatedDeliveryAt && <div>EST. DELIVERY: {estimatedDeliveryAt}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowLabelModal(false)} style={secondaryBtnStyle}>Close</button>
              <button onClick={() => window.print()} style={primaryBtnStyle}>Print Label</button>
            </div>
          </div>
        </div>
      )}

      {/* Packing Slip Modal */}
      {showPrintPack && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "560px" }}>
            <h3 style={{ margin: "0 0 12px" }}>🖨️ Packing Slip</h3>
            <div style={{ background: "#fff", color: "#000", padding: "20px", borderRadius: "6px", fontSize: "12px", lineHeight: "1.6", margin: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "10px" }}>
                <div>
                  <strong style={{ fontSize: "16px" }}>3G ZAPPIT</strong>
                  <div>Order #{order.orderNumber}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: "11px" }}>
                  <div>Date: {new Date().toLocaleDateString()}</div>
                  <div>Payment: {order.paymentStatus}</div>
                  <div>Courier: {courier === "Other" ? courierOther : courier}</div>
                  <div>Status: {shippingStatus}</div>
                </div>
              </div>

              <div><strong>RECIPIENT DETAILS:</strong></div>
              <div>{shippingAddress.recipientName} (Tel: {shippingAddress.phone})</div>
              <div>{shippingAddress.house} {shippingAddress.street} {shippingAddress.locality}</div>
              <div>{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pinCode}</div>

              <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", border: "1px solid #ccc" }}>
                <thead>
                  <tr style={{ background: "#eee", textAlign: "left" }}>
                    <th style={{ padding: "6px", border: "1px solid #ccc" }}>Item</th>
                    <th style={{ padding: "6px", border: "1px solid #ccc" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i: any) => (
                    <tr key={i.id}>
                      <td style={{ padding: "6px", border: "1px solid #ccc" }}>{i.productName}</td>
                      <td style={{ padding: "6px", border: "1px solid #ccc" }}>{i.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: "1px solid #000", paddingTop: "8px", fontSize: "11px" }}>
                <div>Tracking AWB: {trackingNumber || "Pending"}</div>
                <div>Card ID: {card?.digitalCardId || "N/A"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowPrintPack(false)} style={secondaryBtnStyle}>Close</button>
              <button onClick={() => window.print()} style={primaryBtnStyle}>Print Packing Slip</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "420px", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 8px" }}>Customer QR Code</h3>
            <p style={{ color: "#aaa", fontSize: "12px", margin: "0 0 16px" }}>{customer.name} ({customer.email})</p>
            {qrSvgString && (
              <div
                dangerouslySetInnerHTML={{ __html: qrSvgString }}
                style={{ width: "220px", height: "220px", margin: "0 auto 16px", background: "#050505", padding: "10px", borderRadius: "10px", border: "1px solid #333" }}
              />
            )}
            <p style={{ fontSize: "11px", color: "#0066FF", wordBreak: "break-all" }}>{qr.url}</p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px" }}>
              <button onClick={() => downloadQr("png")} style={primaryBtnStyle}>Download PNG</button>
              <button onClick={() => downloadQr("svg")} style={secondaryBtnStyle}>Download SVG</button>
              <button onClick={() => setShowQrModal(false)} style={secondaryBtnStyle}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling helpers
const cardBoxStyle: React.CSSProperties = {
  background: "var(--admin-panel, #11141a)",
  border: "1px solid var(--admin-border, #1f2937)",
  padding: "22px",
  borderRadius: "12px",
  color: "var(--admin-text, #fff)",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
  borderBottom: "1px solid var(--admin-border, rgba(255,255,255,0.08))",
  paddingBottom: "10px",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  color: "#cbd5e1",
  fontSize: "12.5px",
  fontWeight: 700,
  marginBottom: "6px",
};

const quickBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "rgba(255, 255, 255, 0.05)",
  color: "var(--admin-text, #fff)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "8px",
  fontSize: "12.5px",
  cursor: "pointer",
  fontWeight: 600,
  transition: "all 0.2s ease",
};

const miniBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "rgba(255, 255, 255, 0.08)",
  color: "var(--admin-text, #fff)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "6px",
  fontSize: "11px",
  cursor: "pointer",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--admin-bg, #090d14)",
  color: "var(--admin-text, #fff)",
  border: "1px solid var(--admin-border, #2d3748)",
  borderRadius: "8px",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px",
};

const modalContentStyle: React.CSSProperties = {
  background: "var(--admin-panel, #11141a)",
  border: "1px solid var(--admin-border, #2d3748)",
  borderRadius: "14px",
  padding: "24px",
  width: "100%",
  color: "var(--admin-text, #fff)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 18px",
  background: "linear-gradient(135deg, #0066FF, #00E5FF)",
  color: "#fff",
  fontWeight: 800,
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "opacity 0.2s ease",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 18px",
  background: "transparent",
  color: "var(--admin-text, #cbd5e1)",
  border: "1px solid var(--admin-border, #475569)",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600,
};
