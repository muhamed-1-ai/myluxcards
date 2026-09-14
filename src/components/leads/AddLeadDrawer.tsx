"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Upload, 
  AlertCircle, 
  User, 
  Plus, 
  Trash2, 
  Save,
  ChevronDown
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
  { code: "+91", country: "IN", flag: "🇮🇳", label: "IN" },
  { code: "+1", country: "US", flag: "🇺🇸", label: "US" },
  { code: "+44", country: "GB", flag: "🇬🇧", label: "UK" },
  { code: "+971", country: "AE", flag: "🇦🇪", label: "UAE" },
  { code: "+65", country: "SG", flag: "🇸🇬", label: "SG" },
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
    lifecycleStage: "Lead",
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

  // Lock background body scroll when drawer is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
        lifecycleStage: "Lead",
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
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Translucent Backdrop Overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" 
        onClick={onClose} 
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-[720px] h-full bg-slate-50/70 dark:bg-[#070D18] shadow-2xl flex flex-col overflow-hidden font-sans border-l border-slate-200 dark:border-slate-800/80 z-10 text-slate-900 dark:text-slate-100 transition-colors animate-in slide-in-from-right duration-300">
        
        {/* 1. FIXED HEADER */}
        <div className="flex-shrink-0 flex items-start justify-between px-6 sm:px-7 pt-7 pb-5 bg-white dark:bg-[#0D1726] border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-20 shadow-sm">
          <div className="space-y-1.5 pr-6">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold tracking-wider uppercase mb-1">
              <span>✨</span>
              <span>NEW LEAD</span>
            </div>
            <h2 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15] font-sans">
              Add a new pipeline opportunity
            </h2>
            <p className="text-xs sm:text-[13.5px] font-normal text-slate-500 dark:text-slate-400 leading-relaxed font-sans pt-0.5">
              Capture general lead details, follow-up cadence, and any active advanced fields defined by the workspace.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            aria-label="Close drawer"
            className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center justify-center flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. SCROLLABLE FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 sm:px-7 py-6 space-y-5 sm:space-y-6 pb-28 bg-slate-50/60 dark:bg-[#070D18] font-sans">
          
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-start space-x-3 text-xs sm:text-sm font-medium shadow-sm animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* CARD 1: GENERAL */}
          <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-5">
            
            {/* Section Title & Subtitle */}
            <div>
              <h3 className="text-base sm:text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">General</h3>
              <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                Core contact details, company, address, source, and owner.
              </p>
            </div>

            {/* Profile Image Row */}
            <div className="flex items-center space-x-4 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 text-white font-extrabold text-xl flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md overflow-hidden flex-shrink-0">
                {profileImage ? (
                  <img src={profileImage} alt="Profile preview" className="w-full h-full object-cover" />
                ) : formData.name.trim() ? (
                  <span>{formData.name.trim().charAt(0).toUpperCase()}</span>
                ) : (
                  <User className="w-7 h-7 text-white opacity-90" />
                )}
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex items-center space-x-3">
                  <label className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all">
                    <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Upload Image</span>
                    <input 
                      type="file" 
                      accept="image/jpeg,image/png,image/webp" 
                      onChange={handleImageUpload}
                      className="hidden" 
                    />
                  </label>
                  {profileImage && (
                    <button
                      type="button"
                      onClick={() => setProfileImage(null)}
                      className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                  Supported formats: JPG, PNG, WEBP (Max 5MB)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 sm:gap-y-5 pt-1">
              
              {/* Lead Name * */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Lead Name <span className="text-rose-500 font-bold">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter lead or account name"
                  className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>

              {/* Mobile * */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Mobile <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="flex items-center rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 shadow-sm transition-all overflow-hidden h-11 sm:h-12">
                  <div className="relative flex items-center bg-slate-100/80 dark:bg-slate-800/60 border-r border-slate-200/80 dark:border-slate-700/80 px-3 h-full w-[95px] flex-shrink-0">
                    <select 
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="appearance-none bg-transparent pr-5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer h-full w-full"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          {c.label} {c.code}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 pointer-events-none" />
                  </div>

                  <div className="flex items-center flex-1 h-full px-3.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2 flex-shrink-0">{countryCode}</span>
                    <input 
                      type="tel" 
                      required
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="Mobile Number"
                      className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Email
                </label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="lead@company.com"
                  className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>

              {/* Company Name */}
              <div className="md:col-span-1 space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Company Name
                </label>
                <input 
                  type="text" 
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Acme Pvt Ltd"
                  className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>

              {/* Source */}
              <div className="md:col-span-1 space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Source
                </label>
                <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                  <select 
                    value={formData.source}
                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                    className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                  >
                    <option value="MANUAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Manual Entry</option>
                    <option value="PROFILE_SHARE_DETAILS" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Share Details</option>
                    <option value="NFC" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">NFC Tap</option>
                    <option value="QR" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">QR Code Scan</option>
                    <option value="WEBSITE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Website</option>
                    <option value="REFERRAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Referral</option>
                    <option value="CAMPAIGN" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Campaign</option>
                    <option value="DIRECT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Direct Contact</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Address */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Address
                </label>
                <textarea 
                  rows={3}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, city, state, PIN"
                  className="w-full p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm min-h-[90px] resize-none"
                />
              </div>

              {/* Assigned To & Lead Life Cycle */}
              <div className="md:col-span-1 space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Assigned To
                </label>
                <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                  <select 
                    value={formData.assignedUserId}
                    onChange={e => setFormData({ ...formData, assignedUserId: e.target.value })}
                    className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                  >
                    <option value={identity.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{identity.name || identity.email}</option>
                    {managedUsers.map(u => (
                      <option key={u.id} value={u.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{u.name || u.email}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <div className="md:col-span-1 space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Lead Life Cycle
                </label>
                <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                  <select 
                    value={formData.lifecycleStage}
                    onChange={e => setFormData({ ...formData, lifecycleStage: e.target.value })}
                    className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                  >
                    <option value="Lead" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Lead</option>
                    <option value="Marketing Qualified Lead" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Marketing Qualified Lead</option>
                    <option value="Sales Qualified Lead" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Sales Qualified Lead</option>
                    <option value="Opportunity" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Opportunity</option>
                    <option value="Customer" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Customer</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Stage Dropdown */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Stage
                </label>
                <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                  >
                    <option value="NEW" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">New</option>
                    <option value="CONTACTED" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Contacted</option>
                    <option value="INTERESTED" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Interested</option>
                    <option value="FOLLOW_UP" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Follow Up</option>
                    <option value="QUALIFIED" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Qualified</option>
                    <option value="PROPOSAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Proposal</option>
                    <option value="WON" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Won</option>
                    <option value="LOST" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Lost</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: REMARKS HISTORY */}
          <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">Remarks History</h3>
                <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                  Initial notes about this lead.
                </p>
              </div>
              <span className="font-mono text-xs font-normal text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80">
                {formData.remark.length}/1000
              </span>
            </div>

            <div className="space-y-1.5">
              <textarea 
                rows={4}
                maxLength={1000}
                value={formData.remark}
                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                placeholder="Add specific context, notes from call, or client requirements..."
                className="w-full p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[100px] resize-none shadow-sm"
              />
            </div>
          </div>

          {/* CARD 3: FOLLOW-UP */}
          <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-5">
            <div>
              <h3 className="text-base sm:text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">Follow-up</h3>
              <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                Keep the next touchpoint visible directly in the leads table.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">Next Follow-up</label>
                <input 
                  type="datetime-local"
                  value={formData.followUpDate}
                  onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                  className="w-full h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">Follow-up Type</label>
                <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                  <select 
                    value={formData.followUpType}
                    onChange={e => setFormData({ ...formData, followUpType: e.target.value })}
                    className="w-full h-full px-3.5 appearance-none bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                  >
                    <option value="Call" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Call</option>
                    <option value="WhatsApp" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">WhatsApp</option>
                    <option value="Email" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Email</option>
                    <option value="Meeting" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Meeting</option>
                    <option value="Other" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Other</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">Follow-up Note</label>
                <input 
                  type="text"
                  value={formData.followUpNote}
                  onChange={e => setFormData({ ...formData, followUpNote: e.target.value })}
                  placeholder="Call back regarding proposal..."
                  className="w-full h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* CARD 4: PRODUCT SELECTION */}
          <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-5">
            <div>
              <h3 className="text-base sm:text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">Product Selection</h3>
              <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                Selected products calculate total lead value automatically.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm w-full sm:flex-1">
                <select 
                  value={selectedProductIdToAdd}
                  onChange={e => setSelectedProductIdToAdd(e.target.value)}
                  className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                >
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Select a product to add...</option>
                  {availableProducts.map(p => (
                    <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {p.name || p.title} (₹{Math.round((p.price_minor || 100000) / 100)})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
              </div>

              <button 
                type="button"
                onClick={handleAddProduct}
                disabled={!selectedProductIdToAdd}
                className="w-full sm:w-auto h-11 sm:h-12 px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all disabled:opacity-40 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>

            {selectedProducts.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800/80 uppercase text-[10px] tracking-wider">
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Subtotal</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium text-slate-900 dark:text-slate-100">
                    {selectedProducts.map(p => (
                      <tr key={p.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">{p.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1.5">
                            <button 
                              type="button" 
                              onClick={() => handleUpdateQuantity(p.id, p.quantity - 1)}
                              className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold text-slate-900 dark:text-slate-100">{p.quantity}</span>
                            <button 
                              type="button" 
                              onClick={() => handleUpdateQuantity(p.id, p.quantity + 1)}
                              className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">₹{p.unitPrice}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">₹{p.unitPrice * p.quantity}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveProduct(p.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#070E1A] border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl">
                No products added yet. Select a product above to automatically calculate deal value.
              </div>
            )}
          </div>

          {/* CARD 5: PAYMENT INFORMATION */}
          <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-5">
            <div>
              <h3 className="text-base sm:text-[17px] font-bold text-slate-900 dark:text-white tracking-tight">Payment Information</h3>
              <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                Agreed revenue terms, advance deposits, and balance calculations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">Total Amount (₹)</label>
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
                  className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">Advance Payments (₹)</label>
                <input 
                  type="number"
                  min={0}
                  value={formData.advanceAmount}
                  onChange={e => setFormData({ ...formData, advanceAmount: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">Balance Amount (₹)</label>
                <div className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm flex items-center justify-between shadow-sm">
                  <span>Remaining:</span>
                  <span>₹{balanceAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

        </form>

        {/* 3. STICKY ACTION FOOTER */}
        <div className="flex-shrink-0 px-6 sm:px-7 py-3 sm:py-3.5 bg-white/95 dark:bg-[#0D1726]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-xl z-20 sticky bottom-0">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-400 dark:text-slate-500">
            Press Esc to dismiss
          </span>
          <div className="flex items-center space-x-3.5 w-full sm:w-auto justify-end">
            <button 
              type="button" 
              onClick={onClose}
              className="h-10 sm:h-11 px-5 sm:px-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
            >
              Cancel
            </button>
            
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="h-10 sm:h-11 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Lead...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 stroke-[2.5]" />
                  <span>Create Lead</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
