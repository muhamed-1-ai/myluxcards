"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "dashboard" | "contact" | "social" | "company" | "appearance" | "cards" | "leads";
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
};
type Lead = { id:string; card_id:string; name:string; email?:string; phone?:string; company?:string; message?:string; status:string; created_at:string };
type CurrentUser = { name: string; email: string };

const STORE_PREFIX = "mylux-dashboard-cards-v2:";
const socialFields = ["Facebook", "Instagram", "LinkedIn", "Twitter", "YouTube", "Google Business", "Google Maps"];
type DialCode = { flag: string; code: string; name: string; iso: string };
type LocationState = { name: string; isoCode: string };
type LocationCity = { name: string; latitude?: string | null; longitude?: string | null };
type LocationApi = {
  getStatesOfCountry: (countryIso: string) => LocationState[];
  getCitiesOfState: (countryIso: string, stateCode: string) => LocationCity[];
};
const blankSocial = Object.fromEntries(socialFields.map((x) => [x, ""]));
const profileThemes = [
  { name: "MyLux Gold", background: "#020202", accent: "#d4af37", text: "#ffffff" },
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
const storageKey = (email: string) => `${STORE_PREFIX}${email.trim().toLowerCase()}`;
const cacheCards = (email: string, cards: Card[]) => {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(cards));
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
      localStorage.setItem(storageKey(email), JSON.stringify(lightweight));
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
    logo: "", cover: "", profileBackground: "#020202", profileAccent: "#d4af37", profileText: "#ffffff",
    logoScale: 100, logoRotation: 0, logoX: 50, logoY: 50,
    coverScale: 100, coverRotation: 0, coverX: 50, coverY: 50,
    start: today.toISOString().slice(0, 10), expiry: expiry.toISOString().slice(0, 10),
    views: 0, active: false,
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
  };
};
const emptyCard = createBlankCard({ name: "", email: "" });

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
  let response = await fetch(input, init);
  if (response.status !== 401) return response;
  const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
  if (!refreshed.ok) return response;
  response = await fetch(input, init);
  return response;
};
const optimizeProfileImage = async (source: string, maxWidth: number, maxHeight: number) => {
  if (!source.startsWith("data:image/") || source.length < 350_000) return source;
  return new Promise<string>((resolve) => {
    const image = new Image();
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
export default function DashboardDemo({identity}:{identity:CurrentUser}) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
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
  const [activationCode, setActivationCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationPrompt, setActivationPrompt] = useState(false);
  const [promptCardId, setPromptCardId] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved"|"unsaved"|"saving"|"error">("saved");
  const lastSavedRef = useRef("");

  useEffect(() => {
    try {
      const user = identity;
      localStorage.setItem("myluxcards_current_user", JSON.stringify(user));
      setCurrentUser(user);
      const key = storageKey(user.email);
      const stored = localStorage.getItem(key);
      let accountCards: Card[] = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        // This cache key is already scoped to the signed-in email. Cloud cards
        // intentionally use the account UUID as ownerId, so filtering ownerId
        // against the email incorrectly discarded valid cards after relogin.
        if (Array.isArray(parsed)) accountCards = parsed.map((card) => normalizeCard(card, user));
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
        const cloudCards = Array.isArray(payload.cards) ? payload.cards.map((card:Partial<Card>) => normalizeCard(card, user)) : [];
        setLeads(Array.isArray(payload.leads) ? payload.leads : []);
        setCloudReady(true);
        if (cloudCards.length) {
          setCards(cloudCards);
          setSelectedId(cloudCards[0].id);
          setDraft(cloudCards[0]);
          lastSavedRef.current = JSON.stringify(cloudCards[0]);
          cacheCards(user.email, cloudCards);
        } else {
          // The secure cloud account owns no cards. Never keep displaying a
          // cached card from an old session/account as if it were cloud-backed.
          const blank = createBlankCard(user);
          setCards([blank]);
          setSelectedId(blank.id);
          setDraft(blank);
          lastSavedRef.current = JSON.stringify(blank);
          cacheCards(user.email, [blank]);
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
    if (!cloudReady || cards.some((card) => Boolean(card.activatedAt) && card.active)) return;
    const cardNeedingActivation = cards.find((card) => !card.activatedAt);
    if (!cardNeedingActivation) return;
    const promptKey = "myluxcards-activation-prompt-shown";
    if (!sessionStorage.getItem(promptKey)) {
      sessionStorage.setItem(promptKey, "1");
      setPromptCardId(cardNeedingActivation.id);
      setActivationPrompt(true);
    }
  }, [cloudReady, cards]);

  useEffect(() => {
    if (!activationPrompt || !promptCardId) return;
    const promptedCard = cards.find((card) => card.id === promptCardId);
    // A cloud refresh or successful activation can replace stale cached state
    // while the modal is open. Never keep warning once that exact card is
    // confirmed as published by the server.
    if (!promptedCard || (Boolean(promptedCard.activatedAt) && promptedCard.active)) {
      setActivationPrompt(false);
      setPromptCardId(null);
    }
  }, [activationPrompt, promptCardId, cards]);

  useEffect(() => {
    const found = cards.find((card) => card.id === selectedId);
    if (found) setDraft(found);
  }, [selectedId]);

  const notify = (message: string) => {
    setToast(message); window.setTimeout(() => setToast(""), 2600);
  };
  const update = (key: keyof Card, value: Card[keyof Card]) => { setSaveStatus("unsaved"); setDraft((old) => ({ ...old, [key]: value })); };
  const selectTab = (next: Tab) => { setTab(next); setSidebar(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goToActivation = () => {
    setActivationPrompt(false);
    selectTab("cards");
    window.setTimeout(() => document.querySelector(".activation-box")?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };
  const promptCard = cards.find(card => card.id === promptCardId) || draft;
  const requestCardOpen = (card: Card) => {
    if (!card.activatedAt || !card.active) {
      setSelectedId(card.id); setPromptCardId(card.id); setActivationPrompt(true); return;
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
  const save = async (section: Tab, next?: Tab, silent=false) => {
    if (saving) return;
    if (!validate(section)) { setSaveStatus("error"); if(!silent) notify("Please fix the highlighted fields."); return; }
    setSaving(true);
    setSaveStatus("saving");
    if(!silent) notify("Saving your card…");
    const optimizedDraft = {
      ...draft,
      logo: await optimizeProfileImage(draft.logo, 800, 800),
      cover: await optimizeProfileImage(draft.cover, 1600, 900),
    };
    const saved = cards.map((card) => card.id === optimizedDraft.id ? optimizedDraft : card);
    setCards(saved);
    if (currentUser) cacheCards(currentUser.email, saved);
    try {
      const response = await fetchWithSessionRefresh("/api/cards", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(optimizedDraft) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) { notify("Your secure session expired. Please sign in once, then press Save & finish again."); setSaving(false); return; }
        throw new Error(payload.message || "Cloud save failed.");
      }
      const cloudCard = payload.card as Card;
      const cloudSaved = saved.map(card => card.id === optimizedDraft.id ? { ...optimizedDraft, ...cloudCard } : card);
      setCards(cloudSaved); setDraft({ ...optimizedDraft, ...cloudCard }); setSelectedId(cloudCard.id);
      if (currentUser) cacheCards(currentUser.email, cloudSaved);
      setCloudReady(true);
      lastSavedRef.current = JSON.stringify({ ...optimizedDraft, ...cloudCard });
      setSaveStatus("saved");
      if(!silent) notify("Card saved securely.");
    } catch (error) { setSaveStatus("error"); if(!silent) notify(error instanceof Error ? error.message : "Saved in this browser, but cloud save failed. Try again."); }
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
    await fetch("/api/auth/logout", { method:"POST" }).catch(()=>null);
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
    notify("Uploading securely…");
    try {
      const response = await fetchWithSessionRefresh("/api/media", { method:"POST", body:form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Upload failed.");
      if (kind === "brochure") setDraft(old => ({ ...old, brochure:file.name, brochureData:payload.url }));
      else update(kind, payload.url);
      notify("Upload complete. Press Save & Finish to publish it.");
    } catch (error) { notify(error instanceof Error ? error.message : "Upload failed."); }
    finally { event.target.value = ""; }
  };
  const clearCard = async (cardId:string) => {
    if (/^[0-9a-f-]{36}$/i.test(cardId)) {
      const response = await fetchWithSessionRefresh("/api/cards", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id:cardId}) });
      const payload = await response.json().catch(()=>({}));
      if (!response.ok) { notify(payload.message || "Card could not be removed."); return; }
    }
    const remaining = cards.filter(card=>card.id!==cardId);
    const next = remaining[0] || createBlankCard(identity);
    const nextCards = remaining.length ? remaining : [next];
    setCards(nextCards); setDraft(next); setSelectedId(next.id);
    cacheCards(identity.email, nextCards);
    setDeleteId(null); setSaveStatus("saved"); notify("Card removed.");
  };
  const selected = cards.find((card) => card.id === selectedId) || draft;
  const totalViews = cards.reduce((sum, card) => sum + (card.analytics?.VIEW || card.views || 0), 0);
  const activeCards = cards.filter((card) => card.active && card.activatedAt).length;
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
        <a className="dash-brand" href="/"><img src="/assets/logo-premium.png" alt="MyLuxCards" /></a>
        <span className="crumb">/ &nbsp;{tab === "cards" ? "My Cards" : tab === "dashboard" ? "Dashboard" : `Edit Card · ${tab[0].toUpperCase() + tab.slice(1)}`}</span><span className={`save-state ${saveStatus}`}>{saveStatus==="saving"?"Saving…":saveStatus==="unsaved"?"Changes pending":saveStatus==="error"?"Cloud save failed":"Saved"}</span>
        <div className="account-menu">
          <button className="avatar" title={currentUser.email} aria-label="Open account menu" aria-expanded={accountMenu} onClick={() => setAccountMenu((open) => !open)}>{currentUser.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "ML"}</button>
          {accountMenu && <div className="account-popover">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.email}</span>
            <button onClick={logout}>Log out</button>
          </div>}
        </div>
      </header>
      <nav className="mobile-tabbar" aria-label="Dashboard sections">
        {(["dashboard","contact","social","company","appearance","cards","leads"] as Tab[]).map(item=><button key={item} className={tab===item?"active":""} onClick={()=>selectTab(item)}>{item==="dashboard"?"Home":item==="contact"?"Contact":item==="social"?"Links":item==="company"?"Company":item==="appearance"?"Design":item==="cards"?"My Cards":"Leads"}</button>)}
      </nav>
      {sidebar && <button className="side-scrim" aria-label="Close navigation" onClick={() => setSidebar(false)} />}
      <aside className={`dash-side ${sidebar ? "open" : ""}`}>
        <nav>
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => selectTab("dashboard")}><I>⌂</I> Dashboard</button>
          <div className="card-owner"><span><I>◆</I>{selected.name}</span><b>⌄</b></div>
          <div className="subnav">
            {(["contact", "social", "company", "appearance"] as Tab[]).map((item) =>
              <button key={item} className={tab === item ? "active" : ""} onClick={() => selectTab(item)}>
                {item === "contact" ? "Contact Info" : item === "social" ? "Apps & Links" : item[0].toUpperCase() + item.slice(1)}
              </button>)}
            <small>{selected.activatedAt ? selected.active ? "Published until you switch it off" : "Currently switched off" : "Activation required"} ({selected.id.replace("card-", "#")})</small>
          </div>
          <button className={tab === "cards" ? "active" : ""} onClick={() => selectTab("cards")}><I>▣</I> My Cards</button>
          <button className={tab === "leads" ? "active" : ""} onClick={() => selectTab("leads")}><I>◎</I> Leads <b>{leads.length}</b></button>
          <a className="side-link" href="/orders"><I>▤</I> My Orders</a>
          <a className="side-link" href="/account/referrals"><I>↗</I> Referrals</a>
        </nav>
        <div className="demo-note"><span>{cloudReady ? "Secure cloud workspace" : "Offline-safe workspace"}</span><p>{cloudReady ? "Cards, leads, and analytics are connected to your account." : "Drafts remain in this browser until cloud storage becomes available."}</p></div>
      </aside>
      <main className="dash-main">
        {tab === "dashboard" && <section>
          <div className="page-heading"><div><p>OVERVIEW</p><h1>Welcome, {currentUser.name.split(" ")[0]}</h1><span>Manage your card and review the activity available in this browser.</span></div><button className="primary" onClick={() => selectTab("cards")}>Manage cards</button></div>
          <div className="stats">
            <article className="blue"><div><strong>{cards.length}</strong><span>My Cards</span></div><i>▣</i></article>
            <article className="orange"><div><strong>{totalViews.toLocaleString()}</strong><span>Browser-recorded views</span></div><i>↗</i></article>
            <article className="green"><div><strong>{activeCards}</strong><span>Active cards</span></div><i>✓</i></article>
          </div>
          <div className="analytics-disclosure"><strong>Connection analytics</strong><p>{cloudReady ? `${cards.reduce((n,c)=>n+(c.analytics?.CONTACT_SAVE||0),0)} contact saves · ${cards.reduce((n,c)=>n+(c.analytics?.LINK_CLICK||0),0)} link clicks · ${leads.length} exchanged contacts.` : "Connect cloud storage to collect privacy-conscious NFC, QR, save, and link activity."}</p></div>
          <div className="welcome-panel">
            <div><span className="eyebrow">MYLUX SMART HUB</span><h2>Make every introduction count.</h2><p>Complete your profile so visitors have the details they need to connect with you.</p><div className="completion"><span><b>Profile completion</b><strong>{profileCompletion}%</strong></span><i><b style={{width:`${profileCompletion}%`}} /></i></div><button className="secondary" onClick={() => selectTab("contact")}>Edit your card →</button></div>
            <div className="mini-card"><span>ACTIVE CARD</span><h3>{selected.name}</h3><p>{selected.title} · {selected.business}</p><b>{selected.views} views</b></div>
          </div>
        </section>}

        {(["contact", "social", "company", "appearance"] as Tab[]).includes(tab) && <section>
          <div className="page-heading edit-heading"><div><p>EDIT CARD</p><h1>{tab === "contact" ? "Contact information" : tab === "social" ? "Apps & links" : tab === "company" ? "Company details" : "Card appearance"}</h1><span>Changes appear in the preview as you type.</span></div></div>
          <div className="edit-layout">
            <div className="form-card">
              {tab === "contact" && <ContactForm draft={draft} update={update} errors={errors} same={sameAsMobile} setSame={setSameAsMobile} handleFile={handleFile} />}
              {tab === "social" && <SocialForm draft={draft} update={update} errors={errors} />}
              {tab === "company" && <CompanyForm draft={draft} update={update} service={service} setService={setService} notify={notify} />}
              {tab === "appearance" && <AppearanceForm draft={draft} update={update} handleFile={handleFile} />}
              {tab === "appearance" && <div className="save-finish-reminder" role="note"><span aria-hidden>✓</span><p><strong>Remember to save</strong>Always press <b>Save &amp; finish</b> when you’re done so your latest changes appear on every device.</p></div>}
              <div className="form-actions">
                <button className="save" disabled={saving} onClick={() => save(tab)}>{saving ? "Saving…" : "Update"}</button>
                {tab !== "appearance" && <button className="next" disabled={saving} onClick={() => save(tab, tab === "contact" ? "social" : tab === "social" ? "company" : "appearance")}>{saving ? "Saving…" : "Next →"}</button>}
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
            <div className="table-scroll"><table><thead><tr><th>Sr. No.</th><th>Name (slug)</th><th>Activation</th><th>Availability</th><th>Views</th><th>Edit</th><th>Status</th><th>Delete</th></tr></thead>
              <tbody>{visible.map((card, index) => <tr key={card.id}><td data-label="Card">{start + index}</td><td data-label="Name"><button className="card-name-link" onClick={()=>requestCardOpen(card)}><strong>{card.name}</strong><small>/{card.slug}</small></button></td><td data-label="Activation">{card.activatedAt ? "Activated" : <button className="activation-required" onClick={()=>{setPromptCardId(card.id);setActivationPrompt(true)}}>Activate card</button>}</td><td data-label="Availability">{card.activatedAt ? card.active ? "Published until you switch it off" : "Switched off" : "Not published"}</td><td data-label="Views"><span className="view-badge">{card.analytics?.VIEW || card.views || 0}</span></td><td data-label="Edit"><button className="edit-btn" onClick={() => openEditor(card)}>Edit</button></td><td data-label="Published"><button className={`switch ${card.active&&card.activatedAt ? "on" : ""}`} aria-label={card.activatedAt ? `Toggle ${card.name}` : `Activate ${card.name}`} onClick={async () => { if (!card.activatedAt) { setPromptCardId(card.id);setActivationPrompt(true); return; } const response=await fetchWithSessionRefresh("/api/cards",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:card.id,slug:card.slug,toggleActive:true})});const payload=await response.json().catch(()=>({}));if(!response.ok){notify(payload.message||"Status could not be changed.");return;}const confirmed={...card,...payload.card};lastSavedRef.current=JSON.stringify(confirmed);setCards(current=>current.map(item=>item.id===card.id?confirmed:item));if(selectedId===card.id)setDraft(confirmed);setSaveStatus("saved");notify(confirmed.active?"Card published.":"Card switched off. It will stay off until you turn it on."); }}><span /></button></td><td data-label="Remove"><button className="delete-btn" onClick={() => setDeleteId(card.id)}>Delete</button></td></tr>)}</tbody>
            </table></div>
        <div className="activation-box"><div><strong>Activate a delivered card</strong><span>Paste its unused one-time code. Spaces and copied dash styles are corrected automatically.</span></div><input value={activationCode} onChange={event=>setActivationCode(normalizeActivationCode(event.target.value))} placeholder="MLC-12AB-34CD-56EF-7890" autoComplete="off"/><button disabled={activating||!/^MLC-(?:[0-9A-F]{4}-){3}[0-9A-F]{4}$/i.test(activationCode)} onClick={async()=>{setActivating(true);try{const response=await fetchWithSessionRefresh("/api/cards/activate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:activationCode})});const payload=await response.json().catch(()=>({}));if(!response.ok){if(response.status===401){localStorage.removeItem("myluxcards_current_user");sessionStorage.setItem("myluxcards_auth_next","/dashboard?tab=cards");window.location.replace("/?login=1");return;}notify(payload.message||"Activation failed.");return;}const refreshed=await fetchWithSessionRefresh("/api/cards",{cache:"no-store"});const cloud=await refreshed.json().catch(()=>({}));if(!refreshed.ok||!cloud.cards?.length){notify("Card activated. Refreshing your secure dashboard…");window.location.reload();return;}const normalizedCards=cloud.cards.map((card:Partial<Card>)=>normalizeCard(card,identity));setCards(normalizedCards);const claimed=normalizedCards.find((x:Card)=>x.id===payload.cardId)||normalizedCards[0];setDraft(claimed);setSelectedId(claimed.id);if(currentUser)cacheCards(currentUser.email,normalizedCards);setActivationCode("");setSaveStatus("saved");notify(`/${payload.slug} is activated and published.`);}finally{setActivating(false)}}}>{activating?"Activating…":"Activate card"}</button></div>
            <div className="table-footer"><span>Showing {start} to {end} of {filtered.length} entries</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className="current">{page}</button><button disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
          </div>
        </section>}
        {tab === "leads" && <section><div className="page-heading"><div><p>CONTACT EXCHANGE</p><h1>Leads</h1><span>People who explicitly shared their details through your card.</span></div></div><div className="table-card"><div className="table-scroll"><table><thead><tr><th>Date</th><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Message</th></tr></thead><tbody>{leads.length?leads.map(lead=><tr key={lead.id}><td data-label="Date">{new Date(lead.created_at).toLocaleDateString()}</td><td data-label="Name"><strong>{lead.name}</strong></td><td data-label="Company">{lead.company||"—"}</td><td data-label="Email">{lead.email||"—"}</td><td data-label="Phone">{lead.phone||"—"}</td><td data-label="Message">{lead.message||"—"}</td></tr>):<tr className="empty-row"><td colSpan={6}>No contacts have been shared yet.</td></tr>}</tbody></table></div></div></section>}
      </main>
      {toast && <div className="dash-toast">✓ {toast}</div>}
      {activationPrompt && <div className="modal-back"><div className="confirm activation-confirm" role="dialog" aria-modal="true" aria-labelledby="activation-title"><i>!</i><h2 id="activation-title">{promptCard.activatedAt?"Your card is switched off":"Your card is not active yet"}</h2><p>{promptCard.activatedAt?"Visitors cannot view this card while it is switched off. Turn it on under My Cards when you are ready to publish it.":<>Visitors cannot view this card until you activate it using its one-time activation code. You’ll find the activation box under <strong>My Cards</strong>.</>}</p><div><button onClick={() => setActivationPrompt(false)}>Later</button><button className="activation-primary" onClick={()=>{if(promptCard.activatedAt){setActivationPrompt(false);selectTab("cards")}else goToActivation()}}>{promptCard.activatedAt?"Go to status switch":"Activate card now"}</button></div></div></div>}
      {deleteId && <div className="modal-back"><div className="confirm"><i>!</i><h2>Remove this card?</h2><p>This permanently removes only this card. Your other cards and account remain unchanged.</p><div><button onClick={() => setDeleteId(null)}>Cancel</button><button className="delete-btn" onClick={()=>clearCard(deleteId)}>Remove card</button></div></div></div>}
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
function AppearanceForm({ draft, update, handleFile }: any) {
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
        {[["Background", "profileBackground", "#020202"], ["Accent", "profileAccent", "#d4af37"], ["Text", "profileText", "#ffffff"]].map(([label, key, fallback]) =>
          <label key={key}><span>{label}</span><div><input type="color" value={draft[key] || fallback} onChange={(event) => update(key, event.target.value)} /><input className="colour-code" value={draft[key] || fallback} onChange={(event) => /^#[0-9a-f]{0,6}$/i.test(event.target.value) && update(key, event.target.value)} aria-label={`${label} hex colour`} /></div></label>
        )}
        <button
          type="button"
          className="reset-profile-colours"
          onClick={() => {
            update("profileBackground", "#020202");
            update("profileAccent", "#d4af37");
            update("profileText", "#ffffff");
          }}
        >Reset to gold &amp; black</button>
      </div>
    </div>
    <div className="upload-section"><div><span className="step">01</span><h3>Logo or photo</h3><p>PNG, JPG, WebP, or GIF, up to 5 MB. Then resize, rotate, and position it.</p><label className="upload-btn"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => handleFile(e, "logo")} />Select image</label></div><div className="logo-upload-preview">{draft.logo ? <img src={draft.logo} alt="Image preview" style={{transform:`scale(${(draft.logoScale||100)/100}) rotate(${draft.logoRotation||0}deg)`,objectPosition:`${draft.logoX||50}% ${draft.logoY||50}%`}} /> : <span>YOUR<br />IMAGE</span>}</div></div>
    {draft.logo && <div className="image-controls"><label>Size <input type="range" min="40" max="180" value={draft.logoScale||100} onChange={event=>update("logoScale",Number(event.target.value))}/><output>{draft.logoScale||100}%</output></label><label>Rotation <input type="range" min="-180" max="180" value={draft.logoRotation||0} onChange={event=>update("logoRotation",Number(event.target.value))}/><output>{draft.logoRotation||0}°</output></label><label>Horizontal position <input type="range" min="0" max="100" value={draft.logoX||50} onChange={event=>update("logoX",Number(event.target.value))}/></label><label>Vertical position <input type="range" min="0" max="100" value={draft.logoY||50} onChange={event=>update("logoY",Number(event.target.value))}/></label><button type="button" onClick={()=>{update("logoScale",100);update("logoRotation",0);update("logoX",50);update("logoY",50);}}>Reset image</button></div>}
    <div className="upload-section"><div><span className="step">02</span><h3>Background / cover</h3><p>Wide images work best (1600 × 600). PNG, JPG, WebP, or GIF, up to 5 MB.</p><label className="upload-btn"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => handleFile(e, "cover")} />Select background image</label></div><div className="cover-upload-preview">{draft.cover ? <img src={draft.cover} alt="Cover preview" style={{transform:`scale(${(draft.coverScale ?? 100)/100}) rotate(${draft.coverRotation ?? 0}deg)`,objectPosition:`${draft.coverX ?? 50}% ${draft.coverY ?? 50}%`}} /> : <span>Cover image preview</span>}</div></div>
    {draft.cover && <div className="image-controls cover-image-controls"><label>Size <input type="range" min="100" max="220" value={draft.coverScale ?? 100} onChange={event=>update("coverScale",Number(event.target.value))}/><output>{draft.coverScale ?? 100}%</output></label><label>Rotation <input type="range" min="-180" max="180" value={draft.coverRotation ?? 0} onChange={event=>update("coverRotation",Number(event.target.value))}/><output>{draft.coverRotation ?? 0}°</output></label><label>Horizontal position <input type="range" min="0" max="100" value={draft.coverX ?? 50} onChange={event=>update("coverX",Number(event.target.value))}/><output>{draft.coverX ?? 50}%</output></label><label>Vertical position <input type="range" min="0" max="100" value={draft.coverY ?? 50} onChange={event=>update("coverY",Number(event.target.value))}/><output>{draft.coverY ?? 50}%</output></label><button type="button" onClick={()=>{update("coverScale",100);update("coverRotation",0);update("coverX",50);update("coverY",50);}}>Reset cover</button></div>}
  </>;
}
function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`field ${wide ? "wide" : ""} ${error ? "has-error" : ""}`}><span>{label}</span>{children}{error && <em>{error}</em>}</label>;
}

function PreviewPanel({ card, onOpen }: { card: Card; onOpen:(card:Card)=>void }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");

  useEffect(() => {
    setQrOpen(false);
    setQrSvg(null);
    setQrError("");
  }, [card.slug]);

  const openQr = async () => {
    setQrOpen(true);
    if (qrSvg) return;
    setQrLoading(true);
    setQrError("");
    try {
      const res = await fetch(`/api/cards/qr?slug=${encodeURIComponent(card.slug)}`);
      if (!res.ok) throw new Error("QR request failed");
      setQrSvg(await res.text());
    } catch {
      setQrError("Could not generate the QR code. Please try again.");
    } finally {
      setQrLoading(false);
    }
  };

  const downloadQr = () => {
    if (!qrSvg) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mylux-qr-${card.slug}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const contact = [
    ["☎", "Mobile", card.mobile ? `${card.countryCode} ${card.mobile}` : ""], ["✉", "Email", card.email],
    ["⌁", "Website", card.website], ["◉", "WhatsApp", card.whatsapp ? `${card.countryCode} ${card.whatsapp}` : ""],
  ].filter((x) => x[2]);
  const socialLinks = [
    ["Facebook", "facebook"],
    ["Instagram", "instagram"],
    ["LinkedIn", "linkedin"],
    ["Twitter", "twitter"],
    ["YouTube", "youtube"],
    ["Google Business", "google"],
    ["Google Maps", "maps"],
  ].map(([name, brand]) => ({ name, brand, url: card.social[name] })).filter((item) => item.url);
  return <aside className="preview-panel">
    {qrOpen && (
      <div className="qr-modal-overlay" onClick={() => setQrOpen(false)}>
        <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
          <button className="qr-modal-close" type="button" onClick={() => setQrOpen(false)} aria-label="Close">✕</button>
          <div className="qr-modal-title">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm8-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 13h7v7H3v-7Zm2 2v3h3v-3H5Zm10 0h2v2h-2v-2Zm-2-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-2 4h2v2h-2v-2Zm2 0h2v2h-2v-2Zm-4 2h2v2h-2v-2Z"/></svg>
            QR Code
          </div>
          <p className="qr-modal-slug">myluxcards.com/card/{card.slug}</p>
          <div className="qr-modal-img">
            {qrLoading ? <span className="qr-loading">Generating…</span> : qrSvg ? <div dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <span className="qr-loading">{qrError || "QR code unavailable"}</span>}
          </div>
          <div className="qr-modal-actions">
            {qrError ? <button type="button" className="qr-download-btn" onClick={openQr} disabled={qrLoading}>Try again</button> : <button type="button" className="qr-download-btn" onClick={downloadQr} disabled={!qrSvg}>Download SVG</button>}
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
        <button className="public-url" type="button" onClick={()=>onOpen(card)} title={`Open myluxcards.com/card/${card.slug}`}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>
          <span>myluxcards.com/card/{card.slug}</span>
        </button>
        <div className="url-card-actions">
          <button type="button" className="qr-btn" onClick={openQr} title="Generate QR Code"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden><path fill="currentColor" d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm8-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 13h7v7H3v-7Zm2 2v3h3v-3H5Zm10 0h2v2h-2v-2Zm-2-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-2 4h2v2h-2v-2Zm2 0h2v2h-2v-2Zm-4 2h2v2h-2v-2Z"/></svg> QR</button>
          <button className="view-card-link" type="button" onClick={()=>onOpen(card)}>View Card <span aria-hidden>↗</span></button>
        </div>
      </div>
    </div>
    <div className="preview-card"><div className="preview-title"><span>Card Preview</span><i>LIVE</i></div><div className="phone-preview" style={{ "--profile-bg": card.profileBackground || "#020202", "--profile-accent": card.profileAccent || "#d4af37", "--profile-text": card.profileText || "#ffffff" } as React.CSSProperties}>
      <div className="wa-bar"><input placeholder="Enter WhatsApp Number" /><button>Share</button></div>
      <div className="cover">{card.cover ? <img src={card.cover} alt="" style={{transform:`scale(${(card.coverScale ?? 100)/100}) rotate(${card.coverRotation ?? 0}deg)`,objectPosition:`${card.coverX ?? 50}% ${card.coverY ?? 50}%`}} /> : <span>MYLUX</span>}</div>
      <div className="profile-logo">{card.logo ? <img src={card.logo} alt="" style={{transform:`scale(${(card.logoScale||100)/100}) rotate(${card.logoRotation||0}deg)`,objectPosition:`${card.logoX||50}% ${card.logoY||50}%`}} /> : <span>{card.name.split(" ").map((x) => x[0]).join("").slice(0, 2) || "ML"}</span>}</div>
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
