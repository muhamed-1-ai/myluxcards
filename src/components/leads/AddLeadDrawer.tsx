"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Upload, 
  AlertCircle, 
  User, 
  Phone, 
  Mail, 
  Building2, 
  MapPin, 
  Calendar, 
  Clock, 
  MessageSquare, 
  Plus, 
  Trash2, 
  CreditCard, 
  Package, 
  CheckCircle2
} from "lucide-react";

interface AddLeadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  identity: { id: string; name: string | null; email: string; role: string };
}

interface SelectedProduct {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

const COUNTRY_CODES = [
  { code: "+91", country: "IN", flag: "🇮🇳", label: "India (+91)" },
  { code: "+1", country: "US", flag: "🇺🇸", label: "USA (+1)" },
  { code: "+44", country: "GB", flag: "🇬🇧", label: "UK (+44)" },
  { code: "+971", country: "AE", flag: "🇦🇪", label: "UAE (+971)" },
  { code: "+65", country: "SG", flag: "🇸🇬", label: "Singapore (+65)" },
];

export default function AddLeadDrawer({ isOpen, onClose, onSuccess, identity }: AddLeadDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  // Form State
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    address: "",
    source: "MANUAL",
    status: "NEW",
    assignedUserId: identity.id,
    remark: "",
    followUpDate: "",
    followUpNote: "",
    followUpType: "Call",
    advanceAmount: 0,
  });

  // Products State
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState("");
  const [manualTotalAmount, setManualTotalAmount] = useState<number | "">(0);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setFormData({
        name: "",
        email: "",
        companyName: "",
        address: "",
        source: "MANUAL",
        status: "NEW",
        assignedUserId: identity.id,
        remark: "",
        followUpDate: "",
        followUpNote: "",
        followUpType: "Call",
        advanceAmount: 0,
      });
      setPhoneNumber("");
      setProfileImage(null);
      setSelectedProducts([]);
      setManualTotalAmount(0);
      setError(null);

      // Fetch managed users if admin
      if (identity.role === "ADMIN" || identity.role === "SUPER_ADMIN") {
        fetch("/api/admin/managed-users")
          .then(res => res.json())
          .then(data => {
            if (data.users) setManagedUsers(data.users);
          })
          .catch(err => console.error("Failed to fetch managed users", err));
      }

      // Fetch available products
      fetch("/api/admin/products")
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setAvailableProducts(data.data);
          } else {
            // Fallback default products
            setAvailableProducts([
              { id: "prod-1", name: "ZAPPIT NFC Metal Card", price_minor: 199900 },
              { id: "prod-2", name: "ZAPPIT Smart Card - PVC", price_minor: 99900 },
              { id: "prod-3", name: "Custom Branded NFC Tag", price_minor: 49900 },
            ]);
          }
        })
        .catch(() => {
          setAvailableProducts([
            { id: "prod-1", name: "ZAPPIT NFC Metal Card", price_minor: 199900 },
            { id: "prod-2", name: "ZAPPIT Smart Card - PVC", price_minor: 99900 },
            { id: "prod-3", name: "Custom Branded NFC Tag", price_minor: 49900 },
          ]);
        });
    }
  }, [identity.id, identity.role, isOpen]);

  // Product Calculations
  const calculatedTotalAmount = selectedProducts.length > 0
    ? selectedProducts.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    : (typeof manualTotalAmount === "number" ? manualTotalAmount : 0);

  const balanceAmount = Math.max(0, calculatedTotalAmount - Number(formData.advanceAmount || 0));

  const handleAddProduct = () => {
    if (!selectedProductIdToAdd) return;
    const prod = availableProducts.find(p => p.id === selectedProductIdToAdd);
    if (!prod) return;

    const unitPrice = prod.price_minor ? Math.round(prod.price_minor / 100) : 1000;
    const existingIndex = selectedProducts.findIndex(p => p.id === prod.id);

    if (existingIndex >= 0) {
      const updated = [...selectedProducts];
      updated[existingIndex].quantity += 1;
      setSelectedProducts(updated);
    } else {
      setSelectedProducts(prev => [
        ...prev,
        { id: prod.id, name: prod.name || prod.title || "Custom Product", unitPrice, quantity: 1 }
      ]);
    }
    setSelectedProductIdToAdd("");
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      setSelectedProducts(prev => prev.filter(p => p.id !== id));
    } else {
      setSelectedProducts(prev => prev.map(p => p.id === id ? { ...p, quantity: qty } : p));
    }
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file size must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError("Lead Name is required.");
      setLoading(false);
      return;
    }

    if (!phoneNumber.trim()) {
      setError("Mobile Number is required.");
      setLoading(false);
      return;
    }

    const fullContactNumber = `${countryCode} ${phoneNumber.trim()}`;

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          contactNumber: fullContactNumber,
          email: formData.email.trim() || undefined,
          companyName: formData.companyName.trim() || undefined,
          address: formData.address.trim() || undefined,
          assignedUserId: formData.assignedUserId,
          status: formData.status,
          source: formData.source,
          profileImage: profileImage || undefined,
          remark: formData.remark.trim() || undefined,
          followUpDate: formData.followUpDate || undefined,
          followUpNote: formData.followUpNote.trim() || undefined,
          followUpType: formData.followUpType,
          totalAmount: calculatedTotalAmount,
          advanceAmount: Number(formData.advanceAmount || 0),
          products: selectedProducts,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create lead");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create lead.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Slide-over Drawer Container */}
      <div className="relative w-full max-w-2xl h-full bg-[var(--surface,#FFFFFF)] shadow-2xl flex flex-col border-l border-[var(--border-color,#E2E8F0)] overflow-hidden font-sans text-[var(--text-primary,#0F172A)]">
        
        {/* Header Section */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-color,#E2E8F0)] bg-[var(--bg-secondary,#F8FAFC)]">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-extrabold tracking-wider uppercase mb-1">
              <span>NEW LEAD</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary,#0F172A)] tracking-tight">Add a new pipeline opportunity</h2>
            <p className="text-xs text-[var(--text-secondary,#64748B)] mt-0.5">
              Capture general lead details, follow-up cadence, and any active advanced fields defined by the workspace.
            </p>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 hover:bg-[var(--border-color,#E2E8F0)]/40 text-[var(--text-secondary,#64748B)] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl flex items-start space-x-3 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Profile Image */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] tracking-wider uppercase">Profile Image</h3>
            <div className="flex items-center space-x-5">
              <div className="relative w-20 h-20 rounded-full bg-[var(--input-bg,#F8FAFC)] border-2 border-[var(--border-color,#E2E8F0)] flex items-center justify-center text-[var(--text-secondary,#64748B)] overflow-hidden shadow-inner">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-[var(--text-secondary,#64748B)]" />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="inline-flex items-center space-x-2 px-4 py-2 bg-[var(--surface,#FFFFFF)] border border-[var(--border-color,#E2E8F0)] hover:bg-[var(--bg-secondary,#F8FAFC)] text-[var(--text-primary,#0F172A)] text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition-all">
                  <Upload className="w-3.5 h-3.5 text-[var(--text-secondary,#64748B)]" />
                  <span>Upload Image</span>
                  <input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp" 
                    onChange={handleImageUpload}
                    className="hidden" 
                  />
                </label>
                <div className="text-[11px] text-[var(--text-secondary,#64748B)]">Supported formats: JPG, PNG, WEBP (Max 5MB)</div>
              </div>
            </div>
          </div>

          {/* Section 2: General Contact Information */}
          <div className="space-y-4 pt-4 border-t border-[var(--border-color,#E2E8F0)]">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] tracking-wider uppercase">General Information</h3>
              <p className="text-xs text-[var(--text-secondary,#64748B)]">Core contact details, company, address, source, and owner.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Lead Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Lead Name *</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Mobile with Country Selector */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Mobile Number *</label>
                <div className="flex space-x-2">
                  <select 
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    className="px-2.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-semibold text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code} className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input 
                    type="tel" 
                    required
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="9876543210"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Company Name</label>
                <input 
                  type="text" 
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Acme Inc."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Source */}
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Source</label>
                <select 
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-semibold text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="MANUAL" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Manual Entry</option>
                  <option value="PROFILE_SHARE_DETAILS" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Share Details</option>
                  <option value="NFC" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">NFC Tap</option>
                  <option value="QR" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">QR Code Scan</option>
                  <option value="WEBSITE" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Website</option>
                  <option value="REFERRAL" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Referral</option>
                  <option value="CAMPAIGN" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Campaign</option>
                  <option value="DIRECT" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Direct Contact</option>
                </select>
              </div>

              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Address</label>
                <textarea 
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter full office/contact address..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Assigned User */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Assigned User / Owner</label>
                <select 
                  value={formData.assignedUserId}
                  onChange={e => setFormData({ ...formData, assignedUserId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-semibold text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={identity.id} className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Myself ({identity.name || identity.email})</option>
                  {managedUsers.map(u => (
                    <option key={u.id} value={u.id} className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">{u.name || u.email} (Sub-User)</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Lead Life Cycle Stage */}
          <div className="space-y-3 pt-4 border-t border-[var(--border-color,#E2E8F0)]">
            <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] tracking-wider uppercase">Lead Life Cycle Stage</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "NEW", label: "New" },
                { key: "CONTACTED", label: "Contacted" },
                { key: "INTERESTED", label: "Interested" },
                { key: "FOLLOW_UP", label: "Follow Up" },
                { key: "QUALIFIED", label: "Qualified" },
                { key: "PROPOSAL", label: "Proposal" },
                { key: "WON", label: "Won" },
                { key: "LOST", label: "Lost" },
              ].map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setFormData({ ...formData, status: s.key })}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border ${
                    formData.status === s.key 
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" 
                      : "bg-[var(--input-bg,#F8FAFC)] border-[var(--border-color,#E2E8F0)] text-[var(--text-primary,#0F172A)] hover:bg-[var(--bg-secondary,#F8FAFC)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Remarks History */}
          <div className="space-y-2 pt-4 border-t border-[var(--border-color,#E2E8F0)]">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] tracking-wider uppercase">Remarks History</h3>
              <p className="text-xs text-[var(--text-secondary,#64748B)]">Initial notes about this lead.</p>
            </div>
            <div className="relative">
              <textarea 
                rows={3}
                maxLength={1000}
                value={formData.remark}
                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                placeholder="Enter initial remarks or conversation summary..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <div className="text-[10px] text-[var(--text-secondary,#64748B)] text-right mt-1 font-mono">
                {formData.remark.length}/1000
              </div>
            </div>
          </div>

          {/* Section 5: Follow-up */}
          <div className="space-y-4 pt-4 border-t border-[var(--border-color,#E2E8F0)]">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] tracking-wider uppercase">Follow-up</h3>
              <p className="text-xs text-[var(--text-secondary,#64748B)]">Keep the next touchpoint visible directly in the leads table.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Next Follow-up</label>
                <input 
                  type="datetime-local"
                  value={formData.followUpDate}
                  onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Follow-up Type</label>
                <select 
                  value={formData.followUpType}
                  onChange={e => setFormData({ ...formData, followUpType: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-semibold text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500"
                >
                  <option value="Call" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Call</option>
                  <option value="WhatsApp" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">WhatsApp</option>
                  <option value="Email" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Email</option>
                  <option value="Meeting" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Meeting</option>
                  <option value="Other" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Follow-up Note</label>
                <input 
                  type="text"
                  value={formData.followUpNote}
                  onChange={e => setFormData({ ...formData, followUpNote: e.target.value })}
                  placeholder="Call back regarding proposal..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-medium text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Product Selection */}
          <div className="space-y-4 pt-4 border-t border-[var(--border-color,#E2E8F0)]">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] tracking-wider uppercase">Product Selection</h3>
              <p className="text-xs text-[var(--text-secondary,#64748B)]">Selected products calculate the total amount automatically.</p>
            </div>

            {/* Product Selector Controls */}
            <div className="flex items-center space-x-2">
              <select 
                value={selectedProductIdToAdd}
                onChange={e => setSelectedProductIdToAdd(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-semibold text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500"
              >
                <option value="" className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">Select a product to add...</option>
                {availableProducts.map(p => (
                  <option key={p.id} value={p.id} className="bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)]">
                    {p.name || p.title} (₹{Math.round((p.price_minor || 100000) / 100)})
                  </option>
                ))}
              </select>

              <button 
                type="button"
                onClick={handleAddProduct}
                disabled={!selectedProductIdToAdd}
                className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Selected Products Table / List */}
            {selectedProducts.length > 0 && (
              <div className="border border-[var(--border-color,#E2E8F0)] rounded-xl overflow-hidden bg-[var(--input-bg,#F8FAFC)]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-secondary,#F8FAFC)] text-[var(--text-secondary,#64748B)] font-bold border-b border-[var(--border-color,#E2E8F0)]">
                      <th className="px-4 py-2.5">Product Name</th>
                      <th className="px-4 py-2.5">Qty</th>
                      <th className="px-4 py-2.5">Unit Price</th>
                      <th className="px-4 py-2.5">Subtotal</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color,#E2E8F0)]/60 font-medium">
                    {selectedProducts.map(p => (
                      <tr key={p.id} className="hover:bg-[var(--surface,#FFFFFF)] transition-colors">
                        <td className="px-4 py-2.5 font-bold text-[var(--text-primary,#0F172A)]">{p.name}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center space-x-1">
                            <button 
                              type="button" 
                              onClick={() => handleUpdateQuantity(p.id, p.quantity - 1)}
                              className="w-6 h-6 rounded border border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] flex items-center justify-center font-bold hover:bg-[var(--bg-secondary,#F8FAFC)]"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-bold text-[var(--text-primary,#0F172A)]">{p.quantity}</span>
                            <button 
                              type="button" 
                              onClick={() => handleUpdateQuantity(p.id, p.quantity + 1)}
                              className="w-6 h-6 rounded border border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] flex items-center justify-center font-bold hover:bg-[var(--bg-secondary,#F8FAFC)]"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-primary,#0F172A)]">₹{p.unitPrice}</td>
                        <td className="px-4 py-2.5 font-bold text-[var(--text-primary,#0F172A)]">₹{p.unitPrice * p.quantity}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveProduct(p.id)}
                            className="p-1 text-[var(--text-secondary,#64748B)] hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 7: Payment Information */}
          <div className="space-y-4 pt-4 border-t border-[var(--border-color,#E2E8F0)]">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-secondary,#64748B)] tracking-wider uppercase">Payment Information</h3>
              <p className="text-xs text-[var(--text-secondary,#64748B)]">Agreed revenue terms, advance payments, and outstanding balances.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Total Amount (₹)</label>
                <input 
                  type="number"
                  min={0}
                  readOnly={selectedProducts.length > 0}
                  value={selectedProducts.length > 0 ? calculatedTotalAmount : manualTotalAmount}
                  onChange={e => {
                    if (selectedProducts.length === 0) {
                      const val = e.target.value === "" ? "" : Math.max(0, Number(e.target.value));
                      setManualTotalAmount(val);
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--bg-secondary,#F8FAFC)] text-xs font-bold text-[var(--text-primary,#0F172A)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Advance Payments (₹)</label>
                <input 
                  type="number"
                  min={0}
                  value={formData.advanceAmount}
                  onChange={e => setFormData({ ...formData, advanceAmount: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--input-bg,#F8FAFC)] text-xs font-bold text-[var(--text-primary,#0F172A)] focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary,#0F172A)] mb-1">Balance Amount (₹)</label>
                <input 
                  type="number"
                  readOnly
                  value={balanceAmount}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-black text-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="h-12" />
        </form>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-[var(--border-color,#E2E8F0)] bg-[var(--bg-secondary,#F8FAFC)] flex items-center justify-end space-x-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-[var(--border-color,#E2E8F0)] bg-[var(--surface,#FFFFFF)] hover:bg-[var(--bg-secondary,#F8FAFC)] text-xs font-bold text-[var(--text-primary,#0F172A)] shadow-sm transition-all"
          >
            Cancel
          </button>
          
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-sm shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Lead...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Create Lead</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
