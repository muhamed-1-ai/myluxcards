"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import type { PurchaseRow, PurchasePaymentRow } from "@/lib/accounting/types";
import TransactionAttachmentsDropzone from "./TransactionAttachmentsDropzone";
import TransactionAttachmentViewerModal from "./TransactionAttachmentViewerModal";
import type { TransactionAttachmentRow } from "@/lib/accounting/types";
import {
  X,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  RotateCcw,
  Ban,
  Edit2,
  ExternalLink,
} from "lucide-react";

interface PurchaseDetailModalProps {
  isOpen: boolean;
  purchaseId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onEditDraft?: (purchase: PurchaseRow) => void;
}

export default function PurchaseDetailModal({
  isOpen,
  purchaseId,
  onClose,
  onRefresh,
  onEditDraft,
}: PurchaseDetailModalProps) {
  const { activeWorkspace, formatMoney, paymentAccounts, triggerRefresh, canMutate } = useAccounting();

  const [purchase, setPurchase] = useState<PurchaseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Record Payment Sub-panel
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmountStr, setPayAmountStr] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payRef, setPayRef] = useState("");
  const [submittingPay, setSubmittingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Void confirmation dialog
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [submittingVoid, setSubmittingVoid] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Manage attachments panel
  const [showAttachmentsManager, setShowAttachmentsManager] = useState(false);
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>([]);
  const [savingAttachments, setSavingAttachments] = useState(false);

  // Attachment viewer modal
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedAttIndex, setSelectedAttIndex] = useState(0);

  // Default payment account
  useEffect(() => {
    if (paymentAccounts.length > 0 && !payAccountId) {
      const bank = paymentAccounts.find((a) => a.code === "1020" || a.subtype === "BANK");
      if (bank) {
        setPayAccountId(bank.id);
      } else {
        setPayAccountId(paymentAccounts[0].id);
      }
    }
  }, [paymentAccounts, payAccountId]);

  // Load detailed purchase
  useEffect(() => {
    if (!isOpen || !purchaseId || !activeWorkspace) return;
    let isMounted = true;

    async function loadPurchase() {
      try {
        setLoading(true);
        setErrorMessage(null);
        const res = await fetch(`/api/accounting/purchases/${purchaseId}?workspaceId=${activeWorkspace!.id}`, {
          headers: { "x-workspace-id": activeWorkspace!.id },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load purchase details.");
        }
        if (isMounted) {
          setPurchase(data.purchase);
          if (data.purchase) {
            const dueMinor = Number(data.purchase.amount_due_minor || 0);
            setPayAmountStr((dueMinor / 100).toFixed(2));
            if (data.purchase.attachments) {
              setSelectedAttachmentIds(data.purchase.attachments.map((a: any) => a.id));
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err.message || "Failed to load purchase details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPurchase();
    return () => {
      isMounted = false;
    };
  }, [isOpen, purchaseId, activeWorkspace]);

  // Handle Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !purchase) return;

    const amountMinor = Math.round(parseFloat(payAmountStr || "0") * 100);
    const dueMinor = Number(purchase.amount_due_minor || 0);

    if (isNaN(amountMinor) || amountMinor <= 0) {
      setPayError("Payment amount must be greater than zero.");
      return;
    }
    if (amountMinor > dueMinor) {
      setPayError(`Payment amount cannot exceed the balance due of ${formatMoney(dueMinor)}.`);
      return;
    }
    if (!payAccountId) {
      setPayError("Please select Cash in Hand or Bank Account.");
      return;
    }

    setSubmittingPay(true);
    setPayError(null);

    try {
      const res = await fetch(`/api/accounting/purchases/${purchase.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          financialAccountId: payAccountId,
          amountMinor,
          paymentDate: payDate,
          paymentMethod: payMethod,
          referenceNumber: payRef.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record payment.");
      }

      setSuccessMessage(`Payment of ${formatMoney(amountMinor)} recorded successfully.`);
      setShowPaymentForm(false);
      triggerRefresh();
      onRefresh();

      // Reload purchase
      const refreshRes = await fetch(`/api/accounting/purchases/${purchase.id}?workspaceId=${activeWorkspace.id}`, {
        headers: { "x-workspace-id": activeWorkspace.id },
      });
      if (refreshRes.ok) {
        const refData = await refreshRes.json();
        setPurchase(refData.purchase);
        const newDue = Number(refData.purchase.amount_due_minor || 0);
        setPayAmountStr((newDue / 100).toFixed(2));
      }
    } catch (err: any) {
      setPayError(err.message || "Failed to record payment.");
    } finally {
      setSubmittingPay(false);
    }
  };

  // Handle Void Purchase
  const handleVoidPurchase = async () => {
    if (!activeWorkspace || !purchase) return;
    if (!voidReason.trim() || voidReason.trim().length < 3) {
      setVoidError("Please provide a valid reason to void this purchase (minimum 3 characters).");
      return;
    }

    setSubmittingVoid(true);
    setVoidError(null);

    try {
      const res = await fetch(`/api/accounting/purchases/${purchase.id}/void`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          reason: voidReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to void purchase.");
      }

      setSuccessMessage("Purchase and linked payments successfully voided and reversed.");
      setShowVoidConfirm(false);
      triggerRefresh();
      onRefresh();

      // Reload purchase
      const refreshRes = await fetch(`/api/accounting/purchases/${purchase.id}?workspaceId=${activeWorkspace.id}`, {
        headers: { "x-workspace-id": activeWorkspace.id },
      });
      if (refreshRes.ok) {
        const refData = await refreshRes.json();
        setPurchase(refData.purchase);
      }
    } catch (err: any) {
      setVoidError(err.message || "Failed to void purchase.");
    } finally {
      setSubmittingVoid(false);
    }
  };

  // Handle Save Attachments
  const handleSaveAttachments = async () => {
    if (!activeWorkspace || !purchase) return;
    setSavingAttachments(true);
    try {
      const res = await fetch(`/api/accounting/purchases/${purchase.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          attachmentIds: selectedAttachmentIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update attachments.");
      }
      setShowAttachmentsManager(false);
      setSuccessMessage("Attachments updated successfully without altering balances.");
      triggerRefresh();
      onRefresh();

      const refreshRes = await fetch(`/api/accounting/purchases/${purchase.id}?workspaceId=${activeWorkspace.id}`, {
        headers: { "x-workspace-id": activeWorkspace.id },
      });
      if (refreshRes.ok) {
        const refData = await refreshRes.json();
        setPurchase(refData.purchase);
      }
    } catch (err: any) {
      alert(err.message || "Failed to update attachments.");
    } finally {
      setSavingAttachments(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="acc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submittingPay && !submittingVoid) onClose();
      }}
    >
      <div
        className="acc-modal-dialog"
        style={{
          maxWidth: "840px",
          width: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "var(--acc-surface, #141414)",
          border: "1px solid var(--acc-border, #303030)",
          borderRadius: "12px",
          color: "var(--acc-text-main, #F5F5F5)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--acc-border, #303030)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h2 id="purchase-detail-title" style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
              {purchase?.purchase_number || "Purchase Details"}
            </h2>

            {purchase && (
              <span
                className={`acc-badge ${
                  purchase.status === "PAID"
                    ? "acc-badge-success"
                    : purchase.status === "PARTIALLY_PAID"
                    ? "acc-badge-info"
                    : purchase.status === "DRAFT"
                    ? "acc-badge-secondary"
                    : purchase.status === "VOIDED"
                    ? "acc-badge-danger"
                    : "acc-badge-warning"
                }`}
                style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
              >
                {purchase.status}
              </span>
            )}

            {purchase?.supplier_bill_number && (
              <span style={{ fontSize: "0.85rem", color: "var(--acc-text-muted)" }}>
                Bill #: <strong style={{ color: "var(--acc-text-main)" }}>{purchase.supplier_bill_number}</strong>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--acc-text-muted, #A3A3A3)",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "6px",
            }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.5rem" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              Loading purchase details...
            </div>
          )}

          {errorMessage && (
            <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              className="acc-alert acc-alert-success"
              style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span>{successMessage}</span>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          {purchase && !loading && (
            <div>
              {/* Financial Summary & Key Metrics Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "0.85rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "var(--acc-raised, #1C1C1C)",
                    borderRadius: "8px",
                    border: "1px solid var(--acc-border, #303030)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--acc-text-muted)", marginBottom: "0.25rem" }}>
                    Total Purchase
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--acc-text-main)" }}>
                    {formatMoney(Number(purchase.total_minor))}
                  </div>
                </div>

                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "var(--acc-raised, #1C1C1C)",
                    borderRadius: "8px",
                    border: "1px solid var(--acc-border, #303030)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--acc-text-muted)", marginBottom: "0.25rem" }}>
                    Total Paid
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--acc-success, #10B981)" }}>
                    {formatMoney(Number(purchase.amount_paid_minor))}
                  </div>
                </div>

                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "var(--acc-raised, #1C1C1C)",
                    borderRadius: "8px",
                    border: "1px solid var(--acc-border, #303030)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--acc-text-muted)", marginBottom: "0.25rem" }}>
                    Balance Outstanding
                  </div>
                  <div
                    style={{
                      fontSize: "1.35rem",
                      fontWeight: 700,
                      color: Number(purchase.amount_due_minor) > 0 ? "var(--acc-warning, #F59E0B)" : "var(--acc-text-main)",
                    }}
                  >
                    {formatMoney(Number(purchase.amount_due_minor))}
                  </div>
                </div>
              </div>

              {/* Supplier & Bill Information Bar */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1rem",
                  padding: "1rem",
                  backgroundColor: "var(--acc-raised, #1C1C1C)",
                  borderRadius: "8px",
                  border: "1px solid var(--acc-border, #303030)",
                  marginBottom: "1.25rem",
                  fontSize: "0.875rem",
                }}
              >
                <div>
                  <div style={{ color: "var(--acc-text-muted)", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
                    Supplier (People)
                  </div>
                  <div style={{ fontWeight: 600 }}>{purchase.supplier_name || "Unknown Supplier"}</div>
                  {purchase.supplier_phone && (
                    <div style={{ color: "var(--acc-text-muted)", fontSize: "0.8rem" }}>{purchase.supplier_phone}</div>
                  )}
                  {purchase.supplier_email && (
                    <div style={{ color: "var(--acc-text-muted)", fontSize: "0.8rem" }}>{purchase.supplier_email}</div>
                  )}
                </div>

                <div>
                  <div style={{ color: "var(--acc-text-muted)", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
                    Purchase Date
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {purchase.purchase_date
                      ? new Date(purchase.purchase_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </div>
                  {purchase.due_date && (
                    <div style={{ color: "var(--acc-warning, #F59E0B)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                      Due:{" "}
                      {new Date(purchase.due_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ color: "var(--acc-text-muted)", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
                    Category Classification
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {purchase.category_name ? (
                      <span>
                        {purchase.parent_category_name ? `${purchase.parent_category_name} → ` : ""}
                        {purchase.category_name}
                      </span>
                    ) : (
                      "General Operating Expenses"
                    )}
                  </div>
                  <div style={{ color: "var(--acc-text-muted)", fontSize: "0.8rem" }}>
                    Type: {purchase.purchase_type || "EXPENSE"}
                  </div>
                </div>
              </div>

              {/* Item Lines Table */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem 0" }}>Purchased Items</h3>
                <div style={{ overflowX: "auto", border: "1px solid var(--acc-border, #303030)", borderRadius: "8px" }}>
                  <table className="acc-table" style={{ width: "100%", margin: 0, fontSize: "0.875rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--acc-raised, #1C1C1C)" }}>
                        <th style={{ padding: "0.6rem 0.75rem" }}>Description</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Qty</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Unit Price</th>
                        <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(purchase.lines || []).map((line, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--acc-border, #303030)" }}>
                          <td style={{ padding: "0.6rem 0.75rem" }}>
                            <div style={{ fontWeight: 500 }}>{line.description}</div>
                            {line.product_name && (
                              <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                                Catalog: {line.product_name}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{line.quantity}</td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                            {formatMoney(Number(line.unit_price_minor))}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 600 }}>
                            {formatMoney(Number(line.total_minor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attachments Section */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Paperclip size={16} /> Bill Attachments ({(purchase.attachments || []).length})
                  </h3>
                  <button
                    type="button"
                    className="acc-btn acc-btn-outline acc-btn-sm"
                    onClick={() => setShowAttachmentsManager(!showAttachmentsManager)}
                  >
                    {showAttachmentsManager ? "Hide Attachment Manager" : "Manage Attachments"}
                  </button>
                </div>

                {/* Attachments List */}
                {(purchase.attachments || []).length > 0 && !showAttachmentsManager && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {purchase.attachments!.map((att, i) => (
                      <a
                        key={att.id}
                        href={att.download_url || att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="acc-card"
                        style={{
                          padding: "0.5rem 0.75rem",
                          fontSize: "0.8rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          textDecoration: "none",
                          color: "var(--acc-text-main)",
                          border: "1px solid var(--acc-border, #303030)",
                          borderRadius: "6px",
                        }}
                      >
                        <FileText size={14} />
                        <span>{att.file_name}</span>
                        <ExternalLink size={12} style={{ color: "var(--acc-text-muted)" }} />
                      </a>
                    ))}
                  </div>
                )}

                {/* Attachment Manager Panel */}
                {showAttachmentsManager && (
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "var(--acc-raised, #1C1C1C)",
                      border: "1px solid var(--acc-border, #303030)",
                      borderRadius: "8px",
                      marginTop: "0.5rem",
                    }}
                  >
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "var(--acc-text-muted)" }}>
                      Upload or remove receipts. Attachment-only changes strictly preserve balances and do not repost journals.
                    </p>
                    <TransactionAttachmentsDropzone
                      initialAttachments={purchase.attachments || []}
                      onChange={(ids) => setSelectedAttachmentIds(ids)}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.75rem" }}>
                      <button
                        type="button"
                        className="acc-btn acc-btn-outline acc-btn-sm"
                        onClick={() => setShowAttachmentsManager(false)}
                        disabled={savingAttachments}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="acc-btn acc-btn-primary acc-btn-sm"
                        onClick={handleSaveAttachments}
                        disabled={savingAttachments}
                      >
                        {savingAttachments ? "Saving..." : "Save Attachments"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment History Section */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <History size={16} /> Payment History ({(purchase.payments || []).length})
                  </h3>
                  {Number(purchase.amount_due_minor) > 0 && purchase.status !== "DRAFT" && purchase.status !== "VOIDED" && canMutate && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-primary acc-btn-sm"
                      onClick={() => setShowPaymentForm(!showPaymentForm)}
                    >
                      {showPaymentForm ? "Close Payment Form" : "+ Record Payment"}
                    </button>
                  )}
                </div>

                {/* Inline Record Payment Form */}
                {showPaymentForm && (
                  <form
                    onSubmit={handleRecordPayment}
                    style={{
                      padding: "1.25rem",
                      backgroundColor: "var(--acc-raised, #1C1C1C)",
                      border: "1px solid var(--acc-blue, #2563EB)",
                      borderRadius: "8px",
                      marginBottom: "1rem",
                    }}
                  >
                    <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", fontWeight: 600 }}>
                      Record Supplier Payment (Remaining: {formatMoney(Number(purchase.amount_due_minor))})
                    </h4>

                    {payError && (
                      <div className="acc-alert acc-alert-danger" style={{ marginBottom: "0.75rem" }}>
                        {payError}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                      }}
                    >
                      {/* Payment Account */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                          Account (Cash / Bank) *
                        </label>
                        <select
                          className="acc-form-input"
                          value={payAccountId}
                          onChange={(e) => setPayAccountId(e.target.value)}
                          required
                          disabled={submittingPay}
                        >
                          <option value="">-- Select Cash in Hand or Bank Account --</option>
                          {paymentAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.subtype === "CASH" ? "Cash" : "Bank"}) - Bal: {formatMoney(a.current_balance_minor)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Payment Amount */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                          Payment Amount (₹) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={Number(purchase.amount_due_minor) / 100}
                          className="acc-form-input"
                          value={payAmountStr}
                          onChange={(e) => setPayAmountStr(e.target.value)}
                          required
                          disabled={submittingPay}
                        />
                      </div>

                      {/* Payment Date */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                          Payment Date *
                        </label>
                        <input
                          type="date"
                          className="acc-form-input"
                          value={payDate}
                          onChange={(e) => setPayDate(e.target.value)}
                          required
                          disabled={submittingPay}
                        />
                      </div>

                      {/* Payment Reference */}
                      <div>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                          Reference / UTR # (Optional)
                        </label>
                        <input
                          type="text"
                          className="acc-form-input"
                          placeholder="e.g. UTR-98273612"
                          value={payRef}
                          onChange={(e) => setPayRef(e.target.value)}
                          disabled={submittingPay}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="acc-btn acc-btn-outline acc-btn-sm"
                        onClick={() => setShowPaymentForm(false)}
                        disabled={submittingPay}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="acc-btn acc-btn-primary acc-btn-sm"
                        disabled={submittingPay}
                      >
                        {submittingPay ? "Recording..." : `Confirm Payment`}
                      </button>
                    </div>
                  </form>
                )}

                {/* Payments Table */}
                {(purchase.payments || []).length === 0 ? (
                  <div
                    style={{
                      padding: "1.25rem",
                      textAlign: "center",
                      backgroundColor: "var(--acc-raised, #1C1C1C)",
                      borderRadius: "8px",
                      color: "var(--acc-text-muted)",
                      fontSize: "0.875rem",
                    }}
                  >
                    No payments have been recorded for this purchase yet.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", border: "1px solid var(--acc-border, #303030)", borderRadius: "8px" }}>
                    <table className="acc-table" style={{ width: "100%", margin: 0, fontSize: "0.875rem" }}>
                      <thead>
                        <tr style={{ backgroundColor: "var(--acc-raised, #1C1C1C)" }}>
                          <th style={{ padding: "0.6rem 0.75rem" }}>Date</th>
                          <th style={{ padding: "0.6rem 0.75rem" }}>Account</th>
                          <th style={{ padding: "0.6rem 0.75rem" }}>Reference</th>
                          <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Amount</th>
                          <th style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchase.payments!.map((p) => (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--acc-border, #303030)" }}>
                            <td style={{ padding: "0.6rem 0.75rem" }}>
                              {new Date(p.payment_date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem" }}>{p.account_name || "Payment Account"}</td>
                            <td style={{ padding: "0.6rem 0.75rem", color: "var(--acc-text-muted)" }}>
                              {p.reference_number || "-"}
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", fontWeight: 600 }}>
                              {formatMoney(Number(p.amount_minor))}
                            </td>
                            <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                              <span
                                className={`acc-badge ${
                                  p.status === "POSTED" ? "acc-badge-success" : "acc-badge-danger"
                                }`}
                                style={{ fontSize: "0.7rem" }}
                              >
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Notes display */}
              {purchase.notes && (
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    backgroundColor: "var(--acc-raised, #1C1C1C)",
                    borderRadius: "8px",
                    border: "1px solid var(--acc-border, #303030)",
                    marginBottom: "1.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "0.25rem", color: "var(--acc-text-muted)" }}>
                    Remarks:
                  </strong>
                  <div>{purchase.notes}</div>
                </div>
              )}

              {/* Void Confirmation Modal / Panel */}
              {showVoidConfirm && (
                <div
                  style={{
                    padding: "1.25rem",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid var(--acc-danger, #EF4444)",
                    borderRadius: "8px",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                    <AlertTriangle size={20} style={{ color: "var(--acc-danger, #EF4444)" }} />
                    <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--acc-danger, #EF4444)", fontWeight: 700 }}>
                      Warning: Void Purchase {purchase.purchase_number}
                    </h4>
                  </div>
                  <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem" }}>
                    Voiding this purchase will automatically reverse the purchase journal entry and all linked disbursements
                    from Cash/Bank. The supplier&apos;s payable balance will be adjusted accordingly, and history will be preserved
                    in the Voided section.
                  </p>

                  {voidError && (
                    <div className="acc-alert acc-alert-danger" style={{ marginBottom: "0.75rem" }}>
                      {voidError}
                    </div>
                  )}

                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                      Reason for Voiding *
                    </label>
                    <input
                      type="text"
                      className="acc-form-input"
                      placeholder="e.g. Order cancelled, duplicate bill, incorrect amounts"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      required
                      disabled={submittingVoid}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline acc-btn-sm"
                      onClick={() => setShowVoidConfirm(false)}
                      disabled={submittingVoid}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="acc-btn acc-btn-danger acc-btn-sm"
                      onClick={handleVoidPurchase}
                      disabled={submittingVoid}
                    >
                      {submittingVoid ? "Voiding..." : "Confirm Void Purchase"}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--acc-border, #303030)",
                  paddingTop: "1.25rem",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  {purchase.status !== "VOIDED" && canMutate && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline acc-btn-sm"
                      style={{ color: "var(--acc-danger, #EF4444)", borderColor: "var(--acc-danger, #EF4444)" }}
                      onClick={() => setShowVoidConfirm(true)}
                    >
                      <Ban size={14} style={{ marginRight: "0.35rem" }} /> Void Purchase
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {purchase.status === "DRAFT" && onEditDraft && canMutate && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-primary acc-btn-sm"
                      onClick={() => {
                        onClose();
                        onEditDraft(purchase);
                      }}
                    >
                      <Edit2 size={14} style={{ marginRight: "0.35rem" }} /> Edit Draft
                    </button>
                  )}

                  <button type="button" className="acc-btn acc-btn-outline acc-btn-sm" onClick={onClose}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
