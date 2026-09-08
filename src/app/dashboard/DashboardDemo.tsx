"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import dynamic from "next/dynamic";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DashboardLayoutType,
  CompactDashboardLayoutDropdown,
} from "@/components/dashboard/DashboardLayoutSelector";
import { LeadManagementDashboard } from "@/components/dashboard/LeadManagementDashboard";
import LegalConsentModal from "@/components/auth/LegalConsentModal";

const DashboardLayoutSelectorModal = dynamic(
  () => import("@/components/dashboard/DashboardLayoutSelector").then((mod) => mod.DashboardLayoutSelectorModal),
  { ssr: false }
);
const LeadSourcesConfig = dynamic(
  () => import("@/components/dashboard/config/LeadSourcesConfig").then((mod) => mod.LeadSourcesConfig),
  { ssr: false }
);
const ProductsConfig = dynamic(
  () => import("@/components/dashboard/config/ProductsConfig").then((mod) => mod.ProductsConfig),
  { ssr: false }
);
const LeadStagesConfig = dynamic(
  () => import("@/components/dashboard/config/LeadStagesConfig").then((mod) => mod.LeadStagesConfig),
  { ssr: false }
);
const CalendarConfig = dynamic(
  () => import("@/components/dashboard/config/CalendarConfig").then((mod) => mod.CalendarConfig),
  { ssr: false }
);
const LobReasonsConfig = dynamic(
  () => import("@/components/dashboard/config/LobReasonsConfig").then((mod) => mod.LobReasonsConfig),
  { ssr: false }
);
import {
  BusinessKpiGrid,
  DigitalCardKpiGrid,
  CompactTodayCard,
  NeedsAttentionWidget,
  PerformanceAnalyticsWidget,
  ProfileCompletionWidget,
  ActiveCardBanner,
  QuickActionsGrid,
} from "@/components/dashboard/DashboardWidgets";
import {
  Users,
  Sparkles,
  Phone,
  TrendingUp,
  CalendarClock,
  Trophy,
  CheckCircle,
  Flame,
  Filter,
  Search,
  Download,
  Trash2,
  Calendar,
  MessageSquare,
  Check,
  X,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Plus,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";

type Tab = "dashboard" | "analytics" | "modes" | "contact" | "social" | "company" | "appearance" | "cards" | "config-sources" | "config-products" | "config-stages" | "config-calendar" | "config-reasons";
type VehicleConnectSettings = {
  vehicleMake?: string; vehicleModel?: string; vehicleColor?: string; licensePlate?: string; parkingNote?: string;
  allowDirectCall?: boolean; allowDirectMessage?: boolean; showEmergencyContact?: boolean;
};
type EmergencyContactSettings = {
  name?: string; relationship?: string; phone?: string; notifyOnScan?: boolean;
};
type LostAndFoundSettings = {
  itemName?: string; itemCategory?: string; rewardNote?: string; returnInstructions?: string; allowAnonymousMessage?: boolean;
};
type Card = {
  id: string; ownerId: string; name: string; slug: string; title: string; business: string;
  countryCode: string; countryIso: string; mobile: string; whatsapp: string; email: string; website: string;
  state: string; stateCode: string; city: string; address: string; brochure: string; brochureData?: string;
  social: Record<string, string>; about: string; services: string[];
  logo: string; cover: string; profileBackground: string; profileAccent: string; profileText: string;
  logoScale: number; logoRotation: number; logoX: number; logoY: number;
  coverScale: number; coverRotation: number; coverX: number; coverY: number;
  start: string; expiry: string; views: number; active: boolean; activatedAt?: string | null;
  analytics?: Record<string, number>;
  profileMode?: "DIGITAL_PROFILE" | "VEHICLE_CONNECT" | "LOST_AND_FOUND";
  enabledFeatures?: { digitalProfile: boolean; vehicleConnect: boolean; lostAndFound: boolean };
  vehicleConnect?: VehicleConnectSettings;
  emergencyContact?: EmergencyContactSettings;
  lostAndFound?: LostAndFoundSettings;
};
type Lead = { id: string; card_id: string; name: string; email?: string; phone?: string; company?: string; message?: string; status: string; created_at: string };
type CurrentUser = { id: string; name: string; email: string; role?: string; featurePermissions?: Record<string, boolean> };

function MyLuxModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 680,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="mylux-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mylux-modal-title"
    >
      <div className="mylux-modal-dialog" style={{ width: `min(${maxWidth}px, calc(100vw - 32px))` }}>
        <div className="mylux-modal-header">
          <div>
            <h3 id="mylux-modal-title" className="mylux-modal-title">{title}</h3>
            {subtitle && <p className="mylux-modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="mylux-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="mylux-modal-body">{children}</div>
        {footer && <div className="mylux-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

const STORE_PREFIX = "mylux-dashboard-cards-v2:";
const socialFields = ["Instagram", "Facebook", "YouTube", "LinkedIn", "Twitter", "Google Business", "Google Maps"];
type DialCode = { flag: string; code: string; name: string; iso: string };
type LocationState = { name: string; isoCode: string };
type LocationCity = { name: string; latitude?: string | null; longitude?: string | null };
type LocationApi = {
  getStatesOfCountry: (countryIso: string) => LocationState[];
  getCitiesOfState: (countryIso: string, stateCode: string) => LocationCity[];
};
const blankSocial = Object.fromEntries(socialFields.map((x) => [x, ""]));
const profileThemes = [
  { name: "MyLux Gold", background: "#020202", accent: "#0066FF", text: "#ffffff" },
  { name: "Minimal White", background: "#f7f5ef", accent: "#171717", text: "#171717" },
  { name: "Midnight Blue", background: "#071523", accent: "#5ca9e6", text: "#f5f9ff" },
  { name: "Burgundy", background: "#18070d", accent: "#a83d5b", text: "#fff4f6" },
  { name: "Executive Silver", background: "#101214", accent: "#aeb6bf", text: "#f4f6f8" },
  { name: "Royal Purple", background: "#12091f", accent: "#9b6cff", text: "#faf7ff" },
  { name: "Emerald", background: "#061712", accent: "#35c98a", text: "#effff8" },
  { name: "Ocean Teal", background: "#04191d", accent: "#22b8c7", text: "#edfdff" },
  { name: "Rose Gold", background: "#1d1114", accent: "#d79a9f", text: "#fff7f7" },
  { name: "Copper", background: "#1a100a", accent: "#c9783d", text: "#fff6ed" },
  { name: "Electric Lime", background: "#090d08", accent: "#a8e83a", text: "#f8ffed" },
  { name: "Coffee Cream", background: "#211811", accent: "#d4b483", text: "#fff9ef" },
  { name: "Sapphire Gold", background: "#061329", accent: "#e2b84b", text: "#f5f8ff" },
];
const storageKey = (accountId: string) => `${STORE_PREFIX}${accountId}`;
const cacheCards = (accountId: string, cards: Card[]) => {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(cards));
  } catch {
    // Large uploaded images can exceed the browser quota. Keep the cloud save
    // working and retain a lightweight local fallback instead.
    try {
      const lightweight = cards.map((card) => ({
        ...card,
        logo: card.logo.startsWith("data:") ? "" : card.logo,
        cover: card.cover.startsWith("data:") ? "" : card.cover,
        brochureData: card.brochureData?.startsWith("data:") ? "" : card.brochureData,
      }));
      localStorage.setItem(storageKey(accountId), JSON.stringify(lightweight));
    } catch { /* Cloud storage remains the source of truth. */ }
  }
};
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-card";
const accountSuffix = (email: string) => {
  let hash = 0;
  for (const character of email) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash).toString().slice(0, 6).padStart(4, "0");
};
const createBlankCard = (user: CurrentUser): Card => {
  const today = new Date();
  const expiry = new Date(today);
  expiry.setFullYear(expiry.getFullYear() + 1);
  const suffix = accountSuffix(user.email);
  return {
    id: `card-${suffix}`, ownerId: user.email.toLowerCase(), name: user.name, slug: `${slugify(user.name)}-${suffix}`,
    title: "", business: "", countryCode: "", countryIso: "", mobile: "", whatsapp: "", email: "", website: "",
    state: "", stateCode: "", city: "", address: "", brochure: "", social: { ...blankSocial }, about: "", services: [],
    logo: "", cover: "", profileBackground: "#020202", profileAccent: "#0066FF", profileText: "#ffffff",
    logoScale: 100, logoRotation: 0, logoX: 50, logoY: 50,
    coverScale: 100, coverRotation: 0, coverX: 50, coverY: 50,
    start: today.toISOString().slice(0, 10), expiry: expiry.toISOString().slice(0, 10),
    views: 0, active: false,
    profileMode: "DIGITAL_PROFILE",
    enabledFeatures: { digitalProfile: true, vehicleConnect: true, lostAndFound: true },
    vehicleConnect: { vehicleMake: "", vehicleModel: "", vehicleColor: "", licensePlate: "", parkingNote: "If my vehicle is blocking traffic or parked improperly, please tap below to notify me immediately.", allowDirectCall: true, allowDirectMessage: true, showEmergencyContact: true },
    emergencyContact: { name: "", relationship: "", phone: "", notifyOnScan: false },
    lostAndFound: { itemName: "", itemCategory: "Other", rewardNote: "A reward will be offered upon safe return of this item. Thank you for your honesty!", returnInstructions: "Please contact me using the form below or drop this item off at building reception.", allowAnonymousMessage: true },
  };
};
const normalizeCard = (value: Partial<Card> | null | undefined, user: CurrentUser): Card => {
  const fallback = createBlankCard(user);
  const card = value && typeof value === "object" ? value : {};
  return {
    ...fallback,
    ...card,
    social: { ...blankSocial, ...(card.social && typeof card.social === "object" ? card.social : {}) },
    services: Array.isArray(card.services) ? card.services.filter((item): item is string => typeof item === "string") : [],
    active: Boolean(card.active),
    activatedAt: typeof card.activatedAt === "string" ? card.activatedAt : null,
    analytics: card.analytics && typeof card.analytics === "object" ? card.analytics : {},
    profileMode: card.profileMode || fallback.profileMode,
    enabledFeatures: {
      digitalProfile: card.enabledFeatures?.digitalProfile !== false,
      vehicleConnect: card.enabledFeatures?.vehicleConnect !== false,
      lostAndFound: card.enabledFeatures?.lostAndFound !== false,
    },
    vehicleConnect: { ...fallback.vehicleConnect, ...(card.vehicleConnect || {}) },
    emergencyContact: { ...fallback.emergencyContact, ...(card.emergencyContact || {}) },
    lostAndFound: { ...fallback.lostAndFound, ...(card.lostAndFound || {}) },
  };
};
const emptyCard = createBlankCard({ id: "", name: "", email: "" });

