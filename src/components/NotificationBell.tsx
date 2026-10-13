"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CheckCheck,
  Check,
  ArrowRight,
  MessageSquare,
  UserPlus,
  Calendar,
  AlertTriangle,
  Send,
  Clock,
  Sparkles,
  X,
  RefreshCw,
} from "lucide-react";
import { apiFetch, refreshSession } from "@/lib/apiClient";
import "./notifications/notification-sheet.css";

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface NotificationBellProps {
  onSelectEntity?: (
    entityType: string | null,
    entityId: string | null,
    actionUrl: string | null,
    notificationId?: string
  ) => void;
}

interface DateGroup {
  label: string;
  items: NotificationItem[];
}

export function NotificationBell({ onSelectEntity }: NotificationBellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Responsive breakpoint tracking (< 640px)
  useEffect(() => {
    setMounted(true);
    const mql = window.matchMedia("(max-width: 640px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Fetch unread count & initial notifications
  const fetchUnreadCount = async () => {
    const res = await apiFetch<{ unreadCount: number }>("/api/notifications/unread-count");
    if (res.ok && res.data) {
      setUnreadCount(res.data.unreadCount || 0);
    }
  };

  const fetchDropdownNotifications = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>(
        "/api/notifications?limit=20"
      );
      if (res.ok && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      } else {
        setFetchError("Unable to load notifications. Please try again.");
      }
    } catch {
      setFetchError("Unable to load notifications. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Real-time Server-Sent Events (SSE) Listener
  useEffect(() => {
    void fetchUnreadCount();

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;

    const connectSSE = () => {
      try {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        eventSource = new EventSource("/api/notifications/stream");

        eventSource.onopen = () => {
          reconnectAttempts = 0;
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data || "{}");
            if (data.type === "NOTIFICATION") {
              setUnreadCount(data.unreadCount ?? ((c: number) => c + 1));
              setNotifications((prev) => [data.notification, ...prev.slice(0, 19)]);
            } else if (data.type === "UNREAD_COUNT") {
              setUnreadCount(data.unreadCount ?? 0);
            }
          } catch {
            // ignore
          }
        };

        eventSource.onerror = async () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts += 1;
            const refreshed = await refreshSession();
            if (refreshed) {
              const backoffMs = Math.min(30000, 3000 * reconnectAttempts);
              reconnectTimeout = setTimeout(connectSSE, backoffMs);
            }
          }
        };
      } catch {
        // Fallback gracefully
      }
    };

    connectSSE();

    // Fallback periodic poll every 30 seconds
    const interval = setInterval(() => {
      void fetchUnreadCount();
    }, 30000);

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(interval);
    };
  }, []);

  // Lock background scroll when mobile bottom sheet is open
  useEffect(() => {
    if (isOpen && isMobile) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isMobile]);

  // Close dropdown on click outside & Escape key (dismissal does NOT mark notifications read)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isMobile && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isMobile]);

  const toggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      void fetchDropdownNotifications();
    }
  };

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

  const handleMarkAllRead = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (n: NotificationItem) => {
    // If notification targets a lead or follow-up, do NOT mark read until the lead fetch actually succeeds!
    const isLeadEntity =
      n.entity_type === "lead" ||
      n.entity_type === "lead_follow_up" ||
      n.type?.startsWith("FOLLOW_UP");

    if (!isLeadEntity && !n.is_read) {
      void handleMarkRead(n.id);
    }
    setIsOpen(false);

    if (onSelectEntity) {
      onSelectEntity(n.entity_type, n.entity_id, n.action_url, !n.is_read ? n.id : undefined);
    } else if (n.action_url) {
      try {
        const url = new URL(n.action_url, window.location.origin);
        if (isLeadEntity && !n.is_read) {
          url.searchParams.set("notificationId", n.id);
        }
        window.location.href = url.pathname + url.search;
      } catch {
        window.location.href = n.action_url;
      }
    } else {
      window.location.href = "/notifications";
    }
  };

  const getIconConfig = (type: string) => {
    switch (type) {
      case "FOLLOW_UP_DUE":
      case "FOLLOW_UP_OVERDUE":
        return {
          icon: <Calendar className="w-4 h-4 text-amber-500 dark:text-amber-400" />,
          bg: "bg-amber-500/10 border-amber-500/25 dark:bg-amber-500/15 text-amber-500",
        };
      case "WHATSAPP_NEW_MESSAGE":
        return {
          icon: <MessageSquare className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />,
          bg: "bg-emerald-500/10 border-emerald-500/25 dark:bg-emerald-500/15 text-emerald-500",
        };
      case "NEW_LEAD":
        return {
          icon: <UserPlus className="w-4 h-4 text-blue-500 dark:text-blue-400" />,
          bg: "bg-blue-500/10 border-blue-500/25 dark:bg-blue-500/15 text-blue-500",
        };
      case "WHATSAPP_CAMPAIGN_COMPLETED":
        return {
          icon: <Send className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />,
          bg: "bg-cyan-500/10 border-cyan-500/25 dark:bg-cyan-500/15 text-cyan-500",
        };
      case "WHATSAPP_CONNECTION_ACTION_REQUIRED":
      case "WHATSAPP_CAMPAIGN_FAILED":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />,
          bg: "bg-rose-500/10 border-rose-500/25 dark:bg-rose-500/15 text-rose-500",
        };
      default:
        return {
          icon: <Sparkles className="w-4 h-4 text-[#0066FF] dark:text-[#008CFF]" />,
          bg: "bg-blue-500/10 border-blue-500/25 dark:bg-blue-500/15 text-[#0066FF]",
        };
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (isNaN(diffSec) || diffSec < 0) return "Just now";
      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // Group notifications chronologically by date
  const groupedNotifications = useMemo(() => {
    if (!notifications || notifications.length === 0) return [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];

    for (const item of notifications) {
      const time = new Date(item.created_at).getTime();
      if (isNaN(time)) {
        earlier.push(item);
      } else if (time >= todayStart) {
        today.push(item);
      } else if (time >= yesterdayStart) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    }

    const groups: DateGroup[] = [];
    if (today.length > 0) groups.push({ label: "Today", items: today });
    if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
    if (earlier.length > 0) groups.push({ label: "Earlier", items: earlier });

    return groups;
  }, [notifications]);

  const badgeDisplay = unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : `${unreadCount}`;

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Bell Button */}
      <button
        id="notif-bell-btn"
        type="button"
        onClick={toggleOpen}
        className={`notif-bell-btn ${isOpen ? "open" : ""}`}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-controls={isMobile ? "notif-mobile-sheet" : "notif-dropdown-panel"}
      >
        <Bell className={`w-5 h-5 transition-transform duration-200 ${isOpen ? "text-[#0066FF] scale-105" : "text-[#0066FF]"}`} />

        {/* Upper-right Unread Badge */}
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {badgeDisplay}
          </span>
        )}
      </button>

      {/* DESKTOP NOTIFICATION DROPDOWN PANEL (Preserved for min-width: 641px) */}
      {isOpen && !isMobile && (
        <div
          id="notif-dropdown-panel"
          className="notif-dropdown-panel"
          role="region"
          aria-label="Notifications panel"
        >
          {/* Header */}
          <div className="notif-dropdown-header">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                Notifications
              </h3>
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold text-[#0066FF] bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 rounded-full">
                  {unreadCount} unread
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-full">
                  0 unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-[#0066FF] hover:text-blue-700 dark:hover:text-[#00E5FF] flex items-center gap-1.5 transition-colors px-2 py-1 rounded-md hover:bg-blue-500/10 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Scrollable Notification List Container */}
          <div className="overflow-y-auto max-h-[min(420px,calc(100vh-190px))] divide-y divide-[var(--border-color)]/60">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((key) => (
                  <div key={key} className="flex items-start gap-3 p-2 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-[var(--border-color)] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-[var(--border-color)] rounded w-3/4" />
                      <div className="h-3 bg-[var(--border-color)]/60 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="py-8 px-6 text-center">
                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <p className="text-xs text-[var(--text-secondary)] mb-3">{fetchError}</p>
                <button
                  type="button"
                  onClick={() => void fetchDropdownNotifications()}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#0066FF] text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 flex items-center justify-center mb-3 text-[#0066FF]">
                  <Bell className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  No Notifications Yet
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[240px]">
                  You&apos;re all caught up. Follow-up reminders and activity updates will appear here.
                </p>
              </div>
            ) : (
              groupedNotifications.map((group) => (
                <div key={group.label} className="relative">
                  <div className="px-4 py-1.5 text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase bg-[var(--bg-secondary)]/95 backdrop-blur-sm border-b border-[var(--border-color)]/60 sticky top-0 z-10">
                    {group.label}
                  </div>
                  <div className="divide-y divide-[var(--border-color)]/40">
                    {group.items.map((n) => {
                      const iconConfig = getIconConfig(n.type);
                      return (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleNotificationClick(n)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleNotificationClick(n);
                            }
                          }}
                          className={`p-3.5 sm:p-4 flex items-start gap-3 cursor-pointer transition-colors relative group focus:outline-none focus:bg-[var(--surface-hover)] ${
                            !n.is_read
                              ? "bg-blue-500/[0.04] dark:bg-blue-600/[0.07] hover:bg-blue-500/[0.08] dark:hover:bg-blue-600/[0.12]"
                              : "bg-transparent hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl border shrink-0 flex items-center justify-center mt-0.5 shadow-sm ${iconConfig.bg}`}
                          >
                            {iconConfig.icon}
                          </div>

                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <h5
                                className={`text-xs sm:text-[13px] leading-snug break-words ${
                                  !n.is_read
                                    ? "text-[var(--text-primary)] font-semibold"
                                    : "text-[var(--text-secondary)] font-medium"
                                }`}
                              >
                                {n.title}
                              </h5>
                              <span className="text-[11px] text-[var(--text-muted)] shrink-0 whitespace-nowrap font-normal">
                                {formatTimeAgo(n.created_at)}
                              </span>
                            </div>

                            <p className="text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed break-words mt-1">
                              {n.body}
                            </p>
                          </div>

                          <div className="shrink-0 flex items-center gap-1 self-start mt-1">
                            {!n.is_read && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkRead(n.id, e)}
                                  title="Mark as read"
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[var(--text-muted)] hover:text-[#0066FF] hover:bg-blue-500/10 transition-all"
                                  aria-label="Mark notification as read"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <span
                                  className="w-2 h-2 rounded-full bg-[#0066FF] shadow-[0_0_8px_rgba(0,102,255,0.7)]"
                                  aria-label="Unread notification"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sticky Footer */}
          <div className="notif-dropdown-footer">
            <a href="/notifications">
              VIEW ALL NOTIFICATIONS
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* MOBILE NOTIFICATION BOTTOM SHEET (Rendered via React Portal) */}
      {isOpen && isMobile && mounted && createPortal(
        <>
          {/* Dimmed Backdrop */}
          <div
            id="notif-sheet-backdrop"
            className="notif-sheet-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Card */}
          <div
            id="notif-mobile-sheet"
            className="notif-sheet-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-sheet-title"
          >
            {/* Pull Handle Bar */}
            <div className="notif-sheet-handle-container">
              <div className="notif-sheet-handle-bar" />
            </div>

            {/* 1. Header (Fixed at top) */}
            <div className="notif-sheet-header">
              <div className="notif-sheet-title-group">
                <h3 id="notif-sheet-title" className="notif-sheet-title">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="notif-sheet-unread-badge">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="notif-sheet-actions">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="notif-sheet-mark-all-btn"
                    title="Mark all notifications as read"
                  >
                    <CheckCheck style={{ width: 14, height: 14 }} />
                    <span>Mark all read</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="notif-sheet-close-btn"
                  aria-label="Close notifications"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {/* 2. Scrollable Body */}
            <div className="notif-sheet-body">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((key) => (
                    <div key={key} className="flex items-start gap-3 p-3 animate-pulse border-b border-[var(--border-color)]">
                      <div className="w-10 h-10 rounded-xl bg-[var(--border-color)] shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-[var(--border-color)] rounded w-3/4" />
                        <div className="h-3.5 bg-[var(--border-color)]/60 rounded w-full" />
                        <div className="h-3 bg-[var(--border-color)]/40 rounded w-1/4 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : fetchError ? (
                <div className="notif-sheet-error-state">
                  <AlertTriangle style={{ width: 40, height: 40, color: "#EF4444", marginBottom: 10 }} />
                  <div className="notif-sheet-empty-title">Failed to load notifications</div>
                  <div className="notif-sheet-empty-desc">{fetchError}</div>
                  <button
                    type="button"
                    onClick={() => void fetchDropdownNotifications()}
                    className="notif-sheet-retry-btn"
                  >
                    Retry
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notif-sheet-empty-state">
                  <div className="notif-sheet-empty-icon">
                    <Bell style={{ width: 24, height: 24 }} />
                  </div>
                  <h4 className="notif-sheet-empty-title">No Notifications Yet</h4>
                  <p className="notif-sheet-empty-desc">
                    You&apos;re all caught up. Follow-up reminders and activity updates will appear here.
                  </p>
                </div>
              ) : (
                groupedNotifications.map((group) => (
                  <div key={group.label}>
                    {/* Sticky Date Group Header */}
                    <div className="notif-sheet-date-header">
                      {group.label}
                    </div>

                    {/* Notification Rows */}
                    <div>
                      {group.items.map((n) => {
                        const iconConfig = getIconConfig(n.type);
                        return (
                          <div
                            key={n.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleNotificationClick(n)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleNotificationClick(n);
                              }
                            }}
                            className={`notif-sheet-row ${!n.is_read ? "unread" : ""}`}
                          >
                            {/* Left Icon Container */}
                            <div className={`notif-sheet-icon-box ${iconConfig.bg}`}>
                              {iconConfig.icon}
                            </div>

                            {/* Flexible Text Content Column */}
                            <div className="notif-sheet-text-col">
                              <h5 className="notif-sheet-item-title">
                                {n.title}
                              </h5>

                              <p className="notif-sheet-item-body">
                                {n.body}
                              </p>

                              {/* Separate Timestamp Below Message */}
                              <div className="notif-sheet-item-time">
                                <Clock style={{ width: 12, height: 12 }} />
                                <span>{formatTimeAgo(n.created_at)}</span>
                              </div>
                            </div>

                            {/* Unread Indicator & Quick Action */}
                            <div className="notif-sheet-status-box">
                              {!n.is_read && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkRead(n.id, e)}
                                    title="Mark as read"
                                    className="notif-sheet-quick-read-btn"
                                    aria-label="Mark notification as read"
                                  >
                                    <Check style={{ width: 14, height: 14 }} />
                                  </button>
                                  <span
                                    className="notif-sheet-unread-dot"
                                    aria-label="Unread notification"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 3. Footer (Fixed at bottom) */}
            <div className="notif-sheet-footer">
              <a
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="notif-sheet-view-all-btn"
              >
                <span>View all notifications</span>
                <ArrowRight style={{ width: 15, height: 15 }} />
              </a>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
