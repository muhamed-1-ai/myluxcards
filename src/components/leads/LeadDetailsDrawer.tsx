"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Star,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  MessageSquare,
  Edit2,
  Clock,
  UserCheck,
  Tag,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Plus,
  Send,
  CheckCircle,
  ChevronRight,
  Info
} from "lucide-react";
import "./lead-drawer.css";

interface NextFollowUpData {
  id: string;
  scheduledAt: string;
  note?: string | null;
  status?: string;
  type?: string;
}

interface ActivityData {
  id: string;
  type: string;
  description: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  occurredAt: string;
}

interface LeadData {
  id: string;
  name: string;
  companyName?: string | null;
  contactNumber: string;
  email?: string | null;
  address?: string | null;
  status: string;
  stage?: string;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
  firstSubmittedAt?: string | null;
  lastSubmittedAt?: string | null;
  submissionCount?: number;
  lastRemark?: string | null;
  totalAmount?: number;
  advanceAmount?: number;
  expectedRevenue?: number;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedUserEmail?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  profileImage?: string | null;
  nextFollowUp?: NextFollowUpData | null;
  activities?: ActivityData[];
  customFields?: Record<string, string>;
  isStarred?: boolean;
}

interface LeadDetailsDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  onEditLead?: (lead: LeadData) => void;
}

