import { isValidStoreUrl } from "@/lib/cards";
import type { DetectedOS } from "@/lib/device";
import type { AppDownloadSettings } from "@/components/card/AppStoreChooserModal";

export type AppTileBrand = "appstore" | "playstore" | "dual_store" | "download";

export interface AppTileResolution {
  visible: boolean;
  brand: AppTileBrand;
  name: string;
  subText?: string;
  ariaLabel: string;
  url: string;
  action: "direct" | "chooser";
  targetStore?: "apple" | "google";
  hasApple: boolean;
  hasGoogle: boolean;
  hasReferral: boolean;
}

/**
 * Single shared resolver for the public card and preview "Download Our App" tile.
 * Guarantees icon, accessible label, and target destination cannot disagree.
 */
export function resolveAppDownloadTile(
  appDownload?: AppDownloadSettings,
  detectedOS: DetectedOS = "unknown"
): AppTileResolution {
  const rawApple = (appDownload?.appStoreUrl || "").trim();
  const rawGoogle = (appDownload?.playStoreUrl || "").trim();
  const rawReferral = (appDownload?.referralUrl || "").trim();
  const appName = (appDownload?.appName || "").trim();

  const hasApple = Boolean(rawApple && isValidStoreUrl(rawApple, "apple"));
  const hasGoogle = Boolean(rawGoogle && isValidStoreUrl(rawGoogle, "google"));
  const hasReferral = Boolean(rawReferral && isValidStoreUrl(rawReferral, "universal"));

  const appleUrl = hasApple ? (/^https?:\/\//i.test(rawApple) ? rawApple : `https://${rawApple}`) : "";
  const googleUrl = hasGoogle ? (/^https?:\/\//i.test(rawGoogle) ? rawGoogle : `https://${rawGoogle}`) : "";
  const referralUrl = hasReferral ? (/^https?:\/\//i.test(rawReferral) ? rawReferral : `https://${rawReferral}`) : "";

  // Neither store nor referral link configured -> Hide the tile completely, even if appName exists
  if (!hasReferral && !hasApple && !hasGoogle) {
    return {
      visible: false,
      brand: "download",
      name: "",
      ariaLabel: "",
      url: "",
      action: "chooser",
      hasApple: false,
      hasGoogle: false,
      hasReferral: false,
    };
  }

  const tileName = "App";
  const subText = appName || undefined;
  const ariaLabel = appName ? `Download ${appName} App` : "Download App";

  // Priority 1: Referral / Smart Link takes absolute priority on all devices (iPhone, iPad, Android, desktop, unknown)
  if (hasReferral) {
    return {
      visible: true,
      brand: "download",
      name: tileName,
      subText,
      ariaLabel,
      url: referralUrl,
      action: "direct",
      hasApple,
      hasGoogle,
      hasReferral: true,
    };
  }

  // Case 1: Both stores configured
  if (hasApple && hasGoogle) {
    // iPhone / iPad -> Apple App Store
    if (detectedOS === "ios") {
      return {
        visible: true,
        brand: "download",
        name: tileName,
        subText,
        ariaLabel,
        url: appleUrl,
        action: "direct",
        targetStore: "apple",
        hasApple: true,
        hasGoogle: true,
        hasReferral: false,
      };
    }

    // Android -> Google Play Store
    if (detectedOS === "android") {
      return {
        visible: true,
        brand: "download",
        name: tileName,
        subText,
        ariaLabel,
        url: googleUrl,
        action: "direct",
        targetStore: "google",
        hasApple: true,
        hasGoogle: true,
        hasReferral: false,
      };
    }

    // Desktop or unidentified device -> Open store chooser modal
    return {
      visible: true,
      brand: "download",
      name: tileName,
      subText,
      ariaLabel,
      url: "#",
      action: "chooser",
      hasApple: true,
      hasGoogle: true,
      hasReferral: false,
    };
  }

  // Case 2: Apple App Store only configured
  if (hasApple && !hasGoogle) {
    if (detectedOS === "ios") {
      return {
        visible: true,
        brand: "download",
        name: tileName,
        subText,
        ariaLabel,
        url: appleUrl,
        action: "direct",
        targetStore: "apple",
        hasApple: true,
        hasGoogle: false,
        hasReferral: false,
      };
    }

    // Incompatible or unknown device (Android, desktop, unknown) -> Show modal explaining availability
    return {
      visible: true,
      brand: "download",
      name: tileName,
      subText,
      ariaLabel,
      url: "#",
      action: "chooser",
      targetStore: "apple",
      hasApple: true,
      hasGoogle: false,
      hasReferral: false,
    };
  }

  // Case 3: Google Play Store only configured
  if (detectedOS === "android") {
    return {
      visible: true,
      brand: "download",
      name: tileName,
      subText,
      ariaLabel,
      url: googleUrl,
      action: "direct",
      targetStore: "google",
      hasApple: false,
      hasGoogle: true,
      hasReferral: false,
    };
  }

  // Incompatible or unknown device (iOS, desktop, unknown) -> Show modal explaining availability
  return {
    visible: true,
    brand: "download",
    name: tileName,
    subText,
    ariaLabel,
    url: "#",
    action: "chooser",
    targetStore: "google",
    hasApple: false,
    hasGoogle: true,
    hasReferral: false,
  };
}
