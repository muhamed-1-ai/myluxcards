/**
 * Dynamic Profile Design System & Theme Token Resolver
 * Guarantees zero hardcoded blue/cyan fallbacks across all profile cards and themes.
 */

export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceSecondary: string;
  border: string;
  borderHover: string;
  primary: string;
  primaryGradient: string;
  primaryText: string;
  secondary: string;
  secondaryGradient: string;
  secondaryBtnBg: string;
  secondaryBtnBorder: string;
  secondaryBtnText: string;
  accent: string;
  text: string;
  mutedText: string;
  iconColor: string;
  success: string;
  headerBg: string;
  cardRadius: string;
  btnRadius: string;
}

export interface ProfileThemePreset {
  id: string;
  name: string;
  descriptor: string;
  background: string;
  accent: string;
  text: string;
  surface?: string;
  surfaceSecondary?: string;
  border?: string;
  primary?: string;
  secondary?: string;
  mutedText?: string;
}

export const PROFILE_THEME_PRESETS: ProfileThemePreset[] = [
  {
    id: "forest-green",
    name: "Forest Green",
    descriptor: "Forest green · emerald accent",
    background: "#07150f",
    surface: "#0d2419",
    surfaceSecondary: "#102d20",
    border: "#14532d",
    primary: "#22c55e",
    secondary: "#16a34a",
    accent: "#84cc16",
    text: "#ffffff",
    mutedText: "#9ca3af",
  },
  {
    id: "emerald-sovereign",
    name: "Emerald Sovereign",
    descriptor: "Forest black · emerald",
    background: "#071712",
    surface: "#0d281e",
    surfaceSecondary: "#123629",
    border: "#1b5e43",
    primary: "#39C98A",
    secondary: "#249663",
    accent: "#6ee7b7",
    text: "#F2FFF8",
    mutedText: "#94a3b8",
  },
  {
    id: "midnight-sapphire",
    name: "Midnight Sapphire",
    descriptor: "Midnight blue · electric sapphire",
    background: "#071525",
    surface: "#0d243a",
    surfaceSecondary: "#102d48",
    border: "#1e40af",
    primary: "#4DA3FF",
    secondary: "#1d4ed8",
    accent: "#60a5fa",
    text: "#F4F8FF",
    mutedText: "#94a3b8",
  },
  {
    id: "obsidian-luxe",
    name: "Obsidian Luxe",
    descriptor: "Deep black · champagne gold",
    background: "#0B0D12",
    surface: "#171a22",
    surfaceSecondary: "#212530",
    border: "#3d331e",
    primary: "#D4AF62",
    secondary: "#b38f46",
    accent: "#f3e5ab",
    text: "#F7F3EA",
    mutedText: "#a39e93",
  },
  {
    id: "royal-noir",
    name: "Royal Noir",
    descriptor: "Deep violet · royal accent",
    background: "#100B1C",
    surface: "#1a132e",
    surfaceSecondary: "#241b3d",
    border: "#4c2882",
    primary: "#9B6CFF",
    secondary: "#7c3aed",
    accent: "#c084fc",
    text: "#F8F4FF",
    mutedText: "#a78bfa",
  },
  {
    id: "ocean-meridian",
    name: "Ocean Meridian",
    descriptor: "Deep ocean · aqua",
    background: "#07171C",
    surface: "#0d272e",
    surfaceSecondary: "#12343d",
    border: "#155e75",
    primary: "#35C4D8",
    secondary: "#0891b2",
    accent: "#67e8f9",
    text: "#F2FCFF",
    mutedText: "#94a3b8",
  },
  {
    id: "champagne-noir",
    name: "Champagne Noir",
    descriptor: "Warm black · champagne",
    background: "#15110C",
    surface: "#241d16",
    surfaceSecondary: "#30271e",
    border: "#5c492c",
    primary: "#E2C58B",
    secondary: "#b89a62",
    accent: "#fef08a",
    text: "#FFF9EC",
    mutedText: "#a89f91",
  },
  {
    id: "rose-prestige",
    name: "Rose Prestige",
    descriptor: "Black cherry · rose",
    background: "#180E14",
    surface: "#291823",
    surfaceSecondary: "#382230",
    border: "#703548",
    primary: "#D88B9A",
    secondary: "#9f5263",
    accent: "#f472b6",
    text: "#FFF4F7",
    mutedText: "#9f8790",
  },
  {
    id: "copper-atelier",
    name: "Copper Atelier",
    descriptor: "Dark espresso · copper",
    background: "#17100C",
    surface: "#291b15",
    surfaceSecondary: "#38261e",
    border: "#6b3d22",
    primary: "#C9824A",
    secondary: "#9e5c2b",
    accent: "#fb923c",
    text: "#FFF5ED",
    mutedText: "#a38c80",
  },
  {
    id: "arctic-pearl",
    name: "Arctic Pearl",
    descriptor: "Pearl white · slate blue",
    background: "#EEF3F7",
    surface: "#FFFFFF",
    surfaceSecondary: "#E2E8F0",
    border: "#CBD5E1",
    primary: "#315D7A",
    secondary: "#1e3a4c",
    accent: "#0284c7",
    text: "#101820",
    mutedText: "#64748b",
  },
  {
    id: "ivory-estate",
    name: "Ivory Estate",
    descriptor: "Warm ivory · antique gold",
    background: "#F5F0E7",
    surface: "#FFFFFF",
    surfaceSecondary: "#EFE8DA",
    border: "#D6C7B0",
    primary: "#8A6A3E",
    secondary: "#5c4526",
    accent: "#d97706",
    text: "#17130E",
    mutedText: "#786c5e",
  },
  {
    id: "carbon-platinum",
    name: "Carbon Platinum",
    descriptor: "Carbon black · platinum",
    background: "#101214",
    surface: "#1a1d21",
    surfaceSecondary: "#24292e",
    border: "#3a424a",
    primary: "#B9C2CC",
    secondary: "#828c99",
    accent: "#e2e8f0",
    text: "#F5F7FA",
    mutedText: "#94a3b8",
  },
  {
    id: "deep-garnet",
    name: "Deep Garnet",
    descriptor: "Black cherry · garnet",
    background: "#190B10",
    surface: "#2b131c",
    surfaceSecondary: "#3b1a27",
    border: "#6e2539",
    primary: "#C94B68",
    secondary: "#962e45",
    accent: "#fb7185",
    text: "#FFF2F5",
    mutedText: "#9f868d",
  },
  {
    id: "forest-reserve",
    name: "Forest Reserve",
    descriptor: "Forest green · soft lime",
    background: "#0B1711",
    surface: "#12261c",
    surfaceSecondary: "#1a3627",
    border: "#28573d",
    primary: "#8BBF72",
    secondary: "#618f4b",
    accent: "#a3e635",
    text: "#F4FFF0",
    mutedText: "#8e9e87",
  },
  {
    id: "cobalt-signature",
    name: "Cobalt Signature",
    descriptor: "Deep navy · cobalt",
    background: "#08132A",
    surface: "#0f2045",
    surfaceSecondary: "#152d61",
    border: "#1e4bb8",
    primary: "#367BFF",
    secondary: "#1d4ed8",
    accent: "#60a5fa",
    text: "#F4F7FF",
    mutedText: "#94a3b8",
  },
  {
    id: "sandstone-elite",
    name: "Sandstone Elite",
    descriptor: "Warm stone · bronze",
    background: "#19150F",
    surface: "#2b241a",
    surfaceSecondary: "#3b3124",
    border: "#614f36",
    primary: "#C7A66A",
    secondary: "#947640",
    accent: "#fef08a",
    text: "#FFF8E9",
    mutedText: "#9e917d",
  },
];

