"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { NotificationBell } from "@/components/NotificationBell";
import type { NotificationItem } from "@/components/NotificationBell";
import {
  Bell,
  CheckCheck,
  Trash2,
  MessageSquare,
  UserPlus,
  Calendar,
  AlertTriangle,
  Send,
  SlidersHorizontal,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  RefreshCw,
  X,
  Check,
} from "lucide-react";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export default function NotificationsClient({ identity }: { identity: CurrentUser }) {
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [toast, setToast] = useState("");

  // Navigation Sidebar State
  const [sidebar, setSidebar] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);

  // Preference State
  const [prefs, setPrefs] = useState({
    new_whatsapp_messages: true,
    new_leads: true,
    follow_up_reminders: true,
    broadcast_results: true,
    connection_alerts: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = filter === "UNREAD" ? "/api/notifications?unread_only=true&limit=100" : "/api/notifications?limit=100";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } else {
        setError("Could not load notifications from server.");
      }
    } catch {
      setError("Network error loading notifications.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) setPrefs(data.preferences);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    void fetchPrefs();
  }, [fetchNotifications, fetchPrefs]);

  // Real-time SSE listener
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource("/api/notifications/stream");
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data || "{}");
            if (data.type === "NOTIFICATION") {
              setNotifications((prev) => [data.notification, ...prev]);
              setUnreadCount((c) => c + 1);
            } else if (data.type === "UNREAD_COUNT") {
              setUnreadCount(data.unreadCount ?? 0);
            }
          } catch {
            // ignore
          }
        };
        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        // Fallback
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      notify("All notifications marked as read.");

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
    } catch {
      notify("Failed to mark all as read.");
    }
  };

  const handleClearRead = async () => {
    if (!confirm("Are you sure you want to clear all read notifications?")) return;
    try {
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      notify("Read notifications cleared.");

      await fetch("/api/notifications", { method: "DELETE" });
    } catch {
      notify("Failed to clear read notifications.");
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        notify("Preferences saved.");
        setPreferencesOpen(false);
      } else {
        notify("Failed to save preferences.");
      }
    } catch {
      notify("Error saving preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleNotificationRowClick = (n: NotificationItem) => {
    if (!n.is_read) {
      void handleMarkRead(n.id);
    }

    if (n.action_url) {
      window.location.href = n.action_url;
    } else if (n.type.includes("WHATSAPP")) {
      window.location.href = "/dashboard?tab=whatsapp";
    } else if (n.type.includes("LEAD")) {
      window.location.href = "/dashboard?tab=leads";
    } else {
      window.location.href = "/dashboard";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "WHATSAPP_NEW_MESSAGE":
        return <MessageSquare className="w-5 h-5 text-emerald-400" />;
      case "NEW_LEAD":
        return <UserPlus className="w-5 h-5 text-amber-400" />;
      case "FOLLOW_UP_DUE":
      case "FOLLOW_UP_OVERDUE":
        return <Calendar className="w-5 h-5 text-orange-400" />;
      case "WHATSAPP_CAMPAIGN_COMPLETED":
        return <Send className="w-5 h-5 text-blue-400" />;
      case "WHATSAPP_CONNECTION_ACTION_REQUIRED":
      case "WHATSAPP_CAMPAIGN_FAILED":
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-[#0066FF]" />;
    }
  };

  // Compute Metric Summaries from real notification list
  const summaryMetrics = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.is_read).length;
    const whatsapp = notifications.filter((n) => n.type.includes("WHATSAPP")).length;
    const followUps = notifications.filter((n) => n.type.includes("FOLLOW_UP")).length;
    return { total, unread, whatsapp, followUps };
  }, [notifications]);

  // Apply filters & search query
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Unread filter
      if (filter === "UNREAD" && n.is_read) return false;

      // Type filter
      if (typeFilter === "SYSTEM" && !n.type.includes("SYSTEM")) return false;
      if (typeFilter === "ORDER" && !n.type.includes("ORDER")) return false;
      if (typeFilter === "ACCOUNT" && !n.type.includes("ACCOUNT")) return false;

      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const titleMatch = (n.title || "").toLowerCase().includes(q);
        const bodyMatch = (n.body || "").toLowerCase().includes(q);
        if (!titleMatch && !bodyMatch) return false;
      }

      return true;
    });
  }, [notifications, filter, typeFilter, search]);

  // Group notifications chronologically by date
  const groupedNotifications = useMemo(() => {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const thisWeek: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    for (const n of filteredNotifications) {
      const d = new Date(n.created_at);
      const itemDateStr = d.toDateString();

      if (itemDateStr === todayStr) today.push(n);
      else if (itemDateStr === yesterdayStr) yesterday.push(n);
      else if (d.getTime() >= weekAgo.getTime()) thisWeek.push(n);
      else earlier.push(n);
    }

    return { today, yesterday, thisWeek, earlier };
  }, [filteredNotifications]);

  const clearAllFilters = () => {
    setFilter("ALL");
    setTypeFilter("ALL");
    setSearch("");
  };

  const hasActiveFilters = filter !== "ALL" || typeFilter !== "ALL" || search !== "";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    localStorage.removeItem("myluxcards_current_user");
    sessionStorage.removeItem("myluxcards_auth_next");
    window.location.replace("/");
  };

  return (
    <div className="dash-shell">
      {toast && <div className="dash-toast">✓ {toast}</div>}

      {/* Standard Dashboard Header */}
      <header className="dash-top">
        <button className="hamb" onClick={() => setSidebar(!sidebar)} aria-label="Toggle navigation">☰</button>
        <a className="dash-brand" href="/">
          <Image
            src="/assets/logo.svg"
            alt="Zappit logo"
            width={240}
            height={120}
            priority
            style={{
              width: "auto",
              height: "auto",
            }}
          />
        </a>
        <span className="crumb">/ &nbsp;Notification Center</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <NotificationBell />
          <div className="account-menu">
            <button
              className="avatar"
              title={identity.email}
              aria-label="Open account menu"
              aria-expanded={accountMenu}
              onClick={() => setAccountMenu((open) => !open)}
            >
              {identity.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ML"}
            </button>
            {accountMenu && (
              <div className="account-popover">
                <strong>{identity.name}</strong>
                <span>{identity.email}</span>
                {(identity.role === "ADMIN" || identity.role === "SUPER_ADMIN") && (
                  <a href="/admin" style={{ display: "block", margin: "8px 0", color: "#0066FF", fontWeight: 600, textDecoration: "none" }}>
                    ⚙ Admin Portal
                  </a>
                )}
                <button onClick={logout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Tabbar */}
      <nav className="mobile-tabbar" aria-label="Dashboard sections">
        <a href="/dashboard">Home</a>
        <a href="/dashboard?tab=analytics">QR Activity</a>
        <a href="/dashboard?tab=cards">My Cards</a>
        <a href="/dashboard?tab=leads">Leads</a>
        <a href="/dashboard?tab=whatsapp">WhatsApp</a>
        <a href="/notifications" className="active">Notifications</a>
      </nav>

      {sidebar && <button className="side-scrim" aria-label="Close navigation" onClick={() => setSidebar(false)} />}

      {/* Sidebar Navigation */}
      <aside className={`dash-side ${sidebar ? "open" : ""}`}>
        <nav>
          <a className="side-link" href="/dashboard"><I>⌂</I> Dashboard</a>
          <a className="side-link" href="/dashboard?tab=analytics"><I>📊</I> QR Activity</a>
          <a className="side-link" href="/dashboard?tab=cards"><I>▣</I> My Cards</a>
          <a className="side-link" href="/dashboard?tab=leads"><I>👥</I> Leads</a>
          <a className="side-link" href="/dashboard?tab=whatsapp"><I>💬</I> WhatsApp</a>
          <a className="side-link active" href="/notifications"><I>🔔</I> Notifications</a>
          <a className="side-link" href="/orders"><I>▤</I> My Orders</a>
          {(identity.role === "ADMIN" || identity.role === "SUPER_ADMIN") && (
            <a className="side-link" href="/admin" style={{ color: "#0066FF", fontWeight: 600 }}><I>⚙</I> Admin Portal</a>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="dash-main">
        <section>
          {/* Page Heading */}
          <div className="page-heading" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" }}>
              <div>
                <p style={{ color: "#0066FF", fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  NOTIFICATIONS
                </p>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#FFFFFF", margin: "2px 0 4px", display: "flex", alignItems: "center", gap: 10 }}>
                  Notification Center
                  {unreadCount > 0 && (
                    <span style={{ fontSize: 11, background: "rgba(0, 229, 255, 0.18)", color: "#0066FF", border: "1px solid rgba(0, 229, 255, 0.35)", padding: "2px 10px", borderRadius: 12, fontWeight: 800 }}>
                      {unreadCount} UNREAD
                    </span>
                  )}
                </h1>
                <span style={{ color: "#B7B7B7", fontSize: 13.5 }}>
                  Stay updated with leads, WhatsApp messages, follow-ups and important account activity.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setPreferencesOpen(!preferencesOpen)}
                className="crm-pill-btn"
                style={{ fontSize: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, background: "#0D0E15", color: "#0066FF", borderColor: "rgba(0, 229, 255,0.35)" }}
              >
                <SlidersHorizontal className="w-4 h-4" />
                ⚙ Notification Preferences
              </button>
            </div>
          </div>

          {/* Preferences Drawer / Modal */}
          {preferencesOpen && (
            <div style={{ background: "#0D0E15", border: "1px solid rgba(0, 229, 255, 0.4)", borderRadius: 16, padding: 20, marginBottom: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0 }}>Notification Preferences</h3>
                <button type="button" onClick={() => setPreferencesOpen(false)} style={{ background: "transparent", border: "none", color: "#888", fontSize: 16, cursor: "pointer" }}>✕</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { key: "new_whatsapp_messages", title: "New WhatsApp Messages", desc: "Receive alerts for incoming buyer replies" },
                  { key: "new_leads", title: "New Leads Captured", desc: "Alert when a visitor shares contact details" },
                  { key: "follow_up_reminders", title: "Follow-Up Reminders", desc: "Notifications when follow-ups are due" },
                  { key: "broadcast_results", title: "Broadcast Results", desc: "Alerts when a campaign completes or fails" },
                  { key: "connection_alerts", title: "WhatsApp Connection Alerts", desc: "Critical alerts if Meta Cloud API disconnects" },
                ].map((item) => (
                  <div key={item.key} style={{ background: "#12131A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <label className="notif-toggle-switch">
                      <input
                        type="checkbox"
                        checked={Boolean((prefs as any)[item.key])}
                        onChange={(e) => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                      />
                      <span className="notif-toggle-slider" />
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPreferencesOpen(false)}
                  style={{ background: "transparent", border: "none", color: "#888", fontSize: 13, cursor: "pointer", padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="mylux-btn-submit"
                  onClick={handleSavePrefs}
                  disabled={savingPrefs}
                  style={{ padding: "8px 20px", fontSize: 13 }}
                >
                  {savingPrefs ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </div>
          )}

          {/* 1. Summary Metrics Cards */}
          <div className="notif-summary-grid">
            <div className="notif-summary-card">
              <div>
                <strong style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>{summaryMetrics.total}</strong>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#888888", letterSpacing: "0.05em", display: "block", marginTop: 2 }}>TOTAL</span>
              </div>
              <Bell className="w-5 h-5 text-neutral-400" />
            </div>

            <div className="notif-summary-card" style={{ borderColor: summaryMetrics.unread > 0 ? "rgba(0, 229, 255,0.4)" : undefined }}>
              <div>
                <strong style={{ fontSize: 22, fontWeight: 800, color: "#0066FF" }}>{summaryMetrics.unread}</strong>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0066FF", letterSpacing: "0.05em", display: "block", marginTop: 2 }}>UNREAD</span>
              </div>
              <Sparkles className="w-5 h-5 text-[#0066FF]" />
            </div>

            <div className="notif-summary-card">
              <div>
                <strong style={{ fontSize: 22, fontWeight: 800, color: "#2ecc71" }}>{summaryMetrics.whatsapp}</strong>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#888888", letterSpacing: "0.05em", display: "block", marginTop: 2 }}>WHATSAPP</span>
              </div>
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>

            <div className="notif-summary-card">
              <div>
                <strong style={{ fontSize: 22, fontWeight: 800, color: "#e67e22" }}>{summaryMetrics.followUps}</strong>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#888888", letterSpacing: "0.05em", display: "block", marginTop: 2 }}>FOLLOW-UPS</span>
              </div>
              <Calendar className="w-5 h-5 text-orange-400" />
            </div>
          </div>

          {/* 2. Filter & Toolbar Bar */}
          <div className="notif-filter-bar">
            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                type="button"
                className={`notif-tab-btn ${filter === "ALL" ? "active" : ""}`}
                onClick={() => setFilter("ALL")}
              >
                ALL
              </button>
              <button
                type="button"
                className={`notif-tab-btn ${filter === "UNREAD" ? "active" : ""}`}
                onClick={() => setFilter("UNREAD")}
              >
                UNREAD {summaryMetrics.unread > 0 && `(${summaryMetrics.unread})`}
              </button>
            </div>

            {/* Type Dropdown & Search Input */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
              <select
                className="crm-select-dark"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ fontSize: 12 }}
              >
                <option value="ALL">All Types</option>
                <option value="WHATSAPP">WhatsApp Messages</option>
                <option value="LEADS">New Leads</option>
                <option value="FOLLOW_UP">Follow-Ups</option>
                <option value="BROADCAST">Broadcasts</option>
                <option value="SYSTEM">System Alerts</option>
              </select>

              <div className="crm-search-box" style={{ width: 240 }}>
                <span>⌕</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notifications..."
                />
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="crm-pill-btn"
                  style={{ fontSize: 12, padding: "6px 12px", background: "rgba(0, 229, 255,0.15)", color: "#0066FF", borderColor: "rgba(0, 229, 255,0.3)" }}
                >
                  ✓ Mark All Read
                </button>
              )}

              <button
                type="button"
                onClick={handleClearRead}
                className="crm-pill-btn"
                style={{ fontSize: 12, padding: "6px 12px", background: "rgba(231,76,60,0.12)", color: "#e74c3c", borderColor: "rgba(231,76,60,0.3)" }}
              >
                🗑 Clear Read
              </button>
            </div>
          </div>

          {/* 3. Notifications Content List */}
          {loading ? (
            <div>
              <div className="notif-skeleton-row" />
              <div className="notif-skeleton-row" />
              <div className="notif-skeleton-row" />
              <div className="notif-skeleton-row" />
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: "center", background: "#0B0B0B", border: "1px solid rgba(231,76,60,0.4)", borderRadius: 16 }}>
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <h3 style={{ fontSize: 16, color: "#FFFFFF", fontWeight: 700, margin: "0 0 6px" }}>Error Loading Notifications</h3>
              <p style={{ fontSize: 13, color: "#888888", margin: "0 0 14px" }}>{error}</p>
              <button
                type="button"
                className="mylux-btn-submit"
                onClick={() => fetchNotifications()}
                style={{ fontSize: 12, padding: "8px 16px" }}
              >
                Try Again
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", background: "#0B0B0B", border: "1px solid rgba(0, 229, 255, 0.35)", borderRadius: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.35)", boxShadow: "0 0 20px rgba(0, 229, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Bell style={{ width: 24, height: 24, color: "#0066FF" }} />
              </div>
              <h3 style={{ fontSize: 14, color: "#0066FF", margin: "0 0 6px", fontWeight: 700, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                {hasActiveFilters ? "No Notifications Match Filters" : "No Notifications Yet"}
              </h3>
              <p style={{ fontSize: 12.5, margin: 0, color: "#9E9E9E", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", lineHeight: 1.5, maxWidth: 340, textAlign: "center" }}>
                {hasActiveFilters
                  ? "Try adjusting your search query or selecting a different notification type."
                  : "You're all caught up. Important activity from Leads, WhatsApp messages, and Follow-Ups will appear here in real-time."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mylux-btn-submit"
                  style={{ marginTop: 16, fontSize: 12, padding: "8px 16px" }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groupedNotifications.today.length > 0 && (
                <div>
                  <div className="notif-date-group-label">TODAY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groupedNotifications.today.map((n) => (
                      <NotificationRow key={n.id} item={n} onRowClick={handleNotificationRowClick} getIcon={getIcon} />
                    ))}
                  </div>
                </div>
              )}

              {groupedNotifications.yesterday.length > 0 && (
                <div>
                  <div className="notif-date-group-label">YESTERDAY</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groupedNotifications.yesterday.map((n) => (
                      <NotificationRow key={n.id} item={n} onRowClick={handleNotificationRowClick} getIcon={getIcon} />
                    ))}
                  </div>
                </div>
              )}

              {groupedNotifications.thisWeek.length > 0 && (
                <div>
                  <div className="notif-date-group-label">THIS WEEK</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groupedNotifications.thisWeek.map((n) => (
                      <NotificationRow key={n.id} item={n} onRowClick={handleNotificationRowClick} getIcon={getIcon} />
                    ))}
                  </div>
                </div>
              )}

              {groupedNotifications.earlier.length > 0 && (
                <div>
                  <div className="notif-date-group-label">EARLIER</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groupedNotifications.earlier.map((n) => (
                      <NotificationRow key={n.id} item={n} onRowClick={handleNotificationRowClick} getIcon={getIcon} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NotificationRow({
  item,
  onRowClick,
  getIcon,
}: {
  item: NotificationItem;
  onRowClick: (n: NotificationItem) => void;
  getIcon: (type: string) => React.ReactNode;
}) {
  return (
    <div
      onClick={() => onRowClick(item)}
      className={`notif-item-card ${!item.is_read ? "unread" : ""}`}
    >
      <div className="notif-icon-box">{getIcon(item.type)}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 2 }}>
          <h4
            style={{
              fontSize: 14,
              fontWeight: item.is_read ? 600 : 800,
              color: item.is_read ? "#FFFFFF" : "#F5E6A3",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.title}
          </h4>
          <span style={{ fontSize: 11, color: "#777777", flexShrink: 0 }}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <p style={{ fontSize: 12.5, color: "#A0A0A0", margin: 0, lineHeight: 1.45 }}>
          {item.body}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "#666666" }}>
            {new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
          </span>

          <span style={{ fontSize: 11, fontWeight: 700, color: "#0066FF", display: "inline-flex", alignItems: "center", gap: 4 }}>
            View Details →
          </span>
        </div>
      </div>

      {!item.is_read && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#0066FF",
            boxShadow: "0 0 8px rgba(0, 229, 255, 0.8)",
            flexShrink: 0,
            marginTop: 6,
          }}
        />
      )}
    </div>
  );
}

function I({ children }: { children: React.ReactNode }) {
  return <i style={{ fontStyle: "normal", marginRight: 8 }}>{children}</i>;
}
