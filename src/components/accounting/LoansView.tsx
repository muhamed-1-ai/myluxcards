"use client";

import React, { useState, useEffect } from "react";
import { useAccounting } from "./AccountingContext";

interface Loan {
  id: string;
  lender_name: string;
  type: string;
  principal_minor: number;
  interest_rate_percent?: number;
  term_months?: number;
  monthly_installment_minor?: number;
  current_balance_minor: number;
  start_date: string;
  end_date?: string;
  status: string;
}

export default function LoansView() {
  const { activeWorkspace, formatMoney, accounts, refreshKey, triggerRefresh, canMutate } = useAccounting();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null);

  // Add Loan State
  const [lenderName, setLenderName] = useState("");
  const [principalStr, setPrincipalStr] = useState("");
  const [interestRateStr, setInterestRateStr] = useState("");
  const [termMonthsStr, setTermMonthsStr] = useState("12");
  const [depositAccountId, setDepositAccountId] = useState("");

  // Loan Repayment State
  const [principalPaidStr, setPrincipalPaidStr] = useState("");
  const [interestPaidStr, setInterestPaidStr] = useState("0");
  const [repayAccountId, setRepayAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadLoans() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting/loans?workspaceId=${activeWorkspace?.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setLoans(data.loans || []);
        }
      } catch (err) {
        console.error("Failed to load loans:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadLoans();
    return () => { isMounted = false; };
  }, [activeWorkspace, refreshKey]);

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(principalStr);
    if (!activeWorkspace || !lenderName.trim() || isNaN(principal) || principal <= 0 || !depositAccountId) {
      alert("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          lenderName: lenderName.trim(),
          principalMinor: Math.round(principal * 100),
          interestRatePercent: parseFloat(interestRateStr) || undefined,
          termMonths: parseInt(termMonthsStr) || 12,
          depositAccountId,
          startDate: new Date().toISOString().slice(0, 10),
        }),
      });

      if (res.ok) {
        setAddLoanOpen(false);
        setLenderName("");
        setPrincipalStr("");
        setInterestRateStr("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create loan");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoanRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentLoan || !activeWorkspace) return;

    const pAmt = parseFloat(principalPaidStr) || 0;
    const iAmt = parseFloat(interestPaidStr) || 0;
    if (pAmt + iAmt <= 0 || !repayAccountId) {
      alert("Please enter a valid repayment amount and payment account.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/loans/${paymentLoan.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          principalMinor: Math.round(pAmt * 100),
          interestMinor: Math.round(iAmt * 100),
          financialAccountId: repayAccountId,
          paymentDate: new Date().toISOString().slice(0, 10),
        }),
      });

      if (res.ok) {
        setPaymentLoan(null);
        setPrincipalPaidStr("");
        setInterestPaidStr("0");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record loan payment");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Loans & EMIs</h2>
          <p className="acc-subtitle">Track borrowings, repayments, principal reduction, and interest expense.</p>
        </div>

        <div className="acc-header-actions">
          {canMutate && (
            <button
              type="button"
              className="acc-btn acc-btn-primary acc-btn-sm"
              onClick={() => setAddLoanOpen(true)}
            >
              + Record Loan Receipt
            </button>
          )}
        </div>
      </div>

      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading loans...
          </div>
        ) : loans.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            No active loans or borrowings recorded.
          </div>
        ) : (
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Lender / Provider</th>
                  <th className="acc-align-right">Principal</th>
                  <th>Interest Rate</th>
                  <th>Term</th>
                  <th className="acc-align-right">Monthly Installment</th>
                  <th className="acc-align-right">Remaining Balance</th>
                  <th>Status</th>
                  {canMutate && <th className="acc-align-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.lender_name}</td>
                    <td className="acc-align-right tabular-nums">
                      {formatMoney(l.principal_minor, activeWorkspace?.currency)}
                    </td>
                    <td>{l.interest_rate_percent ? `${l.interest_rate_percent}% p.a.` : "0% (Interest-Free)"}</td>
                    <td>{l.term_months ? `${l.term_months} mos` : "—"}</td>
                    <td className="acc-align-right tabular-nums">
                      {l.monthly_installment_minor
                        ? formatMoney(l.monthly_installment_minor, activeWorkspace?.currency)
                        : "—"}
                    </td>
                    <td className="acc-align-right tabular-nums font-bold" style={{ color: "var(--acc-danger)" }}>
                      {formatMoney(l.current_balance_minor, activeWorkspace?.currency)}
                    </td>
                    <td>
                      <span className={`acc-badge ${l.status === "ACTIVE" ? "acc-badge-success" : "acc-badge-neutral"}`}>
                        {l.status}
                      </span>
                    </td>
                    {canMutate && (
                      <td className="acc-align-right">
                        {l.current_balance_minor > 0 && (
                          <button
                            type="button"
                            className="acc-btn acc-btn-sm acc-btn-primary"
                            style={{ padding: "0.2rem 0.5rem" }}
                            onClick={() => {
                              setPaymentLoan(l);
                              setPrincipalPaidStr(((l.monthly_installment_minor || l.current_balance_minor) / 100).toFixed(2));
                            }}
                          >
                            Pay Installment
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Loan Modal */}
      {addLoanOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddLoanOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Record Loan Receipt</h3>
              <button type="button" className="acc-modal-close" onClick={() => setAddLoanOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Receiving a loan increases your liquid cash/bank account and creates a corresponding liability. It is never counted as taxable revenue.
            </p>
            <form onSubmit={handleAddLoan}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="lender-name">Lender / Financial Institution *</label>
                <input
                  id="lender-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. HDFC Bank, Bajaj Finance, Friend"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="loan-principal">Principal Amount (₹) *</label>
                <input
                  id="loan-principal"
                  type="number"
                  step="0.01"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={principalStr}
                  onChange={(e) => setPrincipalStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="loan-deposit-acc">Deposited Into Account *</label>
                <select
                  id="loan-deposit-acc"
                  className="acc-form-select"
                  value={depositAccountId}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                  required
                >
                  <option value="">Select receiving Bank or Cash account...</option>
                  {accounts
                    .filter((a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR"].includes(a.subtype))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Balance: ₹{(a.current_balance_minor / 100).toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="loan-interest">Interest Rate (% p.a.)</label>
                  <input
                    id="loan-interest"
                    type="number"
                    step="0.01"
                    className="acc-form-input tabular-nums"
                    placeholder="e.g. 10.5"
                    value={interestRateStr}
                    onChange={(e) => setInterestRateStr(e.target.value)}
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="loan-term">Tenure (Months)</label>
                  <input
                    id="loan-term"
                    type="number"
                    min="1"
                    className="acc-form-input tabular-nums"
                    value={termMonthsStr}
                    onChange={(e) => setTermMonthsStr(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddLoanOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Posting..." : "Record Loan Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Installment Modal (Splits Principal vs Interest) */}
      {paymentLoan && (
        <div className="acc-modal-backdrop" onClick={() => setPaymentLoan(null)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Record Repayment - {paymentLoan.lender_name}</h3>
              <button type="button" className="acc-modal-close" onClick={() => setPaymentLoan(null)}>✕</button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Double-entry split: Principal repayment reduces your loan liability; interest payment is posted to Interest Expense.
            </p>
            <form onSubmit={handleLoanRepayment}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="repay-principal">Principal Portion (₹) *</label>
                <input
                  id="repay-principal"
                  type="number"
                  step="0.01"
                  required
                  className="acc-form-input tabular-nums font-bold"
                  value={principalPaidStr}
                  onChange={(e) => setPrincipalPaidStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="repay-interest">Interest Portion (₹)</label>
                <input
                  id="repay-interest"
                  type="number"
                  step="0.01"
                  className="acc-form-input tabular-nums"
                  value={interestPaidStr}
                  onChange={(e) => setInterestPaidStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="repay-source-acc">Disbursed From Account *</label>
                <select
                  id="repay-source-acc"
                  className="acc-form-select"
                  value={repayAccountId}
                  onChange={(e) => setRepayAccountId(e.target.value)}
                  required
                >
                  <option value="">Select Bank or Cash account...</option>
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
                  onClick={() => setPaymentLoan(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Posting..." : "Confirm Repayment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