const I = ({ children }: { children: string }) => <span className="nav-icon" aria-hidden>{children}</span>;
const fieldValue = (value: unknown) => String(value ?? "").trim();
const validUrl = (value: string) => !value || /^https?:\/\/.+\..+/i.test(value);
const normalizeActivationCode = (value: string) => {
  const typed = value.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if ("MLC".startsWith(typed)) return typed;
  const compact = (typed.startsWith("MLC") ? typed.slice(3) : typed).replace(/[^0-9A-F]/g, "").slice(0, 16);
  return compact ? `MLC-${compact.match(/.{1,4}/g)?.join("-") || compact}` : "MLC-";
};
const fetchWithSessionRefresh = async (input: RequestInfo | URL, init?: RequestInit) => {
  const options: RequestInit = { credentials: "same-origin", ...init };
  let response = await fetch(input, options);
  if (response.status !== 401) return response;
  const refreshed = await fetch("/api/auth/refresh", { credentials: "same-origin", cache: "no-store" });
  const refreshData = refreshed.ok ? await refreshed.json().catch(() => ({})) : null;
  if (!refreshData?.ok) return response;
  return fetch(input, options);
};
const optimizeProfileImage = async (source: string, maxWidth: number, maxHeight: number) => {
  if (!source.startsWith("data:image/") || source.length < 350_000) return source;
  return new Promise<string>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const ratio = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext("2d");
      if (!context) { resolve(source); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(source); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || source));
        reader.onerror = () => resolve(source);
        reader.readAsDataURL(blob);
      }, "image/webp", 0.82);
    };
    image.onerror = () => resolve(source);
    image.src = source;
  });
};
export default function DashboardDemo({ identity }: { identity: CurrentUser }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedId, setSelectedId] = useState(emptyCard.id);
  const [draft, setDraft] = useState<Card>(emptyCard);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebar, setSidebar] = useState(false);
  const [toast, setToast] = useState("");
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [service, setService] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [accountMenu, setAccountMenu] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contactNumbers, setContactNumbers] = useState<any[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [cloudReady, setCloudReady] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const lastSavedRef = useRef("");

  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);

  const handleOpenNicknameModal = () => {
    setAccountMenu(false);
    setNicknameInput(currentUser?.name || "");
    setNicknameError("");
    setNicknameModalOpen(true);
  };

  const handleSaveNickname = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nicknameInput.trim();
    if (!trimmed) {
      setNicknameError("Nickname cannot be empty.");
      return;
    }
    if (trimmed.length < 2) {
      setNicknameError("Nickname must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 30) {
      setNicknameError("Nickname cannot exceed 30 characters.");
      return;
    }

    setSavingNickname(true);
    setNicknameError("");

    try {
      const response = await fetchWithSessionRefresh("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: trimmed }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNicknameError(data.message || "Failed to update nickname.");
        setSavingNickname(false);
        return;
      }

      if (data.user && currentUser) {
        const updatedUser = { ...currentUser, name: data.user.name };
        setCurrentUser(updatedUser);
        localStorage.setItem("myluxcards_current_user", JSON.stringify(updatedUser));
      }

      setNicknameModalOpen(false);
      setSavingNickname(false);
      notify("Nickname updated successfully.");
    } catch {
      setNicknameError("An error occurred while saving nickname.");
      setSavingNickname(false);
    }
  };


  const reloadContactsData = async () => {
    try {
      const res = await fetchWithSessionRefresh("/api/cards", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        if (Array.isArray(payload.contactNumbers)) setContactNumbers(payload.contactNumbers);
        if (Array.isArray(payload.emergencyContacts)) setEmergencyContacts(payload.emergencyContacts);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const user = identity;
      const consentValid = Boolean(
        (user as any).terms_accepted &&
        (user as any).privacy_accepted &&
        (user as any).cookie_consent &&
        (user as any).terms_version === "1.0" &&
        (user as any).privacy_version === "1.0" &&
        (user as any).cookie_version === "1.0"
      );
      if (!consentValid) {
        setConsentModalOpen(true);
      }
      localStorage.setItem("myluxcards_current_user", JSON.stringify(user));
      setCurrentUser(user);
      const key = storageKey(user.id);
      const stored = localStorage.getItem(key);
      let accountCards: Card[] = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          accountCards = parsed
            .filter((card): card is Partial<Card> => Boolean(card) && card.ownerId === user.id)
            .map((card) => normalizeCard(card, user));
        }
      }
      const firstCard = accountCards[0] || createBlankCard(user);
      setCards(accountCards.length ? accountCards : [firstCard]);
      setSelectedId(firstCard.id);
      setDraft(firstCard);
      lastSavedRef.current = JSON.stringify(firstCard);
      setAuthReady(true);
      fetchWithSessionRefresh("/api/cards", { cache: "no-store" }).then(async (response) => {
        if (response.status === 401) {
          localStorage.removeItem("myluxcards_current_user");
          sessionStorage.setItem("myluxcards_auth_next", "/dashboard?tab=cards");
          window.location.replace("/?login=1");
          return;
        }
        if (!response.ok) { setSaveStatus("error"); notify("Cloud connection failed. Refresh the page and try again."); return; }
        const payload = await response.json();
        const cloudCards = Array.isArray(payload.cards) ? payload.cards.map((card: Partial<Card>) => normalizeCard(card, user)) : [];
        setLeads(Array.isArray(payload.leads) ? payload.leads : []);
        if (Array.isArray(payload.contactNumbers)) setContactNumbers(payload.contactNumbers);
        if (Array.isArray(payload.emergencyContacts)) setEmergencyContacts(payload.emergencyContacts);
        setCloudReady(true);
        if (cloudCards.length) {
          setCards(cloudCards);
          setSelectedId(cloudCards[0].id);
          setDraft(cloudCards[0]);
          lastSavedRef.current = JSON.stringify(cloudCards[0]);
          cacheCards(user.id, cloudCards);
        } else {
          const blank = createBlankCard(user);
          setCards([blank]);
          setSelectedId(blank.id);
          setDraft(blank);
          lastSavedRef.current = "";
          cacheCards(user.id, [blank]);
          fetchWithSessionRefresh("/api/cards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(blank) }).then(async (res) => {
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            if (data.card) {
              const savedCard = normalizeCard(data.card, user);
              setCards([savedCard]);
              setSelectedId(savedCard.id);
              setDraft(savedCard);
              lastSavedRef.current = JSON.stringify(savedCard);
              cacheCards(user.id, [savedCard]);
            }
          }).catch(() => { });
        }
      }).catch(() => { setSaveStatus("error"); notify("Cloud connection failed. Refresh the page and try again."); });
    } catch {
      localStorage.removeItem("myluxcards_current_user");
      window.location.replace("/?login=1");
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "cards") setTab("cards");
  }, [identity]);

  useEffect(() => {
    const found = cards.find((card) => card.id === selectedId);
    if (found) setDraft(found);
  }, [selectedId]);

  const notify = (message: string) => {
    setToast(message); window.setTimeout(() => setToast(""), 2600);
  };
  const update = (key: keyof Card, value: Card[keyof Card]) => { setSaveStatus("unsaved"); setDraft((old) => ({ ...old, [key]: value })); };
  const selectTab = (next: Tab) => { setTab(next); setSidebar(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const requestCardOpen = (card: Card) => {
    if (!card.slug) return;
    if (saveStatus === "unsaved") {
      void save("dashboard", undefined, true);
    }
    window.open(`/card/${card.slug}`, "_blank", "noopener,noreferrer");
  };
  const validate = (section: Tab) => {
    const next: Record<string, string> = {};
    if (section === "contact" || section === "dashboard") {
      if (!fieldValue(draft.name)) next.name = "Card name is required.";
      if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) next.email = "Enter a valid email.";
      if (!validUrl(draft.website)) next.website = "Include http:// or https://.";
    }
    if (section === "social" || section === "dashboard") socialFields.forEach((key) => {
      if (!validUrl(draft.social[key])) next[key] = "Include http:// or https://.";
    });
    setErrors(next); return Object.keys(next).length === 0;
  };
  const save = async (section: Tab, next?: Tab, silent = false) => {
    if (saving) return;
    if (!validate(section)) { setSaveStatus("error"); if (!silent) notify("Please fix the highlighted fields."); return; }
    setSaving(true);
    setSaveStatus("saving");
    if (!silent) notify("Saving your card…");
    const optimizedDraft = {
      ...draft,
      logo: await optimizeProfileImage(draft.logo, 800, 800),
      cover: await optimizeProfileImage(draft.cover, 1600, 900),
    };
    const saved = cards.map((card) => card.id === optimizedDraft.id ? optimizedDraft : card);
    setCards(saved);
    if (currentUser) cacheCards(currentUser.id, saved);
    try {
      const response = await fetchWithSessionRefresh("/api/cards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(optimizedDraft) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { notify("Your secure session expired. Please sign in once, then press Save & finish again."); setSaving(false); return; }
        throw new Error(payload.message || "Cloud save failed.");
      }
      const cloudCard = payload.card as Card;
      const cloudSaved = saved.map(card => card.id === optimizedDraft.id ? { ...optimizedDraft, ...cloudCard } : card);
      setCards(cloudSaved); setDraft({ ...optimizedDraft, ...cloudCard }); setSelectedId(cloudCard.id);
      if (currentUser) cacheCards(currentUser.id, cloudSaved);
      setCloudReady(true);
      lastSavedRef.current = JSON.stringify({ ...optimizedDraft, ...cloudCard });
      setSaveStatus("saved");
      if (!silent) notify("Card saved securely.");
    } catch (error) { setSaveStatus("error"); if (!silent) notify(error instanceof Error ? error.message : "Saved in this browser, but cloud save failed. Try again."); }
    finally { setSaving(false); }
    if (next) selectTab(next);
  };
  useEffect(() => {
    if (!authReady || !cloudReady || !currentUser || !draft.name || JSON.stringify(draft) === lastSavedRef.current) return;
    setSaveStatus("unsaved");
    const timer = window.setTimeout(() => { void save("dashboard", undefined, true); }, 1200);
    return () => window.clearTimeout(timer);
  }, [draft, authReady, currentUser]);
  const openEditor = (card: Card) => { setSelectedId(card.id); setDraft(card); selectTab("contact"); };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    localStorage.removeItem("myluxcards_current_user");
    window.location.replace("/");
  };
  const handleFile = async (event: ChangeEvent<HTMLInputElement>, kind: "logo" | "cover" | "brochure") => {
    const file = event.target.files?.[0]; if (!file) return;
    if (kind === "brochure") {
      if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) {
        setErrors((e) => ({ ...e, brochure: "PDF only, maximum 5 MB." })); return;
      }
      setErrors((e) => ({ ...e, brochure: "" }));
    }
    if (kind !== "brochure") {
      const supportedImages = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
      if (!supportedImages.has(file.type)) {
        notify("Please choose a PNG, JPG, WebP, or GIF image.");
        event.target.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify("Images must be 5 MB or smaller.");
        event.target.value = "";
        return;
      }
    }
    const form = new FormData(); form.append("file", file); form.append("kind", kind);
    setUploadingKind(kind);
    notify("Uploading securely…");
    try {
      const response = await fetchWithSessionRefresh("/api/media", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Upload failed.");
      if (kind === "brochure") setDraft(old => ({ ...old, brochure: file.name, brochureData: payload.url }));
      else update(kind, payload.url);
      notify("Upload complete. Press Save & Finish to publish it.");
    } catch (error) { notify(error instanceof Error ? error.message : "Upload failed."); }
    finally {
      setUploadingKind(null);
      event.target.value = "";
    }
  };
  const clearCard = async (cardId: string) => {
    if (/^[0-9a-f-]{36}$/i.test(cardId)) {
      const response = await fetchWithSessionRefresh("/api/cards", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cardId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { notify(payload.message || "Card could not be removed."); return; }
    }
    const remaining = cards.filter(card => card.id !== cardId);
    const next = remaining[0] || createBlankCard(identity);
    const nextCards = remaining.length ? remaining : [next];
    setCards(nextCards); setDraft(next); setSelectedId(next.id);
    cacheCards(identity.id, nextCards);
    setDeleteId(null); setSaveStatus("saved"); notify("Card removed.");
  };
  const [overviewAnalytics, setOverviewAnalytics] = useState<{ totalOpens: number; nfcTaps: number; qrScans: number; otherOpens: number } | null>(null);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayoutType>("business");
  const [layoutModalOpen, setLayoutModalOpen] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [whatsappConnected, setWhatsappConnected] = useState(true);
  const [masterConfigOpen, setMasterConfigOpen] = useState(true);

  // Load user dashboard layout preference
  useEffect(() => {
    let active = true;
    const fetchLayoutPref = async () => {
      try {
        const res = await fetch("/api/user/dashboard-layout", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (active && data.layout) {
            setDashboardLayout(data.layout as DashboardLayoutType);
          }
        }
      } catch {
        /* fallback to default 'business' */
      }
    };
    void fetchLayoutPref();
    return () => { active = false; };
  }, []);

  // Load WhatsApp connection status
  useEffect(() => {
    let active = true;
    const checkWa = async () => {
      try {
        const res = await fetch("/api/whatsapp/connection", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (active) setWhatsappConnected(Boolean(json?.connected === true));
        } else {
          if (active) setWhatsappConnected(false);
        }
      } catch {
        console.log("WhatsApp connection unavailable");
        if (active) setWhatsappConnected(false);
      }
    };
    void checkWa();
    return () => { active = false; };
  }, []);


  // Handler for layout changes
  const handleSelectDashboardLayout = async (newLayout: DashboardLayoutType) => {
    const previous = dashboardLayout;
    setDashboardLayout(newLayout);
    notify("Dashboard updated.");

    try {
      const res = await fetch("/api/user/dashboard-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: newLayout }),
      });
      if (!res.ok) {
        setDashboardLayout(previous);
        notify("Could not save layout preference.");
      }
    } catch {
      setDashboardLayout(previous);
      notify("Failed to save layout preference.");
    }
  };

  useEffect(() => {
    let active = true;
    const loadOverviewAnalytics = async () => {
      try {
        const res = await fetch(`/api/analytics?period=${analyticsPeriod}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (active && res.ok && json?.summary) {
          setOverviewAnalytics({
            totalOpens: Number(json.summary.totalOpens || 0),
            nfcTaps: Number(json.summary.nfcTaps || 0),
            qrScans: Number(json.summary.qrScans || 0),
            otherOpens: Number(json.summary.otherOpens || 0),
          });
        }
      } catch {
        /* fail silently */
      }
    };
    void loadOverviewAnalytics();
    return () => { active = false; };
  }, [cards, analyticsPeriod]);

  const selected = cards.find((card) => card.id === selectedId) || draft;
  const totalViews = cards.reduce((sum, card) => sum + (card.analytics?.VIEW || card.views || 0), 0);
  const serverTotalOpens = overviewAnalytics?.totalOpens ?? totalViews;
  const serverNfcTaps = overviewAnalytics?.nfcTaps ?? 0;
  const serverQrScans = overviewAnalytics?.qrScans ?? 0;
  const serverOtherOpens = overviewAnalytics?.otherOpens ?? 0;

  const overviewUnreadRepliesCount = useMemo(() => {
    return leads.filter((l: any) => l.hasNewReply || l.has_new_reply).length;
  }, [leads]);

  const overviewFollowUpsCount = useMemo(() => {
    const now = new Date();
    return leads.filter((l: any) => {
      if (!l.nextFollowUpAt && !l.next_follow_up_at) return false;
      const d = new Date(l.nextFollowUpAt || l.next_follow_up_at);
      return d.getTime() <= now.getTime() + 24 * 60 * 60 * 1000;
    }).length;
  }, [leads]);

  const activeCards = cards.filter((card) => card.active).length;
  const profileFields = [selected.name, selected.title, selected.business, selected.email, selected.mobile, selected.website, selected.about, selected.logo];
  const profileCompletion = Math.round(profileFields.filter((value) => fieldValue(value)).length / profileFields.length * 100);
  const filtered = useMemo(() => cards.filter((card) =>
    `${card.name} ${card.slug}`.toLowerCase().includes(search.toLowerCase())), [cards, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const start = filtered.length ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, filtered.length);

  if (!authReady || !currentUser) {
    return <div className="dash-auth-loading">Opening your dashboard…</div>;
  }

  return (
    <div className="dash-shell">
      <header className="dash-top">
        <button className="hamb" onClick={() => setSidebar(!sidebar)} aria-label="Toggle navigation">☰</button>
        <a className="dash-brand" href="/">
          <Image
            src="/assets/logo.svg"
            alt="Zappit logo"
            width={240}
            height={120}
            priority
            style={{
              width: "auto",
              height: "auto",
            }}
          />
        </a>
        <span className="crumb">/ &nbsp;{tab === "cards" ? "My Cards" : tab === "dashboard" ? "Dashboard" : `Edit Card · ${tab[0].toUpperCase() + tab.slice(1)}`}</span><span className={`save-state ${saveStatus}`}>{saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Changes pending" : saveStatus === "error" ? "Cloud save failed" : "Saved"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NotificationBell onSelectEntity={(entityType, entityId, actionUrl) => {
            if (actionUrl) {
              window.location.href = actionUrl;
            }
          }} />
          <div className="account-menu">
            <button className="avatar" title={currentUser.email} aria-label="Open account menu" aria-expanded={accountMenu} onClick={() => setAccountMenu((open) => !open)}>{currentUser.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ML"}</button>
            {accountMenu && <div className="account-popover">
              <strong>{currentUser.name}</strong>
              <span>{currentUser.email}</span>
              {(currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN") && (
                <a href="/admin" style={{ display: "block", margin: "8px 0", color: "#0066FF", fontWeight: 600, textDecoration: "none" }}>⚙ Admin Portal</a>
              )}
              <button type="button" className="btn-change-nickname" onClick={handleOpenNicknameModal}>✏ Change Nickname</button>
              <button type="button" onClick={logout}>Log out</button>
            </div>}
          </div>
        </div>
      </header>
      <nav className="mobile-tabbar" aria-label="Dashboard sections">
        {(["dashboard", "analytics", "modes", "contact", "social", "company", "appearance", "cards"] as Tab[]).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => selectTab(item)}>{item === "dashboard" ? "Home" : item === "analytics" ? "QR Activity" : item === "modes" ? "Modes" : item === "contact" ? "Contact" : item === "social" ? "Links" : item === "company" ? "Company" : item === "appearance" ? "Design" : "My Cards"}</button>)}
      </nav>
      {sidebar && <button className="side-scrim" aria-label="Close navigation" onClick={() => setSidebar(false)} />}
      <aside className={`dash-side ${sidebar ? "open" : ""}`}>
        <nav>
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => selectTab("dashboard")}><I>⌂</I> Dashboard</button>
          <button className={tab === "analytics" ? "active" : ""} onClick={() => selectTab("analytics")}><I>📊</I> QR Activity</button>

          {/* Master Configuration Sidebar Accordion */}
          <div className="side-config-group">
            <button
              type="button"
              className={`side-parent-btn ${["config-sources", "config-products", "config-stages", "config-calendar", "config-reasons"].includes(tab) ? "active" : ""}`}
              onClick={() => setMasterConfigOpen((prev) => !prev)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <I>⚙</I> Master Configuration
              </span>
              <b style={{ fontSize: 10 }}>{masterConfigOpen ? "▲" : "▼"}</b>
            </button>

            {masterConfigOpen && (
              <div className="side-config-subnav">
                <button
                  type="button"
                  className={`side-config-subitem ${tab === "config-sources" ? "active" : ""}`}
                  onClick={() => selectTab("config-sources" as Tab)}
                >
                  Lead Sources
                  {tab === "config-sources" && <span className="side-config-subitem-dot" />}
                </button>

                <button
                  type="button"
                  className={`side-config-subitem ${tab === "config-products" ? "active" : ""}`}
                  onClick={() => selectTab("config-products" as Tab)}
                >
                  Products
                  {tab === "config-products" && <span className="side-config-subitem-dot" />}
                </button>

                <button
                  type="button"
                  className={`side-config-subitem ${tab === "config-stages" ? "active" : ""}`}
                  onClick={() => selectTab("config-stages" as Tab)}
                >
                  Lead Stages
                  {tab === "config-stages" && <span className="side-config-subitem-dot" />}
                </button>

                <button
                  type="button"
                  className={`side-config-subitem ${tab === "config-calendar" ? "active" : ""}`}
                  onClick={() => selectTab("config-calendar" as Tab)}
                >
                  Calendar
                  {tab === "config-calendar" && <span className="side-config-subitem-dot" />}
                </button>

                <button
                  type="button"
                  className={`side-config-subitem ${tab === "config-reasons" ? "active" : ""}`}
                  onClick={() => selectTab("config-reasons" as Tab)}
                >
                  LOB Reasons
                  {tab === "config-reasons" && <span className="side-config-subitem-dot" />}
                </button>
              </div>
            )}
          </div>

          <div className="card-owner"><span><I>◆</I>{selected.name}</span><b>⌄</b></div>
          <div className="subnav">
            {(["modes", "contact", "social", "company", "appearance"] as Tab[]).map((item) =>
              <button key={item} className={tab === item ? "active" : ""} onClick={() => selectTab(item)}>
                {item === "modes" ? "Profile Mode & Features" : item === "contact" ? "Contact Info" : item === "social" ? "Apps & Links" : item[0].toUpperCase() + item.slice(1)}
              </button>)}
            <small>{selected.active ? "Published until you switch it off" : "Currently switched off"} ({selected.id.replace("card-", "#")})</small>
          </div>
          <button className={tab === "cards" ? "active" : ""} onClick={() => selectTab("cards")}><I>▣</I> My Cards</button>
          <a className="side-link" href="/notifications"><I>🔔</I> Notifications</a>
          <a className="side-link" href="/orders"><I>▤</I> My Orders</a>
          {(currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN") && (
            <a className="side-link" href="/admin" style={{ color: "#0066FF", fontWeight: 600 }}><I>⚙</I> Admin Portal</a>
          )}
        </nav>
        <div className="demo-note"><span>{cloudReady ? "Secure cloud workspace" : "Offline-safe workspace"}</span><p>{cloudReady ? "Cards and analytics are connected to your account." : "Drafts remain in this browser until cloud storage becomes available."}</p></div>
      </aside>
      <main className="dash-main">
        {tab === "dashboard" && (
          <section>
            <LeadManagementDashboard
              userName={currentUser.name}
              onNavigateTab={(t) => selectTab(t as Tab)}
            />
          </section>
        )}

        {/* Master Configuration Page Views */}
        {tab === "config-sources" && <section><LeadSourcesConfig /></section>}
        {tab === "config-products" && <section><ProductsConfig /></section>}
        {tab === "config-stages" && <section><LeadStagesConfig /></section>}
        {tab === "config-calendar" && <section><CalendarConfig /></section>}
        {tab === "config-reasons" && <section><LobReasonsConfig /></section>}

        <DashboardLayoutSelectorModal
          currentLayout={dashboardLayout}
          onSelectLayout={handleSelectDashboardLayout}
          isOpen={layoutModalOpen}
          onClose={() => setLayoutModalOpen(false)}
        />

        {(["modes", "contact", "social", "company", "appearance"] as Tab[]).includes(tab) && <section>
          <div className="page-heading edit-heading"><div><p>EDIT CARD</p><h1>{tab === "modes" ? "Profile mode & feature settings" : tab === "contact" ? "Contact information" : tab === "social" ? "Apps & links" : tab === "company" ? "Company details" : "Card appearance"}</h1><span>Changes appear in the preview as you type.</span></div></div>
          <div className="edit-layout">
            <div className="form-card">
              {tab === "modes" && <ModesForm draft={draft} update={update} contactNumbers={contactNumbers} emergencyContacts={emergencyContacts} onContactsRefresh={reloadContactsData} />}
              {tab === "contact" && <ContactForm draft={draft} update={update} errors={errors} same={sameAsMobile} setSame={setSameAsMobile} handleFile={handleFile} />}
              {tab === "social" && <SocialForm draft={draft} update={update} errors={errors} />}
              {tab === "company" && <CompanyForm draft={draft} update={update} service={service} setService={setService} notify={notify} />}
              {tab === "appearance" && <AppearanceForm draft={draft} update={update} handleFile={handleFile} uploadingKind={uploadingKind} />}
              {tab === "appearance" && <div className="save-finish-reminder" role="note"><span aria-hidden>✓</span><p><strong>Remember to save</strong>Always press <b>Save &amp; finish</b> when you’re done so your latest changes appear on every device.</p></div>}
              <div className="form-actions">
                <button className="save" disabled={saving} onClick={() => save(tab)}>{saving ? "Saving…" : "Update"}</button>
                {tab !== "appearance" && <button className="next" disabled={saving} onClick={() => save(tab, tab === "modes" ? "contact" : tab === "contact" ? "social" : tab === "social" ? "company" : "appearance")}>{saving ? "Saving…" : "Next →"}</button>}
                {tab === "appearance" && <button className="next" disabled={saving} onClick={() => save(tab, "cards")}>{saving ? "Saving…" : "Save & finish →"}</button>}
              </div>
            </div>
            <PreviewPanel card={draft} onOpen={requestCardOpen} />
          </div>
        </section>}

        {tab === "cards" && <section>
          <div className="page-heading"><div><p>CARD LIBRARY</p><h1>My Cards</h1><span>Search, publish, and manage your digital cards.</span></div><button className="primary" onClick={() => selectTab("contact")}>Edit my card</button></div>
          <div className="table-card">
            <div className="table-tools"><label>Show <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}><option>10</option><option>25</option><option>50</option></select> entries</label><label className="search">⌕ <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search cards..." /></label></div>
            <div className="table-scroll"><table><thead><tr><th>Sr. No.</th><th>Name (slug)</th><th>Availability</th><th>Views</th><th>Edit</th><th>Status</th><th>Delete</th></tr></thead>
              <tbody>{visible.map((card, index) => <tr key={card.id}><td data-label="Card">{start + index}</td><td data-label="Name"><button className="card-name-link" onClick={() => requestCardOpen(card)}><strong>{card.name}</strong><small>/{card.slug}</small></button></td><td data-label="Availability">{card.active ? "Published until you switch it off" : "Switched off"}</td><td data-label="Views"><span className="view-badge">{card.analytics?.VIEW || card.views || 0}</span></td><td data-label="Edit"><button className="edit-btn" onClick={() => openEditor(card)}>Edit</button></td><td data-label="Published"><button className={`switch ${card.active ? "on" : ""}`} aria-label={`Toggle ${card.name}`} onClick={async () => { const response = await fetchWithSessionRefresh("/api/cards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: card.id, slug: card.slug, toggleActive: true }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) { notify(payload.message || "Status could not be changed."); return; } const confirmed = { ...card, ...payload.card }; lastSavedRef.current = JSON.stringify(confirmed); setCards(current => current.map(item => item.id === card.id ? confirmed : item)); if (selectedId === card.id) setDraft(confirmed); setSaveStatus("saved"); notify(confirmed.active ? "Card published." : "Card switched off. It will stay off until you turn it on."); }}><span /></button></td><td data-label="Remove"><button className="delete-btn" onClick={() => setDeleteId(card.id)}>Delete</button></td></tr>)}</tbody>
            </table></div>
            <div className="table-footer"><span>Showing {start} to {end} of {filtered.length} entries</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className="current">{page}</button><button disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
          </div>
        </section>}

        {tab === "analytics" && <AnalyticsTab selectedCardId={selected?.id || ""} />}
      </main>
      {toast && <div className="dash-toast">✓ {toast}</div>}
      <MyLuxModal
        isOpen={nicknameModalOpen}
        onClose={() => {
          if (!savingNickname) setNicknameModalOpen(false);
        }}
        title="Change Nickname"
        subtitle="Update your nickname displayed across your profile."
        maxWidth={440}
        footer={
          <>
            <button
              type="button"
              className="mylux-btn-cancel"
              onClick={() => setNicknameModalOpen(false)}
              disabled={savingNickname}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mylux-btn-submit"
              onClick={handleSaveNickname}
              disabled={savingNickname}
            >
              {savingNickname ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveNickname} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", display: "block", marginBottom: 6, fontWeight: 600 }}>
              Current Nickname
            </label>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", background: "rgba(255, 255, 255, 0.05)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255, 255, 255, 0.1)" }}>
              {currentUser?.name || "N/A"}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label htmlFor="nickname-input" style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
                New Nickname
              </label>
              <span style={{ fontSize: 11, color: nicknameInput.trim().length > 30 ? "#ff4d4f" : "rgba(255,255,255,0.5)" }}>
                {nicknameInput.trim().length}/30
              </span>
            </div>
            <input
              id="nickname-input"
              type="text"
              value={nicknameInput}
              onChange={(e) => {
                setNicknameInput(e.target.value);
                if (nicknameError) setNicknameError("");
              }}
              placeholder="Enter new nickname"
              maxLength={30}
              autoFocus
              disabled={savingNickname}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#0c0d12",
                border: nicknameError ? "1px solid #ff4d4f" : "1px solid rgba(0, 102, 255, 0.4)",
                borderRadius: 8,
                color: "#ffffff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {nicknameError && (
              <p style={{ color: "#ff4d4f", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                {nicknameError}
              </p>
            )}
          </div>
        </form>
      </MyLuxModal>
      <MyLuxModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Remove this card?"
        subtitle="This permanently removes only this card. Your other cards and account remain unchanged."
        maxWidth={480}
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setDeleteId(null)}>Cancel</button>
            <button type="button" style={{ background: "#e74c3c", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }} onClick={() => deleteId && clearCard(deleteId)}>Remove card</button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
          Are you sure you want to remove this digital card? All configuration and settings for this card will be permanently removed from your account.
        </div>
      </MyLuxModal>
      <LegalConsentModal
        isOpen={consentModalOpen}
        onConsentAccepted={() => setConsentModalOpen(false)}
      />
    </div>
  );
}



  function AnalyticsTab({ selectedCardId }: { selectedCardId: string }) {
  const [period, setPeriod] = useState<"today" | "7d" | "30d">("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    summary: { totalOpens: number; nfcTaps: number; qrScans: number; otherOpens: number; profileViews: number; vehicleViews: number; lostFoundViews: number; contactTaps: number; locationsShared: number };
    modes: { profile: number; vehicle: number; lostFound: number };
    vehicles: Array<{ id: string; displayName: string; make: string; model: string; totalViews: number; ownerTaps: number; emergencyTaps: number }>;
    lostItems: Array<{ id: string; name: string; category: string; totalViews: number; ownerTaps: number; locationsShared: number }>;
    recentActivity: Array<{ id: string; createdAt: string; eventType: string; mode: "profile" | "vehicle" | "lost_found"; assetName?: string; context?: string; hasLocation: boolean; locationLabel?: string }>;
  } | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?cardId=${encodeURIComponent(selectedCardId)}&period=${period}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(json);
      } else {
        setError(json.message || "Unable to load QR activity. Please try again.");
      }
    } catch {
      setError("Unable to load QR activity due to a network connection issue.");
    } finally {
      setLoading(false);
    }
  }, [selectedCardId, period]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const summary = data?.summary || { totalOpens: 0, nfcTaps: 0, qrScans: 0, otherOpens: 0, profileViews: 0, vehicleViews: 0, lostFoundViews: 0, contactTaps: 0, locationsShared: 0 };
  const modes = data?.modes || { profile: 0, vehicle: 0, lostFound: 0 };
  const vehicles = data?.vehicles || [];
  const lostItems = data?.lostItems || [];
  const recent = data?.recentActivity || [];

  const maxModeViews = Math.max(modes.profile, modes.vehicle, modes.lostFound, 1);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p>QR ACTIVITY &amp; ANALYTICS</p>
          <h1>Scan History &amp; Activity</h1>
          <span>Privacy-safe activity analytics for your MyLux QR identity. No visitor personal data is collected.</span>
        </div>
        <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.06)", padding: 4, borderRadius: 10, border: "1px solid rgba(0, 229, 255,0.2)" }}>
          {(["today", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              type="button"
              style={{
                background: period === p ? "#0066FF" : "transparent",
                color: period === p ? "#000" : "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => setPeriod(p)}
            >
              {p === "today" ? "Today" : p === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 30, textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            ⏳ Loading activity analytics…
          </div>
        </div>
      ) : error ? (
        <div style={{ padding: 36, textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <h3 style={{ color: "#e74c3c", fontSize: 18, margin: "0 0 6px" }}>Unable to load QR activity</h3>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, maxWidth: 420, margin: "0 auto 18px", lineHeight: 1.5 }}>
            {error}
          </p>
          <button
            type="button"
            style={{ background: "#0066FF", color: "#000", border: "none", padding: "10px 22px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            onClick={() => void fetchAnalytics()}
          >
            Retry
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Row 1: Profile Entry Sources */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "rgba(0, 229, 255,0.9)", letterSpacing: "0.05em", margin: "0 0 10px" }}>Profile Entry Sources</h4>
            <div className="stats">
              <article className="orange">
                <div>
                  <strong>{summary.totalOpens}</strong>
                  <span>TOTAL PROFILE OPENS</span>
                </div>
                <i>📊</i>
              </article>
              <article className="blue">
                <div>
                  <strong>{summary.nfcTaps}</strong>
                  <span>NFC CARD TAPS</span>
                </div>
                <i>📱</i>
              </article>
              <article className="green">
                <div>
                  <strong>{summary.qrScans}</strong>
                  <span>QR SCANS</span>
                </div>
                <i>📷</i>
              </article>
              <article className="orange">
                <div>
                  <strong>{summary.otherOpens}</strong>
                  <span>OTHER / DIRECT OPENS</span>
                </div>
                <i>🔗</i>
              </article>
            </div>
          </div>

          {/* Row 2: Visitor Feature Interactions */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em", margin: "10px 0 10px" }}>Visitor Feature Interactions</h4>
            <div className="stats">
              <article className="green">
                <div>
                  <strong>{summary.vehicleViews}</strong>
                  <span>VEHICLE CONNECT VIEWS</span>
                </div>
                <i>🚗</i>
              </article>
              <article className="orange">
                <div>
                  <strong>{summary.lostFoundViews}</strong>
                  <span>LOST &amp; FOUND VIEWS</span>
                </div>
                <i>🏷️</i>
              </article>
              <article className="blue">
                <div>
                  <strong>{summary.contactTaps}</strong>
                  <span>CONTACT TAPS</span>
                </div>
                <i>📞</i>
              </article>
            </div>
          </div>

          {/* Activity by Mode */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0, 229, 255,0.2)", borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Activity by Mode</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  <span>Digital Profile</span>
                  <strong>{modes.profile} views</strong>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(modes.profile / maxModeViews) * 100}%`, background: "#0066FF", borderRadius: 4 }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  <span>Vehicle Connect</span>
                  <strong>{modes.vehicle} views</strong>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(modes.vehicle / maxModeViews) * 100}%`, background: "#3498db", borderRadius: 4 }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  <span>Lost &amp; Found</span>
                  <strong>{modes.lostFound} views</strong>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(modes.lostFound / maxModeViews) * 100}%`, background: "#e67e22", borderRadius: 4 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Activity Breakdown */}
          {vehicles.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0, 229, 255,0.2)", borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 14px" }}>🚗 Vehicle Activity</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {vehicles.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{v.displayName || [v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}</div>
                      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>{[v.make, v.model].filter(Boolean).join(" • ")}</div>
                    </div>
                    <div style={{ display: "flex", gap: 14, textAlign: "right" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0066FF" }}>{v.totalViews}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>views</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{v.ownerTaps}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>owner taps</div>
                      </div>
                      {v.emergencyTaps > 0 && (
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#e74c3c" }}>{v.emergencyTaps}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>emergency taps</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lost & Found Activity Breakdown */}
          {lostItems.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0, 229, 255,0.2)", borderRadius: 16, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 14px" }}>🏷️ Lost &amp; Found Activity</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {lostItems.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{item.name || "Tagged Item"}</div>
                      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Category: {item.category}</div>
                    </div>
                    <div style={{ display: "flex", gap: 14, textAlign: "right" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0066FF" }}>{item.totalViews}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>views</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{item.ownerTaps}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>owner taps</div>
                      </div>
                      {item.locationsShared > 0 && (
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#2ecc71" }}>{item.locationsShared}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>locations shared</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy-Safe Recent Activity Feed */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0, 229, 255,0.2)", borderRadius: 16, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 14px" }}>Privacy-Safe Recent Activity Log</h3>
            {recent.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                No activity recorded yet for this timeframe. When visitors open your MyLux card, activity events will appear here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recent.map((ev) => (
                  <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>
                        {ev.eventType === "PROFILE_OPENED" || ev.eventType === "VIEW" ? "Profile viewed" :
                          ev.eventType === "VEHICLE_MODE_OPENED" ? "Vehicle Connect opened" :
                            ev.eventType === "VEHICLE_SELECTED" ? `Vehicle selected: ${ev.assetName || "Vehicle"}` :
                              ev.eventType === "LOST_FOUND_MODE_OPENED" ? "Lost & Found opened" :
                                ev.eventType === "LOST_FOUND_ITEM_SELECTED" ? `Lost & Found item viewed: ${ev.assetName || "Item"}` :
                                  ev.eventType === "PHONE_NUMBER_TAPPED" ? `Contact number tapped ${ev.assetName ? `(${ev.assetName})` : ""}` :
                                    ev.eventType === "LOCATION_SHARED" ? `📍 Location voluntarily shared for ${ev.assetName || "Item"}` :
                                      "Activity recorded"}
                      </div>
                      {ev.hasLocation && (
                        <div style={{ fontSize: 12, color: "#2ecc71", marginTop: 2 }}>
                          📍 Voluntary finder location received
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>
                      {new Date(ev.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ProfileFeatureEngineManager({ draft, update, onContactsRefresh }: { draft: Card; update: (field: string, val: any) => void; onContactsRefresh: () => void }) {
  const [savingFeature, setSavingFeature] = useState<string | null>(null);
  const [featureError, setFeatureError] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "OFF">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [activeManagerSection, setActiveManagerSection] = useState<string | null>(null);

  const featureMetadata: Record<string, { label: string; icon: string; desc: string; category: string }> = {
    BASIC_PROFILE: { label: "About Me", icon: "👤", desc: "Your photo, title, business name, bio & overview", category: "PERSONAL" },
    CONTACT: { label: "Contact Details", icon: "📞", desc: "Phone, WhatsApp, email & vCard save contact button", category: "PERSONAL" },
    SOCIAL_LINKS: { label: "Social Links", icon: "🔗", desc: "Instagram, LinkedIn, X, YouTube & web profiles", category: "PERSONAL" },
    WEBSITE: { label: "Website & Brochure", icon: "🌐", desc: "Company website URL & downloadable PDF brochure", category: "PERSONAL" },
    RESUME: { label: "Resume / CV", icon: "📄", desc: "Professional resume & CV attachment download", category: "PERSONAL" },
    PRODUCTS: { label: "Products", icon: "🛍️", desc: "Custom profile products with pricing, photos & CTAs", category: "BUSINESS" },
    SERVICES: { label: "Services", icon: "💼", desc: "Professional services offered with pricing & descriptions", category: "BUSINESS" },
    PORTFOLIO: { label: "Portfolio", icon: "🎨", desc: "Project showcase grid, client work & project links", category: "BUSINESS" },
    BUSINESS_HOURS: { label: "Business Hours", icon: "🕒", desc: "Weekly operating schedule & availability hours", category: "BUSINESS" },
    LOCATION: { label: "Location & Map", icon: "📍", desc: "Office address, location map & directions link", category: "BUSINESS" },
    PAYMENT_LINKS: { label: "Payment Links", icon: "💳", desc: "UPI ID, PayPal, Razorpay & payment button links", category: "BUSINESS" },
    GALLERY: { label: "Photo Gallery", icon: "🖼️", desc: "High-resolution photo gallery & lightbox slider", category: "MEDIA" },
    VIDEOS: { label: "Video Showcase", icon: "🎬", desc: "YouTube, Vimeo & video embed showcases", category: "MEDIA" },
    DOCUMENTS: { label: "Documents", icon: "📁", desc: "Downloadable PDF files, catalogs & documents", category: "MEDIA" },
    ACHIEVEMENTS: { label: "Achievements", icon: "🏆", desc: "Honors, awards, key metrics & milestones", category: "CREDENTIALS" },
    CERTIFICATIONS: { label: "Certifications", icon: "📜", desc: "Verified professional certifications & licenses", category: "CREDENTIALS" },
    VEHICLE: { label: "Vehicle Connect", icon: "🚗", desc: "Vehicle details, parking notes & direct contact", category: "SPECIAL" },
    LOST_AND_FOUND: { label: "Lost & Found", icon: "🏷️", desc: "Tagged item lost-and-found finder contact form", category: "SPECIAL" },
    EMERGENCY_CONTACT: { label: "Emergency Contact", icon: "🚨", desc: "Emergency contact details & rapid safety response", category: "SPECIAL" },
  };

  const SECTION_CATEGORIES = [
    { key: "PERSONAL", title: "PERSONAL", desc: "Basic details, contact info & links" },
    { key: "BUSINESS", title: "BUSINESS", desc: "Products, services, portfolio & locations" },
    { key: "MEDIA", title: "MEDIA", desc: "Photos, videos & file attachments" },
    { key: "CREDENTIALS", title: "CREDENTIALS", desc: "Awards, milestones & certifications" },
    { key: "SPECIAL", title: "SPECIAL", desc: "Vehicle Connect, Lost & Found & Emergency" },
  ];

  const profileFeatures = (draft as any).profileFeatures || {
    BASIC_PROFILE: { enabled: true, sortOrder: 0 },
    CONTACT: { enabled: true, sortOrder: 1 },
    SOCIAL_LINKS: { enabled: true, sortOrder: 2 },
    WEBSITE: { enabled: true, sortOrder: 3 },
    EMERGENCY_CONTACT: { enabled: true, sortOrder: 4 },
    VEHICLE: { enabled: true, sortOrder: 5 },
    LOST_AND_FOUND: { enabled: true, sortOrder: 6 },
    PRODUCTS: { enabled: false, sortOrder: 7 },
    SERVICES: { enabled: false, sortOrder: 8 },
    PORTFOLIO: { enabled: false, sortOrder: 9 },
    GALLERY: { enabled: false, sortOrder: 10 },
    VIDEOS: { enabled: false, sortOrder: 11 },
    BUSINESS_HOURS: { enabled: false, sortOrder: 12 },
    LOCATION: { enabled: false, sortOrder: 13 },
    PAYMENT_LINKS: { enabled: false, sortOrder: 14 },
    DOCUMENTS: { enabled: false, sortOrder: 15 },
    RESUME: { enabled: false, sortOrder: 16 },
    ACHIEVEMENTS: { enabled: false, sortOrder: 17 },
    CERTIFICATIONS: { enabled: false, sortOrder: 18 },
  };

  const featureOrder = (draft as any).featureOrder || [
    "BASIC_PROFILE",
    "CONTACT",
    "SOCIAL_LINKS",
    "WEBSITE",
    "EMERGENCY_CONTACT",
    "VEHICLE",
    "LOST_AND_FOUND",
    "PRODUCTS",
    "SERVICES",
    "PORTFOLIO",
    "GALLERY",
    "VIDEOS",
    "BUSINESS_HOURS",
    "LOCATION",
    "PAYMENT_LINKS",
    "DOCUMENTS",
    "RESUME",
    "ACHIEVEMENTS",
    "CERTIFICATIONS",
  ];

  // Fetch count metadata for section items where applicable
  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      if (!draft.id) return;
      setLoadingCounts(true);
      try {
        const counts: Record<string, number> = {};
        
        // Products count
        const prodRes = await fetch(`/api/cards/profile-products?cardId=${encodeURIComponent(draft.id)}`);
        if (prodRes.ok) {
          const pData = await prodRes.json();
          if (Array.isArray(pData.products)) counts.PRODUCTS = pData.products.length;
        }

        // Modular sections counts
        const modularTypes = ["services", "portfolio", "gallery", "videos", "payment_links", "documents", "achievements", "certifications"];
        await Promise.all(modularTypes.map(async (sec) => {
          try {
            const res = await fetch(`/api/cards/profile-sections/${sec}?cardId=${encodeURIComponent(draft.id)}`);
            if (res.ok) {
              const d = await res.json();
              if (Array.isArray(d.items)) counts[sec.toUpperCase()] = d.items.length;
            }
          } catch {
            // ignore
          }
        }));

        // Social links count
        if (draft.social && typeof draft.social === "object") {
          counts.SOCIAL_LINKS = Object.values(draft.social).filter(Boolean).length;
        }

        if (!cancelled) setItemCounts(counts);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingCounts(false);
      }
    };
    void fetchCounts();
    return () => { cancelled = true; };
  }, [draft.id, draft.social]);

  const handleToggleFeature = async (key: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const updatedFeatures = {
      ...profileFeatures,
      [key]: {
        ...(profileFeatures[key] || { sortOrder: 0 }),
        enabled: newStatus,
      },
    };

    update("profileFeatures", updatedFeatures);
    setSavingFeature(key);
    setFeatureError("");

    try {
      const res = await fetch("/api/profile/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: draft.id,
          featureKey: key,
          enabled: newStatus,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        update("profileFeatures", profileFeatures);
        setFeatureError(data.message || `Unable to update feature status.`);
      }
    } catch {
      update("profileFeatures", profileFeatures);
      setFeatureError(`Unable to update feature status.`);
    } finally {
      setSavingFeature(null);
    }
  };

  const handleMoveFeature = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= featureOrder.length) return;

    const newOrder = [...featureOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    update("featureOrder", newOrder);

    try {
      await fetch("/api/profile/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: draft.id,
          featureOrder: newOrder,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newOrder = [...featureOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    setDraggedIndex(null);
    update("featureOrder", newOrder);

    try {
      await fetch("/api/profile/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: draft.id,
          featureOrder: newOrder,
        }),
      });
    } catch {
      // ignore
    }
  };

  const activeFeatureKeys = featureOrder.filter((k: string) => profileFeatures[k]?.enabled !== false);
  const availableFeatureKeys = featureOrder.filter((k: string) => profileFeatures[k]?.enabled === false);

  // Filtered keys based on tab and search
  const filteredOrderKeys = featureOrder.filter((key: string) => {
    const meta = featureMetadata[key];
    const matchesSearch = !searchQuery.trim() || (meta && (meta.label.toLowerCase().includes(searchQuery.toLowerCase()) || meta.desc.toLowerCase().includes(searchQuery.toLowerCase())));
    const isEnabled = profileFeatures[key]?.enabled !== false;

    if (!matchesSearch) return false;
    if (activeTab === "ACTIVE") return isEnabled;
    if (activeTab === "OFF") return !isEnabled;
    return true;
  });

  const getSectionStatusBadge = (key: string) => {
    const isEnabled = profileFeatures[key]?.enabled !== false;
    const count = itemCounts[key];

    if (!isEnabled) {
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 6 }}>OFF</span>;
    }

    if (count !== undefined) {
      if (count > 0) {
        return <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 6 }}>✓ {count} {count === 1 ? "item" : "items"}</span>;
      }
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: "#f39c12", background: "rgba(243,156,18,0.15)", padding: "3px 8px", borderRadius: 6 }}>⚠️ No items yet</span>;
    }

    if (key === "BASIC_PROFILE") {
      return draft.name ? <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 6 }}>✓ Profile Set</span> : <span style={{ fontSize: 11.5, fontWeight: 700, color: "#f39c12", background: "rgba(243,156,18,0.15)", padding: "3px 8px", borderRadius: 6 }}>⚠️ Setup Name</span>;
    }
    if (key === "CONTACT") {
      return (draft.mobile || draft.email) ? <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 6 }}>✓ Contact Added</span> : <span style={{ fontSize: 11.5, fontWeight: 700, color: "#f39c12", background: "rgba(243,156,18,0.15)", padding: "3px 8px", borderRadius: 6 }}>⚠️ Add Contact</span>;
    }

    return <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 6 }}>ON</span>;
  };

  return (
    <div className="mode-settings-block" style={{ maxWidth: "100%" }}>
      {/* ── TOP HEADER / STATUS BAR ── */}
      <div className="ps-top-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>PROFILE SECTIONS</div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#2ecc71", background: "rgba(46, 204, 113, 0.15)", border: "1px solid rgba(46, 204, 113, 0.3)", padding: "3px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 8 }}>🟢</span> PROFILE LIVE
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: "6px 0 0" }}>
            Arrange the structure and content of your public card. Drag sections to reorder. Toggling OFF preserves your data and previous position.
          </p>
        </div>

        <div className="ps-header-actions">
          <button
            type="button"
            className="asset-btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ background: "linear-gradient(135deg, #0066FF, #00E5FF)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            + ADD SECTION
          </button>
          <div className="ps-secondary-actions">
            <a
              href={`/card/${draft.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              👁 PREVIEW PROFILE
            </a>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) {
                  const link = `${window.location.origin}/card/${draft.slug}`;
                  void navigator.clipboard.writeText(link);
                  alert("Profile URL copied to clipboard!");
                }
              }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              ↗ SHARE
            </button>
          </div>
        </div>
      </div>

      {featureError && (
        <div style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c", color: "#e74c3c", padding: "12px 16px", borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
          ⚠️ {featureError}
        </div>
      )}

      {/* ── SECTION MANAGEMENT LIST ── */}
      <div style={{ width: "100%" }}>
        {/* SEARCH & FILTER CONTROLS */}
        <div className="ps-filter-bar">
          <div className="ps-filter-tabs">
            {(["ALL", "ACTIVE", "OFF"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? "linear-gradient(135deg, #0066FF, #00E5FF)" : "transparent",
                  color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.6)",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {tab === "ALL" ? `ALL (${featureOrder.length})` : tab === "ACTIVE" ? `ACTIVE (${activeFeatureKeys.length})` : `OFF (${availableFeatureKeys.length})`}
              </button>
            ))}
          </div>

          <div className="ps-search-box">
            <input
              type="text"
              placeholder="Search sections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mylux-input"
              style={{ height: 36, fontSize: 12.5, paddingLeft: 30, borderRadius: 10, background: "rgba(255,255,255,0.04)" }}
            />
            <span style={{ position: "absolute", left: 10, top: 9, fontSize: 13, opacity: 0.5 }}>🔍</span>
          </div>
        </div>

        {/* DYNAMIC SECTION CARDS LIST */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          {filteredOrderKeys.length === 0 ? (
            <div style={{ padding: 30, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 12, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
              No sections found matching your filter criteria.
            </div>
          ) : (
            filteredOrderKeys.map((key: string) => {
              const index = featureOrder.indexOf(key);
              const meta = featureMetadata[key] || { label: key, icon: "⚡", desc: "", category: "GENERAL" };
              const isEnabled = profileFeatures[key]?.enabled !== false;
              const isSaving = savingFeature === key;

              return (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{ width: "100%" }}
                >
                  {/* ── DESKTOP HORIZONTAL ROW (≥768px) ── */}
                  <div
                    className="ps-desktop-only"
                    style={{
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: isEnabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                      border: isEnabled ? "1px solid rgba(0, 229, 255, 0.22)" : "1px dashed rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      padding: "14px 18px",
                      opacity: isEnabled ? 1 : 0.65,
                      transition: "all 0.15s ease",
                      cursor: "grab",
                    }}
                  >
                    {/* LEFT: DRAG HANDLE + ICON + TITLE + BADGE */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                      <span
                        title="Drag to reorder section"
                        style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", cursor: "grab", paddingRight: 4, userSelect: "none" }}
                      >
                        ☰
                      </span>
                      <span style={{ fontSize: 24, flexShrink: 0 }}>{meta.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff" }}>{meta.label}</span>
                          {getSectionStatusBadge(key)}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {meta.desc}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: TOGGLE SWITCH + REORDER + SETTINGS */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
                      {/* TOUCH REORDER BUTTONS */}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          title="Move section up"
                          onClick={() => handleMoveFeature(index, "up")}
                          disabled={index === 0}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 6, width: 26, height: 26, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: index === 0 ? "not-allowed" : "pointer", opacity: index === 0 ? 0.3 : 1 }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          title="Move section down"
                          onClick={() => handleMoveFeature(index, "down")}
                          disabled={index === featureOrder.length - 1}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 6, width: 26, height: 26, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: index === featureOrder.length - 1 ? "not-allowed" : "pointer", opacity: index === featureOrder.length - 1 ? 0.3 : 1 }}
                        >
                          ▼
                        </button>
                      </div>

                      {/* SECTION SETTINGS BUTTON */}
                      <button
                        type="button"
                        title="Section Settings & Content Editor"
                        onClick={() => setActiveManagerSection(key)}
                        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        ⚙ Edit
                      </button>

                      {/* ON/OFF TOGGLE SWITCH */}
                      <div
                        title={isEnabled ? "Click to disable section" : "Click to enable section"}
                        className={`mylux-toggle-switch ${isEnabled ? "active" : ""}`}
                        style={{ opacity: isSaving ? 0.5 : 1, cursor: isSaving ? "wait" : "pointer" }}
                        onClick={() => !isSaving && handleToggleFeature(key, isEnabled)}
                      >
                        <div className="mylux-toggle-knob" />
                      </div>
                    </div>
                  </div>

                  {/* ── MOBILE STACKED CARD VIEW (<768px) ── */}
                  <div className={`ps-mobile-only ps-mobile-card ${isEnabled ? "" : "disabled"}`}>
                    {/* HEADER ROW: DRAG HANDLE + ICON + TITLE + TOGGLE */}
                    <div className="ps-mobile-header">
                      <div className="ps-mobile-title-block">
                        <span style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", cursor: "grab", userSelect: "none", flexShrink: 0 }}>
                          ☰
                        </span>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.icon}</span>
                        <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>{meta.label}</span>
                      </div>
                      <div
                        title={isEnabled ? "Click to disable section" : "Click to enable section"}
                        className={`mylux-toggle-switch ${isEnabled ? "active" : ""}`}
                        style={{ opacity: isSaving ? 0.5 : 1, cursor: isSaving ? "wait" : "pointer", flexShrink: 0 }}
                        onClick={() => !isSaving && handleToggleFeature(key, isEnabled)}
                      >
                        <div className="mylux-toggle-knob" />
                      </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div className="ps-mobile-desc">
                      {meta.desc}
                    </div>

                    {/* STATUS BADGE */}
                    <div className="ps-mobile-badge-row">
                      {getSectionStatusBadge(key)}
                    </div>

                    {/* ACTION ROW: REORDER BUTTONS + EDIT BUTTON */}
                    <div className="ps-mobile-actions">
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          title="Move section up"
                          onClick={() => handleMoveFeature(index, "up")}
                          disabled={index === 0}
                          className="ps-mobile-reorder-btn"
                          style={{ opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? "not-allowed" : "pointer" }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          title="Move section down"
                          onClick={() => handleMoveFeature(index, "down")}
                          disabled={index === featureOrder.length - 1}
                          className="ps-mobile-reorder-btn"
                          style={{ opacity: index === featureOrder.length - 1 ? 0.3 : 1, cursor: index === featureOrder.length - 1 ? "not-allowed" : "pointer" }}
                        >
                          ▼
                        </button>
                      </div>

                      <button
                        type="button"
                        title="Section Settings & Content Editor"
                        onClick={() => setActiveManagerSection(key)}
                        className="ps-mobile-edit-btn"
                      >
                        ⚙ Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── CATEGORIZED ADD SECTION MODAL ── */}
      <MyLuxModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Profile Section"
        subtitle="Select a section to add to your public ZAPPIT profile structure."
        maxWidth={720}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SECTION_CATEGORIES.map((cat) => {
            const catKeys = featureOrder.filter((k: string) => featureMetadata[k]?.category === cat.key);
            if (catKeys.length === 0) return null;

            return (
              <div key={cat.key} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#00E5FF", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
                  {cat.title} • {cat.desc}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {catKeys.map((key: string) => {
                    const meta = featureMetadata[key];
                    const isEnabled = profileFeatures[key]?.enabled !== false;

                    return (
                      <div
                        key={key}
                        style={{
                          background: isEnabled ? "rgba(46, 204, 113, 0.08)" : "rgba(255,255,255,0.04)",
                          border: isEnabled ? "1px solid rgba(46, 204, 113, 0.3)" : "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{meta.icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{meta.label}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{meta.desc}</div>
                          </div>
                        </div>

                        {isEnabled ? (
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#2ecc71", alignSelf: "flex-end" }}>
                            ✓ Already added
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              void handleToggleFeature(key, false);
                              setIsAddModalOpen(false);
                            }}
                            style={{
                              background: "linear-gradient(135deg, #0066FF, #00E5FF)",
                              color: "#fff",
                              border: "none",
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: "pointer",
                              alignSelf: "flex-end",
                            }}
                          >
                            + Add Section
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </MyLuxModal>

      {/* ── SECTION EDIT / SETTINGS MODAL DELEGATION ── */}
      <MyLuxModal
        isOpen={Boolean(activeManagerSection)}
        onClose={() => setActiveManagerSection(null)}
        title={activeManagerSection ? `${featureMetadata[activeManagerSection]?.icon || "⚙"} Edit ${featureMetadata[activeManagerSection]?.label || "Section"}` : "Edit Section"}
        subtitle="Manage content and settings for this profile section."
        maxWidth={700}
      >
        {activeManagerSection === "PRODUCTS" && <ProfileProductsManager cardId={draft.id} />}
        {activeManagerSection === "VEHICLE" && <VehiclesManager cardId={draft.id} contactNumbers={[]} emergencyContacts={[]} />}
        {activeManagerSection === "LOST_AND_FOUND" && <LostItemsManager cardId={draft.id} contactNumbers={[]} />}
        {activeManagerSection === "EMERGENCY_CONTACT" && <EmergencyContactsManager emergencyContacts={[]} onRefresh={onContactsRefresh} />}
        {activeManagerSection && ["SERVICES", "PORTFOLIO", "GALLERY", "VIDEOS", "PAYMENT_LINKS", "DOCUMENTS", "ACHIEVEMENTS", "CERTIFICATIONS"].includes(activeManagerSection) && (
          <GenericProfileSectionManager
            cardId={draft.id}
            section={activeManagerSection.toLowerCase()}
            title={featureMetadata[activeManagerSection]?.label || activeManagerSection}
            icon={featureMetadata[activeManagerSection]?.icon || "⚡"}
            mediaKind={activeManagerSection.toLowerCase()}
          />
        )}
        {activeManagerSection && ["BASIC_PROFILE", "CONTACT", "SOCIAL_LINKS", "WEBSITE", "BUSINESS_HOURS", "LOCATION", "RESUME"].includes(activeManagerSection) && (
          <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 10, color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.6 }}>
            💡 Content for <strong>{featureMetadata[activeManagerSection]?.label}</strong> can be updated directly under the main profile form tabs. Toggle visibility using the ON/OFF switch in Profile Sections.
          </div>
        )}
      </MyLuxModal>
    </div>
  );
}

function ModesForm({ draft, update, contactNumbers = [], emergencyContacts = [], onContactsRefresh }: any) {
  const enabled = draft.enabledFeatures || { digitalProfile: true, vehicleConnect: true, lostAndFound: true };

  return (
    <>
      <div className="form-intro">
        <h2>Profile Mode &amp; Features</h2>
        <p>Enable features for your single permanent QR code and profile URL. Manage multiple vehicles, tagged items, and contact numbers under your account.</p>
      </div>

      <ProfileFeatureEngineManager draft={draft} update={update} onContactsRefresh={onContactsRefresh} />

      {/* ── CORE PROFILE MODES ── */}
      <div style={{ background: "linear-gradient(135deg, rgba(0, 102, 255, 0.08), rgba(0, 229, 255, 0.04))", border: "1px solid rgba(0, 229, 255, 0.22)", borderRadius: 16, padding: "20px 22px", marginTop: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>CORE PROFILE MODES</div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: "6px 0 16px" }}>
          Manage the permanent profile capabilities available to this card. Multiple modes can remain enabled at the same time.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* DIGITAL PROFILE ROW */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: enabled.digitalProfile !== false ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
              border: enabled.digitalProfile !== false ? "1px solid rgba(0, 229, 255, 0.22)" : "1px dashed rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "14px 18px",
              opacity: enabled.digitalProfile !== false ? 1 : 0.65,
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>💼</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff" }}>Digital Profile</span>
                  {enabled.digitalProfile !== false ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 6 }}>✓ ENABLED</span>
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 6 }}>✕ DISABLED</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                  Standard digital business card &amp; vCard contact sharing
                </div>
              </div>
            </div>

            <div
              title={enabled.digitalProfile !== false ? "Click to disable mode" : "Click to enable mode"}
              className={`mylux-toggle-switch ${enabled.digitalProfile !== false ? "active" : ""}`}
              style={{ cursor: "pointer", flexShrink: 0, marginLeft: 12 }}
              onClick={() => update("enabledFeatures", { ...enabled, digitalProfile: enabled.digitalProfile === false })}
            >
              <div className="mylux-toggle-knob" />
            </div>
          </div>

          {/* VEHICLE CONNECT ROW */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: enabled.vehicleConnect !== false ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
              border: enabled.vehicleConnect !== false ? "1px solid rgba(0, 229, 255, 0.22)" : "1px dashed rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "14px 18px",
              opacity: enabled.vehicleConnect !== false ? 1 : 0.65,
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>🚗</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff" }}>Vehicle Connect</span>
                  {enabled.vehicleConnect !== false ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 6 }}>✓ ENABLED</span>
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 6 }}>✕ DISABLED</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                  Multiple vehicles, parking information &amp; owner contact
                </div>
              </div>
            </div>

            <div
              title={enabled.vehicleConnect !== false ? "Click to disable mode" : "Click to enable mode"}
              className={`mylux-toggle-switch ${enabled.vehicleConnect !== false ? "active" : ""}`}
              style={{ cursor: "pointer", flexShrink: 0, marginLeft: 12 }}
              onClick={() => update("enabledFeatures", { ...enabled, vehicleConnect: enabled.vehicleConnect === false })}
            >
              <div className="mylux-toggle-knob" />
            </div>
          </div>

          {/* LOST & FOUND TAG ROW */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: enabled.lostAndFound !== false ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
              border: enabled.lostAndFound !== false ? "1px solid rgba(0, 229, 255, 0.22)" : "1px dashed rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "14px 18px",
              opacity: enabled.lostAndFound !== false ? 1 : 0.65,
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>🏷️</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: "#fff" }}>Lost &amp; Found Tag</span>
                  {enabled.lostAndFound !== false ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2ecc71", background: "rgba(46,204,113,0.15)", padding: "3px 8px", borderRadius: 6 }}>✓ ENABLED</span>
                  ) : (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 6 }}>✕ DISABLED</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                  Multiple tagged items, recovery instructions &amp; direct owner contact
                </div>
              </div>
            </div>

            <div
              title={enabled.lostAndFound !== false ? "Click to disable mode" : "Click to enable mode"}
              className={`mylux-toggle-switch ${enabled.lostAndFound !== false ? "active" : ""}`}
              style={{ cursor: "pointer", flexShrink: 0, marginLeft: 12 }}
              onClick={() => update("enabledFeatures", { ...enabled, lostAndFound: enabled.lostAndFound === false })}
            >
              <div className="mylux-toggle-knob" />
            </div>
          </div>
        </div>
      </div>

      {/* ── ACCOUNT CONTACT NUMBERS MANAGER ── */}
      <AccountContactNumbersManager contactNumbers={contactNumbers} onRefresh={onContactsRefresh} />

      {/* ── EMERGENCY CONTACTS MANAGER ── */}
      <EmergencyContactsManager emergencyContacts={emergencyContacts} onRefresh={onContactsRefresh} />

      {/* ── MULTI-VEHICLE MANAGEMENT ── */}
      <VehiclesManager cardId={draft.id} contactNumbers={contactNumbers} emergencyContacts={emergencyContacts} />

      {/* ── MULTI-ITEM LOST & FOUND MANAGEMENT ── */}
      <LostItemsManager cardId={draft.id} contactNumbers={contactNumbers} />

      {/* ── CUSTOM PROFILE PRODUCTS MANAGEMENT ── */}
      <ProfileProductsManager cardId={draft.id} />

      {/* ── MODULAR DYNAMIC PROFILE SECTIONS MANAGERS ── */}
      <GenericProfileSectionManager cardId={draft.id} section="services" title="SERVICES" icon="💼" mediaKind="service" />
      <GenericProfileSectionManager cardId={draft.id} section="portfolio" title="PORTFOLIO & PROJECTS" icon="🎨" mediaKind="portfolio" />
      <GenericProfileSectionManager cardId={draft.id} section="gallery" title="PHOTO GALLERY" icon="🖼️" mediaKind="gallery" />
      <GenericProfileSectionManager cardId={draft.id} section="videos" title="VIDEO SHOWCASE" icon="🎬" mediaKind="video" />
      <GenericProfileSectionManager cardId={draft.id} section="payment-links" title="PAYMENT LINKS & UPI" icon="💳" mediaKind="document" />
      <GenericProfileSectionManager cardId={draft.id} section="documents" title="DOCUMENTS & FILES" icon="📁" mediaKind="document" />
      <GenericProfileSectionManager cardId={draft.id} section="achievements" title="ACHIEVEMENTS & AWARDS" icon="🏆" mediaKind="achievement" />
      <GenericProfileSectionManager cardId={draft.id} section="certifications" title="CERTIFICATIONS" icon="📜" mediaKind="certification" />
    </>
  );
}

function AccountContactNumbersManager({ contactNumbers, onRefresh }: { contactNumbers: any[]; onRefresh: () => void }) {
  const [editingNumber, setEditingNumber] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNumber || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const isNew = !editingNumber.id;
      const url = "/api/contacts/numbers";
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingNumber),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingNumber(null);
        onRefresh();
      } else {
        setSaveError(data.message || "Failed to save contact number.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contacts/numbers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
      });
      if (res.ok) {
        setDeleteId(null);
        onRefresh();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const selectedDeleteNumber = contactNumbers.find((cn) => cn.id === deleteId);

  return (
    <div className="mode-settings-block">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="mode-settings-title" style={{ margin: 0 }}>☎ ACCOUNT CONTACT NUMBERS ({contactNumbers.length})</div>
        <button
          type="button"
          className="asset-btn-primary"
          onClick={() => {
            setSaveError("");
            setEditingNumber({
              label: "Personal",
              countryCode: "+91",
              phoneNumber: "",
              isPrimary: contactNumbers.length === 0,
              enabled: true,
            });
          }}
        >
          + ADD PHONE NUMBER
        </button>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 12px" }}>
        Your contact numbers can be reused across vehicles and Lost &amp; Found items. One number is designated as Primary.
      </p>

      {contactNumbers.length === 0 && !editingNumber && (
        <div style={{ padding: 18, background: "rgba(255,255,255,0.03)", borderRadius: 10, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          No contact numbers added yet. Click "+ ADD PHONE NUMBER" above to add your first number!
        </div>
      )}

      <div className="asset-card-list">
        {contactNumbers.map((cn) => (
          <div key={cn.id} className="asset-item-card">
            <div className="asset-item-info">
              <div className="asset-item-title">
                📞 {cn.countryCode ? `${cn.countryCode} ` : ""}{cn.phoneNumber}
                {cn.isPrimary && <span className="asset-badge-active" style={{ background: "rgba(0, 229, 255,0.2)", color: "#0066FF", border: "1px solid rgba(0, 229, 255,0.4)" }}>PRIMARY</span>}
              </div>
              <div className="asset-item-sub">
                Label: <strong>{cn.label}</strong>
              </div>
            </div>
            <div className="asset-item-actions">
              <button type="button" className="edit-btn" onClick={() => { setSaveError(""); setEditingNumber(cn); }}>Edit</button>
              <button type="button" className="delete-btn" onClick={() => setDeleteId(cn.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── ADD / EDIT NUMBER MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(editingNumber)}
        onClose={() => setEditingNumber(null)}
        title={editingNumber?.id ? "Edit Phone Number" : "Add Phone Number"}
        subtitle="Configure an account contact number."
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setEditingNumber(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-submit" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Number"}
            </button>
          </>
        }
      >
        {editingNumber && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {saveError && (
              <div style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c", color: "#e74c3c", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                ⚠️ {saveError}
              </div>
            )}

            <div className="mylux-field">
              <label className="mylux-field-label">Label (e.g. Personal / Work / UAE)</label>
              <select
                className="mylux-select"
                value={["Personal", "Mobile", "Work", "Office", "WhatsApp", "India", "UAE", "Other"].includes(editingNumber.label) ? editingNumber.label : "Custom"}
                onChange={(e) => {
                  if (e.target.value !== "Custom") {
                    setEditingNumber({ ...editingNumber, label: e.target.value });
                  }
                }}
              >
                <option value="Personal">Personal</option>
                <option value="Mobile">Mobile</option>
                <option value="Work">Work</option>
                <option value="Office">Office</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="India">India</option>
                <option value="UAE">UAE</option>
                <option value="Other">Other</option>
                <option value="Custom">Custom Label...</option>
              </select>
              {(!["Personal", "Mobile", "Work", "Office", "WhatsApp", "India", "UAE", "Other"].includes(editingNumber.label) || editingNumber.isCustomLabel) && (
                <input
                  type="text"
                  className="mylux-input"
                  style={{ marginTop: 6 }}
                  value={editingNumber.label || ""}
                  onChange={(e) => setEditingNumber({ ...editingNumber, label: e.target.value, isCustomLabel: true })}
                  placeholder="Enter custom label (e.g. Dubai SIM)"
                />
              )}
            </div>

            <div className="mylux-form-grid-2">
              <div className="mylux-field">
                <label className="mylux-field-label">Country Code</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingNumber.countryCode || ""}
                  onChange={(e) => setEditingNumber({ ...editingNumber, countryCode: e.target.value })}
                  placeholder="e.g. +91 / +971"
                />
              </div>
              <div className="mylux-field">
                <label className="mylux-field-label">Phone Number *</label>
                <input
                  type="tel"
                  className="mylux-input"
                  value={editingNumber.phoneNumber || ""}
                  onChange={(e) => setEditingNumber({ ...editingNumber, phoneNumber: e.target.value })}
                  placeholder="e.g. 98765 43210"
                  required
                />
              </div>
            </div>

            <div className="mylux-toggle-row">
              <div>
                <div className="mylux-radio-label-text">Set as Primary Number</div>
                <div className="mylux-radio-subtext">Primary number is used by default for Vehicle Connect and Lost &amp; Found.</div>
              </div>
              <div
                className={`mylux-toggle-switch ${editingNumber.isPrimary ? "active" : ""}`}
                onClick={() => setEditingNumber({ ...editingNumber, isPrimary: !editingNumber.isPrimary })}
              >
                <div className="mylux-toggle-knob" />
              </div>
            </div>
          </form>
        )}
      </MyLuxModal>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Remove this phone number?"
        subtitle={selectedDeleteNumber ? `${selectedDeleteNumber.countryCode || ""} ${selectedDeleteNumber.phoneNumber} (${selectedDeleteNumber.label})` : ""}
        maxWidth={460}
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setDeleteId(null)} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              style={{ background: "#e74c3c", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Remove"}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
          Are you sure you want to remove this phone number from your account? This change will persist permanently.
        </div>
      </MyLuxModal>
    </div>
  );
}

function EmergencyContactsManager({ emergencyContacts, onRefresh }: { emergencyContacts: any[]; onRefresh: () => void }) {
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const isNew = !editingContact.id;
      const url = "/api/contacts/emergency";
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingContact),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingContact(null);
        onRefresh();
      } else {
        setSaveError(data.message || "Failed to save emergency contact.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contacts/emergency", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
      });
      if (res.ok) {
        setDeleteId(null);
        onRefresh();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const selectedDeleteContact = emergencyContacts.find((ec) => ec.id === deleteId);

  return (
    <div className="mode-settings-block">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="mode-settings-title" style={{ margin: 0 }}>🚨 EMERGENCY CONTACTS ({emergencyContacts.length})</div>
        <button
          type="button"
          className="asset-btn-primary"
          onClick={() => {
            setSaveError("");
            setEditingContact({
              name: "",
              relationship: "",
              isPrimary: emergencyContacts.length === 0,
              enabled: true,
              numbers: [{ label: "Mobile", countryCode: "+91", phoneNumber: "" }],
            });
          }}
        >
          + ADD EMERGENCY CONTACT
        </button>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 12px" }}>
        Register emergency contacts who can be reached if your vehicle needs to be moved or in an urgent situation.
      </p>

      {emergencyContacts.length === 0 && !editingContact && (
        <div style={{ padding: 18, background: "rgba(255,255,255,0.03)", borderRadius: 10, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          No emergency contacts added yet. Click "+ ADD EMERGENCY CONTACT" above to register your first emergency contact!
        </div>
      )}

      <div className="asset-card-list">
        {emergencyContacts.map((ec) => (
          <div key={ec.id} className="asset-item-card">
            <div className="asset-item-info">
              <div className="asset-item-title">
                🚨 {ec.name} {ec.relationship ? `(${ec.relationship})` : ""}
                {ec.isPrimary && <span className="asset-badge-active" style={{ background: "rgba(0, 229, 255,0.2)", color: "#0066FF", border: "1px solid rgba(0, 229, 255,0.4)" }}>PRIMARY</span>}
              </div>
              <div className="asset-item-sub">
                {Array.isArray(ec.numbers) && ec.numbers.length > 0 ? (
                  ec.numbers.map((n: any) => `${n.label}: ${n.countryCode ? n.countryCode + " " : ""}${n.phoneNumber}`).join(" • ")
                ) : (
                  "No phone numbers recorded"
                )}
              </div>
            </div>
            <div className="asset-item-actions">
              <button type="button" className="edit-btn" onClick={() => { setSaveError(""); setEditingContact(ec); }}>Edit</button>
              <button type="button" className="delete-btn" onClick={() => setDeleteId(ec.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── ADD / EDIT EMERGENCY CONTACT MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(editingContact)}
        onClose={() => setEditingContact(null)}
        title={editingContact?.id ? "Edit Emergency Contact" : "Add Emergency Contact"}
        subtitle="Register emergency contact details and phone numbers."
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setEditingContact(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-submit" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Emergency Contact"}
            </button>
          </>
        }
      >
        {editingContact && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {saveError && (
              <div style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c", color: "#e74c3c", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                ⚠️ {saveError}
              </div>
            )}

            <div className="mylux-form-grid-2">
              <div className="mylux-field">
                <label className="mylux-field-label">Name *</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingContact.name || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="e.g. Dad / Ameen"
                  required
                />
              </div>
              <div className="mylux-field">
                <label className="mylux-field-label">Relationship</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingContact.relationship || ""}
                  onChange={(e) => setEditingContact({ ...editingContact, relationship: e.target.value })}
                  placeholder="e.g. Father / Brother"
                />
              </div>
            </div>

            <div className="mylux-form-section">
              <div className="mylux-form-section-title">PHONE NUMBERS</div>
              {(editingContact.numbers || []).map((num: any, idx: number) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    className="mylux-input"
                    style={{ width: 110 }}
                    value={num.label || ""}
                    onChange={(e) => {
                      const updated = [...editingContact.numbers];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setEditingContact({ ...editingContact, numbers: updated });
                    }}
                    placeholder="Label (Mobile)"
                  />
                  <input
                    type="text"
                    className="mylux-input"
                    style={{ width: 80 }}
                    value={num.countryCode || ""}
                    onChange={(e) => {
                      const updated = [...editingContact.numbers];
                      updated[idx] = { ...updated[idx], countryCode: e.target.value };
                      setEditingContact({ ...editingContact, numbers: updated });
                    }}
                    placeholder="+91"
                  />
                  <input
                    type="tel"
                    className="mylux-input"
                    style={{ flex: 1 }}
                    value={num.phoneNumber || ""}
                    onChange={(e) => {
                      const updated = [...editingContact.numbers];
                      updated[idx] = { ...updated[idx], phoneNumber: e.target.value };
                      setEditingContact({ ...editingContact, numbers: updated });
                    }}
                    placeholder="Phone number"
                  />
                  {editingContact.numbers.length > 1 && (
                    <button
                      type="button"
                      style={{ background: "transparent", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 16 }}
                      onClick={() => {
                        const updated = editingContact.numbers.filter((_: any, i: number) => i !== idx);
                        setEditingContact({ ...editingContact, numbers: updated });
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", color: "#0066FF", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start", marginTop: 4 }}
                onClick={() => {
                  setEditingContact({
                    ...editingContact,
                    numbers: [...(editingContact.numbers || []), { label: "Other", countryCode: "", phoneNumber: "" }],
                  });
                }}
              >
                + Add another number
              </button>
            </div>

            <div className="mylux-toggle-row">
              <div>
                <div className="mylux-radio-label-text">Set as Primary Emergency Contact</div>
                <div className="mylux-radio-subtext">Primary emergency contact is used by default for Vehicle Connect.</div>
              </div>
              <div
                className={`mylux-toggle-switch ${editingContact.isPrimary ? "active" : ""}`}
                onClick={() => setEditingContact({ ...editingContact, isPrimary: !editingContact.isPrimary })}
              >
                <div className="mylux-toggle-knob" />
              </div>
            </div>
          </form>
        )}
      </MyLuxModal>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Remove emergency contact?"
        subtitle={selectedDeleteContact ? `${selectedDeleteContact.name} (${selectedDeleteContact.relationship})` : ""}
        maxWidth={460}
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setDeleteId(null)} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              style={{ background: "#e74c3c", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Remove"}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
          Are you sure you want to remove this emergency contact? This change will persist permanently.
        </div>
      </MyLuxModal>
    </div>
  );
}

function VehiclesManager({ cardId, contactNumbers = [], emergencyContacts = [] }: any) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);

  const primaryContact = contactNumbers.find((c: any) => c.isPrimary) || contactNumbers[0];
  const primaryEmergency = emergencyContacts.find((ec: any) => ec.isPrimary) || emergencyContacts[0];

  const loadVehicles = async () => {
    if (!cardId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/vehicles?cardId=${encodeURIComponent(cardId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.vehicles)) {
        setVehicles(data.vehicles);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVehicles();
  }, [cardId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const isNew = !editingVehicle.id;
      const url = "/api/cards/vehicles";
      const method = isNew ? "POST" : "PUT";
      const body = { ...editingVehicle, cardId };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingVehicle(null);
        await loadVehicles();
      } else {
        setSaveError(resData.message || "Failed to save vehicle. Please try again.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this vehicle from your Vehicle Connect list? Your MyLux QR code will continue to work.")) return;
    try {
      const res = await fetch("/api/cards/vehicles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadVehicles();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="mode-settings-block">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="mode-settings-title" style={{ margin: 0 }}>🚘 MY VEHICLES ({vehicles.length})</div>
        <button
          type="button"
          className="asset-btn-primary"
          onClick={() => {
            setSaveError("");
            setEditingVehicle({
              cardId,
              displayName: "",
              make: "",
              model: "",
              color: "",
              licensePlate: "",
              contactPhone: "",
              useDefaultContact: true,
              contactMode: "primary",
              emergencyName: "",
              emergencyRelationship: "",
              emergencyPhone: "",
              useDefaultEmergency: true,
              emergencyMode: "default",
              ownerNote: "",
              enabled: true,
            });
          }}
        >
          + ADD VEHICLE
        </button>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 12px" }}>
        Add all your cars, bikes, or fleets to your single MyLux QR code. If you have multiple vehicles, visitors will select which vehicle they are contacting about.
      </p>

      {vehicles.length === 0 && !editingVehicle && (
        <div style={{ padding: 18, background: "rgba(255,255,255,0.03)", borderRadius: 10, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          No vehicles added yet. Click "+ ADD VEHICLE" above to register your first vehicle!
        </div>
      )}

      <div className="asset-card-list">
        {vehicles.map((v) => (
          <div key={v.id} className="asset-item-card">
            <div className="asset-item-info">
              <div className="asset-item-title">
                🚘 {v.displayName || `${v.make} ${v.model}` || "Vehicle"}
                <span className={v.enabled ? "asset-badge-active" : "asset-badge-disabled"}>
                  {v.enabled ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="asset-item-sub">
                {[v.make, v.model, v.color].filter(Boolean).join(" • ")} {v.licensePlate ? `(${v.licensePlate})` : ""}
              </div>
            </div>
            <div className="asset-item-actions">
              <button type="button" className="edit-btn" onClick={() => { setSaveError(""); setEditingVehicle(v); }}>Edit</button>
              <button type="button" className="delete-btn" onClick={() => handleDelete(v.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── EDIT / ADD VEHICLE MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(editingVehicle)}
        onClose={() => setEditingVehicle(null)}
        title={editingVehicle?.id ? "Edit Vehicle" : "Add Vehicle"}
        subtitle="Add a vehicle to your MyLux Vehicle Connect profile."
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setEditingVehicle(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-submit" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Vehicle"}
            </button>
          </>
        }
      >
        {editingVehicle && (
          <form id="vehicle-form" onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {saveError && (
              <div style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c", color: "#e74c3c", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                ⚠️ {saveError}
              </div>
            )}

            {/* Privacy Alert */}
            <div className="mylux-privacy-alert">
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <strong>Public contact information</strong>
                <div style={{ opacity: 0.9, marginTop: 2 }}>
                  Phone numbers you choose for this vehicle can be visible to people who scan your MyLux QR and open Vehicle Connect.
                </div>
              </div>
            </div>

            {/* Section 1: Vehicle Details */}
            <div className="mylux-form-section">
              <div className="mylux-form-section-title">VEHICLE DETAILS</div>
              <div className="mylux-form-grid-2">
                <div className="mylux-field">
                  <label className="mylux-field-label">Display Name *</label>
                  <input
                    type="text"
                    className="mylux-input"
                    value={editingVehicle.displayName || ""}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, displayName: e.target.value })}
                    placeholder="e.g. My BMW"
                    required
                  />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">Make (Brand)</label>
                  <input
                    type="text"
                    className="mylux-input"
                    value={editingVehicle.make || ""}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, make: e.target.value })}
                    placeholder="e.g. BMW"
                  />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">Model</label>
                  <input
                    type="text"
                    className="mylux-input"
                    value={editingVehicle.model || ""}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                    placeholder="e.g. M3"
                  />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">Colour</label>
                  <input
                    type="text"
                    className="mylux-input"
                    value={editingVehicle.color || ""}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })}
                    placeholder="e.g. Black"
                  />
                </div>
              </div>
              <div className="mylux-field" style={{ marginTop: 4 }}>
                <label className="mylux-field-label">Registration / License Plate</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingVehicle.licensePlate || ""}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, licensePlate: e.target.value.toUpperCase() })}
                  placeholder="e.g. KL 10 AB 1234"
                />
              </div>
            </div>

            {/* Section 2: Owner Contact Selection */}
            <div className="mylux-form-section">
              <div className="mylux-form-section-title">OWNER CONTACT</div>
              <div className="mylux-radio-group">
                <div
                  className={`mylux-radio-card ${editingVehicle.useDefaultContact !== false && editingVehicle.contactMode !== "select" && editingVehicle.contactMode !== "custom" ? "selected" : ""}`}
                  onClick={() => setEditingVehicle({ ...editingVehicle, useDefaultContact: true, contactMode: "primary", contactPhone: "" })}
                >
                  <div className="mylux-radio-indicator">
                    {editingVehicle.useDefaultContact !== false && editingVehicle.contactMode !== "select" && editingVehicle.contactMode !== "custom" && <div className="mylux-radio-dot" />}
                  </div>
                  <div>
                    <div className="mylux-radio-label-text">Use Primary Account Number</div>
                    {primaryContact && (
                      <div className="mylux-radio-subtext">
                        {primaryContact.countryCode ? primaryContact.countryCode + " " : ""}{primaryContact.phoneNumber} ({primaryContact.label})
                      </div>
                    )}
                  </div>
                </div>

                {contactNumbers.length > 0 && (
                  <div
                    className={`mylux-radio-card ${editingVehicle.contactMode === "select" ? "selected" : ""}`}
                    onClick={() => setEditingVehicle({ ...editingVehicle, useDefaultContact: false, contactMode: "select" })}
                  >
                    <div className="mylux-radio-indicator">
                      {editingVehicle.contactMode === "select" && <div className="mylux-radio-dot" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mylux-radio-label-text">Select Account Contact Number</div>
                      {editingVehicle.contactMode === "select" && (
                        <select
                          className="mylux-select"
                          style={{ marginTop: 6 }}
                          value={editingVehicle.contactPhone || ""}
                          onChange={(e) => setEditingVehicle({ ...editingVehicle, contactPhone: e.target.value, useDefaultContact: false })}
                        >
                          <option value="">-- Choose Account Number --</option>
                          {contactNumbers.map((cn: any) => (
                            <option key={cn.id} value={`${cn.countryCode ? cn.countryCode + " " : ""}${cn.phoneNumber}`}>
                              {cn.label} — {cn.countryCode ? cn.countryCode + " " : ""}{cn.phoneNumber} {cn.isPrimary ? "(Primary)" : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`mylux-radio-card ${editingVehicle.useDefaultContact === false && editingVehicle.contactMode === "custom" ? "selected" : ""}`}
                  onClick={() => setEditingVehicle({ ...editingVehicle, useDefaultContact: false, contactMode: "custom" })}
                >
                  <div className="mylux-radio-indicator">
                    {editingVehicle.useDefaultContact === false && editingVehicle.contactMode === "custom" && <div className="mylux-radio-dot" />}
                  </div>
                  <div>
                    <div className="mylux-radio-label-text">Use a custom number for this vehicle</div>
                  </div>
                </div>
              </div>

              {editingVehicle.useDefaultContact === false && editingVehicle.contactMode === "custom" && (
                <div className="mylux-field" style={{ marginTop: 8 }}>
                  <label className="mylux-field-label">Vehicle Contact Number *</label>
                  <input
                    type="tel"
                    className="mylux-input"
                    value={editingVehicle.contactPhone || ""}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, contactPhone: e.target.value })}
                    placeholder="Enter phone number (e.g. +91 98765 43210)"
                    required
                  />
                </div>
              )}
            </div>

            {/* Section 3: Emergency Contact Selection */}
            <div className="mylux-form-section">
              <div className="mylux-form-section-title">EMERGENCY CONTACT</div>
              <div className="mylux-radio-group">
                <div
                  className={`mylux-radio-card ${editingVehicle.useDefaultEmergency !== false && editingVehicle.emergencyMode !== "select" && editingVehicle.emergencyMode !== "custom" ? "selected" : ""}`}
                  onClick={() => setEditingVehicle({ ...editingVehicle, useDefaultEmergency: true, emergencyMode: "default" })}
                >
                  <div className="mylux-radio-indicator">
                    {editingVehicle.useDefaultEmergency !== false && editingVehicle.emergencyMode !== "select" && editingVehicle.emergencyMode !== "custom" && <div className="mylux-radio-dot" />}
                  </div>
                  <div>
                    <div className="mylux-radio-label-text">Use Primary Emergency Contact</div>
                    {primaryEmergency && (
                      <div className="mylux-radio-subtext">
                        {primaryEmergency.name} ({primaryEmergency.relationship || "Emergency"})
                      </div>
                    )}
                  </div>
                </div>

                {emergencyContacts.length > 0 && (
                  <div
                    className={`mylux-radio-card ${editingVehicle.emergencyMode === "select" ? "selected" : ""}`}
                    onClick={() => setEditingVehicle({ ...editingVehicle, emergencyMode: "select" })}
                  >
                    <div className="mylux-radio-indicator">
                      {editingVehicle.emergencyMode === "select" && <div className="mylux-radio-dot" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mylux-radio-label-text">Select Emergency Contact</div>
                      {editingVehicle.emergencyMode === "select" && (
                        <select
                          className="mylux-select"
                          style={{ marginTop: 6 }}
                          value={editingVehicle.emergencyName || ""}
                          onChange={(e) => {
                            const selectedEc = emergencyContacts.find((ec: any) => ec.name === e.target.value);
                            const firstNum = selectedEc?.numbers?.[0];
                            setEditingVehicle({
                              ...editingVehicle,
                              useDefaultEmergency: false,
                              emergencyName: selectedEc ? selectedEc.name : "",
                              emergencyRelationship: selectedEc ? selectedEc.relationship : "",
                              emergencyPhone: firstNum ? `${firstNum.countryCode ? firstNum.countryCode + " " : ""}${firstNum.phoneNumber}` : "",
                            });
                          }}
                        >
                          <option value="">-- Choose Emergency Contact --</option>
                          {emergencyContacts.map((ec: any) => (
                            <option key={ec.id} value={ec.name}>
                              {ec.name} — {ec.relationship || "Emergency"} {ec.isPrimary ? "(Primary)" : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`mylux-radio-card ${editingVehicle.useDefaultEmergency === false && editingVehicle.emergencyMode === "custom" ? "selected" : ""}`}
                  onClick={() => setEditingVehicle({ ...editingVehicle, useDefaultEmergency: false, emergencyMode: "custom" })}
                >
                  <div className="mylux-radio-indicator">
                    {editingVehicle.useDefaultEmergency === false && editingVehicle.emergencyMode === "custom" && <div className="mylux-radio-dot" />}
                  </div>
                  <div>
                    <div className="mylux-radio-label-text">Use custom emergency contact for this vehicle</div>
                  </div>
                </div>
              </div>

              {editingVehicle.useDefaultEmergency === false && editingVehicle.emergencyMode === "custom" && (
                <div className="mylux-form-grid-2" style={{ marginTop: 8 }}>
                  <div className="mylux-field">
                    <label className="mylux-field-label">Emergency Name</label>
                    <input
                      type="text"
                      className="mylux-input"
                      value={editingVehicle.emergencyName || ""}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, emergencyName: e.target.value })}
                      placeholder="e.g. Ameen"
                    />
                  </div>
                  <div className="mylux-field">
                    <label className="mylux-field-label">Relationship</label>
                    <input
                      type="text"
                      className="mylux-input"
                      value={editingVehicle.emergencyRelationship || ""}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, emergencyRelationship: e.target.value })}
                      placeholder="e.g. Brother"
                    />
                  </div>
                  <div className="mylux-field" style={{ gridColumn: "1 / -1" }}>
                    <label className="mylux-field-label">Emergency Phone Number</label>
                    <input
                      type="tel"
                      className="mylux-input"
                      value={editingVehicle.emergencyPhone || ""}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, emergencyPhone: e.target.value })}
                      placeholder="e.g. +91 99999 88888"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Owner Note */}
            <div className="mylux-form-section">
              <div className="mylux-field">
                <label className="mylux-field-label">Owner Note (Optional)</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingVehicle.ownerNote || ""}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, ownerNote: e.target.value })}
                  placeholder="e.g. Please call if the vehicle needs to be moved."
                />
              </div>
            </div>

            {/* Section 5: Active Setting Toggle */}
            <div className="mylux-toggle-row">
              <div>
                <div className="mylux-radio-label-text">Show vehicle publicly</div>
                <div className="mylux-radio-subtext">When disabled, this vehicle will not appear in Vehicle Connect.</div>
              </div>
              <div
                className={`mylux-toggle-switch ${editingVehicle.enabled !== false ? "active" : ""}`}
                onClick={() => setEditingVehicle({ ...editingVehicle, enabled: editingVehicle.enabled === false })}
              >
                <div className="mylux-toggle-knob" />
              </div>
            </div>
          </form>
        )}
      </MyLuxModal>
    </div>
  );
}

function LostItemsManager({ cardId, contactNumbers = [] }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const primaryContact = contactNumbers.find((c: any) => c.isPrimary) || contactNumbers[0];

  const loadItems = async () => {
    if (!cardId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/lost-items?cardId=${encodeURIComponent(cardId)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.lostItems)) {
        setItems(data.lostItems);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [cardId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const isNew = !editingItem.id;
      const url = "/api/cards/lost-items";
      const method = isNew ? "POST" : "PUT";
      const body = { ...editingItem, cardId };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingItem(null);
        await loadItems();
      } else {
        setSaveError(resData.message || "Failed to save item. Please try again.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this item from your Lost & Found list? Your MyLux QR code will continue to work.")) return;
    try {
      const res = await fetch("/api/cards/lost-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await loadItems();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="mode-settings-block">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="mode-settings-title" style={{ margin: 0 }}>🏷️ MY LOST &amp; FOUND ITEMS ({items.length})</div>
        <button
          type="button"
          className="asset-btn-primary"
          onClick={() => {
            setSaveError("");
            setEditingItem({
              cardId,
              name: "",
              category: "Keys",
              description: "",
              color: "",
              contactPhone: "",
              useDefaultContact: true,
              contactMode: "primary",
              rewardEnabled: false,
              rewardText: "Reward available upon safe return.",
              returnInstructions: "Please contact me to arrange collection.",
              enabled: true,
            });
          }}
        >
          + ADD ITEM
        </button>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 12px" }}>
        Add your keys, laptop, luggage, or wallet. If you have multiple tagged items, visitors will select which item they found.
      </p>

      {items.length === 0 && !editingItem && (
        <div style={{ padding: 18, background: "rgba(255,255,255,0.03)", borderRadius: 10, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          No items added yet. Click "+ ADD ITEM" above to register your first tagged item!
        </div>
      )}

      <div className="asset-card-list">
        {items.map((item) => (
          <div key={item.id} className="asset-item-card">
            <div className="asset-item-info">
              <div className="asset-item-title">
                🏷️ {item.name || "Tagged Item"}
                <span className={item.enabled ? "asset-badge-active" : "asset-badge-disabled"}>
                  {item.enabled ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="asset-item-sub">
                Category: {item.category} {item.color ? `• ${item.color}` : ""}
              </div>
            </div>
            <div className="asset-item-actions">
              <button type="button" className="edit-btn" onClick={() => { setSaveError(""); setEditingItem(item); }}>Edit</button>
              <button type="button" className="delete-btn" onClick={() => handleDelete(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* ── EDIT / ADD ITEM MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id ? "Edit Item" : "Add Lost & Found Item"}
        subtitle="Add a tagged item to your MyLux Lost & Found profile."
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setEditingItem(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-submit" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Item"}
            </button>
          </>
        }
      >
        {editingItem && (
          <form id="item-form" onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {saveError && (
              <div style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c", color: "#e74c3c", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                ⚠️ {saveError}
              </div>
            )}

            {/* Privacy Alert */}
            <div className="mylux-privacy-alert">
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <strong>Public contact information</strong>
                <div style={{ opacity: 0.9, marginTop: 2 }}>
                  The phone number you choose for this item will be publicly visible to anyone who scans your MyLux QR and opens Lost &amp; Found.
                </div>
              </div>
            </div>

            {/* Section 1: Item Details */}
            <div className="mylux-form-section">
              <div className="mylux-form-section-title">ITEM DETAILS</div>
              <div className="mylux-form-grid-2">
                <div className="mylux-field">
                  <label className="mylux-field-label">Item Name *</label>
                  <input
                    type="text"
                    className="mylux-input"
                    value={editingItem.name || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    placeholder="e.g. House Keys"
                    required
                  />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">Category</label>
                  <select
                    className="mylux-select"
                    value={editingItem.category || "Keys"}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                  >
                    <option value="Keys">Keys</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Luggage">Luggage</option>
                    <option value="Wallet">Wallet / Purse</option>
                    <option value="Pets">Pet Tag</option>
                    <option value="Personal Item">Personal Item</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="mylux-field" style={{ marginTop: 4 }}>
                <label className="mylux-field-label">Colour / Description</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingItem.color || editingItem.description || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value, description: e.target.value })}
                  placeholder="e.g. Black leather case"
                />
              </div>
            </div>

            {/* Section 2: Owner Contact */}
            <div className="mylux-form-section">
              <div className="mylux-form-section-title">OWNER CONTACT</div>
              <div className="mylux-radio-group">
                <div
                  className={`mylux-radio-card ${editingItem.useDefaultContact !== false && editingItem.contactMode !== "select" && editingItem.contactMode !== "custom" ? "selected" : ""}`}
                  onClick={() => setEditingItem({ ...editingItem, useDefaultContact: true, contactMode: "primary", contactPhone: "" })}
                >
                  <div className="mylux-radio-indicator">
                    {editingItem.useDefaultContact !== false && editingItem.contactMode !== "select" && editingItem.contactMode !== "custom" && <div className="mylux-radio-dot" />}
                  </div>
                  <div>
                    <div className="mylux-radio-label-text">Use Primary Account Number</div>
                    {primaryContact && (
                      <div className="mylux-radio-subtext">
                        {primaryContact.countryCode ? primaryContact.countryCode + " " : ""}{primaryContact.phoneNumber} ({primaryContact.label})
                      </div>
                    )}
                  </div>
                </div>

                {contactNumbers.length > 0 && (
                  <div
                    className={`mylux-radio-card ${editingItem.contactMode === "select" ? "selected" : ""}`}
                    onClick={() => setEditingItem({ ...editingItem, useDefaultContact: false, contactMode: "select" })}
                  >
                    <div className="mylux-radio-indicator">
                      {editingItem.contactMode === "select" && <div className="mylux-radio-dot" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mylux-radio-label-text">Select Account Contact Number</div>
                      {editingItem.contactMode === "select" && (
                        <select
                          className="mylux-select"
                          style={{ marginTop: 6 }}
                          value={editingItem.contactPhone || ""}
                          onChange={(e) => setEditingItem({ ...editingItem, contactPhone: e.target.value, useDefaultContact: false })}
                        >
                          <option value="">-- Choose Account Number --</option>
                          {contactNumbers.map((cn: any) => (
                            <option key={cn.id} value={`${cn.countryCode ? cn.countryCode + " " : ""}${cn.phoneNumber}`}>
                              {cn.label} — {cn.countryCode ? cn.countryCode + " " : ""}{cn.phoneNumber} {cn.isPrimary ? "(Primary)" : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                <div
                  className={`mylux-radio-card ${editingItem.useDefaultContact === false && editingItem.contactMode === "custom" ? "selected" : ""}`}
                  onClick={() => setEditingItem({ ...editingItem, useDefaultContact: false, contactMode: "custom" })}
                >
                  <div className="mylux-radio-indicator">
                    {editingItem.useDefaultContact === false && editingItem.contactMode === "custom" && <div className="mylux-radio-dot" />}
                  </div>
                  <div>
                    <div className="mylux-radio-label-text">Use a custom number for this item</div>
                  </div>
                </div>
              </div>

              {editingItem.useDefaultContact === false && editingItem.contactMode === "custom" && (
                <div className="mylux-field" style={{ marginTop: 8 }}>
                  <label className="mylux-field-label">Item Contact Number *</label>
                  <input
                    type="tel"
                    className="mylux-input"
                    value={editingItem.contactPhone || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, contactPhone: e.target.value })}
                    placeholder="Enter phone number (e.g. +91 98765 43210)"
                    required
                  />
                </div>
              )}
            </div>

            {/* Section 3: Reward Offered */}
            <div className="mylux-form-section">
              <div className="mylux-toggle-row">
                <div>
                  <div className="mylux-radio-label-text">Offer Reward for Safe Return</div>
                  <div className="mylux-radio-subtext">Display a reward notification to the finder.</div>
                </div>
                <div
                  className={`mylux-toggle-switch ${Boolean(editingItem.rewardEnabled) ? "active" : ""}`}
                  onClick={() => setEditingItem({ ...editingItem, rewardEnabled: !editingItem.rewardEnabled })}
                >
                  <div className="mylux-toggle-knob" />
                </div>
              </div>

              {editingItem.rewardEnabled && (
                <div className="mylux-field" style={{ marginTop: 8 }}>
                  <label className="mylux-field-label">Reward Note</label>
                  <input
                    type="text"
                    className="mylux-input"
                    value={editingItem.rewardText || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, rewardText: e.target.value })}
                    placeholder="e.g. Reward offered upon safe return!"
                  />
                </div>
              )}
            </div>

            {/* Section 4: Return Instructions */}
            <div className="mylux-form-section">
              <div className="mylux-field">
                <label className="mylux-field-label">Return Instructions (Optional)</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingItem.returnInstructions || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, returnInstructions: e.target.value })}
                  placeholder="e.g. Please call me or leave at building reception."
                />
              </div>
            </div>

            {/* Section 5: Active Setting Toggle */}
            <div className="mylux-toggle-row">
              <div>
                <div className="mylux-radio-label-text">Show item publicly</div>
                <div className="mylux-radio-subtext">When disabled, this item will not appear in Lost &amp; Found.</div>
              </div>
              <div
                className={`mylux-toggle-switch ${editingItem.enabled !== false ? "active" : ""}`}
                onClick={() => setEditingItem({ ...editingItem, enabled: editingItem.enabled === false })}
              >
                <div className="mylux-toggle-knob" />
              </div>
            </div>
          </form>
        )}
      </MyLuxModal>
    </div>
  );
}

function ProfileProductsManager({ cardId }: { cardId?: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadProducts = async () => {
    if (!cardId) return;
    try {
      const res = await fetch(`/api/cards/profile-products?cardId=${encodeURIComponent(cardId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [cardId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProduct) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveError("Image must be 5 MB or smaller.");
      return;
    }

    setUploadingImage(true);
    setSaveError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "product");

      const res = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setEditingProduct({ ...editingProduct, imageUrl: data.url });
      } else {
        setSaveError(data.message || "Image upload failed. Old image retained.");
      }
    } catch {
      setSaveError("Image upload network error. Old image retained.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || saving) return;

    if (!editingProduct.name.trim()) {
      setSaveError("Product name is required.");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const isNew = !editingProduct.id;
      const url = "/api/cards/profile-products";
      const method = isNew ? "POST" : "PUT";

      const payload = {
        ...editingProduct,
        cardId,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingProduct(null);
        await loadProducts();
      } else {
        setSaveError(data.message || "Failed to save product.");
      }
    } catch {
      setSaveError("Network error while saving product.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductVisibility = async (product: any) => {
    try {
      const newStatus = !product.enabled;
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, enabled: newStatus } : p));

      const res = await fetch("/api/cards/profile-products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, enabled: newStatus }),
      });

      if (!res.ok) {
        await loadProducts();
      }
    } catch {
      await loadProducts();
    }
  };

  const handleMoveProduct = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= products.length) return;

    const reordered = [...products];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    setProducts(reordered);

    try {
      await fetch("/api/cards/profile-products/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          productIds: reordered.map((p) => p.id),
        }),
      });
    } catch {
      await loadProducts();
    }
  };

  const handleDelete = async () => {
    if (!deleteId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/profile-products?id=${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteId(null);
        await loadProducts();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const selectedDeleteProduct = products.find((p) => p.id === deleteId);

  return (
    <div className="mode-settings-block">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div className="mode-settings-title" style={{ margin: 0 }}>🛍️ MY PRODUCTS ({products.length})</div>
        <button
          type="button"
          className="asset-btn-primary"
          onClick={() => {
            setSaveError("");
            setEditingProduct({
              name: "",
              description: "",
              price: "",
              currency: "INR",
              imageUrl: "",
              category: "",
              ctaLabel: "Enquire",
              ctaUrl: "",
              enabled: true,
            });
          }}
        >
          + ADD PRODUCT
        </button>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: "0 0 16px" }}>
        Create custom product showcase items for your public profile. These custom products belong exclusively to your profile.
      </p>

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          Loading products…
        </div>
      ) : products.length === 0 && !editingProduct ? (
        <div style={{ padding: 24, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 12, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          No custom profile products created yet. Click "+ ADD PRODUCT" to feature your first product!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {products.map((prod, idx) => (
            <div
              key={prod.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: prod.enabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                border: prod.enabled ? "1px solid rgba(0, 229, 255, 0.25)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "14px 16px",
                gap: 14,
                opacity: prod.enabled ? 1 : 0.65,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 220, flex: 1 }}>
                {prod.imageUrl ? (
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)" }}
                  />
                ) : (
                  <div style={{ width: 54, height: 54, borderRadius: 8, background: "rgba(0, 102, 255, 0.15)", border: "1px solid rgba(0, 102, 255, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#00E5FF" }}>
                    🛍️
                  </div>
                )}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{prod.name}</span>
                    {prod.category && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#00E5FF", background: "rgba(0, 229, 255, 0.12)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>
                        {prod.category}
                      </span>
                    )}
                  </div>
                  {prod.price && (
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#38ef7d", marginTop: 2 }}>
                      {prod.currency === "INR" ? "₹" : prod.currency === "USD" ? "$" : prod.currency === "EUR" ? "€" : prod.currency === "GBP" ? "£" : `${prod.currency} `}{prod.price}
                    </div>
                  )}
                  {prod.description && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {prod.description}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Visibility state badge & switch */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: prod.enabled ? "#2ecc71" : "#e74c3c" }}>
                    {prod.enabled ? "Visible" : "Hidden"}
                  </span>
                  <div
                    className={`mylux-toggle-switch ${prod.enabled ? "active" : ""}`}
                    onClick={() => handleToggleProductVisibility(prod)}
                    style={{ cursor: "pointer", transform: "scale(0.85)" }}
                    title={prod.enabled ? "Hide from public profile" : "Show on public profile"}
                  >
                    <div className="mylux-toggle-knob" />
                  </div>
                </div>

                {/* Ordering controls */}
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1 }}
                    onClick={() => handleMoveProduct(idx, "up")}
                    disabled={idx === 0}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: idx === products.length - 1 ? "not-allowed" : "pointer", opacity: idx === products.length - 1 ? 0.3 : 1 }}
                    onClick={() => handleMoveProduct(idx, "down")}
                    disabled={idx === products.length - 1}
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>

                {/* Action buttons */}
                <div className="asset-item-actions">
                  <button type="button" className="edit-btn" onClick={() => { setSaveError(""); setEditingProduct(prod); }}>Edit</button>
                  <button type="button" className="delete-btn" onClick={() => setDeleteId(prod.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD / EDIT PRODUCT MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        title={editingProduct?.id ? "Edit Custom Product" : "Add Custom Product"}
        subtitle="Create or modify custom products for your public profile."
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setEditingProduct(null)} disabled={saving || uploadingImage}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-submit" onClick={handleSave} disabled={saving || uploadingImage}>
              {saving ? "Saving Product..." : "Save Product"}
            </button>
          </>
        }
      >
        {editingProduct && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {saveError && (
              <div style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c", color: "#e74c3c", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                ⚠️ {saveError}
              </div>
            )}

            <div className="mylux-field">
              <label className="mylux-field-label">PRODUCT NAME *</label>
              <input
                type="text"
                className="mylux-input"
                value={editingProduct.name || ""}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                placeholder="e.g. Rolex Submariner / Custom Ring / Interior Package"
                required
              />
            </div>

            <div className="mylux-field">
              <label className="mylux-field-label">PRODUCT IMAGE</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {editingProduct.imageUrl ? (
                  <img src={editingProduct.imageUrl} alt="Preview" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "rgba(255,255,255,0.4)" }}>
                    📷
                  </div>
                )}
                <div>
                  <label className="asset-btn-primary" style={{ cursor: uploadingImage ? "wait" : "pointer", display: "inline-block" }}>
                    {uploadingImage ? "Uploading..." : "Upload Product Image"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageUpload} style={{ display: "none" }} disabled={uploadingImage} />
                  </label>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                    Supported: JPG, JPEG, PNG, WEBP, GIF (Max 5MB)
                  </div>
                </div>
              </div>
            </div>

            <div className="mylux-field">
              <label className="mylux-field-label">DESCRIPTION</label>
              <textarea
                className="mylux-textarea"
                rows={3}
                value={editingProduct.description || ""}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                placeholder="Describe your product specs, materials, or details..."
              />
            </div>

            <div className="mylux-form-grid-2">
              <div className="mylux-field">
                <label className="mylux-field-label">PRICE (Optional)</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingProduct.price || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                  placeholder="e.g. 12,50,000 / 2,999 / Contact for price"
                />
              </div>
              <div className="mylux-field">
                <label className="mylux-field-label">CURRENCY</label>
                <select
                  className="mylux-select"
                  value={editingProduct.currency || "INR"}
                  onChange={(e) => setEditingProduct({ ...editingProduct, currency: e.target.value })}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="SAR">SAR (﷼)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            <div className="mylux-form-grid-2">
              <div className="mylux-field">
                <label className="mylux-field-label">CATEGORY (Optional)</label>
                <input
                  type="text"
                  className="mylux-input"
                  value={editingProduct.category || ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  placeholder="e.g. Watches / Real Estate / Services"
                />
              </div>
              <div className="mylux-field">
                <label className="mylux-field-label">CALL TO ACTION</label>
                <select
                  className="mylux-select"
                  value={editingProduct.ctaLabel || "Enquire"}
                  onChange={(e) => setEditingProduct({ ...editingProduct, ctaLabel: e.target.value })}
                >
                  <option value="Enquire">Enquire</option>
                  <option value="Contact Me">Contact Me</option>
                  <option value="Buy Now">Buy Now</option>
                  <option value="View Details">View Details</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Visit Website">Visit Website</option>
                </select>
              </div>
            </div>

            <div className="mylux-field">
              <label className="mylux-field-label">CALL TO ACTION URL (Optional)</label>
              <input
                type="text"
                className="mylux-input"
                value={editingProduct.ctaUrl || ""}
                onChange={(e) => setEditingProduct({ ...editingProduct, ctaUrl: e.target.value })}
                placeholder="e.g. https://wa.me/919876543210 or https://example.com/product"
              />
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                Only http, https, tel, and mailto links are allowed.
              </div>
            </div>

            <div className="mylux-toggle-row">
              <div>
                <div className="mylux-radio-label-text">Product Visibility</div>
                <div className="mylux-radio-subtext">When OFF, product is saved but hidden from the public profile.</div>
              </div>
              <div
                className={`mylux-toggle-switch ${editingProduct.enabled !== false ? "active" : ""}`}
                onClick={() => setEditingProduct({ ...editingProduct, enabled: editingProduct.enabled === false })}
              >
                <div className="mylux-toggle-knob" />
              </div>
            </div>
          </form>
        )}
      </MyLuxModal>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Delete Custom Product Permanently?"
        subtitle="Are you sure you want to delete this custom profile product? This action cannot be undone."
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setDeleteId(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete Permanently"}
            </button>
          </>
        }
      >
        {selectedDeleteProduct && (
          <div style={{ padding: "12px 16px", background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, color: "#fff" }}>
            <strong>{selectedDeleteProduct.name}</strong>
            {selectedDeleteProduct.price && <div>Price: {selectedDeleteProduct.price}</div>}
          </div>
        )}
      </MyLuxModal>
    </div>
  );
}

