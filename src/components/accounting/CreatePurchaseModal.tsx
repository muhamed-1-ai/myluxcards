"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";
import TransactionAttachmentsDropzone from "./TransactionAttachmentsDropzone";
import type { PurchaseStatus, PurchaseType, PaymentMethod } from "@/lib/accounting/types";
import { AlertCircle, Plus, Trash2, X, Building2, Calendar, FileText, CheckCircle2 } from "lucide-react";

interface SupplierContact {
  id: string;
  name: string;
  type: string;
  email?: string | null;
  phone?: string | null;
  total_payable_minor?: number | string;
}

interface ProductItem {
  id: string;
  name: string;
  sku?: string | null;
  default_price_minor: number;
  unit: string;
}

interface PurchaseLineForm {
  productId?: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxMinor: number;
}

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDraftData?: any; // For editing drafts
}

export default function CreatePurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  initialDraftData,
}: CreatePurchaseModalProps) {
  const { activeWorkspace, formatMoney, paymentAccounts, categories, triggerRefresh } = useAccounting();

  // Suppliers & Products lists
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  // Form fields
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierBillNumber, setSupplierBillNumber] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>("");
  const [mainCategoryId, setMainCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("EXPENSE");
  const [notes, setNotes] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"DRAFT" | "UNPAID" | "PARTIALLY_PAID" | "PAID">("UNPAID");

  // Payment fields
  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [paidAmountStr, setPaidAmountStr] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState<string>("");

  // Line items
  const [lines, setLines] = useState<PurchaseLineForm[]>([
    { description: "", quantity: 1, unitPriceMinor: 0, discountMinor: 0, taxMinor: 0 },
  ]);

  // Attachments
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unsupportedNotice, setUnsupportedNotice] = useState<string | null>(null);

  // Quick Supplier Creator Modal
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const [quickSupplierPhone, setQuickSupplierPhone] = useState("");
  const [quickSupplierEmail, setQuickSupplierEmail] = useState("");
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);

  // Filter only active customer-created EXPENSE categories
  const expenseCategories = useMemo(() => {
    return categories.filter((c) => c.type === "EXPENSE" && !c.is_archived);
  }, [categories]);

  const mainCategories = useMemo(() => {
    return expenseCategories.filter((c) => !c.parent_id);
  }, [expenseCategories]);

  const subcategories = useMemo(() => {
    if (!mainCategoryId) return [];
    return expenseCategories.filter((c) => c.parent_id === mainCategoryId);
  }, [expenseCategories, mainCategoryId]);

  // Default payment account (prefer Bank Account, then Cash in Hand)
  useEffect(() => {
    if (paymentAccounts.length > 0 && !paymentAccountId) {
      const bank = paymentAccounts.find((a) => a.code === "1020" || a.subtype === "BANK");
      if (bank) {
        setPaymentAccountId(bank.id);
      } else {
        setPaymentAccountId(paymentAccounts[0].id);
      }
    }
  }, [paymentAccounts, paymentAccountId]);

  // Load suppliers and products
  useEffect(() => {
    if (!activeWorkspace || !isOpen) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoadingLookups(true);
        const [contactsRes, productsRes] = await Promise.all([
          fetch(`/api/accounting/contacts?workspaceId=${activeWorkspace!.id}`, {
            headers: { "x-workspace-id": activeWorkspace!.id },
          }),
          fetch(`/api/accounting/products?workspaceId=${activeWorkspace!.id}`, {
            headers: { "x-workspace-id": activeWorkspace!.id },
          }),
        ]);

        if (contactsRes.ok && isMounted) {
          const cData = await contactsRes.json();
          setSuppliers(cData.contacts || []);
        }
        if (productsRes.ok && isMounted) {
          const pData = await productsRes.json();
          setProducts(pData.products || []);
        }
      } catch (err) {
        console.error("Failed to load lookup data:", err);
      } finally {
        if (isMounted) setLoadingLookups(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace, isOpen]);

  // Populate draft if editing
  useEffect(() => {
    if (initialDraftData) {
      setSupplierId(initialDraftData.supplier_id || "");
      setSupplierBillNumber(initialDraftData.supplier_bill_number || "");
      setPurchaseDate(initialDraftData.purchase_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setDueDate(initialDraftData.due_date?.slice(0, 10) || "");
      setNotes(initialDraftData.notes || "");
      setPaymentStatus("DRAFT");
      if (initialDraftData.lines && initialDraftData.lines.length > 0) {
        setLines(
          initialDraftData.lines.map((l: any) => ({
            productId: l.product_id || undefined,
            description: l.description || "",
            quantity: Number(l.quantity) || 1,
            unitPriceMinor: Number(l.unit_price_minor) || 0,
            discountMinor: Number(l.discount_minor) || 0,
            taxMinor: Number(l.tax_minor) || 0,
          }))
        );
      }
    }
  }, [initialDraftData]);

  // Live Totals Calculation
  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let total = 0;

    for (const line of lines) {
      const qty = Math.max(0.01, Number(line.quantity) || 1);
      const unitPrice = Math.max(0, Math.round(Number(line.unitPriceMinor) || 0));
      const lineSub = Math.round(qty * unitPrice);
      const lineDisc = Math.max(0, Math.round(Number(line.discountMinor) || 0));
      const lineTax = Math.max(0, Math.round(Number(line.taxMinor) || 0));
      const lineTot = Math.max(0, lineSub - lineDisc + lineTax);

      subtotal += lineSub;
      discount += lineDisc;
      tax += lineTax;
      total += lineTot;
    }

    return { subtotal, discount, tax, total };
  }, [lines]);

  // Live calculation of paid and due amounts
  const computedPaidAndDue = useMemo(() => {
    const totalMinor = totals.total;
    if (paymentStatus === "DRAFT" || paymentStatus === "UNPAID") {
      return { paidMinor: 0, dueMinor: totalMinor };
    }
    if (paymentStatus === "PAID") {
      return { paidMinor: totalMinor, dueMinor: 0 };
    }
    // PARTIALLY_PAID
    const rawPaid = Math.round(parseFloat(paidAmountStr || "0") * 100);
    const paidMinor = Math.min(totalMinor, Math.max(0, isNaN(rawPaid) ? 0 : rawPaid));
    const dueMinor = Math.max(0, totalMinor - paidMinor);
    return { paidMinor, dueMinor };
  }, [totals.total, paymentStatus, paidAmountStr]);

  // Handle line change
  const handleLineChange = (index: number, field: keyof PurchaseLineForm, value: any) => {
    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Handle product selection to auto-populate description and price
  const handleProductSelect = (index: number, prodId: string) => {
    if (!prodId) {
      handleLineChange(index, "productId", undefined);
      return;
    }
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    setLines((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: prod.id,
        description: next[index].description.trim() ? next[index].description : prod.name,
        unitPriceMinor: prod.default_price_minor || next[index].unitPriceMinor,
      };
      return next;
    });
  };

  // Add line item
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPriceMinor: 0, discountMinor: 0, taxMinor: 0 },
    ]);
  };

  // Remove line item
  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Supplier Creator
  const handleSaveQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    if (quickSupplierName.trim().length < 2) {
      alert("Supplier name must have at least 2 characters.");
      return;
    }
    setSavingQuickSupplier(true);
    try {
      const res = await fetch(`/api/accounting/contacts?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: quickSupplierName.trim(),
          type: "VENDOR",
          phone: quickSupplierPhone.trim() || undefined,
          email: quickSupplierEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create supplier");
        return;
      }
      setSuppliers((prev) => [data.contact, ...prev]);
      setSupplierId(data.contact.id);
      setQuickSupplierOpen(false);
      setQuickSupplierName("");
      setQuickSupplierPhone("");
      setQuickSupplierEmail("");
    } catch (err: any) {
      alert(err.message || "Failed to create supplier");
    } finally {
      setSavingQuickSupplier(false);
    }
  };

  // Check purchase classification
  const handlePurchaseTypeChange = (type: PurchaseType) => {
    if (type === "INVENTORY") {
      setUnsupportedNotice(
        "Unsupported accounting treatment: Full inventory asset capitalization is not configured in this workspace. Inventory purchases cannot be silently classified as general operating expenses. Please record this purchase as an operational expense under an appropriate expense category."
      );
      setPurchaseType("EXPENSE");
      return;
    }
    if (type === "ASSET") {
      setUnsupportedNotice(
        "Unsupported accounting treatment: Equipment and fixed asset capitalization is not configured in this workspace. Capital purchases cannot be silently classified as ordinary operating expenses. Please record this purchase as an operational expense under an appropriate expense category."
      );
      setPurchaseType("EXPENSE");
      return;
    }
    setUnsupportedNotice(null);
    setPurchaseType(type);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;

    setErrorMessage(null);

    // Validation
    if (paymentStatus !== "DRAFT" && !supplierId) {
      setErrorMessage("Please select a Supplier from People.");
      return;
    }

    if (lines.length === 0) {
      setErrorMessage("Please add at least one line item.");
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].description.trim()) {
        setErrorMessage(`Line ${i + 1} requires a description.`);
        return;
      }
      if (lines[i].quantity <= 0) {
        setErrorMessage(`Line ${i + 1} quantity must be greater than zero.`);
        return;
      }
    }

    if (totals.total <= 0 && paymentStatus !== "DRAFT") {
      setErrorMessage("Purchase total must be greater than ₹0.00.");
      return;
    }

    if (paymentStatus === "PARTIALLY_PAID") {
      const rawPaid = Math.round(parseFloat(paidAmountStr || "0") * 100);
      if (isNaN(rawPaid) || rawPaid <= 0) {
        setErrorMessage("Please enter a valid partial payment amount.");
        return;
      }
      if (rawPaid >= totals.total) {
        setErrorMessage(
          `Partially paid amount (₹${(rawPaid / 100).toFixed(2)}) must be less than the total purchase amount (₹${(totals.total / 100).toFixed(2)}). For full payment, select 'Fully Paid'.`
        );
        return;
      }
      if (!paymentAccountId) {
        setErrorMessage("Please select a payment account (Cash in Hand or Bank Account).");
        return;
      }
    }

    if (paymentStatus === "PAID" && !paymentAccountId) {
      setErrorMessage("Please select a payment account (Cash in Hand or Bank Account).");
      return;
    }

    setSubmitting(true);

    try {
      let initialPayment = undefined;
      if (paymentStatus === "PAID") {
        initialPayment = {
          financialAccountId: paymentAccountId,
          amountMinor: totals.total,
          paymentDate,
          paymentMethod,
          referenceNumber: paymentReference.trim() || undefined,
        };
      } else if (paymentStatus === "PARTIALLY_PAID") {
        const rawPaid = Math.round(parseFloat(paidAmountStr) * 100);
        initialPayment = {
          financialAccountId: paymentAccountId,
          amountMinor: rawPaid,
          paymentDate,
          paymentMethod,
          referenceNumber: paymentReference.trim() || undefined,
        };
      }

      const payload = {
        workspaceId: activeWorkspace.id,
        supplierId: supplierId || null,
        supplierBillNumber: supplierBillNumber.trim() || null,
        purchaseDate,
        dueDate: dueDate || null,
        categoryId: mainCategoryId || null,
        subcategoryId: subcategoryId || null,
        status: paymentStatus,
        purchaseType: "EXPENSE",
        notes: notes.trim() || null,
        lines,
        attachmentIds,
        initialPayment,
      };

      const res = await fetch(`/api/accounting/purchases?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create purchase.");
      }

      triggerRefresh();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while saving the purchase.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="acc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-purchase-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        className="acc-modal-dialog"
        style={{
          maxWidth: "880px",
          width: "95vw",
          maxHeight: "92vh",
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
          <div>
            <h2 id="create-purchase-title" style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
              {initialDraftData ? "Edit Purchase Draft" : "+ New Purchase / Supplier Bill"}
            </h2>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--acc-text-muted, #A3A3A3)" }}>
              Record supplier purchases, track incoming bills, and manage payables with double-entry integrity.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
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
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {/* Error Banner */}
          {errorMessage && (
            <div
              className="acc-alert acc-alert-danger"
              style={{
                marginBottom: "1.25rem",
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
              }}
              role="alert"
            >
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Unsupported Inventory/Equipment Alert */}
          {unsupportedNotice && (
            <div
              className="acc-alert acc-alert-warning"
              style={{
                marginBottom: "1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
              role="status"
            >
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "0.9rem" }}>{unsupportedNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setUnsupportedNotice(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* 1. Supplier and Date Information */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            {/* Supplier Selector */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--acc-text-main)" }}>
                  Supplier <span style={{ color: "var(--acc-danger, #EF4444)" }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setQuickSupplierOpen(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--acc-blue-accent, #2583FF)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  + Add Person
                </button>
              </div>
              <select
                className="acc-form-input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required={paymentStatus !== "DRAFT"}
                disabled={submitting}
              >
                <option value="">-- Select Supplier from People --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.type === "VENDOR" ? "(Supplier)" : `(${s.type.toLowerCase()})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier Bill / Invoice Number */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                Supplier Bill # <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>(Optional)</span>
              </label>
              <input
                type="text"
                className="acc-form-input"
                placeholder="e.g. INV-9842 or BILL-001"
                value={supplierBillNumber}
                onChange={(e) => setSupplierBillNumber(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                Purchase Date <span style={{ color: "var(--acc-danger, #EF4444)" }}>*</span>
              </label>
              <input
                type="date"
                className="acc-form-input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            {/* Due Date (Optional) */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                Payment Due Date <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>(Optional)</span>
              </label>
              <input
                type="date"
                className="acc-form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* 2. Customer-Created Expense Category Classification */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
              marginBottom: "1.25rem",
              padding: "1rem",
              backgroundColor: "var(--acc-raised, #1C1C1C)",
              borderRadius: "8px",
              border: "1px solid var(--acc-border, #303030)",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                Expense Category <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>(Customer-created)</span>
              </label>
              <select
                className="acc-form-input"
                value={mainCategoryId}
                onChange={(e) => {
                  setMainCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
                disabled={submitting}
              >
                <option value="">-- General Operating Expenses --</option>
                {mainCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {mainCategories.length === 0 && (
                <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  No customer expense categories created yet. Create them anytime under Settings → Categories.
                </p>
              )}
            </div>

            {subcategories.length > 0 && (
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                  Subcategory
                </label>
                <select
                  className="acc-form-input"
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- All Subcategories in {mainCategories.find((c) => c.id === mainCategoryId)?.name} --</option>
                  {subcategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                Purchase Classification
              </label>
              <select
                className="acc-form-input"
                value={purchaseType}
                onChange={(e) => handlePurchaseTypeChange(e.target.value as PurchaseType)}
                disabled={submitting}
              >
                <option value="EXPENSE">Expense / Operating Purchase</option>
                <option value="INVENTORY">Inventory / Raw Materials (Checks support)</option>
                <option value="ASSET">Equipment / Capital Asset (Checks support)</option>
              </select>
            </div>
          </div>

          {/* 3. Item Lines Table */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Item Lines</h3>
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                onClick={handleAddLine}
                disabled={submitting}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <Plus size={14} /> Add Line Item
              </button>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid var(--acc-border, #303030)", borderRadius: "8px" }}>
              <table className="acc-table" style={{ width: "100%", margin: 0, fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--acc-raised, #1C1C1C)" }}>
                    <th style={{ width: "25%", padding: "0.6rem 0.75rem" }}>Catalog Product (Optional)</th>
                    <th style={{ width: "35%", padding: "0.6rem 0.75rem" }}>Description *</th>
                    <th style={{ width: "12%", padding: "0.6rem 0.75rem", textAlign: "right" }}>Qty</th>
                    <th style={{ width: "16%", padding: "0.6rem 0.75rem", textAlign: "right" }}>Unit Price</th>
                    <th style={{ width: "12%", padding: "0.6rem 0.75rem", textAlign: "right" }}>Amount</th>
                    <th style={{ width: "40px", padding: "0.6rem 0.5rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const lineAmount = Math.max(
                      0,
                      Math.round(line.quantity * line.unitPriceMinor) - line.discountMinor + line.taxMinor
                    );
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--acc-border, #303030)" }}>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <select
                            className="acc-form-input"
                            style={{ padding: "0.35rem 0.5rem", fontSize: "0.8rem" }}
                            value={line.productId || ""}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            disabled={submitting}
                          >
                            <option value="">-- Manual item --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (₹{(p.default_price_minor / 100).toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <input
                            type="text"
                            className="acc-form-input"
                            style={{ padding: "0.35rem 0.5rem", fontSize: "0.85rem" }}
                            placeholder="Description of supplies or services..."
                            value={line.description}
                            onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                            required
                            disabled={submitting}
                          />
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="acc-form-input"
                            style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontSize: "0.85rem" }}
                            value={line.quantity}
                            onChange={(e) => handleLineChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                            required
                            disabled={submitting}
                          />
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="acc-form-input"
                            style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontSize: "0.85rem" }}
                            placeholder="0.00"
                            value={(line.unitPriceMinor / 100).toString()}
                            onChange={(e) => {
                              const val = Math.round(parseFloat(e.target.value || "0") * 100);
                              handleLineChange(idx, "unitPriceMinor", isNaN(val) ? 0 : val);
                            }}
                            required
                            disabled={submitting}
                          />
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600 }}>
                          {formatMoney(lineAmount)}
                        </td>
                        <td style={{ padding: "0.5rem 0.5rem", textAlign: "center" }}>
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              disabled={submitting}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--acc-danger, #EF4444)",
                                cursor: "pointer",
                                padding: "0.25rem",
                              }}
                              title="Delete line"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Summary Card */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "280px",
                  padding: "0.85rem 1rem",
                  backgroundColor: "var(--acc-raised, #1C1C1C)",
                  borderRadius: "8px",
                  border: "1px solid var(--acc-border, #303030)",
                  fontSize: "0.9rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ color: "var(--acc-text-muted)" }}>Subtotal:</span>
                  <span>{formatMoney(totals.subtotal)}</span>
                </div>
                {totals.tax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ color: "var(--acc-text-muted)" }}>Tax:</span>
                    <span>+{formatMoney(totals.tax)}</span>
                  </div>
                )}
                {totals.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ color: "var(--acc-text-muted)" }}>Discount:</span>
                    <span>-{formatMoney(totals.discount)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    borderTop: "1px solid var(--acc-border, #303030)",
                    paddingTop: "0.4rem",
                    color: "var(--acc-text-main)",
                  }}
                >
                  <span>Total Purchase:</span>
                  <span style={{ color: "var(--acc-blue-accent, #2583FF)" }}>{formatMoney(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Payment Options (Draft, Unpaid, Fully Paid, Partially Paid) */}
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "var(--acc-raised, #1C1C1C)",
              borderRadius: "8px",
              border: "1px solid var(--acc-border, #303030)",
              marginBottom: "1.25rem",
            }}
          >
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.75rem 0" }}>Payment Option</h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem", marginBottom: "1rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.6rem 0.75rem",
                  border: `1px solid ${paymentStatus === "UNPAID" ? "var(--acc-blue, #2563EB)" : "var(--acc-border, #303030)"}`,
                  borderRadius: "6px",
                  backgroundColor: paymentStatus === "UNPAID" ? "var(--acc-blue-soft, rgba(37,99,235,0.15))" : "transparent",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="radio"
                  name="paymentStatus"
                  value="UNPAID"
                  checked={paymentStatus === "UNPAID"}
                  onChange={() => setPaymentStatus("UNPAID")}
                  disabled={submitting}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Unpaid (Credit)</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Pay later in full</div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.6rem 0.75rem",
                  border: `1px solid ${paymentStatus === "PAID" ? "var(--acc-blue, #2563EB)" : "var(--acc-border, #303030)"}`,
                  borderRadius: "6px",
                  backgroundColor: paymentStatus === "PAID" ? "var(--acc-blue-soft, rgba(37,99,235,0.15))" : "transparent",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="radio"
                  name="paymentStatus"
                  value="PAID"
                  checked={paymentStatus === "PAID"}
                  onChange={() => setPaymentStatus("PAID")}
                  disabled={submitting}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Fully Paid</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Paid now</div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.6rem 0.75rem",
                  border: `1px solid ${paymentStatus === "PARTIALLY_PAID" ? "var(--acc-blue, #2563EB)" : "var(--acc-border, #303030)"}`,
                  borderRadius: "6px",
                  backgroundColor: paymentStatus === "PARTIALLY_PAID" ? "var(--acc-blue-soft, rgba(37,99,235,0.15))" : "transparent",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="radio"
                  name="paymentStatus"
                  value="PARTIALLY_PAID"
                  checked={paymentStatus === "PARTIALLY_PAID"}
                  onChange={() => setPaymentStatus("PARTIALLY_PAID")}
                  disabled={submitting}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Partially Paid</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Partial advance/payment</div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.6rem 0.75rem",
                  border: `1px solid ${paymentStatus === "DRAFT" ? "var(--acc-blue, #2563EB)" : "var(--acc-border, #303030)"}`,
                  borderRadius: "6px",
                  backgroundColor: paymentStatus === "DRAFT" ? "var(--acc-blue-soft, rgba(37,99,235,0.15))" : "transparent",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <input
                  type="radio"
                  name="paymentStatus"
                  value="DRAFT"
                  checked={paymentStatus === "DRAFT"}
                  onChange={() => setPaymentStatus("DRAFT")}
                  disabled={submitting}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Draft</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>No ledger postings yet</div>
                </div>
              </label>
            </div>

            {/* Extra fields if Paid or Partially Paid */}
            {(paymentStatus === "PAID" || paymentStatus === "PARTIALLY_PAID") && (
              <div
                style={{
                  borderTop: "1px solid var(--acc-border, #303030)",
                  paddingTop: "1rem",
                  marginTop: "0.5rem",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                }}
              >
                {/* Payment Account (strictly Cash in Hand or Bank Account) */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                    Payment Account <span style={{ color: "var(--acc-danger, #EF4444)" }}>*</span>
                  </label>
                  <select
                    className="acc-form-input"
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    required
                    disabled={submitting}
                  >
                    <option value="">-- Select Cash in Hand or Bank Account --</option>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.subtype === "CASH" ? "Cash" : "Bank"}) - Bal: {formatMoney(a.current_balance_minor)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* If Partially Paid: Amount to pay now */}
                {paymentStatus === "PARTIALLY_PAID" && (
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                      Amount Paid Now (₹) <span style={{ color: "var(--acc-danger, #EF4444)" }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(totals.total / 100) - 0.01}
                      className="acc-form-input"
                      placeholder="e.g. 3000.00"
                      value={paidAmountStr}
                      onChange={(e) => setPaidAmountStr(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                )}

                {/* Payment Reference */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                    Payment Reference <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="acc-form-input"
                    placeholder="e.g. Cheque / UTR / IMPS ref"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}

            {/* Live Financial Outcome Preview */}
            {paymentStatus !== "DRAFT" && (
              <div
                style={{
                  marginTop: "0.85rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "var(--acc-surface, #141414)",
                  border: "1px solid var(--acc-border, #303030)",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  display: "flex",
                  gap: "1.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <span style={{ color: "var(--acc-text-muted)" }}>Total Purchase: </span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(totals.total)}</span>
                </div>
                <div>
                  <span style={{ color: "var(--acc-text-muted)" }}>Paid Now: </span>
                  <span style={{ fontWeight: 600, color: "var(--acc-success, #10B981)" }}>
                    {formatMoney(computedPaidAndDue.paidMinor)}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--acc-text-muted)" }}>Supplier Balance (I Owe): </span>
                  <span style={{ fontWeight: 600, color: computedPaidAndDue.dueMinor > 0 ? "var(--acc-warning, #F59E0B)" : "inherit" }}>
                    {formatMoney(computedPaidAndDue.dueMinor)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 5. Notes & Attachments */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {/* Notes */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                Notes / Internal Remarks
              </label>
              <textarea
                className="acc-form-input"
                rows={3}
                placeholder="Optional notes about delivery, terms, or purchase details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Attachments Dropzone */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.35rem" }}>
                Bill / Receipt Attachments <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>(JPEG, PNG, WebP, PDF)</span>
              </label>
              <TransactionAttachmentsDropzone
                onChange={(ids) => setAttachmentIds(ids)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              borderTop: "1px solid var(--acc-border, #303030)",
              paddingTop: "1.25rem",
            }}
          >
            <button
              type="button"
              className="acc-btn acc-btn-outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="acc-btn acc-btn-primary"
              disabled={submitting}
              style={{ minWidth: "140px" }}
            >
              {submitting ? "Saving..." : paymentStatus === "DRAFT" ? "Save as Draft" : "Record Purchase"}
            </button>
          </div>
        </form>

        {/* Quick Add Supplier Sub-Modal */}
        {quickSupplierOpen && (
          <div
            className="acc-modal-backdrop"
            style={{ zIndex: 1100 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingQuickSupplier) setQuickSupplierOpen(false);
            }}
          >
            <div
              className="acc-modal-dialog"
              style={{
                maxWidth: "420px",
                padding: "1.5rem",
                backgroundColor: "var(--acc-surface, #141414)",
                border: "1px solid var(--acc-border, #303030)",
                borderRadius: "10px",
              }}
            >
              <h3 style={{ fontSize: "1.1rem", margin: "0 0 1rem 0" }}>+ Add New Supplier</h3>
              <form onSubmit={handleSaveQuickSupplier}>
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Supplier Name *</label>
                  <input
                    type="text"
                    className="acc-form-input"
                    placeholder="Company or Contact Name"
                    value={quickSupplierName}
                    onChange={(e) => setQuickSupplierName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Phone Number</label>
                  <input
                    type="tel"
                    className="acc-form-input"
                    placeholder="+91 98765 43210"
                    value={quickSupplierPhone}
                    onChange={(e) => setQuickSupplierPhone(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: "1.25rem" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Email Address</label>
                  <input
                    type="email"
                    className="acc-form-input"
                    placeholder="supplier@example.com"
                    value={quickSupplierEmail}
                    onChange={(e) => setQuickSupplierEmail(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="acc-btn acc-btn-outline acc-btn-sm"
                    onClick={() => setQuickSupplierOpen(false)}
                    disabled={savingQuickSupplier}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="acc-btn acc-btn-primary acc-btn-sm"
                    disabled={savingQuickSupplier}
                  >
                    {savingQuickSupplier ? "Adding..." : "Add Supplier"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
