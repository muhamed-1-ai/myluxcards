"use client";

import { useCallback, useEffect, useState } from "react";

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR" }).format((minor || 0) / 100);

function formatDate(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const SHIPPING_STATUS_CLASS_MAP: Record<string, string> = {
  "Preparing": "shipping-badge-preparing",
  "Shipped": "shipping-badge-shipped",
  "Out for Delivery": "shipping-badge-out",
  "Delivered": "shipping-badge-delivered",
  "Delivery Failed": "shipping-badge-failed",
  "Return in Transit": "shipping-badge-transit",
  "Returned": "shipping-badge-returned",
};

export default function OrdersClient() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let response = await fetch("/api/orders", { cache: "no-store" });
      if (response.status === 401) {
        const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
        if (refreshed.ok) {
          response = await fetch("/api/orders", { cache: "no-store" });
        }
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load your orders.");
      }
      setOrders(payload.data || []);
    } catch (err: any) {
      setError(err.message || "Unable to load your orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleCopyAwb = (awb: string) => {
    if (!awb || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(awb).catch(() => {});
    setCopiedAwb(awb);
    setTimeout(() => setCopiedAwb(null), 2000);
  };

  return (
    <main className="orders-page">
      <header>
        <a href="/dashboard">← Dashboard</a>
        <span>MYLUXCARDS</span>
      </header>
      <section className="orders-hero">
        <p>YOUR ACCOUNT</p>
        <h1>My orders</h1>
        <span>Track purchases, payments, shipping, delivery, and invoices.</span>
      </section>
      {loading ? (
        <div className="orders-state">Loading your orders…</div>
      ) : error ? (
        <div className="orders-state error" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ marginBottom: "16px", color: "rgba(255,255,255,0.85)" }}>{error}</p>
          <button
            type="button"
            className="empty-orders-action"
            onClick={() => void fetchOrders()}
            style={{ display: "inline-block", cursor: "pointer", border: "none" }}
          >
            Retry
          </button>
        </div>
      ) : !orders.length ? (
        <section className="orders-state empty-orders">
          <div className="empty-orders-icon" aria-hidden>
            <svg viewBox="0 0 48 48">
              <path d="M8 15 24 7l16 8-16 8-16-8Z" />
              <path d="M8 15v18l16 8 16-8V15M24 23v18" />
            </svg>
          </div>
          <p className="empty-orders-label">YOUR ORDER HISTORY</p>
          <h2>No orders yet</h2>
          <p className="empty-orders-copy">
            When you purchase a Zappit NFC card, its payment, production, delivery, and invoice details will appear here.
          </p>
          <a className="empty-orders-action" href="/#materials">
            Choose your NFC card <span aria-hidden>→</span>
          </a>
        </section>
      ) : (
        <section className="orders-list">
          {orders.map((order) => {
            const shipping = order.shipping || {};
            const shippingStatus = shipping.shippingStatus || "Preparing";
            const isPreparing = shipping.isPreparing ?? (shippingStatus === "Preparing");
            const badgeClass = SHIPPING_STATUS_CLASS_MAP[shippingStatus] || "shipping-badge-preparing";
            const timeline = Array.isArray(shipping.timeline) ? shipping.timeline : [];

            return (
              <article key={order.id} className="order-card">
                <div className="order-top">
                  <div>
                    <small>ORDER</small>
                    <h2>{order.order_number}</h2>
                    <p>{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <div className="badges">
                    <b className={`shipping-status-pill ${badgeClass}`}>
                      <span className="dot" aria-hidden="true" />
                      {shippingStatus}
                    </b>
                    <b className="order-status-badge">{order.status}</b>
                    <b className={`payment ${order.payment_status?.toLowerCase()}`}>{order.payment_status}</b>
                  </div>
                </div>

                {/* Items Section */}
                <div className="order-items">
                  {order.order_items?.map((item: any) => {
                    const cust = item.customization || {};
                    const finish = cust.cardFinish || cust.finish || cust.material;
                    const printedName = cust.nameOnCard || cust.printedName || cust.fullName;
                    const company = cust.companyName || cust.company;

                    return (
                      <div key={item.id} className="order-item-row">
                        <div className="item-main">
                          <p className="item-name">
                            {item.product_name} <span className="item-qty">× {item.quantity}</span>
                          </p>
                          {(finish || printedName || company) && (
                            <div className="item-customization-tags">
                              {finish && <span className="custom-tag">Finish: {finish}</span>}
                              {printedName && <span className="custom-tag">Name: {printedName}</span>}
                              {company && <span className="custom-tag">{company}</span>}
                            </div>
                          )}
                        </div>
                        <strong className="item-price">{money(item.total_minor, order.currency)}</strong>
                      </div>
                    );
                  })}
                </div>

                {/* Dedicated Courier & Shipping Section */}
                <div className="order-shipping-section">
                  <div className="shipping-section-header">
                    <div className="shipping-title-row">
                      <span className="shipping-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="3" width="15" height="13" rx="2" />
                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                      </span>
                      <h3>Delivery & Shipment</h3>
                    </div>
                    {shipping.trackingUrl && (
                      <a
                        href={shipping.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="track-package-btn"
                      >
                        Track Package ↗
                      </a>
                    )}
                  </div>

                  {isPreparing ? (
                    <div className="shipping-preparing-card">
                      <div className="prep-icon-pulse">
                        <span className="prep-pulse-dot" />
                      </div>
                      <div className="prep-copy">
                        <h4>Your card is being prepared.</h4>
                        <p>
                          Our production team is crafting, programming, and quality-testing your custom NFC card.
                          Tracking and courier details will be published here as soon as your package is dispatched.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="shipping-details-grid">
                      <div className="shipping-detail-cell">
                        <span className="cell-label">Courier</span>
                        <span className="cell-value courier-name">{shipping.courier || "Assigned Partner"}</span>
                      </div>

                      <div className="shipping-detail-cell">
                        <span className="cell-label">Tracking / AWB</span>
                        <div className="awb-row">
                          <code className="awb-code">{shipping.trackingNumber || "In Transit"}</code>
                          {shipping.trackingNumber && (
                            <button
                              type="button"
                              onClick={() => handleCopyAwb(shipping.trackingNumber)}
                              className="copy-awb-button"
                              title="Copy Tracking Number"
                            >
                              {copiedAwb === shipping.trackingNumber ? "Copied!" : "Copy"}
                            </button>
                          )}
                        </div>
                      </div>

                      {shipping.dispatchedAt && (
                        <div className="shipping-detail-cell">
                          <span className="cell-label">Dispatched On</span>
                          <span className="cell-value">{formatDate(shipping.dispatchedAt)}</span>
                        </div>
                      )}

                      {shipping.actualDeliveryAt ? (
                        <div className="shipping-detail-cell highlight-delivered">
                          <span className="cell-label">Delivered On</span>
                          <span className="cell-value">{formatDate(shipping.actualDeliveryAt)}</span>
                        </div>
                      ) : shipping.estimatedDeliveryAt ? (
                        <div className="shipping-detail-cell">
                          <span className="cell-label">Estimated Delivery Date</span>
                          <span className="cell-value highlight-estimate">
                            {formatDate(shipping.estimatedDeliveryAt)}
                          </span>
                          <small className="estimate-sub">Courier estimate</small>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Simple, Clear Shipment Timeline */}
                  {timeline.length > 0 && (
                    <div className="shipping-timeline-container">
                      <h5 className="timeline-heading">Shipment Timeline</h5>
                      <div className="shipping-timeline">
                        {timeline.map((event: any, idx: number) => {
                          const isLatest = idx === timeline.length - 1;
                          return (
                            <div key={idx} className={`timeline-step ${isLatest ? "step-active" : "step-done"}`}>
                              <div className="step-marker">
                                <span className="marker-dot" />
                                {idx < timeline.length - 1 && <span className="marker-line" />}
                              </div>
                              <div className="step-content">
                                <div className="step-header">
                                  <strong className="step-label">{event.label || event.status}</strong>
                                  <span className="step-time">{formatDateTime(event.timestamp)}</span>
                                </div>
                                {event.note && <p className="step-note">{event.note}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Row */}
                <div className="order-bottom">
                  <div>
                    <small>TOTAL</small>
                    <strong>{money(order.total_minor, order.currency)}</strong>
                  </div>
                  <div className="order-actions">
                    <a
                      href={`/api/orders/${order.id}/invoice`}
                      target="_blank"
                      rel="noreferrer"
                      className="invoice-link-btn"
                    >
                      View Invoice
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
