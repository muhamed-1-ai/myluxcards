"use client";

export type PushDeviceStatus =
  | "ENABLED"
  | "NOT_ENABLED"
  | "PERMISSION_BLOCKED"
  | "IOS_SETUP_REQUIRED"
  | "UNSUPPORTED";

export interface PushStatusInfo {
  status: PushDeviceStatus;
  isIos: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | "unsupported";
  details: string;
}

/**
 * Converts a base64 string to Uint8Array for applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks iOS device environment.
 */
export function isIosDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos;
}

/**
 * Checks whether the web app is running in installed standalone mode (Home Screen).
 */
export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Evaluates truthful device push capabilities.
 */
export async function getPushStatus(): Promise<PushStatusInfo> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return {
      status: "UNSUPPORTED",
      isIos: false,
      isStandalone: false,
      permission: "unsupported",
      details: "Service workers are not supported on this browser.",
    };
  }

  const isIos = isIosDevice();
  const isStandalone = isStandaloneMode();

  // iOS Safari requires Add to Home Screen (standalone) for Web Push support
  if (isIos && !isStandalone) {
    return {
      status: "IOS_SETUP_REQUIRED",
      isIos: true,
      isStandalone: false,
      permission: "Notification" in window ? Notification.permission : "default",
      details:
        "On iOS, tap the Share icon and select 'Add to Home Screen' to enable push notifications.",
    };
  }

  if (!("PushManager" in window) || !("Notification" in window)) {
    return {
      status: "UNSUPPORTED",
      isIos,
      isStandalone,
      permission: "unsupported",
      details: "Push notifications are not supported by this browser engine.",
    };
  }

  const permission = Notification.permission;
  if (permission === "denied") {
    return {
      status: "PERMISSION_BLOCKED",
      isIos,
      isStandalone,
      permission: "denied",
      details:
        "Notification permission is blocked. Update permissions in browser or system settings to receive reminders.",
    };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) {
      return {
        status: "NOT_ENABLED",
        isIos,
        isStandalone,
        permission,
        details: "Push notifications are available but not enabled on this device.",
      };
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription && permission === "granted") {
      return {
        status: "ENABLED",
        isIos,
        isStandalone,
        permission: "granted",
        details: "Push notifications are active on this device.",
      };
    }

    return {
      status: "NOT_ENABLED",
      isIos,
      isStandalone,
      permission,
      details: "Notifications are not currently subscribed on this device.",
    };
  } catch (err: any) {
    return {
      status: "NOT_ENABLED",
      isIos,
      isStandalone,
      permission,
      details: err?.message || "Status check failed.",
    };
  }
}

/**
 * Registers the service worker and subscribes the device to Web Push.
 */
export async function subscribeDeviceToPush(): Promise<{
  success: boolean;
  statusInfo: PushStatusInfo;
  error?: string;
}> {
  const currentStatus = await getPushStatus();

  if (currentStatus.status === "IOS_SETUP_REQUIRED") {
    return {
      success: false,
      statusInfo: currentStatus,
      error: "Please install the app to your Home Screen first to enable push notifications on iOS.",
    };
  }

  if (currentStatus.status === "UNSUPPORTED") {
    return {
      success: false,
      statusInfo: currentStatus,
      error: "Web Push notifications are not supported on this browser.",
    };
  }

  // Request browser permission explicitly
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    const updatedStatus = await getPushStatus();
    return {
      success: false,
      statusInfo: updatedStatus,
      error:
        permission === "denied"
          ? "Notification permission was blocked in browser settings."
          : "Notification permission was dismissed.",
    };
  }

  try {
    // Register service worker
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // Fetch VAPID public key from backend
    const vapidRes = await fetch("/api/notifications/vapid-public-key");
    const vapidData = await vapidRes.json();
    if (!vapidData?.publicKey) {
      throw new Error("Unable to obtain VAPID public key from server.");
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

    // Subscribe via PushManager
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    // Register subscription on backend
    const deviceName = `${navigator.userAgent.includes("Mobile") ? "Mobile" : "Desktop"} Browser`;
    const regRes = await fetch("/api/notifications/push-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        deviceName,
      }),
    });

    if (!regRes.ok) {
      const errJson = await regRes.json().catch(() => ({}));
      throw new Error(errJson.message || "Failed to register subscription on server.");
    }

    const finalStatus = await getPushStatus();
    return { success: true, statusInfo: finalStatus };
  } catch (err: any) {
    console.error("[PushClient] Subscription error:", err);
    const finalStatus = await getPushStatus();
    return {
      success: false,
      statusInfo: finalStatus,
      error: err?.message || "Failed to enable notifications.",
    };
  }
}

/**
 * Unsubscribes the current device from Web Push notifications.
 */
export async function unsubscribeDeviceFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!("serviceWorker" in navigator)) return { success: true };

    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/notifications/push-subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
      }
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Sends a real test notification from the backend to verify end-to-end device delivery.
 */
export async function sendTestNotification(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/notifications/test-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return {
      ok: res.ok && data.ok,
      message: data.message || (res.ok ? "Test notification dispatched." : "Failed to dispatch test notification."),
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Network error while sending test notification." };
  }
}
