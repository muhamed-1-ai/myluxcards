"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput, { cleanRawAmount } from "../ui/FormattedMoneyInput";
import InvoiceSettingsModal from "./InvoiceSettingsModal";
import type { WarrantyType } from "@/lib/accounting/types";

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  default_price_minor: number;
  default_warranty_type?: WarrantyType;
  default_warranty_provider?: string;
  default_warranty_duration_months?: number;
  default_warranty_coverage?: string;
  default_warranty_exclusions?: string;
  default_warranty_contact?: string;
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
  model?: string;
  sku?: string;
  serialNumber?: string;
  serviceStartDate?: string;
  serviceEndDate?: string;
  warrantyType?: WarrantyType;
  warrantyProvider?: string;
  warrantyDurationMonths?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyCoverage?: string;
  warrantyExclusions?: string;
  warrantyContact?: string;
  isWarrantyExpanded?: boolean;
  isDetailsExpanded?: boolean;
  isServiceExpanded?: boolean;
}

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceIdToEdit?: string | null;
  directSaleToConvert?: any;
  initialContacts?: Contact[];
  initialProducts?: Product[];
  onInvoiceSaved?: (invoice: any, isIssued: boolean) => void;
}

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  invoiceIdToEdit,
  directSaleToConvert,
  initialContacts,
  initialProducts,
  onInvoiceSaved,
}: CreateInvoiceModalProps) {
  const { activeWorkspace, formatMoney, canMutate } = useAccounting();

  // Mode: "EDIT" or "PREVIEW"
  const [viewMode, setViewMode] = useState<"EDIT" | "PREVIEW">("EDIT");

  // Invoice Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Contacts, Products & Invoice Settings
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
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
    { description: "", quantity: 1, unitPriceStr: "", warrantyType: "NONE" },
  ]);

  // Discount & Tax
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountStr, setDiscountStr] = useState("");
  const [showTax, setShowTax] = useState(false);
  const [taxStr, setTaxStr] = useState("");

  // Notes, Terms & Warranty Policy
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Submitting & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const isTaxConfigured = Boolean(
    (activeWorkspace as any)?.settings?.enable_tax || (activeWorkspace as any)?.settings?.tax_rate
  );

  // Function to reload invoice settings
  const loadInvoiceSettings = async () => {
    try {
      const res = await fetch(`/api/accounting/invoices/settings`);
      if (res.ok) {
        const data = await res.json();
        setInvoiceSettings(data.settings);
        if (!invoiceIdToEdit && !directSaleToConvert) {
          if (data.settings?.default_notes && !customerNotes) setCustomerNotes(data.settings.default_notes);
          if (data.settings?.default_terms && paymentTerms === "Net 30") setPaymentTerms(data.settings.default_terms);
          if (data.settings?.default_warranty_terms && !warrantyTerms) setWarrantyTerms(data.settings.default_warranty_terms);
        }
      }
    } catch (e) {
      console.warn("Failed to refresh invoice settings:", e);
    }
  };

  // Load existing customers, products, and invoice branding settings
  useEffect(() => {
    if (!isOpen || !activeWorkspace) return;
    let isMounted = true;

    if (initialContacts) setContacts(initialContacts);
    if (initialProducts) setProducts(initialProducts);

    async function loadDependencies() {
      setLoadingData(true);
      try {
        const [contactsRes, productsRes, settingsRes] = await Promise.all([
          !initialContacts ? fetch(`/api/accounting/contacts?workspaceId=${activeWorkspace?.id}&type=CUSTOMER`) : null,
          !initialProducts ? fetch(`/api/accounting/products?workspaceId=${activeWorkspace?.id}`) : null,
          fetch(`/api/accounting/invoices/settings`),
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
          if (settingsRes && settingsRes.ok) {
            const data = await settingsRes.json();
            setInvoiceSettings(data.settings);
            if (!invoiceIdToEdit && !directSaleToConvert) {
              if (data.settings?.default_notes) setCustomerNotes(data.settings.default_notes);
              if (data.settings?.default_terms) setPaymentTerms(data.settings.default_terms);
              if (data.settings?.default_warranty_terms) setWarrantyTerms(data.settings.default_warranty_terms);
            }
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
  }, [isOpen, activeWorkspace, initialContacts, initialProducts, invoiceIdToEdit, directSaleToConvert]);

  // If converting a direct sale, prefill from sale
  useEffect(() => {
    if (!isOpen || !directSaleToConvert) return;
    setViewMode("EDIT");
    setSelectedContactId(directSaleToConvert.contact_id || "");
    if (directSaleToConvert.date) setIssueDate(directSaleToConvert.date.slice(0, 10));
    setDueDate(directSaleToConvert.date ? directSaleToConvert.date.slice(0, 10) : new Date().toISOString().slice(0, 10));

    const totalAmt = Number(directSaleToConvert.total_minor) / 100;
    setLines([
      {
        description: directSaleToConvert.notes?.split("\n")[0] || `Direct Sale (${directSaleToConvert.sale_number})`,
        quantity: 1,
        unitPriceStr: totalAmt.toFixed(2),
        warrantyType: "NONE",
      },
    ]);
    setCustomerNotes(directSaleToConvert.notes || "");
    setPaymentTerms("Paid in Full (Direct Sale)");
  }, [isOpen, directSaleToConvert]);

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
        setWarrantyTerms(inv.warranty_terms || "");
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
              model: l.model || "",
              sku: l.sku || "",
              serialNumber: l.serial_number || "",
              serviceStartDate: l.service_start_date ? l.service_start_date.slice(0, 10) : undefined,
              serviceEndDate: l.service_end_date ? l.service_end_date.slice(0, 10) : undefined,
              warrantyType: l.warranty_type || "NONE",
              warrantyProvider: l.warranty_provider || "",
              warrantyDurationMonths: l.warranty_duration_months || undefined,
              warrantyStartDate: l.warranty_start_date ? l.warranty_start_date.slice(0, 10) : undefined,
              warrantyEndDate: l.warranty_end_date ? l.warranty_end_date.slice(0, 10) : undefined,
              warrantyCoverage: l.warranty_coverage || "",
              warrantyExclusions: l.warranty_exclusions || "",
              warrantyContact: l.warranty_contact || "",
              isWarrantyExpanded: l.warranty_type && l.warranty_type !== "NONE",
              isDetailsExpanded: Boolean(l.model || l.sku || l.serial_number),
              isServiceExpanded: Boolean(l.service_start_date || l.service_end_date),
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

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return contacts;
    const q = customerSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [contacts, customerSearch]);

  const selectedContact = useMemo(() => {
    return contacts.find((c) => c.id === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  // Line Calculations
  const lineCalculations = useMemo(() => {
    return lines.map((line) => {
      const cleanPrice = cleanRawAmount(line.unitPriceStr);
      const unitPrice = parseFloat(cleanPrice) || 0;
      const qty = Math.max(0, Number(line.quantity) || 0);
      const lineSubtotalMinor = Math.round(unitPrice * qty * 100);
      return {
        unitPriceMinor: Math.round(unitPrice * 100),
        lineSubtotalMinor,
        lineTotalMinor: lineSubtotalMinor,
      };
    });
  }, [lines]);

  const subtotalMinor = useMemo(() => {
    return lineCalculations.reduce((sum, item) => sum + item.lineSubtotalMinor, 0);
  }, [lineCalculations]);

  const discountMinor = useMemo(() => {
    if (!showDiscount || !discountStr) return 0;
    const d = parseFloat(cleanRawAmount(discountStr)) || 0;
    return Math.min(subtotalMinor, Math.round(d * 100));
  }, [showDiscount, discountStr, subtotalMinor]);

  const taxMinor = useMemo(() => {
    if (!showTax || !taxStr) return 0;
    const t = parseFloat(cleanRawAmount(taxStr)) || 0;
    return Math.round(t * 100);
  }, [showTax, taxStr]);

  const totalMinor = useMemo(() => {
    return Math.max(0, subtotalMinor - discountMinor + taxMinor);
  }, [subtotalMinor, discountMinor, taxMinor]);

  // Form dirtiness tracker for confirmation before dismiss
  const isDirty = useMemo(() => {
    if (selectedContactId) return true;
    if (customerNotes.trim() || internalNotes.trim()) return true;
    if (lines.length > 1) return true;
    if (lines[0]?.description.trim() || lines[0]?.unitPriceStr.trim() || lines[0]?.model || lines[0]?.serialNumber) return true;
    return false;
  }, [selectedContactId, customerNotes, internalNotes, lines]);

  const handleRequestClose = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes in this invoice. Are you sure you want to dismiss?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Inline Customer Creation
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

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPriceStr: "", warrantyType: "NONE" },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSelectCatalogProduct = (idx: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setLines((prev) => {
      const next = [...prev];
      const cur = next[idx];

      let computedEndDate = cur.warrantyEndDate;
      if (prod.default_warranty_duration_months) {
        const s = new Date(issueDate);
        s.setMonth(s.getMonth() + prod.default_warranty_duration_months);
        computedEndDate = s.toISOString().slice(0, 10);
      }

      next[idx] = {
        ...cur,
        productId: prod.id,
        description: prod.name,
        sku: prod.sku || cur.sku || "",
        unitPriceStr: (prod.default_price_minor / 100).toFixed(2),
        warrantyType: prod.default_warranty_type || cur.warrantyType || "NONE",
        warrantyProvider: prod.default_warranty_provider || cur.warrantyProvider || "",
        warrantyDurationMonths: prod.default_warranty_duration_months || cur.warrantyDurationMonths,
        warrantyStartDate: issueDate,
        warrantyEndDate: computedEndDate,
        warrantyCoverage: prod.default_warranty_coverage || cur.warrantyCoverage || "",
        warrantyExclusions: prod.default_warranty_exclusions || cur.warrantyExclusions || "",
        warrantyContact: prod.default_warranty_contact || cur.warrantyContact || "",
        isWarrantyExpanded: prod.default_warranty_type && prod.default_warranty_type !== "NONE",
        isDetailsExpanded: Boolean(prod.sku),
      };
      return next;
    });
  };

  const updateLineWarrantyDuration = (idx: number, months: number) => {
    setLines((prev) => {
      const next = [...prev];
      const line = next[idx];
      const sDateStr = line.warrantyStartDate || issueDate;
      const sDate = new Date(sDateStr);
      let eDateStr = line.warrantyEndDate;
      if (!isNaN(sDate.getTime()) && months > 0) {
        sDate.setMonth(sDate.getMonth() + months);
        eDateStr = sDate.toISOString().slice(0, 10);
      }
      next[idx] = {
        ...line,
        warrantyDurationMonths: months,
        warrantyStartDate: sDateStr,
        warrantyEndDate: eDateStr,
      };
      return next;
    });
  };

  // Form Submission
  const handleSubmitInvoice = async (targetStatus: "DRAFT" | "ISSUED") => {
    if (submitting) return;
    if (!activeWorkspace) return;
    setFormError(null);

    // Validation
    if (!selectedContactId && !directSaleToConvert) {
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
        setFormError(`Line ${i + 1} ("${validLines[i].description}") has an invalid unit price.`);
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
        model: l.model?.trim() || null,
        sku: l.sku?.trim() || null,
        serialNumber: l.serialNumber?.trim() || null,
        serviceStartDate: l.serviceStartDate || null,
        serviceEndDate: l.serviceEndDate || null,
        warrantyType: l.warrantyType || "NONE",
        warrantyProvider: l.warrantyProvider?.trim() || null,
        warrantyDurationMonths: l.warrantyDurationMonths ? Number(l.warrantyDurationMonths) : null,
        warrantyStartDate: l.warrantyStartDate || null,
        warrantyEndDate: l.warrantyEndDate || null,
        warrantyCoverage: l.warrantyCoverage?.trim() || null,
        warrantyExclusions: l.warrantyExclusions?.trim() || null,
        warrantyContact: l.warrantyContact?.trim() || null,
      }));

      // Conversion of Direct Sale
      if (directSaleToConvert) {
        const res = await fetch(`/api/accounting/sales/${directSaleToConvert.id}/convert-to-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: selectedContactId || undefined,
            lines: payloadLines,
            dueDate,
            notes: customerNotes.trim() || undefined,
            terms: paymentTerms.trim() || undefined,
            warrantyTerms: warrantyTerms.trim() || undefined,
          }),
        });

        const resData = await res.json();
        if (!res.ok) {
          setFormError(resData.error || "Failed to convert direct sale to invoice.");
          return;
        }

        if (onInvoiceSaved) onInvoiceSaved(resData.invoice, true);
        onClose();
        return;
      }

      // Standard Invoice Creation / Update
      const bodyData = {
        workspaceId: activeWorkspace.id,
        contactId: selectedContactId,
        issueDate,
        dueDate,
        status: targetStatus,
        notes: customerNotes.trim() || undefined,
        terms: paymentTerms.trim() || undefined,
        warrantyTerms: warrantyTerms.trim() || undefined,
        internalNotes: internalNotes.trim() || undefined,
        lines: payloadLines,
        issueNow: targetStatus === "ISSUED",
      };

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
        setFormError(
          resData.error || "We couldn’t create the invoice. Your entries are still here. Please try again."
        );
        return;
      }

      if (onInvoiceSaved) onInvoiceSaved(resData.invoice, targetStatus === "ISSUED");
      onClose();
    } catch (err: any) {
      setFormError(
        err.message || "We couldn’t create the invoice. Your entries are still here. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const sellerName = invoiceSettings?.business_name || activeWorkspace?.name || "Your Business";
  const sellerLogo = invoiceSettings?.logo_url;
  const sellerAddress = [
    invoiceSettings?.address,
    [invoiceSettings?.city, invoiceSettings?.state, invoiceSettings?.postal_code].filter(Boolean).join(", "),
    invoiceSettings?.country,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <div
        className="acc-modal-backdrop"
        onClick={handleRequestClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-modal-title"
      >
        <div
          className="acc-modal-content acc-invoice-edit-modal"
          style={{ maxWidth: "940px", maxHeight: "94vh", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="acc-modal-header" style={{ flexShrink: 0, borderBottom: "1px solid var(--acc-border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 id="invoice-modal-title" className="acc-modal-title" style={{ margin: 0 }}>
                  {directSaleToConvert
                    ? `Convert Direct Sale ${directSaleToConvert.sale_number} to Invoice`
                    : viewMode === "PREVIEW"
                    ? "Customer Invoice Preview"
                    : invoiceIdToEdit
                    ? "Edit Draft Invoice"
                    : "New Client Invoice"}
                </h3>
                {viewMode === "PREVIEW" && (
                  <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.75rem" }}>
                    A4 Presentation
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", margin: "0.25rem 0 0" }}>
                {directSaleToConvert
                  ? "Converts recorded walk-in sale into an official invoice without duplicate revenue or receipt postings."
                  : viewMode === "PREVIEW"
                  ? "Preview exact document layout as your buyer will see it. No financial changes until issued."
                  : "Organized into clear sections: Your Business, Customer, Details, Items, Totals & Payment Info."}
              </p>
            </div>
            <button
              type="button"
              className="acc-modal-close"
              onClick={handleRequestClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>

          {formError && (
            <div className="acc-alert acc-alert-danger" style={{ margin: "0.75rem 1.5rem 0" }}>
              {formError}
            </div>
          )}

          {/* View Switcher: EDIT MODE vs PREVIEW MODE */}
          {viewMode === "PREVIEW" ? (
            /* ==========================================================================
               CUSTOMER PREVIEW VIEW (Clean White A4)
               ========================================================================== */
            <div className="acc-invoice-preview-container" style={{ padding: "1.5rem", overflowY: "auto", flex: 1, background: "#f8fafc" }}>
              <div
                className="acc-invoice-paper"
                style={{
                  background: "#ffffff",
                  color: "#0f172a",
                  padding: "2.25rem",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #e2e8f0", paddingBottom: "1.25rem" }}>
                  <div>
                    {sellerLogo && (
                      <img
                        src={sellerLogo}
                        alt="Company Logo"
                        style={{ maxHeight: "50px", maxWidth: "160px", objectFit: "contain", marginBottom: "0.5rem" }}
                      />
                    )}
                    <h4 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#0f172a" }}>{sellerName}</h4>
                    <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.25rem", whiteSpace: "pre-line" }}>
                      {sellerAddress && <div>{sellerAddress}</div>}
                      {[invoiceSettings?.phone, invoiceSettings?.email].filter(Boolean).join(" · ")}
                      {invoiceSettings?.tax_id && (
                        <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>
                          {invoiceSettings.tax_label || "GSTIN"}: {invoiceSettings.tax_id}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>INVOICE</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#2563eb", marginTop: "0.2rem" }}>
                      {directSaleToConvert ? "SALE CONVERSION" : invoiceIdToEdit ? "DRAFT" : "PREVIEW"}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Issue Date: {issueDate}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      Due Date: {dueDate}
                    </div>
                  </div>
                </div>

                {/* Billed To */}
                <div style={{ display: "flex", justifyContent: "space-between", margin: "1.25rem 0", fontSize: "0.85rem" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>
                      Billed To
                    </span>
                    <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "0.15rem" }}>
                      {selectedContact?.name || "Direct Customer"}
                    </div>
                    <div style={{ color: "#475569", fontSize: "0.8rem" }}>
                      {selectedContact?.address && <div>{selectedContact.address}</div>}
                      {[selectedContact?.phone, selectedContact?.email].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div><strong>Payment Terms:</strong> {paymentTerms}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem", marginTop: "1rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "0.5rem", textAlign: "left" }}>Item &amp; Description</th>
                      <th style={{ padding: "0.5rem", textAlign: "center", width: "10%" }}>Qty</th>
                      <th style={{ padding: "0.5rem", textAlign: "right", width: "20%" }}>Unit Price</th>
                      <th style={{ padding: "0.5rem", textAlign: "right", width: "20%" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => {
                      const calc = lineCalculations[idx];
                      const hasWarranty = l.warrantyType && l.warrantyType !== "NONE";
                      const warrantyLabel =
                        l.warrantyType === "MANUFACTURER"
                          ? "Manufacturer Warranty"
                          : l.warrantyType === "SELLER"
                          ? "Seller Warranty"
                          : "Custom Warranty";

                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "0.6rem 0.5rem" }}>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>{l.description || "Untitled Item"}</div>
                            {(l.model || l.sku || l.serialNumber) && (
                              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                                {l.model && <span>Model: <strong>{l.model}</strong> </span>}
                                {l.sku && <span>SKU: <strong>{l.sku}</strong> </span>}
                                {l.serialNumber && <span>S/N: <strong>{l.serialNumber}</strong></span>}
                              </div>
                            )}
                            {(l.serviceStartDate || l.serviceEndDate) && (
                              <div style={{ marginTop: "0.25rem" }}>
                                <span style={{ background: "#f0f9ff", color: "#0369a1", padding: "0.15rem 0.45rem", borderRadius: "3px", fontSize: "0.725rem", fontWeight: 500 }}>
                                  ⏱️ Service Validity: {l.serviceStartDate || ""}{l.serviceEndDate ? ` to ${l.serviceEndDate}` : ""}
                                </span>
                              </div>
                            )}
                            {hasWarranty && (
                              <div
                                style={{
                                  marginTop: "0.35rem",
                                  padding: "0.35rem 0.6rem",
                                  background: "#f8fafc",
                                  borderLeft: "3px solid #2563eb",
                                  fontSize: "0.75rem",
                                  color: "#334155",
                                }}
                              >
                                <strong>🛡️ {l.warrantyProvider ? `${l.warrantyProvider} · ` : ""}{warrantyLabel}</strong>
                                {l.warrantyDurationMonths && ` · ${l.warrantyDurationMonths} Months`}
                                {l.warrantyStartDate && l.warrantyEndDate && ` (${l.warrantyStartDate} to ${l.warrantyEndDate})`}
                                {l.warrantyCoverage && <div>Coverage: {l.warrantyCoverage}</div>}
                                {l.warrantyContact && <div>Support: {l.warrantyContact}</div>}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "0.6rem 0.5rem", textAlign: "center" }}>{l.quantity}</td>
                          <td style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>
                            {formatMoney(calc?.unitPriceMinor || 0, activeWorkspace?.currency)}
                          </td>
                          <td style={{ padding: "0.6rem 0.5rem", textAlign: "right", fontWeight: 600 }}>
                            {formatMoney(calc?.lineTotalMinor || 0, activeWorkspace?.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Financial Summary */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                  <div style={{ width: "280px", background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span>Subtotal:</span>
                      <span>{formatMoney(subtotalMinor, activeWorkspace?.currency)}</span>
                    </div>
                    {discountMinor > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", marginBottom: "0.25rem" }}>
                        <span>Discount:</span>
                        <span>-{formatMoney(discountMinor, activeWorkspace?.currency)}</span>
                      </div>
                    )}
                    {taxMinor > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span>Tax ({invoiceSettings?.tax_label || "GST"}):</span>
                        <span>+{formatMoney(taxMinor, activeWorkspace?.currency)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1rem", borderTop: "2px solid #cbd5e1", paddingTop: "0.4rem", marginTop: "0.4rem" }}>
                      <span>Total Amount:</span>
                      <span>{formatMoney(totalMinor, activeWorkspace?.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes & Terms */}
                {(customerNotes || warrantyTerms || paymentTerms || invoiceSettings?.default_return_terms) && (
                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem", fontSize: "0.8rem", color: "#475569" }}>
                    {customerNotes && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        <strong style={{ color: "#334155" }}>Customer Notes &amp; Payment Instructions:</strong>
                        <div>{customerNotes}</div>
                      </div>
                    )}
                    {warrantyTerms && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        <strong style={{ color: "#334155" }}>Warranty Terms:</strong>
                        <div>{warrantyTerms}</div>
                      </div>
                    )}
                    {invoiceSettings?.default_return_terms && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        <strong style={{ color: "#334155" }}>Return &amp; Refund Policy:</strong>
                        <div>{invoiceSettings.default_return_terms}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={() => setViewMode("EDIT")}
                >
                  ✏️ Back to Editor
                </button>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {!directSaleToConvert && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline"
                      onClick={() => handleSubmitInvoice("DRAFT")}
                      disabled={submitting}
                    >
                      Save Draft
                    </button>
                  )}
                  <button
                    type="button"
                    className="acc-btn acc-btn-primary"
                    onClick={() => handleSubmitInvoice("ISSUED")}
                    disabled={submitting}
                  >
                    {submitting ? "Processing..." : directSaleToConvert ? "Convert & Issue Invoice" : "Issue Invoice"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ==========================================================================
               EDIT MODE (Organized into 7 Clear Sections)
               ========================================================================== */
            <>
              <div className="acc-invoice-modal-scroll-body" style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
                {/* Direct Sale Banner if converting */}
                {directSaleToConvert && (
                  <div
                    className="acc-alert acc-alert-info"
                    style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    <span>⚡</span>
                    <div>
                      <strong>Converting Direct Sale {directSaleToConvert.sale_number}</strong>
                      <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                        Sale Total: {formatMoney(directSaleToConvert.total_minor, activeWorkspace?.currency)}. Reconciles without duplicate journal entry.
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------------------------------------------------------------
                   SECTION 1: YOUR BUSINESS (Branding Summary Card)
                   --------------------------------------------------------------------- */}
                <div
                  className="acc-invoice-section"
                  style={{
                    marginBottom: "1.25rem",
                    background: "var(--acc-raised)",
                    border: "1px solid var(--acc-border)",
                    borderRadius: "var(--acc-radius-sm)",
                    padding: "0.85rem 1rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
                      {sellerLogo ? (
                        <img
                          src={sellerLogo}
                          alt={sellerName}
                          style={{ height: "42px", maxWidth: "120px", objectFit: "contain", borderRadius: "3px" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            background: "var(--acc-surface)",
                            border: "1px dashed var(--acc-border)",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.2rem",
                          }}
                        >
                          🏢
                        </div>
                      )}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <strong style={{ fontSize: "0.95rem", color: "var(--acc-text)" }}>{sellerName}</strong>
                          <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.7rem" }}>
                            Seller / Sender
                          </span>
                        </div>
                        <div style={{ fontSize: "0.775rem", color: "var(--acc-text-muted)", marginTop: "0.2rem" }}>
                          {[invoiceSettings?.address, invoiceSettings?.city, invoiceSettings?.state].filter(Boolean).join(", ") || "No business address set"}
                          {invoiceSettings?.tax_id && ` · ${invoiceSettings.tax_label || "GSTIN"}: ${invoiceSettings.tax_id}`}
                          {[invoiceSettings?.phone, invoiceSettings?.email].filter(Boolean).length > 0 && ` · ${[invoiceSettings?.phone, invoiceSettings?.email].filter(Boolean).join(" · ")}`}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline acc-btn-sm"
                      onClick={() => setShowSettingsModal(true)}
                      title="Edit company name, address, contact, and logo"
                    >
                      ⚙️ Edit Invoice Settings
                    </button>
                  </div>
                </div>

                {/* ---------------------------------------------------------------------
                   SECTION 2: CUSTOMER
                   --------------------------------------------------------------------- */}
                <div className="acc-invoice-section" style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <label className="acc-form-label" style={{ fontWeight: 600, margin: 0 }}>
                      👤 Customer Billing Details *
                    </label>
                  </div>

                  {selectedContact ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 1rem",
                        background: "var(--acc-raised)",
                        border: "1px solid var(--acc-border)",
                        borderRadius: "var(--acc-radius-sm)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{selectedContact.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--acc-text-muted)" }}>
                          {[selectedContact.email, selectedContact.phone].filter(Boolean).join(" · ") || "No email/phone"}
                        </div>
                        {selectedContact.address && (
                          <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginTop: "0.15rem" }}>
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
                        Change Customer
                      </button>
                    </div>
                  ) : showInlineNewCustomer ? (
                    /* Inline Add Customer */
                    <div className="acc-inline-new-customer-box" style={{ background: "var(--acc-raised)", border: "1px solid var(--acc-border)", borderRadius: "var(--acc-radius-sm)", padding: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>+ Add New Customer</span>
                        <button
                          type="button"
                          className="acc-link-btn"
                          style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", background: "none", border: "none", cursor: "pointer" }}
                          onClick={() => setShowInlineNewCustomer(false)}
                        >
                          Cancel
                        </button>
                      </div>
                      {inlineCustomerError && (
                        <div className="acc-alert acc-alert-danger" style={{ marginBottom: "0.5rem", padding: "0.4rem 0.6rem", fontSize: "0.75rem" }}>
                          {inlineCustomerError}
                        </div>
                      )}
                      <form onSubmit={handleSaveInlineCustomer}>
                        <div className="acc-form-group">
                          <label className="acc-form-label">Full Name *</label>
                          <input
                            type="text"
                            required
                            className="acc-form-input"
                            placeholder="e.g. Rahul Sharma"
                            value={newCustName}
                            onChange={(e) => setNewCustName(e.target.value)}
                          />
                        </div>
                        {!showCustExtraFields ? (
                          <button
                            type="button"
                            className="acc-link-btn"
                            style={{ fontSize: "0.75rem", color: "var(--acc-blue)", margin: "0.35rem 0", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            onClick={() => setShowCustExtraFields(true)}
                          >
                            + Add Email, Phone &amp; Address
                          </button>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.35rem" }}>
                            <div>
                              <label className="acc-form-label">Email</label>
                              <input
                                type="email"
                                className="acc-form-input"
                                placeholder="customer@email.com"
                                value={newCustEmail}
                                onChange={(e) => setNewCustEmail(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="acc-form-label">Phone</label>
                              <input
                                type="tel"
                                className="acc-form-input"
                                placeholder="+91 98765 43210"
                                value={newCustPhone}
                                onChange={(e) => setNewCustPhone(e.target.value)}
                              />
                            </div>
                            <div style={{ gridColumn: "span 2" }}>
                              <label className="acc-form-label">Billing Address</label>
                              <input
                                type="text"
                                className="acc-form-input"
                                placeholder="Street, City, PIN Code"
                                value={newCustAddress}
                                onChange={(e) => setNewCustAddress(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
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
                            {inlineCustomerSaving ? "Saving..." : "Save Customer"}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    /* Customer Search Combobox */
                    <div className="acc-customer-combobox-wrapper" ref={customerDropdownRef}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
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
                            <div style={{ padding: "0.75rem", fontSize: "0.8rem", color: "var(--acc-text-muted)" }}>
                              No customers found.
                              {canMutate && (
                                <button
                                  type="button"
                                  className="acc-link-btn"
                                  style={{ display: "block", marginTop: "0.25rem", color: "var(--acc-blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                                  onClick={() => {
                                    setNewCustName(customerSearch);
                                    setShowInlineNewCustomer(true);
                                    setIsCustomerDropdownOpen(false);
                                  }}
                                >
                                  + Create "{customerSearch}" as customer
                                </button>
                              )}
                            </div>
                          ) : (
                            filteredCustomers.map((c) => (
                              <div
                                key={c.id}
                                className="acc-customer-dropdown-item"
                                onClick={() => {
                                  setSelectedContactId(c.id);
                                  setIsCustomerDropdownOpen(false);
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>{c.name}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ---------------------------------------------------------------------
                   SECTION 3: INVOICE DETAILS
                   --------------------------------------------------------------------- */}
                <div className="acc-invoice-section" style={{ marginBottom: "1.25rem" }}>
                  <label className="acc-form-label" style={{ fontWeight: 600, marginBottom: "0.4rem" }}>
                    📅 Invoice Details
                  </label>
                  <div className="acc-form-grid-2">
                    <div className="acc-form-group">
                      <label className="acc-field-sublabel">Issue Date *</label>
                      <input
                        type="date"
                        required
                        className="acc-form-input"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>
                    <div className="acc-form-group">
                      <label className="acc-field-sublabel">Due Date *</label>
                      <input
                        type="date"
                        required
                        className="acc-form-input"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* ---------------------------------------------------------------------
                   SECTION 4: ITEMS & SERVICES (With SKU/Model & Warranty)
                   --------------------------------------------------------------------- */}
                <div className="acc-invoice-section" style={{ marginBottom: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <label className="acc-form-label" style={{ fontWeight: 600, margin: 0 }}>
                      📦 Items &amp; Services *
                    </label>
                    <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                      Supports optional Model, SKU, Serial #, Service validity &amp; Warranty
                    </span>
                  </div>

                  <div className="acc-items-container">
                    {lines.map((line, idx) => {
                      const lineCalc = lineCalculations[idx] || { lineTotalMinor: 0 };
                      const hasWarranty = line.warrantyType && line.warrantyType !== "NONE";

                      return (
                        <div
                          key={idx}
                          className="acc-item-row-card"
                          style={{
                            background: "var(--acc-raised)",
                            border: "1px solid var(--acc-border)",
                            borderRadius: "var(--acc-radius-sm)",
                            padding: "0.85rem",
                            marginBottom: "0.75rem",
                          }}
                        >
                          {/* Primary Item Fields */}
                          <div className="acc-item-fields-grid">
                            <div className="acc-item-col-desc">
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                <label className="acc-field-sublabel">Description *</label>
                                {products.length > 0 && (
                                  <select
                                    className="acc-catalog-quick-select"
                                    value={line.productId || ""}
                                    onChange={(e) => handleSelectCatalogProduct(idx, e.target.value)}
                                  >
                                    <option value="">Catalog Product...</option>
                                    {products.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({formatMoney(p.default_price_minor, activeWorkspace?.currency)})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              <input
                                type="text"
                                required
                                className="acc-form-input"
                                placeholder="Product or service description"
                                value={line.description}
                                onChange={(e) => {
                                  const next = [...lines];
                                  next[idx].description = e.target.value;
                                  setLines(next);
                                }}
                              />
                            </div>

                            <div className="acc-item-col-qty">
                              <label className="acc-field-sublabel">Qty</label>
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                required
                                className="acc-form-input tabular-nums"
                                value={line.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  const next = [...lines];
                                  next[idx].quantity = isNaN(val) ? 1 : val;
                                  setLines(next);
                                }}
                              />
                            </div>

                            <div className="acc-item-col-price">
                              <label className="acc-field-sublabel">Unit Price (₹)</label>
                              <FormattedMoneyInput
                                required
                                className="acc-form-input tabular-nums"
                                placeholder="0.00"
                                value={line.unitPriceStr}
                                onValueChange={(val) => {
                                  const next = [...lines];
                                  next[idx].unitPriceStr = val;
                                  setLines(next);
                                }}
                              />
                            </div>

                            <div className="acc-item-col-amount">
                              <span className="acc-field-sublabel">Amount</span>
                              <div className="acc-line-amount-display tabular-nums">
                                {formatMoney(lineCalc.lineTotalMinor, activeWorkspace?.currency)}
                              </div>
                            </div>

                            <div className="acc-item-col-remove">
                              {lines.length > 1 && (
                                <button
                                  type="button"
                                  className="acc-remove-line-btn"
                                  onClick={() => handleRemoveLine(idx)}
                                  title="Remove line"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Action Toggles for Model/SKU, Service Dates, and Warranty */}
                          <div style={{ display: "flex", gap: "0.85rem", marginTop: "0.5rem", fontSize: "0.75rem", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="acc-link-btn"
                              style={{
                                color: line.isDetailsExpanded || line.model || line.sku || line.serialNumber ? "var(--acc-blue)" : "var(--acc-text-muted)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onClick={() => {
                                const next = [...lines];
                                next[idx].isDetailsExpanded = !next[idx].isDetailsExpanded;
                                setLines(next);
                              }}
                            >
                              🏷️ {line.isDetailsExpanded ? "Hide" : "+"} Model / SKU / S/N
                              {line.model || line.sku || line.serialNumber ? " (Set)" : ""}
                            </button>

                            <button
                              type="button"
                              className="acc-link-btn"
                              style={{
                                color: line.isServiceExpanded || line.serviceStartDate || line.serviceEndDate ? "var(--acc-blue)" : "var(--acc-text-muted)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onClick={() => {
                                const next = [...lines];
                                next[idx].isServiceExpanded = !next[idx].isServiceExpanded;
                                setLines(next);
                              }}
                            >
                              ⏱️ {line.isServiceExpanded ? "Hide" : "+"} Service Validity
                              {line.serviceStartDate ? " (Active)" : ""}
                            </button>

                            <button
                              type="button"
                              className="acc-link-btn"
                              style={{
                                color: hasWarranty ? "var(--acc-blue)" : "var(--acc-text-muted)",
                                fontWeight: hasWarranty ? 600 : 400,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onClick={() => {
                                const next = [...lines];
                                next[idx].isWarrantyExpanded = !next[idx].isWarrantyExpanded;
                                setLines(next);
                              }}
                            >
                              🛡️ {line.isWarrantyExpanded ? "Hide" : "+"} Warranty:{" "}
                              {hasWarranty ? line.warrantyType : "No Warranty"}
                            </button>
                          </div>

                          {/* Expandable Model / SKU / Serial Number Section */}
                          {line.isDetailsExpanded && (
                            <div
                              style={{
                                marginTop: "0.5rem",
                                padding: "0.6rem",
                                background: "var(--acc-surface)",
                                borderRadius: "4px",
                              }}
                            >
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                                <div>
                                  <label className="acc-field-sublabel">Model</label>
                                  <input
                                    type="text"
                                    className="acc-form-input"
                                    placeholder="e.g. ThinkPad X1 Carbon"
                                    value={line.model || ""}
                                    onChange={(e) => {
                                      const next = [...lines];
                                      next[idx].model = e.target.value;
                                      setLines(next);
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="acc-field-sublabel">SKU</label>
                                  <input
                                    type="text"
                                    className="acc-form-input"
                                    placeholder="e.g. LAP-001"
                                    value={line.sku || ""}
                                    onChange={(e) => {
                                      const next = [...lines];
                                      next[idx].sku = e.target.value;
                                      setLines(next);
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="acc-field-sublabel">Serial Number(s)</label>
                                  <input
                                    type="text"
                                    className="acc-form-input"
                                    placeholder="e.g. SN-87654321, SN-87654322"
                                    value={line.serialNumber || ""}
                                    onChange={(e) => {
                                      const next = [...lines];
                                      next[idx].serialNumber = e.target.value;
                                      setLines(next);
                                    }}
                                  />
                                </div>
                              </div>
                              <span style={{ fontSize: "0.7rem", color: "var(--acc-text-muted)", marginTop: "0.25rem", display: "block" }}>
                                Note: For multiple units with individual warranties, enter comma-separated serial numbers or create separate item lines.
                              </span>
                            </div>
                          )}

                          {/* Expandable Service / Subscription Validity */}
                          {line.isServiceExpanded && (
                            <div
                              style={{
                                marginTop: "0.5rem",
                                padding: "0.6rem",
                                background: "var(--acc-surface)",
                                borderRadius: "4px",
                                borderLeft: "3px solid #0284c7",
                              }}
                            >
                              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0284c7", marginBottom: "0.35rem" }}>
                                ⏱️ Service / Software Subscription Validity (Independent of physical warranty)
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                                <div>
                                  <label className="acc-field-sublabel">Service Start Date</label>
                                  <input
                                    type="date"
                                    className="acc-form-input"
                                    value={line.serviceStartDate || ""}
                                    onChange={(e) => {
                                      const next = [...lines];
                                      next[idx].serviceStartDate = e.target.value;
                                      setLines(next);
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="acc-field-sublabel">Service End Date</label>
                                  <input
                                    type="date"
                                    className="acc-form-input"
                                    value={line.serviceEndDate || ""}
                                    onChange={(e) => {
                                      const next = [...lines];
                                      next[idx].serviceEndDate = e.target.value;
                                      setLines(next);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expandable Warranty Section */}
                          {line.isWarrantyExpanded && (
                            <div
                              style={{
                                marginTop: "0.5rem",
                                padding: "0.75rem",
                                background: "var(--acc-surface)",
                                borderRadius: "4px",
                                borderLeft: "3px solid var(--acc-blue)",
                              }}
                            >
                              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr", gap: "0.5rem" }}>
                                <div>
                                  <label className="acc-field-sublabel">Warranty Type</label>
                                  <select
                                    className="acc-form-input"
                                    value={line.warrantyType || "NONE"}
                                    onChange={(e) => {
                                      const next = [...lines];
                                      next[idx].warrantyType = e.target.value as WarrantyType;
                                      setLines(next);
                                    }}
                                  >
                                    <option value="NONE">No Warranty</option>
                                    <option value="MANUFACTURER">Manufacturer Warranty</option>
                                    <option value="SELLER">Seller Warranty</option>
                                    <option value="CUSTOM">Custom Warranty Terms</option>
                                  </select>
                                </div>

                                {hasWarranty && (
                                  <>
                                    <div>
                                      <label className="acc-field-sublabel">Warranty Provider</label>
                                      <input
                                        type="text"
                                        className="acc-form-input"
                                        placeholder="e.g. Lenovo, Seller Direct"
                                        value={line.warrantyProvider || ""}
                                        onChange={(e) => {
                                          const next = [...lines];
                                          next[idx].warrantyProvider = e.target.value;
                                          setLines(next);
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="acc-field-sublabel">Duration (Mos)</label>
                                      <input
                                        type="number"
                                        min={1}
                                        className="acc-form-input"
                                        placeholder="12"
                                        value={line.warrantyDurationMonths || ""}
                                        onChange={(e) => updateLineWarrantyDuration(idx, parseInt(e.target.value, 10) || 0)}
                                      />
                                    </div>
                                    <div>
                                      <label className="acc-field-sublabel">Start Date</label>
                                      <input
                                        type="date"
                                        className="acc-form-input"
                                        value={line.warrantyStartDate || issueDate}
                                        onChange={(e) => {
                                          const next = [...lines];
                                          next[idx].warrantyStartDate = e.target.value;
                                          setLines(next);
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="acc-field-sublabel">End Date</label>
                                      <input
                                        type="date"
                                        className="acc-form-input"
                                        value={line.warrantyEndDate || ""}
                                        onChange={(e) => {
                                          const next = [...lines];
                                          next[idx].warrantyEndDate = e.target.value;
                                          setLines(next);
                                        }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>

                              {hasWarranty && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                                  <div>
                                    <label className="acc-field-sublabel">Coverage Scope</label>
                                    <input
                                      type="text"
                                      className="acc-form-input"
                                      placeholder="e.g. Hardware replacement & parts"
                                      value={line.warrantyCoverage || ""}
                                      onChange={(e) => {
                                        const next = [...lines];
                                        next[idx].warrantyCoverage = e.target.value;
                                        setLines(next);
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="acc-field-sublabel">Exclusions</label>
                                    <input
                                      type="text"
                                      className="acc-form-input"
                                      placeholder="e.g. Liquid damage, drops"
                                      value={line.warrantyExclusions || ""}
                                      onChange={(e) => {
                                        const next = [...lines];
                                        next[idx].warrantyExclusions = e.target.value;
                                        setLines(next);
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="acc-field-sublabel">Claim Contact</label>
                                    <input
                                      type="text"
                                      className="acc-form-input"
                                      placeholder="support@brand.com / 1800-XXX-XXXX"
                                      value={line.warrantyContact || ""}
                                      onChange={(e) => {
                                        const next = [...lines];
                                        next[idx].warrantyContact = e.target.value;
                                        setLines(next);
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    className="acc-btn acc-btn-outline acc-btn-sm"
                    style={{ marginTop: "0.5rem" }}
                    onClick={handleAddLine}
                  >
                    + Add Item Line
                  </button>
                </div>

                {/* ---------------------------------------------------------------------
                   SECTION 5: FINANCIAL TOTALS
                   --------------------------------------------------------------------- */}
                <div className="acc-invoice-section" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1.25rem" }}>
                  <div style={{ width: "340px", background: "var(--acc-raised)", padding: "1rem", borderRadius: "var(--acc-radius-sm)", border: "1px solid var(--acc-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                      <span>Subtotal:</span>
                      <span className="tabular-nums">{formatMoney(subtotalMinor, activeWorkspace?.currency)}</span>
                    </div>

                    {/* Discount Toggle */}
                    {!showDiscount ? (
                      <button
                        type="button"
                        className="acc-link-btn"
                        style={{ fontSize: "0.75rem", color: "var(--acc-blue)", margin: "0.25rem 0", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onClick={() => setShowDiscount(true)}
                      >
                        + Add Discount
                      </button>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <span>Discount:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDiscount(false);
                              setDiscountStr("");
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--acc-text-muted)" }}
                          >
                            ✕
                          </button>
                        </div>
                        <FormattedMoneyInput
                          className="acc-form-input tabular-nums"
                          style={{ width: "110px", padding: "0.2rem 0.4rem", fontSize: "0.8rem", textAlign: "right" }}
                          placeholder="0.00"
                          value={discountStr}
                          onValueChange={setDiscountStr}
                        />
                      </div>
                    )}

                    {/* Tax Toggle */}
                    {isTaxConfigured && (
                      !showTax ? (
                        <div>
                          <button
                            type="button"
                            className="acc-link-btn"
                            style={{ fontSize: "0.75rem", color: "var(--acc-blue)", margin: "0.25rem 0", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            onClick={() => setShowTax(true)}
                          >
                            + Add Tax ({invoiceSettings?.tax_label || "GST"})
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <span>Tax ({invoiceSettings?.tax_label || "GST"}):</span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowTax(false);
                                setTaxStr("");
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--acc-text-muted)" }}
                            >
                              ✕
                            </button>
                          </div>
                          <FormattedMoneyInput
                            className="acc-form-input tabular-nums"
                            style={{ width: "110px", padding: "0.2rem 0.4rem", fontSize: "0.8rem", textAlign: "right" }}
                            placeholder="0.00"
                            value={taxStr}
                            onValueChange={setTaxStr}
                          />
                        </div>
                      )
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.05rem", borderTop: "1px solid var(--acc-border)", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
                      <span>Total Amount:</span>
                      <span className="tabular-nums">{formatMoney(totalMinor, activeWorkspace?.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* ---------------------------------------------------------------------
                   SECTION 6: PAYMENT INFORMATION
                   --------------------------------------------------------------------- */}
                <div className="acc-invoice-section" style={{ marginBottom: "1.25rem", background: "var(--acc-raised)", border: "1px solid var(--acc-border)", borderRadius: "var(--acc-radius-sm)", padding: "1rem" }}>
                  <label className="acc-form-label" style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                    💳 Payment Information &amp; Terms
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                    <div>
                      <label className="acc-field-sublabel">Payment Terms</label>
                      <input
                        type="text"
                        className="acc-form-input"
                        placeholder="e.g. Net 30, Due upon receipt"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="acc-field-sublabel">Payment Instructions / Bank Details (Customer-Visible)</label>
                      <textarea
                        rows={2}
                        className="acc-form-input"
                        placeholder="e.g. Bank Account Number, IFSC, UPI ID, or Cash in Hand instructions..."
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* ---------------------------------------------------------------------
                   SECTION 7: NOTES, TERMS & POLICIES
                   --------------------------------------------------------------------- */}
                <div className="acc-invoice-section" style={{ marginBottom: "1.25rem", background: "var(--acc-raised)", border: "1px solid var(--acc-border)", borderRadius: "var(--acc-radius-sm)", padding: "1rem" }}>
                  <label className="acc-form-label" style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                    📝 Policies &amp; Private Internal Notes
                  </label>

                  <div className="acc-form-group">
                    <label className="acc-field-sublabel">Warranty Terms &amp; Policy (Customer-Visible)</label>
                    <textarea
                      rows={2}
                      className="acc-form-input"
                      placeholder="General warranty conditions applicable to covered items..."
                      value={warrantyTerms}
                      onChange={(e) => setWarrantyTerms(e.target.value)}
                    />
                  </div>

                  <div className="acc-internal-notes-card" style={{ marginTop: "0.75rem", background: "var(--acc-surface)", padding: "0.75rem", borderRadius: "4px", border: "1px solid var(--acc-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>🔒 Private Internal Note</span>
                      <span className="acc-badge acc-badge-neutral" style={{ fontSize: "0.7rem" }}>Team Only</span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", margin: "0 0 0.5rem" }}>
                      Strictly internal to your workspace. Never printed, exported, or visible on customer links.
                    </p>
                    <textarea
                      rows={2}
                      className="acc-form-input"
                      placeholder="Private instructions, staff reference, internal cost tracking..."
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Sticky Footer Buttons */}
              <div
                className="acc-invoice-modal-footer"
                style={{
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.85rem 1.5rem",
                  borderTop: "1px solid var(--acc-border)",
                  background: "var(--acc-surface)",
                }}
              >
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  onClick={handleRequestClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <div className="acc-invoice-footer-right" style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="acc-btn acc-btn-outline"
                    onClick={() => setViewMode("PREVIEW")}
                    disabled={submitting}
                  >
                    👁️ Preview
                  </button>
                  {!directSaleToConvert && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-outline"
                      onClick={() => handleSubmitInvoice("DRAFT")}
                      disabled={submitting}
                    >
                      Save as Draft
                    </button>
                  )}
                  {canMutate && (
                    <button
                      type="button"
                      className="acc-btn acc-btn-primary"
                      onClick={() => handleSubmitInvoice("ISSUED")}
                      disabled={submitting}
                    >
                      {submitting
                        ? "Processing..."
                        : directSaleToConvert
                        ? "Convert & Issue Invoice"
                        : invoiceIdToEdit
                        ? "Issue Invoice"
                        : "Create & Issue Invoice"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Invoice Settings Modal for editing branding on the fly */}
      {showSettingsModal && (
        <InvoiceSettingsModal
          isOpen={showSettingsModal}
          onClose={() => {
            setShowSettingsModal(false);
            loadInvoiceSettings();
          }}
          onSaved={() => {
            loadInvoiceSettings();
          }}
        />
      )}
    </>
  );
}
