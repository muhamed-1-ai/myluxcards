"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  default_price_minor: number;
}

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
  const [subtab, setSubtab] = useState<"INVOICES" | "DIRECT_SALES" | "PRODUCTS">("INVOICES");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [walkinSaleOpen, setWalkinSaleOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [recordPaymentInvoice, setRecordPaymentInvoice] = useState<Invoice | null>(null);
  const [shareModalInvoice, setShareModalInvoice] = useState<Invoice | null>(null);

  // Create Invoice Form State
  const [invContactName, setInvContactName] = useState("");
  const [invIssueDate, setInvIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invDueDate, setInvDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [invLines, setInvLines] = useState<Array<{ description: string; quantity: number; unitPriceStr: string }>>([
    { description: "", quantity: 1, unitPriceStr: "" },
  ]);

  // Walk-in Sale Form State
  const [saleCustomerName, setSaleCustomerName] = useState("");
  const [saleAmountStr, setSaleAmountStr] = useState("");
  const [saleAccountId, setSaleAccountId] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  // Add Product Form State
  const [prodName, setProdName] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodPriceStr, setProdPriceStr] = useState("");
  const [prodUnit, setProdUnit] = useState("unit");

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
        const [invRes, prodRes] = await Promise.all([
          fetch(`/api/accounting/invoices?workspaceId=${activeWorkspace?.id}`),
          fetch(`/api/accounting/products?workspaceId=${activeWorkspace?.id}`),
        ]);
        if (invRes.ok && isMounted) {
          const invData = await invRes.json();
          setInvoices(invData.invoices || []);
        }
        if (prodRes.ok && isMounted) {
          const prodData = await prodRes.json();
          setProducts(prodData.products || []);
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

  // Create Invoice Submit
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;

    const linesPayload = invLines
      .filter((l) => l.description.trim() && parseFloat(l.unitPriceStr) > 0)
      .map((l) => ({
        description: l.description.trim(),
        quantity: l.quantity,
        unitPriceMinor: Math.round(parseFloat(l.unitPriceStr) * 100),
      }));

    if (linesPayload.length === 0) {
      alert("Please add at least one line item with a price.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          contactName: invContactName.trim() || undefined,
          issueDate: invIssueDate,
          dueDate: invDueDate,
          lines: linesPayload,
        }),
      });

      if (res.ok) {
        setCreateInvoiceOpen(false);
        setInvContactName("");
        setInvLines([{ description: "", quantity: 1, unitPriceStr: "" }]);
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create invoice");
      }
    } finally {
      setSubmitting(false);
    }
  };

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

  // Add Product Submit
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(prodPriceStr) || 0;
    if (!prodName.trim() || !activeWorkspace) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: prodName.trim(),
          sku: prodSku.trim() || undefined,
          defaultPriceMinor: Math.round(price * 100),
          unit: prodUnit,
        }),
      });

      if (res.ok) {
        setAddProductOpen(false);
        setProdName("");
        setProdSku("");
        setProdPriceStr("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save product");
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
          <p className="acc-subtitle">Walk-in sales, client invoices, products catalog, and receipts.</p>
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

      {/* Subtab Navigation */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "INVOICES" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("INVOICES")}
        >
          Invoices ({invoices.length})
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "PRODUCTS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("PRODUCTS")}
        >
          Products & Services ({products.length})
        </button>
      </div>

      {subtab === "INVOICES" && (
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
                    <tr key={inv.id}>
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
                              : inv.status === "OVERDUE"
                              ? "acc-badge-danger"
                              : "acc-badge-neutral"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="acc-align-right">
                        <div style={{ display: "inline-flex", gap: "0.375rem", alignItems: "center" }}>
                          {inv.amount_due_minor > 0 && canMutate ? (
                            <button
                              type="button"
                              className="acc-btn acc-btn-sm acc-btn-primary"
                              style={{ padding: "0.2rem 0.5rem" }}
                              onClick={() => {
                                setPayError(null);
                                setRecordPaymentInvoice(inv);
                                setPayAmountStr((inv.amount_due_minor / 100).toString());
                                const defaultAcc = accounts.find(
                                  (a) => a.type === "ASSET" && ["BANK", "CASH"].includes(a.subtype)
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
                            onClick={() => setShareModalInvoice(inv)}
                          >
                            Share Link
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
      )}

      {subtab === "PRODUCTS" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            {canMutate && (
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => setAddProductOpen(true)}
              >
                + Add Product / Service
              </button>
            )}
          </div>
          <div className="acc-card">
            {products.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
                No products or services saved. Add your catalog items here.
              </div>
            ) : (
              <div className="acc-table-wrapper">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Product / Service Name</th>
                      <th>SKU</th>
                      <th>Unit</th>
                      <th className="acc-align-right">Default Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{p.sku || "—"}</td>
                        <td>{p.unit}</td>
                        <td className="acc-align-right tabular-nums font-semibold">
                          {formatMoney(p.default_price_minor, activeWorkspace?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
                <select
                  id="sale-account"
                  className="acc-form-select"
                  value={saleAccountId}
                  onChange={(e) => setSaleAccountId(e.target.value)}
                  required
                >
                  <option value="">Select Cash, Bank, or UPI...</option>
                  {accounts
                    .filter((a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR"].includes(a.subtype))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Balance: ₹{(a.current_balance_minor / 100).toFixed(2)})
                      </option>
                    ))}
                </select>
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

      {/* Create Invoice Modal */}
      {createInvoiceOpen && (
        <div className="acc-modal-backdrop" onClick={() => setCreateInvoiceOpen(false)}>
          <div className="acc-modal-content" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">New Client Invoice</h3>
              <button type="button" className="acc-modal-close" onClick={() => setCreateInvoiceOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateInvoice}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="inv-contact">Client / Customer Name *</label>
                <input
                  id="inv-contact"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Acme Tech Solutions, Rajesh Kumar"
                  value={invContactName}
                  onChange={(e) => setInvContactName(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="inv-issue-date">Issue Date</label>
                  <input
                    id="inv-issue-date"
                    type="date"
                    className="acc-form-input"
                    value={invIssueDate}
                    onChange={(e) => setInvIssueDate(e.target.value)}
                    required
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="inv-due-date">Due Date</label>
                  <input
                    id="inv-due-date"
                    type="date"
                    className="acc-form-input"
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Line Items */}
              <div style={{ margin: "1rem 0" }}>
                <label className="acc-form-label" style={{ marginBottom: "0.5rem", display: "block" }}>
                  Invoice Items *
                </label>
                {invLines.map((line, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                    <input
                      type="text"
                      className="acc-form-input"
                      placeholder="Item description / Service"
                      style={{ flex: 3 }}
                      value={line.description}
                      onChange={(e) => {
                        const updated = [...invLines];
                        updated[idx].description = e.target.value;
                        setInvLines(updated);
                      }}
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      className="acc-form-input tabular-nums"
                      placeholder="Qty"
                      style={{ width: "70px" }}
                      value={line.quantity}
                      onChange={(e) => {
                        const updated = [...invLines];
                        updated[idx].quantity = parseInt(e.target.value) || 1;
                        setInvLines(updated);
                      }}
                      required
                    />
                    <FormattedMoneyInput
                      className="acc-form-input tabular-nums"
                      placeholder="Price (₹)"
                      style={{ width: "110px" }}
                      value={line.unitPriceStr}
                      onChange={(e) => {
                        const updated = [...invLines];
                        updated[idx].unitPriceStr = e.target.value;
                        setInvLines(updated);
                      }}
                      required
                    />
                    {invLines.length > 1 && (
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--acc-danger)", cursor: "pointer", padding: "0.25rem" }}
                        onClick={() => setInvLines(invLines.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  style={{ marginTop: "0.5rem" }}
                  onClick={() => setInvLines([...invLines, { description: "", quantity: 1, unitPriceStr: "" }])}
                >
                  + Add Another Item
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setCreateInvoiceOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create & Issue Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <select
                  id="pay-account-sel"
                  className="acc-form-select"
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  required
                >
                  <option value="">Select receiving Cash or Bank account...</option>
                  {accounts
                    .filter((a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR"].includes(a.subtype))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Balance: ₹{(a.current_balance_minor / 100).toFixed(2)})
                      </option>
                    ))}
                </select>
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

      {/* Add Product Modal */}
      {addProductOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddProductOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Add Product / Service</h3>
              <button type="button" className="acc-modal-close" onClick={() => setAddProductOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddProduct}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-name">Item Name *</label>
                <input
                  id="prod-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Website Development, Standard Consultation"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-sku">SKU / Code</label>
                <input
                  id="prod-sku"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. SRV-001"
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-price">Default Price (₹)</label>
                <FormattedMoneyInput
                  id="prod-price"
                  className="acc-form-input tabular-nums"
                  placeholder="0.00"
                  value={prodPriceStr}
                  onChange={(e) => setProdPriceStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-unit">Billing Unit</label>
                <input
                  id="prod-unit"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. unit, hour, project"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddProductOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
