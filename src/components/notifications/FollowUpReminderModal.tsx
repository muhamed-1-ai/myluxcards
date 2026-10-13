"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

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
  const [reminders, setReminders] = useState<DueReminder[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showQueueList, setShowQueueList] = useState(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Local deduplication tracking for dismissed reminder versions
  // Key format: `${followUpId}:${reminderVersion}`
  const dismissedKeysRef = useRef<Set<string>>(new Set());

  // Mount tracking for portal
  useEffect(() => {
    setMounted(true);

    // Initialize dismissed keys from sessionStorage if present
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

  // Fetch pending due reminders from API
  const fetchDueReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/follow-ups/reminders/due", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.dueReminders)) {
        // Filter out reminders that were explicitly dismissed for this exact reminder version
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
  }, []);

  // Sync across browser tabs via BroadcastChannel & localStorage
  useEffect(() => {
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

    // Window focus & tab visibility change listener (immediate pickup on resume/focus)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDueReminders();
      }
    };

    window.addEventListener("focus", fetchDueReminders);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", fetchDueReminders);

    // Foreground poll every 10s for responsive latency (< 10s SLA)
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
  }, [fetchDueReminders]);

  // Real-time Server-Sent Events (SSE) notification listener with auto-reconnect
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectSSE = () => {
      if (isUnmounted) return;
      try {
        eventSource = new EventSource("/api/notifications/stream");

        eventSource.onopen = () => {
          // Connected, fetch immediately in case any event arrived during reconnect
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
            // Reconnect after 4s
            reconnectTimeout = setTimeout(connectSSE, 4000);
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
  }, [fetchDueReminders]);

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
    } catch {
      // ignore
    }
  };

  const removeCurrentReminder = (id: string, reminderVersion: number, action: "dismiss" | "complete" | "snooze") => {
    // Add to local dismissed set for this specific version
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
  const handleOpenLead = (reminder: DueReminder) => {
    if (onOpenLead) {
      onOpenLead(reminder.leadId, reminder.id);
    } else {
      router.push(`/dashboard?tab=leads&leadId=${reminder.leadId}&followUpId=${reminder.id}`);
    }
  };

  // Handler: Mark Completed
  const handleComplete = async (reminder: DueReminder) => {
    setLoadingAction(`complete-${reminder.id}`);
    try {
      const res = await fetch(`/api/follow-ups/reminders/${reminder.id}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        removeCurrentReminder(reminder.id, reminder.reminderVersion, "complete");
      }
    } catch (err) {
      console.error("[FollowUpModal] Error completing follow-up:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Handler: Snooze 15 Minutes (increments version so new snooze becomes eligible when due)
  const handleSnooze = async (reminder: DueReminder) => {
    setLoadingAction(`snooze-${reminder.id}`);
    try {
      const res = await fetch(`/api/follow-ups/reminders/${reminder.id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 15 }),
      });
      if (res.ok) {
        removeCurrentReminder(reminder.id, reminder.reminderVersion, "snooze");
      }
    } catch (err) {
      console.error("[FollowUpModal] Error snoozing follow-up:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Handler: Dismiss (acknowledges reminder without marking follow-up completed)
  const handleDismiss = async (reminder: DueReminder) => {
    setLoadingAction(`dismiss-${reminder.id}`);
    try {
      const res = await fetch(`/api/follow-ups/reminders/${reminder.id}/dismiss`, {
        method: "POST",
      });
      if (res.ok) {
        removeCurrentReminder(reminder.id, reminder.reminderVersion, "dismiss");
      }
    } catch (err) {
      console.error("[FollowUpModal] Error dismissing reminder:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  if (!mounted || reminders.length === 0) {
    return null;
  }

  const activeReminder = reminders[currentIndex] || reminders[0];
  if (!activeReminder) return null;

  // Format local date and time in user's configured timezone
  const dateObj = new Date(activeReminder.scheduledAt);
  const formattedDateTime = dateObj.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const isOverdue = activeReminder.isOverdue;

  const modalNode = (
    <div
      id="zappit-follow-up-reminder-portal"
      className="fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      style={{ zIndex: 999999, pointerEvents: "auto" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all transform flex flex-col"
        style={{ maxHeight: "90vh", zIndex: 1000000, pointerEvents: "auto" }}
      >
        {/* Header Bar */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b ${
            isOverdue
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                isOverdue
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 animate-pulse"
                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOverdue ? "bg-amber-500" : "bg-blue-500"
                }`}
              />
              {isOverdue ? "Follow-up Overdue" : "Follow-up Due"}
            </span>

            {reminders.length > 1 && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {currentIndex + 1} of {reminders.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {reminders.length > 1 && (
              <button
                type="button"
                onClick={() => setShowQueueList(!showQueueList)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded focus:outline-none"
              >
                {showQueueList ? "Hide List" : `Queue (${reminders.length})`}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDismiss(activeReminder)}
              disabled={loadingAction !== null}
              aria-label="Close reminder"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Collapsible Queue List */}
        {showQueueList && reminders.length > 1 && (
          <div className="max-h-40 overflow-y-auto border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 space-y-1">
            {reminders.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  setShowQueueList(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  idx === currentIndex
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="truncate">
                  <span className="font-semibold">{item.leadName}</span>
                  {item.leadCompany && <span className="opacity-75"> • {item.leadCompany}</span>}
                </div>
                <span className="text-[11px] opacity-75 ml-2 whitespace-nowrap">
                  {new Date(item.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Lead Name & Details */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2
                id="reminder-title"
                className="text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate"
              >
                {activeReminder.leadName}
              </h2>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {activeReminder.type}
              </span>
            </div>
            {activeReminder.leadCompany && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {activeReminder.leadCompany}
              </p>
            )}
          </div>

          {/* Follow-up Note / Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-750">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Summary
            </span>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words">
              {activeReminder.note || "No specific note provided for this scheduled follow-up."}
            </p>
          </div>

          {/* Scheduled Date & Time */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{formattedDateTime}</span>
          </div>

          {/* Queue Navigation controls if multiple */}
          {reminders.length > 1 && (
            <div className="flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : reminders.length - 1))}
                className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 font-medium px-2 py-1"
              >
                ← Previous
              </button>
              <span>Swipe or click to view others</span>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev < reminders.length - 1 ? prev + 1 : 0))}
                className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 font-medium px-2 py-1"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Open Lead */}
          <button
            type="button"
            onClick={() => handleOpenLead(activeReminder)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Lead
          </button>

          {/* Mark Completed */}
          <button
            type="button"
            onClick={() => handleComplete(activeReminder)}
            disabled={loadingAction !== null}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 active:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {loadingAction === `complete-${activeReminder.id}` ? "Saving..." : "Mark Done"}
          </button>

          {/* Snooze 15 Minutes */}
          <button
            type="button"
            onClick={() => handleSnooze(activeReminder)}
            disabled={loadingAction !== null}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 active:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {loadingAction === `snooze-${activeReminder.id}` ? "Snoozing..." : "Snooze 15m"}
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => handleDismiss(activeReminder)}
            disabled={loadingAction !== null}
            className="w-full inline-flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 active:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
          >
            {loadingAction === `dismiss-${activeReminder.id}` ? "Closing..." : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalNode, document.body) : null;
}
