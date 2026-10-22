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
  }, [isOpen, invoiceId]);

  if (!isOpen) return null;

  const inv = invoiceData?.invoice;
  const contact = invoiceData?.contact;
  const lines = invoiceData?.lines || [];
  const payments = invoiceData?.payments || [];
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
    const url = `${origin}/api/accounting/invoices/public/${inv.share_token}`;
    navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  const handlePrint = () => {
    window.print();
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
          <div className="acc-invoice-detail-scroll-body">
            {/* Action Bar (Top) */}
            <div className="acc-detail-actions-bar acc-print-hide">
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                  title="Copy secure link for customer"
                >
                  {copiedShareLink ? "✓ Link Copied!" : "🔗 Share"}
                </button>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  onClick={handlePrint}
                  title="Print or Save as PDF"
                >
                  🖨️ Download PDF / Print
                </button>
              </div>
            </div>

            {/* Printable Canonical Invoice Document */}
            <div className="acc-printable-invoice-sheet">
              {/* Sheet Header */}
              <div className="acc-sheet-header">
                <div>
                  <h2 className="acc-sheet-company">{activeWorkspace?.name || "ZAPPIT Workspace"}</h2>
                  <p className="acc-sheet-subtitle">Client Invoice</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="acc-sheet-inv-number">{inv.invoice_number}</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginTop: "0.25rem" }}>
                    Status: <strong style={{ textTransform: "uppercase" }}>{inv.status}</strong>
                  </div>
                </div>
              </div>

              {/* Billed To & Dates */}
              <div className="acc-sheet-grid">
                <div>
                  <span className="acc-sheet-label">Billed To:</span>
                  <div className="acc-sheet-customer-name">
                    {contact?.name || inv.contact_name || "Direct Client"}
                  </div>
                  {(contact?.email || inv.contact_email) && (
                    <div className="acc-sheet-meta-text">{contact?.email || inv.contact_email}</div>
                  )}
                  {(contact?.phone || inv.contact_phone) && (
                    <div className="acc-sheet-meta-text">{contact?.phone || inv.contact_phone}</div>
                  )}
                  {(contact?.address || inv.contact_address) && (
                    <div className="acc-sheet-meta-text" style={{ whiteSpace: "pre-line", marginTop: "0.25rem" }}>
                      {contact?.address || inv.contact_address}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <span className="acc-sheet-label">Issue Date</span>
                    <div className="acc-sheet-value">{inv.issue_date?.slice(0, 10)}</div>
                  </div>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <span className="acc-sheet-label">Due Date</span>
                    <div className="acc-sheet-value">{inv.due_date?.slice(0, 10)}</div>
                  </div>
                  {inv.terms && (
                    <div>
                      <span className="acc-sheet-label">Payment Terms</span>
                      <div className="acc-sheet-value">{inv.terms}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="acc-table-wrapper" style={{ marginTop: "1.5rem" }}>
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45%" }}>Description</th>
                      <th className="acc-align-right" style={{ width: "15%" }}>Qty</th>
                      <th className="acc-align-right" style={{ width: "20%" }}>Unit Price</th>
                      <th className="acc-align-right" style={{ width: "20%" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{line.description}</td>
                        <td className="acc-align-right tabular-nums">{Number(line.quantity)}</td>
                        <td className="acc-align-right tabular-nums">
                          {formatMoney(line.unit_price_minor, currency)}
                        </td>
                        <td className="acc-align-right tabular-nums font-semibold">
                          {formatMoney(line.total_minor, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Breakdown */}
              <div className="acc-sheet-totals-box">
                <div className="acc-sheet-total-row">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">{formatMoney(inv.subtotal_minor, currency)}</span>
                </div>
                {Number(inv.discount_minor) > 0 && (
                  <div className="acc-sheet-total-row" style={{ color: "var(--acc-success)" }}>
                    <span>Discount:</span>
                    <span className="tabular-nums">-{formatMoney(inv.discount_minor, currency)}</span>
                  </div>
                )}
                {Number(inv.tax_minor) > 0 && (
                  <div className="acc-sheet-total-row">
                    <span>Tax:</span>
                    <span className="tabular-nums">+{formatMoney(inv.tax_minor, currency)}</span>
                  </div>
                )}
                <div className="acc-sheet-total-row acc-sheet-grand-row">
                  <span>Total Amount:</span>
                  <span className="tabular-nums font-bold">{formatMoney(inv.total_minor, currency)}</span>
                </div>
                <div className="acc-sheet-total-row" style={{ color: "var(--acc-success)", paddingTop: "0.25rem" }}>
                  <span>Amount Paid:</span>
                  <span className="tabular-nums">{formatMoney(inv.amount_paid_minor, currency)}</span>
                </div>
                <div
                  className="acc-sheet-total-row"
                  style={{
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    color: Number(inv.amount_due_minor) > 0 ? "var(--acc-danger)" : "inherit",
                    borderTop: "1px solid var(--acc-border)",
                    marginTop: "0.25rem",
                    paddingTop: "0.5rem",
                  }}
                >
                  <span>Balance Due:</span>
                  <span className="tabular-nums">{formatMoney(inv.amount_due_minor, currency)}</span>
                </div>
              </div>

              {/* Payment Instructions / Notes (Visible to Customer) */}
              {inv.notes && (
                <div className="acc-sheet-notes-section">
                  <span className="acc-sheet-label">Payment Instructions & Notes</span>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
                    {inv.notes}
                  </p>
                </div>
              )}

              {/* Payment History Section */}
              <div className="acc-payment-history-section" style={{ marginTop: "1.75rem" }}>
                <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                  Payment History ({payments.length})
                </h4>
                {payments.length === 0 ? (
                  <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", margin: 0 }}>
                    {inv.status === "DRAFT"
                      ? "No payments can be collected on draft invoices."
                      : "No payments recorded yet for this invoice."}
                  </p>
                ) : (
                  <div className="acc-table-wrapper">
                    <table className="acc-table" style={{ fontSize: "0.8125rem" }}>
                      <thead>
                        <tr>
                          <th>Payment #</th>
                          <th>Date</th>
                          <th>Method / Ref</th>
                          <th>Account</th>
                          <th className="acc-align-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p: any) => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                            <td>{p.payment_date?.slice(0, 10)}</td>
                            <td>
                              <div>{p.payment_method}</div>
                              {p.reference_number && (
                                <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                                  Ref: {p.reference_number}
                                </div>
                              )}
                            </td>
                            <td>{p.account_name || "Bank / Cash"}</td>
                            <td className="acc-align-right tabular-nums font-semibold" style={{ color: "var(--acc-success)" }}>
                              {formatMoney(p.allocated_minor || p.amount_minor, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Internal Notes (Strictly Hidden on Print & Public View) */}
              {inv.internal_notes && (
                <div className="acc-internal-notes-callout acc-print-hide" style={{ marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700 }}>🔒 Internal Note</span>
                    <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.7rem", padding: "0.1rem 0.35rem" }}>
                      Private to Team
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", margin: "0 0 0.5rem" }}>
                    This note is strictly internal and never appears on customer previews, public links, or printed PDFs.
                  </p>
                  <div style={{ fontSize: "0.875rem", whiteSpace: "pre-wrap", background: "var(--acc-raised)", padding: "0.75rem", borderRadius: "var(--acc-radius-sm)" }}>
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
