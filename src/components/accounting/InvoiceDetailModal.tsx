"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null;
  initialInvoiceData?: any;
  onEditDraft?: (invoiceId: string) => void;
  onRecordPayment?: (invoice: any) => void;
  onInvoiceUpdated?: () => void;
}

export default function InvoiceDetailModal({
  isOpen,
  onClose,
  invoiceId,
  initialInvoiceData,
  onEditDraft,
  onRecordPayment,
  onInvoiceUpdated,
}: InvoiceDetailModalProps) {
  const { activeWorkspace, formatMoney, canMutate, triggerRefresh } = useAccounting();

  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(initialInvoiceData || null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialInvoiceData) {
      setInvoiceData(initialInvoiceData);
      setLoading(false);
      return;
    }
    if (!invoiceId) return;
    let isMounted = true;

    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/accounting/invoices/${invoiceId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load invoice details");
        }
        const data = await res.json();
        if (isMounted) {
          setInvoiceData(data);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Error loading invoice");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, initialInvoiceData]);

  if (!isOpen) return null;

  const inv = invoiceData?.invoice;
  const contact = inv?.customer_snapshot || invoiceData?.contact;
  const lines = invoiceData?.lines || [];
  const payments = invoiceData?.payments || [];
  const settings = invoiceData?.settings || {};
  const seller = inv?.seller_snapshot || settings;
  const currency = activeWorkspace?.currency || inv?.currency || "INR";

  const handleIssueDraft = async () => {
    if (!inv || inv.status !== "DRAFT") return;
    setIssuing(true);
    try {
      const res = await fetch(`/api/accounting/invoices/${inv.id}/issue`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to issue draft invoice");
        return;
      }
      setInvoiceData((prev: any) => ({
        ...prev,
        invoice: {
          ...prev.invoice,
          status: "ISSUED",
          posted_journal_entry_id: data.invoice?.posted_journal_entry_id,
          seller_snapshot: data.invoice?.seller_snapshot || prev.invoice?.seller_snapshot,
          customer_snapshot: data.invoice?.customer_snapshot || prev.invoice?.customer_snapshot,
        },
      }));
      triggerRefresh();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || "Failed to issue draft");
    } finally {
      setIssuing(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!inv?.share_token) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/invoices/share/${inv.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  const handlePrint = () => {
    if (!inv) return;
    const win = window.open(`/api/accounting/invoices/${inv.id}/pdf`, "_blank");
    if (win) {
      win.focus();
    } else {
      window.print();
    }
  };

  const handleDownload = () => {
    if (!inv) return;
    window.location.href = `/api/accounting/invoices/${inv.id}/pdf?download=1`;
  };

  return (
    <div
      className="acc-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-detail-title"
    >
      <div
        className="acc-modal-content acc-invoice-detail-modal"
        style={{ maxWidth: "860px", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="acc-modal-header acc-print-hide">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h3 id="invoice-detail-title" className="acc-modal-title">
              {inv ? inv.invoice_number : "Invoice Details"}
            </h3>
            {inv && (
              <span
                className={`acc-badge ${
                  inv.status === "PAID"
                    ? "acc-badge-success"
                    : inv.status === "PARTIALLY_PAID"
                    ? "acc-badge-warning"
                    : inv.status === "ISSUED"
                    ? "acc-badge-info"
                    : inv.status === "OVERDUE"
                    ? "acc-badge-danger"
                    : "acc-badge-neutral"
                }`}
                style={{ fontSize: "0.8125rem", textTransform: "uppercase" }}
              >
                {inv.status}
              </span>
            )}
          </div>
          <button
            type="button"
            className="acc-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--acc-text-muted)" }}>
            Loading invoice details...
          </div>
        ) : error ? (
          <div className="acc-alert acc-alert-danger" style={{ margin: "1.5rem" }}>
            {error}
          </div>
        ) : !inv ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--acc-text-muted)" }}>
            Invoice not found.
          </div>
        ) : (
          <div className="acc-invoice-detail-scroll-body" style={{ overflowY: "auto", maxHeight: "calc(92vh - 75px)" }}>
            {/* Action Bar (Top) */}
            <div className="acc-detail-actions-bar acc-print-hide" style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid var(--acc-border)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {inv.status === "DRAFT" && canMutate && (
                  <>
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline acc-btn-sm"
                      onClick={() => {
                        onClose();
                        if (onEditDraft) onEditDraft(inv.id);
                      }}
                    >
                      ✏️ Edit Draft
                    </button>
                    <button
                      type="button"
                      className="acc-btn acc-btn-primary acc-btn-sm"
                      disabled={issuing}
                      onClick={handleIssueDraft}
                    >
                      {issuing ? "Issuing..." : "⚡ Issue Invoice"}
                    </button>
                  </>
                )}

                {(inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID") && canMutate && (
                  <button
                    type="button"
                    className="acc-btn acc-btn-primary acc-btn-sm"
                    onClick={() => {
                      onClose();
                      if (onRecordPayment) onRecordPayment(inv);
                    }}
                  >
                    💰 Record Payment
                  </button>
                )}

                {inv.status === "PAID" && (
                  <span
                    className="acc-badge acc-badge-success"
                    style={{ padding: "0.35rem 0.65rem", fontSize: "0.8125rem" }}
                  >
                    ✓ Settled in Full
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  onClick={handleCopyShareLink}
                  title="Copy customer share link"
                >
                  {copiedShareLink ? "✓ Link Copied!" : "🔗 Share Link"}
                </button>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  onClick={handleDownload}
                  title="Download HTML/PDF Document"
                >
                  ⬇️ Download
                </button>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  onClick={handlePrint}
                  title="Print or Save as PDF"
                >
                  🖨️ Print / PDF
                </button>
              </div>
            </div>

            {/* Printable Canonical White A4 Invoice Document */}
            <div
              className="acc-printable-invoice-sheet"
              style={{
                background: "#ffffff",
                color: "#0f172a",
                margin: "1.25rem 1.5rem",
                padding: "2rem",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              }}
            >
              {/* Sheet Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: "1.25rem" }}>
                <div style={{ maxWidth: "55%" }}>
                  {seller?.logo_url && (
                    <img
                      src={seller.logo_url}
                      alt="Logo"
                      style={{ maxHeight: "55px", maxWidth: "180px", objectFit: "contain", marginBottom: "0.5rem" }}
                    />
                  )}
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>
                    {seller?.business_name || activeWorkspace?.name || "Business Name"}
                  </h2>
                  <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.25rem", lineHeight: 1.4, whiteSpace: "pre-line" }}>
                    {seller?.address && <div>{seller.address}</div>}
                    {[seller?.phone, seller?.email, seller?.website].filter(Boolean).join(" · ")}
                    {seller?.tax_id && (
                      <div style={{ fontWeight: 600, color: "#1e293b", marginTop: "0.2rem" }}>
                        {seller.tax_label || "GSTIN"}: {seller.tax_id}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: "right", maxWidth: "40%" }}>
                  <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1e293b", letterSpacing: "-0.02em" }}>
                    INVOICE
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#2563eb", marginTop: "0.15rem" }}>
                    {inv.invoice_number}
                  </div>
                  {inv.direct_sale_number && (
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                      Direct Sale Ref: {inv.direct_sale_number}
                    </div>
                  )}
                  <div style={{ marginTop: "0.4rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: inv.status === "PAID" ? "#f0fdf4" : inv.status === "PARTIALLY_PAID" ? "#fffbeb" : "#eff6ff",
                        color: inv.status === "PAID" ? "#16a34a" : inv.status === "PARTIALLY_PAID" ? "#d97706" : "#2563eb",
                        border: "1px solid currentColor",
                      }}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Billed To & Dates */}
              <div style={{ display: "flex", justifyContent: "space-between", margin: "1.5rem 0" }}>
                <div style={{ maxWidth: "55%" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.05em" }}>
                    Billed To:
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", marginTop: "0.2rem" }}>
                    {contact?.name || inv.contact_name || "Direct Client"}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "#475569", marginTop: "0.2rem", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                    {contact?.address && <div>{contact.address}</div>}
                    {[contact?.email, contact?.phone].filter(Boolean).join(" · ")}
                  </div>
                </div>

                <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                  <div style={{ marginBottom: "0.35rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>Issue Date: </span>
                    <strong>{inv.issue_date?.slice(0, 10)}</strong>
                  </div>
                  <div style={{ marginBottom: "0.35rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>Due Date: </span>
                    <strong>{inv.due_date?.slice(0, 10)}</strong>
                  </div>
                  {inv.terms && (
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>Payment Terms: </span>
                      <span>{inv.terms}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginTop: "1.25rem", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                      <th style={{ width: "5%", padding: "0.6rem 0.5rem", textAlign: "center", color: "#475569" }}>#</th>
                      <th style={{ width: "48%", padding: "0.6rem 0.5rem", color: "#475569" }}>Description</th>
                      <th style={{ width: "12%", padding: "0.6rem 0.5rem", textAlign: "center", color: "#475569" }}>Qty</th>
                      <th style={{ width: "17%", padding: "0.6rem 0.5rem", textAlign: "right", color: "#475569" }}>Unit Price</th>
                      <th style={{ width: "18%", padding: "0.6rem 0.5rem", textAlign: "right", color: "#475569" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line: any, idx: number) => {
                      const hasDetails = line.model || line.sku || line.serial_number;
                      const hasWarranty = line.warranty_type && line.warranty_type !== "NONE";

                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "0.65rem 0.5rem", textAlign: "center", color: "#94a3b8" }}>{idx + 1}</td>
                          <td style={{ padding: "0.65rem 0.5rem" }}>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{line.description}</div>
                            {hasDetails && (
                              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                                {[
                                  line.model && `Model: ${line.model}`,
                                  line.sku && `SKU: ${line.sku}`,
                                  line.serial_number && `S/N: ${line.serial_number}`,
                                ].filter(Boolean).join(" · ")}
                              </div>
                            )}
                            {hasWarranty && (
                              <div
                                style={{
                                  marginTop: "0.35rem",
                                  padding: "0.35rem 0.55rem",
                                  background: "#f8fafc",
                                  borderLeft: "3px solid #2563eb",
                                  fontSize: "0.75rem",
                                  color: "#334155",
                                }}
                              >
                                <strong>🛡️ {line.warranty_type} Warranty</strong>
                                {line.warranty_duration_months && ` &bull; ${line.warranty_duration_months} Months`}
                                {line.warranty_start_date && line.warranty_end_date && ` (${line.warranty_start_date.slice(0, 10)} to ${line.warranty_end_date.slice(0, 10)})`}
                                {line.warranty_coverage && <div>Coverage: {line.warranty_coverage}</div>}
                                {line.warranty_exclusions && <div>Exclusions: {line.warranty_exclusions}</div>}
                                {line.warranty_contact && <div>Support: {line.warranty_contact}</div>}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "0.65rem 0.5rem", textAlign: "center" }} className="tabular-nums">
                            {Number(line.quantity)}
                          </td>
                          <td style={{ padding: "0.65rem 0.5rem", textAlign: "right" }} className="tabular-nums">
                            {formatMoney(line.unit_price_minor, currency)}
                          </td>
                          <td style={{ padding: "0.65rem 0.5rem", textAlign: "right", fontWeight: 600, color: "#0f172a" }} className="tabular-nums">
                            {formatMoney(line.total_minor, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                <div style={{ width: "300px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.85rem 1rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", color: "#475569" }}>
                    <span>Subtotal:</span>
                    <span className="tabular-nums">{formatMoney(inv.subtotal_minor, currency)}</span>
                  </div>
                  {Number(inv.discount_minor) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", color: "#16a34a" }}>
                      <span>Discount:</span>
                      <span className="tabular-nums">-{formatMoney(inv.discount_minor, currency)}</span>
                    </div>
                  )}
                  {Number(inv.tax_minor) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", color: "#475569" }}>
                      <span>Tax ({seller?.tax_label || "GST"}):</span>
                      <span className="tabular-nums">+{formatMoney(inv.tax_minor, currency)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", borderTop: "2px solid #cbd5e1", paddingTop: "0.45rem", marginTop: "0.45rem" }}>
                    <span>Total Amount:</span>
                    <span className="tabular-nums">{formatMoney(inv.total_minor, currency)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontWeight: 600, marginTop: "0.35rem" }}>
                    <span>Amount Paid:</span>
                    <span className="tabular-nums">{formatMoney(inv.amount_paid_minor, currency)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 800,
                      fontSize: "1rem",
                      borderTop: "1px dashed #cbd5e1",
                      paddingTop: "0.45rem",
                      marginTop: "0.45rem",
                      color: Number(inv.amount_due_minor) > 0 ? "#dc2626" : "#16a34a",
                    }}
                  >
                    <span>Balance Due:</span>
                    <span className="tabular-nums">{formatMoney(inv.amount_due_minor, currency)}</span>
                  </div>
                </div>
              </div>

              {/* Customer Notes, Warranty Terms & Policy */}
              {(inv.notes || inv.warranty_terms || inv.terms) && (
                <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem", fontSize: "0.825rem", color: "#475569" }}>
                  {inv.notes && (
                    <div style={{ marginBottom: "0.6rem" }}>
                      <strong style={{ color: "#334155" }}>Customer Notes &amp; Instructions:</strong>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: "0.15rem" }}>{inv.notes}</div>
                    </div>
                  )}
                  {inv.warranty_terms && (
                    <div style={{ marginBottom: "0.6rem" }}>
                      <strong style={{ color: "#334155" }}>Warranty Policy &amp; Terms:</strong>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: "0.15rem" }}>{inv.warranty_terms}</div>
                    </div>
                  )}
                  {inv.terms && (
                    <div>
                      <strong style={{ color: "#334155" }}>Terms &amp; Conditions:</strong>
                      <div style={{ whiteSpace: "pre-wrap", marginTop: "0.15rem" }}>{inv.terms}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Payment History Section */}
              <div style={{ marginTop: "1.75rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#334155" }}>
                  Payment History ({payments.length})
                </h4>
                {payments.length === 0 ? (
                  <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
                    {inv.status === "DRAFT"
                      ? "No payments can be collected on draft invoices."
                      : "No payments recorded yet for this invoice."}
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                          <th style={{ padding: "0.4rem 0.5rem" }}>Payment #</th>
                          <th style={{ padding: "0.4rem 0.5rem" }}>Date</th>
                          <th style={{ padding: "0.4rem 0.5rem" }}>Method / Ref</th>
                          <th style={{ padding: "0.4rem 0.5rem" }}>Account</th>
                          <th style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p: any) => (
                          <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "0.4rem 0.5rem", fontWeight: 600 }}>{p.payment_number}</td>
                            <td style={{ padding: "0.4rem 0.5rem" }}>{p.payment_date?.slice(0, 10)}</td>
                            <td style={{ padding: "0.4rem 0.5rem" }}>
                              {p.payment_method}
                              {p.reference_number && <span style={{ color: "#64748b" }}> (Ref: {p.reference_number})</span>}
                            </td>
                            <td style={{ padding: "0.4rem 0.5rem" }}>{p.account_name || "Payment Account"}</td>
                            <td style={{ padding: "0.4rem 0.5rem", textAlign: "right", fontWeight: 600, color: "#16a34a" }} className="tabular-nums">
                              {formatMoney(p.allocated_minor || p.amount_minor, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Internal Notes (Hidden on Print & Public View) */}
              {inv.internal_notes && (
                <div
                  className="acc-internal-notes-callout acc-print-hide"
                  style={{
                    marginTop: "1.5rem",
                    padding: "0.75rem",
                    background: "#f1f5f9",
                    borderRadius: "6px",
                    borderLeft: "3px solid #64748b",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e293b" }}>🔒 Internal Note</span>
                    <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.7rem" }}>Team Only</span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 0.35rem" }}>
                    Private note. Never shown on customer prints, shared links, or public views.
                  </p>
                  <div style={{ fontSize: "0.825rem", whiteSpace: "pre-wrap", color: "#334155" }}>
                    {inv.internal_notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
