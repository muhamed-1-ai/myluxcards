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
  const { activeWorkspace, canMutate, triggerRefresh } = useAccounting();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [taxLabel, setTaxLabel] = useState("GSTIN");
  const [defaultNotes, setDefaultNotes] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("Net 30");
  const [defaultWarrantyTerms, setDefaultWarrantyTerms] = useState("");
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
        if (isMounted && data.settings) {
          const s = data.settings;
          setBusinessName(s.business_name || activeWorkspace?.name || "");
          setLogoUrl(s.logo_url || "");
          setAddress(s.address || "");
          setPhone(s.phone || "");
          setEmail(s.email || "");
          setWebsite(s.website || "");
          setTaxId(s.tax_id || "");
          setTaxLabel(s.tax_label || "GSTIN");
          setDefaultNotes(s.default_notes || "");
          setDefaultTerms(s.default_terms || "Net 30");
          setDefaultWarrantyTerms(s.default_warranty_terms || "");
          setInvoicePrefix(s.invoice_prefix || "INV");
          setNextSequence(s.next_sequence || 1);
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
    setLogoUrl("");
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
          phone: phone.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          tax_id: taxId.trim() || null,
          tax_label: taxLabel.trim() || "GSTIN",
          default_notes: defaultNotes.trim() || null,
          default_terms: defaultTerms.trim() || "Net 30",
          default_warranty_terms: defaultWarrantyTerms.trim() || null,
          invoice_prefix: invoicePrefix.trim().toUpperCase() || "INV",
          next_sequence: nextSequence,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings.");

      setSuccessMsg("Invoice settings saved.");
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
        style={{ maxWidth: "680px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="acc-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.25rem" }}>⚙️</span>
            <div>
              <h3 id="invoice-settings-title" className="acc-modal-title" style={{ margin: 0 }}>
                Invoice Settings &amp; Branding
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--acc-text-muted)" }}>
                Customise customer-facing branding, tax registration, default warranty terms, and numbering.
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

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--acc-text-muted)" }}>
            Loading invoice settings...
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto", maxHeight: "calc(90vh - 140px)" }}>
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

              {/* Branding & Logo */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  🏢 Business Branding
                </h4>
                <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
                  {/* Logo Preview */}
                  <div
                    style={{
                      width: "120px",
                      height: "80px",
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
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
                        Remove
                      </button>
                    )}
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                      PNG, JPEG, WebP, or SVG up to 2MB. Appears at the top of all customer invoices and PDFs.
                    </p>
                  </div>
                </div>

                <div className="acc-form-group" style={{ marginTop: "1rem" }}>
                  <label className="acc-label">Business / Trading Name</label>
                  <input
                    type="text"
                    className="acc-input"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Technologies Pvt Ltd"
                    required
                  />
                </div>

                <div className="acc-form-group">
                  <label className="acc-label">Business Address</label>
                  <textarea
                    className="acc-input"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, State, PIN / Postal Code, Country"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div className="acc-form-group">
                    <label className="acc-label">Phone</label>
                    <input
                      type="text"
                      className="acc-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="acc-form-group">
                    <label className="acc-label">Email</label>
                    <input
                      type="email"
                      className="acc-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="billing@company.com"
                    />
                  </div>
                  <div className="acc-form-group">
                    <label className="acc-label">Website</label>
                    <input
                      type="text"
                      className="acc-input"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://company.com"
                    />
                  </div>
                </div>
              </div>

              {/* Tax & Registration Details */}
              <div style={{ marginBottom: "1.5rem", borderTop: "1px solid var(--acc-border)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  🏛️ Business &amp; Tax Registration
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.75rem" }}>
                  <div className="acc-form-group">
                    <label className="acc-label">Tax / Reg Label</label>
                    <input
                      type="text"
                      className="acc-input"
                      value={taxLabel}
                      onChange={(e) => setTaxLabel(e.target.value)}
                      placeholder="e.g. GSTIN, PAN, VAT, Tax ID"
                    />
                  </div>
                  <div className="acc-form-group">
                    <label className="acc-label">Registration / Tax Number</label>
                    <input
                      type="text"
                      className="acc-input"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="e.g. 29AAAAA0000A1Z5"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Numbering */}
              <div style={{ marginBottom: "1.5rem", borderTop: "1px solid var(--acc-border)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  🔢 Numbering Configuration
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="acc-form-group">
                    <label className="acc-label">Invoice Prefix</label>
                    <input
                      type="text"
                      className="acc-input"
                      value={invoicePrefix}
                      onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                      placeholder="INV"
                      maxLength={10}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                      Generated as: {invoicePrefix || "INV"}-{new Date().getFullYear()}-0001
                    </span>
                  </div>
                  <div className="acc-form-group">
                    <label className="acc-label">Next Sequence #</label>
                    <input
                      type="number"
                      className="acc-input"
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

              {/* Default Terms, Notes & Warranty */}
              <div style={{ borderTop: "1px solid var(--acc-border)", paddingTop: "1rem" }}>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--acc-text)" }}>
                  📝 Default Terms &amp; Policies
                </h4>
                <div className="acc-form-group">
                  <label className="acc-label">Default Payment Terms</label>
                  <input
                    type="text"
                    className="acc-input"
                    value={defaultTerms}
                    onChange={(e) => setDefaultTerms(e.target.value)}
                    placeholder="e.g. Net 30, Due on Receipt"
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-label">Default Customer Notes &amp; Payment Instructions</label>
                  <textarea
                    className="acc-input"
                    rows={2}
                    value={defaultNotes}
                    onChange={(e) => setDefaultNotes(e.target.value)}
                    placeholder="Bank details, UPI ID, or thank you note automatically populated on new invoices..."
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-label">Default Warranty Terms &amp; Conditions</label>
                  <textarea
                    className="acc-input"
                    rows={2}
                    value={defaultWarrantyTerms}
                    onChange={(e) => setDefaultWarrantyTerms(e.target.value)}
                    placeholder="Standard warranty policy text for issued customer documents..."
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
