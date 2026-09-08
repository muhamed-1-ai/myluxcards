"use client";

import { useState, useEffect, useCallback } from "react";
import { buildPremiumQrSvg } from "@/lib/premiumQr";
import { calculateNextAction } from "@/lib/nextActionEngine";

interface ShippingModeProps {
  initialOrderId?: string | null;
  onExit: () => void;
  onOpenWorkspace: (orderId: string) => void;
}

const COMMON_COURIERS = [
  "Blue Dart",
  "Delhivery",
  "DTDC",
  "India Post",
  "FedEx",
  "Shadowfax",
  "Ekart Logistics",
  "Standard Courier",
];

export default function ShippingMode({ initialOrderId, onExit, onOpenWorkspace }: ShippingModeProps) {
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(initialOrderId || null);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [queueOrders, setQueueOrders] = useState<any[]>([]);

  // Shipping Form State
  const [courier, setCourier] = useState("Standard Courier");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Load Order Details & Shipping Queue
  const loadOrder = useCallback(async (orderIdToFetch?: string | null) => {
    setLoading(true);
    setError("");
    setOrderData(null);
    try {
      // 1. Fetch shipping queue (orders ready to ship)
      const queueRes = await fetch("/api/super-admin/fulfillment?queue=shipping", { cache: "no-store" });
      let availableQueue: any[] = [];
      if (queueRes.ok) {
        const queueJson = await queueRes.json();
        availableQueue = queueJson.needingAttention?.filter((o: any) => o.status === "READY_TO_SHIP" || o.status === "PACKED") || [];
        setQueueOrders(availableQueue);
      }

      let targetId = orderIdToFetch;

      // 2. If no target ID provided, pick the oldest ready-to-ship order
      if (!targetId && availableQueue.length > 0) {
        targetId = availableQueue[0].id;
      }

      if (!targetId) {
        setLoading(false);
        return;
      }

      setCurrentOrderId(targetId);

      // 3. Fetch full order ship details
      const res = await fetch(`/api/super-admin/orders/${targetId}/ship`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load shipping order");
      }
      const json = await res.json();
      setOrderData(json);

      setCourier(json.order?.courier || json.fulfillment?.courier || "Standard Courier");
      setTrackingNumber(json.order?.trackingNumber || json.fulfillment?.trackingNumber || "");
      setTrackingUrl(json.fulfillment?.trackingUrl || "");
    } catch (e: any) {
      setError(e.message || "Error loading shipping order");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrder(initialOrderId);
  }, [initialOrderId, loadOrder]);

  // Copy Full Address
  const handleCopyAddress = () => {
    if (!orderData?.shippingAddress) return;
    const sa = orderData.shippingAddress;
    const fullText = `${sa.recipientName}\nPhone: ${sa.phone}\n${sa.house} ${sa.street}\n${sa.locality ? sa.locality + ", " : ""}${sa.city}, ${sa.state} - ${sa.pinCode}\n${sa.country}`;
    navigator.clipboard.writeText(fullText);
    setCopyNotice("Copied Full Address ✓");
    setTimeout(() => setCopyNotice(""), 2000);
  };

  // Save Tracking Info
  const handleSaveTracking = async () => {
    if (!currentOrderId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/orders/${currentOrderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courier,
          trackingNumber,
          trackingUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to save tracking");
      setSuccessToast("Tracking information saved ✓");
      setTimeout(() => setSuccessToast(""), 2000);
    } catch (e: any) {
      alert(e.message || "Error saving tracking");
    } finally {
      setSaving(false);
    }
  };

  // Mark Order as Shipped
  const handleMarkShipped = async () => {
    if (!currentOrderId || !orderData) return;

    // Validation checks
    const missing: string[] = [];
    if (!trackingNumber.trim()) missing.push("Tracking Number");
    if (!orderData.shippingAddress?.phone || orderData.shippingAddress.phone === "N/A") missing.push("Customer Phone");
    if (!orderData.shippingAddress?.pinCode) missing.push("PIN Code");

    if (missing.length > 0) {
      alert(`CANNOT SHIP: Missing ${missing.join(", ")}. Please enter required details before shipping.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/orders/${currentOrderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SHIPPED",
          courier,
          trackingNumber,
          trackingUrl,
          timelineEvent: {
            status: "SHIPPED",
            note: `Order marked SHIPPED via ${courier} (Tracking: ${trackingNumber}).`,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to mark order shipped");
      }

      setSuccessToast(`ORDER SHIPPED ✓ #${orderData.order?.orderNumber} tracked via ${trackingNumber}`);
      setTimeout(() => setSuccessToast(""), 3000);

      // Auto-load Next Shipping Order
      await loadOrder(null);
    } catch (e: any) {
      alert(e.message || "Error marking shipped");
    } finally {
      setSaving(false);
    }
  };

  const nextAction = orderData ? calculateNextAction(orderData) : null;
  const canShip = Boolean(trackingNumber.trim() && orderData?.shippingAddress?.pinCode);

  return (
    <div style={{ background: "#090d16", minHeight: "85vh", borderRadius: 12, padding: "20px", color: "#fff", border: "1px solid #1c2638" }}>
      {/* HEADER BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1f2a3e", paddingBottom: 16, marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", fontWeight: 900, fontSize: 11, padding: "4px 10px", borderRadius: 6 }}>
            🚚 SHIPPING MODE
          </span>
          {orderData?.order && (
            <h2 style={{ fontSize: 20, margin: 0, fontWeight: 800, letterSpacing: -0.5 }}>
              ORDER #{orderData.order.orderNumber}
            </h2>
          )}
          {queueOrders.length > 0 && (
            <span style={{ background: "#1e293b", color: "#00E5FF", fontSize: 12, padding: "3px 9px", borderRadius: 12, border: "1px solid #0066FF" }}>
              {queueOrders.length} Ready to Ship
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => loadOrder(null)}
            style={{ background: "#111827", border: "1px solid #374151", color: "#e5e7eb", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            NEXT ORDER ➔
          </button>
          <button
            onClick={onExit}
            style={{ background: "#991b1b", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            ❌ Exit Shipping Mode
          </button>
        </div>
      </div>

      {/* SUCCESS CONFIRMATION TOAST */}
      {successToast && (
        <div style={{ background: "#065f46", color: "#34d399", padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontWeight: 700, border: "1px solid #059669", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{successToast}</span>
          <button onClick={() => loadOrder(null)} style={{ background: "#10b981", color: "#000", border: "none", padding: "4px 12px", borderRadius: 4, fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
            NEXT ORDER ➔
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🔄</div>
          Fetching next order ready to ship...
        </div>
      ) : error ? (
        <div style={{ padding: "40px", background: "#451a1a", border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5" }}>
          <h3 style={{ margin: "0 0 8px" }}>Error Loading Shipping Order</h3>
          <p>{error}</p>
          <button onClick={() => loadOrder(null)} style={{ padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
            Retry / Next Order
          </button>
        </div>
      ) : !orderData ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#52c41a" }}>No Orders Waiting to Ship!</h3>
          <p style={{ color: "#94a3b8", maxWidth: 450, margin: "0 auto 20px" }}>
            All packed orders have been dispatched. Return to fulfillment command center to manage other stages.
          </p>
          <button onClick={onExit} style={{ padding: "10px 20px", background: "#0066FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>
            Return to Fulfillment Overview
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* COLUMN 1: RECIPIENT & ADDRESS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* NEXT ACTION BANNER */}
            {nextAction && (
              <div style={{ background: "#0f172a", border: `1px solid ${nextAction.color}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, letterSpacing: 0.5, marginBottom: 4 }}>CALCULATED NEXT ACTION</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: nextAction.color, color: "#000", fontWeight: 900, fontSize: 11, padding: "3px 8px", borderRadius: 4 }}>
                    {nextAction.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#e2e8f0" }}>{nextAction.subtext}</span>
                </div>
              </div>
            )}

            {/* CUSTOMER RECIPIENT BOX */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>RECIPIENT CUSTOMER</span>
                {orderData.order?.userId && (
                  <button
                    onClick={() => onOpenWorkspace(orderData.order.id)}
                    style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Inspect Workspace ↗
                  </button>
                )}
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "#f8fafc" }}>{orderData.customer?.name}</h3>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>📞 {orderData.customer?.phone || "N/A"}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>✉️ {orderData.customer?.email}</div>
            </div>

            {/* FULL SHIPPING ADDRESS & 1-CLICK COPY */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>DESTINATION ADDRESS</span>
                <button
                  onClick={handleCopyAddress}
                  style={{ background: "#38bdf8", color: "#000", border: "none", padding: "4px 10px", borderRadius: 4, fontWeight: 800, fontSize: 11, cursor: "pointer" }}
                >
                  {copyNotice || "📋 COPY FULL ADDRESS"}
                </button>
              </div>
              {orderData.shippingAddress ? (
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, background: "#1e293b", padding: 12, borderRadius: 8, border: "1px solid #334155" }}>
                  <div style={{ fontWeight: 800, color: "#fff", fontSize: 14, marginBottom: 4 }}>{orderData.shippingAddress.recipientName}</div>
                  <div>Phone: {orderData.shippingAddress.phone}</div>
                  <div>{orderData.shippingAddress.house} {orderData.shippingAddress.street}</div>
                  {orderData.shippingAddress.locality && <div>{orderData.shippingAddress.locality}</div>}
                  <div style={{ color: "#38bdf8", fontWeight: 700 }}>
                    {orderData.shippingAddress.city}, {orderData.shippingAddress.state} - {orderData.shippingAddress.pinCode}
                  </div>
                  <div>{orderData.shippingAddress.country}</div>
                </div>
              ) : (
                <span style={{ color: "#ef4444" }}>⚠️ Missing shipping address</span>
              )}
            </div>

            {/* ORDER ITEMS SUMMARY */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 10 }}>ORDER CONTENTS</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orderData.items?.map((it: any) => (
                  <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#cbd5e1" }}>
                    <span>{it.productName}</span>
                    <span style={{ fontWeight: 700, color: "#fff" }}>×{it.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 2: DISPATCH & TRACKING ENTRY */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* COURIER & TRACKING INPUT BOX */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>COURIER &amp; TRACKING DETAILS</h3>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>COURIER SERVICE</label>
                <select
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "#1e293b", border: "1px solid #334155", color: "#fff", borderRadius: 6, fontSize: 13 }}
                >
                  {COMMON_COURIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>AWB / TRACKING NUMBER</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Enter Tracking Number e.g. TRK-987654"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    style={{ flex: 1, padding: "10px", background: "#1e293b", border: trackingNumber.trim() ? "1px solid #059669" : "1px solid #eab308", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 700 }}
                  />
                  <button
                    disabled={saving}
                    onClick={handleSaveTracking}
                    style={{ padding: "10px 14px", background: "#334155", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Save
                  </button>
                </div>
                {!trackingNumber.trim() && (
                  <span style={{ fontSize: 11, color: "#f59e0b", display: "block", marginTop: 4 }}>
                    ⚠️ Tracking number is required before marking order shipped.
                  </span>
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
                <button
                  onClick={() => setShowLabelModal(true)}
                  style={{ padding: "12px", background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}
                >
                  🖨️ PRINT SHIPPING LABEL
                </button>

                <button
                  disabled={!canShip || saving}
                  onClick={handleMarkShipped}
                  style={{
                    padding: "14px",
                    background: canShip ? "linear-gradient(135deg, #0066FF, #00E5FF)" : "#334155",
                    color: canShip ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 900,
                    fontSize: 15,
                    cursor: canShip ? "pointer" : "not-allowed",
                    boxShadow: canShip ? "0 4px 14px rgba(0, 102, 255, 0.4)" : "none",
                  }}
                >
                  {saving ? "SAVING..." : canShip ? "🚀 MARK SHIPPED & ADVANCE" : "CANNOT SHIP: Enter Tracking Number"}
                </button>
              </div>
            </div>

            {/* READY TO SHIP QUEUE PREVIEW */}
            {queueOrders.length > 0 && (
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 10 }}>READY TO SHIP QUEUE</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                  {queueOrders.map((q) => {
                    const isCurrent = q.id === currentOrderId;
                    return (
                      <div
                        key={q.id}
                        onClick={() => loadOrder(q.id)}
                        style={{
                          padding: "8px 12px",
                          background: isCurrent ? "#1e293b" : "#090d16",
                          border: isCurrent ? "1px solid #00E5FF" : "1px solid #1f2a3e",
                          borderRadius: 6,
                          fontSize: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontWeight: 700, color: isCurrent ? "#00E5FF" : "#fff" }}>#{q.orderNumber}</span>
                        <span style={{ color: "#94a3b8" }}>{q.customerName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRINTABLE SHIPPING LABEL MODAL */}
      {showLabelModal && orderData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", color: "#000", padding: 24, borderRadius: 12, maxWidth: 500, width: "90%" }}>
            <div id="printable-shipping-label" style={{ border: "2px solid #000", padding: 20, fontFamily: "sans-serif" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: 10, marginBottom: 14 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>ZAPPIT</h2>
                  <small style={{ fontSize: 10, textTransform: "uppercase" }}>Official Smart Business Card</small>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>ORDER #{orderData.order?.orderNumber}</div>
                  <div style={{ fontSize: 11 }}>Courier: {courier}</div>
                  {trackingNumber && <div style={{ fontSize: 11, fontWeight: 700 }}>AWB: {trackingNumber}</div>}
                </div>
              </div>

              {/* SENDER & RECIPIENT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14, fontSize: 12 }}>
                <div style={{ borderRight: "1px solid #ccc", paddingRight: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 10, color: "#666", marginBottom: 4 }}>SHIP FROM:</div>
                  <strong>ZAPPIT Technologies Pvt Ltd</strong>
                  <div>Fulfillment Center Hub 4</div>
                  <div>Manjeri, Malappuram, Kerala - 676121</div>
                  <div>Support: support@3gzappit.com</div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: 10, color: "#666", marginBottom: 4 }}>SHIP TO:</div>
                  <strong style={{ fontSize: 14 }}>{orderData.shippingAddress?.recipientName}</strong>
                  <div>Phone: {orderData.shippingAddress?.phone}</div>
                  <div>{orderData.shippingAddress?.house} {orderData.shippingAddress?.street}</div>
                  <div>{orderData.shippingAddress?.city}, {orderData.shippingAddress?.state}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>PIN: {orderData.shippingAddress?.pinCode}</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{ padding: "10px 20px", background: "#0066FF", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, cursor: "pointer" }}
              >
                🖨️ Print Label
              </button>
              <button onClick={() => setShowLabelModal(false)} style={{ padding: "10px 16px", background: "#eee", border: "1px solid #ccc", color: "#333", borderRadius: 6, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
