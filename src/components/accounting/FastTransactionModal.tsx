"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput, { formatAmountWithCommas } from "../ui/FormattedMoneyInput";

export default function FastTransactionModal() {
  const {
    fastModalOpen,
    fastModalType,
    closeFastModal,
    activeWorkspace,
    accounts,
    categories,
    formatMoney,
    triggerRefresh,
  } = useAccounting();

  // Form states
  const [amountStr, setAmountStr] = useState("");
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  
  // 3-way payment status: PAID | PARTLY_PAID | UNPAID
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PARTLY_PAID" | "UNPAID">("PAID");
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [contactName, setContactName] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Collapsible Details
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-reset when modal opens
  useEffect(() => {
    if (fastModalOpen) {
      setErrorMsg("");
      setAmountStr("");
      setMainCategoryId("");
      setSubcategoryId("");
      setToAccountId("");
      setPaymentStatus("PAID");
      setPaidAmountStr("");
      setContactName("");
      setNotes("");
      setAttachmentUrl("");
      setTagsStr("");
      setIsRecurring(false);
      setShowAdvanced(false);

      // Default payment account to first cash/bank account if available
      const liquidAccs = accounts.filter(
        (a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR", "UPI"].includes(a.subtype)
      );
      if (liquidAccs.length > 0) {
        setAccountId(liquidAccs[0].id);
      } else {
        setAccountId("");
      }
    }
  }, [fastModalOpen, accounts]);

  if (!fastModalOpen || !activeWorkspace) return null;

  const isTransfer = fastModalType === "TRANSFER";
  const isIncome = fastModalType === "INCOME";

  // Filter main categories by type (active root categories only)
  const availableMainCategories = categories.filter(
    (c) => c.type === (isIncome ? "INCOME" : "EXPENSE") && !c.parent_id && !c.is_archived
  );

  // Filter subcategories belonging strictly to selected main category
  const availableSubcategories = mainCategoryId
    ? categories.filter((c) => c.parent_id === mainCategoryId && !c.is_archived)
    : [];

  const parsedTotal = parseFloat(amountStr) || 0;
  const parsedPaid = parseFloat(paidAmountStr) || 0;
  const remainingBalance = Math.max(0, parsedTotal - parsedPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (parsedTotal <= 0) {
      setErrorMsg("Please enter an amount greater than ₹0.");
      return;
    }

    const amountMinor = Math.round(parsedTotal * 100);

    if (isTransfer) {
      if (!accountId || !toAccountId) {
        setErrorMsg("Please select both source and destination accounts.");
        return;
      }
      if (accountId === toAccountId) {
        setErrorMsg("Source and destination accounts must be different.");
        return;
      }
    } else {
      if (!mainCategoryId) {
        setErrorMsg("Please select a category.");
        return;
      }

      if (paymentStatus === "PAID") {
        if (!accountId) {
          setErrorMsg("Please select the payment account (Cash, Bank, UPI).");
          return;
        }
      } else if (paymentStatus === "PARTLY_PAID") {
        if (parsedPaid <= 0 || parsedPaid >= parsedTotal) {
          setErrorMsg("Partly paid amount must be greater than ₹0 and less than total amount.");
          return;
        }
        if (!accountId) {
          setErrorMsg("Please select the account where partial payment was settled.");
          return;
        }
        if (!contactName.trim()) {
          setErrorMsg(isIncome ? "Customer name is required for outstanding balance." : "Supplier / Payee name is required for unpaid balance.");
          return;
        }
      } else if (paymentStatus === "UNPAID") {
        if (!contactName.trim()) {
          setErrorMsg(isIncome ? "Customer name is required for unpaid credit sale." : "Supplier / Payee name is required for unpaid bill.");
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        workspaceId: activeWorkspace.id,
        type: isTransfer ? "TRANSFER" : isIncome ? "INCOME" : "EXPENSE",
        amountMinor,
        date,
        notes: notes.trim() || undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
        tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
        isRecurring,
      };

      if (isTransfer) {
        payload.financialAccountId = accountId;
        payload.destinationAccountId = toAccountId;
      } else {
        // Canonical classification: store subcategory if chosen, else main category
        payload.categoryId = subcategoryId || mainCategoryId;
        payload.paymentStatus = paymentStatus;
        payload.contactName = contactName.trim() || undefined;

        if (paymentStatus === "PAID") {
          payload.financialAccountId = accountId;
          payload.paidAmountMinor = amountMinor;
        } else if (paymentStatus === "PARTLY_PAID") {
          payload.financialAccountId = accountId;
          payload.paidAmountMinor = Math.round(parsedPaid * 100);
          payload.dueDate = dueDate || undefined;
        } else if (paymentStatus === "UNPAID") {
          payload.financialAccountId = undefined; // No fictitious cash payment!
          payload.paidAmountMinor = 0;
          payload.dueDate = dueDate || undefined;
        }
      }

      const res = await fetch("/api/accounting/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to record transaction. Please verify details.");
      } else {
        triggerRefresh();
        closeFastModal();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "A network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = isTransfer
    ? "Transfer Funds"
    : isIncome
    ? "Add Income / Sale"
    : "Add Expense";

  const liquidAccounts = accounts.filter(
    (a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR", "UPI"].includes(a.subtype)
  );

  return (
    <div className="acc-modal-backdrop" onClick={closeFastModal} role="dialog" aria-modal="true" aria-labelledby="fast-modal-title">
      <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-header">
          <h3 id="fast-modal-title" className="acc-modal-title">{title}</h3>
          <button
            type="button"
            className="acc-modal-close"
            onClick={closeFastModal}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              borderRadius: "8px",
              backgroundColor: "var(--acc-danger-soft)",
              color: "var(--acc-danger)",
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 1. Hero Amount First (Prominent, autofocus, visible label) */}
          <div className="acc-form-group">
            <label className="acc-form-label" htmlFor="fast-amount">
              Amount (₹) *
            </label>
            <FormattedMoneyInput
              id="fast-amount"
              autoFocus
              required
              className="acc-form-input acc-amount-hero-input tabular-nums"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
          </div>

          {/* Transfer Form */}
          {isTransfer ? (
            <>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="fast-from-account">
                  From Account (Sending) *
                </label>
                <select
                  id="fast-from-account"
                  className="acc-form-select"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                >
                  <option value="">Select source account...</option>
                  {liquidAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_minor, activeWorkspace.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="fast-to-account">
                  To Account (Receiving) *
                </label>
                <select
                  id="fast-to-account"
                  className="acc-form-select"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  required
                >
                  <option value="">Select destination account...</option>
                  {liquidAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.current_balance_minor, activeWorkspace.currency)})
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Category (Main) */}
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="fast-category">
                  Category *
                </label>
                <select
                  id="fast-category"
                  className="acc-form-select"
                  value={mainCategoryId}
                  onChange={(e) => {
                    setMainCategoryId(e.target.value);
                    setSubcategoryId(""); // Changing category must clear an incompatible subcategory
                  }}
                  required
                >
                  <option value="">Select {isIncome ? "income" : "expense"} category...</option>
                  {availableMainCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory (Optional, dependent on Main Category) */}
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="fast-subcategory">
                  Subcategory (Optional)
                </label>
                <select
                  id="fast-subcategory"
                  className="acc-form-select"
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  disabled={!mainCategoryId || availableSubcategories.length === 0}
                >
                  <option value="">
                    {!mainCategoryId
                      ? "Select a category first..."
                      : availableSubcategories.length === 0
                      ? "None (Recorded directly under main category)"
                      : "None (Use main category directly)"}
                  </option>
                  {availableSubcategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Status Segmented Control (Paid / Partly Paid / Unpaid) */}
              <div className="acc-form-group">
                <label className="acc-form-label">Payment Status *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className={`acc-btn acc-btn-sm ${paymentStatus === "PAID" ? "acc-btn-primary" : "acc-btn-outline"}`}
                    onClick={() => setPaymentStatus("PAID")}
                  >
                    ✓ Paid
                  </button>
                  <button
                    type="button"
                    className={`acc-btn acc-btn-sm ${paymentStatus === "PARTLY_PAID" ? "acc-btn-primary" : "acc-btn-outline"}`}
                    onClick={() => {
                      setPaymentStatus("PARTLY_PAID");
                      if (!paidAmountStr && parsedTotal > 0) {
                        setPaidAmountStr((parsedTotal / 2).toString());
                      }
                    }}
                  >
                    🌗 Partly Paid
                  </button>
                  <button
                    type="button"
                    className={`acc-btn acc-btn-sm ${paymentStatus === "UNPAID" ? "acc-btn-primary" : "acc-btn-outline"}`}
                    onClick={() => setPaymentStatus("UNPAID")}
                  >
                    ⏳ Unpaid
                  </button>
                </div>
              </div>

              {/* Conditional: Partly Paid details */}
              {paymentStatus === "PARTLY_PAID" && (
                <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px", marginBottom: "1rem", border: "1px solid var(--acc-border)" }}>
                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="fast-paid-amount">
                      Amount Paid Now (₹) *
                    </label>
                    <FormattedMoneyInput
                      id="fast-paid-amount"
                      required
                      className="acc-form-input tabular-nums"
                      placeholder="0.00"
                      value={paidAmountStr}
                      onChange={(e) => setPaidAmountStr(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", backgroundColor: "var(--acc-surface)", borderRadius: "6px", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                    <span style={{ color: "var(--acc-text-muted)" }}>Remaining Balance:</span>
                    <span className="tabular-nums font-bold" style={{ color: isIncome ? "var(--acc-blue)" : "var(--acc-danger)", fontSize: "0.9375rem" }}>
                      ₹{formatAmountWithCommas(remainingBalance.toFixed(2))} ({isIncome ? "Owed to Me" : "I Owe"})
                    </span>
                  </div>

                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="fast-partial-account">
                      {isIncome ? "Deposit Paid Portion To Account *" : "Pay Partial Amount From Account *"}
                    </label>
                    <select
                      id="fast-partial-account"
                      className="acc-form-select"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      required
                    >
                      <option value="">Select payment account...</option>
                      {liquidAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.current_balance_minor, activeWorkspace.currency)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="fast-contact-partial">
                      {isIncome ? "Customer Name (Who owes balance) *" : "Vendor / Supplier Name (Who you owe) *"}
                    </label>
                    <input
                      id="fast-contact-partial"
                      type="text"
                      required
                      className="acc-form-input"
                      placeholder="e.g. Ramesh Traders, John Doe"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>

                  <div className="acc-form-group" style={{ marginBottom: 0 }}>
                    <label className="acc-form-label" htmlFor="fast-due-date-partial">
                      Due Date for Remaining Balance
                    </label>
                    <input
                      id="fast-due-date-partial"
                      type="date"
                      className="acc-form-input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Conditional: Unpaid details (NO payment account required!) */}
              {paymentStatus === "UNPAID" && (
                <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px", marginBottom: "1rem", border: "1px solid var(--acc-border)" }}>
                  <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                    💡 <strong>No payment account required</strong> — no cash moves today. Recorded to {isIncome ? "Accounts Receivable (Owed to Me)" : "Accounts Payable (I Owe)"}.
                  </p>
                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="fast-contact-unpaid">
                      {isIncome ? "Customer Name *" : "Vendor / Supplier Name *"}
                    </label>
                    <input
                      id="fast-contact-unpaid"
                      type="text"
                      required
                      className="acc-form-input"
                      placeholder="e.g. Sharma Textiles, Alice Smith"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>

                  <div className="acc-form-group" style={{ marginBottom: 0 }}>
                    <label className="acc-form-label" htmlFor="fast-due-date-unpaid">
                      Payment Due Date
                    </label>
                    <input
                      id="fast-due-date-unpaid"
                      type="date"
                      className="acc-form-input"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Conditional: Fully Paid account selection */}
              {paymentStatus === "PAID" && (
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="fast-account-select">
                    {isIncome ? "Deposit To Account (Cash, Bank, UPI) *" : "Paid From Account (Cash, Bank, UPI) *"}
                  </label>
                  <select
                    id="fast-account-select"
                    className="acc-form-select"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    required
                  >
                    <option value="">Select payment account...</option>
                    {liquidAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.current_balance_minor, activeWorkspace.currency)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Date */}
          <div className="acc-form-group">
            <label className="acc-form-label" htmlFor="fast-date">
              Transaction Date *
            </label>
            <input
              id="fast-date"
              type="date"
              className="acc-form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Collapsible Details / More Options */}
          <div style={{ margin: "1rem 0" }}>
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                color: "var(--acc-blue)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              onClick={() => setShowAdvanced((p) => !p)}
            >
              <span>{showAdvanced ? "▲" : "▼"}</span>
              <span>{showAdvanced ? "Hide optional details" : "Add details / More options (Notes, Receipt, Tags)"}</span>
            </button>
          </div>

          {showAdvanced && (
            <div style={{ padding: "0.875rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px", marginBottom: "1rem", border: "1px solid var(--acc-border)" }}>
              {!isTransfer && paymentStatus === "PAID" && (
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="fast-contact-opt">
                    {isIncome ? "Customer / Payer Name (Optional)" : "Vendor / Payee Name (Optional)"}
                  </label>
                  <input
                    id="fast-contact-opt"
                    type="text"
                    className="acc-form-input"
                    placeholder="e.g. Ramesh Traders, John Doe"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="fast-notes">
                  Notes / Description
                </label>
                <textarea
                  id="fast-notes"
                  className="acc-form-textarea"
                  rows={2}
                  placeholder="Additional notes, transaction purpose, or invoice ref..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="fast-attachment">
                  Receipt / Attachment URL
                </label>
                <input
                  id="fast-attachment"
                  type="url"
                  className="acc-form-input"
                  placeholder="https://... link to receipt or image"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="fast-tags">
                  Tags (Comma-separated)
                </label>
                <input
                  id="fast-tags"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. marketing, urgent, client-travel"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  id="fast-recurring"
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "var(--acc-blue)" }}
                />
                <label htmlFor="fast-recurring" style={{ fontSize: "0.8125rem", cursor: "pointer" }}>
                  Mark as recurring schedule item
                </label>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button
              type="button"
              className="acc-btn acc-btn-outline"
              style={{ flex: 1 }}
              onClick={closeFastModal}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="acc-btn acc-btn-primary"
              style={{ flex: 1.5 }}
              disabled={submitting}
            >
              {submitting ? "Saving..." : isTransfer ? "Confirm Transfer" : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
