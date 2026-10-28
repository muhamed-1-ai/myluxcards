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
  const appName = (appDownload?.appName || "").trim();

  const hasApple = Boolean(rawApple && isValidStoreUrl(rawApple, "apple"));
  const hasGoogle = Boolean(rawGoogle && isValidStoreUrl(rawGoogle, "google"));

  const appleUrl = hasApple ? (/^https?:\/\//i.test(rawApple) ? rawApple : `https://${rawApple}`) : "";
  const googleUrl = hasGoogle ? (/^https?:\/\//i.test(rawGoogle) ? rawGoogle : `https://${rawGoogle}`) : "";

  // Neither store configured -> Hide the tile completely, even if appName exists
  if (!hasApple && !hasGoogle) {
    return {
      visible: false,
      brand: "download",
      name: "",
      ariaLabel: "",
      url: "",
      action: "chooser",
      hasApple: false,
      hasGoogle: false,
    };
  }

  const tileName = "Download Our App";
  const subText = appName || undefined;
  const ariaLabel = appName ? `Download ${appName} App` : "Download Our App";

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
  };
}
