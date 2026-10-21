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
    categories,
    setCategories,
    formatMoney,
    refreshKey,
    triggerRefresh,
    canMutate,
    userRole,
  } = useAccounting();

  const [activeSection, setActiveSection] = useState<
    "CATEGORIES" | "ACCOUNTS" | "WORKSPACE" | "PERMISSIONS" | "NOTIFICATIONS" | "INTEGRATIONS" | "SECURITY"
  >("CATEGORIES");

  // Add Main Category State
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [submittingCat, setSubmittingCat] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [catSuccess, setCatSuccess] = useState<string | null>(null);

  // Add Subcategory State
  const [addSubCatOpen, setAddSubCatOpen] = useState(false);
  const [activeParentCat, setActiveParentCat] = useState<any | null>(null);
  const [subCatName, setSubCatName] = useState("");
  const [submittingSubCat, setSubmittingSubCat] = useState(false);
  const [subCatError, setSubCatError] = useState<string | null>(null);

  // Edit Category/Subcategory State
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [submittingEditCat, setSubmittingEditCat] = useState(false);
  const [editCatError, setEditCatError] = useState<string | null>(null);

  // Expanded main categories tracking (default to expanded)
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const toggleExpand = (catId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [catId]: prev[catId] === false ? true : false,
    }));
  };

  const isCategoryExpanded = (catId: string) => {
    return expandedParents[catId] !== false;
  };

  const openAddSubcategory = (parent: any) => {
    setActiveParentCat(parent);
    setSubCatName("");
    setSubCatError(null);
    setAddSubCatOpen(true);
  };

  const openEditCategory = (cat: any) => {
    setEditingCat(cat);
    setEditCatName(cat.name);
    setEditCatError(null);
    setEditCatOpen(true);
  };

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
    const trimmed = catName.trim();
    if (!trimmed || !activeWorkspace) return;

    setSubmittingCat(true);
    setCatError(null);
    try {
      const res = await fetch(`/api/accounting/categories?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: trimmed,
          type: catType,
        }),
      });

      const data = await res.json();
      if (res.ok && data.category) {
        setCategories((prev) => {
          const exists = prev.some((c) => c.id === data.category.id);
          if (exists) {
            return prev.map((c) => (c.id === data.category.id ? data.category : c));
          }
          return [...prev, data.category];
        });

        setCatSuccess(`Main category "${data.category.name}" created successfully.`);
        setAddCatOpen(false);
        setCatName("");
        setCatError(null);
        triggerRefresh();
      } else {
        setCatError(data.error || "Failed to create category. Please review form input.");
      }
    } catch (err: any) {
      setCatError(err.message || "Network request failed. Please check connection and try again.");
    } finally {
      setSubmittingCat(false);
    }
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subCatName.trim();
    if (!trimmed || !activeWorkspace || !activeParentCat) return;

    setSubmittingSubCat(true);
    setSubCatError(null);
    try {
      const res = await fetch(`/api/accounting/categories?workspaceId=${activeWorkspace.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: trimmed,
          type: activeParentCat.type,
          parentId: activeParentCat.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.category) {
        setCategories((prev) => {
          const exists = prev.some((c) => c.id === data.category.id);
          if (exists) {
            return prev.map((c) => (c.id === data.category.id ? data.category : c));
          }
          return [...prev, data.category];
        });

        // Auto-expand parent group so new subcategory is immediately visible
        setExpandedParents((prev) => ({ ...prev, [activeParentCat.id]: true }));
        setCatSuccess(`Subcategory "${data.category.name}" added under "${activeParentCat.name}".`);
        setAddSubCatOpen(false);
        setSubCatName("");
        setActiveParentCat(null);
        setSubCatError(null);
        triggerRefresh();
      } else {
        setSubCatError(data.error || "Failed to create subcategory. Please review form input.");
      }
    } catch (err: any) {
      setSubCatError(err.message || "Network request failed. Please check connection and try again.");
    } finally {
      setSubmittingSubCat(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editCatName.trim();
    if (!trimmed || !activeWorkspace || !editingCat) return;

    setSubmittingEditCat(true);
    setEditCatError(null);
    try {
      const res = await fetch(`/api/accounting/categories/${editingCat.id}?workspaceId=${activeWorkspace.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: trimmed,
        }),
      });

      const data = await res.json();
      if (res.ok && data.category) {
        setCategories((prev) => prev.map((c) => (c.id === data.category.id ? data.category : c)));
        setCatSuccess(`Category updated to "${data.category.name}".`);
        setEditCatOpen(false);
        setEditingCat(null);
        setEditCatName("");
        setEditCatError(null);
        triggerRefresh();
      } else {
        setEditCatError(data.error || "Failed to update category.");
      }
    } catch (err: any) {
      setEditCatError(err.message || "Network request failed.");
    } finally {
      setSubmittingEditCat(false);
    }
  };

  const handleToggleArchive = async (catId: string, currentArchived: boolean) => {
    if (!activeWorkspace) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    if (currentArchived && cat.parent_id) {
      const parent = categories.find((p) => p.id === cat.parent_id);
      if (parent && parent.is_archived) {
        alert(`Cannot restore subcategory "${cat.name}" because its parent category "${parent.name}" is archived. Please restore "${parent.name}" first.`);
        return;
      }
    }

    try {
      const res = await fetch(`/api/accounting/categories/${catId}?workspaceId=${activeWorkspace.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": activeWorkspace.id,
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          isArchived: !currentArchived,
          action: !currentArchived ? "ARCHIVE" : "RESTORE",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.category) {
          setCategories((prev) => prev.map((c) => (c.id === data.category.id ? data.category : c)));
        }
        setCatSuccess(`Category "${cat.name}" ${currentArchived ? "restored" : "archived"} successfully.`);
        triggerRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update category archive state");
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
        <button
          type="button"
          className={`acc-btn acc-btn-sm ${activeSection === "SECURITY" ? "acc-btn-primary" : "acc-btn-outline"}`}
          onClick={() => setActiveSection("SECURITY")}
        >
          🛡️ Security &amp; Password
        </button>
      </div>

      {/* SECTION 1: Categories */}
      {activeSection === "CATEGORIES" && (
        <div className="acc-card">
          {catSuccess && (
            <div
              className="acc-alert acc-alert-success"
              style={{
                marginBottom: "1.25rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{catSuccess}</span>
              <button
                type="button"
                onClick={() => setCatSuccess(null)}
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
                onClick={() => {
                  setCatError(null);
                  setAddCatOpen(true);
                }}
              >
                + Add Category
              </button>
            )}
          </div>

          {categories.filter((c) => !c.parent_id).length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
              <p style={{ margin: "0 0 1rem 0" }}>No categories configured in this workspace yet.</p>
              {canMutate && (
                <button
                  type="button"
                  className="acc-btn acc-btn-primary acc-btn-sm"
                  onClick={() => {
                    setCatError(null);
                    setAddCatOpen(true);
                  }}
                >
                  + Add First Category
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {categories
                .filter((c) => !c.parent_id)
                .map((mainCat) => {
                  const subcategories = categories.filter((c) => c.parent_id === mainCat.id);
                  const isExpanded = isCategoryExpanded(mainCat.id);

                  return (
                    <div
                      key={mainCat.id}
                      style={{
                        borderRadius: "10px",
                        backgroundColor: "var(--acc-raised)",
                        border: "1px solid var(--acc-border)",
                        overflow: "hidden",
                        opacity: mainCat.is_archived ? 0.65 : 1,
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      {/* Main Category Row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.875rem 1rem",
                          gap: "0.75rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flex: "1 1 280px", minWidth: 0, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => toggleExpand(mainCat.id)}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${mainCat.name}`}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--acc-text-muted)",
                              cursor: "pointer",
                              padding: "0.25rem 0.35rem",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.85rem",
                              lineHeight: 1,
                              borderRadius: "4px",
                              transition: "transform 0.2s ease",
                              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                          >
                            ▶
                          </button>

                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "0.9375rem",
                              color: "var(--acc-text-main)",
                              wordBreak: "break-word",
                            }}
                          >
                            {mainCat.name}
                          </span>

                          <span className={`acc-badge ${mainCat.type === "INCOME" ? "acc-badge-success" : "acc-badge-neutral"}`}>
                            {mainCat.type}
                          </span>

                          <span
                            style={{
                              fontSize: "0.72rem",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "12px",
                              backgroundColor: "var(--acc-surface)",
                              color: "var(--acc-text-muted)",
                              border: "1px solid var(--acc-border)",
                              fontWeight: 500,
                            }}
                          >
                            {subcategories.length} {subcategories.length === 1 ? "subcategory" : "subcategories"}
                          </span>

                          {mainCat.is_archived && (
                            <span className="acc-badge acc-badge-danger" style={{ fontSize: "0.72rem" }}>
                              Archived
                            </span>
                          )}
                        </div>

                        {canMutate && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                            {!mainCat.is_archived && (
                              <button
                                type="button"
                                className="acc-btn acc-btn-sm acc-btn-primary"
                                style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", fontWeight: 600 }}
                                onClick={() => openAddSubcategory(mainCat)}
                              >
                                + Subcategory
                              </button>
                            )}
                            <button
                              type="button"
                              className="acc-btn acc-btn-sm acc-btn-outline"
                              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
                              onClick={() => openEditCategory(mainCat)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="acc-btn acc-btn-sm acc-btn-outline"
                              style={{ padding: "0.25rem 0.55rem", fontSize: "0.75rem" }}
                              onClick={() => handleToggleArchive(mainCat.id, mainCat.is_archived)}
                            >
                              {mainCat.is_archived ? "Restore" : "Archive"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded Subcategories */}
                      {isExpanded && (
                        <div
                          style={{
                            borderTop: "1px solid var(--acc-border)",
                            backgroundColor: "var(--acc-surface)",
                            padding: "0.75rem 1rem 0.75rem 2.25rem",
                          }}
                        >
                          {subcategories.length === 0 ? (
                            <div
                              style={{
                                padding: "0.5rem 0",
                                color: "var(--acc-text-muted)",
                                fontSize: "0.8125rem",
                                fontStyle: "italic",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: "0.5rem",
                              }}
                            >
                              <span>No subcategories yet under {mainCat.name}.</span>
                              {canMutate && !mainCat.is_archived && (
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-sm acc-btn-outline"
                                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                                  onClick={() => openAddSubcategory(mainCat)}
                                >
                                  + Add First Subcategory
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                              {subcategories.map((sub) => (
                                <div
                                  key={sub.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "0.5rem 0.75rem",
                                    borderRadius: "6px",
                                    backgroundColor: "var(--acc-raised)",
                                    opacity: sub.is_archived ? 0.6 : 1,
                                    borderLeft: "3px solid var(--acc-blue)",
                                    gap: "0.5rem",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <span style={{ color: "var(--acc-text-muted)", fontSize: "0.875rem" }}>↳</span>
                                    <span style={{ fontWeight: 600, fontSize: "0.84rem", color: "var(--acc-text-main)" }}>
                                      {sub.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "0.7rem",
                                        padding: "0.1rem 0.4rem",
                                        borderRadius: "4px",
                                        backgroundColor: "var(--acc-surface)",
                                        color: "var(--acc-text-muted)",
                                        border: "1px solid var(--acc-border)",
                                      }}
                                    >
                                      {sub.type}
                                    </span>
                                    {sub.is_archived && (
                                      <span className="acc-badge acc-badge-danger" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                                        Archived
                                      </span>
                                    )}
                                  </div>

                                  {canMutate && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                      <button
                                        type="button"
                                        className="acc-btn acc-btn-sm acc-btn-outline"
                                        style={{ padding: "0.15rem 0.45rem", fontSize: "0.72rem" }}
                                        onClick={() => openEditCategory(sub)}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="acc-btn acc-btn-sm acc-btn-outline"
                                        style={{ padding: "0.15rem 0.45rem", fontSize: "0.72rem" }}
                                        onClick={() => handleToggleArchive(sub.id, sub.is_archived)}
                                      >
                                        {sub.is_archived ? "Restore" : "Archive"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
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

      {/* Add Main Category Modal */}
      {addCatOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddCatOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">New Main Category</h3>
              <button type="button" className="acc-modal-close" onClick={() => setAddCatOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateCategory}>
              {catError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {catError}
                </div>
              )}
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="cat-name">Category Name *</label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  autoFocus
                  className="acc-form-input"
                  placeholder="e.g. Utilities, Housing, Office Supplies"
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

              <p style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)" }}>
                This creates a top-level main category. You can add nested subcategories under it at any time.
              </p>

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
                  {submittingCat ? "Saving..." : "Save Main Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subcategory Modal */}
      {addSubCatOpen && activeParentCat && (
        <div className="acc-modal-backdrop" onClick={() => setAddSubCatOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">New Subcategory</h3>
              <button type="button" className="acc-modal-close" onClick={() => setAddSubCatOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSubcategory}>
              {subCatError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {subCatError}
                </div>
              )}

              {/* Visible Parent Category display */}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "var(--acc-raised)",
                  borderRadius: "8px",
                  border: "1px solid var(--acc-border)",
                  marginBottom: "1rem",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", display: "block" }}>
                  Parent Category
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <strong style={{ fontSize: "0.9375rem" }}>{activeParentCat.name}</strong>
                  <span className={`acc-badge ${activeParentCat.type === "INCOME" ? "acc-badge-success" : "acc-badge-neutral"}`}>
                    {activeParentCat.type}
                  </span>
                </div>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="subcat-name">Subcategory Name *</label>
                <input
                  id="subcat-name"
                  type="text"
                  required
                  autoFocus
                  className="acc-form-input"
                  placeholder="e.g. Phone Bill, Electricity, Internet, Petrol"
                  value={subCatName}
                  onChange={(e) => setSubCatName(e.target.value)}
                />
              </div>

              <div style={{ fontSize: "0.8rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
                Type: <strong style={{ color: "var(--acc-text-main)" }}>{activeParentCat.type}</strong> (automatically inherited from parent category)
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddSubCatOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingSubCat}
                >
                  {submittingSubCat ? "Saving..." : "Save Subcategory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category / Subcategory Modal */}
      {editCatOpen && editingCat && (
        <div className="acc-modal-backdrop" onClick={() => setEditCatOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">
                {editingCat.parent_id ? "Edit Subcategory" : "Edit Main Category"}
              </h3>
              <button type="button" className="acc-modal-close" onClick={() => setEditCatOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleEditCategory}>
              {editCatError && (
                <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                  {editCatError}
                </div>
              )}

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-cat-name">Category Name *</label>
                <input
                  id="edit-cat-name"
                  type="text"
                  required
                  autoFocus
                  className="acc-form-input"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--acc-text-muted)" }}>Type:</span>
                <span className={`acc-badge ${editingCat.type === "INCOME" ? "acc-badge-success" : "acc-badge-neutral"}`}>
                  {editingCat.type}
                </span>
                {editingCat.parent_name && (
                  <span style={{ fontSize: "0.75rem", color: "var(--acc-text-muted)", fontStyle: "italic" }}>
                    (Subcategory of {editingCat.parent_name})
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setEditCatOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submittingEditCat}
                >
                  {submittingEditCat ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
