"use client";

import { useEffect, useRef, useState } from "react";

type VehicleConnectSettings = {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  parkingNote?: string;
  allowDirectCall?: boolean;
  allowDirectMessage?: boolean;
  showEmergencyContact?: boolean;
};

type EmergencyContactSettings = {
  name?: string;
  relationship?: string;
  hasPhone?: boolean;
};

type LostAndFoundSettings = {
  itemName?: string;
  itemCategory?: string;
  rewardNote?: string;
  returnInstructions?: string;
  allowAnonymousMessage?: boolean;
};

type ContactNumberItem = {
  id?: string;
  label: string;
  countryCode?: string;
  phoneNumber: string;
  isPrimary?: boolean;
};

type EmergencyContactItem = {
  id?: string;
  name: string;
  relationship: string;
  isPrimary?: boolean;
  numbers: ContactNumberItem[];
};

type CardVehicle = {
  id: string;
  displayName: string;
  make: string;
  model: string;
  color: string;
  licensePlate: string;
  contactPhone?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  ownerContacts?: ContactNumberItem[];
  emergencyContacts?: EmergencyContactItem[];
  ownerNote: string;
  enabled: boolean;
};

type CardLostItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  color: string;
  contactPhone?: string;
  ownerContacts?: ContactNumberItem[];
  rewardEnabled: boolean;
  rewardText: string;
  returnInstructions: string;
  enabled: boolean;
};

