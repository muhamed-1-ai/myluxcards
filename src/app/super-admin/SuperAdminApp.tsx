"use client";

import { useCallback, useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import type { AdminIdentity } from "@/lib/adminAuth";
import { buildPremiumQrSvg, svgToHighResPngBlob } from "@/lib/premiumQr";
import ShipOrderWorkspace from "@/components/super-admin/ShipOrderWorkspace";
import PackingMode from "@/components/super-admin/PackingMode";
import ShippingMode from "@/components/super-admin/ShippingMode";
import JSZip from "jszip";
import { DashboardBackgroundDecor } from "@/components/dashboard/DashboardBackgroundDecor";
import {
  LayoutDashboard,
  Users,
  Truck,
  ShieldAlert,
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  RefreshCw,
  Search,
  Download,
  PackageCheck,
  ClipboardList,
  CheckCircle,
} from "lucide-react";

type Section = "overview" | "users" | "fulfillment" | "audit" | "settings";

const sectionLabels: Record<Section, string> = {
  overview: "Platform Overview",
  users: "Users & QR Directory",
  fulfillment: "Fulfillment Command Center",
  audit: "Audit Logs",
  settings: "Platform Settings",
};

export default function SuperAdminApp({
  identity,
  initialSection,
  initialMode,
  initialOrderId,
}: {
  identity: AdminIdentity;
  initialSection?: Section;
  initialMode?: "all" | "packing" | "shipping";
  initialOrderId?: string;
}) {
  const [section, setSection] = useState<Section>(() => {
    if (initialSection) return initialSection;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const s = p.get("section") || p.get("tab");
      if (s === "fulfillment" || s === "shipping" || s === "courier_shipping" || p.get("mode") || p.get("orderId") || p.get("shipOrderId")) {
        return "fulfillment";
      }
      if (s === "users" || s === "audit" || s === "settings") {
        return s;
      }
    }
    return "overview";
  });
  const [mobile, setMobile] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [activeRailTip, setActiveRailTip] = useState<{ text: string; top: number } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isReloading, setIsReloading] = useState(false);

  // Sync theme with existing dashboard localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("zappit_theme") as "dark" | "light" | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
      if (savedTheme === "light") {
        document.body.classList.add("light-mode");
        document.body.classList.remove("dark-mode");
      } else {
        document.body.classList.add("dark-mode");
        document.body.classList.remove("light-mode");
      }
    }
    const savedSidebar = localStorage.getItem("zappit_sidebar_collapsed");
    if (savedSidebar === "true") setDesktopCollapsed(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("zappit_theme", next);
    document.documentElement.setAttribute("data-theme", next);
    if (next === "light") {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    } else {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    }
  };

  const toggleDesktopSidebar = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("zappit_sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobile) {
        setMobile(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobile]);

  // Users State (Server-side paginated)
  const [users, setUsers] = useState<any[]>([]);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [userStatusFilter, setUserStatusFilter] = useState("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Drawers & Modals
  const [qrModalUser, setQrModalUser] = useState<any | null>(null);
  const [userDrawerData, setUserDrawerData] = useState<any | null>(null);
  const [userDrawerLoading, setUserDrawerLoading] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<any | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);

  // Fulfillment State
  const [fulfillmentData, setFulfillmentData] = useState<any | null>(null);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);
  const [selectedOrderIdForShip, setSelectedOrderIdForShip] = useState<string | null>(() => {
    if (initialOrderId) return initialOrderId;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const o = p.get("orderId") || p.get("shipOrderId");
      if (o) return o;
    }
    return null;
  });
  const [fulfillmentMode, setFulfillmentMode] = useState<"all" | "packing" | "shipping">(() => {
    if (initialMode) return initialMode;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const m = p.get("mode");
      if (m === "shipping" || m === "packing" || m === "all") return m;
      const s = p.get("section") || p.get("tab");
      if (s === "shipping" || s === "courier_shipping") return "shipping";
    }
    return "all";
  });
  const [pipelineFilter, setPipelineFilter] = useState<string>("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Audit Logs & General Overview
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [overviewStats, setOverviewStats] = useState<any>({ totalAccounts: 0, admins: 0, activeUsers: 0 });
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");

  // Load Users (Server-side paginated & searchable)
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const query = new URLSearchParams({
        page: userPagination.page.toString(),
        limit: userPagination.limit.toString(),
        search: userSearch,
        role: userRoleFilter,
        status: userStatusFilter,
      });

      const res = await fetch(`/api/super-admin/users?${query.toString()}`, { cache: "no-store" });
      if (res.status === 403) {
        window.location.replace("/forbidden");
        return;
      }
      if (!res.ok) throw new Error("Failed to load users");
      const json = await res.json();
      setUsers(json.data || []);
      setUserPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (e: any) {
      setError(e.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, [userPagination.page, userPagination.limit, userSearch, userRoleFilter, userStatusFilter]);

  // Load Fulfillment Center Overview
  const loadFulfillment = useCallback(async () => {
    setFulfillmentLoading(true);
    try {
      const res = await fetch("/api/super-admin/fulfillment", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load fulfillment data");
      const json = await res.json();
      setFulfillmentData(json);
    } catch (e: any) {
      console.error(e);
    } finally {
      setFulfillmentLoading(false);
    }
  }, []);

  // Initial Overview & Audit load
  const loadOverviewAndAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/admins", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.auditLogs || []);
        const all = data.users || [];
        setOverviewStats({
          totalAccounts: all.length,
          admins: all.filter((u: any) => u.role === "ADMIN" || u.role === "SUPER_ADMIN").length,
          activeUsers: all.filter((u: any) => u.status === "ACTIVE" && u.role === "USER").length,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadOverviewAndAudit();
  }, [loadOverviewAndAudit]);

  useEffect(() => {
    if (section === "users") {
      loadUsers();
    } else if (section === "fulfillment") {
      loadFulfillment();
    }
  }, [section, loadUsers, loadFulfillment]);

  // Open User Details Drawer
  const openUserDetails = async (userId: string) => {
    setUserDrawerLoading(true);
    setUserDrawerData(null);
    try {
      const res = await fetch(`/api/super-admin/users/${userId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load user details");
      const json = await res.json();
      setUserDrawerData(json);
    } catch (e: any) {
      alert(e.message || "Failed to load details");
    } finally {
      setUserDrawerLoading(false);
    }
  };

  // Update Role / Status
  const updateUserRole = async (userId: string, newRole: string, status?: string) => {
    setRoleUpdating(true);
    try {
      const res = await fetch("/api/super-admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update role");
      alert(data.message);
      setRoleModalUser(null);
      await loadUsers();
      await loadOverviewAndAudit();
    } catch (e: any) {
      alert(e.message || "Role update failed");
    } finally {
      setRoleUpdating(false);
    }
  };

  // Download Single User QR Code
  const downloadUserQr = async (user: any, format: "png" | "svg") => {
    if (!user?.qrUrl) return;
    const svgString = buildPremiumQrSvg(user.qrUrl, { label: "3G ZAPPIT" });
    const sanitizedName = (user.name || "user").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const filename = `zappit-qr-${sanitizedName}.${format}`;

    if (format === "svg") {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = await svgToHighResPngBlob(svgString, 1500);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Export Selected Users' QR Codes as ZIP
  const exportSelectedQrsZip = async () => {
    if (selectedUserIds.length === 0) return;
    const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));
    const zip = new JSZip();
    const folder = zip.folder("zappit-qr-codes");

    for (const u of selectedUsers) {
      if (u.qrUrl) {
        const svgString = buildPremiumQrSvg(u.qrUrl, { label: "3G ZAPPIT" });
        const name = (u.name || "user").toLowerCase().replace(/[^a-z0-9]/g, "-");
        folder?.file(`zappit-qr-${name}.svg`, svgString);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zappit-bulk-qr-export-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Bulk Operations API Call
  const handleBatchOperation = async (action: "qr_zip" | "export_csv" | "bulk_status", statusValue?: string) => {
    if (selectedOrderIds.length === 0) {
      alert("Please select at least one order.");
      return;
    }

    setBatchActionLoading(true);
    try {
      const res = await fetch("/api/super-admin/orders/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderIds: selectedOrderIds,
          status: statusValue,
        }),
      });

      if (action === "export_csv") {
        if (!res.ok) throw new Error("CSV export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ZAPPIT_Shipping_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (action === "qr_zip") {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "QR ZIP generation failed");
        const binary = atob(json.zipBase64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = json.fileName || "ZAPPIT_QRS.zip";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Batch operation failed");
        alert(json.message || "Updated successfully");
        setSelectedOrderIds([]);
        await loadFulfillment();
      }
    } catch (e: any) {
      alert(e.message || "Batch action failed");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotice(`Copied ${label}!`);
    setTimeout(() => setCopyNotice(""), 2000);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("myluxcards_current_user");
    window.location.replace("/");
  };

  // If an order is opened in Ship Order Workspace
  if (selectedOrderIdForShip) {
    return (
      <ShipOrderWorkspace
        orderId={selectedOrderIdForShip}
        onBack={() => {
          setSelectedOrderIdForShip(null);
          setSection("fulfillment");
          loadFulfillment();
        }}
        onViewCustomer={(userId) => openUserDetails(userId)}
      />
    );
  }

  const PIPELINE_STAGES = [
    { key: "ALL", label: "ALL ORDERS" },
    { key: "NEW", label: "NEW" },
    { key: "PAYMENT_VERIFIED", label: "PAYMENT VERIFIED" },
    { key: "CUSTOMIZATION", label: "CUSTOMIZATION" },
    { key: "QR_READY", label: "QR READY" },
    { key: "CARD_PRODUCTION", label: "PRODUCTION" },
    { key: "PACKAGING", label: "PACKAGING" },
    { key: "READY_TO_SHIP", label: "READY TO SHIP" },
    { key: "SHIPPED", label: "SHIPPED" },
    { key: "DELIVERED", label: "DELIVERED" },
  ];

  const filteredAttentionOrders = (fulfillmentData?.needingAttention || []).filter((o: any) => {
    const matchesPipeline = pipelineFilter === "ALL" || o.status === pipelineFilter;
    const q = orderSearchQuery.trim().toLowerCase();
    const matchesSearch = !q || (
      o.orderNumber?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerEmail?.toLowerCase().includes(q) ||
      o.customerMobile?.toLowerCase().includes(q)
    );
    return matchesPipeline && matchesSearch;
  });

  const userInitials = identity.name ? identity.name.charAt(0).toUpperCase() : "S";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const s = p.get("section") || p.get("tab");
      const m = p.get("mode");
      const o = p.get("orderId") || p.get("shipOrderId");
      if (s === "fulfillment" || s === "shipping" || s === "courier_shipping" || m || o) {
        setSection("fulfillment");
        if (m === "shipping" || s === "shipping" || s === "courier_shipping") {
          setFulfillmentMode("shipping");
        } else if (m === "packing") {
          setFulfillmentMode("packing");
        }
        if (o) {
          setSelectedOrderIdForShip(o);
        }
      }
    }
  }, []);

  const renderNavBtn = (key: Section, label: string, Icon: any) => {
    const isActive = section === key;
    return (
      <button
        key={key}
        type="button"
        className={`side-nav-item ${isActive ? "active" : ""}`}
        onClick={() => {
          setSection(key);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (key === "overview") {
              url.searchParams.delete("section");
              url.searchParams.delete("tab");
              url.searchParams.delete("mode");
              url.searchParams.delete("orderId");
              url.searchParams.delete("shipOrderId");
            } else {
              url.searchParams.set("section", key);
            }
            window.history.replaceState(null, "", url);
          }
        }}
        onMouseEnter={(e) => {
          if (desktopCollapsed && window.innerWidth > 900) {
            const rect = e.currentTarget.getBoundingClientRect();
            setActiveRailTip({ text: label, top: rect.top + rect.height / 2 });
          }
        }}
        onMouseLeave={() => setActiveRailTip(null)}
        title={desktopCollapsed ? label : undefined}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className="nav-icon" />
        <span className="nav-label">{label}</span>
      </button>
    );
  };

  return (
    <div className={`admin-shell ${desktopCollapsed ? "is-collapsed" : ""}`}>
      {/* Background Decor */}
      <DashboardBackgroundDecor />

      {/* Top Header Bar */}
      <header className="admin-top">
        <div className="admin-top-left">
          <button
            type="button"
            className="admin-menu-toggle"
            onClick={() => setMobile(true)}
            aria-label="Open navigation menu"
          >
            ☰
          </button>
          <div className="dash-breadcrumbs">
            <span className="crumb-brand">Zappit</span>
            <span className="crumb-slash">/</span>
            <span className="crumb-target">Super Admin · {sectionLabels[section]}</span>
          </div>
          <span className="admin-mode-pill">SUPER ADMIN</span>
        </div>

        <div className="admin-top-right">
          <button
            type="button"
            onClick={toggleTheme}
            className="dash-theme-btn"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            aria-label="Toggle theme"
          >
            <span className="theme-btn-icon" aria-hidden="true">{theme === "light" ? "🌙" : "☀️"}</span>
            <span className="theme-btn-label">{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
          </button>

          <button
            type="button"
            className="admin-icon-btn"
            onClick={async () => {
              setIsReloading(true);
              await loadOverviewAndAudit();
              if (section === "users") await loadUsers();
              else if (section === "fulfillment") await loadFulfillment();
              setTimeout(() => setIsReloading(false), 500);
            }}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw style={{ width: 16, height: 16 }} className={isReloading ? "animate-spin text-blue-500" : ""} />
          </button>

          <div className="admin-user-badge">
            <div className="admin-avatar-circle">{userInitials}</div>
            <div className="admin-user-info">
              <strong>{identity.name}</strong>
              <small>SUPER ADMIN</small>
            </div>
          </div>
        </div>
      </header>

      {copyNotice && (
        <div className="admin-toast-notice success">
          ✓ {copyNotice}
        </div>
      )}

      {/* Backdrop scrim on mobile */}
      {mobile && (
        <button
          type="button"
          className="admin-scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`admin-sidebar ${mobile ? "open" : ""} ${desktopCollapsed ? "is-rail" : ""}`}>
        <div className="side-logo-wrap">
          <a href="/" className="side-brand" title="Zappit Homepage" aria-label="Zappit">
            <BrandLogo size="sm" />
            <span className="side-brand-tag">SUPER ADMIN</span>
          </a>

          <button
            type="button"
            className="side-collapse-btn"
            onClick={toggleDesktopSidebar}
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? (
              <PanelLeftOpen style={{ width: 18, height: 18 }} />
            ) : (
              <PanelLeftClose style={{ width: 18, height: 18 }} />
            )}
          </button>

          <button
            type="button"
            className="side-close-btn"
            onClick={() => setMobile(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="side-nav-scroll">
          <span className="side-group-title">Command Center</span>
          {renderNavBtn("overview", "Overview", LayoutDashboard)}
          {renderNavBtn("users", "Users & QR Directory", Users)}
          {renderNavBtn("fulfillment", "Fulfillment Center", Truck)}
          {renderNavBtn("audit", "Audit Logs", ShieldAlert)}
          {renderNavBtn("settings", "Platform Settings", SettingsIcon)}
        </nav>

        <div className="side-footer">
          <button
            type="button"
            className="side-logout-btn"
            onClick={logout}
            onMouseEnter={(e) => {
              if (desktopCollapsed && window.innerWidth > 900) {
                const rect = e.currentTarget.getBoundingClientRect();
                setActiveRailTip({ text: "Log out", top: rect.top + rect.height / 2 });
              }
            }}
            onMouseLeave={() => setActiveRailTip(null)}
          >
            <LogOut style={{ width: 16, height: 16 }} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Floating Rail Tooltip when collapsed */}
      {activeRailTip && desktopCollapsed && (
        <div
          className="rail-floating-tooltip"
          style={{ top: `${activeRailTip.top}px` }}
          role="tooltip"
        >
          {activeRailTip.text}
        </div>
      )}

      {/* Main Content View */}
      <main className="admin-main">
        {/* SECTION 1: OVERVIEW */}
        {section === "overview" && (
          <div>
            <div className="admin-heading">
              <div>
                <p className="admin-heading-eyebrow">COMMAND CENTER</p>
                <h1>Platform Overview</h1>
                <span>Comprehensive health and scale metrics for Zappit.</span>
              </div>
            </div>

            <div className="stat-grid">
              <article className="crm-kpi-card" style={{ "--entrance-delay": "0ms" } as React.CSSProperties}>
                <div className="crm-kpi-top">
                  <span className="crm-kpi-label">TOTAL PLATFORM USERS</span>
                  <div className="crm-kpi-badge">
                    <Users style={{ width: 18, height: 18 }} />
                  </div>
                </div>
                <div className="crm-kpi-value">{overviewStats.totalAccounts}</div>
                <div className="crm-kpi-sub-link">
                  <TrendingUp style={{ width: 13, height: 13, color: "var(--admin-cyan)" }} />
                  <span>All registered accounts</span>
                </div>
              </article>

              <article className="crm-kpi-card" style={{ "--entrance-delay": "30ms" } as React.CSSProperties}>
                <div className="crm-kpi-top">
                  <span className="crm-kpi-label">ACTIVE STANDARD USERS</span>
                  <div className="crm-kpi-badge">
                    <TrendingUp style={{ width: 18, height: 18 }} />
                  </div>
                </div>
                <div className="crm-kpi-value" style={{ color: "#10B981" }}>{overviewStats.activeUsers}</div>
                <div className="crm-kpi-sub-link">
                  <TrendingUp style={{ width: 13, height: 13, color: "#10B981" }} />
                  <span>Active user profiles</span>
                </div>
              </article>

              <article className="crm-kpi-card" style={{ "--entrance-delay": "60ms" } as React.CSSProperties}>
                <div className="crm-kpi-top">
                  <span className="crm-kpi-label">PLATFORM ADMINS</span>
                  <div className="crm-kpi-badge">
                    <ShieldCheck style={{ width: 18, height: 18 }} />
                  </div>
                </div>
                <div className="crm-kpi-value" style={{ color: "var(--admin-blue)" }}>{overviewStats.admins}</div>
                <div className="crm-kpi-sub-link">
                  <TrendingUp style={{ width: 13, height: 13, color: "var(--admin-blue)" }} />
                  <span>Admins &amp; Super Admins</span>
                </div>
              </article>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <h2>Operational Quick Actions</h2>
                <span style={{ fontSize: "12px", color: "var(--admin-muted)" }}>Platform shortcuts</span>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
                <button
                  type="button"
                  className="admin-btn-primary"
                  onClick={() => setSection("fulfillment")}
                >
                  <Truck style={{ width: 16, height: 16 }} />
                  <span>Open Fulfillment Center</span>
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setSection("users")}
                >
                  <Users style={{ width: 16, height: 16 }} />
                  <span>Inspect User Directory</span>
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setSection("audit")}
                >
                  <ShieldAlert style={{ width: 16, height: 16 }} />
                  <span>View Audit Logs</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: USERS & QR DIRECTORY */}
        {section === "users" && (
          <div>
            <div className="admin-heading">
              <div>
                <p className="admin-heading-eyebrow">USER MANAGEMENT</p>
                <h1>User &amp; QR Code Directory</h1>
                <span>Manage users, inspect QR destination URLs, and download production PNG/SVG files directly.</span>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {selectedUserIds.length > 0 && (
                  <button onClick={exportSelectedQrsZip} className="admin-btn-primary">
                    <Download style={{ width: 14, height: 14 }} />
                    <span>Download Selected QRs ({selectedUserIds.length} ZIP)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters & Search */}
            <div className="admin-panel" style={{ marginTop: 0, marginBottom: "20px", padding: "16px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search name, email, phone, card slug, ID..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="admin-input"
                style={{ flex: 1, minWidth: "240px" }}
              />

              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUserPagination((prev) => ({ ...prev, page: 1 }));
                }}
                style={selectStyle}
              >
                <option value="ALL">All Roles</option>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value);
                  setUserPagination((prev) => ({ ...prev, page: 1 }));
                }}
                style={selectStyle}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <p>Loading user directory...</p>
            ) : users.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#888", background: "#111", borderRadius: "8px" }}>No users match the criteria.</div>
            ) : (
              <div style={{ overflowX: "auto", background: "#111", borderRadius: "8px", border: "1px solid #222" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #222", color: "#888", background: "#0a0a0a" }}>
                      <th style={{ padding: "12px" }}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.length === users.length && users.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(users.map((u) => u.id));
                            } else {
                              setSelectedUserIds([]);
                            }
                          }}
                        />
                      </th>
                      <th style={{ padding: "12px" }}>User / Contact</th>
                      <th style={{ padding: "12px" }}>Role</th>
                      <th style={{ padding: "12px" }}>Status</th>
                      <th style={{ padding: "12px" }}>Card / Slug</th>
                      <th style={{ padding: "12px" }}>QR Code Direct Actions</th>
                      <th style={{ padding: "12px" }}>CRM / Orders</th>
                      <th style={{ padding: "12px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid #1c1c1c" }}>
                          <td style={{ padding: "12px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds((prev) => [...prev, u.id]);
                                } else {
                                  setSelectedUserIds((prev) => prev.filter((id) => id !== u.id));
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: "12px" }}>
                            <strong style={{ color: "#fff", display: "block" }}>{u.name}</strong>
                            <span style={{ color: "#888", fontSize: "12px" }}>{u.email}</span>
                            {u.phone && <div style={{ color: "#666", fontSize: "11px" }}>📞 {u.phone}</div>}
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, background: u.role === "SUPER_ADMIN" ? "#722ed1" : u.role === "ADMIN" ? "#0066FF" : "#333", color: "#fff" }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span style={{ color: u.status === "ACTIVE" ? "#52c41a" : "#ff4d4f", fontWeight: 600 }}>{u.status}</span>
                          </td>
                          <td style={{ padding: "12px" }}>
                            {u.digitalCard ? (
                              <span style={{ color: "#0066FF", fontFamily: "monospace", fontSize: "12px" }}>/{u.digitalCard.slug}</span>
                            ) : (
                              <span style={{ color: "#555" }}>Unassigned</span>
                            )}
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              <button onClick={() => setQrModalUser(u)} style={tableActionBtnStyle}>
                                🔍 View QR
                              </button>
                              <button onClick={() => downloadUserQr(u, "png")} style={tableActionBtnStyle}>
                                PNG
                              </button>
                              <button onClick={() => downloadUserQr(u, "svg")} style={tableActionBtnStyle}>
                                SVG
                              </button>
                              <button onClick={() => copyToClipboard(u.qrUrl, "QR URL")} style={tableActionBtnStyle}>
                                Copy URL
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: "12px", color: "#aaa" }}>
                            <div>Leads: {u.leadCount}</div>
                            <div>Orders: {u.orderCount}</div>
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => openUserDetails(u.id)} style={{ ...tableActionBtnStyle, background: "#0066FF", color: "#fff" }}>
                                Inspect
                              </button>
                              {u.role !== "SUPER_ADMIN" && (
                                <button onClick={() => setRoleModalUser(u)} style={tableActionBtnStyle}>
                                  Role
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid #222", color: "#888" }}>
                  <span>
                    Showing {users.length} of {userPagination.total} users (Page {userPagination.page} of {userPagination.totalPages})
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      disabled={userPagination.page <= 1}
                      onClick={() => setUserPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      style={paginationBtnStyle(userPagination.page <= 1)}
                    >
                      Previous
                    </button>
                    <button
                      disabled={userPagination.page >= userPagination.totalPages}
                      onClick={() => setUserPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      style={paginationBtnStyle(userPagination.page >= userPagination.totalPages)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: ORDER FULFILLMENT COMMAND CENTER */}
        {section === "fulfillment" && (
          <div>
            {selectedOrderIdForShip ? (
              <ShipOrderWorkspace
                orderId={selectedOrderIdForShip}
                onBack={() => setSelectedOrderIdForShip(null)}
                onViewCustomer={(userId) => {
                  setSelectedOrderIdForShip(null);
                  setSection("users");
                  openUserDetails(userId);
                }}
                onOpenPacking={(id) => {
                  setSelectedOrderIdForShip(null);
                  setFulfillmentMode("packing");
                }}
                onOpenShipping={(id) => {
                  setSelectedOrderIdForShip(null);
                  setFulfillmentMode("shipping");
                }}
              />
            ) : fulfillmentMode === "packing" ? (
              <PackingMode
                onExit={() => setFulfillmentMode("all")}
                onOpenWorkspace={(id) => {
                  setFulfillmentMode("all");
                  setSelectedOrderIdForShip(id);
                }}
              />
            ) : fulfillmentMode === "shipping" ? (
              <ShippingMode
                onExit={() => setFulfillmentMode("all")}
                onOpenWorkspace={(id) => {
                  setFulfillmentMode("all");
                  setSelectedOrderIdForShip(id);
                }}
              />
            ) : (
              <div>
                {/* Header & Operational Mode Switcher */}
                <div className="admin-heading">
                  <div>
                    <p className="admin-heading-eyebrow">OPERATIONS</p>
                    <h1>Fulfillment Command Center</h1>
                    <span>Operational order workspace: payment, customer, shipping, canonical QR &amp; packing slips in one place.</span>
                  </div>

                  {/* Operational Mode Switcher */}
                  <div style={{ display: "flex", gap: 6, background: "var(--admin-panel-elevated)", padding: 4, borderRadius: 10, border: "1px solid var(--admin-border)" }}>
                    <button
                      onClick={() => setFulfillmentMode("all")}
                      style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: (fulfillmentMode as string) === "all" ? "var(--admin-cyan)" : "transparent", color: (fulfillmentMode as string) === "all" ? "#fff" : "var(--admin-muted)" }}
                    >
                      ALL ORDERS
                    </button>
                    <button
                      onClick={() => setFulfillmentMode("packing")}
                      style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: (fulfillmentMode as string) === "packing" ? "var(--admin-cyan)" : "transparent", color: (fulfillmentMode as string) === "packing" ? "#fff" : "var(--admin-muted)" }}
                    >
                      PACKING MODE
                    </button>
                    <button
                      onClick={() => setFulfillmentMode("shipping")}
                      style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", background: (fulfillmentMode as string) === "shipping" ? "var(--admin-cyan)" : "transparent", color: (fulfillmentMode as string) === "shipping" ? "#fff" : "var(--admin-muted)" }}
                    >
                      SHIPPING MODE
                    </button>
                  </div>
                </div>

                {/* TODAY STATS METRICS BAR (CLICKABLE OPERATIONAL CARDS) */}
                {fulfillmentData?.today && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
                    <div style={statBoxStyle}>
                      <span style={{ fontSize: 11, color: "var(--admin-muted)", fontWeight: 700 }}>TODAY&apos;S ORDERS</span>
                      <h3 style={{ fontSize: 24, margin: "4px 0 0", color: "var(--admin-text)" }}>{fulfillmentData.today.todayOrders}</h3>
                    </div>
                    <div style={statBoxStyle}>
                      <span style={{ fontSize: 11, color: "var(--admin-muted)", fontWeight: 700 }}>TODAY&apos;S SALES</span>
                      <h3 style={{ fontSize: 24, margin: "4px 0 0", color: "#10B981" }}>₹{(fulfillmentData.today.todaySalesMinor / 100).toFixed(2)}</h3>
                    </div>
                    <div
                      onClick={() => setFulfillmentMode("packing")}
                      style={{ ...statBoxStyle, cursor: "pointer", border: "1px solid rgba(245, 158, 11, 0.4)", transition: "all 0.2s ease" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 800 }}>ORDERS TO PACK ➔</span>
                      </div>
                      <h3 style={{ fontSize: 24, margin: "4px 0 0", color: "#F59E0B" }}>{fulfillmentData.today.ordersToFulfill}</h3>
                    </div>
                    <div
                      onClick={() => setFulfillmentMode("shipping")}
                      style={{ ...statBoxStyle, cursor: "pointer", border: "1px solid rgba(0, 102, 255, 0.4)", transition: "all 0.2s ease" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--admin-cyan)", fontWeight: 800 }}>READY TO SHIP ➔</span>
                      </div>
                      <h3 style={{ fontSize: 24, margin: "4px 0 0", color: "var(--admin-cyan)" }}>{fulfillmentData.today.readyToShip}</h3>
                    </div>
                    <div style={statBoxStyle}>
                      <span style={{ fontSize: 11, color: "var(--admin-muted)", fontWeight: 700 }}>SHIPPED TODAY</span>
                      <h3 style={{ fontSize: 24, margin: "4px 0 0", color: "#10B981" }}>{fulfillmentData.today.shippedToday}</h3>
                    </div>
                  </div>
                )}

                {/* SAVED OPERATIONAL FILTER PILLS */}
                <div className="super-pipeline-pills">
                  <button
                    onClick={() => setPipelineFilter("ALL")}
                    className={`super-pipeline-pill ${pipelineFilter === "ALL" ? "active" : ""}`}
                  >
                    Needs Attention
                  </button>
                  <button
                    onClick={() => setPipelineFilter("PACKAGING")}
                    className={`super-pipeline-pill ${pipelineFilter === "PACKAGING" ? "active" : ""}`}
                  >
                    To Pack
                  </button>
                  <button
                    onClick={() => setPipelineFilter("READY_TO_SHIP")}
                    className={`super-pipeline-pill ${pipelineFilter === "READY_TO_SHIP" ? "active" : ""}`}
                  >
                    Ready to Ship
                  </button>
                  <button
                    onClick={() => setPipelineFilter("NEW")}
                    className={`super-pipeline-pill ${pipelineFilter === "NEW" ? "active" : ""}`}
                  >
                    Payment Pending
                  </button>
                </div>

                {/* FULFILLMENT PIPELINE COUNTER STAGES */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
                  {PIPELINE_STAGES.map((st) => {
                    const count = st.key === "ALL" ? (fulfillmentData?.needingAttention?.length || 0) : (fulfillmentData?.counts?.[st.key] || 0);
                    const active = pipelineFilter === st.key;

                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => setPipelineFilter(st.key)}
                        style={{
                          background: active ? "rgba(0, 102, 255, 0.14)" : "var(--admin-panel)",
                          border: active ? "1px solid var(--admin-cyan)" : "1px solid var(--admin-border)",
                          color: active ? "var(--admin-text)" : "var(--admin-muted)",
                          padding: "8px 14px",
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span>{st.label}</span>
                        <span style={{ background: active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", padding: "2px 7px", borderRadius: 12, fontSize: 11 }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* MULTI-IDENTIFIER SEARCH & BATCH ACTION BAR */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ position: "relative", minWidth: 280, flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Search Order #, Name, Phone, Email, Slug..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px 8px 32px", background: "#050505", border: "1px solid #333", color: "#fff", borderRadius: 8, fontSize: 13 }}
                    />
                    <span style={{ position: "absolute", left: 10, top: 9, opacity: 0.5 }}>🔍</span>
                  </div>

                  {selectedOrderIds.length > 0 && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#00E5FF" }}>
                        {selectedOrderIds.length} Selected
                      </span>
                      <button
                        disabled={batchActionLoading}
                        onClick={() => handleBatchOperation("qr_zip")}
                        style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        📦 Download QR ZIP
                      </button>
                      <button
                        disabled={batchActionLoading}
                        onClick={() => handleBatchOperation("export_csv")}
                        style={{ padding: "6px 12px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        📊 Export Shipping CSV
                      </button>
                      <button
                        disabled={batchActionLoading}
                        onClick={() => handleBatchOperation("bulk_status", "PACKED")}
                        style={{ padding: "6px 12px", background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✓ Mark Packed
                      </button>
                      <button
                        disabled={batchActionLoading}
                        onClick={() => handleBatchOperation("bulk_status", "READY_TO_SHIP")}
                        style={{ padding: "6px 12px", background: "#52c41a", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
                      >
                        🚀 Mark Ready to Ship
                      </button>
                    </div>
                  )}
                </div>

                {/* ORDERS TABLE WITH MULTI-SELECT, NEXT ACTION & QUICK ACTIONS */}
                {fulfillmentLoading ? (
                  <p>Loading fulfillment overview...</p>
                ) : !fulfillmentData ? (
                  <p>No fulfillment data available.</p>
                ) : (
                  <div style={{ background: "#111", borderRadius: 10, border: "1px solid #222", padding: 20 }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>
                      ⚠️ Orders Needing Operational Attention ({filteredAttentionOrders.length})
                    </h3>

                    {filteredAttentionOrders.length === 0 ? (
                      <p style={{ color: "#52c41a" }}>✓ All orders are processed and up to date!</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #222", color: "#888" }}>
                              <th style={{ padding: "10px" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedOrderIds.length === filteredAttentionOrders.length && filteredAttentionOrders.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrderIds(filteredAttentionOrders.map((o: any) => o.id));
                                    } else {
                                      setSelectedOrderIds([]);
                                    }
                                  }}
                                />
                              </th>
                              <th style={{ padding: "10px" }}>Order #</th>
                              <th style={{ padding: "10px" }}>Customer</th>
                              <th style={{ padding: "10px" }}>Amount</th>
                              <th style={{ padding: "10px" }}>Payment</th>
                              <th style={{ padding: "10px" }}>Status</th>
                              <th style={{ padding: "10px" }}>NEXT ACTION</th>
                              <th style={{ padding: "10px" }}>Pending Requirements</th>
                              <th style={{ padding: "10px" }}>Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAttentionOrders.map((o: any) => {
                              const isSelected = selectedOrderIds.includes(o.id);
                              const na = o.nextAction;

                              return (
                                <tr key={o.id} style={{ borderBottom: "1px solid #1c1c1c" }}>
                                  <td style={{ padding: "10px" }}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedOrderIds((prev) => [...prev, o.id]);
                                        } else {
                                          setSelectedOrderIds((prev) => prev.filter((id) => id !== o.id));
                                        }
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: "10px", fontWeight: 700, color: "#fff" }}>#{o.orderNumber}</td>
                                  <td style={{ padding: "10px" }}>
                                    <div>{o.customerName}</div>
                                    <small style={{ color: "#777" }}>{o.customerEmail}</small>
                                  </td>
                                  <td style={{ padding: "10px", fontWeight: 700 }}>₹{(o.totalMinor / 100).toFixed(2)}</td>
                                  <td style={{ padding: "10px" }}>
                                    <span style={{ color: o.paymentStatus === "PAID" ? "#52c41a" : "#ff4d4f", fontWeight: 600 }}>{o.paymentStatus}</span>
                                  </td>
                                  <td style={{ padding: "10px" }}>
                                    <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#222", fontSize: "11px" }}>{o.status}</span>
                                  </td>

                                  {/* CALCULATED NEXT ACTION COLUMN */}
                                  <td style={{ padding: "10px" }}>
                                    {na ? (
                                      <button
                                        onClick={() => {
                                          if (na.targetTab === "packing") {
                                            setFulfillmentMode("packing");
                                          } else if (na.targetTab === "shipping") {
                                            setFulfillmentMode("shipping");
                                          } else {
                                            setSelectedOrderIdForShip(o.id);
                                          }
                                        }}
                                        style={{
                                          background: `${na.color}22`,
                                          color: na.color,
                                          border: `1px solid ${na.color}`,
                                          padding: "3px 8px",
                                          borderRadius: "4px",
                                          fontWeight: 800,
                                          fontSize: "11px",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "4px",
                                        }}
                                      >
                                        <span>{na.label}</span>
                                        <span>➔</span>
                                      </button>
                                    ) : (
                                      <span style={{ color: "#888" }}>—</span>
                                    )}
                                  </td>

                                  <td style={{ padding: "10px" }}>
                                    {o.missingFields?.length > 0 ? (
                                      <span style={{ color: o.severity === "CRITICAL" ? "#ff4d4f" : "#f39c12", fontSize: "12px" }}>
                                        ⚠️ {o.missingFields.join(", ")}
                                      </span>
                                    ) : (
                                      <span style={{ color: "#52c41a", fontSize: "12px" }}>✓ Verified &amp; Ready</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "10px" }}>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      <button
                                        onClick={() => setSelectedOrderIdForShip(o.id)}
                                        style={{ padding: "5px 10px", background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", fontWeight: 800, border: "none", borderRadius: "4px", cursor: "pointer", fontSize: 11.5 }}
                                      >
                                        VIEW / SHIP
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: AUDIT LOGS */}
        {section === "audit" && (
          <div>
            <h1 style={{ fontSize: "24px", margin: "0 0 20px" }}>System Audit Logs</h1>
            <div style={{ overflowX: "auto", background: "#111", borderRadius: "8px", border: "1px solid #222" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #222", color: "#888" }}>
                    <th style={{ padding: "12px" }}>Timestamp</th>
                    <th style={{ padding: "12px" }}>Actor Role</th>
                    <th style={{ padding: "12px" }}>Action</th>
                    <th style={{ padding: "12px" }}>Entity Target</th>
                    <th style={{ padding: "12px" }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #1c1c1c" }}>
                      <td style={{ padding: "12px", color: "#888" }}>{new Date(log.created_at).toLocaleString()}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#222", fontSize: "11px" }}>{log.actor_role || "SYSTEM"}</span>
                      </td>
                      <td style={{ padding: "12px", fontWeight: 600, color: "#fff" }}>{log.action}</td>
                      <td style={{ padding: "12px", color: "#aaa" }}>
                        {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ""}
                      </td>
                      <td style={{ padding: "12px", color: "#888" }}>{log.ip_address || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 5: SETTINGS */}
        {section === "settings" && (
          <div className="admin-panel" style={{ maxWidth: "680px" }}>
            <div className="admin-panel-header">
              <h2>Platform System Configuration</h2>
            </div>
            <p style={{ color: "var(--admin-muted)", fontSize: "14px", lineHeight: "1.6" }}>
              Super Admin features and Google OAuth allowlist settings are active. To grant ADMIN role to specific Google accounts upon sign in, specify their emails in the <code>ADMIN_GOOGLE_EMAILS</code> environment variable.
            </p>
          </div>
        )}
      </main>

      {/* QR PREVIEW MODAL */}
      {qrModalUser && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "420px", textAlign: "center" }}>
            <h3>Customer QR Code</h3>
            <p style={{ color: "#aaa", fontSize: "12px", margin: "0 0 16px" }}>
              {qrModalUser.name} ({qrModalUser.email})
            </p>
            <div
              dangerouslySetInnerHTML={{ __html: buildPremiumQrSvg(qrModalUser.qrUrl, { label: "3G ZAPPIT" }) }}
              style={{ width: "240px", height: "240px", margin: "0 auto 16px", background: "#050505", padding: "10px", borderRadius: "10px", border: "1px solid #333" }}
            />
            <p style={{ fontSize: "12px", color: "#0066FF", wordBreak: "break-all" }}>{qrModalUser.qrUrl}</p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px" }}>
              <button onClick={() => downloadUserQr(qrModalUser, "png")} style={primaryBtnStyle}>
                Download PNG
              </button>
              <button onClick={() => downloadUserQr(qrModalUser, "svg")} style={secondaryBtnStyle}>
                Download SVG
              </button>
              <button onClick={() => setQrModalUser(null)} style={secondaryBtnStyle}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER DETAILS DRAWER WITH SEAMLESS VIEW ORDERS LINK */}
      {(userDrawerData || userDrawerLoading) && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "640px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3>User Account Details</h3>
              <button onClick={() => setUserDrawerData(null)} style={{ background: "transparent", border: "none", color: "#aaa", fontSize: "18px", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            {userDrawerLoading ? (
              <p>Loading user details...</p>
            ) : (
              <div>
                {/* Account info */}
                <div style={{ background: "#111", padding: "14px", borderRadius: "6px", marginBottom: "14px" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#00E5FF" }}>Account Information</h4>
                  <div style={{ fontSize: "13px", lineHeight: "1.6" }}>
                    <div><strong>Name:</strong> {userDrawerData.account.name}</div>
                    <div><strong>Email:</strong> {userDrawerData.account.email}</div>
                    <div><strong>Phone:</strong> {userDrawerData.account.phone || "N/A"}</div>
                    <div><strong>Role:</strong> {userDrawerData.account.role}</div>
                    <div><strong>Status:</strong> {userDrawerData.account.status}</div>
                    <div><strong>Created:</strong> {new Date(userDrawerData.account.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                {/* QR info */}
                <div style={{ background: "#111", padding: "14px", borderRadius: "6px", marginBottom: "14px" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#0066FF" }}>QR Information</h4>
                  <div style={{ fontSize: "13px" }}>
                    <div><strong>Destination URL:</strong> <a href={userDrawerData.qr.url} target="_blank" rel="noreferrer" style={{ color: "#0066FF" }}>{userDrawerData.qr.url}</a></div>
                    <div><strong>Slug:</strong> {userDrawerData.qr.slug || "Unassigned"}</div>
                    <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                      <button onClick={() => downloadUserQr({ qrUrl: userDrawerData.qr.url, name: userDrawerData.account.name }, "png")} style={secondaryBtnStyle}>Download PNG</button>
                      <button onClick={() => downloadUserQr({ qrUrl: userDrawerData.qr.url, name: userDrawerData.account.name }, "svg")} style={secondaryBtnStyle}>Download SVG</button>
                    </div>
                  </div>
                </div>

                {/* Card info */}
                <div style={{ background: "#111", padding: "14px", borderRadius: "6px", marginBottom: "14px" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#52c41a" }}>Card &amp; NFC Details</h4>
                  {userDrawerData.card ? (
                    <div style={{ fontSize: "13px" }}>
                      <div><strong>Digital Card ID:</strong> {userDrawerData.card.id}</div>
                      <div><strong>Slug:</strong> {userDrawerData.card.slug}</div>
                      <div><strong>Active Status:</strong> {userDrawerData.card.active ? "ACTIVE" : "INACTIVE"}</div>
                      <div><strong>Physical Cards Attached:</strong> {userDrawerData.card.physicalCards.length}</div>
                    </div>
                  ) : (
                    <p style={{ fontSize: "12px", color: "#888" }}>No digital card assigned to user yet.</p>
                  )}
                </div>

                {/* Orders summary & View Orders button */}
                <div style={{ background: "#111", padding: "14px", borderRadius: "6px", marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h4 style={{ margin: 0 }}>Recent Orders ({userDrawerData.orders.length})</h4>
                    <button
                      onClick={() => {
                        const email = userDrawerData.account.email;
                        setUserDrawerData(null);
                        setSection("fulfillment");
                        setOrderSearchQuery(email);
                      }}
                      style={{ background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
                    >
                      📦 View Orders
                    </button>
                  </div>
                  {userDrawerData.orders.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "#888" }}>No orders placed.</p>
                  ) : (
                    <ul style={{ paddingLeft: "18px", margin: 0, fontSize: "12px" }}>
                      {userDrawerData.orders.map((o: any) => (
                        <li key={o.id}>
                          #{o.orderNumber} - ₹{(o.totalMinor / 100).toFixed(2)} ({o.status} | {o.paymentStatus})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* CRM summary */}
                <div style={{ background: "#111", padding: "14px", borderRadius: "6px" }}>
                  <h4 style={{ margin: "0 0 8px" }}>CRM Metrics</h4>
                  <div style={{ fontSize: "13px" }}>
                    <div><strong>Total Leads:</strong> {userDrawerData.crm.totalLeads}</div>
                    <div><strong>Converted Leads:</strong> {userDrawerData.crm.convertedLeads}</div>
                    <div><strong>Lost Leads:</strong> {userDrawerData.crm.lostLeads}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHANGE ROLE / STATUS MODAL */}
      {roleModalUser && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "400px" }}>
            <h3>Manage Account Role &amp; Status</h3>
            <p style={{ color: "#888", fontSize: "13px", marginBottom: "16px" }}>{roleModalUser.email}</p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#aaa", marginBottom: "6px" }}>Account Role</label>
              <select id="newRoleSelect" defaultValue={roleModalUser.role} style={selectStyle}>
                <option value="USER">USER (Normal Zappit User)</option>
                <option value="ADMIN">ADMIN (Managed User Admin)</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#aaa", marginBottom: "6px" }}>Account Status</label>
              <select id="newStatusSelect" defaultValue={roleModalUser.status} style={selectStyle}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setRoleModalUser(null)} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button
                disabled={roleUpdating}
                onClick={() => {
                  const roleSel = (document.getElementById("newRoleSelect") as HTMLSelectElement).value;
                  const statusSel = (document.getElementById("newStatusSelect") as HTMLSelectElement).value;
                  updateUserRole(roleModalUser.id, roleSel, statusSel);
                }}
                style={primaryBtnStyle}
              >
                {roleUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles
const navBtnStyle = (active: boolean): React.CSSProperties => ({
  textAlign: "left",
  padding: "10px 14px",
  borderRadius: "6px",
  background: active ? "var(--admin-cyan)" : "transparent",
  color: active ? "#ffffff" : "var(--admin-muted)",
  border: "none",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: active ? 700 : 500,
});

const statBoxStyle: React.CSSProperties = {
  background: "var(--admin-panel)",
  border: "1px solid var(--admin-border)",
  padding: "20px 22px",
  borderRadius: "14px",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
};

const selectStyle: React.CSSProperties = {
  padding: "9px 14px",
  background: "var(--admin-panel-elevated)",
  border: "1px solid var(--admin-border)",
  color: "var(--admin-text)",
  borderRadius: "8px",
  fontSize: "13px",
  cursor: "pointer",
  outline: "none",
};

const tableActionBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "6px",
  background: "rgba(255, 255, 255, 0.04)",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const paginationBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "6px 12px",
  borderRadius: "4px",
  background: disabled ? "var(--admin-bg)" : "var(--admin-panel)",
  color: disabled ? "var(--admin-muted)" : "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  fontSize: "12px",
  cursor: disabled ? "not-allowed" : "pointer",
});

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px",
};

const modalContentStyle: React.CSSProperties = {
  background: "var(--admin-panel)",
  border: "1px solid var(--admin-border)",
  color: "var(--admin-text)",
  padding: "24px",
  borderRadius: "10px",
  width: "100%",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "linear-gradient(135deg, #0066FF, #00E5FF)",
  color: "#fff",
  fontWeight: 800,
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--admin-text)",
  border: "1px solid var(--admin-border)",
  borderRadius: "6px",
  cursor: "pointer",
};
