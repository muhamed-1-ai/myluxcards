"use client";

import React, { useState, useEffect } from "react";
import { X, Phone, Mail, Clock, CheckCircle, MessageSquare, PlusCircle } from "lucide-react";

interface LeadDetailsDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function LeadDetailsDrawer({ leadId, onClose, onUpdated }: LeadDetailsDrawerProps) {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "notes" | "timeline">("details");
  const [newNote, setNewNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchLeadDetails = () => {
    if (!leadId) {
      setLead(null);
      return;
    }
    setLoading(true);
    fetch(`/api/leads/${leadId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.lead) setLead(data.lead);
      })
      .catch((err) => console.error("Failed to fetch lead", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  const handleStageChange = async (newStage: string) => {
    if (!leadId || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          contactNumber: lead.contactNumber,
          status: newStage,
        }),
      });
      if (res.ok) {
        setLead((prev: any) => ({ ...prev, status: newStage, stage: newStage }));
        onUpdated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !newNote.trim() || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name,
          contactNumber: lead.contactNumber,
          note: newNote.trim(),
        }),
      });
      if (res.ok) {
        setNewNote("");
        fetchLeadDetails();
        onUpdated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  if (!leadId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-[var(--bg-color)] shadow-2xl flex flex-col border-l border-[var(--border-color)] overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[var(--text-muted)] animate-pulse">Loading lead details...</div>
          </div>
        ) : lead ? (
          <>
            {/* Header / Profile */}
            <div className="p-6 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-4">
                  {lead.profileImage ? (
                    <img src={lead.profileImage} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold">{lead.name}</h2>
                    <p className="text-sm text-[var(--text-muted)]">{lead.companyName || "No Company"}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-[var(--hover-bg)] rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Stage selector dropdown */}
              <div className="mt-3 flex items-center space-x-2">
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase">Stage:</label>
                <select
                  value={lead.status || lead.stage || "NEW"}
                  onChange={(e) => handleStageChange(e.target.value)}
                  disabled={updating}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-xs font-bold text-blue-400 focus:outline-none"
                >
                  <option value="NEW">New</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="INTERESTED">Interested</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="CONVERTED">Converted</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>

              {/* Quick Actions */}
              <div className="flex space-x-2 mt-4">
                {lead.contactNumber && (
                  <a
                    href={`tel:${lead.contactNumber}`}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-[var(--hover-bg)] rounded-lg hover:bg-blue-600 hover:text-white transition-colors text-sm font-medium"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </a>
                )}
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-[var(--hover-bg)] rounded-lg hover:bg-blue-600 hover:text-white transition-colors text-sm font-medium"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </a>
                )}
                <button
                  onClick={() => handleStageChange("CONVERTED")}
                  disabled={updating || lead.status === "CONVERTED"}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-600 hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Convert
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--card-bg)]">
              <button
                onClick={() => setActiveTab("details")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "details" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "notes" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                Internal Notes
              </button>
              <button
                onClick={() => setActiveTab("timeline")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "timeline" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-muted)]"
                }`}
              >
                Timeline
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "details" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Contact Info</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Phone</span>
                        <span className="font-medium">{lead.contactNumber}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Email</span>
                        <span className="font-medium">{lead.email || "-"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Company</span>
                        <span className="font-medium">{lead.companyName || "-"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Source</span>
                        <span className="font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-semibold">{lead.source || "PROFILE_SHARE_DETAILS"}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Submission Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Submissions</span>
                        <span className="font-medium">{lead.submissionCount || 1} time(s)</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">First Captured</span>
                        <span className="font-medium">{new Date(lead.createdAt || lead.firstSubmittedAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notes" && (
                <div className="space-y-4">
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={3}
                      placeholder="Add an internal CRM note (private to profile owner)..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      className="w-full p-3 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={updating || !newNote.trim()}
                      className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-xs disabled:opacity-50"
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                      Save Internal Note
                    </button>
                  </form>

                  {lead.lastRemark && (
                    <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-xs space-y-1">
                      <span className="text-[var(--text-muted)] font-semibold">Latest Remark:</span>
                      <p className="text-[var(--text-color)]">{lead.lastRemark}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "timeline" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] text-xs flex items-center justify-between">
                    <div>
                      <strong className="block text-[var(--text-color)]">Captured via {lead.source || "SHARE_DETAILS"}</strong>
                      <span className="text-[var(--text-muted)]">{new Date(lead.createdAt || Date.now()).toLocaleString()}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">CREATED</span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