function ContactForm({ draft, update, errors, same, setSame, handleFile }: any) {
  const [dialCodes, setDialCodes] = useState<DialCode[]>([]);
  const [locationApi, setLocationApi] = useState<LocationApi | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([import("world-countries"), import("country-state-city")]).then(([countryModule, locationModule]) => {
      if (cancelled) return;
      const countries = countryModule.default;
      setDialCodes(countries
        .filter((country) => country.idd.root)
        .map((country) => ({
          flag: country.flag,
          code: `${country.idd.root}${country.idd.suffixes?.[0] || ""}`,
          name: country.name.common,
          iso: country.cca2,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)));
      setLocationApi({
        getStatesOfCountry: locationModule.State.getStatesOfCountry,
        getCitiesOfState: locationModule.City.getCitiesOfState,
      });
    });
    return () => { cancelled = true; };
  }, []);
  const selectedCountryIso = draft.countryIso || dialCodes.find((country) => country.code === draft.countryCode)?.iso || "";
  const selectedCountry = dialCodes.find((country) => country.iso === selectedCountryIso);
  const countryLabel = (country: DialCode) => `${country.flag} ${country.name} (${country.code})`;
  const [countryQuery, setCountryQuery] = useState(selectedCountry ? countryLabel(selectedCountry) : "");
  useEffect(() => {
    setCountryQuery(selectedCountry ? countryLabel(selectedCountry) : "");
  }, [selectedCountryIso, selectedCountry?.name]);
  const availableStates = selectedCountryIso && locationApi ? locationApi.getStatesOfCountry(selectedCountryIso) : [];
  const selectedStateCode = draft.stateCode || availableStates.find((state) => state.name === draft.state)?.isoCode || "";
  const availableCities = selectedCountryIso && selectedStateCode && locationApi ? locationApi.getCitiesOfState(selectedCountryIso, selectedStateCode) : [];
  const selectedState = availableStates.find((state) => state.isoCode === selectedStateCode);
  const [stateQuery, setStateQuery] = useState(selectedState?.name || "");
  const [cityQuery, setCityQuery] = useState(draft.city || "");
  useEffect(() => { setStateQuery(selectedState?.name || ""); }, [selectedCountryIso, selectedStateCode]);
  useEffect(() => { setCityQuery(draft.city || ""); }, [selectedCountryIso, selectedStateCode, draft.city]);
  return <><div className="form-intro"><h2>Personal details</h2><p>Information visitors can use to connect with you.</p></div><div className="form-grid">
    <Field label="Card Name *" error={errors.name}><input value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="Your full name" /></Field>
    <Field label="Title / Job Description"><input value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Creative Director" /></Field>
    <Field label="Business Name"><input value={draft.business} onChange={(e) => update("business", e.target.value)} placeholder="Your company" /></Field>
    <Field label="Country Code"><div className="country-search">
      <span aria-hidden>⌕</span>
      <input value={countryQuery} list="country-code-options" autoComplete="off" placeholder="Search country or calling code..." onChange={(e) => {
        const query = e.target.value;
        setCountryQuery(query);
        const normalized = query.trim().toLowerCase();
        const country = dialCodes.find((item) =>
          countryLabel(item).toLowerCase() === normalized ||
          item.name.toLowerCase() === normalized ||
          item.iso.toLowerCase() === normalized ||
          item.code === normalized
        );
        if (!country) return;
        update("countryIso", country.iso); update("countryCode", country.code);
        update("state", ""); update("stateCode", ""); update("city", "");
      }} onBlur={() => setCountryQuery(selectedCountry ? countryLabel(selectedCountry) : "")} />
      <datalist id="country-code-options">{dialCodes.map((country) => <option key={country.iso} value={countryLabel(country)} />)}</datalist>
    </div></Field>
    <Field label="Mobile Number"><div className="phone"><span>{draft.countryCode}</span><input value={draft.mobile} onChange={(e) => { update("mobile", e.target.value.replace(/\D/g, "")); if (same) update("whatsapp", e.target.value.replace(/\D/g, "")); }} inputMode="tel" /></div></Field>
    <Field label="WhatsApp Number"><div className="phone"><span>{draft.countryCode}</span><input value={draft.whatsapp} disabled={same} onChange={(e) => update("whatsapp", e.target.value.replace(/\D/g, ""))} inputMode="tel" /></div><label className="same"><input type="checkbox" checked={same} onChange={(e) => { setSame(e.target.checked); if (e.target.checked) update("whatsapp", draft.mobile); }} /> Same as mobile</label></Field>
    <Field label="Email Address" error={errors.email}><input type="email" value={draft.email} onChange={(e) => update("email", e.target.value)} placeholder="name@company.com" /></Field>
    <Field label="Website" error={errors.website}><input value={draft.website} onChange={(e) => update("website", e.target.value)} placeholder="https://example.com" /></Field>
    <Field label="State / Province"><div className={`country-search ${!selectedCountryIso ? "is-disabled" : ""}`}>
      <span aria-hidden>⌕</span>
      <input value={stateQuery} list="state-options" autoComplete="off" disabled={!selectedCountryIso} placeholder={selectedCountryIso ? "Search state or province..." : "Select a country first"} onChange={(e) => {
        const query = e.target.value; setStateQuery(query);
        const normalized = query.trim().toLowerCase();
        const state = availableStates.find((item) => item.name.toLowerCase() === normalized || item.isoCode.toLowerCase() === normalized);
        if (!state) return;
        update("stateCode", state.isoCode); update("state", state.name); update("city", "");
      }} onBlur={() => setStateQuery(selectedState?.name || "")} />
      <datalist id="state-options">{availableStates.map((state) => <option key={state.isoCode} value={state.name}>{state.isoCode}</option>)}</datalist>
    </div></Field>
    <Field label="City"><div className={`country-search ${!selectedStateCode ? "is-disabled" : ""}`}>
      <span aria-hidden>⌕</span>
      <input value={cityQuery} list="city-options" autoComplete="off" disabled={!selectedStateCode} placeholder={selectedStateCode ? "Search city..." : "Select a state first"} onChange={(e) => {
        const query = e.target.value; setCityQuery(query);
        const normalized = query.trim().toLowerCase();
        const city = availableCities.find((item) => item.name.toLowerCase() === normalized);
        if (city) update("city", city.name);
      }} onBlur={() => setCityQuery(draft.city || "")} />
      <datalist id="city-options">{availableCities.map((city) => <option key={`${city.name}-${city.latitude}-${city.longitude}`} value={city.name} />)}</datalist>
    </div></Field>
    <Field label="Address" wide><textarea rows={4} value={draft.address} onChange={(e) => update("address", e.target.value)} placeholder="Street, area and postal code" /></Field>
    <Field label="Brochure (PDF, max 5 MB)" wide error={errors.brochure}><label className="file-pick"><input type="file" accept="application/pdf" onChange={(e) => handleFile(e, "brochure")} /><span>Choose PDF</span><b>{draft.brochure || "No file chosen"}</b></label></Field>
  </div></>;
}
function SocialForm({ draft, update, errors }: any) {
  return <><div className="form-intro"><h2>Apps &amp; links</h2><p>Add social profiles, your Google Maps location, and useful links for visitors.</p></div><div className="social-list">{socialFields.map((key) => <Field key={key} label={`${key} URL`} error={errors[key]}><div className="social-input"><span>{key === "Google Maps" ? "⌖" : key[0]}</span><input value={draft.social[key] || ""} onChange={(e) => update("social", { ...draft.social, [key]: e.target.value })} placeholder={key === "Google Maps" ? "Paste your Google Maps place or directions link" : `https://${key.toLowerCase().replace(" ", "")}.com/yourname`} /></div></Field>)}</div></>;
}
function CompanyForm({ draft, update, service, setService, notify }: any) {
  const add = () => { if (!service.trim()) { notify("Enter a service or product name."); return; } update("services", [...draft.services, service.trim()]); setService(""); };
  return <><div className="form-intro company-form-title"><h2><span>＋</span> Edit Card Company</h2><p>Add your company introduction, services, and products below.</p></div><Field label="About Company"><textarea className="company-black-input" rows={5} value={draft.about} onChange={(e) => update("about", e.target.value)} placeholder="Type about your company here..." /></Field>
    <div className="company-entry-label">Services / Products</div>
    <div className="add-service"><input className="company-black-input" value={service} onChange={(e) => setService(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Type a service or product name..." /><button onClick={add} aria-label="Add service or product">＋</button></div>
    <div className="service-table"><div className="service-head"><span>Sr. No.</span><span>Name</span><span>Delete</span></div>{draft.services.length ? draft.services.map((name: string, index: number) => <div className="service-row" key={`${name}-${index}`}><span>{index + 1}</span><strong>{name}</strong><button className="delete-btn" onClick={() => update("services", draft.services.filter((_: string, i: number) => i !== index))}>Delete</button></div>) : <p className="empty">No services added yet.</p>}</div></>;
}
function AppearanceForm({ draft, update, handleFile, uploadingKind }: any) {
  return <><div className="form-intro"><h2>Brand assets</h2><p>Upload images to personalise your card.</p></div>
    <div className="profile-colours">
      <div><span className="step">01</span><h3>Profile colours</h3><p>Start with a professional theme, then customise any colour.</p>
        <div className="profile-theme-grid">
          {profileThemes.map((theme) => {
            const active = draft.profileBackground?.toLowerCase() === theme.background && draft.profileAccent?.toLowerCase() === theme.accent && draft.profileText?.toLowerCase() === theme.text;
            return <button key={theme.name} type="button" className={active ? "active" : ""} aria-pressed={active} onClick={() => { update("profileBackground", theme.background); update("profileAccent", theme.accent); update("profileText", theme.text); }}>
              <i style={{ background: `linear-gradient(135deg, ${theme.background} 50%, ${theme.accent} 50%)` }} />
              <span>{theme.name}</span>
            </button>;
          })}
        </div>
      </div>
      <div className="colour-pickers">
        {[["Background", "profileBackground", "#020202"], ["Accent", "profileAccent", "#0066FF"], ["Text", "profileText", "#ffffff"]].map(([label, key, fallback]) =>
          <label key={key}><span>{label}</span><div><input type="color" value={draft[key] || fallback} onChange={(event) => update(key, event.target.value)} /><input className="colour-code" value={draft[key] || fallback} onChange={(event) => /^#[0-9a-f]{0,6}$/i.test(event.target.value) && update(key, event.target.value)} aria-label={`${label} hex colour`} /></div></label>
        )}
        <button
          type="button"
          className="reset-profile-colours"
          onClick={() => {
            update("profileBackground", "#020202");
            update("profileAccent", "#0066FF");
            update("profileText", "#ffffff");
          }}
        >Reset to gold &amp; black</button>
      </div>
    </div>
    <div className="upload-section"><div><span className="step">01</span><h3>Logo or photo</h3><p>PNG, JPG, WebP, or GIF, up to 5 MB. Then resize, rotate, and position it.</p><label className="upload-btn"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploadingKind === "logo"} onChange={(e) => handleFile(e, "logo")} />{uploadingKind === "logo" ? "Uploading…" : "Select image"}</label></div><div className="logo-upload-preview">{draft.logo ? <img src={draft.logo} alt="Image preview" style={{ transform: `scale(${(draft.logoScale || 100) / 100}) rotate(${draft.logoRotation || 0}deg)`, objectPosition: `${draft.logoX || 50}% ${draft.logoY || 50}%` }} /> : <span>YOUR<br />IMAGE</span>}</div></div>
    {draft.logo && <div className="image-controls"><label>Size <input type="range" min="40" max="180" value={draft.logoScale || 100} onChange={event => update("logoScale", Number(event.target.value))} /><output>{draft.logoScale || 100}%</output></label><label>Rotation <input type="range" min="-180" max="180" value={draft.logoRotation || 0} onChange={event => update("logoRotation", Number(event.target.value))} /><output>{draft.logoRotation || 0}°</output></label><label>Horizontal position <input type="range" min="0" max="100" value={draft.logoX || 50} onChange={event => update("logoX", Number(event.target.value))} /></label><label>Vertical position <input type="range" min="0" max="100" value={draft.logoY || 50} onChange={event => update("logoY", Number(event.target.value))} /></label><button type="button" onClick={() => { update("logoScale", 100); update("logoRotation", 0); update("logoX", 50); update("logoY", 50); }}>Reset image</button></div>}
    <div className="upload-section"><div><span className="step">02</span><h3>Background / cover</h3><p>Wide images work best (1600 × 600). PNG, JPG, WebP, or GIF, up to 5 MB.</p><label className="upload-btn"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploadingKind === "cover"} onChange={(e) => handleFile(e, "cover")} />{uploadingKind === "cover" ? "Uploading…" : "Select background image"}</label></div><div className="cover-upload-preview">{draft.cover ? <img src={draft.cover} alt="Cover preview" style={{ transform: `scale(${(draft.coverScale ?? 100) / 100}) rotate(${draft.coverRotation ?? 0}deg)`, objectPosition: `${draft.coverX ?? 50}% ${draft.coverY ?? 50}%` }} /> : <span>Cover image preview</span>}</div></div>
    {draft.cover && <div className="image-controls cover-image-controls"><label>Size <input type="range" min="100" max="220" value={draft.coverScale ?? 100} onChange={event => update("coverScale", Number(event.target.value))} /><output>{draft.coverScale ?? 100}%</output></label><label>Rotation <input type="range" min="-180" max="180" value={draft.coverRotation ?? 0} onChange={event => update("coverRotation", Number(event.target.value))} /><output>{draft.coverRotation ?? 0}°</output></label><label>Horizontal position <input type="range" min="0" max="100" value={draft.coverX ?? 50} onChange={event => update("coverX", Number(event.target.value))} /><output>{draft.coverX ?? 50}%</output></label><label>Vertical position <input type="range" min="0" max="100" value={draft.coverY ?? 50} onChange={event => update("coverY", Number(event.target.value))} /><output>{draft.coverY ?? 50}%</output></label><button type="button" onClick={() => { update("coverScale", 100); update("coverRotation", 0); update("coverX", 50); update("coverY", 50); }}>Reset cover</button></div>}
  </>;
}
function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""} ${error ? "has-error" : ""}`}><span>{label}</span>{children}{error && <em>{error}</em>}</label>;
}

function PreviewPanel({ card, onOpen }: { card: Card; onOpen: (card: Card) => void }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [qrError, setQrError] = useState("");
  const qrPngUrlRef = useRef<string | null>(null);
  const displayHost = typeof window !== "undefined" && window.location?.host
    ? (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/i.test(window.location.host) ? "3gzappit.com" : window.location.host)
    : "3gzappit.com";

  useEffect(() => {
    setQrOpen(false);
    setQrSvg(null);
    setQrError("");
    setQrPngUrl(null);
    if (qrPngUrlRef.current) {
      URL.revokeObjectURL(qrPngUrlRef.current);
      qrPngUrlRef.current = null;
    }
  }, [card.slug]);

  useEffect(() => {
    return () => {
      if (qrPngUrlRef.current) {
        URL.revokeObjectURL(qrPngUrlRef.current);
        qrPngUrlRef.current = null;
      }
    };
  }, []);

  const openQr = async () => {
    setQrOpen(true);
    if (qrSvg) {
      if (!qrPngUrl) void createPngFromSvg(qrSvg);
      return;
    }
    setQrLoading(true);
    setQrError("");
    try {
      const res = await fetch(`/api/cards/qr?slug=${encodeURIComponent(card.slug)}`);
      if (!res.ok) throw new Error("QR request failed");
      const text = await res.text();
      setQrSvg(text);
      void createPngFromSvg(text);
    } catch {
      setQrError("Could not generate the QR code. Please try again.");
    } finally {
      setQrLoading(false);
    }
  };

  const downloadQr = async () => {
    if (!qrSvg) return;
    if (qrPngUrl) {
      const a = document.createElement("a");
      a.href = qrPngUrl;
      a.download = `mylux-qr-${card.slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    setQrDownloading(true);
    try {
      const blob = await svgToPngBlob(qrSvg, 1500);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mylux-qr-${card.slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setQrError("Could not prepare PNG download. Please try again.");
    } finally {
      setQrDownloading(false);
    }
  };

  const downloadSvg = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mylux-qr-${card.slug}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const createPngFromSvg = async (svg: string) => {
    if (!svg) return;
    setQrDownloading(true);
    try {
      if (qrPngUrlRef.current) {
        URL.revokeObjectURL(qrPngUrlRef.current);
        qrPngUrlRef.current = null;
      }
      const blob = await svgToPngBlob(svg, 1500);
      const url = URL.createObjectURL(blob);
      qrPngUrlRef.current = url;
      setQrPngUrl(url);
    } catch {
      // ignore, allow fallback on click
    } finally {
      setQrDownloading(false);
    }
  };

  const svgToPngBlob = async (svg: string, size: number) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to load QR SVG"));
      });
      image.src = svgUrl;
      await loaded;

      const viewBoxMatch = svg.match(/viewBox=["']\d+\s+\d+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)["']/);
      let naturalWidth = image.naturalWidth || 400;
      let naturalHeight = image.naturalHeight || 460;
      if (viewBoxMatch && viewBoxMatch[1] && viewBoxMatch[2]) {
        naturalWidth = parseFloat(viewBoxMatch[1]);
        naturalHeight = parseFloat(viewBoxMatch[2]);
      }

      const scale = size / Math.max(naturalWidth, naturalHeight);
      const canvasWidth = Math.round(naturalWidth * scale);
      const canvasHeight = Math.round(naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to create canvas context");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Failed to create PNG")), "image/png");
      });
      return pngBlob;
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  };

  const contact = [
    ["☎", "Mobile", card.mobile ? `${card.countryCode} ${card.mobile}` : ""], ["✉", "Email", card.email],
    ["⌁", "Website", card.website], ["◉", "WhatsApp", card.whatsapp ? `${card.countryCode} ${card.whatsapp}` : ""],
  ].filter((x) => x[2]);
  const socialLinks = [
    ["Instagram", "instagram"],
    ["Facebook", "facebook"],
    ["YouTube", "youtube"],
    ["LinkedIn", "linkedin"],
    ["Twitter", "twitter"],
    ["Google Business", "google"],
    ["Google Maps", "maps"],
  ].map(([name, brand]) => ({ name, brand, url: card.social[name] })).filter((item) => item.url);
  return <aside className="preview-panel">
    {qrOpen && (
      <div className="qr-modal-overlay" onClick={() => setQrOpen(false)}>
        <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
          <button className="qr-modal-close" type="button" onClick={() => setQrOpen(false)} aria-label="Close">✕</button>
          <div className="qr-modal-title">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm8-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 13h7v7H3v-7Zm2 2v3h3v-3H5Zm10 0h2v2h-2v-2Zm-2-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-2 4h2v2h-2v-2Zm2 0h2v2h-2v-2Zm-4 2h2v2h-2v-2Z" /></svg>
            QR Code
          </div>
          <p className="qr-modal-slug">{displayHost}/card/{card.slug}</p>
          <div className="qr-modal-img">
            {qrLoading ? <span className="qr-loading">Generating…</span> : qrSvg ? <div dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <span className="qr-loading">{qrError || "QR code unavailable"}</span>}
          </div>
          <div className="qr-modal-actions">
            {qrError ? (
              <button type="button" className="qr-download-btn" onClick={openQr} disabled={qrLoading}>Try again</button>
            ) : (
              <>
                <button type="button" className="qr-download-btn" onClick={downloadQr} disabled={!qrSvg || qrLoading || qrDownloading}>
                  {qrDownloading ? "Downloading…" : "Download PNG"}
                </button>
                <button type="button" className="qr-download-btn svg-btn" onClick={downloadSvg} disabled={!qrSvg || qrLoading}>
                  Download SVG
                </button>
              </>
            )}
            <a className="qr-open-link" href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer">Open Card ↗</a>
          </div>
        </div>
      </div>
    )}
    <div className="url-card">
      <div className="url-card-heading">
        <div><span>Your Card URL</span><small>Share your live digital profile</small></div>
        <i aria-label="Card is live">LIVE</i>
      </div>
      <div className="url-card-controls">
        <button className="public-url" type="button" onClick={() => onOpen(card)} title={`Open ${displayHost}/card/${card.slug}`}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></svg>
          <span>{displayHost}/card/{card.slug}</span>
        </button>
        <div className="url-card-actions">
          <button type="button" className="qr-btn" onClick={openQr} title="Generate QR Code"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden><path fill="currentColor" d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm8-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 13h7v7H3v-7Zm2 2v3h3v-3H5Zm10 0h2v2h-2v-2Zm-2-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-2 4h2v2h-2v-2Zm2 0h2v2h-2v-2Zm-4 2h2v2h-2v-2Z" /></svg> QR</button>
          <button className="view-card-link" type="button" onClick={() => onOpen(card)}>View Card <span aria-hidden>↗</span></button>
        </div>
      </div>
    </div>
    <div className="preview-card"><div className="preview-title"><span>Card Preview</span><i>LIVE</i></div><div className="phone-preview" style={{ "--profile-bg": card.profileBackground || "#020202", "--profile-accent": card.profileAccent || "#0066FF", "--profile-text": card.profileText || "#ffffff" } as React.CSSProperties}>
      <div className="wa-bar"><input placeholder="Enter WhatsApp Number" /><button>Share</button></div>
      <div className="cover">{card.cover ? <img src={card.cover} alt="" style={{ transform: `scale(${(card.coverScale ?? 100) / 100}) rotate(${card.coverRotation ?? 0}deg)`, objectPosition: `${card.coverX ?? 50}% ${card.coverY ?? 50}%` }} /> : <span>MYLUX</span>}</div>
      <div className="profile-logo">{card.logo ? <img src={card.logo} alt="" style={{ transform: `scale(${(card.logoScale || 100) / 100}) rotate(${card.logoRotation || 0}deg)`, objectPosition: `${card.logoX || 50}% ${card.logoY || 50}%` }} /> : <span>{card.name.split(" ").map((x) => x[0]).join("").slice(0, 2) || "ML"}</span>}</div>
      <div className="profile-copy"><h3>{card.name || "Your Name"}</h3><p>{[card.title, card.business].filter(Boolean).join(" – ") || "Title – Business name"}</p></div>
      <div className="profile-actions"><button>＋ Save Contact</button><button>▤ Brochure</button><button>↗ Share</button></div>
      <div className="contact-grid">{contact.map((x) => <div key={x[1]}><i>{x[0]}</i><span><small>{x[1]}</small><b>{x[2]}</b></span></div>)}</div>
      {(card.about || card.services.length > 0) && <div className="company-preview">
        <h4>Business Information</h4>
        {card.about && <div className="company-about-preview"><h5>About Company</h5><p>{card.about}</p></div>}
        {card.services.length > 0 && <div className="company-services-preview"><h5>Services / Products</h5><ol>{card.services.map((service) => <li key={service}>{service}</li>)}</ol></div>}
      </div>}
      {socialLinks.length > 0 && <div className="social-preview">
        <h4>Apps &amp; Links</h4>
        <div>{socialLinks.map((item) => <a className={`social-preview-icon ${item.brand}`} href={item.url} target="_blank" rel="noopener noreferrer" key={item.name} aria-label={`Open ${item.name}`} title={item.name}><SocialBrandIcon brand={item.brand} /></a>)}</div>
      </div>}
    </div></div>
  </aside>;
}

