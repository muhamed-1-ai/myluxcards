"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";

interface InvoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function InvoiceSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: InvoiceSettingsModalProps) {
  const { activeWorkspace, canMutate, triggerRefresh, formatMoney } = useAccounting();

  const [activeTab, setActiveTab] = useState<"SETTINGS" | "PREVIEW">("SETTINGS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [companyProfileSuggestion, setCompanyProfileSuggestion] = useState<any>(null);

  // Form State
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxLabel, setTaxLabel] = useState("GSTIN");
  const [defaultNotes, setDefaultNotes] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("Net 30");
  const [defaultWarrantyTerms, setDefaultWarrantyTerms] = useState("");
  const [defaultReturnTerms, setDefaultReturnTerms] = useState("");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [nextSequence, setNextSequence] = useState<number>(1);

  useEffect(() => {
    if (!isOpen || !activeWorkspace) return;
    let isMounted = true;

    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/accounting/invoices/settings`);
        if (!res.ok) throw new Error("Failed to load invoice settings.");
        const data = await res.json();
        if (isMounted) {
          if (data.companyProfileSuggestion) {
            setCompanyProfileSuggestion(data.companyProfileSuggestion);
          }
          if (data.settings) {
            const s = data.settings;
            setBusinessName(s.business_name || activeWorkspace?.name || "");
            setLogoUrl(s.logo_url || "");
            setAddress(s.address || "");
            setCity(s.city || "");
            setState(s.state || "");
            setPostalCode(s.postal_code || "");
            setCountry(s.country || "");
            setPhone(s.phone || "");
            setEmail(s.email || "");
            setWebsite(s.website || "");
            setTaxId(s.tax_id || "");
            setTaxLabel(s.tax_label || "GSTIN");
            setDefaultNotes(s.default_notes || "");
            setDefaultTerms(s.default_terms || "Net 30");
            setDefaultWarrantyTerms(s.default_warranty_terms || "");
            setDefaultReturnTerms(s.default_return_terms || "");
            setInvoicePrefix(s.invoice_prefix || "INV");
            setNextSequence(s.next_sequence || 1);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Error loading settings");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [isOpen, activeWorkspace]);

  if (!isOpen) return null;

  const handlePrefillFromProfile = () => {
    if (!companyProfileSuggestion) return;
    const p = companyProfileSuggestion;
    if (p.businessName && !businessName) setBusinessName(p.businessName);
    else if (p.businessName) setBusinessName(p.businessName);

    if (p.address && !address) setAddress(p.address);
    if (p.city && !city) setCity(p.city);
    if (p.state && !state) setState(p.state);
    if (p.postal_code && !postalCode) setPostalCode(p.postal_code);
    if (p.country && !country) setCountry(p.country);
    if (p.phone && !phone) setPhone(p.phone);
    if (p.email && !email) setEmail(p.email);
    if (p.website && !website) setWebsite(p.website);
    if (p.logoUrl && !logoUrl) setLogoUrl(p.logoUrl);
    if (p.tax_id && !taxId) setTaxId(p.tax_id);
    if (p.tax_label && !taxLabel) setTaxLabel(p.tax_label);

    setSuccessMsg("Prefilled from Company Profile. Edit any field as needed; your public NFC profile is not modified.");
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Logo file is too large. Maximum size is 2MB.");
      return;
    }

    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch(`/api/accounting/invoices/settings/logo`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload logo.");

      setLogoUrl(data.logo_url);
      setSuccessMsg("Company logo updated successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await fetch(`/api/accounting/invoices/settings/logo`, { method: "DELETE" });
    } catch (e) {
      console.warn("Server logo deletion warning:", e);
    }
    setLogoUrl("");
    setSuccessMsg("Company logo removed.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/invoices/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim() || undefined,
          logo_url: logoUrl || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          postal_code: postalCode.trim() || null,
          country: country.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          tax_id: taxId.trim() || null,
          tax_label: taxLabel.trim() || "GSTIN",
          default_notes: defaultNotes.trim() || null,
          default_terms: defaultTerms.trim() || "Net 30",
          default_warranty_terms: defaultWarrantyTerms.trim() || null,
          default_return_terms: defaultReturnTerms.trim() || null,
          invoice_prefix: invoicePrefix.trim().toUpperCase() || "INV",
          next_sequence: nextSequence,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings.");

      setSuccessMsg("Invoice settings saved successfully.");
      triggerRefresh();
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || "Error saving settings.");
    } finally {
      setSaving(false);
    }
  };

  const structuredAddressDisplay = [
    address,
    [city, state, postalCode].filter(Boolean).join(", "),
    country,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className="acc-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-settings-title"
    >
      <div
        className="acc-modal-content"
        style={{ maxWidth: "780px", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="acc-modal-header" style={{ borderBottom: "1px solid var(--acc-border)", paddingBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.25rem" }}>⚙️</span>
            <div>
              <h3 id="invoice-settings-title" className="acc-modal-title" style={{ margin: 0 }}>
                Invoice Settings &amp; Business Branding
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--acc-text-muted)" }}>
                Customise your business identity, tax numbers, default warranty terms, and invoice numbering.
              </p>
            </div>
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

        {/* Tab Bar: Settings Form vs Sample Preview */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.5rem 1.5rem",
            background: "var(--acc-surface)",
            borderBottom: "1px solid var(--acc-border)",
          }}
        >
          <button
            type="button"
            className={`acc-btn acc-btn-sm ${activeTab === "SETTINGS" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTab("SETTINGS")}
          >
            ⚙️ Settings Form
          </button>
          <button
            type="button"
            className={`acc-btn acc-btn-sm ${activeTab === "PREVIEW" ? "acc-btn-primary" : "acc-btn-outline"}`}
            onClick={() => setActiveTab("PREVIEW")}
          >
            👁️ Sample Invoice Preview
          </button>
          {companyProfileSuggestion && activeTab === "SETTINGS" && (
            <button
              type="button"
              className="acc-btn acc-btn-sm acc-btn-outline"
              style={{ marginLeft: "auto", color: "var(--acc-blue)", borderColor: "var(--acc-blue)" }}
              onClick={handlePrefillFromProfile}
              title="Fill fields from your registered company profile"
            >
              🔄 Prefill from Company Profile
            </button>
          )}
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--acc-text-muted)" }}>
            Loading invoice settings...
          </div>
        ) : activeTab === "PREVIEW" ? (
          /* ==========================================================================
             SAMPLE INVOICE PREVIEW TAB
             ========================================================================== */
          <div style={{ padding: "1.5rem", overflowY: "auto", maxHeight: "calc(92vh - 140px)", background: "#f8fafc" }}>
            <div
              style={{
                maxWidth: "680px",
                margin: "0 auto",
                background: "#ffffff",
                color: "#0f172a",
                padding: "2rem",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                fontFamily: "inherit",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #e2e8f0", paddingBottom: "1rem" }}>
                <div>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Company Logo Preview"
                      style={{ maxHeight: "55px", maxWidth: "180px", objectFit: "contain", marginBottom: "0.5rem" }}
                    />
                  ) : (
                    <div style={{ padding: "0.25rem 0.5rem", background: "#f1f5f9", borderRadius: "4px", display: "inline-block", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                      [Your Company Logo]
                    </div>
                  )}
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
                    {businessName || "Your Company Name"}
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.25rem", whiteSpace: "pre-line" }}>
                    {structuredAddressDisplay || "123 Business Boulevard, Financial District"}
                    <div>{[phone || "+91 98765 43210", email || "billing@company.com"].join(" · ")}</div>
                    {website && <div>{website}</div>}
                    <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>
                      {taxLabel || "GSTIN"}: {taxId || "29ABCDE1234F1Z5"}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e293b" }}>INVOICE</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#2563eb", marginTop: "0.15rem" }}>
                    {invoicePrefix || "INV"}-{new Date().getFullYear()}-0001
                  </div>
                  <div style={{ display: "inline-block", marginTop: "0.5rem", padding: "0.2rem 0.5rem", background: "#ecfdf5", color: "#16a34a", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700 }}>
                    PAID
                  </div>
                </div>
              </div>

              {/* Billed To */}
              <div style={{ display: "flex", justifyContent: "space-between", margin: "1.25rem 0", fontSize: "0.85rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "#64748b" }}>Billed To</div>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "0.15rem" }}>Acme Global Enterprises</div>
                  <div style={{ color: "#475569", fontSize: "0.8rem" }}>45 Corporate Way, Cyber City</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div><strong>Issue Date:</strong> {new Date().toISOString().slice(0, 10)}</div>
                  <div><strong>Payment Terms:</strong> {defaultTerms || "Net 30"}</div>
                </div>
              </div>

              {/* Sample Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem", marginTop: "1rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>Item &amp; Description</th>
                    <th style={{ padding: "0.5rem", textAlign: "center", width: "10%" }}>Qty</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", width: "20%" }}>Rate</th>
                    <th style={{ padding: "0.5rem", textAlign: "right", width: "20%" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <div style={{ fontWeight: 600 }}>Commercial Enterprise Workstation</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Model: PRO-WORKSTATION-X1 · S/N: SN-8839021</div>
                      <div style={{ marginTop: "0.3rem", padding: "0.3rem 0.5rem", background: "#f8fafc", borderLeft: "3px solid #2563eb", fontSize: "0.75rem" }}>
                        🛡️ <strong>Seller Warranty · 24 Months</strong> (Full hardware coverage)
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", textAlign: "center" }}>1</td>
                    <td style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>₹75,000.00</td>
                    <td style={{ padding: "0.6rem 0.5rem", textAlign: "right", fontWeight: 600 }}>₹75,000.00</td>
                  </tr>
                </tbody>
              </table>

              {/* Financial Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                <div style={{ width: "260px", background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span>Subtotal:</span>
                    <span>₹75,000.00</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span>{taxLabel || "GSTIN"}:</span>
                    <span>₹13,500.00</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "0.95rem", borderTop: "2px solid #cbd5e1", paddingTop: "0.35rem", marginTop: "0.35rem" }}>
                    <span>Total:</span>
                    <span>₹88,500.00</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a", fontWeight: 600, marginTop: "0.25rem" }}>
                    <span>Amount Paid:</span>
                    <span>₹88,500.00</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px dashed #cbd5e1", paddingTop: "0.3rem", marginTop: "0.25rem" }}>
                    <span>Balance Due:</span>
                    <span>₹0.00</span>
                  </div>
                </div>
              </div>

              {/* Default Notes & Warranty */}
              <div style={{ marginTop: "1.5rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.75rem", fontSize: "0.8rem", color: "#475569" }}>
                {defaultNotes && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong style={{ color: "#334155" }}>Customer Notes &amp; Payment Instructions:</strong>
                    <div>{defaultNotes}</div>
                  </div>
                )}
                {defaultWarrantyTerms && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong style={{ color: "#334155" }}>Warranty Terms:</strong>
                    <div>{defaultWarrantyTerms}</div>
                  </div>
                )}
                {defaultReturnTerms && (
                  <div>
                    <strong style={{ color: "#334155" }}>Return &amp; Refund Policy:</strong>
                    <div>{defaultReturnTerms}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-primary"
                onClick={() => setActiveTab("SETTINGS")}
              >
                ✏️ Continue Editing Settings
              </button>
            </div>
          </div>
        ) : (
          /* ==========================================================================
             SETTINGS FORM
             ========================================================================== */
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", maxHeight: "calc(92vh - 140px)" }}>
              {error && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="acc-alert acc-alert-success" style={{ marginBottom: "1rem" }}>
                  {successMsg}
                </div>
              )}

              {/* 1. Branding & Logo */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  🏢 Business Branding
                </h4>
                <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
                  {/* Logo Preview */}
                  <div
                    style={{
                      width: "130px",
                      height: "85px",
                      border: "1px dashed var(--acc-border)",
                      borderRadius: "var(--acc-radius-sm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--acc-raised)",
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Company Logo Preview"
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", textAlign: "center" }}>
                        No Logo
                      </span>
                    )}
                  </div>

                  {/* Logo Action Buttons */}
                  <div style={{ flex: 1 }}>
                    <label
                      htmlFor="invoice-logo-upload"
                      className="acc-btn acc-btn-outline acc-btn-sm"
                      style={{ cursor: "pointer", display: "inline-block", marginRight: "0.5rem" }}
                    >
                      {uploadingLogo ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
                    </label>
                    <input
                      id="invoice-logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      style={{ display: "none" }}
                      disabled={uploadingLogo || !canMutate}
                    />
                    {logoUrl && (
                      <button
                        type="button"
                        className="acc-btn acc-btn-outline acc-btn-sm"
                        onClick={handleRemoveLogo}
                        style={{ color: "var(--acc-danger)" }}
                      >
                        Remove Logo
                      </button>
                    )}
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                      PNG, JPEG, WebP, or SVG up to 2MB. Appears at the top of all customer invoices, PDFs, and share links.
                    </p>
                  </div>
                </div>

                <div className="acc-form-group" style={{ marginTop: "1rem" }}>
                  <label className="acc-form-label">Business / Trading Name *</label>
                  <input
                    type="text"
                    className="acc-form-input"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Technologies Pvt Ltd"
                    required
                  />
                </div>

                {/* Structured Address */}
                <div className="acc-form-group">
                  <label className="acc-form-label">Street Address</label>
                  <input
                    type="text"
                    className="acc-form-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Floor, Suite, Building, Street"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label className="acc-field-sublabel">City</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Bengaluru"
                    />
                  </div>
                  <div>
                    <label className="acc-field-sublabel">State / Province</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Karnataka"
                    />
                  </div>
                  <div>
                    <label className="acc-field-sublabel">Postal / PIN Code</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g. 560001"
                    />
                  </div>
                  <div>
                    <label className="acc-field-sublabel">Country</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. India"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginTop: "0.75rem" }}>
                  <div>
                    <label className="acc-field-sublabel">Phone Number</label>
                    <input
                      type="tel"
                      className="acc-form-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="acc-field-sublabel">Billing Email</label>
                    <input
                      type="email"
                      className="acc-form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="billing@company.com"
                    />
                  </div>
                  <div>
                    <label className="acc-field-sublabel">Website (Optional)</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://company.com"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Tax & Registration Details */}
              <div style={{ marginBottom: "1.5rem", borderTop: "1px solid var(--acc-border)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  🏛️ Business &amp; Tax Registration
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                  <div>
                    <label className="acc-form-label">Tax / Reg Label</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={taxLabel}
                      onChange={(e) => setTaxLabel(e.target.value)}
                      placeholder="e.g. GSTIN, PAN, VAT, Tax ID"
                    />
                  </div>
                  <div>
                    <label className="acc-form-label">Registration / Tax Number</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="e.g. 29AAAAA0000A1Z5"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Invoice Numbering */}
              <div style={{ marginBottom: "1.5rem", borderTop: "1px solid var(--acc-border)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  🔢 Numbering Configuration
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="acc-form-label">Invoice Prefix</label>
                    <input
                      type="text"
                      className="acc-form-input"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                      placeholder="INV"
                      maxLength={10}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                      Generated as: {invoicePrefix || "INV"}-{new Date().getFullYear()}-0001
                    </span>
                  </div>
                  <div>
                    <label className="acc-form-label">Next Sequence #</label>
                    <input
                      type="number"
                      className="acc-form-input"
                      min={1}
                      value={nextSequence}
                      onChange={(e) => setNextSequence(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                      Next sequential counter for new invoices
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Default Terms, Notes & Warranty */}
              <div style={{ borderTop: "1px solid var(--acc-border)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  📝 Default Terms &amp; Policies
                </h4>
                <div className="acc-form-group">
                  <label className="acc-form-label">Default Payment Terms</label>
                  <input
                    type="text"
                    className="acc-form-input"
                    value={defaultTerms}
                    onChange={(e) => setDefaultTerms(e.target.value)}
                    placeholder="e.g. Net 30, Due on Receipt"
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label">Default Customer Notes &amp; Payment Instructions</label>
                  <textarea
                    className="acc-form-input"
                    rows={2}
                    value={defaultNotes}
                    onChange={(e) => setDefaultNotes(e.target.value)}
                    placeholder="Bank details, UPI ID, or thank you note automatically populated on new invoices..."
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label">Default Warranty Terms &amp; Conditions (Optional)</label>
                  <textarea
                    className="acc-form-input"
                    rows={2}
                    value={defaultWarrantyTerms}
                    onChange={(e) => setDefaultWarrantyTerms(e.target.value)}
                    placeholder="Standard warranty policy text for issued customer documents..."
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label">Default Return &amp; Refund Policy (Optional)</label>
                  <textarea
                    className="acc-form-input"
                    rows={2}
                    value={defaultReturnTerms}
                    onChange={(e) => setDefaultReturnTerms(e.target.value)}
                    placeholder="e.g. 7-day replacement for defective hardware. Non-refundable software licenses..."
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="acc-modal-footer">
              <button
                type="button"
                className="acc-btn acc-btn-outline"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="acc-btn acc-btn-primary"
                disabled={saving || !canMutate}
              >
                {saving ? "Saving..." : "Save Invoice Settings"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
