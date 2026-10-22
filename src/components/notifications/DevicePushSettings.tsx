"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getPushStatus,
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
  sendTestNotification,
  type PushStatusInfo,
} from "@/lib/pushClient";

interface DevicePushSettingsProps {
  showPreviews?: boolean;
  onTogglePreviews?: (enabled: boolean) => void;
}

export function DevicePushSettings({ showPreviews = true, onTogglePreviews }: DevicePushSettingsProps) {
  const [statusInfo, setStatusInfo] = useState<PushStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const info = await getPushStatus();
      setStatusInfo(info);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleEnablePush = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await subscribeDeviceToPush();
      setStatusInfo(res.statusInfo);
      if (res.success) {
        setMessage({
          type: "success",
          text: "Follow-up notifications successfully enabled on this device! You will receive alerts even when ZAPPIT is closed.",
        });
      } else {
        setMessage({
          type: "error",
          text: res.error || "Could not enable notifications.",
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to subscribe device." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisablePush = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await unsubscribeDeviceFromPush();
      if (res.success) {
        setMessage({ type: "info", text: "Notifications disabled on this device." });
        await refreshStatus();
      } else {
        setMessage({ type: "error", text: res.error || "Could not disable notifications." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to unsubscribe." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTest = async () => {
    setTestLoading(true);
    setMessage(null);
    try {
      const res = await sendTestNotification();
      if (res.ok) {
        setMessage({
          type: "success",
          text: res.message || "Test notification dispatched through server push service!",
        });
      } else {
        setMessage({
          type: "error",
          text: res.message || "Failed to dispatch test notification.",
        });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to send test push." });
    } finally {
      setTestLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs text-slate-500">
        Checking device notification capabilities...
      </div>
    );
  }

  const status = statusInfo?.status || "UNSUPPORTED";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Title & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🔔 Browser Web Push Reminders</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Receive follow-up reminders outside the website even when ZAPPIT is closed.
          </p>
        </div>

        {/* Status Badge */}
        <div>
          {status === "ENABLED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Enabled on this device
            </span>
          )}
          {status === "NOT_ENABLED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Not enabled
            </span>
          )}
          {status === "PERMISSION_BLOCKED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Permission blocked
            </span>
          )}
          {status === "IOS_SETUP_REQUIRED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Home Screen Setup Required
            </span>
          )}
          {status === "UNSUPPORTED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
              Unsupported on this browser
            </span>
          )}
        </div>
      </div>

      {/* Details text & Guidance */}
      {statusInfo?.details && status !== "PERMISSION_BLOCKED" && status !== "IOS_SETUP_REQUIRED" && (
        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200/60 dark:border-slate-750">
          {statusInfo.details}
        </p>
      )}

      {/* iOS Specific Guidance Card */}
      {status === "IOS_SETUP_REQUIRED" && (
        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
          <strong className="block font-semibold">How to enable on iPhone/iPad (iOS 16.4+):</strong>
          <ol className="list-decimal pl-4 space-y-1 text-amber-900 dark:text-amber-300">
            <li>Tap the <strong>Share</strong> button (box with upward arrow) at the bottom of Safari.</li>
            <li>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.</li>
            <li>Launch the installed <strong>ZAPPIT</strong> app icon from your Home Screen.</li>
            <li>Return to Notification Preferences and tap <strong>Enable Follow-up Notifications</strong>.</li>
          </ol>
        </div>
      )}

      {/* Permission Blocked Guidance Card */}
      {status === "PERMISSION_BLOCKED" && (
        <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
          <strong className="block font-semibold">Notifications blocked in browser settings:</strong>
          <p>
            Your browser has blocked notifications for this site. To unblock:
          </p>
          <ol className="list-decimal pl-4 space-y-0.5 text-rose-900 dark:text-rose-300">
            <li>Click the <strong>tune/lock icon</strong> or site settings button in your browser address bar.</li>
            <li>Find <strong>Notifications</strong> and change it to <strong>Allow</strong>.</li>
            <li>Return here and click <strong>&quot;Check Again&quot;</strong> below.</li>
          </ol>
          <p className="text-[11px] opacity-80 pt-1">
            Note: In-app popup reminders remain active while ZAPPIT is open in your tab.
          </p>
        </div>
      )}

      {/* Privacy Preview Toggle */}
      {onTogglePreviews && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Notification Previews (Lock Screen Privacy)
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {showPreviews
                ? "Show lead name and reminder summary in browser notifications"
                : "Hide lead details and display generic 'Follow-up due' alerts"}
            </div>
          </div>
          <label className="notif-toggle-switch">
            <input
              type="checkbox"
              checked={showPreviews}
              onChange={(e) => onTogglePreviews(e.target.checked)}
            />
            <span className="notif-toggle-slider" />
          </label>
        </div>
      )}

      {/* Feedback Message */}
      {message && (
        <div
          className={`p-3 rounded-lg text-xs font-medium ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
              : message.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
              : "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {status === "NOT_ENABLED" && (
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            {actionLoading ? "Enabling..." : "Enable Follow-up Notifications on this Device"}
          </button>
        )}

        {status === "ENABLED" && (
          <>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={testLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              {testLoading ? "Sending Test..." : "Send Test Notification"}
            </button>

            <button
              type="button"
              onClick={handleDisablePush}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors"
            >
              {actionLoading ? "Disabling..." : "Disable on this Device"}
            </button>
          </>
        )}

        {status === "PERMISSION_BLOCKED" && (
          <button
            type="button"
            onClick={refreshStatus}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
          >
            Check Again
          </button>
        )}
      </div>

      {/* Real browser / OS notes footer */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1">
        ℹ️ Reminders require an active internet connection and enabled operating system notifications. If the browser is force-stopped or device is in Do Not Disturb, notifications appear when resumed.
      </p>
    </div>
  );
}