function SocialBrandIcon({ brand }: { brand: string }) {
  if (brand === "maps") return <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 10.2A3.2 3.2 0 1 1 12 5.8a3.2 3.2 0 0 1 0 6.4Z" /></svg>;
  if (brand === "instagram") return <svg viewBox="0 0 24 24" aria-hidden><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="17.6" cy="6.7" r="1.2" fill="currentColor" /></svg>;
  if (brand === "facebook") return <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M13.8 21v-8h2.8l.4-3.1h-3.2V8c0-.9.3-1.6 1.6-1.6h1.8V3.6c-.4 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v1.9H7.3V13h2.9v8h3.6Z" /></svg>;
  if (brand === "linkedin") return <svg viewBox="0 0 24 24" aria-hidden><circle cx="6.2" cy="6.3" r="2" fill="currentColor" /><path fill="currentColor" d="M4.5 9.5h3.4V20H4.5V9.5Zm5.5 0h3.3v1.4h.1c.7-1.1 1.9-1.8 3.4-1.8 3.6 0 4.2 2.4 4.2 5.4V20h-3.4v-4.9c0-1.2 0-2.8-1.8-2.8s-2 1.3-2 2.7v5H10V9.5Z" /></svg>;
  if (brand === "twitter") return <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M4 3h4.5l4.3 5.8L17.8 3H20l-6.2 7.3L21 21h-4.5l-4.8-6.5L6.2 21H4l6.7-8L4 3Zm3.4 2 10.1 14h1.9L9.3 5H7.4Z" /></svg>;
  if (brand === "youtube") return <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M21.4 7.1a2.5 2.5 0 0 0-1.8-1.8C18 4.9 12 4.9 12 4.9s-6 0-7.6.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2.2 12a26 26 0 0 0 .4 4.9 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.6.4 7.6.4s6 0 7.6-.4a2.5 2.5 0 0 0 1.8-1.8 26 26 0 0 0 .4-4.9 26 26 0 0 0-.4-4.9ZM10 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.7 4.7 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5ZM12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22ZM6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.3L6.5 14ZM12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.4l3.4 2.7A5.9 5.9 0 0 1 12 5.9Z" /></svg>;
}

