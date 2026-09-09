"use client";

import React, { useState, useEffect } from "react";
import { X, Upload, AlertCircle } from "lucide-react";

interface AddLeadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  identity: { id: string; name: string | null; email: string; role: string };
}

export default function AddLeadDrawer({ isOpen, onClose, onSuccess, identity }: AddLeadDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    contactNumber: "",
    email: "",
    companyName: "",
    status: "NEW",
    assignedUserId: identity.id, // default to self
  });

  const [managedUsers, setManagedUsers] = useState<any[]>([]);

  useEffect(() => {
    // Only admins can assign leads, fetch managed users
    if (identity.role === "ADMIN" && isOpen) {
      fetch("/api/admin/managed-users")
        .then(res => res.json())
        .then(data => {
          if (data.users) setManagedUsers(data.users);
        })
        .catch(err => console.error("Failed to fetch users", err));
    }
  }, [identity.role, isOpen]);

  // Duplicate Check logic could be added here on formData.contactNumber debounce

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          source: "MANUAL"
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create lead");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-[var(--bg-color)] shadow-2xl flex flex-col border-l border-[var(--border-color)] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold">Add New Lead</h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--hover-bg)] rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-start space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Profile Picture Upload (Placeholder for now) */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-[var(--border-color)] bg-[var(--input-bg)] flex flex-col items-center justify-center text-[var(--text-muted)] hover:text-blue-500 hover:border-blue-500 transition-colors cursor-pointer group">
              <Upload className="w-6 h-6 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs">Upload</span>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-sm text-[var(--text-muted)] uppercase tracking-wider">General Information</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">Lead Name *</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. John Doe"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Contact Number *</label>
              <input 
                type="tel" 
                required
                value={formData.contactNumber}
                onChange={e => setFormData({ ...formData, contactNumber: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. +1234567890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Email Address</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Company</label>
              <input 
                type="text" 
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. Acme Corp"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
            <h3 className="font-medium text-sm text-[var(--text-muted)] uppercase tracking-wider">Pipeline Status</h3>
            
            <div>
              <label className="block text-sm font-medium mb-1">Stage</label>
              <select 
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="INTERESTED">Interested</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
            </div>

            {identity.role === "ADMIN" && (
              <div>
                <label className="block text-sm font-medium mb-1">Assigned To</label>
                <select 
                  value={formData.assignedUserId}
                  onChange={e => setFormData({ ...formData, assignedUserId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value={identity.id}>Myself ({identity.name})</option>
                  {managedUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} (Sub-User)</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pb-10"></div>
        </form>

        <div className="p-4 border-t border-[var(--border-color)] flex space-x-3 bg-[var(--card-bg)]">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border-color)] font-medium hover:bg-[var(--hover-bg)] transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}
