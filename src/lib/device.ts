"use client";

export type DetectedOS = "ios" | "android" | "desktop" | "unknown";

/**
 * Detects the visitor's operating system environment.
 * Handles:
 * - Android phones and tablets
 * - iPhone and iPod Touch
 * - iPad (including iPadOS 13+ which presents as MacIntel with touch support)
 * - Desktop browsers (Windows, Mac, Linux)
 * - Unknown / headless environments
 *
 * NOTE: Device detection is treated as a convenience, not a guarantee.
 */
export function detectUserDevice(): DetectedOS {
  if (typeof window === "undefined" || !navigator) return "unknown";

  const ua = navigator.userAgent || "";
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // 1. Android check (phone or tablet)
  if (/android/i.test(ua)) {
    return "android";
  }

  // 2. iOS classic check (iPhone, iPod, traditional iPad UA)
  if (/iPad|iPhone|iPod/.test(ua)) {
    return "ios";
  }

  // 3. Modern iPadOS 13+ check:
  // Safari on modern iPads presents userAgent like macOS ("Macintosh; Intel Mac OS X...")
  // but navigator.platform is "MacIntel" and maxTouchPoints > 1!
  if (platform === "MacIntel" && maxTouchPoints > 1) {
    return "ios";
  }

  // 4. Desktop checks (Windows, macOS without touch, Linux)
  if (/Win|Mac|Linux/i.test(platform) || /Windows|Macintosh|Linux/i.test(ua)) {
    return "desktop";
  }

  return "unknown";
}
