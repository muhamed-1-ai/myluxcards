"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput, { stripCommas } from "../ui/FormattedMoneyInput";

interface Loan {
  id: string;
  lender_name?: string;
  type: string;
  principal_minor: number;
  interest_rate_percent?: number;
  term_months?: number;
  monthly_installment_minor?: number;
  current_balance_minor: number;
  start_date: string;
  end_date?: string;
  status: string;
  liability_account_name?: string;
  disbursement_account_name?: string;
}

interface LoanInstallment {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  principal_minor: number;
  interest_minor: number;
  total_minor: number;
  status: string;
  paid_at?: string | null;
}

interface LoanDetailData {
  loan: Loan;
  installments: LoanInstallment[];
}

export default function LoansView() {
  const {
    activeWorkspace,
    formatMoney,
    accounts,
    refreshKey,
    triggerRefresh,
    canMutate,
  } = useAccounting();

  // Listing state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail view state
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<LoanDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [addLoanOpen, setAddLoanOpen] = useState(false);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add Loan State
  const [lenderName, setLenderName] = useState("");
  const [principalStr, setPrincipalStr] = useState("");
  const [interestRateStr, setInterestRateStr] = useState("");
  const [termMonthsStr, setTermMonthsStr] = useState("12");
  const [depositAccountId, setDepositAccountId] = useState("");
  const [startDateStr, setStartDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [addLoanSubmitting, setAddLoanSubmitting] = useState(false);
  const [addLoanError, setAddLoanError] = useState<string | null>(null);

  // Repayment Form State (used in detail view)
  const [repayPrincipalStr, setRepayPrincipalStr] = useState("");
  const [repayInterestStr, setRepayInterestStr] = useState("0");
  const [repayAccountId, setRepayAccountId] = useState("");
  const [repayDateStr, setRepayDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [repayInstallmentId, setRepayInstallmentId] = useState<string | null>(null);
  const [repaySubmitting, setRepaySubmitting] = useState(false);
  const [repayError, setRepayError] = useState<string | null>(null);

  // Liquid payment accounts
  const liquidAccounts = accounts.filter(
    (a) => a.type === "ASSET" && ["CASH", "BANK", "PAYMENT_PROCESSOR", "UPI"].includes(a.subtype)
  );
  const availableAccounts = liquidAccounts.length > 0 ? liquidAccounts : accounts.filter((a) => a.type === "ASSET");

  // Set default account selections
  useEffect(() => {
    if (availableAccounts.length > 0) {
      if (!depositAccountId) setDepositAccountId(availableAccounts[0].id);
      if (!repayAccountId) setRepayAccountId(availableAccounts[0].id);
    }
  }, [availableAccounts, depositAccountId, repayAccountId]);

  // Load loans list
  const loadLoans = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/accounting/loans?workspaceId=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setLoans(data.loans || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || "Failed to load loans");
      }
    } catch (err: any) {
      console.error("Failed to load loans:", err);
      setErrorMessage(err.message || "Network error loading loans");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans, refreshKey]);

  // Load single loan details
  const loadLoanDetails = useCallback(async (loanId: string) => {
    if (!activeWorkspace) return;
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/accounting/loans/${loanId}?workspaceId=${activeWorkspace.id}`);
      if (res.ok) {
        const data: LoanDetailData = await res.json();
        setDetailData(data);

        // Pre-fill next pending installment values if available
        const nextPending = data.installments?.find((i) => i.status === "PENDING");
        if (nextPending) {
          setRepayPrincipalStr((nextPending.principal_minor / 100).toString());
          setRepayInterestStr((nextPending.interest_minor / 100).toString());
          setRepayInstallmentId(nextPending.id);
        } else if (data.loan.current_balance_minor > 0) {
          setRepayPrincipalStr((data.loan.current_balance_minor / 100).toString());
          setRepayInterestStr("0");
          setRepayInstallmentId(null);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.error || "Failed to load loan details");
      }
    } catch (err: any) {
      console.error("Failed to load loan details:", err);
      setErrorMessage(err.message || "Network error loading loan details");
    } finally {
      setDetailLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (selectedLoanId) {
      loadLoanDetails(selectedLoanId);
    } else {
      setDetailData(null);
    }
  }, [selectedLoanId, loadLoanDetails, refreshKey]);

  // Handle Add Loan Receipt
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoanError(null);

    const rawPrincipal = stripCommas(principalStr);
    const principal = parseFloat(rawPrincipal);
    if (!activeWorkspace || !lenderName.trim() || isNaN(principal) || principal <= 0 || !depositAccountId) {
      setAddLoanError("Please fill in all required fields with a valid loan amount.");
      return;
    }

    setAddLoanSubmitting(true);
    try {
      const res = await fetch("/api/accounting/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          loanName: lenderName.trim(),
          lenderName: lenderName.trim(),
          principalMinor: Math.round(principal * 100),
          interestRatePercent: parseFloat(interestRateStr) || undefined,
          tenureMonths: parseInt(termMonthsStr, 10) || 12,
          termMonths: parseInt(termMonthsStr, 10) || 12,
          disbursementAccountId: depositAccountId,
          depositAccountId,
          startDate: startDateStr || new Date().toISOString().slice(0, 10),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(`Loan from "${lenderName.trim()}" recorded successfully.`);
        setAddLoanOpen(false);
        setLenderName("");
        setPrincipalStr("");
        setInterestRateStr("");
        setTermMonthsStr("12");
        triggerRefresh();
        loadLoans();
      } else {
        setAddLoanError(data.error || "Failed to record loan receipt");
      }
    } catch (err: any) {
      setAddLoanError(err.message || "Network error recording loan");
    } finally {
      setAddLoanSubmitting(false);
    }
  };

  // Handle Record Repayment
  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !activeWorkspace) return;
    setRepayError(null);

    const rawPrincipal = stripCommas(repayPrincipalStr);
    const rawInterest = stripCommas(repayInterestStr);
    const pAmt = parseFloat(rawPrincipal) || 0;
    const iAmt = parseFloat(rawInterest) || 0;

    if (pAmt + iAmt <= 0) {
      setRepayError("Repayment must have principal or interest greater than ₹0.");
      return;
    }

    if (!repayAccountId) {
      setRepayError("Please select a payment account.");
      return;
    }

    setRepaySubmitting(true);
    try {
      const res = await fetch(`/api/accounting/loans/${selectedLoanId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          installmentId: repayInstallmentId || undefined,
          principalMinor: Math.round(pAmt * 100),
          interestMinor: Math.round(iAmt * 100),
          financialAccountId: repayAccountId,
          paymentDate: repayDateStr || new Date().toISOString().slice(0, 10),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage("Repayment recorded successfully. Loan balance updated.");
        triggerRefresh();
        loadLoanDetails(selectedLoanId);
        loadLoans();
      } else {
        setRepayError(data.error || "Failed to record loan payment");
      }
    } catch (err: any) {
      setRepayError(err.message || "Network error recording repayment");
    } finally {
      setRepaySubmitting(false);
    }
  };

  // Pre-fill repayment form for a specific installment
  const handleSelectInstallment = (inst: LoanInstallment) => {
    setRepayInstallmentId(inst.id);
    setRepayPrincipalStr((inst.principal_minor / 100).toString());
    setRepayInterestStr((inst.interest_minor / 100).toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // =========================================================================
  // VIEW: LOAN DETAIL
  // =========================================================================
  if (selectedLoanId && detailData) {
    const l = detailData.loan;
    const principalRepaid = Math.max(0, l.principal_minor - l.current_balance_minor);
    const percentRepaid = l.principal_minor > 0 ? Math.min(100, Math.round((principalRepaid / l.principal_minor) * 100)) : 100;
    const isCompleted = l.status === "COMPLETED" || l.current_balance_minor <= 0;

    const rawPrincipal = stripCommas(repayPrincipalStr);
    const rawInterest = stripCommas(repayInterestStr);
    const curP = parseFloat(rawPrincipal) || 0;
    const curI = parseFloat(rawInterest) || 0;
    const curTotalMinor = Math.round((curP + curI) * 100);

    return (
      <div className="acc-detail-page">
        {/* Top Header */}
        <div className="acc-detail-header">
          <div className="acc-detail-header-left">
            <button
              type="button"
              className="acc-back-btn"
              onClick={() => setSelectedLoanId(null)}
              aria-label="Back to loans list"
            >
              ← Back to Loans
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🏦</span>
              <h2 className="acc-title" style={{ fontSize: "1.375rem" }}>
                {l.lender_name || "Loan Account"}
              </h2>
              <span className={`acc-badge ${isCompleted ? "acc-badge-neutral" : "acc-badge-success"}`}>
                {l.status}
              </span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="acc-alert acc-alert-success" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{successMessage}</span>
            <button type="button" onClick={() => setSuccessMessage(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}
        {errorMessage && (
          <div className="acc-alert acc-alert-danger" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Top 2-Column Grid: Summary Card (Left) & Record Repayment Card (Right) */}
        <div className="acc-detail-top-grid">
          {/* Left: Loan Summary Card */}
          <div className="acc-detail-summary-card">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div className="acc-budget-card-avatar">🏦</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                      {l.lender_name || "Lender"}
                    </h3>
                    <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginTop: "0.25rem" }}>
                      {l.term_months ? `${l.term_months} Months Term` : "Custom Loan"} · {l.interest_rate_percent ? `${l.interest_rate_percent}% p.a.` : "0% Interest-Free"}
                    </div>
                  </div>
                </div>

                <div className="acc-loan-card-amount">
                  <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Outstanding Principal
                  </div>
                  <div className="tabular-nums" style={{ color: isCompleted ? "var(--acc-success)" : "var(--acc-danger)" }}>
                    {formatMoney(l.current_balance_minor, activeWorkspace?.currency)}
                  </div>
                </div>
              </div>

              {/* Repaid vs Total Principal */}
              <div className="acc-budget-card-metrics" style={{ fontSize: "0.875rem", marginBottom: "0.625rem" }}>
                <span>
                  {formatMoney(principalRepaid, activeWorkspace?.currency)} Principal Repaid ({percentRepaid}%)
                </span>
                <span>
                  {formatMoney(l.principal_minor, activeWorkspace?.currency)} Total Principal
                </span>
              </div>

              {/* Repayment Progress Bar */}
              <div className="acc-budget-card-bar-track" style={{ height: "10px", marginBottom: "1.25rem" }}>
                <div
                  className="acc-budget-card-bar-fill"
                  style={{
                    width: `${percentRepaid}%`,
                    backgroundColor: isCompleted ? "var(--acc-success)" : "var(--acc-blue)",
                  }}
                />
              </div>
            </div>

            {/* Metadata Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--acc-border)",
                fontSize: "0.8125rem",
              }}
            >
              <div>
                <span style={{ color: "var(--acc-text-muted)", display: "block" }}>Monthly EMI</span>
                <strong style={{ color: "var(--acc-text-main)" }}>
                  {l.monthly_installment_minor ? formatMoney(l.monthly_installment_minor, activeWorkspace?.currency) : "—"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--acc-text-muted)", display: "block" }}>Start Date</span>
                <strong style={{ color: "var(--acc-text-main)" }}>
                  {l.start_date || "—"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--acc-text-muted)", display: "block" }}>Disbursement Account</span>
                <strong style={{ color: "var(--acc-text-main)" }}>
                  {l.disbursement_account_name || "Liquid Bank Account"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--acc-text-muted)", display: "block" }}>Liability Account</span>
                <strong style={{ color: "var(--acc-text-main)" }}>
                  {l.liability_account_name || "Loans Payable (2500)"}
                </strong>
              </div>
            </div>
          </div>

          {/* Right: Record Repayment Card */}
          <div className="acc-detail-form-card">
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.125rem", fontWeight: 700 }}>
              Record Repayment
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", margin: "0 0 1rem 0" }}>
              Principal repayment reduces your loan balance. Interest is separated into Interest Expense (5100).
            </p>

            {repayError && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {repayError}
              </div>
            )}

            {isCompleted ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--acc-success)", fontWeight: 600 }}>
                ✓ This loan has been fully paid off!
              </div>
            ) : (
              <form onSubmit={handleRecordRepayment}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="repay-principal">
                      Principal Portion ({activeWorkspace?.currency || "₹"}) *
                    </label>
                    <FormattedMoneyInput
                      id="repay-principal"
                      required
                      className="acc-form-input tabular-nums"
                      placeholder="0.00"
                      value={repayPrincipalStr}
                      onChange={(e) => setRepayPrincipalStr(e.target.value)}
                    />
                  </div>

                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="repay-interest">
                      Interest Portion ({activeWorkspace?.currency || "₹"})
                    </label>
                    <FormattedMoneyInput
                      id="repay-interest"
                      className="acc-form-input tabular-nums"
                      placeholder="0.00"
                      value={repayInterestStr}
                      onChange={(e) => setRepayInterestStr(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="repay-date">
                      Repayment Date *
                    </label>
                    <input
                      id="repay-date"
                      type="date"
                      required
                      className="acc-form-input"
                      value={repayDateStr}
                      onChange={(e) => setRepayDateStr(e.target.value)}
                    />
                  </div>

                  <div className="acc-form-group">
                    <label className="acc-form-label" htmlFor="repay-account">
                      Payment Account *
                    </label>
                    <select
                      id="repay-account"
                      className="acc-form-select"
                      required
                      value={repayAccountId}
                      onChange={(e) => setRepayAccountId(e.target.value)}
                    >
                      {availableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.current_balance_minor, activeWorkspace?.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Total Payment Banner */}
                <div
                  style={{
                    backgroundColor: "var(--acc-raised)",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    margin: "0.75rem 0",
                    border: "1px solid var(--acc-border)",
                  }}
                >
                  <span style={{ fontSize: "0.875rem", color: "var(--acc-text-muted)" }}>Total Cash Outflow:</span>
                  <strong className="tabular-nums" style={{ fontSize: "1.125rem", color: "var(--acc-text-main)" }}>
                    {formatMoney(curTotalMinor, activeWorkspace?.currency)}
                  </strong>
                </div>

                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ width: "100%", marginTop: "0.5rem" }}
                  disabled={repaySubmitting || !canMutate}
                >
                  {repaySubmitting ? "Processing Payment..." : "Record Repayment"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Section: Installment Schedule */}
        <div className="acc-detail-table-card">
          <h3 style={{ margin: "0 0 1.25rem 0", fontSize: "1.125rem", fontWeight: 700 }}>
            Installment Schedule & Repayment History
          </h3>

          {detailLoading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--acc-text-muted)" }}>
              Loading schedule...
            </div>
          ) : detailData.installments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "var(--acc-text-muted)" }}>
              <p style={{ margin: 0 }}>No installment schedule recorded for this loan.</p>
              <p style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                Use the form above to record custom principal or interest repayments anytime.
              </p>
            </div>
          ) : (
            <div className="acc-table-wrapper">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Due Date</th>
                    <th className="acc-align-right">Principal</th>
                    <th className="acc-align-right">Interest</th>
                    <th className="acc-align-right">Total Installment</th>
                    <th>Status</th>
                    {canMutate && <th className="acc-align-right" style={{ width: "100px" }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {detailData.installments.map((inst) => {
                    const isPaid = inst.status === "PAID";
                    return (
                      <tr key={inst.id}>
                        <td style={{ fontWeight: 600 }}>Installment {inst.installment_number}</td>
                        <td style={{ color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
                          {inst.due_date}
                        </td>
                        <td className="acc-align-right tabular-nums">
                          {formatMoney(inst.principal_minor, activeWorkspace?.currency)}
                        </td>
                        <td className="acc-align-right tabular-nums">
                          {formatMoney(inst.interest_minor, activeWorkspace?.currency)}
                        </td>
                        <td className="acc-align-right tabular-nums font-bold">
                          {formatMoney(inst.total_minor, activeWorkspace?.currency)}
                        </td>
                        <td>
                          <span className={`acc-badge ${isPaid ? "acc-badge-success" : "acc-badge-neutral"}`}>
                            {inst.status}
                          </span>
                        </td>
                        {canMutate && (
                          <td className="acc-align-right">
                            {!isPaid && (
                              <button
                                type="button"
                                className="acc-btn acc-btn-sm acc-btn-outline"
                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                onClick={() => handleSelectInstallment(inst)}
                              >
                                Pay This
                              </button>
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
      </div>
    );
  }

  // =========================================================================
  // VIEW: LOANS LISTING (MATCHING SCREENSHOT 1 & 5)
  // =========================================================================
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
              onClick={() => {
                setAddLoanError(null);
                setAddLoanOpen(true);
              }}
            >
              + Record Loan Receipt
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
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

      {errorMessage && (
        <div
          className="acc-alert acc-alert-danger"
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
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

      {/* Main Responsive Grid */}
      {loading ? (
        <div className="acc-card" style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
          Loading loans...
        </div>
      ) : (
        <div className="acc-cards-grid">
          {/* Dashed Record Loan Receipt Tile (always visible) */}
          {canMutate && (
            <button
              type="button"
              className="acc-create-tile"
              onClick={() => {
                setAddLoanError(null);
                setAddLoanOpen(true);
              }}
              aria-label="Record Loan Receipt"
            >
              <span className="acc-create-tile-icon">+</span>
              <span className="acc-create-tile-label">Record Loan Receipt</span>
            </button>
          )}

          {/* Loan Cards */}
          {loans.map((l) => {
            const principalRepaid = Math.max(0, l.principal_minor - l.current_balance_minor);
            const percentRepaid = l.principal_minor > 0 ? Math.min(100, Math.round((principalRepaid / l.principal_minor) * 100)) : 100;
            const isCompleted = l.status === "COMPLETED" || l.current_balance_minor <= 0;

            return (
              <div
                key={l.id}
                className="acc-loan-card"
                onClick={() => setSelectedLoanId(l.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedLoanId(l.id);
                  }
                }}
                aria-label={`View details for loan ${l.lender_name || "Loan"}`}
              >
                {/* Header Row: Left (Avatar + Lender + Status) | Right (Outstanding Balance) */}
                <div className="acc-loan-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", minWidth: 0 }}>
                    <div className="acc-budget-card-avatar">🏦</div>
                    <div style={{ minWidth: 0 }}>
                      <h4 className="acc-budget-card-title" title={l.lender_name || "Lender"}>
                        {l.lender_name || "Lender"}
                      </h4>
                      <div className="acc-loan-card-badge-row">
                        <span className={`acc-badge ${isCompleted ? "acc-badge-neutral" : "acc-badge-success"}`}>
                          {l.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="acc-loan-card-amount">
                    <div style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>
                      Outstanding
                    </div>
                    <div className="tabular-nums" style={{ color: isCompleted ? "var(--acc-success)" : "var(--acc-danger)" }}>
                      {formatMoney(l.current_balance_minor, activeWorkspace?.currency)}
                    </div>
                  </div>
                </div>

                {/* Progress Row */}
                <div>
                  <div className="acc-budget-card-metrics">
                    <span>
                      {formatMoney(principalRepaid, activeWorkspace?.currency)} Repaid ({percentRepaid}%)
                    </span>
                    <span>
                      {formatMoney(l.principal_minor, activeWorkspace?.currency)} Principal
                    </span>
                  </div>

                  <div className="acc-budget-card-bar-track">
                    <div
                      className="acc-budget-card-bar-fill"
                      style={{
                        width: `${percentRepaid}%`,
                        backgroundColor: isCompleted ? "var(--acc-success)" : "var(--acc-blue)",
                      }}
                    />
                  </div>
                </div>

                {/* Terms Footer */}
                <div className="acc-loan-card-terms">
                  <span>
                    Rate: <strong>{l.interest_rate_percent ? `${l.interest_rate_percent}%` : "0%"}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Term: <strong>{l.term_months ? `${l.term_months} mos` : "—"}</strong>
                  </span>
                  {l.monthly_installment_minor && (
                    <>
                      <span>•</span>
                      <span>
                        EMI: <strong>{formatMoney(l.monthly_installment_minor, activeWorkspace?.currency)}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =======================================================================
          MODAL: RECORD LOAN RECEIPT
          ======================================================================= */}
      {addLoanOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddLoanOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Record Loan Receipt</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setAddLoanOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
              Receiving a loan increases your liquid cash/bank account and creates a corresponding liability. It is never counted as taxable revenue.
            </p>

            <form onSubmit={handleAddLoan}>
              {addLoanError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {addLoanError}
                </div>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="create-loan-lender">
                  Lender / Financial Institution *
                </label>
                <input
                  id="create-loan-lender"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. HDFC Bank, Bajaj Finance, Friend"
                  value={lenderName}
                  onChange={(e) => setLenderName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="create-loan-principal">
                  Principal Amount ({activeWorkspace?.currency || "₹"}) *
                </label>
                <FormattedMoneyInput
                  id="create-loan-principal"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="e.g. 100,000"
                  value={principalStr}
                  onChange={(e) => setPrincipalStr(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="create-loan-rate">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    id="create-loan-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    className="acc-form-input"
                    placeholder="e.g. 10.5 (or 0)"
                    value={interestRateStr}
                    onChange={(e) => setInterestRateStr(e.target.value)}
                  />
                </div>

                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="create-loan-term">
                    Term (Months) *
                  </label>
                  <input
                    id="create-loan-term"
                    type="number"
                    min="1"
                    required
                    className="acc-form-input"
                    value={termMonthsStr}
                    onChange={(e) => setTermMonthsStr(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="create-loan-account">
                    Deposit Account (Liquid Asset) *
                  </label>
                  <select
                    id="create-loan-account"
                    className="acc-form-select"
                    required
                    value={depositAccountId}
                    onChange={(e) => setDepositAccountId(e.target.value)}
                  >
                    {availableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.current_balance_minor, activeWorkspace?.currency)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="acc-form-group">
                  <label className="acc-form-label" htmlFor="create-loan-date">
                    Disbursement Date *
                  </label>
                  <input
                    id="create-loan-date"
                    type="date"
                    required
                    className="acc-form-input"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
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
                  disabled={addLoanSubmitting}
                >
                  {addLoanSubmitting ? "Recording..." : "Record Loan Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
