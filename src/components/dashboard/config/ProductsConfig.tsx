"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

export interface ProductItem {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  description?: string;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  soldCount?: number;
}

const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: "prod-1",
    name: "MyLux Executive Gold Card",
    code: "EXEC-GOLD",
    category: "NFC Cards",
    price: 4999,
    description: "Premium 24k gold-finished physical NFC smart business card",
    status: "ACTIVE",
    createdBy: "System",
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-08-30T14:22:00.000Z",
    soldCount: 142,
  },
  {
    id: "prod-2",
    name: "MyLux Black Metal Card",
    code: "MET-BLK",
    category: "NFC Cards",
    price: 7999,
    description: "Matte black stainless steel engraved NFC card with dual chip",
    status: "ACTIVE",
    createdBy: "System",
    createdAt: "2026-07-05T11:30:00.000Z",
    updatedAt: "2026-08-29T18:10:00.000Z",
    soldCount: 98,
  },
  {
    id: "prod-3",
    name: "Digital Profile Pro (Annual)",
    code: "DIG-PRO",
    category: "Software",
    price: 2499,
    description: "Annual subscription for custom domain, analytics, and CRM sync",
    status: "ACTIVE",
    createdBy: "Muhammed Febin",
    createdAt: "2026-07-10T14:15:00.000Z",
    updatedAt: "2026-08-28T16:05:00.000Z",
    soldCount: 310,
  },
  {
    id: "prod-4",
    name: "Custom Branded QR Badge",
    code: "QR-BADGE",
    category: "Accessories",
    price: 1499,
    description: "Laminated acrylic desk badge with dynamic QR code",
    status: "ACTIVE",
    createdBy: "Muhammed Febin",
    createdAt: "2026-07-15T09:20:00.000Z",
    updatedAt: "2026-08-25T11:40:00.000Z",
    soldCount: 75,
  },
  {
    id: "prod-5",
    name: "Vehicle Connect NFC Tag",
    code: "VEH-TAG",
    category: "Accessories",
    price: 999,
    description: "Weatherproof windshield/dashboard NFC sticker tag",
    status: "ACTIVE",
    createdBy: "Muhammed Febin",
    createdAt: "2026-07-20T16:45:00.000Z",
    updatedAt: "2026-08-24T09:15:00.000Z",
    soldCount: 64,
  },
  {
    id: "prod-6",
    name: "Product A",
    code: "ABC001",
    category: "Business Card",
    price: 2223,
    description: "Standard premium digital NFC business card product",
    status: "ACTIVE",
    createdBy: "Muhammed Febin",
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T14:30:00.000Z",
    soldCount: 12,
  },
  {
    id: "prod-7",
    name: "Legacy Eco Bamboo Card",
    code: "ECO-BAM",
    category: "NFC Cards",
    price: 3499,
    description: "Sustainable natural bamboo wood NFC card",
    status: "INACTIVE",
    createdBy: "System",
    createdAt: "2026-08-01T08:20:00.000Z",
    updatedAt: "2026-08-20T13:30:00.000Z",
    soldCount: 18,
  },
];

const LOCAL_STORAGE_KEY = "myluxcards_products_catalog_v1";

const CATEGORY_OPTIONS = ["NFC Cards", "Business Card", "Software", "Accessories", "Custom Hardware"];

