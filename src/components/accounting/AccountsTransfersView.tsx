"use client";

import React, { useState } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";

export default function AccountsTransfersView() {
  const { activeWorkspace, accounts, formatMoney, openFastModal, refreshKey, triggerRefresh, canMutate } = useAccounting();

  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [openingBalanceStr, setOpeningBalanceStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSetOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(openingBalanceStr);
    if (!activeWorkspace || !selectedAccountId || isNaN(amt)) {
      alert("Please choose an account and specify a valid opening balance.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          accountId: selectedAccountId,
          openingBalanceMinor: Math.round(amt * 100),
        }),
      });

      if (res.ok) {
        setOpeningModalOpen(false);
        setSelectedAccountId("");
        setOpeningBalanceStr("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to set opening balance");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const assetAccounts = accounts.filter((a) => a.type === "ASSET");
  const liabilityAccounts = accounts.filter((a) => a.type === "LIABILITY");
  const equityAccounts = accounts.filter((a) => a.type === "EQUITY");

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Accounts & Transfers</h2>
          <p className="acc-subtitle">Cash, bank, UPI accounts, balances, and funds transfers.</p>
        </div>

        <div className="acc-header-actions">
          {canMutate && (
            <>
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                onClick={() => setOpeningModalOpen(true)}
              >
                Set Opening Balance
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => openFastModal("TRANSFER")}
              >
                ⇄ Transfer Funds
              </button>
            </>
          )}
        </div>
      </div>

      {/* Asset Accounts */}
      <div className="acc-card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
          Cash & Bank Accounts (Assets)
        </h3>
        <div className="acc-table-wrapper">
          <table className="acc-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Subtype</th>
                <th className="acc-align-right">Current Balance</th>
                {canMutate && <th className="acc-align-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {assetAccounts.map((acc) => (
                <tr key={acc.id}>
                  <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{acc.code}</td>
                  <td style={{ fontWeight: 600 }}>{acc.name}</td>
                  <td>
                    <span className="acc-badge acc-badge-neutral">{acc.subtype}</span>
                  </td>
                  <td className="acc-align-right tabular-nums font-bold" style={{ fontSize: "0.9375rem" }}>
                    {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                  </td>
                  {canMutate && (
                    <td className="acc-align-right">
                      <button
                        type="button"
                        className="acc-btn acc-btn-sm acc-btn-outline"
                        style={{ padding: "0.2rem 0.5rem" }}
                        onClick={() => {
                          setSelectedAccountId(acc.id);
                          setOpeningBalanceStr((acc.current_balance_minor / 100).toString());
                          setOpeningModalOpen(true);
                        }}
                      >
                        Adjust Balance
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Liabilities & Equity */}
      <div className="acc-two-col-equal">
        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
            Liabilities & Payables
          </h3>
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th className="acc-col-name">Account Name</th>
                  <th className="acc-align-right acc-col-balance" style={{ width: "130px", whiteSpace: "nowrap" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {liabilityAccounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="acc-col-name" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                      <div style={{ fontWeight: 600 }}>{acc.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>{acc.code}</div>
                    </td>
                    <td className="acc-align-right acc-col-balance tabular-nums font-semibold" style={{ color: "var(--acc-danger)" }}>
                      {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
            Owner Equity & Capital
          </h3>
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th className="acc-col-name">Account Name</th>
                  <th className="acc-align-right acc-col-balance" style={{ width: "130px", whiteSpace: "nowrap" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {equityAccounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="acc-col-name" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                      <div style={{ fontWeight: 600 }}>{acc.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>{acc.code}</div>
                    </td>
                    <td className="acc-align-right acc-col-balance tabular-nums font-semibold">
                      {formatMoney(acc.current_balance_minor, activeWorkspace?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Set Opening Balance Modal */}
      {openingModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setOpeningModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Set Opening Balance</h3>
              <button type="button" className="acc-modal-close" onClick={() => setOpeningModalOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Initial balance is reconciled automatically against Owner Equity (Account 3000) through a balanced double-entry opening journal entry.
            </p>
            <form onSubmit={handleSetOpeningBalance}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="open-acc-select">Financial Account *</label>
                <select
                  id="open-acc-select"
                  className="acc-form-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                >
                  <option value="">Select account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="open-balance-amt">Opening Balance (₹) *</label>
                <FormattedMoneyInput
                  id="open-balance-amt"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={openingBalanceStr}
                  onChange={(e) => setOpeningBalanceStr(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setOpeningModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Opening Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
