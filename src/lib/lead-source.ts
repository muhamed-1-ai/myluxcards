import {
  Radio,
  Hand,
  Globe,
  Download,
  Code2,
  QrCode,
  Share2,
  LucideIcon,
  Sparkles,
} from "lucide-react";

export interface LeadSourceConfig {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  emoji: string;
  tooltip: string;
  badgeStyle: {
    bg: string;
    border: string;
    text: string;
    glow?: string;
  };
}

/**
 * Formats raw uppercase/snake_case backend string into Title Case label.
 * e.g. "FACEBOOK_ADS" => "Facebook Ads", "LINKEDIN_CAMPAIGN" => "Linkedin Campaign"
 */
export function formatFallbackSourceLabel(rawSource: string): string {
  if (!rawSource) return "Unknown";
  return rawSource
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Registry of Lead Sources with color palettes, icons, and human-readable tooltips.
 */
const SOURCE_CONFIG_REGISTRY: Record<string, LeadSourceConfig> = {
  NFC: {
    label: "NFC Tap",
    shortLabel: "NFC",
    icon: Radio,
    emoji: "📡",
    tooltip: "Lead generated from Zappit profile share",
    badgeStyle: {
      bg: "rgba(0, 102, 255, 0.14)",
      border: "rgba(0, 217, 255, 0.35)",
      text: "#00E5FF",
      glow: "rgba(0, 217, 255, 0.2)",
    },
  },
  NFC_TAP: {
    label: "NFC Tap",
    shortLabel: "NFC",
    icon: Radio,
    emoji: "📡",
    tooltip: "Lead generated from Zappit profile share",
    badgeStyle: {
      bg: "rgba(0, 102, 255, 0.14)",
      border: "rgba(0, 217, 255, 0.35)",
      text: "#00E5FF",
      glow: "rgba(0, 217, 255, 0.2)",
    },
  },
  PROFILE_SHARE_DETAILS: {
    label: "NFC Tap",
    shortLabel: "NFC",
    icon: Radio,
    emoji: "📡",
    tooltip: "Lead generated from Zappit profile share",
    badgeStyle: {
      bg: "rgba(0, 102, 255, 0.14)",
      border: "rgba(0, 217, 255, 0.35)",
      text: "#00E5FF",
      glow: "rgba(0, 217, 255, 0.2)",
    },
  },
  PROFILE_SHARE: {
    label: "NFC Tap",
    shortLabel: "NFC",
    icon: Radio,
    emoji: "📡",
    tooltip: "Lead generated from Zappit profile share",
    badgeStyle: {
      bg: "rgba(0, 102, 255, 0.14)",
      border: "rgba(0, 217, 255, 0.35)",
      text: "#00E5FF",
      glow: "rgba(0, 217, 255, 0.2)",
    },
  },
  MANUAL: {
    label: "Manual",
    shortLabel: "Manual",
    icon: Hand,
    emoji: "✋",
    tooltip: "Created manually by user",
    badgeStyle: {
      bg: "rgba(245, 158, 11, 0.14)",
      border: "rgba(245, 158, 11, 0.35)",
      text: "#FBBF24",
      glow: "rgba(245, 158, 11, 0.2)",
    },
  },
  WEBSITE: {
    label: "Website",
    shortLabel: "Web",
    icon: Globe,
    emoji: "🌐",
    tooltip: "Captured from website submission",
    badgeStyle: {
      bg: "rgba(16, 185, 129, 0.14)",
      border: "rgba(16, 185, 129, 0.35)",
      text: "#34D399",
      glow: "rgba(16, 185, 129, 0.2)",
    },
  },
  DIRECT: {
    label: "Website",
    shortLabel: "Web",
    icon: Globe,
    emoji: "🌐",
    tooltip: "Captured from direct website link",
    badgeStyle: {
      bg: "rgba(16, 185, 129, 0.14)",
      border: "rgba(16, 185, 129, 0.35)",
      text: "#34D399",
      glow: "rgba(16, 185, 129, 0.2)",
    },
  },
  IMPORT: {
    label: "Import",
    shortLabel: "Import",
    icon: Download,
    emoji: "⬇",
    tooltip: "Imported from CSV/Excel file",
    badgeStyle: {
      bg: "rgba(168, 85, 247, 0.14)",
      border: "rgba(168, 85, 247, 0.35)",
      text: "#C084FC",
      glow: "rgba(168, 85, 247, 0.2)",
    },
  },
  API: {
    label: "API",
    shortLabel: "API",
    icon: Code2,
    emoji: "⚡",
    tooltip: "Submitted via API integration",
    badgeStyle: {
      bg: "rgba(99, 102, 241, 0.14)",
      border: "rgba(99, 102, 241, 0.35)",
      text: "#818CF8",
      glow: "rgba(99, 102, 241, 0.2)",
    },
  },
  QR: {
    label: "QR Scan",
    shortLabel: "QR",
    icon: QrCode,
    emoji: "📷",
    tooltip: "Captured via QR Code scan",
    badgeStyle: {
      bg: "rgba(20, 184, 166, 0.14)",
      border: "rgba(20, 184, 166, 0.35)",
      text: "#2DD4BF",
      glow: "rgba(20, 184, 166, 0.2)",
    },
  },
  QR_SCAN: {
    label: "QR Scan",
    shortLabel: "QR",
    icon: QrCode,
    emoji: "📷",
    tooltip: "Captured via QR Code scan",
    badgeStyle: {
      bg: "rgba(20, 184, 166, 0.14)",
      border: "rgba(20, 184, 166, 0.35)",
      text: "#2DD4BF",
      glow: "rgba(20, 184, 166, 0.2)",
    },
  },
};

/**
 * Returns complete LeadSourceConfig object for any given source string.
 * Gracefully falls back to Title Case label for unknown future sources.
 */
export function getLeadSourceConfig(rawSource?: string | null): LeadSourceConfig {
  if (!rawSource || typeof rawSource !== "string" || !rawSource.trim()) {
    return {
      label: "Direct",
      shortLabel: "Direct",
      icon: Globe,
      emoji: "🌐",
      tooltip: "Direct inbound lead",
      badgeStyle: {
        bg: "rgba(148, 163, 184, 0.12)",
        border: "rgba(148, 163, 184, 0.3)",
        text: "#CBD5E1",
      },
    };
  }

  const normalizedKey = rawSource.trim().toUpperCase().replace(/[\s-]+/g, "_");

  // Check exact key match
  if (SOURCE_CONFIG_REGISTRY[normalizedKey]) {
    return SOURCE_CONFIG_REGISTRY[normalizedKey];
  }

  // Check partial key match
  if (normalizedKey.includes("NFC") || normalizedKey.includes("SHARE")) {
    return SOURCE_CONFIG_REGISTRY.NFC;
  }
  if (normalizedKey.includes("QR")) {
    return SOURCE_CONFIG_REGISTRY.QR;
  }
  if (normalizedKey.includes("MANUAL")) {
    return SOURCE_CONFIG_REGISTRY.MANUAL;
  }
  if (normalizedKey.includes("IMPORT")) {
    return SOURCE_CONFIG_REGISTRY.IMPORT;
  }
  if (normalizedKey.includes("API")) {
    return SOURCE_CONFIG_REGISTRY.API;
  }

  // Automatic Title Case Fallback for unknown sources (e.g. FACEBOOK_ADS => Facebook Ads)
  const formattedLabel = formatFallbackSourceLabel(rawSource);
  return {
    label: formattedLabel,
    shortLabel: formattedLabel.length > 8 ? formattedLabel.slice(0, 7) + "…" : formattedLabel,
    icon: Sparkles,
    emoji: "✨",
    tooltip: `Source: ${formattedLabel}`,
    badgeStyle: {
      bg: "rgba(56, 189, 248, 0.12)",
      border: "rgba(56, 189, 248, 0.3)",
      text: "#38BDF8",
    },
  };
}
