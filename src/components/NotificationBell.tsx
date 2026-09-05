"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ArrowRight,
  MessageSquare,
  UserPlus,
  Calendar,
  AlertTriangle,
  Send,
  Clock,
  Sparkles,
} from "lucide-react";

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
  onSelectEntity?: (entityType: string | null, entityId: string | null, actionUrl: string | null) => void;
}

export function NotificationBell({ onSelectEntity }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch unread count & initial notifications
  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    }
  };

  const fetchDropdownNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=8", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Real-time Server-Sent Events (SSE) Listener
  useEffect(() => {
    void fetchUnreadCount();

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource("/api/notifications/stream");

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data || "{}");
            if (data.type === "NOTIFICATION") {
              setUnreadCount(data.unreadCount ?? ((c) => c + 1));
              setNotifications((prev) => [data.notification, ...prev.slice(0, 7)]);
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
          // Reconnect SSE after 5s if disconnected
          reconnectTimeout = setTimeout(connectSSE, 5000);
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

  // Close dropdown on click outside & Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
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
  }, [isOpen]);

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
    if (!n.is_read) {
      void handleMarkRead(n.id);
    }
    setIsOpen(false);

    if (onSelectEntity) {
      onSelectEntity(n.entity_type, n.entity_id, n.action_url);
    } else if (n.action_url) {
      window.location.href = n.action_url;
    } else {
      window.location.href = "/notifications";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "WHATSAPP_NEW_MESSAGE":
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case "NEW_LEAD":
        return <UserPlus className="w-4 h-4 text-amber-400" />;
      case "FOLLOW_UP_DUE":
      case "FOLLOW_UP_OVERDUE":
        return <Calendar className="w-4 h-4 text-amber-400" />;
      case "WHATSAPP_CAMPAIGN_COMPLETED":
        return <Send className="w-4 h-4 text-blue-400" />;
      case "WHATSAPP_CONNECTION_ACTION_REQUIRED":
      case "WHATSAPP_CAMPAIGN_FAILED":
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#0066FF]" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return "";
    }
  };

  const badgeDisplay = unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : `${unreadCount}`;

  return (
    <div className="relative inline-block" ref={panelRef}>
      {/* Premium Electric Cyber Bell Button */}
      <button
        type="button"
        onClick={toggleOpen}
        className={`notif-bell-btn ${isOpen ? "open" : ""}`}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className={`w-5 h-5 transition-transform duration-200 ${isOpen ? "text-[#0066FF] scale-105" : "text-[#0066FF]"}`} />

        {/* Upper-right Gold Unread Badge */}
        {unreadCount > 0 && (
          <span className="notif-badge">
            {badgeDisplay}
          </span>
        )}
      </button>

      {/* Premium Dropdown Panel */}
      {isOpen && (
        <div
          className="notif-dropdown-panel"
          role="region"
          aria-label="Notifications dropdown"
        >
          {/* Header */}
          <div className="notif-dropdown-header">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-white text-base tracking-wide">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-extrabold text-[#0066FF] bg-amber-500/15 border border-amber-500/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-[#0066FF] hover:text-amber-300 hover:underline font-bold transition-colors flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List Container */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-800/40">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-400 tracking-wide">
                <div className="notif-skeleton-row" style={{ height: 50, marginBottom: 8 }} />
                <div className="notif-skeleton-row" style={{ height: 50, marginBottom: 8 }} />
                <div className="notif-skeleton-row" style={{ height: 50 }} />
              </div>
            ) : notifications.length === 0 ? (
              /* Premium Gold Centered Empty State */
              <div style={{ padding: "36px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", width: "100%" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.35)", boxShadow: "0 0 18px rgba(0, 229, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Bell style={{ width: 20, height: 20, color: "#0066FF" }} />
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#0066FF", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", letterSpacing: "0.03em", margin: "0 0 4px 0", textTransform: "uppercase" }}>
                  No Notifications Yet
                </h4>
                <p style={{ fontSize: 12, fontWeight: 400, color: "#9E9E9E", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", lineHeight: 1.5, margin: 0, maxWidth: 220, textAlign: "center" }}>
                  You're all caught up.<br />New activity will appear here.
                </p>
              </div>
            ) : (
              /* Notification Item Rows */
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 flex items-start gap-3.5 cursor-pointer transition-all duration-150 relative hover:bg-neutral-800/50 ${
                    !n.is_read
                      ? "bg-amber-500/[0.06] border-l-2 border-l-[#0066FF]"
                      : "bg-transparent border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#171821] border border-neutral-800/80 shrink-0 flex items-center justify-center mt-0.5 shadow-sm">
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h5
                        className={`text-xs sm:text-sm truncate ${
                          !n.is_read ? "text-[#F5E6A3] font-bold" : "text-neutral-200 font-medium"
                        }`}
                      >
                        {n.title}
                      </h5>
                      <span className="text-[11px] text-neutral-500 shrink-0 font-normal mt-0.5">
                        {formatTimeAgo(n.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed font-normal">
                      {n.body}
                    </p>
                  </div>

                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-[#0066FF] shrink-0 mt-2.5 shadow-[0_0_8px_rgba(0, 229, 255,0.8)]" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="notif-dropdown-footer">
            <a href="/notifications">
              VIEW ALL NOTIFICATIONS
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
