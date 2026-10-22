"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAccounting } from "./AccountingContext";
import FormattedMoneyInput from "../ui/FormattedMoneyInput";

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  unit: string;
  default_price_minor: number;
  is_active?: boolean;
}

export default function ProductsView() {
  const { activeWorkspace, formatMoney, refreshKey, triggerRefresh, canMutate } = useAccounting();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [prodName, setProdName] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodPriceStr, setProdPriceStr] = useState("");
  const [prodUnit, setProdUnit] = useState("unit");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch products
  useEffect(() => {
    if (!activeWorkspace) return;
    let isMounted = true;

    async function loadProducts() {
      try {
        setLoading(true);
        const res = await fetch(`/api/accounting/products?workspaceId=${activeWorkspace?.id}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Failed to load products catalog:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, [activeWorkspace, refreshKey]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.unit && p.unit.toLowerCase().includes(q))
    );
  }, [products, searchTerm]);

  // Open Edit Product
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdSku(p.sku || "");
    setProdPriceStr((p.default_price_minor / 100).toFixed(2));
    setProdUnit(p.unit || "unit");
    setErrorMsg(null);
    setEditProductOpen(true);
  };

  // Submit Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(prodPriceStr) || 0;
    if (!prodName.trim() || !activeWorkspace) return;

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/accounting/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: prodName.trim(),
          sku: prodSku.trim() || undefined,
          defaultPriceMinor: Math.round(price * 100),
          unit: prodUnit.trim() || "unit",
        }),
      });

      const data = await res.json();
      if (res.ok && data.product) {
        setProducts((prev) => [data.product, ...prev]);
        setAddProductOpen(false);
        setProdName("");
        setProdSku("");
        setProdPriceStr("");
        setProdUnit("unit");
        setSuccessToast(`Product "${data.product.name}" added to catalog.`);
        triggerRefresh();
      } else {
        setErrorMsg(data.error || "Failed to create product");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network request failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Product
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !activeWorkspace || !prodName.trim()) return;

    const price = parseFloat(prodPriceStr) || 0;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/accounting/products/${editingProduct.id}?workspaceId=${activeWorkspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          name: prodName.trim(),
          sku: prodSku.trim() || null,
          defaultPriceMinor: Math.round(price * 100),
          unit: prodUnit.trim() || "unit",
        }),
      });

      const data = await res.json();
      if (res.ok && data.product) {
        setProducts((prev) => prev.map((p) => (p.id === data.product.id ? data.product : p)));
        setEditProductOpen(false);
        setEditingProduct(null);
        setSuccessToast(`Product "${data.product.name}" updated successfully.`);
        triggerRefresh();
      } else {
        setErrorMsg(data.error || "Failed to update product");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network request failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Archive Product
  const handleArchiveProduct = async (productId: string, productName: string) => {
    if (!activeWorkspace) return;
    if (!confirm(`Are you sure you want to archive "${productName}"? It will no longer appear in new invoice item selectors.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/accounting/products/${productId}?workspaceId=${activeWorkspace.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        setSuccessToast(`Product "${productName}" archived.`);
        triggerRefresh();
      } else {
        alert("Failed to archive product.");
      }
    } catch (err) {
      alert("Network error archiving product.");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="acc-header">
        <div className="acc-title-group">
          <h2 className="acc-title">Products & Services</h2>
          <p className="acc-subtitle">Manage the items and services you sell.</p>
        </div>

        <div className="acc-header-actions">
          {canMutate && (
            <button
              type="button"
              className="acc-btn acc-btn-primary acc-btn-sm"
              onClick={() => {
                setProdName("");
                setProdSku("");
                setProdPriceStr("");
                setProdUnit("unit");
                setErrorMsg(null);
                setAddProductOpen(true);
              }}
            >
              + Add Product / Service
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div
          className="acc-alert acc-alert-success"
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
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

      {/* Search Bar */}
      <div className="acc-card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
            <input
              type="text"
              className="acc-form-input"
              placeholder="Search products or services by name, SKU..."
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
          <span style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)", whiteSpace: "nowrap" }}>
            Total Items: <strong>{filteredProducts.length}</strong>
          </span>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="acc-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            Loading products catalog...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--acc-text-muted)" }}>
            {searchTerm ? (
              <p style={{ margin: "0 0 1rem 0" }}>No products or services match &quot;{searchTerm}&quot;.</p>
            ) : (
              <>
                <p style={{ margin: "0 0 1rem 0" }}>No products or services saved. Add your catalog items here.</p>
                {canMutate && (
                  <button
                    type="button"
                    className="acc-btn acc-btn-primary acc-btn-sm"
                    onClick={() => {
                      setProdName("");
                      setProdSku("");
                      setProdPriceStr("");
                      setProdUnit("unit");
                      setErrorMsg(null);
                      setAddProductOpen(true);
                    }}
                  >
                    + Add Product / Service
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="acc-table-wrapper">
            <table className="acc-table">
              <thead>
                <tr>
                  <th>Product / Service Name</th>
                  <th>SKU</th>
                  <th>Unit</th>
                  <th className="acc-align-right">Default Price</th>
                  {canMutate && <th className="acc-align-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--acc-text-muted)" }}>{p.sku || "—"}</td>
                    <td>{p.unit}</td>
                    <td className="acc-align-right tabular-nums font-semibold">
                      {formatMoney(p.default_price_minor, activeWorkspace?.currency)}
                    </td>
                    {canMutate && (
                      <td className="acc-align-right">
                        <div style={{ display: "inline-flex", gap: "0.375rem" }}>
                          <button
                            type="button"
                            className="acc-btn acc-btn-outline acc-btn-sm"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => openEditModal(p)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="acc-btn acc-btn-outline acc-btn-sm"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", color: "var(--acc-danger)" }}
                            onClick={() => handleArchiveProduct(p.id, p.name)}
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {addProductOpen && (
        <div className="acc-modal-backdrop" onClick={() => setAddProductOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Add Product / Service</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setAddProductOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {errorMsg && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleAddProduct}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-name">
                  Item Name *
                </label>
                <input
                  id="prod-name"
                  type="text"
                  required
                  className="acc-form-input"
                  placeholder="e.g. Website Development, Standard Consultation, NFC Card Pack"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-sku">
                  SKU / Code
                </label>
                <input
                  id="prod-sku"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. SRV-001, PRD-NFC-02"
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-price">
                  Default Price ({activeWorkspace?.currency || "₹"})
                </label>
                <FormattedMoneyInput
                  id="prod-price"
                  className="acc-form-input tabular-nums"
                  placeholder="0.00"
                  value={prodPriceStr}
                  onChange={(e) => setProdPriceStr(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="prod-unit">
                  Billing Unit
                </label>
                <input
                  id="prod-unit"
                  type="text"
                  className="acc-form-input"
                  placeholder="e.g. unit, hour, project, month, pcs"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setAddProductOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProductOpen && editingProduct && (
        <div className="acc-modal-backdrop" onClick={() => setEditProductOpen(false)}>
          <div className="acc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="acc-modal-header">
              <h3 className="acc-modal-title">Edit Product / Service</h3>
              <button
                type="button"
                className="acc-modal-close"
                onClick={() => setEditProductOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {errorMsg && (
              <div className="acc-alert acc-alert-danger" style={{ marginBottom: "1rem" }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleEditProduct}>
              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-prod-name">
                  Item Name *
                </label>
                <input
                  id="edit-prod-name"
                  type="text"
                  required
                  className="acc-form-input"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-prod-sku">
                  SKU / Code
                </label>
                <input
                  id="edit-prod-sku"
                  type="text"
                  className="acc-form-input"
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                />
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-prod-price">
                  Default Price ({activeWorkspace?.currency || "₹"})
                </label>
                <FormattedMoneyInput
                  id="edit-prod-price"
                  className="acc-form-input tabular-nums"
                  value={prodPriceStr}
                  onChange={(e) => setProdPriceStr(e.target.value)}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--acc-text-muted)", marginTop: "0.25rem", display: "block" }}>
                  Note: Updating price only applies to future invoices. Previously issued invoices are preserved.
                </span>
              </div>

              <div className="acc-form-group">
                <label className="acc-form-label" htmlFor="edit-prod-unit">
                  Billing Unit
                </label>
                <input
                  id="edit-prod-unit"
                  type="text"
                  className="acc-form-input"
                  value={prodUnit}
                  onChange={(e) => setProdUnit(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="acc-btn acc-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setEditProductOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="acc-btn acc-btn-primary"
                  style={{ flex: 1.5 }}
                  disabled={submitting}
                >
                  {submitting ? "Updating..." : "Update Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