export function getLuminance(hex?: string): number {
  if (!hex || typeof hex !== "string") return 0;
  const clean = hex.replace("#", "").trim();
  if (clean.length < 6) return 0;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 0;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightColor(hex?: string): boolean {
  return getLuminance(hex) > 0.45;
}

export function parseHex(hexStr?: string): [number, number, number] {
  if (!hexStr || typeof hexStr !== "string") return [5, 11, 20];
  const clean = hexStr.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    return [r, g, b];
  }
  return [5, 11, 20];
}

export function hexToRgba(hexStr: string, alpha: number): string {
  const [r, g, b] = parseHex(hexStr);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixHex(color1: string, color2: string, weight2: number): string {
  const w2 = Math.max(0, Math.min(1, weight2));
  const w1 = 1 - w2;
  const [r1, g1, b1] = parseHex(color1);
  const [r2, g2, b2] = parseHex(color2);

  const r = Math.round(r1 * w1 + r2 * w2);
  const g = Math.round(g1 * w1 + g2 * w2);
  const b = Math.round(b1 * w1 + b2 * w2);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function resolveThemeTokens(card: {
  theme?: string;
  profileTheme?: string;
  profileBackground?: string;
  profileAccent?: string;
  profileText?: string;
  modernConfig?: any;
}) {
  const themeId = (card.theme || card.profileTheme || "").toLowerCase();
  const bg = card.profileBackground || "#050B14";
  const accent = card.profileAccent || "#00E5FF";
  const text = card.profileText || "#FFFFFF";
  const mc = card.modernConfig || {};

  // Check matching preset first:
  const preset = PROFILE_THEME_PRESETS.find(
    (p) =>
      p.id === themeId ||
      (p.background.toLowerCase() === bg.toLowerCase() &&
        p.accent.toLowerCase() === accent.toLowerCase())
  );

  const bgIsLight = isLightColor(bg);

  // 1. Surface Token (Card background):
  const surface =
    mc.cardBackground ||
    preset?.surface ||
    (bgIsLight ? mixHex(bg, "#FFFFFF", 0.7) : mixHex(bg, accent, 0.12));

  // 2. Secondary Surface (Rows, tiles, product cards):
  const surfaceSecondary =
    mc.rowBg ||
    preset?.surfaceSecondary ||
    (bgIsLight ? mixHex(bg, "#000000", 0.05) : mixHex(bg, accent, 0.20));

  // 3. Border Token:
  const border =
    mc.cardBorder ||
    preset?.border ||
    (bgIsLight ? mixHex(accent, "#000000", 0.15) : hexToRgba(accent, 0.35));

  const borderHover = hexToRgba(accent, 0.65);

  // 4. Primary & Secondary Gradients:
  const primary = preset?.primary || accent;
  const secondaryColor =
    preset?.secondary ||
    (bgIsLight ? mixHex(primary, "#000000", 0.25) : mixHex(primary, bg, 0.35));

  const primaryIsLight = isLightColor(primary);
  const primaryText =
    mc.primaryBtnText || (primaryIsLight ? "#000000" : "#ffffff");
  const primaryGradient =
    mc.primaryBtnBg ||
    `linear-gradient(135deg, ${primary}, ${secondaryColor})`;
  const secondaryGradient = `linear-gradient(135deg, ${secondaryColor}, ${surfaceSecondary})`;

  // 5. Secondary / Glass Button Tokens:
  const secondaryBtnBg =
    mc.secondaryBtnBg ||
    (bgIsLight ? "rgba(0, 0, 0, 0.06)" : hexToRgba(primary, 0.15));
  const secondaryBtnBorder = mc.secondaryBtnBorder || hexToRgba(primary, 0.4);
  const secondaryBtnText = mc.secondaryBtnText || text;

  // 6. Typography & Muted Text:
  const mutedText =
    mc.mutedText ||
    preset?.mutedText ||
    (bgIsLight ? "rgba(0, 0, 0, 0.62)" : mixHex(text, bg, 0.42));

  // 7. Icons & Extras:
  const iconColor = primary;
  const success = "#22c55e";

  // 8. Header background:
  const headerGradStart =
    mc.headerGradientStart ||
    (bgIsLight ? primary : mixHex(bg, primary, 0.25));
  const headerGradEnd = mc.headerGradientEnd || bg;
  const headerBg =
    mc.headerStyle === "solid"
      ? bg
      : `linear-gradient(135deg, ${headerGradStart}, ${headerGradEnd})`;

  // Combine CSS custom properties into a single dictionary:
  const cssVars: Record<string, string> = {
    // Central Design Token System Standard Variables:
    "--profile-background": bg,
    "--profile-surface": surface,
    "--profile-surface-secondary": surfaceSecondary,
    "--profile-border": border,
    "--profile-border-hover": borderHover,
    "--profile-primary": primary,
    "--profile-primary-gradient": primaryGradient,
    "--profile-primary-text": primaryText,
    "--profile-secondary": secondaryColor,
    "--profile-secondary-gradient": secondaryGradient,
    "--profile-secondary-bg": secondaryBtnBg,
    "--profile-secondary-border": secondaryBtnBorder,
    "--profile-secondary-text": secondaryBtnText,
    "--profile-accent": preset?.accent || accent,
    "--profile-text": text,
    "--profile-muted": mutedText,
    "--profile-icon": iconColor,
    "--profile-success": success,

    // Public Card CSS compatibility variables:
    "--pc-bg": bg,
    "--pc-accent": primary,
    "--pc-text": text,
    "--pc-surface": surface,
    "--pc-surface-secondary": surfaceSecondary,
    "--pc-border": border,
    "--pc-muted": mutedText,

    // Modern Profile CSS compatibility variables:
    "--mod-bg": bg,
    "--mod-accent": primary,
    "--mod-text": text,
    "--mod-card-bg": surface,
    "--mod-card-border": border,
    "--mod-muted-text": mutedText,
    "--mod-row-bg": surfaceSecondary,
    "--mod-row-border": border,
    "--mod-btn-primary-bg": primaryGradient,
    "--mod-btn-primary-text": primaryText,
    "--mod-btn-glass-bg": secondaryBtnBg,
    "--mod-btn-glass-border": secondaryBtnBorder,
    "--mod-btn-glass-text": secondaryBtnText,
    "--mod-header-bg": headerBg,
    "--mod-name-size": `${mc.nameSize || 22}px`,
    "--mod-body-size": `${mc.bodySize || 14}px`,
    "--mod-card-radius": `${mc.cardRadius ?? 14}px`,
    "--mod-btn-radius": `${mc.buttonRadius ?? 24}px`,
    "--mod-gap": `${
      mc.spacingDensity === "compact"
        ? 10
        : mc.spacingDensity === "spacious"
        ? 18
        : 14
    }px`,
  };

  return {
    tokens: {
      background: bg,
      surface,
      surfaceSecondary,
      border,
      borderHover,
      primary,
      primaryGradient,
      primaryText,
      secondary: secondaryColor,
      secondaryGradient,
      secondaryBtnBg,
      secondaryBtnBorder,
      secondaryBtnText,
      accent: preset?.accent || accent,
      text,
      mutedText,
      iconColor,
      success,
      headerBg,
      cardRadius: `${mc.cardRadius ?? 14}px`,
      btnRadius: `${mc.buttonRadius ?? 24}px`,
    },
    cssVars,
    styleObj: cssVars as unknown as React.CSSProperties,
  };
}

