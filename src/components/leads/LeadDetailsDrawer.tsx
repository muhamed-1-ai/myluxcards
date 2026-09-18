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
    // Persist in localStorage if applicable
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
  const leadName = lead?.name || "Lead Details";
  const avatarLetter = leadName.trim().charAt(0).toUpperCase() || "L";
  const companyName = lead?.companyName || null;
  const stage = (lead?.stage || lead?.status || "NEW").toUpperCase();

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return "₹0";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
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
      return {
        label: `DUE TODAY ${timeStr}`,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200/80",
        iconClass: "text-amber-600",
      };
    } else if (isOverdue) {
      return {
        label: `OVERDUE ${fuDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80",
        iconClass: "text-rose-600",
      };
    } else {
      return {
        label: `UPCOMING ${fuDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} ${timeStr}`,
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200/80",
        iconClass: "text-blue-600",
      };
    }
  };

  const followUpPill = getFollowUpStatusPill(lead?.nextFollowUp);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dark Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container (Scoped White Surface matching Screenshots 4 & 5) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Lead details for ${leadName}`}
        className="relative w-full max-w-[520px] h-full bg-white shadow-2xl flex flex-col font-sans text-slate-900 text-sm overflow-hidden z-50"
      >
        {/* Loading Shell State */}
        {loading && (
          <div className="flex-1 flex flex-col bg-white">
            {/* Header Skeleton */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full bg-slate-200 animate-pulse" />
                <div className="space-y-2">
                  <div className="w-24 h-3 bg-slate-200 rounded animate-pulse" />
                  <div className="w-40 h-5 bg-slate-200 rounded animate-pulse" />
                  <div className="w-16 h-4 bg-slate-200 rounded-full animate-pulse" />
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body Skeleton */}
            <div className="flex-1 p-6 space-y-4">
              <div className="h-28 bg-slate-100/80 rounded-2xl animate-pulse" />
              <div className="h-24 bg-slate-100/80 rounded-2xl animate-pulse" />
              <div className="h-20 bg-slate-100/80 rounded-2xl animate-pulse" />
              <div className="h-44 bg-slate-100/80 rounded-2xl animate-pulse" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-base">Failed to load lead</h3>
              <p className="text-slate-500 text-xs max-w-xs">{error}</p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={fetchLeadDetails}
                className="inline-flex items-center px-4 py-2 bg-slate-900 text-white rounded-xl font-medium text-xs hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-medium text-xs hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Full Drawer Content when Loaded */}
        {!loading && !error && lead && (
          <>
            {/* 1. FIXED HEADER */}
            <header className="flex-shrink-0 bg-white border-b border-slate-100 p-5 md:p-6 space-y-4">
              {/* Top Identity Row */}
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3.5 pr-4 min-w-0">
                  {/* Initials Avatar */}
                  {lead.profileImage ? (
                    <img
                      src={lead.profileImage}
                      alt={leadName}
                      className="w-14 h-14 rounded-full object-cover shadow-sm border border-slate-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-violet-600 text-white font-bold text-xl flex items-center justify-center shadow-sm flex-shrink-0">
                      {avatarLetter}
                    </div>
                  )}

                  {/* Title & Stage */}
                  <div className="space-y-0.5 min-w-0">
                    <span className="inline-block text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                      LEAD DETAILS
                    </span>
                    <h2 className="text-xl md:text-[22px] font-bold text-slate-900 leading-snug break-words">
                      {leadName}
                    </h2>
                    <div className="pt-0.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wide">
                        {companyName || stage || "LOB"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center space-x-1 flex-shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={handleToggleStar}
                    title={isStarred ? "Starred lead" : "Star lead"}
                    className="p-2 text-slate-400 hover:text-amber-500 rounded-full transition-colors focus:outline-none"
                  >
                    <Star
                      className={`w-5 h-5 ${isStarred ? "text-amber-400 fill-amber-400" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close drawer"
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-full transition-colors focus:outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Segmented Tabs (Overview / Activity) */}
              <nav aria-label="Lead Detail Tabs" className="pt-1">
                <div className="flex p-1 bg-slate-100/90 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all ${
                      activeTab === "overview"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all ${
                      activeTab === "activity"
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Activity
                  </button>
                </div>
              </nav>
            </header>

            {/* 2. FLEXIBLE SCROLLABLE CONTENT AREA */}
            <main className="flex-1 overflow-y-auto min-h-0 p-5 md:p-6 space-y-4 bg-white">
              {activeTab === "overview" && (
                <>
                  {/* CARD 1: CONTACT */}
                  <section className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-3.5 shadow-2xs">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      CONTACT
                    </h3>
                    <div className="space-y-3 text-sm">
                      {/* Email */}
                      {lead.email ? (
                        <div className="flex items-start space-x-3">
                          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-slate-800 hover:text-emerald-600 font-medium break-all transition-colors"
                          >
                            {lead.email}
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-start space-x-3 text-slate-400">
                          <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>No email provided</span>
                        </div>
                      )}

                      {/* Phone & Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0">
                          <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {lead.contactNumber || "No phone"}
                          </span>
                        </div>

                        {lead.contactNumber && (
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {/* WhatsApp Button */}
                            <a
                              href={`https://wa.me/${lead.contactNumber.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Message on WhatsApp"
                              className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                            {/* Call Button */}
                            <a
                              href={`tel:${lead.contactNumber}`}
                              className="inline-flex items-center px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors gap-1.5"
                            >
                              <Phone className="w-3.5 h-3.5 fill-current" />
                              <span>Call</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Business / Company */}
                      <div className="flex items-start space-x-3">
                        <Building className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 font-medium">
                          {companyName || "Business"}
                        </span>
                      </div>

                      {/* Address / Location */}
                      {lead.address ? (
                        <div className="flex items-start space-x-3">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-700 font-medium leading-relaxed">
                            {lead.address}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start space-x-3 text-slate-400">
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>No address recorded</span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* CARD 2: NEXT FOLLOW-UP */}
                  <section className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        NEXT FOLLOW-UP
                      </h3>
                      {lead.nextFollowUp && (
                        <button
                          type="button"
                          onClick={() => setIsScheduling(true)}
                          className="text-xs font-semibold text-emerald-600 hover:underline"
                        >
                          Reschedule
                        </button>
                      )}
                    </div>

                    {/* Inline Follow-up Scheduler Form */}
                    {isScheduling ? (
                      <form onSubmit={handleScheduleFollowUpSubmit} className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Date &amp; Time</label>
                          <input
                            type="datetime-local"
                            required
                            value={scheduledDateTime}
                            onChange={(e) => setScheduledDateTime(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Follow-up Type</label>
                          <select
                            value={followUpType}
                            onChange={(e) => setFollowUpType(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="CALL">Call</option>
                            <option value="MEETING">Meeting</option>
                            <option value="EMAIL">Email</option>
                            <option value="WHATSAPP">WhatsApp</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600">Note / Agenda</label>
                          <input
                            type="text"
                            placeholder="Enter follow-up details..."
                            value={followUpNote}
                            onChange={(e) => setFollowUpNote(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {schedulingError && (
                          <p className="text-xs text-rose-600 font-medium">{schedulingError}</p>
                        )}

                        <div className="flex items-center space-x-2 pt-1">
                          <button
                            type="submit"
                            disabled={schedulingLoading}
                            className="px-3.5 py-1.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {schedulingLoading ? "Saving..." : "Save Follow-up"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsScheduling(false)}
                            className="px-3.5 py-1.5 border border-slate-200 text-slate-600 font-semibold text-xs rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : lead.nextFollowUp && followUpPill ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border ${followUpPill.badgeClass}`}
                          >
                            <Calendar className={`w-3.5 h-3.5 mr-1.5 ${followUpPill.iconClass}`} />
                            {followUpPill.label}
                          </span>
                          {lead.contactNumber && (
                            <a
                              href={`https://wa.me/${lead.contactNumber.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors"
                              title="Message lead on WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        {lead.nextFollowUp.note && (
                          <div className="bg-slate-100/70 p-3 rounded-xl text-xs text-slate-700 leading-relaxed break-words font-medium">
                            {lead.nextFollowUp.note}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500 font-medium text-xs">
                          No follow-up scheduled
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsScheduling(true)}
                          className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-lg gap-1.5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Schedule follow-up</span>
                        </button>
                      </div>
                    )}
                  </section>

                  {/* CARD 3: REMARKS */}
                  <section className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      REMARKS
                    </h3>
                    <div className="bg-slate-100/70 p-3.5 rounded-xl text-sm text-slate-700 leading-relaxed break-words font-medium min-h-[44px] flex items-center">
                      {lead.lastRemark ? lead.lastRemark : "No remarks available."}
                    </div>
                  </section>

                  {/* CARD 4: ADVANCED FIELDS */}
                  <section className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      ADVANCED FIELDS
                    </h3>
                    {lead.customFields && Object.keys(lead.customFields).length > 0 ? (
                      <div className="space-y-2 text-xs">
                        {Object.entries(lead.customFields).map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                            <span className="text-slate-500 font-medium">{k}</span>
                            <span className="text-slate-900 font-bold break-all">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs font-medium">
                        No custom fields configured.
                      </div>
                    )}
                  </section>

                  {/* CARD 5: PIPELINE */}
                  <section className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      PIPELINE
                    </h3>
                    <div className="space-y-2.5 text-xs">
                      {/* Assigned to */}
                      <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium">Assigned to</span>
                        <div className="flex items-center space-x-2 text-right">
                          <div>
                            <div className="font-bold text-slate-900">
                              {lead.assignedUserName || "Unassigned"}
                            </div>
                            {lead.assignedUserEmail && (
                              <div className="text-[10px] text-slate-400">
                                {lead.assignedUserEmail}
                              </div>
                            )}
                          </div>
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                            {(lead.assignedUserName || "U").charAt(0).toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Life cycle / Stage */}
                      <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium">Life cycle</span>
                        <span className="font-bold text-slate-900 lowercase">{stage}</span>
                      </div>

                      {/* Source */}
                      <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium">Source</span>
                        <span className="font-bold text-slate-900 lowercase">
                          {lead.source || "manual"}
                        </span>
                      </div>

                      {/* Created */}
                      <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium">Created</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(lead.createdAt || lead.firstSubmittedAt)}
                        </span>
                      </div>

                      {/* Last updated */}
                      <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-medium">Last updated</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(lead.updatedAt)}
                        </span>
                      </div>

                      {/* Created by */}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Created by</span>
                        <span className="font-bold text-slate-900 lowercase">
                          {lead.createdByName || "system"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* CARD 6: REVENUE */}
                  <section className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 md:p-5 space-y-2 shadow-2xs">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      REVENUE
                    </h3>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 font-medium">Expected</div>
                      <div className="text-2xl font-bold text-slate-900 flex items-center space-x-1.5">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                          ₹
                        </span>
                        <span>{formatCurrency(lead.expectedRevenue || lead.totalAmount)}</span>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {activeTab === "activity" && (
                <section className="space-y-4">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    ACTIVITY LOG
                  </h3>
                  {lead.activities && lead.activities.length > 0 ? (
                    <div className="space-y-3">
                      {lead.activities.map((act) => (
                        <div
                          key={act.id}
                          className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                              {act.type}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {formatDate(act.occurredAt)}
                            </span>
                          </div>
                          {act.description && (
                            <p className="text-slate-700 font-medium pt-1 leading-relaxed">
                              {act.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center text-slate-400 text-xs">
                      No activity records found for this lead.
                    </div>
                  )}
                </section>
              )}
            </main>

            {/* 3. FIXED FOOTER (Dark Button matching Screenshots 4 & 5) */}
            <footer className="flex-shrink-0 bg-white border-t border-slate-200/80 p-4 md:p-5 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => {
                  if (onEditLead && lead) {
                    onEditLead(lead);
                  }
                }}
                className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-sm h-12 rounded-xl flex items-center justify-center space-x-2 shadow-md transition-all active:scale-[0.99] focus:outline-none"
              >
                <Edit2 className="w-4 h-4 text-white" />
                <span>Edit lead</span>
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
