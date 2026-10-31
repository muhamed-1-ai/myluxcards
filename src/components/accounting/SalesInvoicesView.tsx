"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";
import PaymentAccountPicker from "./PaymentAccountPicker";
import CreateInvoiceModal from "./CreateInvoiceModal";
import InvoiceDetailModal from "./InvoiceDetailModal";
import InvoiceSettingsModal from "./InvoiceSettingsModal";

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
  direct_sale_id?: string;
  direct_sale_number?: string;
  lines?: InvoiceLine[];
}

interface DirectSale {
  id: string;
  sale_number: string;
  contact_id?: string | null;
  contact_name?: string | null;
  date: string;
  total_minor: number;
  paid_minor: number;
  payment_method: string;
  financial_account_id?: string;
  account_name?: string;
  invoice_id?: string | null;
  invoice_number?: string | null;
  notes?: string | null;
  status: string;
}

export default function SalesInvoicesView() {
  const { activeWorkspace, formatMoney, accounts, refreshKey, triggerRefresh, canMutate } = useAccounting();

  const [activeTab, setActiveTab] = useState<"INVOICES" | "SALES">("INVOICES");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [directSales, setDirectSales] = useState<DirectSale[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [directSaleToConvert, setDirectSaleToConvert] = useState<DirectSale | null>(null);
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
        const [invRes, salesRes] = await Promise.all([
          fetch(`/api/accounting/invoices?workspaceId=${activeWorkspace?.id}`),
          fetch(`/api/accounting/sales`),
        ]);

        if (isMounted) {
          if (invRes.ok) {
            const invData = await invRes.json();
            setInvoices(invData.invoices || []);
          }
          if (salesRes.ok) {
            const salesData = await salesRes.json();
            setDirectSales(salesData.sales || []);
          }
        }
      } catch (err) {
        console.error("Failed to load sales data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
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
        const data = await res.json();
        setWalkinSaleOpen(false);
        setSaleCustomerName("");
        setSaleAmountStr("");
        setSaleNotes("");
        setSuccessToast(`Direct sale ${data.sale?.sale_number || "recorded"} successfully.`);
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
          type: "IN",
          contactId: recordPaymentInvoice.contact_id || null,
          financialAccountId: payAccountId,
          amountMinor: payMinor,
          allocations: [{ invoiceId: recordPaymentInvoice.id, amountMinor: payMinor }],
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPayError(data.error || "Failed to record payment");
        return;
      }

      setRecordPaymentInvoice(null);
      setSuccessToast(`Payment of ${formatMoney(payMinor, activeWorkspace?.currency)} applied to ${recordPaymentInvoice.invoice_number}.`);
      triggerRefresh();
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="acc-sales-view">
      {/* Header */}
      <div className="acc-sales-header">
        <div className="acc-sales-title-group">
          <h2 className="acc-title">Sales &amp; Invoices</h2>
          <p className="acc-subtitle">Customer invoices, walk-in sales, and receipts.</p>
        </div>

        <div className="acc-sales-header-actions">
          <button
            type="button"
            className="acc-btn acc-btn-outline acc-sales-action-btn"
            onClick={() => setInvoiceSettingsOpen(true)}
            title="Configure invoice logo, tax details, terms, and numbering"
          >
            ⚙️ Invoice Settings
          </button>
          {canMutate && (
            <>
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-sales-action-btn"
                onClick={() => setWalkinSaleOpen(true)}
              >
                + Walk-in Direct Sale
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-sales-action-btn"
                onClick={() => {
                  setEditingInvoiceId(null);
                  setDirectSaleToConvert(null);
                  setCreateInvoiceOpen(true);
                }}
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
            marginTop: "1rem",
            marginBottom: "0.25rem",
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

      {/* Sub Tabs */}
      <div className={`acc-sales-tabs-wrapper ${successToast ? "acc-has-toast" : ""}`}>
        <div className="acc-sales-tabs-scroll" role="tablist" aria-label="Sales and Invoices Sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "INVOICES"}
            className={`acc-btn acc-sales-tab-btn ${activeTab === "INVOICES" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTab("INVOICES")}
          >
            📄 Invoices ({invoices.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "SALES"}
            className={`acc-btn acc-sales-tab-btn ${activeTab === "SALES" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTab("SALES")}
          >
            ⚡ Walk-in Direct Sales ({directSales.length})
          </button>
        </div>
      </div>

      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading records...
          </div>
        ) : activeTab === "INVOICES" ? (
          /* INVOICES TABLE */
          invoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              No invoices created yet. Click "+ Create Invoice" or convert a Walk-in Direct Sale.
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
                      <td style={{ fontWeight: 700 }}>
                        {inv.invoice_number}
                        {inv.direct_sale_number && (
                          <div style={{ fontSize: "0.7rem", color: "var(--acc-text-muted)" }}>
                            Direct Sale: {inv.direct_sale_number}
                          </div>
                        )}
                      </td>
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
                                setDirectSaleToConvert(null);
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
                          ) : null}

                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-outline"
                            style={{ padding: "0.2rem 0.5rem" }}
                            title="Print / Save PDF"
                            onClick={() => window.open(`/api/accounting/invoices/${inv.id}/pdf`, "_blank")}
                          >
                            🖨️ PDF
                          </button>

                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-outline"
                            style={{ padding: "0.2rem 0.5rem" }}
                            title="Share invoice link"
                            onClick={() => setShareModalInvoice(inv)}
                          >
                            🔗 Share
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* DIRECT SALES TABLE */
          directSales.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              No direct walk-in sales recorded yet. Click "+ Walk-in Direct Sale" to record one.
            </div>
          ) : (
            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Sale #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Account</th>
                    <th className="acc-align-right">Amount</th>
                    <th>Status</th>
                    <th>Linked Invoice</th>
                    <th className="acc-align-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {directSales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ fontWeight: 700 }}>{sale.sale_number}</td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                        {sale.date?.slice(0, 10)}
                      </td>
                      <td>{sale.contact_name || "Walk-in Customer"}</td>
                      <td style={{ fontSize: "0.8125rem" }}>{sale.account_name || "Cash / Bank"}</td>
                      <td className="acc-align-right tabular-nums font-semibold" style={{ color: "var(--acc-success)" }}>
                        {formatMoney(sale.total_minor, activeWorkspace?.currency)}
                      </td>
                      <td>
                        <span className="acc-badge acc-badge-success">{sale.status}</span>
                      </td>
                      <td>
                        {sale.invoice_id ? (
                          <button
                            type="button"
                            className="acc-link-btn"
                            style={{ color: "var(--acc-blue)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            onClick={() => setDetailInvoiceId(sale.invoice_id!)}
                          >
                            📄 {sale.invoice_number || "View Invoice"}
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Not Invoiced</span>
                        )}
                      </td>
                      <td className="acc-align-right">
                        {!sale.invoice_id && canMutate && sale.status !== "VOID" ? (
                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-outline"
                            onClick={() => {
                              setDirectSaleToConvert(sale);
                              setEditingInvoiceId(null);
                              setCreateInvoiceOpen(true);
                            }}
                            title="Create and issue an official invoice for this direct sale"
                          >
                            + Create Invoice
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Invoice Settings Modal */}
      {invoiceSettingsOpen && (
        <InvoiceSettingsModal
          isOpen={invoiceSettingsOpen}
          onClose={() => setInvoiceSettingsOpen(false)}
          onSaved={() => triggerRefresh()}
        />
      )}

      {/* Create / Edit Invoice Modal */}
      {createInvoiceOpen && (
        <CreateInvoiceModal
          isOpen={createInvoiceOpen}
          onClose={() => {
            setCreateInvoiceOpen(false);
            setEditingInvoiceId(null);
            setDirectSaleToConvert(null);
          }}
          invoiceIdToEdit={editingInvoiceId}
          directSaleToConvert={directSaleToConvert}
          onInvoiceSaved={(inv, isIssued) => {
            setSuccessToast(
              isIssued
                ? `Invoice ${inv.invoice_number} issued successfully.`
                : `Invoice ${inv.invoice_number} saved as draft.`
            );
            triggerRefresh();
          }}
        />
      )}

      {/* Invoice Detail / Printable Preview Modal */}
      {detailInvoiceId && (
        <InvoiceDetailModal
          isOpen={Boolean(detailInvoiceId)}
          onClose={() => setDetailInvoiceId(null)}
          invoiceId={detailInvoiceId}
          onEditDraft={(id) => {
            setDetailInvoiceId(null);
            setEditingInvoiceId(id);
            setDirectSaleToConvert(null);
            setCreateInvoiceOpen(true);
          }}
          onRecordPayment={(inv) => {
            setDetailInvoiceId(null);
            setPayError(null);
            setRecordPaymentInvoice(inv);
            setPayAmountStr((inv.amount_due_minor / 100).toString());
            const defaultAcc = accounts.find(
              (a) => a.is_payment_account || (a.type === "ASSET" && ["BANK", "CASH"].includes(a.subtype))
            );
            setPayAccountId(defaultAcc?.id || "");
          }}
          onInvoiceUpdated={() => triggerRefresh()}
        />
      )}

      {/* Walk-in Direct Sale Modal */}
      {walkinSaleOpen && (
        <div className="acc-modal-backdrop" onClick={() => setWalkinSaleOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">+ Record Walk-in Direct Sale</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setWalkinSaleOpen(false)}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Quick over-the-counter transaction without a CRM lead. Posts Cash/Bank received and Sales Revenue directly to general ledger.
            </p>

            <form onSubmit={handleWalkinSale}>
              <div className="acc-form-group">
                <label className="acc-form-label">Customer Name (Optional)</label>
                <input
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. Walk-in Guest, Rahul Sharma"
                  value={saleCustomerName}
                  onChange={(e) => setSaleCustomerName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label">Total Amount ({activeWorkspace?.currency || "INR"}) *</label>
                <FormattedMoneyInput
                  required
                  placeholder="0.00"
                  value={saleAmountStr}
                  onValueChange={setSaleAmountStr}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label">Deposit Account *</label>
                <PaymentAccountPicker
                  value={saleAccountId}
                  onChange={setSaleAccountId}
                  accounts={accounts}
                  accountFilter={(a) => Boolean(a.is_payment_account || (a.type === "ASSET" && ["CASH", "BANK"].includes(a.subtype)))}
                  required
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label">Notes / Line Item Description</label>
                <input
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. Counter sale, accessories, quick repair"
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
                  {submitting ? "Recording..." : "Record & Post Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Collection Modal */}
      {recordPaymentInvoice && (
        <div className="acc-modal-backdrop" onClick={() => setRecordPaymentInvoice(null)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Record Payment: {recordPaymentInvoice.invoice_number}</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setRecordPaymentInvoice(null)}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Record partial or full payment receipt. Outstanding balance:{" "}
              <strong>{formatMoney(recordPaymentInvoice.amount_due_minor, activeWorkspace?.currency)}</strong>.
            </p>

            {payError && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {payError}
              </div>
            )}

            <form onSubmit={handleInvoicePayment}>
              <div className="acc-form-group">
                <label className="acc-form-label">Collection Amount *</label>
                <FormattedMoneyInput
                  required
                  placeholder="0.00"
                  value={payAmountStr}
                  onValueChange={setPayAmountStr}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label">Deposit Account *</label>
                <PaymentAccountPicker
                  value={payAccountId}
                  onChange={setPayAccountId}
                  accounts={accounts}
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
              Secure, unguessable customer link. Anyone with this link can view the professional invoice and payment receipt status without general ledger access.
            </p>
            <div className="acc-form-group">
              <label className="acc-form-label">Customer Share Link</label>
              <input
                type="text"
                readOnly
                className="acc-form-input tabular-nums"
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/invoices/share/${shareModalInvoice.share_token || "sample"}`}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  const url = `${window.location.origin}/invoices/share/${shareModalInvoice.share_token}`;
                  navigator.clipboard.writeText(url);
                  setSuccessToast("Customer invoice share link copied to clipboard.");
                  setShareModalInvoice(null);
                }}
              >
                Copy Link
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-outline"
                style={{ flex: 1 }}
                onClick={() => {
                  window.open(`/api/accounting/invoices/${shareModalInvoice.id}/pdf`, "_blank");
                }}
              >
                🖨️ Open Print View
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-outline"
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
