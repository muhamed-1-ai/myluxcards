"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  Users,
  MessageSquare,
  Calendar,
  Trophy,
  AlertCircle,
  QrCode,
  Smartphone,
  ExternalLink,
  Edit3,
  Share2,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Flame,
  Filter,
  Check,
  Zap,
} from "lucide-react";

export interface AnalyticsSummary {
  totalOpens: number;
  directViews?: number;
  nfcTaps: number;
  qrScans: number;
  otherOpens: number;
}

export interface DashboardDataProps {
  cardsCount: number;
  activeCardsCount: number;
  selectedCard: {
    id: string;
    name: string;
    title: string;
    business: string;
    slug: string;
    active: boolean;
    logo?: string;
    about?: string;
    email?: string;
    mobile?: string;
    website?: string;
    services?: string[];
    social?: Record<string, string>;
  };
  overviewAnalytics: AnalyticsSummary | null;
  analyticsPeriod: "7d" | "30d" | "90d";
  onPeriodChange: (period: "7d" | "30d" | "90d") => void;
  onNavigateTab: (tab: string) => void;
  onOpenCardPreview: () => void;
}

/* ═══════════════════════════════════════════�export function BusinessKpiGrid({
  analytics,
  leadsCount,
  unreadReplies,
  followUps,
  wonLeads,
}: {
  analytics: AnalyticsSummary | null;
  leadsCount: number;
  unreadReplies: number;
  followUps: number;
  wonLeads: number;
}) {
  return (
    <div className="crm-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
      <div className="crm-kpi-card" style={{ borderColor: "rgba(38,119,223,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="crm-kpi-label">PROFILE OPENS</span>
          <TrendingUp className="w-4 h-4 text-blue-500" />
        </div>
        <div className="crm-kpi-value" style={{ color: "var(--text-primary)" }}>{analytics?.totalOpens ?? 0}</div>
        <div className="crm-kpi-sub">Total card views</div>
      </div>

      <div className="crm-kpi-card" style={{ borderColor: "rgba(0, 102, 255,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="crm-kpi-label">NEW LEADS</span>
          <Users className="w-4 h-4 text-amber-500" />
        </div>
        <div className="crm-kpi-value text-[#0066FF]">{leadsCount}</div>
        <div className="crm-kpi-sub">Shared contact details</div>
      </div>

      <div className="crm-kpi-card" style={{ borderColor: "rgba(46,204,113,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="crm-kpi-label">WA REPLIES</span>
          <MessageSquare className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="crm-kpi-value text-emerald-500">{unreadReplies}</div>
        <div className="crm-kpi-sub">Unread WhatsApp messages</div>
      </div>

      <div className="crm-kpi-card" style={{ borderColor: "rgba(230,126,34,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="crm-kpi-label">FOLLOW-UPS</span>
          <Calendar className="w-4 h-4 text-orange-500" />
        </div>
        <div className="crm-kpi-value text-orange-500">{followUps}</div>
        <div className="crm-kpi-sub">Due today / overdue</div>
      </div>

      <div className="crm-kpi-card" style={{ borderColor: "rgba(155,89,182,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="crm-kpi-label">WON LEADS</span>
          <Trophy className="w-4 h-4 text-purple-500" />
        </div>
        <div className="crm-kpi-value text-purple-500">{wonLeads}</div>
        <div className="crm-kpi-sub">Converted deals</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   2. DIGITAL CARD KPI GRID
══════════════════════════════════════════════ */
export function DigitalCardKpiGrid({
  analytics,
}: {
  analytics: AnalyticsSummary | null;
}) {
  const total = analytics?.totalOpens ?? 0;
  const direct = analytics?.directViews ?? 0;
  const qr = analytics?.qrScans ?? 0;
  const nfc = analytics?.nfcTaps ?? 0;

  return (
    <div className="crm-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
      <div className="crm-kpi-card" style={{ borderColor: "rgba(0, 102, 255, 0.35)" }}>
        <span className="crm-kpi-label">TOTAL OPENS</span>
        <div className="crm-kpi-value text-[#0066FF]">{total}</div>
        <div className="crm-kpi-sub">Profile views</div>
      </div>

      <div className="crm-kpi-card">
        <span className="crm-kpi-label">DIRECT VIEWS</span>
        <div className="crm-kpi-value text-blue-500">{direct}</div>
        <div className="crm-kpi-sub">Direct link clicks</div>
      </div>

      <div className="crm-kpi-card">
        <span className="crm-kpi-label">QR SCANS</span>
        <div className="crm-kpi-value text-emerald-500">{qr}</div>
        <div className="crm-kpi-sub">Scanned QR code</div>
      </div>

      <div className="crm-kpi-card">
        <span className="crm-kpi-label">NFC TAPS</span>
        <div className="crm-kpi-value text-purple-500">{nfc}</div>
        <div className="crm-kpi-sub">Tapped smart card</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   3. COMPACT TODAY CARD
══════════════════════════════════════════════ */
export function CompactTodayCard({
  analytics,
}: {
  analytics: AnalyticsSummary | null;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          TODAY SUMMARY
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 14, border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{analytics?.totalOpens ?? 0}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Profile Opens</div>
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 14, border: "1px solid rgba(52,152,219,0.2)" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#3498db" }}>{analytics?.directViews ?? 0}</div>
          <div style={{ fontSize: 11, color: "#3498db", marginTop: 2 }}>Direct Views</div>
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 14, border: "1px solid rgba(46,204,113,0.2)" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2ecc71" }}>{analytics?.qrScans ?? 0}</div>
          <div style={{ fontSize: 11, color: "#2ecc71", marginTop: 2 }}>QR Scans</div>
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 14, border: "1px solid rgba(155,89,182,0.2)" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#9b59b6" }}>{analytics?.nfcTaps ?? 0}</div>
          <div style={{ fontSize: 11, color: "#9b59b6", marginTop: 2 }}>NFC Taps</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   4. NEEDS ATTENTION WIDGET
══════════════════════════════════════════════ */
export function NeedsAttentionWidget({
  onNavigateTab,
}: {
  onNavigateTab: (tab: string) => void;
}) {
  const items = [
    {
      id: "contact",
      icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
      text: "Review and update your profile contact information",
      action: "Edit Contact",
      tab: "contact",
    },
    {
      id: "social",
      icon: <Zap className="w-4 h-4 text-blue-500" />,
      text: "Add custom social links and business apps",
      action: "Manage Links",
      tab: "social",
    },
  ];

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 18, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            PROFILE TASKS
          </span>
          <span style={{ fontSize: 10, background: "rgba(0, 102, 255, 0.1)", color: "#0066FF", border: "1px solid rgba(0, 102, 255, 0.2)", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>
            {items.length} Pending
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Action Required</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onNavigateTab(item.tab)}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {item.icon}
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{item.text}</span>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0066FF" }}>
              {item.action} →
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   6. PERFORMANCE ANALYTICS WIDGET
══════════════════════════════════════════════ */
export function PerformanceAnalyticsWidget({
  analytics,
  period,
  onPeriodChange,
}: {
  analytics: AnalyticsSummary | null;
  period: "7d" | "30d" | "90d";
  onPeriodChange: (p: "7d" | "30d" | "90d") => void;
}) {
  const total = analytics?.totalOpens ?? 0;
  const nfc = analytics?.nfcTaps ?? 0;
  const qr = analytics?.qrScans ?? 0;
  const other = analytics?.otherOpens ?? 0;

  const nfcPct = total > 0 ? Math.round((nfc / total) * 100) : 0;
  const qrPct = total > 0 ? Math.round((qr / total) * 100) : 0;
  const otherPct = total > 0 ? Math.round((other / total) * 100) : 0;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            PROFILE PERFORMANCE
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0" }}>Visitor Entry Breakdown</h3>
        </div>

        <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", padding: 3, borderRadius: 10, border: "1px solid var(--border-color)" }}>
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                background: period === p ? "#0066FF" : "transparent",
                color: period === p ? "#FFFFFF" : "var(--text-muted)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 14, border: "1px solid rgba(46,204,113,0.2)" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>NFC Taps</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#2ecc71", margin: "2px 0" }}>{nfc.toLocaleString()}</div>
          <div style={{ width: "100%", height: 4, background: "var(--border-color)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${nfcPct}%`, height: "100%", background: "#2ecc71" }} />
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>{nfcPct}% of total entries</div>
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 14, border: "1px solid rgba(52,152,219,0.2)" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>QR Scans</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#3498db", margin: "2px 0" }}>{qr.toLocaleString()}</div>
          <div style={{ width: "100%", height: 4, background: "var(--border-color)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${qrPct}%`, height: "100%", background: "#3498db" }} />
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>{qrPct}% of total entries</div>
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 14, border: "1px solid rgba(155,89,182,0.2)" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Direct / Unknown</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#9b59b6", margin: "2px 0" }}>{other.toLocaleString()}</div>
          <div style={{ width: "100%", height: 4, background: "var(--border-color)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${otherPct}%`, height: "100%", background: "#9b59b6" }} />
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4 }}>{otherPct}% of total entries</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   9. PROFILE COMPLETION WIDGET
══════════════════════════════════════════════ */
export function ProfileCompletionWidget({
  card,
  onNavigateTab,
}: {
  card: DashboardDataProps["selectedCard"];
  onNavigateTab: (tab: string) => void;
}) {
  const missingItems: { label: string; tab: string }[] = [];

  if (!card.business) missingItems.push({ label: "Add Company Details", tab: "company" });
  if (!card.email) missingItems.push({ label: "Add Contact Email", tab: "contact" });
  if (!card.mobile) missingItems.push({ label: "Add Mobile Number", tab: "contact" });
  if (!card.website) missingItems.push({ label: "Add Website URL", tab: "contact" });
  if (!card.about) missingItems.push({ label: "Add About / Biography", tab: "contact" });
  if (!card.logo) missingItems.push({ label: "Upload Card Logo", tab: "appearance" });
  if (!card.services || card.services.length === 0) missingItems.push({ label: "Add Services Offered", tab: "company" });

  const totalFields = 7;
  const completedFields = totalFields - missingItems.length;
  const pct = Math.round((completedFields / totalFields) * 100);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            PROFILE SETUP
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "2px 0 0" }}>
            Profile {pct}% Complete
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab("contact")}
          className="mylux-btn-submit"
          style={{ fontSize: 12, padding: "6px 14px" }}
        >
          Continue Setup →
        </button>
      </div>

      <div style={{ width: "100%", height: 6, background: "var(--bg-secondary)", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#0066FF", transition: "width 0.3s ease" }} />
      </div>

      {missingItems.length > 0 ? (
        <div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
            {missingItems.length} task{missingItems.length > 1 ? "s" : ""} remaining to complete your profile:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
            {missingItems.slice(0, 4).map((item, idx) => (
              <div
                key={idx}
                onClick={() => onNavigateTab(item.tab)}
                style={{
                  fontSize: 12,
                  color: "var(--text-primary)",
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <span>• {item.label}</span>
                <span style={{ fontSize: 10.5, color: "#0066FF", fontWeight: 700 }}>Edit →</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#2ecc71", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          Your profile is 100% complete and published!
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   11. ACTIVE CARD BANNER
══════════════════════════════════════════════ */
export function ActiveCardBanner({
  card,
  totalOpens,
  onNavigateTab,
  onOpenCardPreview,
}: {
  card: DashboardDataProps["selectedCard"];
  totalOpens: number;
  onNavigateTab: (tab: string) => void;
  onOpenCardPreview: () => void;
}) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 20, marginBottom: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <div>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          PUBLISHED DIGITAL CARD
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 2px" }}>{card.name}</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{card.title} {card.business ? `· ${card.business}` : ""}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onOpenCardPreview}
          className="crm-pill-btn"
          style={{ fontSize: 12, padding: "8px 14px", background: "rgba(0, 102, 255, 0.08)", color: "#0066FF", borderColor: "rgba(0, 102, 255, 0.2)" }}
        >
          View Profile
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab("contact")}
          className="crm-pill-btn"
          style={{ fontSize: 12, padding: "8px 14px", background: "var(--bg-secondary)", color: "var(--text-primary)", borderColor: "var(--border-color)" }}
        >
          Edit Card
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   12. QUICK ACTIONS GRID
══════════════════════════════════════════════ */
export function QuickActionsGrid({
  onNavigateTab,
  onOpenCardPreview,
}: {
  onNavigateTab: (tab: string) => void;
  onOpenCardPreview: () => void;
}) {
  const actions = [
    { label: "View Profile", icon: <ExternalLink className="w-4 h-4 text-blue-500" />, onClick: onOpenCardPreview },
    { label: "Edit Card", icon: <Edit3 className="w-4 h-4 text-amber-500" />, onClick: () => onNavigateTab("contact") },
    { label: "Share QR", icon: <QrCode className="w-4 h-4 text-emerald-500" />, onClick: () => onNavigateTab("modes") },
  ];

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 18, marginBottom: 20 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 12 }}>
        QUICK ACTIONS
      </span>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {actions.map((act, idx) => (
          <button
            key={idx}
            type="button"
            onClick={act.onClick}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {act.icon}
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}k className="w-4 h-4 text-blue-400" />, onClick: onOpenCardPreview },
    { label: "Edit Card", icon: <Edit3 className="w-4 h-4 text-amber-400" />, onClick: () => onNavigateTab("contact") },
    { label: "Share QR", icon: <QrCode className="w-4 h-4 text-emerald-400" />, onClick: () => onNavigateTab("modes") },
  ];

  return (
    <div style={{ background: "#0B0C10", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 16, padding: 18, marginBottom: 20 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#0066FF", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 12 }}>
        QUICK ACTIONS
      </span>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {actions.map((act, idx) => (
          <button
            key={idx}
            type="button"
            onClick={act.onClick}
            style={{
              background: "#12131A",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#FFF",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {act.icon}
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}