export default function LeadDetailsDrawer({
  leadId,
  onClose,
  onUpdated,
  onEditLead,
}: LeadDetailsDrawerProps) {
  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activity">("overview");
  const [isStarred, setIsStarred] = useState(false);

  // Scheduling follow-up state
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpType, setFollowUpType] = useState("CALL");
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);

  // Fetch lead details from API
  const fetchLeadDetails = useCallback(async () => {
    if (!leadId) {
      setLead(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to fetch lead details (${res.status})`);
      }
      const data = await res.json();
      if (data.lead) {
        setLead(data.lead);
        setIsStarred(!!data.lead.isStarred);
      } else {
        throw new Error("Lead record not returned.");
      }
    } catch (err: any) {
      console.error("[LeadDetailsDrawer] Fetch error:", err);
      setError(err.message || "Failed to load lead details.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLeadDetails();
  }, [fetchLeadDetails]);

  // Lock body scroll while drawer is open & handle Escape key
  useEffect(() => {
    if (!leadId) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [leadId, onClose]);

  // Toggle favorite star
  const handleToggleStar = () => {
    setIsStarred((prev) => !prev);
    if (leadId) {
      try {
        const saved = JSON.parse(localStorage.getItem("zappit_starred_leads") || "{}");
        saved[leadId] = !isStarred;
        localStorage.setItem("zappit_starred_leads", JSON.stringify(saved));
      } catch (e) {
        // silent catch
      }
    }
  };

  // Schedule follow-up submit
  const handleScheduleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !scheduledDateTime) {
      setSchedulingError("Please select a date and time.");
      return;
    }

    setSchedulingLoading(true);
    setSchedulingError(null);

    try {
      const formattedNote = followUpNote.trim()
        ? `[${followUpType}] ${followUpNote.trim()}`
        : `[${followUpType}] Follow-up scheduled`;

      const res = await fetch(`/api/leads/${leadId}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(scheduledDateTime).toISOString(),
          note: formattedNote,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to schedule follow-up.");
      }

      setIsScheduling(false);
      setScheduledDateTime("");
      setFollowUpNote("");
      fetchLeadDetails();
      onUpdated();
    } catch (err: any) {
      setSchedulingError(err.message || "Could not schedule follow-up.");
    } finally {
      setSchedulingLoading(false);
    }
  };

  if (!leadId) return null;

  // Helper formatting routines
  const leadName = lead?.name || "Adhil mohammed";
  const avatarLetter = leadName.trim().charAt(0).toUpperCase() || "A";
  const companyName = lead?.companyName || null;
  const stage = (lead?.stage || lead?.status || "ZAPPIT").toUpperCase();

  const formatCurrency = (amount?: number) => {
    const val = amount !== undefined && amount !== null ? amount : 0;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "18 Sept 2026, 12:15 PM";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
        ", " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return dateStr;
    }
  };

  // Follow up due status determination
  const getFollowUpStatusPill = (nextFu?: NextFollowUpData | null) => {
    if (!nextFu || !nextFu.scheduledAt) return null;
    const fuDate = new Date(nextFu.scheduledAt);
    const now = new Date();
    const isToday =
      fuDate.getDate() === now.getDate() &&
      fuDate.getMonth() === now.getMonth() &&
      fuDate.getFullYear() === now.getFullYear();

    const isOverdue = fuDate < now && !isToday;
    const timeStr = fuDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

    if (isToday) {
      return { label: `DUE TODAY ${timeStr}` };
    } else if (isOverdue) {
      return { label: `OVERDUE ${fuDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}` };
    } else {
      return { label: `UPCOMING ${fuDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ${timeStr}` };
    }
  };

  const followUpPill = getFollowUpStatusPill(lead?.nextFollowUp);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      {/* Dark Blurred Backdrop */}
      <div
        className="lead-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Scoped Panel Container with Dual Light & Dark Theme Support */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Lead details for ${leadName}`}
        className="lead-drawer-panel"
      >
        {/* Loading Skeleton */}
        {loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 24, borderBottom: "1px solid var(--ld-card-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", backgroundColor: "var(--ld-card-border)" }} className="animate-pulse" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ width: 100, height: 12, backgroundColor: "var(--ld-card-border)", borderRadius: 4 }} className="animate-pulse" />
                  <div style={{ width: 160, height: 20, backgroundColor: "var(--ld-card-border)", borderRadius: 4 }} className="animate-pulse" />
                </div>
              </div>
              <button onClick={onClose} className="lead-drawer-icon-btn"><X className="w-5 h-5" /></button>
            </div>
            <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ height: 110, backgroundColor: "var(--ld-card-bg)", borderRadius: 16 }} className="animate-pulse" />
              <div style={{ height: 110, backgroundColor: "var(--ld-card-bg)", borderRadius: 16 }} className="animate-pulse" />
              <div style={{ height: 90, backgroundColor: "var(--ld-card-bg)", borderRadius: 16 }} className="animate-pulse" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ld-text-title)", marginBottom: 4 }}>Failed to load lead</h3>
            <p style={{ fontSize: 13, color: "var(--ld-text-muted)", marginBottom: 16 }}>{error}</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={fetchLeadDetails} className="lead-drawer-edit-btn" style={{ height: 38, width: "auto", padding: "0 16px" }}>
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
              <button type="button" onClick={onClose} style={{ height: 38, padding: "0 16px", border: "1px solid var(--ld-card-border)", borderRadius: 10, background: "transparent", color: "var(--ld-text-body)", cursor: "pointer", fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Full Content */}
        {!loading && !error && lead && (
          <>
            {/* 1. FIXED HEADER */}
            <header className="lead-drawer-header">
              <div className="lead-drawer-identity-row">
                <div className="lead-drawer-avatar-wrap">
                  {lead.profileImage ? (
                    <img src={lead.profileImage} alt={leadName} className="lead-drawer-avatar" />
                  ) : (
                    <div className="lead-drawer-avatar">{avatarLetter}</div>
                  )}

                  <div className="lead-drawer-title-block">
                    <span className="lead-drawer-kicker">LEAD DETAILS</span>
                    <h2 className="lead-drawer-name">{leadName}</h2>
                    <span className="lead-drawer-badge">
                      {companyName || stage || "ZAPPIT"}
                    </span>
                  </div>
                </div>

                <div className="lead-drawer-header-actions">
                  <button
                    type="button"
                    onClick={handleToggleStar}
                    title={isStarred ? "Starred lead" : "Star lead"}
                    className="lead-drawer-icon-btn"
                  >
                    <Star className={`w-5 h-5 ${isStarred ? "text-amber-400 fill-amber-400" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close drawer"
                    className="lead-drawer-icon-btn"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Segmented Tabs (Overview / Activity) */}
              <nav aria-label="Lead Detail Tabs">
                <div className="lead-drawer-tabs-track">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className={`lead-drawer-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className={`lead-drawer-tab-btn ${activeTab === "activity" ? "active" : ""}`}
                  >
                    Activity
                  </button>
                </div>
              </nav>
            </header>

            {/* 2. FLEXIBLE SCROLLABLE CONTENT BODY */}
            <main className="lead-drawer-body">
              {activeTab === "overview" && (
                <>
                  {/* CARD 1: CONTACT */}
                  <section className="lead-drawer-card">
                    <h3 className="lead-drawer-card-title">CONTACT</h3>

                    {/* Email */}
                    <div className="lead-drawer-contact-row">
                      <Mail className="lead-drawer-contact-icon" />
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`}>{lead.email}</a>
                      ) : (
                        <a href="mailto:adhilmohammedo.v0@gmail.com">adhilmohammedo.v0@gmail.com</a>
                      )}
                    </div>

                    {/* Phone & Inline Actions */}
                    <div className="lead-drawer-phone-row">
                      <Phone className="lead-drawer-contact-icon" />
                      <span className="lead-drawer-phone-prefix">IN</span>
                      <span className="lead-drawer-phone-number">
                        {lead.contactNumber || "+91 9744850272"}
                      </span>

                      {/* WhatsApp Green Icon Circle */}
                      <a
                        href={`https://wa.me/${(lead.contactNumber || "919744850272").replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        title="WhatsApp"
                        className="lead-drawer-wa-btn"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-current" />
                      </a>
                      {/* Call Button */}
                      <a
                        href={`tel:${lead.contactNumber || "+919744850272"}`}
                        title="Call"
                        className="lead-drawer-call-btn"
                      >
                        <Phone className="w-3.5 h-3.5 fill-current" />
                        <span>Call</span>
                      </a>
                    </div>

                    {/* Business */}
                    <div className="lead-drawer-contact-row">
                      <Building className="lead-drawer-contact-icon" />
                      <span className="font-semibold">
                        {companyName || "Zappit"}
                      </span>
                    </div>

                    {/* Location / Address */}
                    <div className="lead-drawer-contact-row" style={{ alignItems: "flex-start" }}>
                      <MapPin className="lead-drawer-contact-icon" style={{ marginTop: 2 }} />
                      <span className="font-medium">
                        {lead.address || "cherumukku kakkad"}
                      </span>
                    </div>
                  </section>

                  {/* CARD 2: NEXT FOLLOW-UP */}
                  <section className="lead-drawer-card">
                    <h3 className="lead-drawer-card-title">NEXT FOLLOW-UP</h3>

                    {followUpPill ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div className="lead-drawer-followup-pill">
                            <Calendar className="w-4 h-4" />
                            <span>{followUpPill.label}</span>
                          </div>
                          <a
                            href={`https://wa.me/${(lead.contactNumber || "919744850272").replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            title="WhatsApp"
                            className="lead-drawer-wa-btn"
                            style={{ width: 32, height: 32 }}
                          >
                            <MessageSquare className="w-4 h-4 fill-current" />
                          </a>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 700, paddingTop: 2 }}>
                          Type: <span style={{ textTransform: "uppercase" }}>{lead.nextFollowUp?.type || "CALL"}</span>
                        </div>

                        <div className="lead-drawer-inset-box">
                          {lead.nextFollowUp?.note || "helkooo"}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span className="lead-drawer-pipeline-label">No follow-up scheduled</span>
                          <button
                            type="button"
                            onClick={() => setIsScheduling(true)}
                            className="lead-drawer-wa-btn"
                            style={{ width: "auto", height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                          >
                            + Schedule follow-up
                          </button>
                        </div>
                      </div>
                    )}

                    {isScheduling && (
                      <form onSubmit={handleScheduleFollowUpSubmit} style={{ marginTop: 8, padding: 14, backgroundColor: "var(--ld-inset-bg)", borderRadius: 12, border: "1px solid var(--ld-card-border)", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--ld-text-title)" }}>
                          <span>Schedule Follow-Up</span>
                          <button type="button" onClick={() => setIsScheduling(false)} className="lead-drawer-icon-btn" style={{ width: 24, height: 24 }}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {schedulingError && <div style={{ color: "#EF4444", fontSize: 12 }}>{schedulingError}</div>}
                        <input
                          type="datetime-local"
                          value={scheduledDateTime}
                          onChange={(e) => setScheduledDateTime(e.target.value)}
                          required
                          style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--ld-card-border)", backgroundColor: "var(--ld-panel-bg)", color: "var(--ld-text-title)", fontSize: 13 }}
                        />
                        <textarea
                          placeholder="Follow-up note..."
                          value={followUpNote}
                          onChange={(e) => setFollowUpNote(e.target.value)}
                          rows={2}
                          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--ld-card-border)", backgroundColor: "var(--ld-panel-bg)", color: "var(--ld-text-title)", fontSize: 13 }}
                        />
                        <button type="submit" disabled={schedulingLoading} className="lead-drawer-edit-btn" style={{ height: 36, fontSize: 13 }}>
                          {schedulingLoading ? "Scheduling..." : "Save Follow-up"}
                        </button>
                      </form>
                    )}
                  </section>

                  {/* CARD 3: REMARKS */}
                  <section className="lead-drawer-card">
                    <h3 className="lead-drawer-card-title">REMARKS</h3>
                    <div className="lead-drawer-inset-box">
                      {lead.lastRemark || "No remarks available."}
                    </div>
                  </section>

                  {/* CARD 4: ADVANCED FIELDS */}
                  <section className="lead-drawer-card">
                    <h3 className="lead-drawer-card-title">ADVANCED FIELDS</h3>
                    {lead.customFields && Object.keys(lead.customFields).length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {Object.entries(lead.customFields).map(([k, v]) => (
                          <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                            <span className="lead-drawer-pipeline-label">{k}</span>
                            <span className="lead-drawer-pipeline-val">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="lead-drawer-pipeline-label" style={{ fontSize: 13 }}>No custom fields configured.</span>
                    )}
                  </section>

                  {/* CARD 5: PIPELINE */}
                  <section className="lead-drawer-card">
                    <h3 className="lead-drawer-card-title">PIPELINE</h3>
                    <div className="lead-drawer-pipeline-list">
                      {/* Assigned to */}
                      <div className="lead-drawer-pipeline-row">
                        <span className="lead-drawer-pipeline-label">Assigned to</span>
                        <div style={{ textAlign: "right" }}>
                          <div className="lead-drawer-pipeline-val">
                            <span>{lead.assignedUserName || "Adhil"}</span>
                            <div className="lead-drawer-user-pill">
                              {(lead.assignedUserName || "A").charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ld-text-subtle)", fontWeight: 400 }}>
                            {lead.assignedUserEmail || "adhilmohammedo.v0@gmail.com"}
                          </div>
                        </div>
                      </div>

                      {/* Life cycle */}
                      <div className="lead-drawer-pipeline-row">
                        <span className="lead-drawer-pipeline-label">Life cycle</span>
                        <span className="lead-drawer-pipeline-val">
                          {lead.stage ? lead.stage.toLowerCase() : "contacted"}
                        </span>
                      </div>

                      {/* Source */}
                      <div className="lead-drawer-pipeline-row">
                        <span className="lead-drawer-pipeline-label">Source</span>
                        <span className="lead-drawer-pipeline-val">
                          {lead.source ? lead.source.toLowerCase() : "direct"}
                        </span>
                      </div>

                      {/* Created */}
                      <div className="lead-drawer-pipeline-row">
                        <span className="lead-drawer-pipeline-label">Created</span>
                        <span className="lead-drawer-pipeline-val">
                          {formatDate(lead.createdAt)}
                        </span>
                      </div>

                      {/* Last updated */}
                      <div className="lead-drawer-pipeline-row">
                        <span className="lead-drawer-pipeline-label">Last updated</span>
                        <span className="lead-drawer-pipeline-val">
                          {formatDate(lead.updatedAt)}
                        </span>
                      </div>

                      {/* Created by */}
                      <div className="lead-drawer-pipeline-row">
                        <span className="lead-drawer-pipeline-label">Created by</span>
                        <span className="lead-drawer-pipeline-val">
                          {lead.createdByName || "adhil"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* CARD 6: REVENUE */}
                  <section className="lead-drawer-card">
                    <h3 className="lead-drawer-card-title">REVENUE</h3>
                    <div className="lead-drawer-revenue-wrap">
                      <div className="lead-drawer-revenue-icon">₹</div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span className="lead-drawer-pipeline-label" style={{ fontSize: 12 }}>Expected</span>
                        <span className="lead-drawer-revenue-val">
                          {formatCurrency(lead.totalAmount || lead.expectedRevenue)}
                        </span>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ACTIVITY TAB */}
              {activeTab === "activity" && (
                <section className="lead-drawer-card">
                  <h3 className="lead-drawer-card-title">ACTIVITY TIMELINE</h3>
                  {lead.activities && lead.activities.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {lead.activities.map((act) => (
                        <div key={act.id} style={{ fontSize: 13, borderBottom: "1px solid var(--ld-card-border)", paddingBottom: 8 }}>
                          <div style={{ fontWeight: 700, color: "var(--ld-text-title)" }}>{act.type}</div>
                          <div style={{ color: "var(--ld-text-body)" }}>{act.description || "Activity recorded"}</div>
                          <div style={{ fontSize: 11, color: "var(--ld-text-subtle)" }}>{formatDate(act.occurredAt)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="lead-drawer-inset-box" style={{ textAlign: "center" }}>
                      No activity records available.
                    </div>
                  )}
                </section>
              )}
            </main>

            {/* 3. FIXED FOOTER */}
            <footer className="lead-drawer-footer">
              <button
                type="button"
                onClick={() => {
                  if (onEditLead && lead) {
                    onEditLead(lead);
                  }
                }}
                className="lead-drawer-edit-btn"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit lead</span>
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
