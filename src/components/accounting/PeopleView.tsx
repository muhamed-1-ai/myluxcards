"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";
import PaymentAccountPicker from "./PaymentAccountPicker";

interface Contact {
  id: string;
  name: string;
  type: "CUSTOMER" | "VENDOR" | "PERSONAL";
  email?: string;
  phone?: string;
  receivable_balance_minor: number;
  payable_balance_minor: number;
  total_receivable_minor?: number | string;
  total_payable_minor?: number | string;
}

interface PaymentRecord {
  id: string;
  payment_number: string;
  type: "IN" | "OUT";
  contact_id?: string;
  contact_name?: string;
  amount_minor: number;
  payment_date: string;
  payment_method: string;
  reference_number?: string;
  notes?: string;
}

export default function PeopleView() {
  const { activeWorkspace, formatMoney, accounts, refreshKey, triggerRefresh, canMutate } = useAccounting();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subtab, setSubtab] = useState<"ALL" | "OWED_TO_ME" | "I_OWE" | "PAYMENT_HISTORY">("ALL");

  // Modals
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [iouModalOpen, setIouModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Form & Feedback states
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"CUSTOMER" | "VENDOR" | "PERSONAL">("CUSTOMER");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // IOU states
  const [iouContactId, setIouContactId] = useState("");
  const [iouType, setIouType] = useState<"THEY_OWE_ME" | "I_OWE_THEM">("THEY_OWE_ME");
  const [iouAmountStr, setIouAmountStr] = useState("");
  const [iouAccountId, setIouAccountId] = useState("");
  const [iouNotes, setIouNotes] = useState("");

  // Payment modal states
  const [payAmountStr, setPayAmountStr] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payNotes, setPayNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadContactsAndPayments() {
      try {
        setLoading(true);
        const headers: HeadersInit = {
          "x-workspace-id": activeWorkspace!.id,
        };

        const [contactsRes, paymentsRes] = await Promise.allSettled([
          fetch(`/api/accounting/contacts?workspaceId=${activeWorkspace!.id}`, { headers }),
          fetch(`/api/accounting/payments?workspaceId=${activeWorkspace!.id}`, { headers }),
        ]);

        if (contactsRes.status === "fulfilled" && contactsRes.value.ok && isMounted) {
          const cData = await contactsRes.value.json();
          const normalizedContacts: Contact[] = (cData.contacts || []).map((c: any) => ({
            ...c,
            receivable_balance_minor: Number(c.receivable_balance_minor ?? c.total_receivable_minor ?? 0),
            payable_balance_minor: Number(c.payable_balance_minor ?? c.total_payable_minor ?? 0),
          }));
          setContacts(normalizedContacts);
        }

        if (paymentsRes.status === "fulfilled" && paymentsRes.value.ok && isMounted) {
          const pData = await paymentsRes.value.json();
          setPayments(pData.payments || []);
        }
      } catch (err) {
        console.error("Failed to load people data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadContactsAndPayments();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) {
      setFormError("No active workspace selected.");
      return;
    }

    const trimmedName = newName.trim();
    if (trimmedName.length < 2) {
      setFormError("Full Name is required (minimum 2 characters).");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/accounting/contacts?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: trimmedName,
          type: newType,
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.contact) {
        const created: Contact = {
          ...data.contact,
          receivable_balance_minor: Number(data.contact.receivable_balance_minor ?? data.contact.total_receivable_minor ?? 0),
          payable_balance_minor: Number(data.contact.payable_balance_minor ?? data.contact.total_payable_minor ?? 0),
        };

        // Immediately update local contacts state so person appears in All People
        setContacts((prev) => {
          const exists = prev.some((c) => c.id === created.id);
          if (exists) {
            return prev.map((c) => (c.id === created.id ? created : c));
          }
          return [created, ...prev];
        });

        // Switch to All People view so new contact is immediately visible
        setSubtab("ALL");
        setSuccessMessage(`Contact "${created.name}" added successfully.`);
        setAddContactOpen(false);
        setNewName("");
        setNewPhone("");
        setNewEmail("");
        setNewType("CUSTOMER");
        setFormError(null);
        triggerRefresh();
      } else {
        setFormError(data.error || "Failed to add contact. Please review form fields.");
      }
    } catch (err: any) {
      setFormError(err.message || "Network request failed. Please check connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordIou = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(iouAmountStr);
    if (!activeWorkspace || !iouContactId || isNaN(amt) || amt <= 0 || !iouAccountId) {
      alert("Please fill in all required fields with a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/contacts/iou?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          contactId: iouContactId,
          type: iouType,
          direction: iouType === "THEY_OWE_ME" ? "LENT_OUT" : "BORROWED",
          amountMinor: Math.round(amt * 100),
          financialAccountId: iouAccountId,
          notes: iouNotes || undefined,
        }),
      });
      if (res.ok) {
        setIouModalOpen(false);
        setIouAmountStr("");
        setIouNotes("");
        setSuccessMessage("Personal IOU recorded successfully.");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record IOU");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !activeWorkspace) return;
    const amt = parseFloat(payAmountStr);
    if (isNaN(amt) || amt <= 0 || !payAccountId) {
      alert("Please specify a valid amount and account.");
      return;
    }

    const isMoneyIn = (selectedContact.receivable_balance_minor || 0) > 0;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/payments?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          contactId: selectedContact.id,
          type: isMoneyIn ? "IN" : "OUT",
          amountMinor: Math.round(amt * 100),
          financialAccountId: payAccountId,
          paymentDate: new Date().toISOString().slice(0, 10),
          paymentMethod: payMethod,
          notes: payNotes || `Settlement payment for ${selectedContact.name}`,
        }),
      });
      if (res.ok) {
        setPaymentModalOpen(false);
        setSelectedContact(null);
        setPayAmountStr("");
        setPayNotes("");
        setSuccessMessage("Payment recorded successfully.");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record payment");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (subtab === "OWED_TO_ME") return (c.receivable_balance_minor || 0) > 0;
    if (subtab === "I_OWE") return (c.payable_balance_minor || 0) > 0;
    return true;
  });

  const liquidAccounts = accounts.filter(
    (a) => a.is_payment_account || (a.type === "ASSET" && ["CASH", "BANK"].includes(a.subtype))
  );

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">People & Balances</h2>
          <p className="acc-subtitle">All people, customers, suppliers, payment history, and collection actions.</p>
        </div>

        <div className="acc-header-actions">
          {canMutate && (
            <>
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                onClick={() => setIouModalOpen(true)}
              >
                + Record Personal IOU
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => {
                  setFormError(null);
                  setAddContactOpen(true);
                }}
              >
                + Add Person / Contact
              </button>
            </>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          className="acc-alert acc-alert-success"
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
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

      {/* Subtabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "ALL" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("ALL")}
        >
          All People ({contacts.length})
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "OWED_TO_ME" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("OWED_TO_ME")}
        >
          Owed to Me ({contacts.filter((c) => (c.receivable_balance_minor || 0) > 0).length})
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "I_OWE" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("I_OWE")}
        >
          I Owe ({contacts.filter((c) => (c.payable_balance_minor || 0) > 0).length})
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${subtab === "PAYMENT_HISTORY" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setSubtab("PAYMENT_HISTORY")}
        >
          Payment History ({payments.length})
        </button>
      </div>

      {/* Contacts List */}
      {subtab !== "PAYMENT_HISTORY" && (
        <div className="acc-card">
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              Loading contacts...
            </div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              <p style={{ margin: "0 0 1rem 0" }}>No contacts found in this view.</p>
              {subtab !== "ALL" && (
                <button
                  type="button"
                  className="acc-btn acc-btn-outline acc-btn-sm"
                  onClick={() => setSubtab("ALL")}
                >
                  View All People ({contacts.length})
                </button>
              )}
            </div>
          ) : (
            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Phone / Email</th>
                    <th className="acc-align-right">Owed to Me</th>
                    <th className="acc-align-right">I Owe</th>
                    {canMutate && <th className="acc-align-right">Collection Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((c) => {
                    const isOwed = (c.receivable_balance_minor || 0) > 0;
                    const iOweThem = (c.payable_balance_minor || 0) > 0;

                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                        </td>
                        <td>
                          <span className="acc-badge acc-badge-neutral">{c.type}</span>
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                          {c.phone || c.email || "—"}
                        </td>
                        <td
                          className="acc-align-right tabular-nums"
                          style={{
                            fontWeight: isOwed ? 700 : 400,
                            color: isOwed ? "var(--acc-blue)" : "inherit",
                          }}
                        >
                          {formatMoney(c.receivable_balance_minor || 0, activeWorkspace?.currency)}
                        </td>
                        <td
                          className="acc-align-right tabular-nums"
                          style={{
                            fontWeight: iOweThem ? 700 : 400,
                            color: iOweThem ? "var(--acc-danger)" : "inherit",
                          }}
                        >
                          {formatMoney(c.payable_balance_minor || 0, activeWorkspace?.currency)}
                        </td>
                        {canMutate && (
                          <td className="acc-align-right">
                            {isOwed ? (
                              <button
                                type="button"
                                className="acc-btn acc-btn-sm acc-btn-primary"
                                style={{ padding: "0.25rem 0.65rem", fontSize: "0.8125rem" }}
                                onClick={() => {
                                  setSelectedContact(c);
                                  setPayAmountStr((c.receivable_balance_minor / 100).toString());
                                  setPaymentModalOpen(true);
                                }}
                              >
                                Collect Payment
                              </button>
                            ) : iOweThem ? (
                              <button
                                type="button"
                                className="acc-btn acc-btn-sm acc-btn-outline"
                                style={{ padding: "0.25rem 0.65rem", fontSize: "0.8125rem" }}
                                onClick={() => {
                                  setSelectedContact(c);
                                  setPayAmountStr((c.payable_balance_minor / 100).toString());
                                  setPaymentModalOpen(true);
                                }}
                              >
                                Record Payment
                              </button>
                            ) : (
                              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                                Settled
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payment History View */}
      {subtab === "PAYMENT_HISTORY" && (
        <div className="acc-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
              Payment Settlements & Collections Ledger
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
              Actual payment movements linked to people & invoices
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              Loading payment history...
            </div>
          ) : payments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              No payments recorded yet.
            </div>
          ) : (
            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Contact</th>
                    <th>Method</th>
                    <th>Notes</th>
                    <th className="acc-align-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{p.payment_number}</td>
                      <td style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                        {p.payment_date}
                      </td>
                      <td>
                        <span className={`acc-badge ${p.type === "IN" ? "acc-badge-success" : "acc-badge-danger"}`}>
                          {p.type === "IN" ? "↓ Collected" : "↑ Disbursed"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.contact_name || "—"}</td>
                      <td style={{ fontSize: "0.8125rem" }}>
                        <span className="acc-badge acc-badge-neutral">{p.payment_method}</span>
                      </td>
                      <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>
                        {p.notes || "—"}
                      </td>
                      <td
                        className="acc-align-right tabular-nums font-bold"
                        style={{ color: p.type === "IN" ? "var(--acc-success)" : "var(--acc-danger)" }}
                      >
                        {p.type === "IN" ? "+" : "-"}
                        {formatMoney(p.amount_minor, activeWorkspace?.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Contact Modal */}
      {addContactOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddContactOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Add Person / Contact</h3>
              <button type="button" className="acc-modal-close" onClick={() => setAddContactOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddContact}>
              {formError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {formError}
                </div>
              )}
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="new-contact-name">Full Name *</label>
                <input
                  id="new-contact-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Acme Supplies, Alice Smith"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="new-contact-type">Contact Type *</label>
                <select
                  id="new-contact-type"
                  className="acc-form-select"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                >
                  <option value="CUSTOMER">Customer (Client / Buyer)</option>
                  <option value="VENDOR">Vendor / Supplier (Payee)</option>
                  <option value="PERSONAL">Personal (Friend, Family, Partner)</option>
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="new-contact-phone">Phone Number</label>
                <input
                  id="new-contact-phone"
                  type="tel"
                  className="acc-form-input"
                  placeholder="+91 98765 43210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="new-contact-email">Email Address</label>
                <input
                  id="new-contact-email"
                  type="email"
                  className="acc-form-input"
                  placeholder="contact@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddContactOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Personal IOU Modal */}
      {iouModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setIouModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Record Personal IOU</h3>
              <button type="button" className="acc-modal-close" onClick={() => setIouModalOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Track personal money lent or borrowed without issuing a commercial business invoice. Balanced double-entry is maintained automatically.
            </p>
            <form onSubmit={handleRecordIou}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="iou-direction">IOU Type *</label>
                <select
                  id="iou-direction"
                  className="acc-form-select"
                  value={iouType}
                  onChange={(e) => setIouType(e.target.value as any)}
                >
                  <option value="THEY_OWE_ME">I Lent Money (They Owe Me)</option>
                  <option value="I_OWE_THEM">I Borrowed Money (I Owe Them)</option>
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="iou-contact">Person *</label>
                <select
                  id="iou-contact"
                  className="acc-form-select"
                  value={iouContactId}
                  onChange={(e) => setIouContactId(e.target.value)}
                  required
                >
                  <option value="">Select contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="iou-amount">Amount (₹) *</label>
                <FormattedMoneyInput
                  id="iou-amount"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={iouAmountStr}
                  onChange={(e) => setIouAmountStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="iou-account">Financial Account *</label>
                <PaymentAccountPicker
                  id="iou-account"
                  value={iouAccountId}
                  onChange={setIouAccountId}
                  accounts={liquidAccounts}
                  placeholder="Select Cash or Bank account..."
                  required
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="iou-notes">Description / Reason</label>
                <input
                  id="iou-notes"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. Split dinner bill, emergency personal loan"
                  value={iouNotes}
                  onChange={(e) => setIouNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setIouModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Recording..." : "Save IOU"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment / Collection Modal */}
      {paymentModalOpen && selectedContact && (
        <div className="acc-modal-backdrop" onClick={() => setPaymentModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">
                {(selectedContact.receivable_balance_minor || 0) > 0
                  ? `Collect Payment: ${selectedContact.name}`
                  : `Record Payment: ${selectedContact.name}`}
              </h3>
              <button type="button" className="acc-modal-close" onClick={() => setPaymentModalOpen(false)}>✕</button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              {(selectedContact.receivable_balance_minor || 0) > 0
                ? "Collecting payment settles outstanding customer receivable balance. It does NOT duplicate the sales revenue."
                : "Recording disbursement settles pending vendor payable balance. It does NOT duplicate the operating expense."}
            </p>

            <form onSubmit={handleRecordPayment}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="pay-amount">
                  Payment Amount (₹) *
                </label>
                <FormattedMoneyInput
                  id="pay-amount"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  value={payAmountStr}
                  onChange={(e) => setPayAmountStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="pay-account">
                  {(selectedContact.receivable_balance_minor || 0) > 0 ? "Deposit Account *" : "Payment Account *"}
                </label>
                <PaymentAccountPicker
                  id="pay-account"
                  value={payAccountId}
                  onChange={setPayAccountId}
                  accounts={liquidAccounts}
                  placeholder="Select account (Cash, Bank, UPI)..."
                  required
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="pay-method">
                  Payment Method
                </label>
                <select
                  id="pay-method"
                  className="acc-form-select"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CARD">Debit / Credit Card</option>
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="pay-notes">
                  Notes / Reference Number
                </label>
                <input
                  id="pay-notes"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. UTR number, receipt memo"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Processing..." : "Confirm Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
