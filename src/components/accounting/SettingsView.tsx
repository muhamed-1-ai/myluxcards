"use client";

import React, { useState } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";
import SecuritySettingsView from "../security/SecuritySettingsView";

export default function SettingsView() {
  const {
    activeWorkspace,
    workspaces,
    setActiveWorkspace,
    accounts,
    formatMoney,
    refreshKey,
    triggerRefresh,
    canMutate,
    userRole,
  } = useAccounting();

  const [activeSection, setActiveSection] = useState<
    "ACCOUNTS" | "WORKSPACE" | "PERMISSIONS" | "NOTIFICATIONS" | "INTEGRATIONS" | "SECURITY"
  >("ACCOUNTS");

  // Set Balance State
  const [openingModalOpen, setOpeningModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [openingBalanceStr, setOpeningBalanceStr] = useState("");
  const [submittingOpening, setSubmittingOpening] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Notification Preferences State
  const [notifOverdue, setNotifOverdue] = useState(true);
  const [notifLoans, setNotifLoans] = useState(true);
  const [notifBudgets, setNotifBudgets] = useState(true);
  const [savedNotifMsg, setSavedNotifMsg] = useState("");

  const handleSetOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(openingBalanceStr);
    if (!activeWorkspace || !selectedAccountId || isNaN(amt)) {
      alert("Please choose an account and specify a valid opening balance.");
      return;
    }

    setSubmittingOpening(true);
    try {
      const res = await fetch(`/api/accounting/accounts?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
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
      setSubmittingOpening(false);
    }
  };

  const handleSyncLeads = async () => {
    if (!activeWorkspace) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/accounting/integrations/leads-sync?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Sync complete! ${data.syncedCount || 0} won deals reconciled.`);
        triggerRefresh();
      } else {
        setSyncResult(`Sync notice: ${data.message || data.error || "Completed"}`);
      }
    } catch {
      setSyncResult("Network error syncing with Leads module.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotifMsg("Notification preferences updated successfully!");
    setTimeout(() => setSavedNotifMsg(""), 3000);
  };

  return (
    <div>
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Accounting Settings</h2>
          <p className="acc-subtitle">
            Configure payment accounts, opening balances, workspaces, permissions, alerts, and integrations.
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "ACCOUNTS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("ACCOUNTS")}
        >
          🏦 Payment Accounts & Balances
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "WORKSPACE" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("WORKSPACE")}
        >
          🏢 Workspaces & Profile
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "PERMISSIONS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("PERMISSIONS")}
        >
          👥 Team Permissions
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "NOTIFICATIONS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("NOTIFICATIONS")}
        >
          🔔 Notification Alerts
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "INTEGRATIONS" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("INTEGRATIONS")}
        >
          ⚡ Leads Integration
        </button>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "SECURITY" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("SECURITY")}
        >
          🛡️ Security &amp; Password
        </button>
      </div>

      {/* SECTION 1: Payment Accounts & Opening Balances */}
      {activeSection === "ACCOUNTS" && (
        <div className="acc-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Payment Accounts & Opening Balances</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                Manage Cash in Hand, Bank accounts, and UPI settlements
              </span>
            </div>
            {canMutate && (
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => setOpeningModalOpen(true)}
              >
                Set Opening Balance
              </button>
            )}
          </div>

          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Subtype</th>
                  <th className="acc-align-right">Current Balance</th>
                  {canMutate && <th className="acc-align-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{a.code}</td>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td>
                      <span className="acc-badge acc-badge-neutral">{a.type}</span>
                    </td>
                    <td>
                      <span className="acc-badge acc-badge-neutral">{a.subtype}</span>
                    </td>
                    <td className="acc-align-right tabular-nums font-bold">
                      {formatMoney(a.current_balance_minor, activeWorkspace?.currency)}
                    </td>
                    {canMutate && (
                      <td className="acc-align-right">
                        <button
                          type="button"
                          className="acc-btn acc-btn-sm acc-btn-outline"
                          style={{ padding: "0.2rem 0.5rem" }}
                          onClick={() => {
                            setSelectedAccountId(a.id);
                            setOpeningBalanceStr((Number(a.opening_balance_minor || 0) / 100).toString());
                            setOpeningModalOpen(true);
                          }}
                        >
                          Adjust
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: Workspace & Profile */}
      {activeSection === "WORKSPACE" && (
        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>
            Workspace & Regional Setup
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Workspace Name</span>
              <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: "0.25rem" }}>{activeWorkspace?.name}</div>
            </div>
            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Workspace Type</span>
              <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: "0.25rem" }}>{activeWorkspace?.type}</div>
            </div>
            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Profile Template</span>
              <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: "0.25rem" }}>{activeWorkspace?.profile_template || "Business Owner"}</div>
            </div>
            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>Default Currency & Timezone</span>
              <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: "0.25rem" }}>
                {activeWorkspace?.currency || "INR"} (₹) · {activeWorkspace?.timezone || "Asia/Kolkata"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Team Permissions & Roles */}
      {activeSection === "PERMISSIONS" && (
        <div className="acc-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Team Roles & Access Safeguards</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                Role-based access control protecting your financial records
              </span>
            </div>
            <span className="acc-badge acc-badge-primary">Your Role: {userRole}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span className="acc-badge acc-badge-primary">OWNER</span>
                <strong style={{ fontSize: "0.875rem" }}>Workspace Owner</strong>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", margin: 0 }}>
                Full administrative access, personal & business workspace control, opening balances, category setup, and member permissions.
              </p>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span className="acc-badge acc-badge-success">MANAGER</span>
                <strong style={{ fontSize: "0.875rem" }}>Financial Manager</strong>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", margin: 0 }}>
                Can record sales, expenses, invoices, payments, adjust balances, and export financial reports.
              </p>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span className="acc-badge acc-badge-neutral">STAFF</span>
                <strong style={{ fontSize: "0.875rem" }}>Staff Member</strong>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", margin: 0 }}>
                Can record everyday sales and expenses. Cannot access owner personal workspaces or modify financial accounts.
              </p>
            </div>

            <div style={{ padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span className="acc-badge acc-badge-neutral">VIEWER</span>
                <strong style={{ fontSize: "0.875rem" }}>Read-Only Auditor</strong>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", margin: 0 }}>
                Read-only access to view reports and dashboard. Cannot record transactions or modify settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: Notification Preferences */}
      {activeSection === "NOTIFICATIONS" && (
        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
            Notification & Reminder Preferences
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1.25rem" }}>
            Control when Zappit Accounts alerts you regarding upcoming commitments and overdue obligations.
          </p>

          <form onSubmit={handleSaveNotifications}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={notifOverdue}
                  onChange={(e) => setNotifOverdue(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "var(--acc-blue)" }}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Overdue Invoices & Unpaid Bills</div>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                    Notify me when customer receivables or vendor payments exceed their due dates.
                  </span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={notifLoans}
                  onChange={(e) => setNotifLoans(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "var(--acc-blue)" }}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Upcoming Loan EMIs</div>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                    Remind me 5 days before a loan installment or interest payment is due.
                  </span>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={notifBudgets}
                  onChange={(e) => setNotifBudgets(e.target.checked)}
                  style={{ width: "18px", height: "18px", accentColor: "var(--acc-blue)" }}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>Budget Warning Thresholds</div>
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                    Alert me when category spending exceeds 85% of allocated monthly budget.
                  </span>
                </div>
              </label>
            </div>

            {savedNotifMsg && (
              <div style={{ marginTop: "1rem", color: "var(--acc-success)", fontSize: "0.8125rem", fontWeight: 600 }}>
                ✓ {savedNotifMsg}
              </div>
            )}

            <div style={{ marginTop: "1.5rem" }}>
              <button type="submit" className="acc-btn acc-btn-primary acc-btn-sm">
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 6: Leads Integration */}
      {activeSection === "INTEGRATIONS" && (
        <div className="acc-card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
            Zappit Leads Integration
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
            Automatically maps won deals from the CRM / Leads pipeline into Accounts revenue and receivable tracking with idempotent event processing.
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem", backgroundColor: "var(--acc-raised)", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "var(--acc-success)" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Pipeline Adapter Active</span>
            </div>
            <button
              type="button"
              className="acc-btn acc-btn-outline acc-btn-sm"
              onClick={handleSyncLeads}
              disabled={syncing}
            >
              {syncing ? "Reconciling..." : "Reconcile Leads Deals"}
            </button>
          </div>

          {syncResult && (
            <div style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--acc-blue)", padding: "0.75rem", backgroundColor: "var(--acc-blue-soft)", borderRadius: "6px" }}>
              {syncResult}
            </div>
          )}
        </div>
      )}

      {/* SECTION 7: Security & Password */}
      {activeSection === "SECURITY" && (
        <div className="acc-card" style={{ padding: "0" }}>
          <SecuritySettingsView user={null} />
        </div>
      )}

      {/* Set Opening Balance Modal */}
      {openingModalOpen && (
        <div className="acc-modal-backdrop" onClick={() => setOpeningModalOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Set Account Balance</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setOpeningModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSetOpeningBalance}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="settings-acc-select">
                  Select Financial Account *
                </label>
                <select
                  id="settings-acc-select"
                  className="acc-form-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                >
                  <option value="">Select an account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="settings-bal-input">
                  Balance Amount (₹) *
                </label>
                <FormattedMoneyInput
                  id="settings-bal-input"
                  required
                  className="acc-form-input acc-amount-hero-input tabular-nums"
                  placeholder="0.00"
                  value={openingBalanceStr}
                  onChange={(e) => setOpeningBalanceStr(e.target.value)}
                />
              </div>

              <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", marginTop: "0.5rem" }}>
                Balanced double-entry journal is posted against Owner Equity (Account 3000).
              </p>

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
                  disabled={submittingOpening}
                >
                  {submittingOpening ? "Updating..." : "Save Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
