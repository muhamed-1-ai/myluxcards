"use client";

import { useState, useEffect, useCallback } from "react";
import { buildPremiumQrSvg, svgToHighResPngBlob } from "@/lib/premiumQr";
import { calculateNextAction } from "@/lib/nextActionEngine";

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

export default function ShipOrderWorkspace({ orderId, onBack, onViewCustomer, onOpenPacking, onOpenShipping }: ShipOrderWorkspaceProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showPrintPack, setShowPrintPack] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Shipping form fields
  const [courier, setCourier] = useState("Standard Courier");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [weightKg, setWeightKg] = useState("0.25");
  const [dimensionsCm, setDimensionsCm] = useState("15 x 10 x 2");
  const [status, setStatus] = useState("PENDING");
  const [activeLabels, setActiveLabels] = useState<string[]>([]);

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

      // Populate states
      const ful = json.fulfillment || {};
      setCourier(json.order?.courier || ful.courier || "Standard Courier");
      setTrackingNumber(json.order?.trackingNumber || ful.trackingNumber || "");
      setTrackingUrl(ful.trackingUrl || "");
      setWeightKg(ful.weightKg || "0.25");
      setDimensionsCm(ful.dimensionsCm || "15 x 10 x 2");
      setStatus(json.order?.status || "PENDING");
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

  const saveFulfillment = async (overrides: Partial<any> = {}) => {
    setSaving(true);
    try {
      const payload = {
        status: overrides.status || status,
        courier: overrides.courier || courier,
        trackingNumber: overrides.trackingNumber || trackingNumber,
        trackingUrl: overrides.trackingUrl || trackingUrl,
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
        timelineEvent: overrides.timelineEvent,
      };

      const res = await fetch(`/api/super-admin/orders/${orderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save fulfillment");
      }

      await loadOrderDetails();
    } catch (e: any) {
      alert(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleLabel = (label: string) => {
    const nextLabels = activeLabels.includes(label)
      ? activeLabels.filter((l) => l !== label)
      : [...activeLabels, label];
    setActiveLabels(nextLabels);
    void saveFulfillment({ labels: nextLabels });
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(`Copied ${label}!`);
    setTimeout(() => setCopyFeedback(""), 2000);
  };

  const downloadQr = async (format: "png" | "svg") => {
    if (!data?.qr?.url) return;
    const svgString = buildPremiumQrSvg(data.qr.url, { label: "3G ZAPPIT" });
    const filename = `zappit-qr-${data.order?.orderNumber || "order"}.${format}`;

    if (format === "svg") {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = await svgToHighResPngBlob(svgString, 1500);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return <div style={{ color: "#fff", padding: "40px", textAlign: "center" }}>Loading Order Workspace...</div>;
  }

  if (error || !data) {
    return (
      <div style={{ color: "#ff4d4f", padding: "40px", textAlign: "center" }}>
        <h3>Error Loading Order</h3>
        <p>{error || "Order not found."}</p>
        <button onClick={onBack} style={{ padding: "8px 16px", background: "#333", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Back to List
        </button>
      </div>
    );
  }

  const { order, customer, shippingAddress, missingShippingFields, items, payment, qr, card, fulfillment } = data;
  const isPaymentVerified = payment?.isVerifiedServerSide;
  const readiness = fulfillment?.shippingReadiness || { percentage: 0, isReadyToShip: false, missingRequirements: [] };
  const qrSvgString = qr?.url ? buildPremiumQrSvg(qr.url, { label: "3G ZAPPIT" }) : "";

  const nextAction = calculateNextAction({
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillment_data: fulfillment,
    shipping_address: shippingAddress,
    customerName: customer.name,
    customerMobile: customer.phone,
    trackingNumber: order.trackingNumber,
    courier: order.courier,
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
    <div style={{ background: "#050505", color: "#fff", minHeight: "100vh", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      {/* Top Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px" }}>
        <div>
          <button onClick={onBack} style={{ background: "transparent", color: "#00E5FF", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "700", marginBottom: "6px", display: "inline-block" }}>
            ← Back to Orders List
          </button>
          <h1 style={{ fontSize: "24px", margin: 0, display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            Ship Order #{order.orderNumber}
            <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "20px", background: order.status === "SHIPPED" || order.status === "DELIVERED" ? "#52c41a22" : "#0066FF22", color: order.status === "SHIPPED" || order.status === "DELIVERED" ? "#52c41a" : "#00E5FF", border: `1px solid ${order.status === "SHIPPED" || order.status === "DELIVERED" ? "#52c41a" : "#0066FF"}` }}>
              {order.status}
            </span>
          </h1>
        </div>

        {/* Quick Action Bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {order.userId && onViewCustomer && (
            <button onClick={() => onViewCustomer(order.userId)} style={{ ...quickBtnStyle, background: "rgba(0, 102, 255, 0.2)", color: "#00E5FF", border: "1px solid rgba(0, 229, 255, 0.4)" }}>
              👤 View Customer
            </button>
          )}
          {qr?.url && (
            <a href={qr.url} target="_blank" rel="noreferrer" style={{ ...quickBtnStyle, background: "rgba(46, 204, 113, 0.15)", color: "#2ecc71", border: "1px solid rgba(46, 204, 113, 0.4)", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              🌐 Open Profile ↗
            </a>
          )}
          <button onClick={() => copyToClipboard(fullAddressString, "Full Address")} style={quickBtnStyle}>
            📋 Copy Address
          </button>
          <button onClick={() => copyToClipboard(shippingAddress.phone, "Phone Number")} style={quickBtnStyle}>
            📞 Copy Phone
          </button>
          <button onClick={() => setShowQrModal(true)} style={quickBtnStyle}>
            🔍 View QR
          </button>
          <button onClick={() => downloadQr("png")} style={quickBtnStyle}>
            ⬇️ Download QR
          </button>
          <button onClick={() => setShowLabelModal(true)} style={quickBtnStyle}>
            🏷️ Generate Label
          </button>
          <button onClick={() => setShowPrintPack(true)} style={{ ...quickBtnStyle, background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", fontWeight: 800 }}>
            🖨️ Print Shipping Pack
          </button>
        </div>
      </div>

      {/* CALCULATED NEXT ACTION BANNER */}
      {nextAction && (
        <div style={{ background: "#0b1324", border: `1px solid ${nextAction.color}`, borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span style={{ fontSize: 10, color: "#888", fontWeight: 800, letterSpacing: 0.5, display: "block", marginBottom: 2 }}>
              CALCULATED NEXT ACTION
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ background: nextAction.color, color: "#000", fontWeight: 900, fontSize: 12, padding: "3px 9px", borderRadius: 4 }}>
                {nextAction.label}
              </span>
              <span style={{ fontSize: 13, color: "#eee" }}>{nextAction.subtext}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {nextAction.targetTab === "packing" && onOpenPacking && (
              <button onClick={() => onOpenPacking(order.id)} style={{ padding: "8px 14px", background: nextAction.color, color: "#000", fontWeight: 900, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                📦 Open in Packing Mode ➔
              </button>
            )}
            {nextAction.targetTab === "shipping" && onOpenShipping && (
              <button onClick={() => onOpenShipping(order.id)} style={{ padding: "8px 14px", background: nextAction.color, color: "#000", fontWeight: 900, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                🚚 Open in Shipping Mode ➔
              </button>
            )}
          </div>
        </div>
      )}

      {copyFeedback && (
        <div style={{ background: "#52c41a", color: "#000", padding: "8px 16px", borderRadius: "6px", fontWeight: 700, marginBottom: "16px" }}>
          ✓ {copyFeedback}
        </div>
      )}

      {/* Internal Operational Labels Selector */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
          🏷️ Internal Operational Labels
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {OPERATIONAL_LABELS.map((lbl) => {
            const active = activeLabels.includes(lbl);
            return (
              <button
                key={lbl}
                type="button"
                onClick={() => toggleLabel(lbl)}
                style={{
                  background: active ? "linear-gradient(135deg, #0066FF, #00E5FF)" : "rgba(255,255,255,0.06)",
                  color: active ? "#fff" : "rgba(255,255,255,0.6)",
                  border: active ? "1px solid #00E5FF" : "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {active ? "✓ " : "+ "}{lbl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shipping Readiness Indicator Banner */}
      <div style={{ background: readiness.isReadyToShip ? "#13520022" : "#5c220022", border: `1px solid ${readiness.isReadyToShip ? "#52c41a" : "#fa8c16"}`, padding: "16px 20px", borderRadius: "10px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "28px" }}>{readiness.isReadyToShip ? "🟢" : "🟠"}</span>
            <div>
              <strong style={{ fontSize: "16px", color: readiness.isReadyToShip ? "#52c41a" : "#fa8c16" }}>
                {readiness.isReadyToShip ? "READY TO SHIP (100%)" : `ACTION REQUIRED (${readiness.percentage}%)`}
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#aaa" }}>
                {readiness.isReadyToShip ? "All operational & verification requirements complete." : "Resolve pending items below to allow shipment creation."}
              </p>
            </div>
          </div>
          <button
            disabled={saving || !readiness.isReadyToShip}
            onClick={() => saveFulfillment({ status: "SHIPPED", timelineEvent: { status: "SHIPPED", note: `Marked Shipped via ${courier} AWB ${trackingNumber}` } })}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              background: readiness.isReadyToShip ? "#52c41a" : "#333",
              color: readiness.isReadyToShip ? "#000" : "#777",
              border: "none",
              fontWeight: 700,
              cursor: readiness.isReadyToShip ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving..." : "🚀 Mark Shipped"}
          </button>
        </div>

        {readiness.missingRequirements.length > 0 && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px stroke #fa8c1633" }}>
            <span style={{ fontSize: "12px", color: "#fa8c16", fontWeight: 700 }}>Pending Action Items:</span>
            <ul style={{ margin: "4px 0 0 20px", padding: 0, fontSize: "13px", color: "#ffccc7" }}>
              {readiness.missingRequirements.map((req: string, idx: number) => (
                <li key={idx}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Command Center Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>
        {/* 1. Customer & Complete Shipping Information */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>📍 Customer & Shipping Information</h3>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => copyToClipboard(shippingAddress.phone, "Phone")} style={miniBtnStyle}>Copy Phone</button>
              <button onClick={() => copyToClipboard(shippingAddress.pinCode, "PIN")} style={miniBtnStyle}>Copy PIN</button>
              <button onClick={() => copyToClipboard(fullAddressString, "Address")} style={miniBtnStyle}>Copy Address</button>
            </div>
          </div>

          {missingShippingFields.length > 0 && (
            <div style={{ background: "#2a1215", border: "1px solid #ff4d4f", padding: "10px", borderRadius: "6px", marginBottom: "14px", color: "#ff4d4f", fontSize: "12px" }}>
              <strong>⚠️ SHIPPING INFORMATION INCOMPLETE</strong>
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
            <div style={{ background: "#111", border: "1px solid #222", padding: "10px", borderRadius: "6px", marginTop: "8px" }}>
              <strong style={{ color: "#aaa", fontSize: "11px", letterSpacing: "0.5px" }}>DELIVERY ADDRESS:</strong>
              <p style={{ margin: "4px 0 0", color: "#fff", whiteSpace: "pre-line" }}>
                {[shippingAddress.house, shippingAddress.street, shippingAddress.locality, `${shippingAddress.city} ${shippingAddress.state} ${shippingAddress.pinCode}`, shippingAddress.country]
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

        {/* 2. Order & Verified Payment Section */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>💳 Payment & Order Details</h3>
            <span style={{ fontSize: "12px", color: "#888" }}>{new Date(order.createdAt).toLocaleDateString()}</span>
          </div>

          <div style={{ background: isPaymentVerified ? "#13520022" : "#2a1215", border: `1px solid ${isPaymentVerified ? "#52c41a" : "#ff4d4f"}`, padding: "12px", borderRadius: "6px", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ color: isPaymentVerified ? "#52c41a" : "#ff4d4f" }}>
                {isPaymentVerified ? "🟢 PAYMENT VERIFIED (SERVER-SIDE)" : "🔴 DO NOT SHIP — UNPAID / UNVERIFIED"}
              </strong>
              <span style={{ fontSize: "14px", fontWeight: 800 }}>₹{(order.totalMinor / 100).toFixed(2)}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#aaa" }}>
              Payment Status: {order.paymentStatus} | Currency: {order.currency}
            </p>
          </div>

          <div style={{ fontSize: "13px", lineHeight: "1.6" }}>
            <p style={{ margin: "0 0 6px" }}><strong style={{ color: "#aaa" }}>Order ID:</strong> {order.id}</p>
            <p style={{ margin: "0 0 6px" }}><strong style={{ color: "#aaa" }}>Order Number:</strong> {order.orderNumber}</p>
            <p style={{ margin: "0 0 6px" }}><strong style={{ color: "#aaa" }}>Subtotal:</strong> ₹{(order.subtotalMinor / 100).toFixed(2)}</p>
            <p style={{ margin: "0 0 6px" }}><strong style={{ color: "#aaa" }}>Shipping Fee:</strong> ₹{(order.shippingMinor / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* 3. Product Package Contents */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>📦 Product Package Contents</h3>
            <span style={{ fontSize: "12px", color: "#888" }}>{items.length} items</span>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((it: any) => (
              <li key={it.id} style={{ background: "#111", border: "1px solid #222", padding: "10px", borderRadius: "6px", marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <strong style={{ color: "#fff", fontSize: "13px" }}>{it.productName}</strong>
                  <div style={{ color: "#888", fontSize: "12px" }}>Qty: {it.quantity} {it.sku ? `| SKU: ${it.sku}` : ""}</div>
                </div>
                <div style={{ fontWeight: 700, color: "#00E5FF" }}>
                  ₹{(it.totalMinor / 100).toFixed(2)}
                </div>
              </li>
            ))}
          </ul>

          <div style={{ borderTop: "1px solid #222", paddingTop: "10px", marginTop: "10px", fontSize: "12px", color: "#aaa" }}>
            <strong>Standard Included Extras:</strong>
            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
              <li>Premium NFC Card × {items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)}</li>
              <li>Owner Contact QR Sticker × 2</li>
              <li>ZAPPIT Executive Packaging Box × 1</li>
            </ul>
          </div>
        </div>

        {/* 4. QR Code & Card / NFC Verification */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>🔲 QR Code & Card Verification</h3>
            <span style={{ fontSize: "12px", color: "#888" }}>{qr.status}</span>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "14px" }}>
            {qrSvgString ? (
              <div
                dangerouslySetInnerHTML={{ __html: qrSvgString }}
                style={{ width: "110px", height: "110px", background: "#050505", border: "1px solid #333", borderRadius: "8px", padding: "4px" }}
              />
            ) : (
              <div style={{ width: "110px", height: "110px", background: "#111", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#555" }}>
                No QR
              </div>
            )}

            <div style={{ flex: 1, fontSize: "12px" }}>
              <strong style={{ color: "#fff", display: "block", marginBottom: "4px" }}>Destination URL:</strong>
              <a href={qr.url} target="_blank" rel="noreferrer" style={{ color: "#0066FF", wordBreak: "break-all", fontSize: "11px" }}>
                {qr.url}
              </a>
              <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <button onClick={() => copyToClipboard(qr.url, "QR URL")} style={miniBtnStyle}>Copy URL</button>
                <button onClick={() => downloadQr("png")} style={miniBtnStyle}>PNG</button>
                <button onClick={() => downloadQr("svg")} style={miniBtnStyle}>SVG</button>
              </div>
            </div>
          </div>

          {/* Verification Toggles */}
          <div style={{ background: "#111", padding: "12px", borderRadius: "6px", border: "1px solid #222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px" }}>QR Destination Verification:</span>
              <button
                onClick={() => {
                  const next = !qrVerified;
                  setQrVerified(next);
                  saveFulfillment({ qrVerified: next, timelineEvent: { status: "QR_VERIFIED", note: next ? "QR Verified by Admin" : "QR Verification revoked" } });
                }}
                style={{ padding: "6px 12px", borderRadius: "4px", background: qrVerified ? "#52c41a22" : "#ff4d4f22", color: qrVerified ? "#52c41a" : "#ff4d4f", border: `1px solid ${qrVerified ? "#52c41a" : "#ff4d4f"}`, cursor: "pointer", fontWeight: 700 }}
              >
                {qrVerified ? "🟢 QR VERIFIED" : "🔴 QR NOT VERIFIED"}
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px" }}>Card / NFC Verification:</span>
              <button
                onClick={() => {
                  const next = !cardVerified;
                  setCardVerified(next);
                  saveFulfillment({ cardVerified: next, timelineEvent: { status: "CARD_VERIFIED", note: next ? "NFC Card Verified by Admin" : "Card Verification revoked" } });
                }}
                style={{ padding: "6px 12px", borderRadius: "4px", background: cardVerified ? "#52c41a22" : "#ff4d4f22", color: cardVerified ? "#52c41a" : "#ff4d4f", border: `1px solid ${cardVerified ? "#52c41a" : "#ff4d4f"}`, cursor: "pointer", fontWeight: 700 }}
              >
                {cardVerified ? "🟢 CARD VERIFIED" : "🔴 CARD NOT VERIFIED"}
              </button>
            </div>
          </div>
        </div>

        {/* 5. Pre-Shipping Physical Checklist */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>☑️ Pre-Shipping Fulfillment Checklist</h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
            {[
              { key: "paymentVerified", label: "Payment Verified", disabled: true, checked: isPaymentVerified },
              { key: "customerVerified", label: "Customer Info Verified" },
              { key: "shippingAddressVerified", label: "Address Verified" },
              { key: "productVerified", label: "Product Items Verified" },
              { key: "qrGenerated", label: "QR Generated" },
              { key: "qrVerified", label: "QR Scanned & Tested", checked: qrVerified },
              { key: "nfcVerified", label: "NFC Chip Scanned", checked: cardVerified },
              { key: "cardProduced", label: "Card Produced" },
              { key: "cardQualityChecked", label: "Quality Inspected" },
              { key: "stickersIncluded", label: "Stickers Included" },
              { key: "packagingIncluded", label: "Box Packaged" },
              { key: "labelGenerated", label: "Shipping Label Created" },
            ].map((chk) => (
              <label key={chk.key} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#111", padding: "6px 8px", borderRadius: "4px", border: "1px solid #222", cursor: chk.disabled ? "not-allowed" : "pointer" }}>
                <input
                  type="checkbox"
                  disabled={chk.disabled}
                  checked={chk.checked !== undefined ? chk.checked : Boolean(checklist[chk.key])}
                  onChange={(e) => {
                    const nextChecklist = { ...checklist, [chk.key]: e.target.checked };
                    setChecklist(nextChecklist);
                    saveFulfillment({ checklist: nextChecklist });
                  }}
                />
                <span style={{ color: (chk.checked !== undefined ? chk.checked : checklist[chk.key]) ? "#52c41a" : "#aaa" }}>{chk.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 6. Shipping & Courier Management */}
        <div style={cardBoxStyle}>
          <div style={cardHeaderStyle}>
            <h3>🚚 Shipping & Courier Details</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
            <div>
              <label style={{ display: "block", color: "#aaa", marginBottom: "4px" }}>Courier Partner</label>
              <select value={courier} onChange={(e) => setCourier(e.target.value)} style={inputStyle}>
                <option value="Standard Courier">Standard Courier</option>
                <option value="BlueDart">BlueDart</option>
                <option value="Delhivery">Delhivery</option>
                <option value="DTDC">DTDC</option>
                <option value="India Post">India Post</option>
                <option value="FedEx">FedEx</option>
                <option value="DHL">DHL</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ display: "block", color: "#aaa", marginBottom: "4px" }}>AWB / Tracking #</label>
                <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Tracking number" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", color: "#aaa", marginBottom: "4px" }}>Order Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                  <option value="NEW">NEW</option>
                  <option value="PAYMENT_VERIFIED">PAYMENT VERIFIED</option>
                  <option value="CUSTOMIZATION">CUSTOMIZATION</option>
                  <option value="QR_READY">QR READY</option>
                  <option value="CARD_PRODUCTION">CARD PRODUCTION</option>
                  <option value="PACKAGING">PACKAGING</option>
                  <option value="PACKED">PACKED</option>
                  <option value="READY_TO_SHIP">READY TO SHIP</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="IN_TRANSIT">IN TRANSIT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="RTO">RTO (Returned)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ display: "block", color: "#aaa", marginBottom: "4px" }}>Weight (kg)</label>
                <input type="text" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", color: "#aaa", marginBottom: "4px" }}>Dimensions (cm)</label>
                <input type="text" value={dimensionsCm} onChange={(e) => setDimensionsCm(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <button disabled={saving} onClick={() => saveFulfillment()} style={{ padding: "8px", background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", fontWeight: 800, border: "none", borderRadius: "6px", cursor: "pointer", marginTop: "6px" }}>
              {saving ? "Saving Updates..." : "Save Shipping Details"}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div style={{ ...cardBoxStyle, marginTop: "20px" }}>
        <div style={cardHeaderStyle}>
          <h3>📜 Order Audit & Fulfillment Timeline</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(fulfillment?.timeline || []).map((t: any, idx: number) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", background: "#111", padding: "8px 12px", borderRadius: "6px", border: "1px solid #222", fontSize: "12px" }}>
              <div>
                <strong style={{ color: "#00E5FF" }}>{t.status}</strong>
                <p style={{ margin: "2px 0 0", color: "#ccc" }}>{t.note}</p>
              </div>
              <div style={{ color: "#888", textAlign: "right" }}>
                <div>{new Date(t.timestamp).toLocaleString()}</div>
                {t.actor && <small style={{ color: "#666" }}>By: {t.actor}</small>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Label Modal */}
      {showLabelModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "500px" }}>
            <h3>🏷️ Shipping Label Preview</h3>
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
                <div>COURIER: {courier}</div>
                <div>AWB #: {trackingNumber || "PENDING"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowLabelModal(false)} style={secondaryBtnStyle}>Close</button>
              <button onClick={() => window.print()} style={primaryBtnStyle}>Print Label</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Shipping Pack Modal */}
      {showPrintPack && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "600px" }}>
            <h3>🖨️ Shipping Pack & Packing Slip</h3>
            <div style={{ background: "#fff", color: "#000", padding: "24px", borderRadius: "6px", fontSize: "13px", lineHeight: "1.6", margin: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "12px" }}>
                <div>
                  <strong style={{ fontSize: "18px" }}>3G ZAPPIT PACKING SLIP</strong>
                  <div>Order #: {order.orderNumber}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: "11px" }}>
                  <div>Date: {new Date().toLocaleDateString()}</div>
                  <div>Payment: {order.paymentStatus}</div>
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
                <div>QR Destination: {qr.url}</div>
                <div>Card ID: {card?.digitalCardId || "N/A"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowPrintPack(false)} style={secondaryBtnStyle}>Close</button>
              <button onClick={() => window.print()} style={primaryBtnStyle}>Print Packing Pack</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "420px", textAlign: "center" }}>
            <h3>Customer QR Code</h3>
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
  background: "#141414",
  border: "1px solid #262626",
  padding: "20px",
  borderRadius: "10px",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px",
  borderBottom: "1px solid #222",
  paddingBottom: "8px",
};

const quickBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "#222",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: "6px",
  fontSize: "12px",
  cursor: "pointer",
  fontWeight: 600,
};

const miniBtnStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: "#333",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  fontSize: "11px",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  background: "#111",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: "6px",
  fontSize: "12px",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px",
};

const modalContentStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  borderRadius: "10px",
  padding: "24px",
  width: "100%",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "linear-gradient(135deg, #0066FF, #00E5FF)",
  color: "#fff",
  fontWeight: 800,
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "#ccc",
  border: "1px solid #444",
  borderRadius: "6px",
  cursor: "pointer",
};