type CardProfileProduct = {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfileService = {
  id: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfilePortfolio = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  projectUrl: string;
  ctaLabel: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfileGallery = {
  id: string;
  title: string;
  imageUrl: string;
  caption: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfileVideo = {
  id: string;
  title: string;
  provider: string;
  videoUrl: string;
  embedId: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfilePaymentLink = {
  id: string;
  label: string;
  provider: string;
  payUrl: string;
  upiId: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfileDocument = {
  id: string;
  title: string;
  fileUrl: string;
  fileSize: string;
  fileType: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfileAchievement = {
  id: string;
  title: string;
  organization: string;
  achievementDate: string;
  description: string;
  imageUrl: string;
  enabled: boolean;
  sortOrder: number;
};

type CardProfileCertification = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  credentialUrl: string;
  certificateUrl: string;
  enabled: boolean;
  sortOrder: number;
};

type Card = {
  id?: string;
  name: string; slug: string; title: string; business: string; countryCode: string; mobile: string;
  whatsapp: string; email: string; website: string; state: string; city: string; address: string;
  brochure: string; brochureData?: string; social: Record<string, string>; about: string;
  services: string[]; logo: string; cover: string; active: boolean;
  profileBackground?: string; profileAccent?: string; profileText?: string;
  logoScale?: number; logoRotation?: number; logoX?: number; logoY?: number;
  coverScale?: number; coverRotation?: number; coverX?: number; coverY?: number;
  previewAuthorized?: boolean;
  profileMode?: "DIGITAL_PROFILE" | "VEHICLE_CONNECT" | "LOST_AND_FOUND";
  enabledFeatures?: { digitalProfile: boolean; vehicleConnect: boolean; lostAndFound: boolean };
  profileFeatures?: Record<string, { enabled: boolean; sortOrder: number }>;
  featureOrder?: string[];
  vehicleConnect?: VehicleConnectSettings;
  emergencyContact?: EmergencyContactSettings;
  lostAndFound?: LostAndFoundSettings;
  hasEmergencyPhone?: boolean;
};

type PublicProfileView = "profile" | "vehicle" | "lost_found";

export default function PublicCardClient({ slug }: { slug: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [vehicles, setVehicles] = useState<CardVehicle[]>([]);
  const [lostItems, setLostItems] = useState<CardLostItem[]>([]);
  const [profileProducts, setProfileProducts] = useState<CardProfileProduct[]>([]);
  const [profileServices, setProfileServices] = useState<CardProfileService[]>([]);
  const [profilePortfolio, setProfilePortfolio] = useState<CardProfilePortfolio[]>([]);
  const [profileGallery, setProfileGallery] = useState<CardProfileGallery[]>([]);
  const [profileVideos, setProfileVideos] = useState<CardProfileVideo[]>([]);
  const [profilePaymentLinks, setProfilePaymentLinks] = useState<CardProfilePaymentLink[]>([]);
  const [profileDocuments, setProfileDocuments] = useState<CardProfileDocument[]>([]);
  const [profileAchievements, setProfileAchievements] = useState<CardProfileAchievement[]>([]);
  const [profileCertifications, setProfileCertifications] = useState<CardProfileCertification[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeView, setActiveView] = useState<PublicProfileView>("profile");
  const [loadMessage, setLoadMessage] = useState("");
  const [loadReason, setLoadReason] = useState("");
  const [showStatusBubble, setShowStatusBubble] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrPngUrl, setQrPngUrl] = useState<string | null>(null);
  const qrPngUrlRef = useRef<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [qrError, setQrError] = useState("");

  // Visitor interactive state for Vehicle Connect and Lost & Found
  const [actionToast, setActionToast] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [finderName, setFinderName] = useState("");
  const [finderContact, setFinderContact] = useState("");

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setActionToast("Phone number copied!");
      setTimeout(() => setActionToast(""), 2500);
    }
  };
  const [finderContactError, setFinderContactError] = useState("");
  const [finderSubmitted, setFinderSubmitted] = useState(false);

  // Lead Capture Modal state
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadContact, setLeadContact] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadErrors, setLeadErrors] = useState<{ name?: string; contactNumber?: string; email?: string; general?: string }>({});
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; contactNumber?: string; email?: string } = {};

    if (!leadName.trim()) {
      errors.name = "Please enter your name.";
    }
    if (!leadContact.trim()) {
      errors.contactNumber = "Please enter a valid contact number.";
    }
    if (leadEmail.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(leadEmail.trim().toLowerCase())) {
        errors.email = "Please enter a valid email address.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setLeadErrors(errors);
      return;
    }

    setLeadErrors({});
    setLeadSubmitting(true);

    let source = "DIRECT";
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const s = (sp.get("src") || sp.get("source") || "").toLowerCase();
      if (s === "nfc") source = "NFC";
      else if (s === "qr") source = "QR";
      else if (s === "share") source = "SHARE";
    }

    try {
      const res = await fetch(`/api/cards/public/${encodeURIComponent(slug)}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leadName.trim(),
          companyName: leadCompany.trim(),
          contactNumber: leadContact.trim(),
          email: leadEmail.trim(),
          source,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setLeadSuccess(true);
        trackActivity("LEAD", { context: "lead_capture_form" });
      } else {
        setLeadErrors({ general: data.message || "We couldn't share your details right now. Please try again." });
      }
    } catch {
      setLeadErrors({ general: "We couldn't share your details right now. Please try again." });
    } finally {
      setLeadSubmitting(false);
    }
  };

  const recordedEventsRef = useRef<Set<string>>(new Set());

  const trackActivity = (type: string, details?: {
    assetType?: "profile" | "vehicle" | "lost_found_item";
    vehicleId?: string;
    lostItemId?: string;
    context?: string;
    linkType?: string;
    location?: { latitude: number; longitude: number; label?: string };
  }) => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    const rawSrc = (searchParams.get("src") || searchParams.get("source") || "").toLowerCase();
    
    let channel = "LINK";
    if (rawSrc === "nfc") channel = "NFC";
    else if (rawSrc === "qr") channel = "QR";
    else if (rawSrc === "share") channel = "SHARE";
    else if (rawSrc === "preview" || searchParams.get("preview") === "1" || (card && (card as any).previewAuthorized)) channel = "PREVIEW";

    // Suppress analytics tracking entirely if page is rendered inside dashboard preview / editor
    if (channel === "PREVIEW" || (card && (card as any).previewAuthorized)) {
      return;
    }

    let visitId = "";
    try {
      visitId = window.sessionStorage.getItem(`mylux_visit_${slug}`) || "";
      if (!visitId) {
        visitId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        window.sessionStorage.setItem(`mylux_visit_${slug}`, visitId);
      }
    } catch {
      visitId = "anon-" + Date.now().toString(36);
    }

    const eventKey = `${visitId}:${type}:${details?.vehicleId || ""}:${details?.lostItemId || ""}:${details?.context || ""}`;
    if (recordedEventsRef.current.has(eventKey) && !["PHONE_NUMBER_TAPPED", "LOCATION_SHARED"].includes(type)) {
      return;
    }
    recordedEventsRef.current.add(eventKey);

    void fetch(`/api/cards/public/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        channel,
        visitId,
        linkType: details?.linkType,
        assetType: details?.assetType,
        vehicleId: details?.vehicleId,
        lostItemId: details?.lostItemId,
        context: details?.context,
        location: details?.location,
      }),
    }).catch(() => null);
  };

  const handleShareLocation = (itemId?: string) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setActionToast("Geolocation is not supported by your browser.");
      setTimeout(() => setActionToast(""), 3000);
      return;
    }
    if (!confirm("Share your current location with the item owner to help them recover this item? Your location will be sent directly to the owner.")) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        trackActivity("LOCATION_SHARED", {
          assetType: "lost_found_item",
          lostItemId: itemId,
          location: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            label: "Finder Location Shared",
          },
        });
        setActionToast("Location shared with owner successfully!");
        setTimeout(() => setActionToast(""), 3500);
      },
      () => {
        setActionToast("Location access was denied or unavailable.");
        setTimeout(() => setActionToast(""), 3000);
      }
    );
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/cards/public/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          if (!cancelled) {
            setCard(payload.card);
            setVehicles(Array.isArray(payload.vehicles) ? payload.vehicles : []);
            setLostItems(Array.isArray(payload.lostItems) ? payload.lostItems : []);
            setProfileProducts(Array.isArray(payload.profileProducts) ? payload.profileProducts : []);
            setProfileServices(Array.isArray(payload.profileServices) ? payload.profileServices : []);
            setProfilePortfolio(Array.isArray(payload.profilePortfolio) ? payload.profilePortfolio : []);
            setProfileGallery(Array.isArray(payload.profileGallery) ? payload.profileGallery : []);
            setProfileVideos(Array.isArray(payload.profileVideos) ? payload.profileVideos : []);
            setProfilePaymentLinks(Array.isArray(payload.profilePaymentLinks) ? payload.profilePaymentLinks : []);
            setProfileDocuments(Array.isArray(payload.profileDocuments) ? payload.profileDocuments : []);
            setProfileAchievements(Array.isArray(payload.profileAchievements) ? payload.profileAchievements : []);
            setProfileCertifications(Array.isArray(payload.profileCertifications) ? payload.profileCertifications : []);
            setLoaded(true);
            trackActivity("PROFILE_OPENED", { assetType: "profile" });
          }
          return;
        }
        if (!cancelled) { setLoadMessage(payload.message || "Card unavailable."); setLoadReason(payload.reason || ""); }
      } catch { /* The unavailable state is shown below. */ }
      if (!cancelled) setLoaded(true);
    };
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    return () => {
      if (qrPngUrlRef.current) {
        URL.revokeObjectURL(qrPngUrlRef.current);
        qrPngUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setQrOpen(false);
    setQrSvg(null);
    setQrError("");
    setQrPngUrl(null);
    if (qrPngUrlRef.current) {
      URL.revokeObjectURL(qrPngUrlRef.current);
      qrPngUrlRef.current = null;
    }
  }, [slug]);

  if (!loaded) return <main className="pc-state">Loading card…</main>;
  if (!card) return (
    <main className="pc-state">
      <h1>{loadMessage === "Card unavailable." ? "Card temporarily unavailable" : "Card not found"}</h1>
      <p>{loadMessage === "Card unavailable." ? (loadReason === "SWITCHED_OFF" ? "The owner has switched this card off in My Cards." : "This digital card is being updated. Please try again in a moment.") : "Check that the card link was copied completely."}</p>
      <a href="/dashboard?tab=cards">Open My Cards</a>
    </main>
  );

  const isDashboardPreview = card.previewAuthorized === true || (!/^[0-9a-f-]{36}$/i.test(card.id || "") && new URLSearchParams(window.location.search).get("preview") === "1");
  if (!card.active && !isDashboardPreview) return (
    <main className="pc-state">
      {showStatusBubble && (
        <aside className="status-help-bubble" role="status">
          <button onClick={() => setShowStatusBubble(false)} aria-label="Dismiss">×</button>
          <strong>Your card is currently off</strong>
          <p>Go to <b>My Cards</b> in your dashboard and press the Status switch to turn it back on.</p>
          <a href="/dashboard?tab=cards">Open My Cards</a>
        </aside>
      )}
      <h1>This card is currently unavailable</h1>
    </main>
  );

  const phone    = card.mobile   ? `${card.countryCode}${card.mobile}`   : "";
  const whatsapp = card.whatsapp ? `${card.countryCode}${card.whatsapp}` : "";
  const location = [card.address, card.city, card.state].filter(Boolean).join(", ");
  const preferredSocialOrder = ["Instagram", "Facebook", "YouTube", "LinkedIn", "Twitter", "Google Business", "Google Maps", "WhatsApp", "Threads"];
  const socials  = Object.entries(card.social || {})
    .filter(([, url]) => Boolean(url))
    .sort(([a], [b]) => {
      const ia = preferredSocialOrder.indexOf(a);
      const ib = preferredSocialOrder.indexOf(b);
      return (ia !== -1 ? ia : 999) - (ib !== -1 ? ib : 999);
    });
  const initials = card.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ML";

  const cssVars = {
    "--pc-bg":     card.profileBackground || "#0a0a0a",
    "--pc-accent": card.profileAccent     || "#b8962e",
    "--pc-text":   card.profileText       || "#ffffff",
  } as React.CSSProperties;

  const share = async () => {
    const data = { title: card.name, text: `${card.name}'s digital business card`, url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(window.location.href);
  };
  const track = (type: string, linkType?: string) => {
    trackActivity(type, { linkType });
  };
  const saveContact = () => {
    const contactEnabled = pf.CONTACT ? pf.CONTACT.enabled : true;
    const basicEnabled = pf.BASIC_PROFILE ? pf.BASIC_PROFILE.enabled : true;
    const websiteEnabled = pf.WEBSITE ? pf.WEBSITE.enabled : true;

    const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${card.name}`,
      card.title    && `TITLE:${card.title}`,
      card.business && `ORG:${card.business}`,
      contactEnabled && phone && `TEL:${phone}`,
      contactEnabled && card.email && `EMAIL:${card.email}`,
      websiteEnabled && card.website && `URL:${card.website}`,
      contactEnabled && location && `ADR:;;${location};;;;`,
      "END:VCARD"].filter(Boolean).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([vcard], { type: "text/vcard" }));
    link.download = `${card.name || "contact"}.vcf`;
    link.click();
    URL.revokeObjectURL(link.href);
    track("CONTACT_SAVE");
  };

  const sendVisitorAction = async (type: string, extra?: Record<string, string>) => {
    setSubmittingAction(true);
    setActionToast("");
    try {
      const res = await fetch(`/api/cards/public/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, channel: "QR", ...extra }),
      });
      if (res.ok) {
        if (type === "NOTIFY_OWNER") {
          setActionToast("✔ Parking alert sent to vehicle owner!");
        } else if (type === "EMERGENCY_CONTACT") {
          setActionToast("✔ Emergency contact notification triggered!");
        } else if (type === "LOST_ITEM_FOUND") {
          setActionToast("✔ Thank you! Your contact number has been sent to the owner.");
          setFinderName("");
          setFinderContact("");
        } else {
          setActionToast("✔ Action delivered to owner!");
        }
      } else {
        setActionToast("Could not send alert. Please try again.");
      }
    } catch {
      setActionToast("Could not send alert. Please check your connection.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleFinderSubmit = async () => {
    const digitsOnly = finderContact.replace(/\D/g, "");
    if (digitsOnly.length < 7) {
      setFinderContactError("Please enter a valid phone number (at least 7 digits).");
      return;
    }

    setSubmittingAction(true);
    setFinderContactError("");
    try {
      const res = await fetch(`/api/cards/public/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "LOST_ITEM_FOUND",
          channel: "QR",
          phone: finderContact,
          name: finderName,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setFinderSubmitted(true);
        setActionToast("✔ Contact details sent to owner!");
      } else {
        setFinderContactError(payload.message || "Could not send contact details. Please try again.");
      }
    } catch {
      setFinderContactError("Network error. Please check your connection and try again.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const openQr = async () => {
    setQrOpen(true);
    if (qrSvg) {
      if (!qrPngUrl) void createPngFromSvg(qrSvg);
      return;
    }
    setQrLoading(true);
    setQrError("");
    try {
      const res = await fetch(`/api/cards/qr?slug=${encodeURIComponent(slug)}`);
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

  const createPngFromSvg = async (svg: string) => {
    setQrDownloading(true);
    try {
      if (qrPngUrlRef.current) {
        URL.revokeObjectURL(qrPngUrlRef.current);
        qrPngUrlRef.current = null;
      }
      const blob = await svgToPngBlob(svg, 1024);
      const url = URL.createObjectURL(blob);
      qrPngUrlRef.current = url;
      setQrPngUrl(url);
    } catch {
      // ignore, fallback to on-demand download
    } finally {
      setQrDownloading(false);
    }
  };

  const downloadQr = async () => {
    if (!qrSvg) return;
    if (qrPngUrl) {
      const a = document.createElement("a");
      a.href = qrPngUrl;
      a.download = `mylux-qr-${slug}.png`;
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
      a.download = `mylux-qr-${slug}.png`;
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
    a.download = `mylux-qr-${slug}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const svgToPngBlob = async (svg: string, size: number) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
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

  /* Social platform metadata */
  const SOCIAL: Record<string, { subtitle: string; icon: React.ReactNode; iconBg: string }> = {
    Facebook:          { subtitle: "Follow me",              icon: <FacebookIcon />,    iconBg: "#1877f2" },
    Instagram:         { subtitle: "Follow us on Instagram", icon: <InstagramIcon />,   iconBg: "radial-gradient(circle at 30% 107%,#fdf497 0%,#fd5949 45%,#d6249f 60%,#285aeb 90%)" },
    LinkedIn:          { subtitle: "Follow me",              icon: <LinkedInIcon />,    iconBg: "#0a66c2" },
    Twitter:           { subtitle: "Follow me",              icon: <TwitterXIcon />,    iconBg: "#000" },
    YouTube:           { subtitle: "Subscribe",              icon: <YouTubeIcon />,     iconBg: "#ff0000" },
    "Google Business": { subtitle: "Find us online",         icon: <GoogleLetter />,    iconBg: "#4285f4" },
    "Google Maps":     { subtitle: "Get directions",         icon: <LocationIcon />,    iconBg: "#4285f4" },
    WhatsApp:          { subtitle: "Message me",             icon: <WhatsAppBrandIcon />, iconBg: "#25d366" },
    Threads:           { subtitle: "Follow me",              icon: <ThreadsIcon />,     iconBg: "#000" },
  };

  const pf = card?.profileFeatures || {};
  const digitalEnabled = (pf.BASIC_PROFILE ? pf.BASIC_PROFILE.enabled : true) && card?.enabledFeatures?.digitalProfile !== false;
  const vehicleEnabled = (pf.VEHICLE ? pf.VEHICLE.enabled : true) && card?.enabledFeatures?.vehicleConnect !== false;
  const lostFoundEnabled = (pf.LOST_AND_FOUND ? pf.LOST_AND_FOUND.enabled : true) && card?.enabledFeatures?.lostAndFound !== false;
  const availableModesCount = [digitalEnabled, vehicleEnabled, lostFoundEnabled].filter(Boolean).length;

  return (
    <main className="pc-page" style={cssVars}>

      {/* ── Feedback Notification Banner ── */}
      {actionToast && <div className="pc-toast-notice">{actionToast}</div>}

      {/* ── HERO CARD (Unified Owner Identity) ── */}
      <div className="pc-hero">
        <div className="pc-hero-cover">
          {card.cover && <img
            src={card.cover}
            className="pc-hero-cover-image"
            alt=""
            style={{
              transform: `scale(${(card.coverScale ?? 100) / 100}) rotate(${card.coverRotation ?? 0}deg)`,
              objectPosition: `${card.coverX ?? 50}% ${card.coverY ?? 50}%`,
            }}
          />}
          {!card.cover && <span className="pc-hero-wordmark">MYLUX</span>}
          <div className="pc-hero-overlay">
            <div className="pc-hero-bottom">
              {card.logo && (
                <div className="pc-hero-logo-badge">
                  <img
                    src={card.logo}
                    alt={card.name || "Logo"}
                    style={{
                      transform: `scale(${(card.logoScale ?? 100) / 100}) rotate(${card.logoRotation ?? 0}deg)`,
                      objectPosition: `${card.logoX ?? 50}% ${card.logoY ?? 50}%`,
                    }}
                  />
                </div>
              )}
              <h1 className="pc-hero-name">{card.name || "Digital Business Card"}</h1>
              {card.title && <p className="pc-hero-title">{card.title}</p>}
              {card.business && <p className="pc-hero-biz">{card.business}</p>}
            </div>
          </div>
        </div>

        {/* Quick-dial icon buttons */}
        <div className="pc-hero-icons">
          {phone && (
            <a href={`tel:${phone}`} className="pc-icon-btn" aria-label="Call" onClick={() => track("LINK_CLICK", "phone")}>
              <PhoneIcon />
            </a>
          )}
          {whatsapp && (
            <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="pc-icon-btn" aria-label="WhatsApp" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "whatsapp")}>
              <WhatsAppBrandIcon />
            </a>
          )}
          {card.email && (
            <a href={`mailto:${card.email}`} className="pc-icon-btn" aria-label="Email" onClick={() => track("LINK_CLICK", "email")}>
              <MailIcon />
            </a>
          )}
          {card.website && (
            <a href={card.website} className="pc-icon-btn" aria-label="Website" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "website")}>
              <WebIcon />
            </a>
          )}
        </div>
      </div>

      {/* ── DYNAMIC MODE SWITCHER BAR (Visible across all views if > 1 feature enabled) ── */}
      {availableModesCount > 1 && (
        <div className="pc-mode-switcher-bar" role="tablist" aria-label="Profile views">
          {digitalEnabled && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "profile"}
              className={`pc-mode-switch-btn ${activeView === "profile" ? "active" : ""}`}
              onClick={() => {
                setActiveView("profile");
                trackActivity("PROFILE_OPENED", { assetType: "profile" });
              }}
            >
              Profile
            </button>
          )}
          {vehicleEnabled && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "vehicle"}
              className={`pc-mode-switch-btn ${activeView === "vehicle" ? "active" : ""}`}
              onClick={() => {
                setActiveView("vehicle");
                trackActivity("VEHICLE_MODE_OPENED", { assetType: "vehicle" });
              }}
            >
              🚗 Vehicle
            </button>
          )}
          {lostFoundEnabled && (
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "lost_found"}
              className={`pc-mode-switch-btn ${activeView === "lost_found" ? "active" : ""}`}
              onClick={() => {
                setActiveView("lost_found");
                trackActivity("LOST_FOUND_MODE_OPENED", { assetType: "lost_found_item" });
              }}
            >
              🏷️ Lost &amp; Found
            </button>
          )}
        </div>
      )}

      {/* ── VIEW 1: VEHICLE CONNECT ── */}
      {activeView === "vehicle" && (() => {
        const activeVehicles = vehicles.filter((v) => v.enabled !== false);
        const currentVehicle = activeVehicles.length === 1
          ? activeVehicles[0]
          : activeVehicles.find((v) => v.id === selectedVehicleId) || null;

        return (
          <div className="pc-vehicle-card">
            <div className="pc-mode-pill-header" style={{ alignSelf: "center", marginBottom: 12 }}>
              🚗 MYLUX VEHICLE CONNECT
            </div>

            {activeVehicles.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                No active vehicles configured for this profile.
              </div>
            ) : !currentVehicle ? (
              /* Multi-vehicle selection screen */
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <p style={{ textAlign: "center", fontSize: 14, color: "#fff", fontWeight: 600, margin: "4px 0 10px" }}>
                  Which vehicle are you contacting about?
                </p>
                {activeVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textAlign: "left",
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(0, 229, 255,0.3)",
                      borderRadius: 12,
                      padding: "14px 16px",
                      color: "#fff",
                      fontFamily: "inherit",
                    }}
                    onClick={() => {
                      setSelectedVehicleId(v.id);
                      trackActivity("VEHICLE_SELECTED", { assetType: "vehicle", vehicleId: v.id });
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                        🚘 {v.displayName || [v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                      </div>
                      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                        {[v.make, v.model, v.color].filter(Boolean).join(" • ")} {v.licensePlate ? `(${v.licensePlate})` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 20, color: "#0066FF" }}>›</span>
                  </button>
                ))}
              </div>
            ) : (
              /* Single/Selected Vehicle details screen */
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                {activeVehicles.length > 1 && (
                  <button
                    type="button"
                    style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: "#0066FF", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 0 4px" }}
                    onClick={() => setSelectedVehicleId(null)}
                  >
                    ← All Vehicles
                  </button>
                )}

                {/* Vehicle Identity */}
                <div className="pc-vehicle-identity-clean">
                  <div className="pc-vehicle-main-title">
                    {currentVehicle.displayName || [currentVehicle.make, currentVehicle.model].filter(Boolean).join(" ") || "Vehicle"}
                  </div>
                  <div className="pc-vehicle-sub-meta">
                    {[currentVehicle.color, currentVehicle.licensePlate].filter(Boolean).join(" • ")}
                  </div>
                </div>

                {/* Owner Note */}
                {currentVehicle.ownerNote && (
                  <div className="pc-subtle-note-panel">
                    <div className="pc-note-title">Owner note</div>
                    <div className="pc-note-body">{currentVehicle.ownerNote}</div>
                  </div>
                )}

                {/* CONTACT Section */}
                <div className="pc-contact-section">
                  <div className="pc-section-header-title">CONTACT</div>
                  <div className="pc-contact-owner-label">Vehicle Owner</div>
                  {Array.isArray(currentVehicle.ownerContacts) && currentVehicle.ownerContacts.length > 0 ? (
                    <div className="pc-numbers-list">
                      {currentVehicle.ownerContacts.map((num, idx) => (
                        <div key={idx} className="pc-number-card">
                          <div className="pc-number-label">{num.label || "Personal"}</div>
                          <div className="pc-number-val-row">
                            <a
                              href={`tel:${(num.countryCode ? num.countryCode + num.phoneNumber : num.phoneNumber).replace(/\D/g, "")}`}
                              className="pc-phone-link"
                              onClick={() => {
                                trackActivity("PHONE_NUMBER_TAPPED", {
                                  assetType: "vehicle",
                                  vehicleId: currentVehicle.id,
                                  context: "vehicle_owner",
                                });
                              }}
                            >
                              {num.countryCode ? `${num.countryCode} ` : ""}{num.phoneNumber}
                            </a>
                            <button
                              type="button"
                              className="pc-copy-icon-btn"
                              title="Copy phone number"
                              onClick={() => copyToClipboard(num.countryCode ? `${num.countryCode} ${num.phoneNumber}` : num.phoneNumber)}
                            >
                              ⧉
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pc-empty-contact">No contact number has been provided.</div>
                  )}
                </div>

                {/* EMERGENCY CONTACTS Section */}
                <div className="pc-emergency-section">
                  <div className="pc-section-header-title-emergency">🚨 EMERGENCY CONTACTS</div>
                  {Array.isArray(currentVehicle.emergencyContacts) && currentVehicle.emergencyContacts.length > 0 ? (
                    <div className="pc-emergency-list">
                      {currentVehicle.emergencyContacts.map((ec, idx) => (
                        <div key={idx} className="pc-emergency-contact-card">
                          <div className="pc-ec-header">
                            <div className="pc-ec-name">{ec.name}</div>
                            {ec.relationship && <div className="pc-ec-rel">{ec.relationship}</div>}
                          </div>
                          <div className="pc-numbers-list" style={{ marginTop: 8 }}>
                            {Array.isArray(ec.numbers) && ec.numbers.length > 0 ? (
                              ec.numbers.map((num, nIdx) => (
                                <div key={nIdx} className="pc-number-card">
                                  <div className="pc-number-label">{num.label || "Mobile"}</div>
                                  <div className="pc-number-val-row">
                                    <a
                                      href={`tel:${(num.countryCode ? num.countryCode + num.phoneNumber : num.phoneNumber).replace(/\D/g, "")}`}
                                      className="pc-phone-link"
                                      onClick={() => {
                                        trackActivity("PHONE_NUMBER_TAPPED", {
                                          assetType: "vehicle",
                                          vehicleId: currentVehicle.id,
                                          context: "vehicle_emergency",
                                        });
                                      }}
                                    >
                                      {num.countryCode ? `${num.countryCode} ` : ""}{num.phoneNumber}
                                    </a>
                                    <button
                                      type="button"
                                      className="pc-copy-icon-btn"
                                      title="Copy phone number"
                                      onClick={() => copyToClipboard(num.countryCode ? `${num.countryCode} ${num.phoneNumber}` : num.phoneNumber)}
                                    >
                                      ⧉
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="pc-empty-contact" style={{ padding: "4px 0" }}>No phone numbers listed.</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pc-empty-contact">No emergency contacts have been added.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── VIEW 2: LOST & FOUND ── */}
      {activeView === "lost_found" && (() => {
        const activeItems = lostItems.filter((i) => i.enabled !== false);
        const currentItem = activeItems.length === 1
          ? activeItems[0]
          : activeItems.find((i) => i.id === selectedItemId) || null;

        return (
          <div className="pc-lost-card">
            <div className="pc-mode-pill-header" style={{ alignSelf: "center", marginBottom: 12 }}>
              🏷️ MYLUX LOST &amp; FOUND
            </div>

            {activeItems.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                No active Lost &amp; Found items configured for this profile.
              </div>
            ) : !currentItem ? (
              /* Multi-item selection screen */
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <p style={{ textAlign: "center", fontSize: 14, color: "#fff", fontWeight: 600, margin: "4px 0 10px" }}>
                  Which item did you find?
                </p>
                {activeItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      textAlign: "left",
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(0, 229, 255,0.3)",
                      borderRadius: 12,
                      padding: "14px 16px",
                      color: "#fff",
                      fontFamily: "inherit",
                    }}
                    onClick={() => {
                      setSelectedItemId(item.id);
                      trackActivity("LOST_FOUND_ITEM_SELECTED", { assetType: "lost_found_item", lostItemId: item.id });
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                        🏷️ {item.name || "Tagged Item"}
                      </div>
                      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                        Category: {item.category} {item.color ? `• ${item.color}` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 20, color: "#0066FF" }}>›</span>
                  </button>
                ))}
              </div>
            ) : (
              /* Single/Selected Item details screen */
              <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
                {activeItems.length > 1 && (
                  <button
                    type="button"
                    style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: "#0066FF", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "0 0 4px" }}
                    onClick={() => setSelectedItemId(null)}
                  >
                    ← All Lost &amp; Found Items
                  </button>
                )}

                {/* Item Identity */}
                <div className="pc-item-identity-clean">
                  <div className="pc-item-main-title">{currentItem.name}</div>
                  <div className="pc-item-sub-meta">
                    {[currentItem.category, currentItem.color || currentItem.description].filter(Boolean).join(" • ")}
                  </div>
                </div>

                <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0 }}>
                  You found an item belonging to <strong>{card.name}</strong>.
                </p>

                {/* Reward Offered */}
                {currentItem.rewardEnabled && (
                  <div className="pc-reward-subtle">
                    🎁 Reward offered for safe return: <span>{currentItem.rewardText || "Reward available upon return!"}</span>
                  </div>
                )}

                {/* Return Instructions */}
                {currentItem.returnInstructions && (
                  <div className="pc-subtle-note-panel">
                    <div className="pc-note-title">Return instructions</div>
                    <div className="pc-note-body">{currentItem.returnInstructions}</div>
                  </div>
                )}

                {/* Voluntary Location Sharing */}
                <div style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    style={{
                      background: "rgba(0, 229, 255,0.12)",
                      border: "1px solid rgba(0, 229, 255,0.4)",
                      color: "#0066FF",
                      padding: "10px 16px",
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => handleShareLocation(currentItem.id)}
                  >
                    📍 Share location where item was found with owner
                  </button>
                </div>

                {/* CONTACT Section */}
                <div className="pc-contact-section">
                  <div className="pc-section-header-title">CONTACT</div>
                  <div className="pc-contact-owner-label">Item Owner</div>
                  {Array.isArray(currentItem.ownerContacts) && currentItem.ownerContacts.length > 0 ? (
                    <div className="pc-numbers-list">
                      {currentItem.ownerContacts.map((num, idx) => (
                        <div key={idx} className="pc-number-card">
                          <div className="pc-number-label">{num.label || "Personal"}</div>
                          <div className="pc-number-val-row">
                            <a
                              href={`tel:${(num.countryCode ? num.countryCode + num.phoneNumber : num.phoneNumber).replace(/\D/g, "")}`}
                              className="pc-phone-link"
                              onClick={() => {
                                trackActivity("PHONE_NUMBER_TAPPED", {
                                  assetType: "lost_found_item",
                                  lostItemId: currentItem.id,
                                  context: "lost_found_owner",
                                });
                              }}
                            >
                              {num.countryCode ? `${num.countryCode} ` : ""}{num.phoneNumber}
                            </a>
                            <button
                              type="button"
                              className="pc-copy-icon-btn"
                              title="Copy phone number"
                              onClick={() => copyToClipboard(num.countryCode ? `${num.countryCode} ${num.phoneNumber}` : num.phoneNumber)}
                            >
                              ⧉
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="pc-empty-contact">No contact number has been provided.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── VIEW 3: DIGITAL PROFILE (STANDARD) ── */}
      {activeView === "profile" && (
        <>
          {/* Action buttons (Save Contact / Share / QR Code) */}
          <div className="pc-actions">
            <button className="pc-action-btn pc-action-btn-primary" type="button" onClick={() => setLeadModalOpen(true)}>
              SHARE YOUR DETAILS
            </button>
            <button className="pc-action-btn" type="button" onClick={saveContact}>Save Contact</button>
            <button className="pc-action-btn" type="button" onClick={() => { track("SHARE"); void share(); }}>Share</button>
            <button className="pc-action-btn pc-action-qr" onClick={openQr}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden style={{flexShrink:0,verticalAlign:"middle"}}><path fill="currentColor" d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm8-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 13h7v7H3v-7Zm2 2v3h3v-3H5Zm10 0h2v2h-2v-2Zm-2-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-2 4h2v2h-2v-2Zm2 0h2v2h-2v-2Zm-4 2h2v2h-2v-2Z"/></svg>
              {" "}QR Code
            </button>
            {card.brochure && (
              <a
                className="pc-action-btn"
                href={card.brochureData || "#"}
                download={card.brochure}
                onClick={(e) => { if (!card.brochureData) e.preventDefault(); }}
              >Brochure</a>
            )}
          </div>

          {/* Dynamic Module Ordering for Standard Profile View */}
          {(() => {
            const orderKeys = (card.featureOrder || [
              "BASIC_PROFILE",
              "CONTACT",
              "SOCIAL_LINKS",
              "WEBSITE",
              "EMERGENCY_CONTACT",
            ]).filter((key) => key !== "VEHICLE" && key !== "LOST_AND_FOUND");

            return orderKeys.map((featureKey) => {
              const featureConfig = pf[featureKey];
              if (featureConfig && featureConfig.enabled === false) return null;

              if (featureKey === "BASIC_PROFILE") {
                return (
                  <div key="BASIC_PROFILE" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {card.about && (
                      <div className="pc-card pc-about">
                        <h2 className="pc-card-heading">About {card.name.split(" ")[0]}</h2>
                        <p className="pc-about-text">{card.about}</p>
                      </div>
                    )}
                    {card.services && card.services.length > 0 && (
                      <div className="pc-card pc-services">
                        <h2 className="pc-card-heading">Services / Products</h2>
                        <ul className="pc-services-list">
                          {card.services.map((s) => <li key={s}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              }

              if (featureKey === "CONTACT") {
                return (
                  <div key="CONTACT" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {(phone || card.email || location) && (
                      <div className="pc-card pc-contact-card">
                        <div className="pc-contact-header">
                          {card.cover
                            ? <img src={card.cover} className="pc-contact-thumb" alt={card.name} />
                            : card.logo
                              ? <img src={card.logo} className="pc-contact-thumb pc-contact-thumb--logo" alt={card.name} />
                              : <div className="pc-contact-thumb pc-contact-initials">{initials}</div>
                          }
                          <span className="pc-contact-label">Contact</span>
                        </div>
                        <hr className="pc-dashed-rule" />
                        {phone && (
                          <div className="pc-contact-row">
                            <span className="pc-contact-row-label">Call me</span>
                            <a href={`tel:${phone}`} className="pc-contact-row-value" onClick={() => track("LINK_CLICK", "phone")}>{phone}</a>
                          </div>
                        )}
                        {whatsapp && whatsapp !== phone && (
                          <div className="pc-contact-row">
                            <span className="pc-contact-row-label">WhatsApp</span>
                            <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="pc-contact-row-value" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "whatsapp")}>{whatsapp}</a>
                          </div>
                        )}
                        {card.email && (
                          <div className="pc-contact-row">
                            <span className="pc-contact-row-label">Email</span>
                            <a href={`mailto:${card.email}`} className="pc-contact-row-value" onClick={() => track("LINK_CLICK", "email")}>{card.email}</a>
                          </div>
                        )}
                        {location && (
                          <div className="pc-contact-row">
                            <span className="pc-contact-row-label">Address</span>
                            <span className="pc-contact-row-value">{location}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              if (featureKey === "WEBSITE") {
                return (
                  <div key="WEBSITE" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {card.website && (
                      <div className="pc-links-group">
                        <a href={card.website} className="pc-link-row" target="_blank" rel="noopener noreferrer" onClick={() => track("LINK_CLICK", "website")}>
                          <span className="pc-link-icon" style={{ background: "#444" }}><WebIcon /></span>
                          <span className="pc-link-text">
                            <span className="pc-link-name">Website</span>
                            <span className="pc-link-sub">{card.website.replace(/^https?:\/\//, "")}</span>
                          </span>
                          <span className="pc-link-arrow">›</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              }

              if (featureKey === "SOCIAL_LINKS") {
                return (
                  <div key="SOCIAL_LINKS" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {socials.length > 0 && (
                      <div className="pc-links-group">
                        {socials.map(([name, url]) => {
                          const cfg = SOCIAL[name] || {
                            subtitle: "Visit",
                            icon: <span className="pc-brand-letter">{name[0]}</span>,
                            iconBg: "#555",
                          };
                          return (
                            <a
                              key={name}
                              href={url}
                              className="pc-link-row"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => track("LINK_CLICK", name.toLowerCase())}
                            >
                              <span className="pc-link-icon" style={{ background: cfg.iconBg }}>{cfg.icon}</span>
                              <span className="pc-link-text">
                                <span className="pc-link-name">{name}</span>
                                <span className="pc-link-sub">{cfg.subtitle}</span>
                              </span>
                              <span className="pc-link-arrow">›</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              if (featureKey === "EMERGENCY_CONTACT") {
                return (
                  <div key="EMERGENCY_CONTACT" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {(card.emergencyContact?.name || card.hasEmergencyPhone) && (
                      <div className="pc-card pc-contact-card" style={{ border: "1px solid rgba(255, 69, 58, 0.4)", background: "rgba(255, 69, 58, 0.05)" }}>
                        <div className="pc-contact-header">
                          <span className="pc-contact-label" style={{ color: "#ff453a" }}>🚨 Emergency Contact</span>
                        </div>
                        <hr className="pc-dashed-rule" />
                        {card.emergencyContact?.name && (
                          <div className="pc-contact-row">
                            <span className="pc-contact-row-label">Contact Name</span>
                            <span className="pc-contact-row-value">{card.emergencyContact.name} ({card.emergencyContact.relationship || "Emergency"})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              if (featureKey === "PRODUCTS") {
                const activeProducts = profileProducts.filter(p => p.enabled !== false);
                if (activeProducts.length === 0) return null;

                return (
                  <div key="PRODUCTS" className="pc-card pc-products-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h2 className="pc-card-heading" style={{ margin: 0 }}>Products</h2>
                      <span style={{ fontSize: 11, background: "rgba(0, 229, 255, 0.12)", color: "#00E5FF", padding: "3px 10px", borderRadius: 12, border: "1px solid rgba(0, 229, 255, 0.3)", fontWeight: 700, letterSpacing: "0.5px" }}>
                        SHOWCASE
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                      {activeProducts.map((prod) => (
                        <div
                          key={prod.id}
                          style={{
                            background: "rgba(255, 255, 255, 0.04)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 14,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
                            transition: "transform 0.2s ease, border-color 0.2s ease",
                          }}
                        >
                          {prod.imageUrl && (
                            <div style={{ width: "100%", height: 160, overflow: "hidden", background: "#0a0a0c", position: "relative" }}>
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </div>
                          )}
                          <div style={{ padding: 14, display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
                            {prod.category && (
                              <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 700, color: "#00E5FF", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                {prod.category}
                              </span>
                            )}
                            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                              {prod.name}
                            </h3>
                            {prod.description && (
                              <p style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.7)", margin: 0, flex: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
                                {prod.description}
                              </p>
                            )}
                            {prod.price && (
                              <div style={{ fontSize: 15, fontWeight: 800, color: "#38ef7d", marginTop: 4 }}>
                                {prod.currency === "INR" ? "₹" : prod.currency === "USD" ? "$" : prod.currency === "EUR" ? "€" : prod.currency === "GBP" ? "£" : `${prod.currency} `}
                                {prod.price}
                              </div>
                            )}
                            {prod.ctaUrl ? (
                              <a
                                href={prod.ctaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => trackActivity("PRODUCT_CTA_CLICKED", { context: prod.name })}
                                style={{
                                  marginTop: 8,
                                  width: "100%",
                                  textAlign: "center",
                                  background: "linear-gradient(135deg, #0066FF 0%, #00E5FF 100%)",
                                  color: "#fff",
                                  fontWeight: 700,
                                  fontSize: 12.5,
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  textDecoration: "none",
                                  display: "inline-block",
                                  boxShadow: "0 2px 10px rgba(0, 102, 255, 0.3)",
                                }}
                              >
                                {prod.ctaLabel || "View Details"}
                              </a>
                            ) : prod.ctaLabel ? (
                              <div
                                style={{
                                  marginTop: 8,
                                  width: "100%",
                                  textAlign: "center",
                                  background: "rgba(255, 255, 255, 0.08)",
                                  border: "1px solid rgba(255, 255, 255, 0.15)",
                                  color: "#fff",
                                  fontWeight: 600,
                                  fontSize: 12,
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                }}
                              >
                                {prod.ctaLabel}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "SERVICES") {
                const activeServices = profileServices.filter(s => s.enabled !== false);
                if (activeServices.length === 0) return null;

                return (
                  <div key="SERVICES" className="pc-card pc-services-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h2 className="pc-card-heading" style={{ margin: 0 }}>Services</h2>
                      <span style={{ fontSize: 11, background: "rgba(0, 102, 255, 0.12)", color: "#0066FF", padding: "3px 10px", borderRadius: 12, border: "1px solid rgba(0, 102, 255, 0.3)", fontWeight: 700 }}>
                        SERVICES
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                      {activeServices.map((svc) => (
                        <div key={svc.id} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", padding: 14, gap: 8 }}>
                          {svc.imageUrl && (
                            <div style={{ width: "100%", height: 140, borderRadius: 10, overflow: "hidden", background: "#000" }}>
                              <img src={svc.imageUrl} alt={svc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                          )}
                          {svc.category && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0066FF", textTransform: "uppercase" }}>{svc.category}</span>}
                          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", margin: 0 }}>{svc.name}</h3>
                          {svc.description && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0 }}>{svc.description}</p>}
                          {svc.price && <div style={{ fontSize: 14, fontWeight: 800, color: "#38ef7d" }}>{svc.currency === "INR" ? "₹" : "$"} {svc.price}</div>}
                          {svc.ctaUrl && (
                            <a href={svc.ctaUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 6, background: "linear-gradient(135deg, #0066FF 0%, #00E5FF 100%)", color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 8, textAlign: "center", textDecoration: "none" }}>
                              {svc.ctaLabel || "Book Service"}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "PORTFOLIO") {
                const activeProjects = profilePortfolio.filter(p => p.enabled !== false);
                if (activeProjects.length === 0) return null;

                return (
                  <div key="PORTFOLIO" className="pc-card pc-portfolio-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h2 className="pc-card-heading" style={{ margin: 0 }}>Portfolio &amp; Projects</h2>
                      <span style={{ fontSize: 11, background: "rgba(255, 153, 0, 0.12)", color: "#ff9900", padding: "3px 10px", borderRadius: 12, border: "1px solid rgba(255, 153, 0, 0.3)", fontWeight: 700 }}>
                        WORK
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                      {activeProjects.map((proj) => (
                        <div key={proj.id} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", padding: 14, gap: 8 }}>
                          {proj.imageUrl && (
                            <div style={{ width: "100%", height: 140, borderRadius: 10, overflow: "hidden" }}>
                              <img src={proj.imageUrl} alt={proj.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                          )}
                          {proj.category && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#ff9900", textTransform: "uppercase" }}>{proj.category}</span>}
                          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", margin: 0 }}>{proj.title}</h3>
                          {proj.description && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0 }}>{proj.description}</p>}
                          {proj.projectUrl && (
                            <a href={proj.projectUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 6, background: "rgba(255, 153, 0, 0.15)", border: "1px solid rgba(255, 153, 0, 0.4)", color: "#ff9900", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 8, textAlign: "center", textDecoration: "none" }}>
                              {proj.ctaLabel || "View Project 🔗"}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "GALLERY") {
                const activePhotos = profileGallery.filter(g => g.enabled !== false);
                if (activePhotos.length === 0) return null;

                return (
                  <div key="GALLERY" className="pc-card pc-gallery-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 className="pc-card-heading" style={{ margin: 0 }}>Gallery</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                      {activePhotos.map((img) => (
                        <div key={img.id} style={{ borderRadius: 10, overflow: "hidden", position: "relative", height: 120, background: "#111" }}>
                          <img src={img.imageUrl} alt={img.title || "Gallery photo"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {img.title && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.7)", padding: "4px 6px", fontSize: 10.5, color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {img.title}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "VIDEOS") {
                const activeVideos = profileVideos.filter(v => v.enabled !== false);
                if (activeVideos.length === 0) return null;

                return (
                  <div key="VIDEOS" className="pc-card pc-videos-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 className="pc-card-heading" style={{ margin: 0 }}>Videos</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {activeVideos.map((vid) => (
                        <div key={vid.id} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{vid.title}</h3>
                          {vid.embedId && vid.provider === "YouTube" ? (
                            <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden" }}>
                              <iframe src={`https://www.youtube.com/embed/${vid.embedId}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }} allowFullScreen />
                            </div>
                          ) : vid.videoUrl ? (
                            <a href={vid.videoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,0,0,0.15)", border: "1px solid rgba(255,0,0,0.4)", color: "#ff4d4d", padding: "10px 14px", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                              ▶ Watch Video ({vid.provider || "Link"})
                            </a>
                          ) : null}
                          {vid.description && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0 }}>{vid.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "PAYMENT_LINKS") {
                const activePayLinks = profilePaymentLinks.filter(p => p.enabled !== false);
                if (activePayLinks.length === 0) return null;

                return (
                  <div key="PAYMENT_LINKS" className="pc-card pc-payment-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 className="pc-card-heading" style={{ margin: 0 }}>💳 Payment &amp; UPI Links</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {activePayLinks.map((pay) => (
                        <div key={pay.id} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{pay.label}</div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{pay.provider} {pay.upiId ? `• ${pay.upiId}` : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {pay.upiId && (
                              <button type="button" onClick={() => copyToClipboard(pay.upiId)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
                                Copy UPI
                              </button>
                            )}
                            {pay.payUrl && (
                              <a href={pay.payUrl} target="_blank" rel="noopener noreferrer" style={{ background: "#0066FF", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                                Pay Now
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "DOCUMENTS") {
                const activeDocs = profileDocuments.filter(d => d.enabled !== false);
                if (activeDocs.length === 0) return null;

                return (
                  <div key="DOCUMENTS" className="pc-card pc-documents-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 className="pc-card-heading" style={{ margin: 0 }}>📁 Documents &amp; Files</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {activeDocs.map((doc) => (
                        <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "#fff" }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>📄 {doc.title}</div>
                            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>{doc.fileType || "PDF"} {doc.fileSize ? `• ${doc.fileSize}` : ""}</div>
                          </div>
                          <span style={{ fontSize: 12, color: "#0066FF", fontWeight: 700 }}>Download ↓</span>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "ACHIEVEMENTS") {
                const activeAchievements = profileAchievements.filter(a => a.enabled !== false);
                if (activeAchievements.length === 0) return null;

                return (
                  <div key="ACHIEVEMENTS" className="pc-card pc-achievements-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 className="pc-card-heading" style={{ margin: 0 }}>🏆 Achievements &amp; Awards</h2>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {activeAchievements.map((ach) => (
                        <div key={ach.id} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 215, 0, 0.2)", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                          {ach.imageUrl && (
                            <img src={ach.imageUrl} alt={ach.title} style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover" }} />
                          )}
                          <div>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#ffd700" }}>{ach.title}</div>
                            {ach.organization && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{ach.organization} {ach.achievementDate ? `• ${ach.achievementDate}` : ""}</div>}
                            {ach.description && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>{ach.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              if (featureKey === "CERTIFICATIONS") {
                const activeCerts = profileCertifications.filter(c => c.enabled !== false);
                if (activeCerts.length === 0) return null;

                return (
                  <div key="CERTIFICATIONS" className="pc-card pc-certifications-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <h2 className="pc-card-heading" style={{ margin: 0 }}>📜 Certifications</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                      {activeCerts.map((cert) => (
                        <div key={cert.id} style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{cert.title}</div>
                          {cert.issuer && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Issuer: {cert.issuer} {cert.issueDate ? `(${cert.issueDate})` : ""}</div>}
                          {cert.credentialUrl && (
                            <a href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, fontSize: 12, color: "#0066FF", fontWeight: 700, textDecoration: "none" }}>
                              Verify Credential ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return null;
            });
          })()}
        </>
      )}

      {/* ── QR Code modal ── */}
      {qrOpen && (
        <div className="pc-qr-overlay" onClick={() => setQrOpen(false)} role="dialog" aria-modal="true" aria-label="QR Code">
          <div className="pc-qr-modal" onClick={(e) => e.stopPropagation()}>
            <button className="pc-qr-close" type="button" onClick={() => setQrOpen(false)} aria-label="Close">×</button>
            <p className="pc-qr-title">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden style={{flexShrink:0}}><path fill="currentColor" d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm8-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 13h7v7H3v-7Zm2 2v3h3v-3H5Zm10 0h2v2h-2v-2Zm-2-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-2 4h2v2h-2v-2Zm2 0h2v2h-2v-2Zm-4 2h2v2h-2v-2Z"/></svg>
              Scan to visit this card
            </p>
            <div className="pc-qr-img">
              {qrLoading ? <span className="pc-qr-loading">Generating…</span> : qrSvg ? <div dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <span className="pc-qr-loading">{qrError || "QR code unavailable"}</span>}
            </div>
            <p className="pc-qr-url">{typeof window !== "undefined" ? window.location.href : ""}</p>
            <div className="pc-qr-actions">
              {qrError && <button type="button" className="pc-qr-download" onClick={openQr} disabled={qrLoading}>Try again</button>}
              {!qrError && (
                <>
                  <button type="button" className="pc-qr-download" onClick={downloadQr} disabled={!qrSvg || qrLoading || qrDownloading}>
                    {qrDownloading ? "Downloading…" : "Download PNG"}
                  </button>
                  <button type="button" className="pc-qr-download svg-btn" onClick={downloadSvg} disabled={!qrSvg || qrLoading}>
                    Download SVG
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lead Capture Modal ── */}
      {leadModalOpen && (
        <div className="pc-lead-modal-overlay" onClick={() => setLeadModalOpen(false)} role="dialog" aria-modal="true" aria-label="Share Your Details">
          <div className="pc-lead-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="pc-lead-modal-close" type="button" onClick={() => setLeadModalOpen(false)} aria-label="Close modal">×</button>

            {!leadSuccess ? (
              <>
                <div className="pc-lead-modal-header-block">
                  <h2 className="pc-lead-modal-title">SHARE YOUR DETAILS</h2>
                  <p className="pc-lead-modal-subtitle">
                    Leave your contact information and the profile owner can get back to you.
                  </p>
                </div>

                {leadErrors.general && (
                  <div className="pc-lead-error-banner" role="alert">
                    {leadErrors.general}
                  </div>
                )}

                <form onSubmit={handleLeadSubmit} className="pc-lead-form" noValidate>
                  <div className="pc-lead-field-group">
                    <label htmlFor="lead-name" className="pc-lead-label">
                      Name <span className="pc-req" style={{ color: "#0066FF" }}>*</span>
                    </label>
                    <input
                      id="lead-name"
                      type="text"
                      className={`pc-lead-input ${leadErrors.name ? "has-error" : ""}`}
                      placeholder="Enter your name"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      maxLength={100}
                      disabled={leadSubmitting}
                      autoFocus
                    />
                    {leadErrors.name && <span className="pc-lead-field-error" style={{ color: "#e74c3c", fontSize: 12 }}>{leadErrors.name}</span>}
                  </div>

                  <div className="pc-lead-field-group">
                    <label htmlFor="lead-company" className="pc-lead-label">Company Name</label>
                    <input
                      id="lead-company"
                      type="text"
                      className="pc-lead-input"
                      placeholder="Enter company name"
                      value={leadCompany}
                      onChange={(e) => setLeadCompany(e.target.value)}
                      maxLength={150}
                      disabled={leadSubmitting}
                    />
                  </div>

                  <div className="pc-lead-field-group">
                    <label htmlFor="lead-contact" className="pc-lead-label">
                      Contact Number <span className="pc-req" style={{ color: "#0066FF" }}>*</span>
                    </label>
                    <input
                      id="lead-contact"
                      type="tel"
                      className={`pc-lead-input ${leadErrors.contactNumber ? "has-error" : ""}`}
                      placeholder="+91 98765 43210"
                      value={leadContact}
                      onChange={(e) => setLeadContact(e.target.value)}
                      maxLength={30}
                      disabled={leadSubmitting}
                    />
                    {leadErrors.contactNumber && <span className="pc-lead-field-error" style={{ color: "#e74c3c", fontSize: 12 }}>{leadErrors.contactNumber}</span>}
                  </div>

                  <div className="pc-lead-field-group">
                    <label htmlFor="lead-email" className="pc-lead-label">Email</label>
                    <input
                      id="lead-email"
                      type="email"
                      className={`pc-lead-input ${leadErrors.email ? "has-error" : ""}`}
                      placeholder="you@example.com"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      maxLength={255}
                      disabled={leadSubmitting}
                    />
                    {leadErrors.email && <span className="pc-lead-field-error" style={{ color: "#e74c3c", fontSize: 12 }}>{leadErrors.email}</span>}
                  </div>

                  <button type="submit" className="pc-lead-submit-btn" disabled={leadSubmitting}>
                    {leadSubmitting ? "SHARING..." : "SHARE DETAILS"}
                  </button>
                </form>
              </>
            ) : (
              <div className="pc-lead-success-box">
                <div className="pc-lead-success-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="pc-lead-modal-title" style={{ fontSize: 22, marginTop: 8 }}>DETAILS SHARED</h2>
                <p className="pc-lead-modal-subtitle" style={{ fontSize: 14, lineHeight: 1.5 }}>
                  Thank you, <strong>{leadName}</strong>. Your contact information has been shared successfully.
                </p>
                <p style={{ color: "#9A9FAE", fontSize: 13, margin: "4px 0 16px" }}>
                  The profile owner can now get back to you.
                </p>
                <button
                  type="button"
                  className="pc-lead-submit-btn"
                  onClick={() => {
                    setLeadModalOpen(false);
                    setLeadSuccess(false);
                    setLeadName("");
                    setLeadCompany("");
                    setLeadContact("");
                    setLeadEmail("");
                  }}
                >
                  DONE
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="pc-footer">
        <a href="/" className="pc-footer-pill">
          <span className="pc-footer-badge">M</span>
          Get your own page for free!
        </a>
      </footer>
    </main>
  );
}

/* ─── SVG Icon Components ─── */

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.64A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4 10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function WhatsAppBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.8" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="17.4" cy="6.8" r="1.15" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 1 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TwitterXIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function ThreadsIcon() {
  return (
    <svg viewBox="0 0 192 192" fill="currentColor" aria-hidden>
      <path d="M141.537 88.988a66.667 66.667 0 00-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.035l15.624 10.73c5.734-8.705 14.724-10.558 19.496-10.558h.23c7.535.048 13.219 2.237 16.895 6.506 2.682 3.08 4.476 7.379 5.354 12.82-6.687-1.138-13.925-1.489-21.67-.904-21.765 1.555-35.779 13.7-34.923 31.02.44 8.763 4.895 16.3 12.557 21.232 6.454 4.18 14.782 6.229 23.415 5.749 11.478-.64 20.479-5.01 26.752-13.003 4.732-6.11 7.734-14.042 9.077-24.089 5.44 3.284 9.459 7.842 11.525 13.392 3.595 9.532 3.805 25.174-7.46 36.443-9.816 9.819-21.622 14.075-39.441 14.201-19.758-.14-34.682-6.484-44.357-18.86-8.953-11.492-13.556-28.018-13.693-49.11.137-21.093 4.74-37.619 13.693-49.11 9.675-12.377 24.6-18.72 44.357-18.86 19.905.143 35.06 6.516 45.033 18.94 4.911 6.16 8.617 13.978 11.053 23.153l18.513-4.93c-2.953-11.191-7.69-20.829-14.17-28.748C119.021 19.42 100.58 10.473 77.8 10.3h-.497C54.663 10.474 36.383 19.45 23.725 36.534 12.576 51.806 6.925 72.832 6.75 99.416v.168c.175 26.583 5.826 47.609 16.975 62.88 12.658 17.085 30.938 26.06 54.553 26.234h.497c20.921-.149 35.8-5.726 47.938-17.864 15.785-15.781 15.315-35.59 10.064-47.741-3.727-8.695-10.714-15.705-19.57-20.226z" />
    </svg>
  );
}

function GoogleLetter() {
  return <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>G</span>;
}