export function ProductsConfig() {
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal & Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "NFC Cards",
    price: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    description: "",
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProducts(parsed);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage when products change
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
    } catch {
      // Ignore storage errors
    }
  }, [products, isLoaded]);

  // Debounce search query (250ms–350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Status Filter
      if (statusFilter === "ACTIVE" && prod.status !== "ACTIVE") return false;
      if (statusFilter === "INACTIVE" && prod.status !== "INACTIVE") return false;

      // Search Query Filter
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchName = prod.name.toLowerCase().includes(q);
        const matchCode = prod.code ? prod.code.toLowerCase().includes(q) : false;
        const matchCategory = prod.category.toLowerCase().includes(q);
        const matchDesc = prod.description ? prod.description.toLowerCase().includes(q) : false;
        return matchName || matchCode || matchCategory || matchDesc;
      }

      return true;
    });
  }, [products, statusFilter, debouncedSearch]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Reset page on search/filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      code: "",
      category: "",
      price: "",
      status: "ACTIVE",
      description: "",
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const handleOpenEdit = (prod: ProductItem) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      code: prod.code || "",
      category: prod.category || "NFC Cards",
      price: String(prod.price),
      status: prod.status,
      description: prod.description || "",
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const handleToggleStatus = (id: string) => {
    const now = new Date().toISOString();
    setProducts((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
              updatedAt: now,
            }
          : item
      )
    );
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validations
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError("Product Name is required.");
      return;
    }

    const numericPrice = parseFloat(formData.price.replaceAll(/[^0-9.]/g, ""));
    if (isNaN(numericPrice) || numericPrice < 0) {
      setFormError("Please enter a valid Unit Price.");
      return;
    }

    const trimmedCode = formData.code.trim().toUpperCase();
    if (trimmedCode) {
      // Check code uniqueness
      const exists = products.some(
        (p) => p.code.toUpperCase() === trimmedCode && p.id !== editingProduct?.id
      );
      if (exists) {
        setFormError(`Product Code "${trimmedCode}" already exists. Please use a unique code.`);
        return;
      }
    }

    setIsSaving(true);

    setTimeout(() => {
      const now = new Date().toISOString();

      if (editingProduct) {
        // Edit existing product
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== editingProduct.id) return p;
            return {
              ...p,
              name: trimmedName,
              code: trimmedCode || p.code,
              category: formData.category,
              price: numericPrice,
              status: formData.status,
              description: formData.description.trim() || undefined,
              updatedAt: now,
            };
          })
        );
      } else {
        // Create new product
        const autoCode =
          trimmedCode ||
          trimmedName.replaceAll(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase() ||
          "PROD";

        const newProd: ProductItem = {
          id: `prod-${Date.now()}`,
          name: trimmedName,
          code: autoCode,
          category: formData.category,
          price: numericPrice,
          description: formData.description.trim() || undefined,
          status: formData.status,
          createdBy: "Muhammed Febin",
          createdAt: now,
          updatedAt: now,
          soldCount: 0,
        };

        setProducts((prev) => [newProd, ...prev]);
      }

      setIsSaving(false);
      setIsFormOpen(false);
    }, 200);
  };

  const handleConfirmDelete = () => {
    if (!deletingProduct) return;
    setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
    setDeletingProduct(null);
  };

  // Currency formatting helper
  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `₹${amount.toLocaleString()}`;
    }
  };

  // Date formatting helpers
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return isoStr;
    }
  };

  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return `${datePart} • ${timePart}`;
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 1400, margin: "0 auto", paddingBottom: 40 }}>
      {/* 1. PAGE HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          padding: "24px 28px",
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            MASTER CONFIGURATION
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#FFF", margin: "4px 0 2px", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
            Products
          </h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>
            Manage selectable products and price snapshots for Lead totals.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 44,
            padding: "0 22px",
            fontSize: 13,
            fontWeight: 800,
            color: "#07080B",
            background: "#0066FF",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0, 229, 255, 0.3)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#E6C200";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#0066FF";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <Plus style={{ width: 18, height: 18, strokeWidth: 3 }} />
          Add Product
        </button>
      </div>

      {/* 2. MAIN PRODUCTS MANAGEMENT CARD */}
      <div
        style={{
          background: "#12131A",
          border: "1px solid rgba(0, 229, 255, 0.18)",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 8px 28px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* SEARCH & FILTER TOOLBAR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Search Box */}
          <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
            <Search
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 16,
                height: 16,
                color: "#0066FF",
              }}
            />
            <input
              type="text"
              placeholder="Search products, code, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                height: 44,
                paddingLeft: 42,
                paddingRight: 16,
                background: "#181924",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 10,
                color: "#FFFFFF",
                fontSize: 13,
                outline: "none",
                transition: "all 0.2s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(0, 229, 255, 0.6)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.1)")}
            />
          </div>

          {/* Status Filter Dropdown / Control */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                height: 44,
                padding: "0 16px",
                background: "#181924",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 10,
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* PRODUCTS DATA TABLE */}
        {filteredProducts.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="products-desktop-table" style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 920 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", height: 48, background: "#181924" }}>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      PRODUCT NAME
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      PRODUCT CODE
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CATEGORY
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      UNIT PRICE
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      STATUS
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      CREATED DATE
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      UPDATED DATE
                    </th>
                    <th style={{ padding: "12px 18px", fontSize: 11, fontWeight: 700, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((prod) => (
                    <tr
                      key={prod.id}
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        height: 68,
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Name & Description */}
                      <td style={{ padding: "14px 18px" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                            {prod.name}
                          </div>
                          {prod.description && (
                            <div style={{ fontSize: 11, color: "#8E8EA0", marginTop: 2, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {prod.description}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Product Code */}
                      <td style={{ padding: "14px 18px" }}>
                        {prod.code ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#0066FF",
                              background: "rgba(0, 229, 255, 0.1)",
                              border: "1px solid rgba(0, 229, 255, 0.25)",
                              padding: "3px 9px",
                              borderRadius: 6,
                              fontFamily: "monospace",
                            }}
                          >
                            {prod.code}
                          </span>
                        ) : (
                          <span style={{ color: "#64748B" }}>—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: "14px 18px", fontSize: 13, color: "#CBD5E1" }}>
                        {prod.category || "—"}
                      </td>

                      {/* Unit Price */}
                      <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 800, color: "#0066FF" }}>
                        {formatCurrency(prod.price)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {prod.status === "ACTIVE" ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: 20,
                              background: "rgba(16, 185, 129, 0.12)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              color: "#10B981",
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                            ACTIVE
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "4px 12px",
                              borderRadius: 20,
                              background: "rgba(255, 255, 255, 0.06)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              color: "#94A3B8",
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94A3B8" }} />
                            INACTIVE
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: "14px 18px", fontSize: 12, color: "#94A3B8" }}>
                        {formatDate(prod.createdAt)}
                      </td>

                      {/* Updated Date */}
                      <td style={{ padding: "14px 18px", fontSize: 12, color: "#94A3B8" }}>
                        {formatDateTime(prod.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            title="Edit Product"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#181924",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: 8,
                              color: "#E2E8F0",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.4)")}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)")}
                          >
                            <Edit2 style={{ width: 13, height: 13, color: "#0066FF" }} />
                            Edit
                          </button>

                          {/* Activate / Deactivate Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(prod.id)}
                            title={prod.status === "ACTIVE" ? "Deactivate Product" : "Activate Product"}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: prod.status === "ACTIVE" ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                              border: prod.status === "ACTIVE" ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)",
                              borderRadius: 8,
                              color: prod.status === "ACTIVE" ? "#F87171" : "#34D399",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <Power style={{ width: 13, height: 13 }} />
                            {prod.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(prod)}
                            title="Delete Product"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 32,
                              height: 32,
                              background: "#181924",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: 8,
                              color: "#94A3B8",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#EF4444";
                              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#94A3B8";
                              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                            }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards (Visible on screens < 768px) */}
            <div className="products-mobile-cards" style={{ display: "none", flexDirection: "column", gap: 14 }}>
              {paginatedProducts.map((prod) => (
                <div
                  key={`mobile-${prod.id}`}
                  style={{
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 14,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>{prod.name}</div>
                      {prod.code && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", background: "rgba(0, 229, 255,0.1)", padding: "2px 6px", borderRadius: 4, marginTop: 4, display: "inline-block" }}>
                          CODE: {prod.code}
                        </span>
                      )}
                    </div>

                    {prod.status === "ACTIVE" ? (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#10B981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 20 }}>
                        ACTIVE
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "2px 8px", borderRadius: 20 }}>
                        INACTIVE
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: "#94A3B8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>Category: <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{prod.category}</span></div>
                    <div>Price: <span style={{ color: "#0066FF", fontWeight: 800 }}>{formatCurrency(prod.price)}</span></div>
                    <div>Created: <span style={{ color: "#E2E8F0" }}>{formatDate(prod.createdAt)}</span></div>
                    <div>Updated: <span style={{ color: "#E2E8F0" }}>{formatDate(prod.updatedAt)}</span></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(prod)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#FFF", cursor: "pointer" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(prod.id)}
                      style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, background: prod.status === "ACTIVE" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: "none", borderRadius: 8, color: prod.status === "ACTIVE" ? "#F87171" : "#34D399", cursor: "pointer" }}
                    >
                      {prod.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingProduct(prod)}
                      style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, background: "#12131A", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#EF4444", cursor: "pointer" }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255, 255, 255, 0.06)", fontSize: 12, color: "#94A3B8" }}>
              <div>
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 8,
                    color: currentPage === 1 ? "#475569" : "#E2E8F0",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                  Prev
                </button>

                <span style={{ fontSize: 12, fontWeight: 700, color: "#0066FF", padding: "0 4px" }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 8,
                    color: currentPage === totalPages ? "#475569" : "#E2E8F0",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* EMPTY STATE */
          <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.2)", color: "#0066FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Filter style={{ width: 24, height: 24 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>
              No Products Match Your Search
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, maxWidth: 380 }}>
              We couldn't find any products matching your current filter criteria. Try clearing your search query or status filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              style={{
                marginTop: 8,
                padding: "8px 18px",
                fontSize: 12,
                fontWeight: 700,
                background: "#181924",
                border: "1px solid rgba(0, 229, 255, 0.3)",
                borderRadius: 8,
                color: "#0066FF",
                cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* ADD / EDIT PRODUCT MODAL (Matching 2-Column Reference Layout) */}
      {isFormOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setIsFormOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#12131A",
              border: "1px solid rgba(0, 229, 255, 0.3)",
              borderRadius: 18,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "22px 28px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "#161722",
              }}
            >
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#0066FF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  MASTER CONFIGURATION
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#FFF", margin: "2px 0 0" }}>
                  {editingProduct ? "Edit Product" : "Add Product"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                style={{
                  background: "#181924",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  color: "#94A3B8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProduct} style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Validation Error Banner */}
              {formError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#F87171",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {formError}
                </div>
              )}

              {/* 2-Column Form Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 18,
                }}
              >
                {/* Row 1, Left: Product Name */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Executive Gold Card"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: "100%",
                      height: 46,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 13,
                      outline: "none",
                    }}
                    required
                  />
                </div>

                {/* Row 1, Right: Product Code */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    Product Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EXEC-GOLD"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    style={{
                      width: "100%",
                      height: 46,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 13,
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                </div>

                {/* Row 2, Left: Category */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NFC Cards"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: "100%",
                      height: 46,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>

                {/* Row 2, Right: Unit Price */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    Unit Price (₹) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 4999"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={{
                      width: "100%",
                      height: 46,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 13,
                      outline: "none",
                    }}
                    required
                  />
                </div>

                {/* Row 3, Left: Status */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    style={{
                      width: "100%",
                      height: 46,
                      padding: "0 14px",
                      background: "#181924",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#FFFFFF",
                      fontSize: 13,
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Description (Full Width) */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#CBD5E1", marginBottom: 6 }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter product description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "#181924",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    color: "#FFFFFF",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    minHeight: 80,
                  }}
                />
              </div>

              {/* Modal Footer Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  paddingTop: 14,
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 9,
                    background: "#181924",
                    color: "#CBD5E1",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: "10px 24px",
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 9,
                    background: "#0066FF",
                    color: "#07080B",
                    border: "none",
                    cursor: isSaving ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(0, 229, 255, 0.25)",
                  }}
                >
                  {isSaving ? "Saving..." : editingProduct ? "Save Changes" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setDeletingProduct(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#12131A",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              padding: 26,
              borderRadius: 18,
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle style={{ width: 22, height: 22 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#FFF", margin: 0 }}>Delete Product?</h3>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{deletingProduct.name}</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, margin: "0 0 20px" }}>
              Are you sure you want to permanently remove <strong>"{deletingProduct.name}"</strong>? This action cannot be undone.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                style={{ padding: "10px 18px", fontSize: 12, fontWeight: 600, borderRadius: 9, background: "#181924", color: "#CBD5E1", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{ padding: "10px 20px", fontSize: 12, fontWeight: 800, borderRadius: 9, background: "#EF4444", color: "#FFF", border: "none", cursor: "pointer" }}
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Mobile Responsiveness */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .products-desktop-table {
            display: none !important;
          }
          .products-mobile-cards {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
