"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ModernProfileLayout } from "@/components/card/ModernProfileLayout";
import { CompactProfileThemeSwitcher } from "@/components/card/CompactProfileThemeSwitcher";
import { ProfileThemePreference } from "@/lib/themeTokens";
import { buildVCardString } from "@/lib/vcard";
import { X, Check, Info, Users, Sparkles } from "lucide-react";

const DEMO_CARD_DATA = {
  id: "demo-alex-morgan",
  slug: "alex-morgan",
  name: "Alex Morgan",
  title: "Founder & Managing Director",
  business: "Apex Studio",
  countryCode: "+91",
  countryIso: "IN",
  mobile: "+91 98765 00123",
  whatsapp: "+91 98765 00123",
  email: "alex@apexcreative.studio",
  website: "https://apexcreative.studio",
  about: "Creative Director and Founder specializing in premium brand identities, contactless technology, and smart NFC digital ecosystems.",
  cover: "/assets/demo-cover.jpg",
  logo: "/assets/demo-avatar.png",
  services: [
    "Smart NFC Business Cards & Digital Identity",
    "Brand Strategy & Creative Direction",
    "High-Conversion Web & Mobile Design",
  ],
  contactNumbers: [
    {
      id: "demo-phone-primary",
      label: "MOBILE",
      countryCode: "+91",
      phoneNumber: "+91 98765 00123",
      isPrimary: true,
    },
  ],
};