function GenericProfileSectionManager({
  cardId,
  section,
  title,
  icon,
  mediaKind,
}: {
  cardId?: string;
  section: string;
  title: string;
  icon: string;
  mediaKind: string;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [saveError, setSaveError] = useState("");

  const loadItems = async () => {
    if (!cardId) return;
    try {
      const res = await fetch(`/api/cards/profile-sections/${section}?cardId=${encodeURIComponent(cardId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [cardId, section]);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: string) => {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;

    if (file.size > 10 * 1024 * 1024) {
      setSaveError("File must be 10 MB or smaller.");
      return;
    }

    setUploadingMedia(true);
    setSaveError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", mediaKind);

      const res = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setEditingItem({ ...editingItem, [targetField]: data.url });
      } else {
        setSaveError(data.message || "Media upload failed.");
      }
    } catch {
      setSaveError("Upload network error.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || saving) return;

    setSaving(true);
    setSaveError("");

    try {
      const isNew = !editingItem.id;
      const url = `/api/cards/profile-sections/${section}`;
      const method = isNew ? "POST" : "PUT";

      const payload = {
        ...editingItem,
        cardId,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingItem(null);
        await loadItems();
      } else {
        setSaveError(data.message || `Failed to save item in ${section}.`);
      }
    } catch {
      setSaveError("Network error while saving item.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (item: any) => {
    try {
      const newStatus = !item.enabled;
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, enabled: newStatus } : i)));

      const res = await fetch(`/api/cards/profile-sections/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, enabled: newStatus }),
      });

      if (!res.ok) await loadItems();
    } catch {
      await loadItems();
    }
  };

  const handleMoveItem = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const reordered = [...items];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    setItems(reordered);

    try {
      await fetch(`/api/cards/profile-sections/${section}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          itemIds: reordered.map((i) => i.id),
        }),
      });
    } catch {
      await loadItems();
    }
  };

  const handleDelete = async () => {
    if (!deleteId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/profile-sections/${section}?id=${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteId(null);
        await loadItems();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const getItemTitle = (item: any) => item.name || item.title || item.label || "Item";

  return (
    <div className="mode-settings-block">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
        <div className="mode-settings-title" style={{ margin: 0 }}>
          {icon} {title} ({items.length})
        </div>
        <button
          type="button"
          className="asset-btn-primary"
          onClick={() => {
            setSaveError("");
            setEditingItem({ enabled: true });
          }}
        >
          + ADD {section.replace(/-/g, " ").toUpperCase().slice(0, -1)}
        </button>
      </div>

      {items.length === 0 && !editingItem && !loading && (
        <div style={{ padding: 18, background: "rgba(255,255,255,0.03)", borderRadius: 10, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
          No entries added yet in {title}. Click the add button above to create one.
        </div>
      )}

      {items.length > 0 && (
        <div className="asset-card-list">
          {items.map((item, idx) => (
            <div key={item.id} className="asset-item-card" style={{ opacity: item.enabled ? 1 : 0.6 }}>
              <div className="asset-item-info">
                <div className="asset-item-title">
                  {icon} {getItemTitle(item)}
                </div>
                <div className="asset-item-sub">
                  {item.category || item.provider || item.organization || item.issuer || item.description || ""}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: item.enabled ? "#2ecc71" : "rgba(255,255,255,0.4)", fontWeight: 700 }}>
                    {item.enabled ? "ON" : "OFF"}
                  </span>
                  <div
                    className={`mylux-toggle-switch ${item.enabled !== false ? "active" : ""}`}
                    onClick={() => handleToggleVisibility(item)}
                    style={{ cursor: "pointer", transform: "scale(0.85)" }}
                  >
                    <div className="mylux-toggle-knob" />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1 }}
                    onClick={() => handleMoveItem(idx, "up")}
                    disabled={idx === 0}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: idx === items.length - 1 ? "not-allowed" : "pointer", opacity: idx === items.length - 1 ? 0.3 : 1 }}
                    onClick={() => handleMoveItem(idx, "down")}
                    disabled={idx === items.length - 1}
                  >
                    ▼
                  </button>
                </div>

                <div className="asset-item-actions">
                  <button type="button" className="edit-btn" onClick={() => { setSaveError(""); setEditingItem(item); }}>Edit</button>
                  <button type="button" className="delete-btn" onClick={() => setDeleteId(item.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD / EDIT ITEM MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id ? `Edit ${title}` : `Add ${title}`}
        subtitle={`Configure item details for your public profile.`}
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setEditingItem(null)} disabled={saving || uploadingMedia}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-submit" onClick={handleSave} disabled={saving || uploadingMedia}>
              {saving ? "Saving..." : "Save Item"}
            </button>
          </>
        }
      >
        {editingItem && (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {saveError && (
              <div style={{ background: "rgba(231,76,60,0.15)", border: "1px solid #e74c3c", color: "#e74c3c", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
                ⚠️ {saveError}
              </div>
            )}

            {/* Dynamic fields based on section */}
            {section === "services" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">SERVICE NAME *</label>
                  <input type="text" className="mylux-input" value={editingItem.name || ""} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} placeholder="e.g. Executive Consultation" required />
                </div>
                <div className="mylux-form-grid-2">
                  <div className="mylux-field">
                    <label className="mylux-field-label">PRICE</label>
                    <input type="text" className="mylux-input" value={editingItem.price || ""} onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })} placeholder="e.g. 1500" />
                  </div>
                  <div className="mylux-field">
                    <label className="mylux-field-label">CURRENCY</label>
                    <select className="mylux-select" value={editingItem.currency || "INR"} onChange={(e) => setEditingItem({ ...editingItem, currency: e.target.value })}>
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">DESCRIPTION</label>
                  <textarea className="mylux-textarea" value={editingItem.description || ""} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} placeholder="Service description..." rows={3} />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">CTA BUTTON LABEL &amp; LINK</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input type="text" className="mylux-input" style={{ width: 140 }} value={editingItem.ctaLabel || ""} onChange={(e) => setEditingItem({ ...editingItem, ctaLabel: e.target.value })} placeholder="Book Now" />
                    <input type="text" className="mylux-input" style={{ flex: 1 }} value={editingItem.ctaUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, ctaUrl: e.target.value })} placeholder="https://wa.me/91..." />
                  </div>
                </div>
              </>
            )}

            {section === "portfolio" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">PROJECT TITLE *</label>
                  <input type="text" className="mylux-input" value={editingItem.title || ""} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} placeholder="e.g. E-Commerce Redesign" required />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">CATEGORY / TECH</label>
                  <input type="text" className="mylux-input" value={editingItem.category || ""} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })} placeholder="e.g. Web Development" />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">DESCRIPTION</label>
                  <textarea className="mylux-textarea" value={editingItem.description || ""} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} placeholder="Project overview..." rows={3} />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">PROJECT URL</label>
                  <input type="text" className="mylux-input" value={editingItem.projectUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, projectUrl: e.target.value })} placeholder="https://example.com/project" />
                </div>
              </>
            )}

            {section === "gallery" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">PHOTO TITLE / CAPTION</label>
                  <input type="text" className="mylux-input" value={editingItem.title || ""} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} placeholder="Photo title..." />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">IMAGE FILE OR URL *</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="text" className="mylux-input" style={{ flex: 1 }} value={editingItem.imageUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })} placeholder="https://..." required />
                    <label style={{ background: "rgba(0, 102, 255, 0.2)", border: "1px solid rgba(0, 102, 255, 0.4)", color: "#00E5FF", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Upload
                      <input type="file" accept="image/*" onChange={(e) => handleMediaUpload(e, "imageUrl")} style={{ display: "none" }} />
                    </label>
                  </div>
                </div>
              </>
            )}

            {section === "videos" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">VIDEO TITLE *</label>
                  <input type="text" className="mylux-input" value={editingItem.title || ""} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} placeholder="e.g. Product Demo 2026" required />
                </div>
                <div className="mylux-form-grid-2">
                  <div className="mylux-field">
                    <label className="mylux-field-label">PROVIDER</label>
                    <select className="mylux-select" value={editingItem.provider || "YouTube"} onChange={(e) => setEditingItem({ ...editingItem, provider: e.target.value })}>
                      <option value="YouTube">YouTube</option>
                      <option value="Vimeo">Vimeo</option>
                      <option value="Direct">Direct Link</option>
                    </select>
                  </div>
                  <div className="mylux-field">
                    <label className="mylux-field-label">YOUTUBE EMBED ID</label>
                    <input type="text" className="mylux-input" value={editingItem.embedId || ""} onChange={(e) => setEditingItem({ ...editingItem, embedId: e.target.value })} placeholder="e.g. dQw4w9WgXcQ" />
                  </div>
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">VIDEO URL</label>
                  <input type="text" className="mylux-input" value={editingItem.videoUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                </div>
              </>
            )}

            {section === "payment-links" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">PAYMENT LABEL *</label>
                  <input type="text" className="mylux-input" value={editingItem.label || ""} onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })} placeholder="e.g. Pay via GPay / UPI" required />
                </div>
                <div className="mylux-form-grid-2">
                  <div className="mylux-field">
                    <label className="mylux-field-label">UPI ID</label>
                    <input type="text" className="mylux-input" value={editingItem.upiId || ""} onChange={(e) => setEditingItem({ ...editingItem, upiId: e.target.value })} placeholder="user@upi" />
                  </div>
                  <div className="mylux-field">
                    <label className="mylux-field-label">PAYMENT URL</label>
                    <input type="text" className="mylux-input" value={editingItem.payUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, payUrl: e.target.value })} placeholder="https://pay.gpay.app/..." />
                  </div>
                </div>
              </>
            )}

            {section === "documents" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">DOCUMENT TITLE *</label>
                  <input type="text" className="mylux-input" value={editingItem.title || ""} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} placeholder="e.g. Company Deck 2026.pdf" required />
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">FILE ATTACHMENT OR URL *</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="text" className="mylux-input" style={{ flex: 1 }} value={editingItem.fileUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, fileUrl: e.target.value })} placeholder="https://..." required />
                    <label style={{ background: "rgba(0, 102, 255, 0.2)", border: "1px solid rgba(0, 102, 255, 0.4)", color: "#00E5FF", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Upload PDF
                      <input type="file" accept="application/pdf" onChange={(e) => handleMediaUpload(e, "fileUrl")} style={{ display: "none" }} />
                    </label>
                  </div>
                </div>
              </>
            )}

            {section === "achievements" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">ACHIEVEMENT TITLE *</label>
                  <input type="text" className="mylux-input" value={editingItem.title || ""} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} placeholder="e.g. Entrepreneur of the Year" required />
                </div>
                <div className="mylux-form-grid-2">
                  <div className="mylux-field">
                    <label className="mylux-field-label">ORGANIZATION / AWARDING BODY</label>
                    <input type="text" className="mylux-input" value={editingItem.organization || ""} onChange={(e) => setEditingItem({ ...editingItem, organization: e.target.value })} placeholder="e.g. Forbes" />
                  </div>
                  <div className="mylux-field">
                    <label className="mylux-field-label">DATE / YEAR</label>
                    <input type="text" className="mylux-input" value={editingItem.achievementDate || ""} onChange={(e) => setEditingItem({ ...editingItem, achievementDate: e.target.value })} placeholder="e.g. 2025" />
                  </div>
                </div>
              </>
            )}

            {section === "certifications" && (
              <>
                <div className="mylux-field">
                  <label className="mylux-field-label">CERTIFICATION TITLE *</label>
                  <input type="text" className="mylux-input" value={editingItem.title || ""} onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })} placeholder="e.g. AWS Certified Solutions Architect" required />
                </div>
                <div className="mylux-form-grid-2">
                  <div className="mylux-field">
                    <label className="mylux-field-label">ISSUING ORGANIZATION</label>
                    <input type="text" className="mylux-input" value={editingItem.issuer || ""} onChange={(e) => setEditingItem({ ...editingItem, issuer: e.target.value })} placeholder="e.g. Amazon Web Services" />
                  </div>
                  <div className="mylux-field">
                    <label className="mylux-field-label">ISSUE DATE</label>
                    <input type="text" className="mylux-input" value={editingItem.issueDate || ""} onChange={(e) => setEditingItem({ ...editingItem, issueDate: e.target.value })} placeholder="e.g. Jan 2026" />
                  </div>
                </div>
                <div className="mylux-field">
                  <label className="mylux-field-label">CREDENTIAL VERIFICATION URL</label>
                  <input type="text" className="mylux-input" value={editingItem.credentialUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, credentialUrl: e.target.value })} placeholder="https://credly.com/..." />
                </div>
              </>
            )}

            {/* Item Visibility Toggle */}
            <div className="mylux-toggle-row">
              <div>
                <div className="mylux-radio-label-text">Item Visibility</div>
                <div className="mylux-radio-subtext">Control whether this item is publicly visible.</div>
              </div>
              <div
                className={`mylux-toggle-switch ${editingItem.enabled !== false ? "active" : ""}`}
                onClick={() => setEditingItem({ ...editingItem, enabled: editingItem.enabled === false })}
              >
                <div className="mylux-toggle-knob" />
              </div>
            </div>
          </form>
        )}
      </MyLuxModal>

      {/* ── DELETE MODAL ── */}
      <MyLuxModal
        isOpen={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title={`Delete Item Permanently?`}
        subtitle="Are you sure you want to delete this item? This action cannot be undone."
        footer={
          <>
            <button type="button" className="mylux-btn-cancel" onClick={() => setDeleteId(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="mylux-btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete Permanently"}
            </button>
          </>
        }
      >
        <div style={{ padding: "12px 16px", background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 10, color: "#fff" }}>
          Confirm deletion of this item.
        </div>
      </MyLuxModal>
    </div>
  );
}
