"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";
import PaymentAccountPicker from "./PaymentAccountPicker";
import CreateInvoiceModal from "./CreateInvoiceModal";
import InvoiceDetailModal from "./InvoiceDetailModal";

interface InvoiceLine {
  id?: string;
  description: string;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  contact_id?: string;
  contact_name?: string;
  issue_date: string;
  due_date: string;
  total_minor: number;
  amount_paid_minor: number;
  amount_due_minor: number;
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID" | "OVERDUE";
  share_token?: string;
  lines?: InvoiceLine[];
}

export default function SalesInvoicesView() {
  const { activeWorkspace, formatMoney, accounts, refreshKey, triggerRefresh, canMutate } = useAccounting();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [walkinSaleOpen, setWalkinSaleOpen] = useState(false);
  const [recordPaymentInvoice, setRecordPaymentInvoice] = useState<Invoice | null>(null);
  const [shareModalInvoice, setShareModalInvoice] = useState<Invoice | null>(null);

  // Walk-in Sale Form State
  const [saleCustomerName, setSaleCustomerName] = useState("");
  const [saleAmountStr, setSaleAmountStr] = useState("");
  const [saleAccountId, setSaleAccountId] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  // Payment Allocation State
  const [payAmountStr, setPayAmountStr] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const invRes = await fetch(`/api/accounting/invoices?workspaceId=${activeWorkspace?.id}`);
        if (invRes.ok && isMounted) {
          const invData = await invRes.json();
          setInvoices(invData.invoices || []);
        }
      } catch (err) {
        console.error("Failed to load sales data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  // Walk-in Direct Sale Submit (No Lead Required)
  const handleWalkinSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(saleAmountStr);
    if (!activeWorkspace || isNaN(amt) || amt <= 0 || !saleAccountId) {
      alert("Please provide a valid amount and payment account.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          customerName: saleCustomerName.trim() || undefined,
          amountMinor: Math.round(amt * 100),
          financialAccountId: saleAccountId,
          notes: saleNotes || undefined,
          paymentMethod: "CASH",
        }),
      });

      if (res.ok) {
        setWalkinSaleOpen(false);
        setSaleCustomerName("");
        setSaleAmountStr("");
        setSaleNotes("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record direct sale");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Record Partial or Full Payment on Invoice
  const handleInvoicePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordPaymentInvoice || !activeWorkspace) return;
    setPayError(null);

    const amt = parseFloat(payAmountStr);
    if (isNaN(amt) || amt <= 0 || !payAccountId) {
      setPayError("Please provide a valid payment amount and deposit account.");
      return;
    }

    const payMinor = Math.round(amt * 100);
    if (payMinor > recordPaymentInvoice.amount_due_minor) {
      setPayError(`Cannot overpay invoice. Maximum balance due is ${formatMoney(recordPaymentInvoice.amount_due_minor, activeWorkspace?.currency)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const idempotencyKey = `PAY-COLL-${recordPaymentInvoice.id}-${payMinor}-${Date.now()}`;
      const res = await fetch(`/api/accounting/payments?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          invoiceId: recordPaymentInvoice.id,
          contactId: recordPaymentInvoice.contact_id,
          type: "IN",
          amountMinor: payMinor,
          financialAccountId: payAccountId,
          paymentDate: new Date().toISOString().slice(0, 10),
          notes: `Payment for Invoice ${recordPaymentInvoice.invoice_number}`,
          allocations: [{ invoiceId: recordPaymentInvoice.id, amountMinor: payMinor }],
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Immediate optimistic update so invoice reflects payment without manual reload
        const updatedPaid = Number(recordPaymentInvoice.amount_paid_minor) + payMinor;
        const updatedDue = Math.max(0, Number(recordPaymentInvoice.amount_due_minor) - payMinor);
        const updatedStatus = updatedDue === 0 ? "PAID" : "PARTIALLY_PAID";

        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === recordPaymentInvoice.id
              ? { ...inv, amount_paid_minor: updatedPaid, amount_due_minor: updatedDue, status: updatedStatus }
              : inv
          )
        );

        setSuccessToast(
          `Collection of ${formatMoney(payMinor, activeWorkspace?.currency)} recorded successfully for ${recordPaymentInvoice.invoice_number}.`
        );
        setRecordPaymentInvoice(null);
        setPayAmountStr("");
        setPayAccountId("");
        setPayError(null);
        triggerRefresh();
      } else {
        setPayError(data.error || "Failed to record invoice payment");
      }
    } catch (err: any) {
      setPayError(err.message || "Network request failed. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Sales & Invoices</h2>
          <p className="acc-subtitle">Walk-in sales, client invoices, and receipts.</p>
        </div>

        <div className="acc-header-actions">
          {canMutate && (
            <>
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                onClick={() => setWalkinSaleOpen(true)}
              >
                + Walk-in Direct Sale
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => setCreateInvoiceOpen(true)}
              >
                + Create Invoice
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Feedback Banner */}
      {successToast && (
        <div
          className="acc-alert acc-alert-success"
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
              padding: "0 0.25rem",
            }}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            No invoices created yet. Click "+ Create Invoice" or "+ Walk-in Direct Sale" to start.
          </div>
        ) : (
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th className="acc-align-right">Total</th>
                  <th className="acc-align-right">Paid</th>
                  <th className="acc-align-right">Balance Due</th>
                  <th>Status</th>
                  <th className="acc-align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setDetailInvoiceId(inv.id)}
                  >
                    <td style={{ fontWeight: 700 }}>{inv.invoice_number}</td>
                    <td>{inv.contact_name || "Direct Client"}</td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{inv.issue_date}</td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{inv.due_date}</td>
                    <td className="acc-align-right tabular-nums font-semibold">
                      {formatMoney(inv.total_minor, activeWorkspace?.currency)}
                    </td>
                    <td className="acc-align-right tabular-nums" style={{ color: "var(--acc-success)" }}>
                      {formatMoney(inv.amount_paid_minor, activeWorkspace?.currency)}
                    </td>
                    <td
                      className="acc-align-right tabular-nums font-bold"
                      style={{ color: inv.amount_due_minor > 0 ? "var(--acc-danger)" : "inherit" }}
                    >
                      {formatMoney(inv.amount_due_minor, activeWorkspace?.currency)}
                    </td>
                    <td>
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
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="acc-align-right" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: "0.375rem", alignItems: "center" }}>
                        {inv.status === "DRAFT" && canMutate ? (
                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-outline"
                            style={{ padding: "0.2rem 0.5rem" }}
                            onClick={() => {
                              setEditingInvoiceId(inv.id);
                              setCreateInvoiceOpen(true);
                            }}
                          >
                            Edit
                          </button>
                        ) : inv.amount_due_minor > 0 && canMutate ? (
                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-primary"
                            style={{ padding: "0.2rem 0.5rem" }}
                            onClick={() => {
                              setPayError(null);
                              setRecordPaymentInvoice(inv);
                              setPayAmountStr((inv.amount_due_minor / 100).toString());
                              const defaultAcc = accounts.find(
                                (a) => a.is_payment_account || (a.type === "ASSET" && ["BANK", "CASH"].includes(a.subtype))
                              );
                              setPayAccountId(defaultAcc?.id || "");
                            }}
                          >
                            Collect
                          </button>
                        ) : inv.status === "PAID" || inv.amount_due_minor === 0 ? (
                          <span className="acc-badge acc-badge-success" style={{ padding: "0.2rem 0.5rem" }}>
                            Settled
                          </span>
                        ) : null}

                        <button
                          type="button"
                          className="acc-btn acc-btn-sm acc-btn-outline"
                          style={{ padding: "0.2rem 0.5rem" }}
                          onClick={() => setDetailInvoiceId(inv.id)}
                          title="View full invoice details"
                        >
                          View
                        </button>

                        <button
                          type="button"
                          className="acc-btn acc-btn-sm acc-btn-outline"
                          style={{ padding: "0.2rem 0.5rem" }}
                          onClick={() => setShareModalInvoice(inv)}
                          title="Share public link"
                        >
                          Share
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Walk-in Direct Sale Modal */}
      {walkinSaleOpen && (
        <div className="acc-modal-backdrop" onClick={() => setWalkinSaleOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Walk-in Direct Sale</h3>
              <button type="button" className="acc-modal-close" onClick={() => setWalkinSaleOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Instant sale with cash or digital payment collected immediately. No lead or complex invoice required.
            </p>
            <form onSubmit={handleWalkinSale}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="sale-amount">Sale Amount (₹) *</label>
                <FormattedMoneyInput
                  id="sale-amount"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={saleAmountStr}
                  onChange={(e) => setSaleAmountStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="sale-account">Deposited To Account *</label>
                <PaymentAccountPicker
                  id="sale-account"
                  value={saleAccountId}
                  onChange={setSaleAccountId}
                  placeholder="Select Cash, Bank, or UPI..."
                  accountFilter={(a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR"].includes(a.subtype)}
                  required
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="sale-customer">Customer Name (Optional)</label>
                <input
                  id="sale-customer"
                  type="text"
                  className="acc-form-input"
                  placeholder="Walk-in Customer"
                  value={saleCustomerName}
                  onChange={(e) => setSaleCustomerName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="sale-notes">Notes / Item description</label>
                <input
                  id="sale-notes"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. 2 x T-Shirt, Consultation fee"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setWalkinSaleOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Posting..." : "Record Direct Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create & Edit Invoice Modal */}
      <CreateInvoiceModal
        isOpen={createInvoiceOpen}
        invoiceIdToEdit={editingInvoiceId}
        onClose={() => {
          setCreateInvoiceOpen(false);
          setEditingInvoiceId(null);
        }}
        onInvoiceSaved={(savedInv, isIssued) => {
          triggerRefresh();
          setSuccessToast(
            isIssued
              ? `Invoice ${savedInv.invoice_number} created & issued successfully.`
              : `Draft invoice ${savedInv.invoice_number} saved.`
          );
          setDetailInvoiceId(savedInv.id);
        }}
      />

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        isOpen={Boolean(detailInvoiceId)}
        invoiceId={detailInvoiceId}
        onClose={() => setDetailInvoiceId(null)}
        onEditDraft={(id) => {
          setDetailInvoiceId(null);
          setEditingInvoiceId(id);
          setCreateInvoiceOpen(true);
        }}
        onRecordPayment={(inv) => {
          setPayError(null);
          setRecordPaymentInvoice(inv);
          setPayAmountStr((inv.amount_due_minor / 100).toString());
          const defaultAcc = accounts.find(
            (a) => a.is_payment_account || (a.type === "ASSET" && ["BANK", "CASH"].includes(a.subtype))
          );
          setPayAccountId(defaultAcc?.id || "");
        }}
        onInvoiceUpdated={() => {
          triggerRefresh();
        }}
      />

      {/* Collect / Record Payment Modal */}
      {recordPaymentInvoice && (
        <div className="acc-modal-backdrop" onClick={() => setRecordPaymentInvoice(null)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Record Payment - {recordPaymentInvoice.invoice_number}</h3>
              <button type="button" className="acc-modal-close" onClick={() => setRecordPaymentInvoice(null)}>✕</button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Total Invoice: {formatMoney(recordPaymentInvoice.total_minor, activeWorkspace?.currency)} · Outstanding Balance Due:{" "}
              <strong>{formatMoney(recordPaymentInvoice.amount_due_minor, activeWorkspace?.currency)}</strong>
            </p>
            <form onSubmit={handleInvoicePayment}>
              {payError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {payError}
                </div>
              )}
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="pay-amt-input">Amount Received (₹) *</label>
                <FormattedMoneyInput
                  id="pay-amt-input"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  value={payAmountStr}
                  onChange={(e) => setPayAmountStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="pay-account-sel">Deposit Account *</label>
                <PaymentAccountPicker
                  id="pay-account-sel"
                  value={payAccountId}
                  onChange={setPayAccountId}
                  placeholder="Select receiving Cash or Bank account..."
                  accountFilter={(a) => Boolean(a.is_payment_account || (a.type === "ASSET" && ["CASH", "BANK"].includes(a.subtype)))}
                  required
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setRecordPaymentInvoice(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Processing..." : "Confirm Collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Link Modal */}
      {shareModalInvoice && (
        <div className="acc-modal-backdrop" onClick={() => setShareModalInvoice(null)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Share Invoice {shareModalInvoice.invoice_number}</h3>
              <button type="button" className="acc-modal-close" onClick={() => setShareModalInvoice(null)}>✕</button>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Secure public link. Anyone with this link can view this invoice and payment details without general ledger access.
            </p>
            <div className="acc-form-group">
              <label className="acc-form-label">Public Link</label>
              <input
                type="text"
                readOnly
                className="acc-form-input tabular-nums"
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/accounting/invoices/public/${shareModalInvoice.share_token || "sample"}`}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  const url = `${window.location.origin}/api/accounting/invoices/public/${shareModalInvoice.share_token}`;
                  navigator.clipboard.writeText(url);
                  alert("Invoice link copied to clipboard!");
                }}
              >
                Copy Link
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-outline"
                style={{ flex: 1 }}
                onClick={() => setShareModalInvoice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
