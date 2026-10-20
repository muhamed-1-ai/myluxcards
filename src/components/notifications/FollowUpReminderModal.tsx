"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  X,
  ExternalLink,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Phone,
  Video,
  Mail,
  MessageCircle,
  Calendar
} from "lucide-react";
import "./follow-up-reminder-modal.css";

export interface DueReminder {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string | null;
  contactNumber: string | null;
  email: string | null;
  type: string;
  note: string | null;
  scheduledAt: string;
  snoozedUntil: string | null;
  isOverdue: boolean;
  reminderVersion: number;
}

interface FollowUpReminderModalProps {
  onOpenLead?: (leadId: string, followUpId: string) => void;
}

export function FollowUpReminderModal({ onOpenLead }: FollowUpReminderModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [reminders, setReminders] = useState<DueReminder[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showQueueList, setShowQueueList] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const modalCardRef = useRef<HTMLDivElement | null>(null);

  // Local deduplication tracking for dismissed reminder versions
  // Key format: `${followUpId}:${reminderVersion}`
  const dismissedKeysRef = useRef<Set<string>>(new Set());

  // Mount tracking for portal
  useEffect(() => {
    setMounted(true);

    try {
      const stored = sessionStorage.getItem("zappit_dismissed_reminder_keys");
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          dismissedKeysRef.current = new Set(arr);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Check authentication status before initiating any authenticated background requests
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setIsAuthenticated(Boolean(data?.user?.id));
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ isAuthenticated?: boolean }>;
      if (typeof customEvent.detail?.isAuthenticated === "boolean") {
        setIsAuthenticated(customEvent.detail.isAuthenticated);
        if (!customEvent.detail.isAuthenticated) {
          setReminders([]);
        }
      } else {
        checkAuth();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "myluxcards_current_user") {
        if (!e.newValue) {
          setIsAuthenticated(false);
          setReminders([]);
        } else {
          checkAuth();
        }
      }
    };

    window.addEventListener("zappit:auth-changed", handleAuthChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("zappit:auth-changed", handleAuthChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [checkAuth]);

  // Fetch pending due reminders from API only when authenticated
  const fetchDueReminders = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("/api/follow-ups/reminders/due", {
        headers: { Accept: "application/json" },
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        setReminders([]);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.dueReminders)) {
        const eligible = data.dueReminders.filter((r: DueReminder) => {
          const key = `${r.id}:${r.reminderVersion}`;
          return !dismissedKeysRef.current.has(key);
        });

        setReminders(eligible);
        setCurrentIndex((prev) => (prev >= eligible.length ? 0 : prev));
      }
    } catch {
      // Ignore background fetch errors
    }
  }, [isAuthenticated]);

  // Sync across browser tabs via BroadcastChannel & localStorage
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchDueReminders();

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("zappit_reminders_sync");
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === "REMINDER_RESOLVED") {
          const resolvedId = event.data.followUpId;
          const resolvedVersion = event.data.reminderVersion;
          if (resolvedId && resolvedVersion !== undefined) {
            dismissedKeysRef.current.add(`${resolvedId}:${resolvedVersion}`);
          }
          setReminders((prev) => prev.filter((r) => r.id !== resolvedId));
        } else if (event.data?.type === "REFRESH_REMINDERS") {
          fetchDueReminders();
        }
      };
    }

    // Storage event listener for multi-tab sync fallback
    const onStorage = (e: StorageEvent) => {
      if (e.key === "zappit_last_reminder_action" && e.newValue) {
        const [actionType, id, ver] = e.newValue.split(":");
        if (actionType === "dismiss" && id && ver) {
          dismissedKeysRef.current.add(`${id}:${ver}`);
          setReminders((prev) => prev.filter((r) => r.id !== id));
        } else if (actionType === "refresh") {
          fetchDueReminders();
        }
      }
    };
    window.addEventListener("storage", onStorage);

    // Window focus & tab visibility change listener
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDueReminders();
      }
    };

    window.addEventListener("focus", fetchDueReminders);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", fetchDueReminders);

    // Foreground poll every 10s for responsive SLA
    const pollInterval = setInterval(fetchDueReminders, 10000);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", fetchDueReminders);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", fetchDueReminders);
      clearInterval(pollInterval);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [isAuthenticated, fetchDueReminders]);

  // Real-time Server-Sent Events (SSE) notification listener
  useEffect(() => {
    if (!isAuthenticated) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectSSE = () => {
      if (isUnmounted || !isAuthenticated) return;
      try {
        eventSource = new EventSource("/api/notifications/stream");

        eventSource.onopen = () => {
          fetchDueReminders();
        };

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data || "{}");
            if (
              data.type === "NOTIFICATION" &&
              (data.notification?.type?.startsWith("FOLLOW_UP_") ||
                data.notification?.entity_type === "lead_follow_up")
            ) {
              fetchDueReminders();
            } else if (data.type === "CONNECTED") {
              fetchDueReminders();
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
          if (!isUnmounted) {
            // Check if still authenticated before scheduling a reconnect
            fetch("/api/auth/me", { cache: "no-store" })
              .then((res) => res.json())
              .then((data) => {
                if (data?.user?.id && !isUnmounted) {
                  reconnectTimeout = setTimeout(connectSSE, 5000);
                } else if (!isUnmounted) {
                  setIsAuthenticated(false);
                  setReminders([]);
                }
              })
              .catch(() => {
                if (!isUnmounted) {
                  setIsAuthenticated(false);
                  setReminders([]);
                }
              });
          }
        };
      } catch {
        // Fallback to active interval polling
      }
    };

    connectSSE();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [isAuthenticated, fetchDueReminders]);

  const notifyOtherTabs = (followUpId: string, reminderVersion: number, action: "dismiss" | "complete" | "snooze") => {
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: "REMINDER_RESOLVED",
          followUpId,
          reminderVersion,
          action,
        });
      }
      localStorage.setItem("zappit_last_reminder_action", `${action}:${followUpId}:${reminderVersion}:${Date.now()}`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("zappit-calendar-updated"));
      }
    } catch {
      // ignore
    }
  };

  const removeCurrentReminder = (id: string, reminderVersion: number, action: "dismiss" | "complete" | "snooze") => {
    dismissedKeysRef.current.add(`${id}:${reminderVersion}`);
    try {
      sessionStorage.setItem(
        "zappit_dismissed_reminder_keys",
        JSON.stringify(Array.from(dismissedKeysRef.current))
      );
    } catch {
      // ignore
    }

    notifyOtherTabs(id, reminderVersion, action);

    setReminders((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (currentIndex >= next.length && next.length > 0) {
        setCurrentIndex(next.length - 1);
      }
      return next;
    });
  };

  // Handler: Open Lead
  const handleOpenLead = async (reminder: DueReminder) => {
    if (loadingAction) return;
    setActionError(null);
    setLoadingAction(`open-${reminder.id}`);
    try {
      // Acknowledge reminder on client so popup releases focus and dismisses cleanly
      await fetch(`/api/follow-ups/reminders/${reminder.id}/dismiss`, { method: "POST" }).catch(() => {});
      removeCurrentReminder(reminder.id, reminder.reminderVersion, "dismiss");
    } finally {
      setLoadingAction(null);
    }

    if (onOpenLead) {
      onOpenLead(reminder.leadId, reminder.id);
    } else {
      router.push(`/dashboard?tab=leads&leadId=${reminder.leadId}&followUpId=${reminder.id}`);
    }
  };

  // Handler: Mark Completed
  const handleComplete = async (reminder: DueReminder) => {
    if (loadingAction) return;
    setActionError(null);
    setLoadingAction(`complete-${reminder.id}`);
    try {
      const res = await fetch(`/api/follow-ups/reminders/${reminder.id}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        removeCurrentReminder(reminder.id, reminder.reminderVersion, "complete");
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.message || "Could not mark follow-up as complete. Please try again.");
      }
    } catch (err) {
      console.error("[FollowUpModal] Error completing follow-up:", err);
      setActionError("Network error completing follow-up. Please check your connection.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Handler: Snooze 15 Minutes
  const handleSnooze = async (reminder: DueReminder) => {
    if (loadingAction) return;
    setActionError(null);
    setLoadingAction(`snooze-${reminder.id}`);
    try {
      const res = await fetch(`/api/follow-ups/reminders/${reminder.id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 15 }),
      });
      if (res.ok) {
        removeCurrentReminder(reminder.id, reminder.reminderVersion, "snooze");
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.message || "Could not snooze follow-up. Please try again.");
      }
    } catch (err) {
      console.error("[FollowUpModal] Error snoozing follow-up:", err);
      setActionError("Network error snoozing follow-up. Please check your connection.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Handler: Dismiss
  const handleDismiss = async (reminder: DueReminder) => {
    if (loadingAction) return;
    setActionError(null);
    setLoadingAction(`dismiss-${reminder.id}`);
    try {
      const res = await fetch(`/api/follow-ups/reminders/${reminder.id}/dismiss`, {
        method: "POST",
      });
      if (res.ok) {
        removeCurrentReminder(reminder.id, reminder.reminderVersion, "dismiss");
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.message || "Could not dismiss reminder. Please try again.");
      }
    } catch (err) {
      console.error("[FollowUpModal] Error dismissing reminder:", err);
      setActionError("Network error dismissing reminder.");
    } finally {
      setLoadingAction(null);
    }
  };

  const activeReminder = reminders[currentIndex] || reminders[0];

  // Keyboard accessibility: Escape key listener
  useEffect(() => {
    if (!activeReminder) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss(activeReminder);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeReminder, handleDismiss]);

  // Focus management on mount
  useEffect(() => {
    if (activeReminder && modalCardRef.current) {
      const primaryBtn = modalCardRef.current.querySelector<HTMLButtonElement>(".fur-btn-primary");
      if (primaryBtn) {
        primaryBtn.focus();
      }
    }
  }, [activeReminder?.id]);

  if (!mounted || reminders.length === 0 || !activeReminder) {
    return null;
  }

  // Format local date and time in user's configured timezone
  const dateObj = new Date(activeReminder.scheduledAt);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }) + " • " + dateObj.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : activeReminder.scheduledAt;

  const isOverdue = activeReminder.isOverdue;

  // Icon selector based on follow-up type
  const renderTypeIcon = (type: string) => {
    const t = type.toUpperCase();
    if (t === "CALL") return <Phone className="w-3 h-3" />;
    if (t === "MEETING") return <Video className="w-3 h-3" />;
    if (t === "WHATSAPP") return <MessageCircle className="w-3 h-3" />;
    if (t === "EMAIL") return <Mail className="w-3 h-3" />;
    return <Calendar className="w-3 h-3" />;
  };

  const modalNode = (
    <div
      id="zappit-follow-up-reminder-portal"
      className="fur-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fur-lead-name"
    >
      <div className="fur-card" ref={modalCardRef}>
        <div className="fur-body-scroll">
          {/* 1. HEADER SECTION */}
          <div className="fur-header">
            <div className="fur-header-left">
              <div className={`fur-icon-wrapper ${isOverdue ? "overdue" : ""}`}>
                <Bell className="w-4 h-4" />
              </div>
              <span className="fur-title-label">Follow-up reminder</span>
              
              {/* Overdue / Due Now status badge */}
              <span className={`fur-status-badge ${isOverdue ? "overdue" : "due"}`}>
                <span className="fur-status-dot" />
                {isOverdue ? "Overdue" : "Due now"}
              </span>

              {reminders.length > 1 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--fur-text-muted)", marginLeft: 2 }}>
                  ({currentIndex + 1} of {reminders.length})
                </span>
              )}
            </div>

            <div className="fur-header-right">
              {reminders.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowQueueList(!showQueueList)}
                  className="fur-queue-toggle-btn"
                >
                  {showQueueList ? "Hide List" : `Queue (${reminders.length})`}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDismiss(activeReminder)}
                disabled={loadingAction !== null}
                aria-label="Close reminder"
                className="fur-close-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Collapsible Queue List */}
          {showQueueList && reminders.length > 1 && (
            <div className="fur-queue-list">
              {reminders.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setShowQueueList(false);
                  }}
                  className={`fur-queue-item ${idx === currentIndex ? "active" : ""}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.leadName}
                    </span>
                    {item.leadCompany && (
                      <span style={{ opacity: 0.7, fontSize: 11 }}>• {item.leadCompany}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 8, whiteSpace: "nowrap" }}>
                    {new Date(item.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 2. LEAD SECTION */}
          <div className="fur-lead-section">
            <div className="fur-lead-headline">
              <h2 id="fur-lead-name" className="fur-lead-name">
                {activeReminder.leadName}
              </h2>
              <span className="fur-type-badge">
                {renderTypeIcon(activeReminder.type)}
                {activeReminder.type || "CALL"}
              </span>
            </div>

            {activeReminder.leadCompany && (
              <p className="fur-lead-company">
                {activeReminder.leadCompany}
              </p>
            )}
          </div>

          {/* 3. SCHEDULED TIME SECTION */}
          <div className="fur-schedule-section">
            <Clock className="fur-schedule-icon" />
            <span className="fur-schedule-text">{formattedDate}</span>
          </div>

          {/* 4. NOTE SECTION */}
          <div className="fur-note-section">
            <span className="fur-note-header">Note</span>
            {activeReminder.note && activeReminder.note.trim() ? (
              <p className="fur-note-content">{activeReminder.note.trim()}</p>
            ) : (
              <p className="fur-note-empty">No notes added.</p>
            )}
          </div>

          {/* Multiple reminders stepper navigation */}
          {reminders.length > 1 && (
            <div className="fur-queue-stepper">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : reminders.length - 1))}
                className="fur-stepper-btn"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" /> Previous
              </button>
              <span>{currentIndex + 1} of {reminders.length}</span>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev < reminders.length - 1 ? prev + 1 : 0))}
                className="fur-stepper-btn"
              >
                Next <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          )}

          {/* Inline Action Error Banner */}
          {actionError && (
            <div className="fur-action-error">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 2 }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 5. ACTIONS FOOTER */}
          <div className="fur-footer-actions">
            {/* Main Primary / Secondary Row */}
            <div className="fur-button-row main-actions">
              <button
                type="button"
                onClick={() => handleOpenLead(activeReminder)}
                disabled={loadingAction !== null}
                className="fur-btn fur-btn-primary"
              >
                {loadingAction === `open-${activeReminder.id}` ? (
                  <>
                    <span className="fur-spinner" /> Opening...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" /> Open Lead
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleComplete(activeReminder)}
                disabled={loadingAction !== null}
                className="fur-btn fur-btn-secondary"
              >
                {loadingAction === `complete-${activeReminder.id}` ? (
                  <>
                    <span className="fur-spinner" /> Marking done...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Mark Done
                  </>
                )}
              </button>
            </div>

            {/* Quieter Secondary Controls Row */}
            <div className="fur-button-row secondary-actions">
              <button
                type="button"
                onClick={() => handleSnooze(activeReminder)}
                disabled={loadingAction !== null}
                className="fur-btn fur-btn-quieter"
              >
                {loadingAction === `snooze-${activeReminder.id}` ? (
                  <>
                    <span className="fur-spinner" /> Snoozing...
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" /> Snooze 15m
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDismiss(activeReminder)}
                disabled={loadingAction !== null}
                className="fur-btn fur-btn-quieter"
              >
                {loadingAction === `dismiss-${activeReminder.id}` ? (
                  <>
                    <span className="fur-spinner" /> Dismissing...
                  </>
                ) : (
                  "Dismiss"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalNode, document.body) : null;
}
