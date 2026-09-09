"use client";

import React, { useState, useEffect } from "react";
import { X, Phone, Mail, Clock, CheckCircle, MessageSquare } from "lucide-react";

interface LeadDetailsDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function LeadDetailsDrawer({ leadId, onClose, onUpdated }: LeadDetailsDrawerProps) {
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "timeline">("details");

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      return;
    }
    
    setLoading(true);
    fetch(`/api/leads/${leadId}`)
      .then(res => res.json())
      .then(data => {
        if (data.lead) setLead(data.lead);
      })
      .catch(err => console.error("Failed to fetch lead", err))
      .finally(() => setLoading(false));
  }, [leadId]);

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
                    <img src={lead.profileImage} alt="" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold">{lead.name}</h2>
                    <p className="text-sm text-[var(--text-muted)]">{lead.companyName || "No Company"}</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {lead.status}
                    </span>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-[var(--hover-bg)] rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex space-x-2 mt-4">
                <button className="flex-1 flex items-center justify-center px-4 py-2 bg-[var(--hover-bg)] rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                  <Phone className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Call</span>
                </button>
                <button className="flex-1 flex items-center justify-center px-4 py-2 bg-[var(--hover-bg)] rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                  <Mail className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Email</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border-color)] bg-[var(--card-bg)]">
              <button 
                onClick={() => setActiveTab("details")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "details" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-color)]"}`}
              >
                Details
              </button>
              <button 
                onClick={() => setActiveTab("timeline")}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "timeline" ? "border-blue-500 text-blue-500" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-color)]"}`}
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
                        <span className="text-[var(--text-muted)]">Source</span>
                        <span className="font-medium">{lead.source}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">System</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Assigned To</span>
                        <span className="font-medium">{lead.assignedUserId ? "Sub-User" : "Owner"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Created</span>
                        <span className="font-medium">{new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "timeline" && (
                <div className="space-y-4">
                  <div className="text-sm text-[var(--text-muted)] text-center py-8">
                    Timeline and Activity logs will appear here.
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
