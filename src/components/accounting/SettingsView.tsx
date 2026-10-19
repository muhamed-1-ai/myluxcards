"use client";

import React, { useState } from "react";
import { useAccounting } from "./AccountingContext";

export default function SettingsView() {
  const {
    activeWorkspace,
    workspaces,
    setActiveWorkspace,
    accounts,
    categories,
    formatMoney,
    refreshKey,
    triggerRefresh,
    canMutate,
    userRole,
  } = useAccounting();

  const [activeSection, setActiveSection] = useState<
    "CATEGORIES" | "ACCOUNTS" | "WORKSPACE" | "PERMISSIONS" | "NOTIFICATIONS" | "INTEGRATIONS"
  >("CATEGORIES");

  // Add Category State
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [parentId, setParentId] = useState("");
  const [submittingCat, setSubmittingCat] = useState(false);

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

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !activeWorkspace) return;

    setSubmittingCat(true);
    try {
      const res = await fetch("/api/accounting/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: catName.trim(),
          type: catType,
          parentId: parentId || undefined,
        }),
      });

      if (res.ok) {
        setAddCatOpen(false);
        setCatName("");
        setParentId("");
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create category");
      }
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleToggleArchive = async (catId: string, currentArchived: boolean) => {
    try {
      const res = await fetch(`/api/accounting/categories/${catId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !currentArchived }),
      });
      if (res.ok) {
        triggerRefresh();
      }
    } catch {
      alert("Failed to update category archive state");
    }
  };

  const handleSetOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(openingBalanceStr);
    if (!activeWorkspace || !selectedAccountId || isNaN(amt)) {
      alert("Please choose an account and specify a valid opening balance.");
      return;
    }

    setSubmittingOpening(true);
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
      setSubmittingOpening(false);
    }
  };

  const handleSyncLeads = async () => {
    if (!activeWorkspace) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/accounting/integrations/leads-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            Configure categories, payment accounts, opening balances, workspaces, permissions, alerts, and integrations.
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "CATEGORIES" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("CATEGORIES")}
        >
          🏷️ Categories
        </button>
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
      </div>

      {/* SECTION 1: Categories */}
      {activeSection === "CATEGORIES" && (
        <div className="acc-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Categories & Subcategories</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                Custom income and expense classification categories
              </span>
            </div>
            {canMutate && (
              <button
                type="button"
                className="acc-btn acc-btn-primary acc-btn-sm"
                onClick={() => setAddCatOpen(true)}
              >
                + Add Category
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {categories.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  backgroundColor: "var(--acc-raised)",
                  opacity: c.is_archived ? 0.6 : 1,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{c.name}</span>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem" }}>
                    <span className={`acc-badge ${c.type === "INCOME" ? "acc-badge-success" : "acc-badge-neutral"}`}>
                      {c.type}
                    </span>
                    {c.is_archived && <span className="acc-badge acc-badge-danger">Archived</span>}
                  </div>
                </div>

                {canMutate && (
                  <button
                    type="button"
                    className="acc-btn acc-btn-sm acc-btn-outline"
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => handleToggleArchive(c.id, c.is_archived)}
                  >
                    {c.is_archived ? "Restore" : "Archive"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Payment Accounts & Opening Balances */}
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
                            setOpeningBalanceStr((a.current_balance_minor / 100).toString());
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
                <input
                  id="settings-bal-input"
                  type="number"
                  step="0.01"
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

      {/* Add Category Modal */}
      {addCatOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddCatOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">New Category</h3>
              <button type="button" className="acc-modal-close" onClick={() => setAddCatOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="cat-name">Category Name *</label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Software Subscriptions, Freight, Marketing"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="cat-type">Type *</label>
                <select
                  id="cat-type"
                  className="acc-form-select"
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                >
                  <option value="EXPENSE">Expense (Money Out)</option>
                  <option value="INCOME">Income (Money In)</option>
                </select>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="parent-cat">Parent Category (Optional)</label>
                <select
                  id="parent-cat"
                  className="acc-form-select"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">None (Top-Level Category)</option>
                  {categories
                    .filter((c) => c.type === catType && !c.parent_id && !c.is_archived)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddCatOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingCat}
                >
                  {submittingCat ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