export default function InteractiveDemoModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [themePreference, setThemePreference] = useState<ProfileThemePreference>("carbon_platinum");
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" } | null>(null);
  const [leadNoticeOpen, setLeadNoticeOpen] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, type: "success" | "info" = "success") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);

    // Also bridge to landing page toast helper if present
    if (typeof window !== "undefined" && (window as unknown as { app?: { showToast?: (msg: string, t: string) => void } }).app?.showToast) {
      (window as unknown as { app?: { showToast?: (msg: string, t: string) => void } }).app?.showToast?.(message, type);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setLeadNoticeOpen(false);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "hidden";
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setLeadNoticeOpen(false);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
      const modalEl = document.getElementById("live-demo-modal");
      if (modalEl) {
        modalEl.classList.remove("open");
        modalEl.setAttribute("aria-hidden", "true");
      }
    }
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleCtaClick = () => {
    handleClose();
    setTimeout(() => {
      const materialsSection = document.querySelector("#materials") || document.getElementById("materials");
      if (materialsSection) {
        materialsSection.scrollIntoView({ behavior: "smooth" });
      }
    }, 120);
  };

  // Wire trigger buttons and handle Escape key
  useEffect(() => {
    const triggerIds = [
      "hero-live-demo-btn",
      "hero-demo-profile-trigger",
      "tap-card",
      "section-live-demo-btn",
    ];

    const onTrigger = (e: Event) => {
      e.preventDefault();
      handleOpen();
    };

    triggerIds.forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("click", onTrigger);
    });

    const onCustomOpen = () => handleOpen();
    const onCustomClose = () => handleClose();
    window.addEventListener("zappit:open-demo", onCustomOpen);
    window.addEventListener("zappit:close-demo", onCustomClose);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    // Also observe class mutations on live-demo-modal in case external scripts toggle `.open`
    const modalEl = document.getElementById("live-demo-modal");
    let observer: MutationObserver | null = null;
    if (modalEl) {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "class") {
            const hasOpen = modalEl.classList.contains("open");
            if (hasOpen && !isOpen) {
              setIsOpen(true);
              document.body.style.overflow = "hidden";
            }
          }
        }
      });
      observer.observe(modalEl, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      triggerIds.forEach((id) => {
        const el = document.getElementById(id);
        el?.removeEventListener("click", onTrigger);
      });
      window.removeEventListener("zappit:open-demo", onCustomOpen);
      window.removeEventListener("zappit:close-demo", onCustomClose);
      window.removeEventListener("keydown", onKeyDown);
      observer?.disconnect();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [handleOpen, handleClose, isOpen]);

  // Sync open state to modal DOM element
  useEffect(() => {
    const modalEl = document.getElementById("live-demo-modal");
    if (!modalEl) return;
    if (isOpen) {
      modalEl.classList.add("open");
      modalEl.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    } else {
      modalEl.classList.remove("open");
      modalEl.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  const handleSaveContact = useCallback(() => {
    const vcardResult = buildVCardString({
      profileName: DEMO_CARD_DATA.name,
      cardName: DEMO_CARD_DATA.name,
      companyName: DEMO_CARD_DATA.business,
      title: DEMO_CARD_DATA.title,
      phone: DEMO_CARD_DATA.mobile,
      email: DEMO_CARD_DATA.email,
      website: DEMO_CARD_DATA.website,
      address: "MG Road, Suite 400",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
    });

    const blob = new Blob([vcardResult.vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "alex-morgan.vcf");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Downloaded sample vCard: alex-morgan.vcf", "success");
  }, [showToast]);

  const handleShareDetails = useCallback(() => {
    setLeadNoticeOpen((prev) => !prev);
    showToast("Lead Exchange: In live profiles, this opens a contact capture form sending details directly to your CRM.", "info");
  }, [showToast]);

  const handleShare = useCallback(() => {
    const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/#live-demo` : "https://3gzappit.com/#live-demo";
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("Demo profile link copied to clipboard!", "success");
      }).catch(() => {
        showToast("Demo profile link: " + shareUrl, "info");
      });
    } else {
      showToast("Demo profile link: " + shareUrl, "info");
    }
  }, [showToast]);

  const card = {
    ...DEMO_CARD_DATA,
    profileThemePreference: themePreference,
  };

  return (
    <div
      id="live-demo-modal"
      className={`modal-overlay zappit-demo-modal-overlay ${isOpen ? "open" : ""}`}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-demo-title"
      onClick={handleBackdropClick}
    >
      <div className="modal-card glass-solid zappit-demo-modal-card">
        {/* Close button */}
        <button
          className="modal-close zappit-demo-modal-close"
          type="button"
          id="close-live-demo-btn"
          aria-label="Close live profile demo"
          onClick={handleClose}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="zappit-demo-modal-header">
          <span className="zappit-demo-modal-eyebrow">
            Interactive Demonstration
          </span>
          <h3 id="live-demo-title" className="zappit-demo-modal-title">
            Zappit Digital Profile Experience
          </h3>
          <p className="zappit-demo-modal-subtitle">
            This is exactly what opens when someone taps your Zappit smart card.
          </p>
        </div>

        {/* Lead Exchange Demo Notice Banner (if triggered) */}
        {leadNoticeOpen && (
          <div className="zappit-demo-lead-notice">
            <div className="flex items-start gap-2.5">
              <Users className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
              <div className="text-left text-xs leading-relaxed zappit-demo-lead-notice-body">
                <span className="font-bold block mb-0.5" style={{ color: "var(--apple-blue, #0066FF)" }}>Interactive Demo · Voluntary Lead Exchange</span>
                In live profiles, tapping <strong>Share Your Contacts</strong> opens a branded two-way lead exchange sheet. Visitors submit their contact details, which instantly sync into your Zappit Lead Management CRM workspace.
              </div>
            </div>
            <button
              type="button"
              className="opacity-75 hover:opacity-100 text-xs mt-1 self-end underline cursor-pointer"
              onClick={() => setLeadNoticeOpen(false)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Production Digital Profile Preview (Scrollable Viewport) */}
        <div className="zappit-demo-preview-scroll">
          <ModernProfileLayout
            card={card}
            profileProducts={[]}
            themeSwitcher={
              <CompactProfileThemeSwitcher
                card={card}
                currentPreference={themePreference}
                onSelectTheme={(pref) => {
                  setThemePreference(pref);
                  showToast(`Theme: ${pref.replace(/_/g, " ").toUpperCase()}`, "info");
                }}
              />
            }
            onSaveContact={handleSaveContact}
            onShareDetails={handleShareDetails}
            onShare={handleShare}
          />
        </div>

        {/* Modal Footer CTA */}
        <div className="zappit-demo-modal-footer">
          <button
            type="button"
            id="demo-modal-cta-btn"
            className="apple-btn apple-btn-primary zappit-demo-cta-btn"
            onClick={handleCtaClick}
          >
            Choose Your Card Now
          </button>
        </div>

        {/* Floating feedback toast */}
        {toast && (
          <div className={`zappit-demo-inline-toast ${toast.type}`}>
            {toast.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
