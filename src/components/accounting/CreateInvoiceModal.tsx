"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput, { cleanRawAmount } from "../ui/FormattedMoneyInput";

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  default_price_minor: number;
}

interface Contact {
  id: string;
  name: string;
  type: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  receivable_balance_minor?: number;
}

export interface InvoiceLineItemState {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPriceStr: string;
}

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceIdToEdit?: string | null;
  initialContacts?: Contact[];
  initialProducts?: Product[];
  onInvoiceSaved?: (invoice: any, isIssued: boolean) => void;
}

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  invoiceIdToEdit,
  initialContacts,
  initialProducts,
  onInvoiceSaved,
}: CreateInvoiceModalProps) {
  const { activeWorkspace, formatMoney, canMutate } = useAccounting();

  // Mode: "EDIT" or "PREVIEW"
  const [viewMode, setViewMode] = useState<"EDIT" | "PREVIEW">("EDIT");

  // Contacts & Products
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Customer Selector State
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [showInlineNewCustomer, setShowInlineNewCustomer] = useState(false);

  // Inline New Customer form fields
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [showCustExtraFields, setShowCustExtraFields] = useState(false);
  const [inlineCustomerSaving, setInlineCustomerSaving] = useState(false);
  const [inlineCustomerError, setInlineCustomerError] = useState<string | null>(null);

  // Invoice Form Fields
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [lines, setLines] = useState<InvoiceLineItemState[]>([
    { description: "", quantity: 1, unitPriceStr: "" },
  ]);

  // Discount & Tax
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountStr, setDiscountStr] = useState("");
  const [showTax, setShowTax] = useState(false);
  const [taxStr, setTaxStr] = useState("");

  // Notes & Terms
  const [showNotesSection, setShowNotesSection] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [internalNotes, setInternalNotes] = useState("");

  // Submitting & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Check if workspace settings configure tax
  const isTaxConfigured = Boolean(
    (activeWorkspace as any)?.settings?.enable_tax || (activeWorkspace as any)?.settings?.tax_rate
  );

  // Load existing customers and catalog products
  useEffect(() => {
    if (!isOpen || !activeWorkspace) return;
    let isMounted = true;

    if (initialContacts) {
      setContacts(initialContacts);
    }
    if (initialProducts) {
      setProducts(initialProducts);
    }

    async function loadDependencies() {
      if (initialContacts && initialProducts) return;
      setLoadingData(true);
      try {
        const [contactsRes, productsRes] = await Promise.all([
          !initialContacts ? fetch(`/api/accounting/contacts?workspaceId=${activeWorkspace?.id}&type=CUSTOMER`) : null,
          !initialProducts ? fetch(`/api/accounting/products?workspaceId=${activeWorkspace?.id}`) : null,
        ]);

        if (isMounted) {
          if (contactsRes && contactsRes.ok) {
            const data = await contactsRes.json();
            setContacts(data.contacts || []);
          }
          if (productsRes && productsRes.ok) {
            const data = await productsRes.json();
            setProducts(data.products || []);
          }
        }
      } catch (err) {
        console.error("Failed to load invoice dependencies:", err);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }

    loadDependencies();
    return () => {
      isMounted = false;
    };
  }, [isOpen, activeWorkspace, initialContacts, initialProducts]);

  // If editing an existing draft, fetch its details
  useEffect(() => {
    if (!isOpen || !invoiceIdToEdit || !activeWorkspace) return;
    let isMounted = true;

    async function loadExistingInvoice() {
      try {
        const res = await fetch(`/api/accounting/invoices/${invoiceIdToEdit}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data.invoice) return;

        const inv = data.invoice;
        setSelectedContactId(inv.contact_id || "");
        if (inv.issue_date) setIssueDate(inv.issue_date.slice(0, 10));
        if (inv.due_date) setDueDate(inv.due_date.slice(0, 10));
        setCustomerNotes(inv.notes || "");
        setPaymentTerms(inv.terms || "Net 30");
        setInternalNotes(inv.internal_notes || "");

        if (Number(inv.discount_minor) > 0) {
          setShowDiscount(true);
          setDiscountStr((Number(inv.discount_minor) / 100).toFixed(2));
        }
        if (Number(inv.tax_minor) > 0) {
          setShowTax(true);
          setTaxStr((Number(inv.tax_minor) / 100).toFixed(2));
        }

        if (data.lines && data.lines.length > 0) {
          setLines(
            data.lines.map((l: any) => ({
              id: l.id,
              productId: l.product_id,
              description: l.description,
              quantity: Number(l.quantity),
              unitPriceStr: (Number(l.unit_price_minor) / 100).toFixed(2),
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load draft invoice for editing:", err);
      }
    }

    loadExistingInvoice();
    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceIdToEdit, activeWorkspace]);

  // Reset form when opening as brand-new invoice
  useEffect(() => {
    if (isOpen && !invoiceIdToEdit) {
      setViewMode("EDIT");
      setSelectedContactId("");
      setCustomerSearch("");
      setShowInlineNewCustomer(false);
      setIssueDate(new Date().toISOString().slice(0, 10));
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setDueDate(d.toISOString().slice(0, 10));
      setLines([{ description: "", quantity: 1, unitPriceStr: "" }]);
      setShowDiscount(false);
      setDiscountStr("");
      setShowTax(false);
      setTaxStr("");
      setFormError(null);
      // Pre-fill default workspace payment instructions if available
      const defaultInstructions = (activeWorkspace as any)?.settings?.payment_instructions || "";
      setCustomerNotes(defaultInstructions);
      setPaymentTerms("Net 30");
      setInternalNotes("");
    }
  }, [isOpen, invoiceIdToEdit, activeWorkspace]);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return contacts;
    const q = customerSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [contacts, customerSearch]);

  const selectedContact = useMemo(() => {
    return contacts.find((c) => c.id === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  // Live item totals calculation
  const { subtotalMinor, discountMinor, taxMinor, totalMinor, lineCalculations } = useMemo(() => {
    let subtotal = 0;
    const calcs = lines.map((l) => {
      const q = Math.max(0.01, Number(l.quantity) || 1);
      const cleanPrice = cleanRawAmount(l.unitPriceStr);
      const priceNum = parseFloat(cleanPrice) || 0;
      const unitPriceMin = Math.round(priceNum * 100);
      const lineTotal = Math.round(q * unitPriceMin);
      subtotal += lineTotal;
      return {
        ...l,
        quantity: q,
        unitPriceMinor: unitPriceMin,
        lineTotalMinor: lineTotal,
      };
    });

    const discClean = cleanRawAmount(discountStr);
    const discNum = showDiscount && discClean ? parseFloat(discClean) || 0 : 0;
    const discMinor = Math.min(subtotal, Math.round(discNum * 100));

    const taxClean = cleanRawAmount(taxStr);
    const taxNum = showTax && isTaxConfigured && taxClean ? parseFloat(taxClean) || 0 : 0;
    const tMinor = Math.round(taxNum * 100);

    const totMinor = Math.max(0, subtotal - discMinor + tMinor);

    return {
      subtotalMinor: subtotal,
      discountMinor: discMinor,
      taxMinor: tMinor,
      totalMinor: totMinor,
      lineCalculations: calcs,
    };
  }, [lines, discountStr, showDiscount, taxStr, showTax, isTaxConfigured]);

  // Handle saving new customer inline
  const handleSaveInlineCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    const name = newCustName.trim();
    if (name.length < 2) {
      setInlineCustomerError("Customer name must be at least 2 characters.");
      return;
    }

    setInlineCustomerSaving(true);
    setInlineCustomerError(null);

    if (activeWorkspace.id.startsWith("preview-")) {
      const mockCreated: Contact = {
        id: `cust-${Date.now()}`,
        name,
        type: "CUSTOMER",
        email: newCustEmail.trim() || undefined,
        phone: newCustPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
      };
      setContacts((prev) => [mockCreated, ...prev]);
      setSelectedContactId(mockCreated.id);
      setShowInlineNewCustomer(false);
      setNewCustName("");
      setNewCustEmail("");
      setNewCustPhone("");
      setNewCustAddress("");
      setShowCustExtraFields(false);
      setIsCustomerDropdownOpen(false);
      setInlineCustomerSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/accounting/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name,
          type: "CUSTOMER",
          email: newCustEmail.trim() || undefined,
          phone: newCustPhone.trim() || undefined,
          address: newCustAddress.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setInlineCustomerError(data.error || "Failed to create customer");
        return;
      }

      const created: Contact = data.contact;
      setContacts((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setSelectedContactId(created.id);
      setShowInlineNewCustomer(false);
      setNewCustName("");
      setNewCustEmail("");
      setNewCustPhone("");
      setNewCustAddress("");
      setShowCustExtraFields(false);
      setIsCustomerDropdownOpen(false);
    } catch (err: any) {
      setInlineCustomerError(err.message || "Failed to save customer");
    } finally {
      setInlineCustomerSaving(false);
    }
  };

  // Add line item
  const handleAddLine = () => {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitPriceStr: "" }]);
  };

  // Remove line item (preserves at least 1)
  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // Catalog item selected in row
  const handleSelectCatalogProduct = (idx: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setLines((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        productId: prod.id,
        description: prod.name,
        unitPriceStr: (prod.default_price_minor / 100).toFixed(2),
      };
      return next;
    });
  };

  // Form Submission (Draft or Issue)
  const handleSubmitInvoice = async (targetStatus: "DRAFT" | "ISSUED") => {
    if (!activeWorkspace) return;
    setFormError(null);

    // Validation
    if (!selectedContactId) {
      setFormError("Please select or add a customer.");
      return;
    }

    const validLines = lines.filter((l) => l.description.trim().length > 0);
    if (validLines.length === 0) {
      setFormError("Please add at least one line item with a description.");
      return;
    }

    for (let i = 0; i < validLines.length; i++) {
      const cleanPrice = cleanRawAmount(validLines[i].unitPriceStr);
      const price = parseFloat(cleanPrice);
      if (isNaN(price) || price <= 0) {
        setFormError(`Line ${i + 1} ("${validLines[i].description}") has an invalid unit price. Must be greater than 0.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payloadLines = validLines.map((l) => ({
        productId: l.productId || null,
        description: l.description.trim(),
        quantity: Math.max(0.01, Number(l.quantity) || 1),
        unitPriceMinor: Math.round(parseFloat(cleanRawAmount(l.unitPriceStr)) * 100),
      }));

      const bodyData = {
        workspaceId: activeWorkspace.id,
        contactId: selectedContactId,
        issueDate,
        dueDate,
        status: targetStatus,
        notes: customerNotes.trim() || undefined,
        terms: paymentTerms.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        lines: payloadLines,
        issueNow: targetStatus === "ISSUED",
      };

      if (activeWorkspace.id.startsWith("preview-")) {
        const mockInv = {
          id: invoiceIdToEdit || `inv-${Date.now()}`,
          invoice_number: `INV-2026-0001`,
          contact_id: selectedContactId,
          contact_name: selectedContact?.name || "Direct Customer",
          contact_email: selectedContact?.email,
          contact_phone: selectedContact?.phone,
          contact_address: selectedContact?.address,
          issue_date: issueDate,
          due_date: dueDate,
          status: targetStatus,
          subtotal_minor: subtotalMinor,
          discount_minor: discountMinor,
          tax_minor: taxMinor,
          total_minor: totalMinor,
          amount_paid_minor: 0,
          amount_due_minor: totalMinor,
          notes: customerNotes.trim() || null,
          terms: paymentTerms.trim() || null,
          internal_notes: internalNotes.trim() || null,
          share_token: "preview-token-12345",
          lines: lineCalculations.map((l, i) => ({
            id: `line-${i + 1}`,
            description: l.description,
            quantity: l.quantity,
            unit_price_minor: l.unitPriceMinor,
            total_minor: l.lineTotalMinor,
          })),
        };
        if (onInvoiceSaved) onInvoiceSaved(mockInv, targetStatus === "ISSUED");
        onClose();
        return;
      }

      let res: Response;
      if (invoiceIdToEdit) {
        res = await fetch(`/api/accounting/invoices/${invoiceIdToEdit}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        });
      } else {
        res = await fetch("/api/accounting/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyData),
        });
      }

      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error || "Failed to save invoice.");
        return;
      }

      if (onInvoiceSaved) onInvoiceSaved(resData.invoice, targetStatus === "ISSUED");
      onClose();
    } catch (err: any) {
      setFormError(err.message || "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="acc-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <div
        className="acc-modal-content acc-invoice-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="acc-modal-header" style={{ alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h3 id="invoice-modal-title" className="acc-modal-title">
                {viewMode === "PREVIEW"
                  ? "Invoice Preview"
                  : invoiceIdToEdit
                  ? "Edit Draft Invoice"
                  : "New Client Invoice"}
              </h3>
              {viewMode === "PREVIEW" && (
                <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.75rem" }}>
                  Customer View
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", margin: "0.25rem 0 0" }}>
              {viewMode === "PREVIEW"
                ? "This is how your customer will view the invoice. No financial changes have been posted."
                : "Enter customer, line items, and terms. You can save as a draft or issue immediately."}
            </p>
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

        {/* Form Error Alert */}
        {formError && (
          <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
            {formError}
          </div>
        )}

        {/* View Switcher: EDIT MODE vs PREVIEW MODE */}
        {viewMode === "PREVIEW" ? (
          /* ==========================================================================
             CUSTOMER PREVIEW VIEW
             Exact canonical customer presentation (strictly excludes internal notes)
             ========================================================================== */
          <div className="acc-invoice-preview-container">
            <div className="acc-invoice-paper">
              {/* Invoice Header */}
              <div className="acc-preview-header">
                <div>
                  <h4 className="acc-preview-org-name">{activeWorkspace?.name || "ZAPPIT Workspace"}</h4>
                  <p className="acc-preview-meta-text">Official Client Invoice</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="acc-preview-doc-title">INVOICE</span>
                  <p className="acc-preview-meta-text">
                    Status: <strong style={{ textTransform: "uppercase" }}>Draft / Issued</strong>
                  </p>
                </div>
              </div>

              {/* Parties and Dates Grid */}
              <div className="acc-preview-grid">
                <div>
                  <span className="acc-preview-label">Billed To:</span>
                  <div className="acc-preview-customer-name">
                    {selectedContact?.name || "Direct Customer"}
                  </div>
                  {selectedContact?.email && (
                    <div className="acc-preview-meta-text">{selectedContact.email}</div>
                  )}
                  {selectedContact?.phone && (
                    <div className="acc-preview-meta-text">{selectedContact.phone}</div>
                  )}
                  {selectedContact?.address && (
                    <div className="acc-preview-meta-text" style={{ whiteSpace: "pre-line" }}>
                      {selectedContact.address}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ marginBottom: "0.5rem" }}>
                    <span className="acc-preview-label">Issue Date</span>
                    <div className="acc-preview-value">{issueDate}</div>
                  </div>
                  <div>
                    <span className="acc-preview-label">Due Date</span>
                    <div className="acc-preview-value">{dueDate}</div>
                  </div>
                  {paymentTerms && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <span className="acc-preview-label">Payment Terms</span>
                      <div className="acc-preview-value">{paymentTerms}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
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
                    {lineCalculations.map((line, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{line.description || "—"}</td>
                        <td className="acc-align-right tabular-nums">{line.quantity}</td>
                        <td className="acc-align-right tabular-nums">
                          {formatMoney(line.unitPriceMinor, activeWorkspace?.currency)}
                        </td>
                        <td className="acc-align-right tabular-nums font-semibold">
                          {formatMoney(line.lineTotalMinor, activeWorkspace?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Box */}
              <div className="acc-preview-totals-box">
                <div className="acc-preview-total-row">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">
                    {formatMoney(subtotalMinor, activeWorkspace?.currency)}
                  </span>
                </div>
                {discountMinor > 0 && (
                  <div className="acc-preview-total-row" style={{ color: "var(--acc-success)" }}>
                    <span>Discount:</span>
                    <span className="tabular-nums">
                      -{formatMoney(discountMinor, activeWorkspace?.currency)}
                    </span>
                  </div>
                )}
                {taxMinor > 0 && (
                  <div className="acc-preview-total-row">
                    <span>Tax:</span>
                    <span className="tabular-nums">
                      +{formatMoney(taxMinor, activeWorkspace?.currency)}
                    </span>
                  </div>
                )}
                <div className="acc-preview-total-row acc-preview-final-row">
                  <span>Total Amount Due:</span>
                  <span className="tabular-nums font-bold">
                    {formatMoney(totalMinor, activeWorkspace?.currency)}
                  </span>
                </div>
              </div>

              {/* Customer Notes / Payment Instructions */}
              {customerNotes && (
                <div className="acc-preview-notes-section">
                  <span className="acc-preview-label">Notes & Payment Instructions</span>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
                    {customerNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions for Preview Mode */}
            <div className="acc-modal-actions" style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-outline"
                onClick={() => setViewMode("EDIT")}
              >
                ← Back to Edit
              </button>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  disabled={submitting}
                  onClick={() => handleSubmitInvoice("DRAFT")}
                >
                  {submitting ? "Saving..." : "Save as Draft"}
                </button>
                {canMutate && (
                  <button
                    type="button"
                    className="acc-btn acc-btn-primary"
                    disabled={submitting}
                    onClick={() => handleSubmitInvoice("ISSUED")}
                  >
                    {submitting
                      ? "Issuing..."
                      : invoiceIdToEdit
                      ? "Issue Invoice"
                      : "Create & Issue Invoice"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ==========================================================================
             EDIT FORM VIEW
             Clean, spacious layout with customer selector, items, totals, and notes
             ========================================================================== */
          <div className="acc-invoice-form-scrollable">
            {/* 1. Customer Section */}
            <div className="acc-form-section">
              <label className="acc-form-label" style={{ fontWeight: 600 }}>
                Customer / Client *
              </label>

              {selectedContact ? (
                /* Selected Customer Card with Quick Change */
                <div className="acc-selected-customer-card">
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{selectedContact.name}</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginTop: "0.125rem" }}>
                        {[selectedContact.email, selectedContact.phone].filter(Boolean).join(" · ") || "No contact info recorded"}
                      </div>
                      {selectedContact.address && (
                        <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginTop: "0.125rem" }}>
                          📍 {selectedContact.address}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline acc-btn-sm"
                      onClick={() => {
                        setSelectedContactId("");
                        setCustomerSearch("");
                        setIsCustomerDropdownOpen(true);
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : showInlineNewCustomer ? (
                /* Inline Add Customer Form */
                <div className="acc-inline-new-customer-box">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>+ Add New Customer</span>
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline acc-btn-sm"
                      style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => setShowInlineNewCustomer(false)}
                    >
                      Back to Search
                    </button>
                  </div>

                  {inlineCustomerError && (
                    <div className="acc-alert acc-alert-danger" style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
                      {inlineCustomerError}
                    </div>
                  )}

                  <form onSubmit={handleSaveInlineCustomer}>
                    <div className="acc-form-group">
                      <label className="acc-form-label" htmlFor="new-cust-name">Full Customer / Business Name *</label>
                      <input
                        id="new-cust-name"
                        type="text"
                        required
                        className="acc-form-input"
                        placeholder="e.g. Acme Tech Solutions, Rahul Verma"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {!showCustExtraFields ? (
                      <button
                        type="button"
                        className="acc-link-btn"
                        style={{ fontSize: "0.8125rem", margin: "0.5rem 0", color: "var(--acc-blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onClick={() => setShowCustExtraFields(true)}
                      >
                        + Add Optional Email, Phone & Billing Address
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                          <div>
                            <label className="acc-form-label" htmlFor="new-cust-email">Email (Optional)</label>
                            <input
                              id="new-cust-email"
                              type="email"
                              className="acc-form-input"
                              placeholder="billing@company.com"
                              value={newCustEmail}
                              onChange={(e) => setNewCustEmail(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="acc-form-label" htmlFor="new-cust-phone">Phone (Optional)</label>
                            <input
                              id="new-cust-phone"
                              type="tel"
                              className="acc-form-input"
                              placeholder="+91 98765 43210"
                              value={newCustPhone}
                              onChange={(e) => setNewCustPhone(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="acc-form-label" htmlFor="new-cust-address">Billing Address (Optional)</label>
                          <textarea
                            id="new-cust-address"
                            rows={2}
                            className="acc-form-input"
                            placeholder="Street, City, State, PIN"
                            value={newCustAddress}
                            onChange={(e) => setNewCustAddress(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <button
                        type="button"
                        className="acc-btn acc-btn-outline acc-btn-sm"
                        onClick={() => setShowInlineNewCustomer(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="acc-btn acc-btn-primary acc-btn-sm"
                        disabled={inlineCustomerSaving}
                      >
                        {inlineCustomerSaving ? "Saving..." : "Save & Select Customer"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Searchable Customer Combobox */
                <div className="acc-customer-combobox-wrapper" ref={customerDropdownRef}>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        type="text"
                        className="acc-form-input"
                        placeholder="Search existing customer by name, email, or phone..."
                        value={customerSearch}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setIsCustomerDropdownOpen(true);
                        }}
                      />
                    </div>
                    {canMutate && (
                      <button
                        type="button"
                        className="acc-btn acc-btn-outline"
                        style={{ whiteSpace: "nowrap" }}
                        onClick={() => setShowInlineNewCustomer(true)}
                      >
                        + New Customer
                      </button>
                    )}
                  </div>

                  {isCustomerDropdownOpen && (
                    <div className="acc-customer-dropdown-menu">
                      {filteredCustomers.length === 0 ? (
                        <div style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                          No customers found for "{customerSearch}".
                          {canMutate && (
                            <button
                              type="button"
                              className="acc-link-btn"
                              style={{ display: "block", marginTop: "0.375rem", color: "var(--acc-blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                              onClick={() => {
                                setNewCustName(customerSearch);
                                setShowInlineNewCustomer(true);
                                setIsCustomerDropdownOpen(false);
                              }}
                            >
                              + Create "{customerSearch}" as a new customer
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredCustomers.map((cust) => (
                          <div
                            key={cust.id}
                            className="acc-customer-dropdown-item"
                            onClick={() => {
                              setSelectedContactId(cust.id);
                              setIsCustomerDropdownOpen(false);
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{cust.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                              {[cust.email, cust.phone].filter(Boolean).join(" · ") || "Customer"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Dates Section (Side-by-Side) */}
            <div className="acc-form-grid-2" style={{ marginTop: "1rem" }}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="inv-issue-date">
                  Issue Date *
                </label>
                <input
                  id="inv-issue-date"
                  type="date"
                  required
                  className="acc-form-input"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="inv-due-date">
                  Due Date *
                </label>
                <input
                  id="inv-due-date"
                  type="date"
                  required
                  className="acc-form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* 3. Invoice Items Section */}
            <div className="acc-form-section" style={{ marginTop: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label className="acc-form-label" style={{ fontWeight: 600, margin: 0 }}>
                  Invoice Items *
                </label>
                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  Snapshots of price & description are preserved on invoice
                </span>
              </div>

              {/* Items Table / Cards */}
              <div className="acc-items-container">
                {lines.map((line, idx) => {
                  const lineCalc = lineCalculations[idx] || { lineTotalMinor: 0 };
                  return (
                    <div key={idx} className="acc-item-row-card">
                      <div className="acc-item-fields-grid">
                        {/* Description & Catalog Picker */}
                        <div className="acc-item-col-desc">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                            <label className="acc-field-sublabel" htmlFor={`item-desc-${idx}`}>
                              Product / Service or Description *
                            </label>
                            {products.length > 0 && (
                              <select
                                className="acc-catalog-quick-select"
                                aria-label="Select product from workspace catalog"
                                value={line.productId || ""}
                                onChange={(e) => handleSelectCatalogProduct(idx, e.target.value)}
                              >
                                <option value="">From Catalog...</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({formatMoney(p.default_price_minor, activeWorkspace?.currency)})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <input
                            id={`item-desc-${idx}`}
                            type="text"
                            required
                            className="acc-form-input"
                            placeholder="e.g. Website Design, Consulting Sprint, Physical Unit"
                            value={line.description}
                            onChange={(e) => {
                              const updated = [...lines];
                              updated[idx].description = e.target.value;
                              setLines(updated);
                            }}
                          />
                        </div>

                        {/* Quantity */}
                        <div className="acc-item-col-qty">
                          <label className="acc-field-sublabel" htmlFor={`item-qty-${idx}`}>
                            Quantity *
                          </label>
                          <input
                            id={`item-qty-${idx}`}
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            className="acc-form-input tabular-nums"
                            value={line.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              const updated = [...lines];
                              updated[idx].quantity = isNaN(val) ? 1 : val;
                              setLines(updated);
                            }}
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="acc-item-col-price">
                          <label className="acc-field-sublabel" htmlFor={`item-price-${idx}`}>
                            Unit Price (₹) *
                          </label>
                          <FormattedMoneyInput
                            id={`item-price-${idx}`}
                            required
                            className="acc-form-input tabular-nums"
                            placeholder="0.00"
                            value={line.unitPriceStr}
                            onValueChange={(val) => {
                              const updated = [...lines];
                              updated[idx].unitPriceStr = val;
                              setLines(updated);
                            }}
                          />
                        </div>

                        {/* Line Amount */}
                        <div className="acc-item-col-amount">
                          <span className="acc-field-sublabel">Amount</span>
                          <div className="acc-line-amount-display tabular-nums">
                            {formatMoney(lineCalc.lineTotalMinor, activeWorkspace?.currency)}
                          </div>
                        </div>

                        {/* Remove Button */}
                        <div className="acc-item-col-remove">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              className="acc-remove-line-btn"
                              aria-label={`Remove item ${idx + 1}`}
                              title="Remove item"
                              onClick={() => handleRemoveLine(idx)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Item Button */}
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                style={{ marginTop: "0.5rem" }}
                onClick={handleAddLine}
              >
                + Add Item
              </button>
            </div>

            {/* 4. Live Totals Section */}
            <div className="acc-totals-wrapper" style={{ marginTop: "1.25rem" }}>
              <div className="acc-totals-card">
                <div className="acc-totals-row">
                  <span className="acc-totals-label">Subtotal</span>
                  <span className="acc-totals-value tabular-nums">
                    {formatMoney(subtotalMinor, activeWorkspace?.currency)}
                  </span>
                </div>

                {/* Collapsible Discount */}
                {!showDiscount ? (
                  <button
                    type="button"
                    className="acc-link-btn"
                    style={{ fontSize: "0.8125rem", color: "var(--acc-blue)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0", textAlign: "left" }}
                    onClick={() => setShowDiscount(true)}
                  >
                    + Add Discount
                  </button>
                ) : (
                  <div className="acc-totals-row" style={{ alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <span className="acc-totals-label">Discount</span>
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--acc-text-muted)", cursor: "pointer", fontSize: "0.75rem" }}
                        onClick={() => {
                          setShowDiscount(false);
                          setDiscountStr("");
                        }}
                        title="Remove discount"
                      >
                        ✕
                      </button>
                    </div>
                    <FormattedMoneyInput
                      className="acc-form-input tabular-nums"
                      style={{ width: "110px", padding: "0.25rem 0.5rem", fontSize: "0.8125rem", textAlign: "right" }}
                      placeholder="0.00"
                      value={discountStr}
                      onValueChange={setDiscountStr}
                    />
                  </div>
                )}

                {/* Optional Tax: only when tax is configured on workspace */}
                {isTaxConfigured && (
                  <>
                    {!showTax ? (
                      <button
                        type="button"
                        className="acc-link-btn"
                        style={{ fontSize: "0.8125rem", color: "var(--acc-blue)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0", textAlign: "left" }}
                        onClick={() => setShowTax(true)}
                      >
                        + Add Tax
                      </button>
                    ) : (
                      <div className="acc-totals-row" style={{ alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                          <span className="acc-totals-label">Tax</span>
                          <button
                            type="button"
                            style={{ background: "none", border: "none", color: "var(--acc-text-muted)", cursor: "pointer", fontSize: "0.75rem" }}
                            onClick={() => {
                              setShowTax(false);
                              setTaxStr("");
                            }}
                            title="Remove tax"
                          >
                            ✕
                          </button>
                        </div>
                        <FormattedMoneyInput
                          className="acc-form-input tabular-nums"
                          style={{ width: "110px", padding: "0.25rem 0.5rem", fontSize: "0.8125rem", textAlign: "right" }}
                          placeholder="0.00"
                          value={taxStr}
                          onValueChange={setTaxStr}
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="acc-totals-divider" />

                <div className="acc-totals-row acc-totals-final-row">
                  <span className="acc-totals-final-label">Final Total</span>
                  <span className="acc-totals-final-value tabular-nums">
                    {formatMoney(totalMinor, activeWorkspace?.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Optional Notes & Instructions (Collapsible) */}
            <div style={{ marginTop: "1.25rem" }}>
              <button
                type="button"
                className="acc-collapse-toggle-btn"
                onClick={() => setShowNotesSection(!showNotesSection)}
              >
                <span>{showNotesSection ? "▼" : "▶"} Notes, Payment Terms & Internal Notes</span>
                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                  {showNotesSection ? "Hide" : "Expand"}
                </span>
              </button>

              {showNotesSection && (
                <div className="acc-notes-box-container" style={{ marginTop: "0.75rem" }}>
                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="inv-terms">Payment Terms</label>
                    <input
                      id="inv-terms"
                      type="text"
                      className="acc-form-input"
                      placeholder="e.g. Net 30, Due upon receipt, 50% deposit"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    />
                  </div>

                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="inv-notes">
                      Notes / Payment Instructions (Visible to Customer)
                    </label>
                    <textarea
                      id="inv-notes"
                      rows={3}
                      className="acc-form-input"
                      placeholder="Bank account details, UPI ID, or delivery terms..."
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                    />
                  </div>

                  <div className="acc-internal-notes-card">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>🔒 Internal Notes</span>
                      <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.7rem", padding: "0.1rem 0.35rem" }}>
                        Team Only
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", margin: "0 0 0.5rem" }}>
                      Never shown on customer previews, printable PDFs, or public links.
                    </p>
                    <textarea
                      id="inv-internal-notes"
                      rows={2}
                      className="acc-form-input"
                      placeholder="Private notes, client history, follow-up instructions..."
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 6. Form Footer Actions */}
            <div className="acc-modal-actions" style={{ marginTop: "1.75rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={() => setViewMode("PREVIEW")}
                  disabled={submitting}
                >
                  Preview
                </button>

                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={() => handleSubmitInvoice("DRAFT")}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save as Draft"}
                </button>

                {canMutate && (
                  <button
                    type="button"
                    className="acc-btn acc-btn-primary"
                    onClick={() => handleSubmitInvoice("ISSUED")}
                    disabled={submitting}
                  >
                    {submitting
                      ? "Issuing..."
                      : invoiceIdToEdit
                      ? "Issue Invoice"
                      : "Create & Issue Invoice"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
