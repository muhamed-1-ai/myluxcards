"use client";

import React, { useState, useMemo } from "react";
import { useAccounting } from "./AccountingContext";

export default function CategoriesView() {
  const {
    activeWorkspace,
    categories,
    setCategories,
    triggerRefresh,
    canMutate,
  } = useAccounting();

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");

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

  // Expanded main categories tracking (default to collapsed initially to reduce clutter)
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const toggleExpand = (catId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
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

  // 1. Submit Main Category
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

        setCatSuccess(`Category "${data.category.name}" created successfully.`);
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

  // 2. Submit Subcategory
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

  // 3. Edit Category / Subcategory
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

  // 4. Archive / Restore Category
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
        alert(data.error || "Failed to update category status.");
      }
    } catch (err) {
      alert("Failed to archive/restore category.");
    }
  };

  // Filtered and searched list
  const parentCategories = useMemo(() => {
    return categories.filter((c) => !c.parent_id);
  }, [categories]);

  const filteredParents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return parentCategories.filter((mainCat) => {
      // Type filter
      if (typeFilter !== "ALL" && mainCat.type !== typeFilter) {
        return false;
      }

      // Search term
      if (!q) return true;

      const mainMatches = mainCat.name.toLowerCase().includes(q);
      const subcategories = categories.filter((c) => c.parent_id === mainCat.id);
      const subMatches = subcategories.some((sub) => sub.name.toLowerCase().includes(q));

      return mainMatches || subMatches;
    });
  }, [parentCategories, categories, typeFilter, searchTerm]);

  // Check if a category is expanded:
  // If user is searching and a subcategory matches, auto-expand the parent!
  const isCategoryExpanded = (catId: string) => {
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      const subcategories = categories.filter((c) => c.parent_id === catId);
      const hasMatchingSub = subcategories.some((sub) => sub.name.toLowerCase().includes(q));
      if (hasMatchingSub) return true;
    }
    return Boolean(expandedParents[catId]);
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    parentCategories.forEach((p) => {
      allExpanded[p.id] = true;
    });
    setExpandedParents(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedParents({});
  };

  return (
    <div>
      {/* Page Header */}
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Categories</h2>
          <p className="acc-subtitle">Organize your income and expenses.</p>
        </div>

        <div className="acc-header-actions">
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
      </div>

      {/* Success Notification Banner */}
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

      {/* Search & Filter Bar */}
      <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          {/* Search Box */}
          <div style={{ flex: "1 1 240px", position: "relative" }}>
            <input
              type="text"
              className="acc-form-input"
              placeholder="Search categories & subcategories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingRight: searchTerm ? "2rem" : "0.75rem" }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--acc-text-muted)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  padding: "0.25rem",
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className={`acc-btn acc-btn-sm ${typeFilter === "ALL" ? "acc-btn-primary" : "acc-btn-outline"}`}
              onClick={() => setTypeFilter("ALL")}
            >
              All ({parentCategories.length})
            </button>
            <button
              type="button"
              className={`acc-btn acc-btn-sm ${typeFilter === "INCOME" ? "acc-btn-primary" : "acc-btn-outline"}`}
              onClick={() => setTypeFilter("INCOME")}
            >
              Income ({parentCategories.filter((c) => c.type === "INCOME").length})
            </button>
            <button
              type="button"
              className={`acc-btn acc-btn-sm ${typeFilter === "EXPENSE" ? "acc-btn-primary" : "acc-btn-outline"}`}
              onClick={() => setTypeFilter("EXPENSE")}
            >
              Expense ({parentCategories.filter((c) => c.type === "EXPENSE").length})
            </button>

            {/* Quick Expand / Collapse All */}
            <div style={{ display: "flex", gap: "0.25rem", marginLeft: "0.5rem" }}>
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                onClick={handleExpandAll}
                title="Expand all categories"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              >
                Expand all
              </button>
              <button
                type="button"
                className="acc-btn acc-btn-outline acc-btn-sm"
                onClick={handleCollapseAll}
                title="Collapse all categories"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              >
                Collapse all
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Hierarchy List */}
      <div className="acc-card">
        {filteredParents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            {searchTerm || typeFilter !== "ALL" ? (
              <p style={{ margin: "0 0 1rem 0" }}>No categories match your search and filter criteria.</p>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredParents.map((mainCat) => {
              const allSubs = categories.filter((c) => c.parent_id === mainCat.id);
              const q = searchTerm.trim().toLowerCase();
              const subcategories = q
                ? allSubs.filter((sub) => sub.name.toLowerCase().includes(q))
                : allSubs;
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
                        }}
                      >
                        {allSubs.length} {allSubs.length === 1 ? "subcategory" : "subcategories"}
                      </span>

                      {mainCat.is_archived && (
                        <span className="acc-badge acc-badge-danger" style={{ fontSize: "0.68rem" }}>
                          Archived
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    {canMutate && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <button
                          type="button"
                          className="acc-btn acc-btn-primary acc-btn-sm"
                          style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
                          onClick={() => openAddSubcategory(mainCat)}
                        >
                          + Subcategory
                        </button>
                        <button
                          type="button"
                          className="acc-btn acc-btn-outline acc-btn-sm"
                          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                          onClick={() => openEditCategory(mainCat)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`acc-btn acc-btn-sm ${mainCat.is_archived ? "acc-btn-outline" : "acc-btn-outline"}`}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.25rem 0.5rem",
                            color: mainCat.is_archived ? "var(--acc-success)" : "var(--acc-danger)",
                          }}
                          onClick={() => handleToggleArchive(mainCat.id, mainCat.is_archived)}
                        >
                          {mainCat.is_archived ? "Restore" : "Archive"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded Subcategories Panel */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: "0.5rem 1rem 0.875rem 2.25rem",
                        backgroundColor: "var(--acc-surface)",
                        borderTop: "1px solid var(--acc-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      {allSubs.length === 0 ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.75rem 0",
                            color: "var(--acc-text-muted)",
                            fontSize: "0.8125rem",
                          }}
                        >
                          <span>No subcategories yet under {mainCat.name}.</span>
                          {canMutate && (
                            <button
                              type="button"
                              className="acc-btn acc-btn-outline acc-btn-sm"
                              style={{ fontSize: "0.72rem" }}
                              onClick={() => openAddSubcategory(mainCat)}
                            >
                              + Add First Subcategory
                            </button>
                          )}
                        </div>
                      ) : subcategories.length === 0 ? (
                        <div style={{ padding: "0.5rem 0", color: "var(--acc-text-muted)", fontSize: "0.8125rem" }}>
                          No subcategories matching &quot;{searchTerm}&quot;.
                        </div>
                      ) : (
                        subcategories.map((sub) => (
                          <div
                            key={sub.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "6px",
                              backgroundColor: "var(--acc-raised)",
                              border: "1px solid var(--acc-border-light)",
                              opacity: sub.is_archived ? 0.6 : 1,
                              gap: "0.5rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                              <span style={{ color: "var(--acc-text-muted)", fontSize: "0.85rem", lineHeight: 1 }}>↳</span>
                              <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--acc-text-main)", wordBreak: "break-word" }}>
                                {sub.name}
                              </span>
                              <span className={`acc-badge ${sub.type === "INCOME" ? "acc-badge-success" : "acc-badge-neutral"}`} style={{ fontSize: "0.68rem" }}>
                                {sub.type}
                              </span>
                              {sub.is_archived && (
                                <span className="acc-badge acc-badge-danger" style={{ fontSize: "0.65rem" }}>
                                  Archived
                                </span>
                              )}
                            </div>

                            {canMutate && (
                              <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-outline acc-btn-sm"
                                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.45rem" }}
                                  onClick={() => openEditCategory(sub)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="acc-btn acc-btn-outline acc-btn-sm"
                                  style={{
                                    fontSize: "0.72rem",
                                    padding: "0.2rem 0.45rem",
                                    color: sub.is_archived ? "var(--acc-success)" : "var(--acc-danger)",
                                  }}
                                  onClick={() => handleToggleArchive(sub.id, sub.is_archived)}
                                >
                                  {sub.is_archived ? "Restore" : "Archive"}
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Main Category Modal */}
      {addCatOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddCatOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Add Main Category</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setAddCatOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {catError && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {catError}
              </div>
            )}
            <form onSubmit={handleCreateCategory}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="cat-name">
                  Category Name *
                </label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Office Expenses, Software Subscriptions, Consulting"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label">Classification Type *</label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>
                    <input
                      type="radio"
                      name="catType"
                      value="EXPENSE"
                      checked={catType === "EXPENSE"}
                      onChange={() => setCatType("EXPENSE")}
                    />
                    <span>Expense</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>
                    <input
                      type="radio"
                      name="catType"
                      value="INCOME"
                      checked={catType === "INCOME"}
                      onChange={() => setCatType("INCOME")}
                    />
                    <span>Income</span>
                  </label>
                </div>
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
                  {submittingCat ? "Creating..." : "Create Category"}
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
              <h3 className="acc-modal-title">
                Add Subcategory under &quot;{activeParentCat.name}&quot;
              </h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setAddSubCatOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {subCatError && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {subCatError}
              </div>
            )}
            <form onSubmit={handleCreateSubcategory}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="subcat-name">
                  Subcategory Name *
                </label>
                <input
                  id="subcat-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder={`e.g. Under ${activeParentCat.name}: Flight Tickets, Team Lunch, Server Hosting`}
                  value={subCatName}
                  onChange={(e) => setSubCatName(e.target.value)}
                />
              </div>

              <div style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", marginBottom: "1rem" }}>
                Type: <strong>{activeParentCat.type}</strong> (inherited from parent category)
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
                  {submittingSubCat ? "Adding..." : "Add Subcategory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editCatOpen && editingCat && (
        <div className="acc-modal-backdrop" onClick={() => setEditCatOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">
                Edit {editingCat.parent_id ? "Subcategory" : "Category"}
              </h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setEditCatOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {editCatError && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {editCatError}
              </div>
            )}
            <form onSubmit={handleEditCategory}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-cat-name">
                  Name *
                </label>
                <input
                  id="edit-cat-name"
                  type="text"
                  required
                  className="acc-form-input"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                />
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
                  {submittingEditCat ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
