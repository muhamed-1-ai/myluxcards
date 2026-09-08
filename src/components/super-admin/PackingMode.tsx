"use client";

import { useState, useEffect, useCallback } from "react";
import { buildPremiumQrSvg, svgToHighResPngBlob } from "@/lib/premiumQr";
import { calculateNextAction } from "@/lib/nextActionEngine";

interface PackingModeProps {
  initialOrderId?: string | null;
  onExit: () => void;
  onOpenWorkspace: (orderId: string) => void;
}

const DEFAULT_CHECKLIST_ITEMS = [
  { key: "nfcCard", label: "NFC Card / Product" },
  { key: "qrSticker", label: "QR Code Sticker" },
  { key: "ownerSticker", label: "Owner Contact Sticker" },
  { key: "packagingIncluded", label: "Branded Packaging" },
  { key: "invoice", label: "Tax Invoice / Packing Slip" },
];

export default function PackingMode({ initialOrderId, onExit, onOpenWorkspace }: PackingModeProps) {
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(initialOrderId || null);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(0);

  // Local checklist state
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // Load Order Details & Queue Count
  const loadOrder = useCallback(async (orderIdToFetch?: string | null) => {
    setLoading(true);
    setError("");
    setOrderData(null);
    try {
      // 1. Fetch orders queue count for packing
      const fulRes = await fetch("/api/super-admin/fulfillment", { cache: "no-store" });
      if (fulRes.ok) {
        const fulJson = await fulRes.json();
        setQueueCount(fulJson.today?.ordersToFulfill || 0);
      }

      let targetId = orderIdToFetch;

      // 2. If no target ID provided, fetch the oldest order needing packing
      if (!targetId) {
        const queueRes = await fetch("/api/super-admin/fulfillment?queue=packing", { cache: "no-store" });
        if (queueRes.ok) {
          const queueJson = await queueRes.json();
          const firstInQueue = queueJson.needingAttention?.[0] || queueJson.queue?.[0];
          if (firstInQueue) {
            targetId = firstInQueue.id;
          }
        }
      }

      if (!targetId) {
        setLoading(false);
        return;
      }

      setCurrentOrderId(targetId);

      // 3. Fetch exact order ship workspace details
      const res = await fetch(`/api/super-admin/orders/${targetId}/ship`, { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load packing order");
      }
      const json = await res.json();
      setOrderData(json);

      // Initialize checklist state
      const fulChecklist = json.fulfillment?.checklist || {};
      setChecklist({
        nfcCard: Boolean(fulChecklist.cardVerified || fulChecklist.cardProduced || fulChecklist.nfcCard),
        qrSticker: Boolean(fulChecklist.qrVerified || fulChecklist.qrSticker),
        ownerSticker: Boolean(fulChecklist.stickersIncluded || fulChecklist.ownerSticker),
        packagingIncluded: Boolean(fulChecklist.packagingIncluded),
        invoice: Boolean(fulChecklist.labelGenerated || fulChecklist.invoice),
      });
    } catch (e: any) {
      setError(e.message || "Error loading packing order");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrder(initialOrderId);
  }, [initialOrderId, loadOrder]);

  // Save Checklist Item Change
  const handleChecklistToggle = async (key: string) => {
    if (!currentOrderId || !orderData) return;
    const nextChecklist = { ...checklist, [key]: !checklist[key] };
    setChecklist(nextChecklist);

    try {
      await fetch(`/api/super-admin/orders/${currentOrderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklist: {
            ...orderData.fulfillment?.checklist,
            [key]: nextChecklist[key],
            qrVerified: nextChecklist.qrSticker,
            cardVerified: nextChecklist.nfcCard,
            stickersIncluded: nextChecklist.ownerSticker,
            packagingIncluded: nextChecklist.packagingIncluded,
          },
        }),
      });
    } catch (e) {
      console.error("Failed to persist checklist state", e);
    }
  };

  // Complete Packing Action
  const handleCompletePacking = async () => {
    if (!currentOrderId || !orderData) return;
    const totalRequired = DEFAULT_CHECKLIST_ITEMS.length;
    const completedCount = Object.values(checklist).filter(Boolean).length;

    if (completedCount < totalRequired) {
      alert(`Cannot complete packing: ${totalRequired - completedCount} items remaining in checklist.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/super-admin/orders/${currentOrderId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PACKED",
          timelineEvent: {
            status: "PACKED",
            note: "Packing checklist completed in Packing Mode. Order marked PACKED & READY TO SHIP.",
          },
          checklist: {
            ...orderData.fulfillment?.checklist,
            ...checklist,
            qrVerified: true,
            cardVerified: true,
            stickersIncluded: true,
            packagingIncluded: true,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to complete packing");
      }

      setSuccessToast(`PACKING COMPLETE ✓ Order #${orderData.order?.orderNumber} is ready to ship!`);
      setTimeout(() => setSuccessToast(""), 3000);

      // Auto-load Next Packing Order
      await loadOrder(null);
    } catch (e: any) {
      alert(e.message || "Error completing packing");
    } finally {
      setSaving(false);
    }
  };

  // Copy Full Shipping Address
  const handleCopyAddress = () => {
    if (!orderData?.shippingAddress) return;
    const sa = orderData.shippingAddress;
    const fullText = `${sa.recipientName}\nPhone: ${sa.phone}\n${sa.house} ${sa.street}\n${sa.locality ? sa.locality + ", " : ""}${sa.city}, ${sa.state} - ${sa.pinCode}\n${sa.country}`;
    navigator.clipboard.writeText(fullText);
    setCopyNotice("Copied Address ✓");
    setTimeout(() => setCopyNotice(""), 2000);
  };

  // Download QR vector
  const handleDownloadQr = async (format: "png" | "svg") => {
    if (!orderData?.qr?.url) return;
    const svgString = buildPremiumQrSvg(orderData.qr.url, { label: "3G ZAPPIT" });
    const filename = `zappit-qr-${orderData.order?.orderNumber || "order"}.${format}`;

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

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toUpperCase();
      if (key === "N") {
        e.preventDefault();
        loadOrder(null);
      } else if (key === "P") {
        e.preventDefault();
        handleCompletePacking();
      } else if (key === "Q") {
        e.preventDefault();
        setShowQrModal((prev) => !prev);
      } else if (key === "A") {
        e.preventDefault();
        handleCopyAddress();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadOrder, onExit, handleCompletePacking, handleCopyAddress]);

  const completedChecklistCount = Object.values(checklist).filter(Boolean).length;
  const isPackingComplete = completedChecklistCount === DEFAULT_CHECKLIST_ITEMS.length;
  const nextAction = orderData ? calculateNextAction(orderData) : null;

  return (
    <div style={{ background: "#090d16", minHeight: "85vh", borderRadius: 12, padding: "20px", color: "#fff", border: "1px solid #1c2638" }}>
      {/* HEADER BAR */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1f2a3e", paddingBottom: 16, marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ background: "linear-gradient(135deg, #f59e0b, #eab308)", color: "#000", fontWeight: 900, fontSize: 11, padding: "4px 10px", borderRadius: 6 }}>
            📦 PACKING MODE
          </span>
          {orderData?.order && (
            <h2 style={{ fontSize: 20, margin: 0, fontWeight: 800, letterSpacing: -0.5 }}>
              ORDER #{orderData.order.orderNumber}
            </h2>
          )}
          {queueCount > 0 && (
            <span style={{ background: "#1e293b", color: "#94a3b8", fontSize: 12, padding: "3px 9px", borderRadius: 12, border: "1px solid #334155" }}>
              {queueCount} orders waiting
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setShowHelpModal(true)}
            style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
          >
            ⌨️ Shortcuts (N, P, Q, A, Esc)
          </button>
          <button
            onClick={() => loadOrder(null)}
            style={{ background: "#111827", border: "1px solid #374151", color: "#e5e7eb", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            ⏭️ SKIP / NEXT
          </button>
          <button
            onClick={onExit}
            style={{ background: "#991b1b", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            ❌ Exit Packing Mode
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
          Fetching next order waiting for packing...
        </div>
      ) : error ? (
        <div style={{ padding: "40px", background: "#451a1a", border: "1px solid #7f1d1d", borderRadius: 8, color: "#fca5a5" }}>
          <h3 style={{ margin: "0 0 8px" }}>Error Loading Packing Order</h3>
          <p>{error}</p>
          <button onClick={() => loadOrder(null)} style={{ padding: "8px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>
            Retry / Next Order
          </button>
        </div>
      ) : !orderData ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "#0f172a", borderRadius: 10, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 20, color: "#52c41a" }}>No Orders Waiting for Packing!</h3>
          <p style={{ color: "#94a3b8", maxWidth: 450, margin: "0 auto 20px" }}>
            All active fulfillment orders have completed packing. You can exit packing mode or check the shipping queue.
          </p>
          <button onClick={onExit} style={{ padding: "10px 20px", background: "#0066FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>
            Return to Fulfillment Overview
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* COLUMN 1: CUSTOMER & PRODUCT DETAILS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* CALCULATED NEXT ACTION BANNER */}
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

            {/* CUSTOMER CARD */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>CUSTOMER</span>
                {orderData.order?.userId && (
                  <button
                    onClick={() => onOpenWorkspace(orderData.order.id)}
                    style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Open Workspace ↗
                  </button>
                )}
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "#f8fafc" }}>{orderData.customer?.name}</h3>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>📞 {orderData.customer?.phone || "N/A"}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>✉️ {orderData.customer?.email}</div>
            </div>

            {/* PRODUCTS LIST */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800, display: "block", marginBottom: 12 }}>ORDER ITEMS</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {orderData.items?.map((it: any) => (
                  <div key={it.id} style={{ background: "#1e293b", padding: 12, borderRadius: 8, border: "1px solid #334155" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                      <span>{it.productName}</span>
                      <span style={{ color: "#38bdf8" }}>×{it.quantity}</span>
                    </div>
                    {it.customization && Object.keys(it.customization).length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#94a3b8", background: "#0f172a", padding: 6, borderRadius: 4 }}>
                        {JSON.stringify(it.customization)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SHIPPING ADDRESS WITH 1-CLICK COPY */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>SHIPPING ADDRESS</span>
                <button
                  onClick={handleCopyAddress}
                  style={{ background: "#38bdf8", color: "#000", border: "none", padding: "4px 10px", borderRadius: 4, fontWeight: 800, fontSize: 11, cursor: "pointer" }}
                >
                  {copyNotice || "📋 COPY ADDRESS"}
                </button>
              </div>
              {orderData.shippingAddress ? (
                <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: "#fff" }}>{orderData.shippingAddress.recipientName}</div>
                  <div>Phone: {orderData.shippingAddress.phone}</div>
                  <div>{orderData.shippingAddress.house} {orderData.shippingAddress.street}</div>
                  <div>{orderData.shippingAddress.locality}</div>
                  <div>{orderData.shippingAddress.city}, {orderData.shippingAddress.state} - {orderData.shippingAddress.pinCode}</div>
                  <div>{orderData.shippingAddress.country}</div>
                </div>
              ) : (
                <span style={{ color: "#ef4444" }}>⚠️ No shipping address provided</span>
              )}
            </div>
          </div>

          {/* COLUMN 2: PACKING CHECKLIST & QR PREVIEW */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* PACKING CHECKLIST */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>PACKING CHECKLIST</h3>
                  <p style={{ color: "#94a3b8", fontSize: 12, margin: "2px 0 0" }}>Check off items as you pack into package.</p>
                </div>
                <span style={{ background: isPackingComplete ? "#059669" : "#334155", color: isPackingComplete ? "#34d399" : "#e2e8f0", padding: "4px 10px", borderRadius: 12, fontWeight: 800, fontSize: 12 }}>
                  {completedChecklistCount} / {DEFAULT_CHECKLIST_ITEMS.length} COMPLETE
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {DEFAULT_CHECKLIST_ITEMS.map((item) => {
                  const isChecked = Boolean(checklist[item.key]);
                  return (
                    <label
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        background: isChecked ? "#064e3b" : "#1e293b",
                        border: isChecked ? "1px solid #059669" : "1px solid #334155",
                        borderRadius: 8,
                        cursor: "pointer",
                        userSelect: "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleChecklistToggle(item.key)}
                        style={{ width: 18, height: 18, accentColor: "#10b981", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 14, fontWeight: isChecked ? 700 : 500, color: isChecked ? "#34d399" : "#f1f5f9" }}>
                        {item.label}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* PRIMARY ACTION BUTTON */}
              <button
                disabled={!isPackingComplete || saving}
                onClick={handleCompletePacking}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: isPackingComplete ? "linear-gradient(135deg, #10b981, #059669)" : "#334155",
                  color: isPackingComplete ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 900,
                  fontSize: 15,
                  cursor: isPackingComplete ? "pointer" : "not-allowed",
                  boxShadow: isPackingComplete ? "0 4px 14px rgba(16, 185, 129, 0.4)" : "none",
                }}
              >
                {saving ? "SAVING PACKING STATUS..." : isPackingComplete ? "✓ COMPLETE PACKING & ADVANCE" : `${DEFAULT_CHECKLIST_ITEMS.length - completedChecklistCount} ITEMS REMAINING`}
              </button>
            </div>

            {/* QR QUICK ACCESS & PREVIEW */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>CANONICAL PROFILE QR</span>
                <button
                  onClick={() => setShowQrModal(true)}
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#38bdf8", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  🔍 View Full QR
                </button>
              </div>

              {orderData.qr?.url ? (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ background: "#fff", padding: 8, borderRadius: 8, display: "inline-block" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(orderData.qr.url)}`}
                      alt="Profile QR"
                      style={{ width: 80, height: 80, display: "block" }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Canonical Target:</div>
                    <code style={{ background: "#1e293b", padding: "3px 6px", borderRadius: 4, fontSize: 11, color: "#38bdf8", wordBreak: "break-all" }}>
                      {orderData.qr.url}
                    </code>
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button onClick={() => handleDownloadQr("png")} style={{ background: "#334155", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        PNG
                      </button>
                      <button onClick={() => handleDownloadQr("svg")} style={{ background: "#334155", color: "#fff", border: "none", padding: "4px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        SVG
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ color: "#f59e0b" }}>⚠️ QR link pending slug assignment</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULL QR MODAL */}
      {showQrModal && orderData?.qr?.url && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24, maxWidth: 360, width: "90%", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 12px" }}>Profile QR - Order #{orderData.order?.orderNumber}</h3>
            <div style={{ background: "#fff", padding: 16, borderRadius: 12, display: "inline-block", marginBottom: 16 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(orderData.qr.url)}`}
                alt="Profile QR"
                style={{ width: 220, height: 220, display: "block" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => handleDownloadQr("png")} style={{ padding: "8px 16px", background: "#38bdf8", color: "#000", border: "none", borderRadius: 6, fontWeight: 800, cursor: "pointer" }}>
                Download PNG
              </button>
              <button onClick={() => handleDownloadQr("svg")} style={{ padding: "8px 16px", background: "#38bdf8", color: "#000", border: "none", borderRadius: 6, fontWeight: 800, cursor: "pointer" }}>
                Download SVG
              </button>
              <button onClick={() => setShowQrModal(false)} style={{ padding: "8px 16px", background: "#334155", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHORTCUTS HELP MODAL */}
      {showHelpModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 24, maxWidth: 400, width: "90%" }}>
            <h3 style={{ margin: "0 0 16px", borderBottom: "1px solid #1e293b", paddingBottom: 8 }}>⌨️ Packing Mode Keyboard Shortcuts</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <code style={{ background: "#1e293b", padding: "2px 8px", borderRadius: 4, color: "#38bdf8" }}>N</code>
                <span>Skip to Next Packing Order</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <code style={{ background: "#1e293b", padding: "2px 8px", borderRadius: 4, color: "#38bdf8" }}>P</code>
                <span>Complete Packing (when checklist 100%)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <code style={{ background: "#1e293b", padding: "2px 8px", borderRadius: 4, color: "#38bdf8" }}>Q</code>
                <span>Toggle QR Preview Modal</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <code style={{ background: "#1e293b", padding: "2px 8px", borderRadius: 4, color: "#38bdf8" }}>A</code>
                <span>Copy Full Shipping Address</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <code style={{ background: "#1e293b", padding: "2px 8px", borderRadius: 4, color: "#38bdf8" }}>Esc</code>
                <span>Exit Packing Mode</span>
              </div>
            </div>
            <button onClick={() => setShowHelpModal(false)} style={{ width: "100%", marginTop: 20, padding: "10px", background: "#38bdf8", color: "#000", border: "none", borderRadius: 6, fontWeight: 800, cursor: "pointer" }}>
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
