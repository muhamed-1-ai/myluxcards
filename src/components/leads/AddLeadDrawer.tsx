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

      {/* Reference Specification Drawer Container */}
      <div className="relative w-full max-w-[760px] md:w-[760px] h-full bg-[#F8FAFC] dark:bg-[#020617] shadow-2xl flex flex-col overflow-hidden font-sans border-l border-slate-200/60 dark:border-slate-800 text-slate-900 dark:text-white transition-all">
        
        {/* 1. Header Section (Pixel-matched to REFERENCE_TARGET.png) */}
        <div className="flex-shrink-0 flex items-start justify-between px-8 pt-8 pb-6 bg-white dark:bg-[#090D16] border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5 pr-4">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide">
              <span>✨</span>
              <span>NEW LEAD</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Add a new pipeline opportunity
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              Capture general lead details, follow-up cadence, and any active advanced fields defined by the workspace.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Scrollable Body (White Rounded Card Architecture) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-2xl flex items-start space-x-3 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* CARD 1: GENERAL (Pixel-matched to REFERENCE_TARGET.png) */}
          <div className="bg-white dark:bg-[#0B132B] rounded-[24px] p-7 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">General</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Core contact details, company, address, source, and owner.
              </p>
            </div>

            {/* Profile Image Row inside General Card */}
            <div className="flex items-center space-x-5 py-2">
              <div className="relative w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 overflow-hidden flex-shrink-0">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 opacity-50" />
                )}
              </div>

              <div className="space-y-1">
                <label className="inline-flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-2xl cursor-pointer shadow-sm transition-all">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Upload Image</span>
                  <input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp" 
                    onChange={handleImageUpload}
                    className="hidden" 
                  />
                </label>
                <div className="text-[11px] text-slate-400 font-medium">
                  Supported formats: JPG, PNG, WEBP (Max 5MB)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Lead Name * */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Lead Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter lead or account name"
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Mobile & Email Row */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-2">
                  <select 
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    className="h-12 px-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex-1 flex items-center rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 px-4 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mr-2">{countryCode}</span>
                    <input 
                      type="tel" 
                      required
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="Mobile Number"
                      className="w-full h-11 bg-transparent text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Email
                </label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="lead@company.com"
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Company Name */}
              <div className="md:col-span-1 space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Company Name
                </label>
                <input 
                  type="text" 
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Acme Pvt Ltd"
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Source */}
              <div className="md:col-span-1 space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Source
                </label>
                <select 
                  value={formData.source}
                  onChange={e => setFormData({ ...formData, source: e.target.value })}
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="MANUAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Manual Entry</option>
                  <option value="PROFILE_SHARE_DETAILS" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Share Details</option>
                  <option value="NFC" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">NFC Tap</option>
                  <option value="QR" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">QR Code Scan</option>
                  <option value="WEBSITE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Website</option>
                  <option value="REFERRAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Referral</option>
                  <option value="CAMPAIGN" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Campaign</option>
                  <option value="DIRECT" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Direct Contact</option>
                </select>
              </div>

              {/* Address */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Address
                </label>
                <textarea 
                  rows={3}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, city, state, PIN"
                  className="w-full p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[100px]"
                />
              </div>

              {/* Assigned To & Lead Life Cycle */}
              <div className="md:col-span-1 space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Assigned To
                </label>
                <select 
                  value={formData.assignedUserId}
                  onChange={e => setFormData({ ...formData, assignedUserId: e.target.value })}
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={identity.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{identity.name || identity.email}</option>
                  {managedUsers.map(u => (
                    <option key={u.id} value={u.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{u.name || u.email}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1 space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Lead Life Cycle
                </label>
                <select 
                  value={formData.lifecycleStage}
                  onChange={e => setFormData({ ...formData, lifecycleStage: e.target.value })}
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Lead" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Lead</option>
                  <option value="Marketing Qualified Lead" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Marketing Qualified Lead</option>
                  <option value="Sales Qualified Lead" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Sales Qualified Lead</option>
                  <option value="Opportunity" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Opportunity</option>
                  <option value="Customer" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Customer</option>
                </select>
              </div>

              {/* Stage Dropdown */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  Stage
                </label>
                <select 
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="NEW" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">New</option>
                  <option value="CONTACTED" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Contacted</option>
                  <option value="INTERESTED" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Interested</option>
                  <option value="FOLLOW_UP" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Follow Up</option>
                  <option value="QUALIFIED" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Qualified</option>
                  <option value="PROPOSAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Proposal</option>
                  <option value="WON" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Won</option>
                  <option value="LOST" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Lost</option>
                </select>
              </div>
            </div>
          </div>

          {/* CARD 2: REMARKS HISTORY (Pixel-matched to REFERENCE_TARGET.png) */}
          <div className="bg-white dark:bg-[#0B132B] rounded-[24px] p-7 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Remarks History</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Initial notes about this lead.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white">
                <span>Remarks</span>
                <span className="font-mono text-xs font-normal text-slate-400">{formData.remark.length}/1000</span>
              </div>
              <textarea 
                rows={4}
                maxLength={1000}
                value={formData.remark}
                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                placeholder="Enter any additional information or important notes about this lead..."
                className="w-full p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[110px]"
              />
            </div>
          </div>

          {/* CARD 3: FOLLOW-UP */}
          <div className="bg-white dark:bg-[#0B132B] rounded-[24px] p-7 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Follow-up</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Keep the next touchpoint visible directly in the leads table.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">Next Follow-up</label>
                <input 
                  type="datetime-local"
                  value={formData.followUpDate}
                  onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                  className="w-full h-12 px-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">Follow-up Type</label>
                <select 
                  value={formData.followUpType}
                  onChange={e => setFormData({ ...formData, followUpType: e.target.value })}
                  className="w-full h-12 px-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="Call" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Call</option>
                  <option value="WhatsApp" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">WhatsApp</option>
                  <option value="Email" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Email</option>
                  <option value="Meeting" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Meeting</option>
                  <option value="Other" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">Follow-up Note</label>
                <input 
                  type="text"
                  value={formData.followUpNote}
                  onChange={e => setFormData({ ...formData, followUpNote: e.target.value })}
                  placeholder="Call back regarding proposal..."
                  className="w-full h-12 px-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* CARD 4: PRODUCT SELECTION */}
          <div className="bg-white dark:bg-[#0B132B] rounded-[24px] p-7 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Product Selection</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Selected products calculate the total amount automatically.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select 
                value={selectedProductIdToAdd}
                onChange={e => setSelectedProductIdToAdd(e.target.value)}
                className="w-full sm:flex-1 h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Select a product to add...</option>
                {availableProducts.map(p => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {p.name || p.title} (₹{Math.round((p.price_minor || 100000) / 100)})
                  </option>
                ))}
              </select>

              <button 
                type="button"
                onClick={handleAddProduct}
                disabled={!selectedProductIdToAdd}
                className="w-full sm:w-auto h-12 px-5 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-all disabled:opacity-40 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>

            {selectedProducts.length > 0 ? (
              <div className="border border-slate-200/80 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-700">
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Subtotal</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60 font-medium">
                    {selectedProducts.map(p => (
                      <tr key={p.id} className="hover:bg-white dark:hover:bg-slate-800/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1">
                            <button 
                              type="button" 
                              onClick={() => handleUpdateQuantity(p.id, p.quantity - 1)}
                              className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold hover:bg-slate-100"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-bold text-slate-900 dark:text-white">{p.quantity}</span>
                            <button 
                              type="button" 
                              onClick={() => handleUpdateQuantity(p.id, p.quantity + 1)}
                              className="w-6 h-6 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold hover:bg-slate-100"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">₹{p.unitPrice}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">₹{p.unitPrice * p.quantity}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveProduct(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
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
              <div className="p-4 text-center text-xs font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                No products selected for this lead.
              </div>
            )}
          </div>

          {/* CARD 5: PAYMENT INFORMATION */}
          <div className="bg-white dark:bg-[#0B132B] rounded-[24px] p-7 border border-slate-100 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Information</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                Agreed revenue terms, advance payments, and outstanding balances.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">Total Amount (₹)</label>
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
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-bold text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">Advance Payments (₹)</label>
                <input 
                  type="number"
                  min={0}
                  value={formData.advanceAmount}
                  onChange={e => setFormData({ ...formData, advanceAmount: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full h-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">Balance Amount (₹)</label>
                <input 
                  type="number"
                  readOnly
                  value={balanceAmount}
                  className="w-full h-12 px-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-black text-emerald-600 dark:text-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

        </form>

        {/* 3. Sticky Action Footer (Pixel-matched to REFERENCE_TARGET.png) */}
        <div className="flex-shrink-0 p-5 px-8 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 shadow-lg z-30">
          <button 
            type="button" 
            onClick={onClose}
            className="h-11 px-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm"
          >
            Cancel
          </button>
          
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="h-11 px-6 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center space-x-2"
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
  );
}
