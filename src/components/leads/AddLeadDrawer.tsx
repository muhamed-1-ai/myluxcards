"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  AlertCircle, 
  Save,
  ChevronDown,
  Calendar,
  Clock
} from "lucide-react";

export interface AddLeadDrawerProps {
  isOpen: boolean;
  mode?: "create" | "edit";
  leadData?: any;
  onClose: () => void;
  onSuccess: () => void;
  identity: { id: string; name: string | null; email: string; role: string };
}

interface CountryCode {
  code: string;
  country: string;
  flag: string;
  label: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+91", country: "IN", flag: "🇮🇳", label: "IN" },
  { code: "+1", country: "US", flag: "🇺🇸", label: "US" },
  { code: "+44", country: "GB", flag: "🇬🇧", label: "UK" },
  { code: "+971", country: "AE", flag: "🇦🇪", label: "UAE" },
  { code: "+65", country: "SG", flag: "🇸🇬", label: "SG" },
];

export default function AddLeadDrawer({ 
  isOpen, 
  mode = "create", 
  leadData = null, 
  onClose, 
  onSuccess, 
  identity 
}: AddLeadDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [fetchingConfig, setFetchingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Master Config Data
  const [sources, setSources] = useState<{ id: string; name: string; code: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; key: string }[]>([]);
  const [managedUsers, setManagedUsers] = useState<any[]>([]);

  // Form State
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    address: "",
    source: "",
    productId: "",
    productPrice: 0,
    advanceAmount: 0,
    remark: "",
    assignedUserId: identity?.id || "",
    status: "",
    followUpDate: "",
    followUpTime: "",
  });

  // Calculate Total & Balance
  const totalAmount = formData.productPrice;
  const advanceAmount = Number(formData.advanceAmount || 0);
  const balanceAmount = Math.max(0, totalAmount - advanceAmount);

  // Load Master Configuration Data dynamically
  useEffect(() => {
    if (!isOpen) return;

    // Lock background scroll
    document.body.style.overflow = "hidden";

    const loadMasterConfig = async () => {
      setFetchingConfig(true);
      try {
        // 1. Sources (Master Config local storage or defaults)
        try {
          const storedSources = localStorage.getItem("myluxcards_lead_sources_data_v1");
          if (storedSources) {
            const parsed = JSON.parse(storedSources);
            const activeSources = parsed.filter((s: any) => s.active !== false);
            if (activeSources.length > 0) {
              setSources(activeSources.map((s: any) => ({ id: s.id, name: s.name, code: s.code || s.name })));
            } else {
              setSources([
                { id: "src-1", name: "Manual Entry", code: "MANUAL" },
                { id: "src-2", name: "NFC Tap", code: "NFC" },
                { id: "src-3", name: "QR Code Scan", code: "QR" },
                { id: "src-4", name: "Website", code: "WEBSITE" },
                { id: "src-5", name: "Referral", code: "REFERRAL" },
                { id: "src-6", name: "Direct Contact", code: "DIRECT" },
              ]);
            }
          } else {
            setSources([
              { id: "src-1", name: "Manual Entry", code: "MANUAL" },
              { id: "src-2", name: "NFC Tap", code: "NFC" },
              { id: "src-3", name: "QR Code Scan", code: "QR" },
              { id: "src-4", name: "Website", code: "WEBSITE" },
              { id: "src-5", name: "Referral", code: "REFERRAL" },
              { id: "src-6", name: "Direct Contact", code: "DIRECT" },
            ]);
          }
        } catch {
          setSources([
            { id: "src-1", name: "Manual Entry", code: "MANUAL" },
            { id: "src-2", name: "NFC Tap", code: "NFC" },
            { id: "src-3", name: "QR Code Scan", code: "QR" },
            { id: "src-4", name: "Website", code: "WEBSITE" },
            { id: "src-5", name: "Referral", code: "REFERRAL" },
            { id: "src-6", name: "Direct Contact", code: "DIRECT" },
          ]);
        }

        // 2. Products (API + Catalog fallback)
        try {
          const res = await fetch("/api/admin/products");
          const data = await res.json();
          if (res.ok && data.data && data.data.length > 0) {
            const activeProds = data.data.filter((p: any) => p.active !== false);
            setProducts(activeProds.map((p: any) => ({
              id: p.id,
              name: p.name || p.title,
              price: p.priceMinor ? Math.round(p.priceMinor / 100) : (p.price_minor ? Math.round(p.price_minor / 100) : 0),
            })));
          } else {
            const storedProds = localStorage.getItem("myluxcards_products_catalog_v1");
            if (storedProds) {
              const parsed = JSON.parse(storedProds);
              setProducts(parsed.map((p: any) => ({ id: p.id, name: p.name || p.title, price: p.price || 0 })));
            } else {
              setProducts([
                { id: "prod-1", name: "ZAPPIT NFC Metal Card", price: 1999 },
                { id: "prod-2", name: "ZAPPIT Smart Card - PVC", price: 999 },
                { id: "prod-3", name: "Custom Branded NFC Tag", price: 499 },
              ]);
            }
          }
        } catch {
          setProducts([
            { id: "prod-1", name: "ZAPPIT NFC Metal Card", price: 1999 },
            { id: "prod-2", name: "ZAPPIT Smart Card - PVC", price: 999 },
            { id: "prod-3", name: "Custom Branded NFC Tag", price: 499 },
          ]);
        }

        // 3. Lead Stages (Master Config local storage or defaults)
        try {
          const storedStages = localStorage.getItem("myluxcards_lead_stages_catalog_v1");
          if (storedStages) {
            const parsed = JSON.parse(storedStages);
            const activeStages = parsed.filter((s: any) => s.active !== false);
            if (activeStages.length > 0) {
              setStages(activeStages.map((s: any) => ({ id: s.id, name: s.name, key: s.key || s.name })));
            } else {
              setStages([
                { id: "stg-1", name: "New Lead", key: "NEW" },
                { id: "stg-2", name: "Contacted", key: "CONTACTED" },
                { id: "stg-3", name: "Interested", key: "INTERESTED" },
                { id: "stg-4", name: "Follow Up", key: "FOLLOW_UP" },
                { id: "stg-5", name: "Qualified", key: "QUALIFIED" },
                { id: "stg-6", name: "Proposal", key: "PROPOSAL" },
                { id: "stg-7", name: "Won", key: "WON" },
                { id: "stg-8", name: "Lost", key: "LOST" },
              ]);
            }
          } else {
            setStages([
              { id: "stg-1", name: "New Lead", key: "NEW" },
              { id: "stg-2", name: "Contacted", key: "CONTACTED" },
              { id: "stg-3", name: "Interested", key: "INTERESTED" },
              { id: "stg-4", name: "Follow Up", key: "FOLLOW_UP" },
              { id: "stg-5", name: "Qualified", key: "QUALIFIED" },
              { id: "stg-6", name: "Proposal", key: "PROPOSAL" },
              { id: "stg-7", name: "Won", key: "WON" },
              { id: "stg-8", name: "Lost", key: "LOST" },
            ]);
          }
        } catch {
          setStages([
            { id: "stg-1", name: "New Lead", key: "NEW" },
            { id: "stg-2", name: "Contacted", key: "CONTACTED" },
            { id: "stg-3", name: "Interested", key: "INTERESTED" },
            { id: "stg-4", name: "Follow Up", key: "FOLLOW_UP" },
            { id: "stg-5", name: "Qualified", key: "QUALIFIED" },
            { id: "stg-6", name: "Proposal", key: "PROPOSAL" },
            { id: "stg-7", name: "Won", key: "WON" },
            { id: "stg-8", name: "Lost", key: "LOST" },
          ]);
        }

        // 4. Managed Users (API)
        if (identity.role === "ADMIN" || identity.role === "SUPER_ADMIN") {
          try {
            const res = await fetch("/api/admin/managed-users");
            const data = await res.json();
            if (res.ok && data.users) {
              setManagedUsers(data.users);
            }
          } catch (err) {
            console.error("Failed to fetch managed users", err);
          }
        }
      } finally {
        setFetchingConfig(false);
      }
    };

    loadMasterConfig();

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, identity.role]);

  // Populate data when editing or creating
  useEffect(() => {
    if (!isOpen) return;

    setError(null);

    if (mode === "edit" && leadData) {
      // Parse phone number into country code + number
      let rawPhone = leadData.contactNumber || leadData.phone || "";
      let matchedCode = "+91";
      let mainPhone = rawPhone;

      for (const c of COUNTRY_CODES) {
        if (rawPhone.startsWith(c.code)) {
          matchedCode = c.code;
          mainPhone = rawPhone.slice(c.code.length).trim();
          break;
        }
      }

      setCountryCode(matchedCode);
      setPhoneNumber(mainPhone);

      // Parse followUpDate into date string and time string
      let fDate = "";
      let fTime = "";
      if (leadData.followUpDate) {
        const d = new Date(leadData.followUpDate);
        if (!isNaN(d.getTime())) {
          fDate = d.toISOString().split("T")[0];
          fTime = d.toTimeString().slice(0, 5);
        }
      }

      setFormData({
        name: leadData.name || "",
        email: leadData.email || "",
        companyName: leadData.companyName || leadData.company || "",
        address: leadData.address || "",
        source: leadData.source || "MANUAL",
        productId: leadData.productId || "",
        productPrice: Number(leadData.totalAmount || leadData.total_amount || 0),
        advanceAmount: Number(leadData.advanceAmount || leadData.advance_amount || 0),
        remark: leadData.remark || leadData.notes || "",
        assignedUserId: leadData.assignedUserId || identity.id,
        status: leadData.status || leadData.stage || "NEW",
        followUpDate: fDate,
        followUpTime: fTime,
      });
    } else {
      // Reset form for Create Mode
      setCountryCode("+91");
      setPhoneNumber("");
      setFormData({
        name: "",
        email: "",
        companyName: "",
        address: "",
        source: sources.length > 0 ? sources[0].code : "MANUAL",
        productId: "",
        productPrice: 0,
        advanceAmount: 0,
        remark: "",
        assignedUserId: identity.id,
        status: stages.length > 0 ? stages[0].key : "NEW",
        followUpDate: "",
        followUpTime: "",
      });
    }
  }, [isOpen, mode, leadData, identity.id, sources, stages]);

  // Handle Product Selection change
  const handleProductChange = (prodId: string) => {
    const found = products.find(p => p.id === prodId);
    setFormData(prev => ({
      ...prev,
      productId: prodId,
      productPrice: found ? found.price : 0,
    }));
  };

  // Submit Handler (Create vs Edit)
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

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    const fullContactNumber = `${countryCode} ${phoneNumber.trim()}`;

    // Format follow-up date-time if provided
    let combinedFollowUpIso: string | undefined = undefined;
    if (formData.followUpDate) {
      const timePart = formData.followUpTime || "10:00";
      const d = new Date(`${formData.followUpDate}T${timePart}:00`);
      if (!isNaN(d.getTime())) {
        combinedFollowUpIso = d.toISOString();
      }
    }

    try {
      if (mode === "edit" && leadData?.id) {
        // PATCH /api/leads/[id]
        const res = await fetch(`/api/leads/${leadData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            contactNumber: fullContactNumber,
            email: formData.email.trim() || undefined,
            companyName: formData.companyName.trim() || undefined,
            address: formData.address.trim() || undefined,
            source: formData.source,
            assignedUserId: formData.assignedUserId,
            status: formData.status,
            totalAmount,
            advanceAmount,
            remark: formData.remark.trim() || undefined,
            followUpDate: combinedFollowUpIso,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to update lead.");
      } else {
        // POST /api/leads
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            contactNumber: fullContactNumber,
            email: formData.email.trim() || undefined,
            companyName: formData.companyName.trim() || undefined,
            address: formData.address.trim() || undefined,
            source: formData.source || "MANUAL",
            assignedUserId: formData.assignedUserId,
            status: formData.status || "NEW",
            totalAmount,
            advanceAmount,
            remark: formData.remark.trim() || undefined,
            followUpDate: combinedFollowUpIso,
            followUpType: "Call",
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to create lead.");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Operation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = mode === "edit";

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-[720px] h-full bg-slate-50/90 dark:bg-[#070D18] shadow-2xl flex flex-col overflow-hidden font-sans border-l border-slate-200 dark:border-slate-800/80 z-10 text-slate-900 dark:text-slate-100 transition-colors animate-in slide-in-from-right duration-300">
        
        {/* FIXED HEADER */}
        <div className="flex-shrink-0 flex items-start justify-between px-8 sm:px-9 md:px-10 pt-7 pb-6 bg-white dark:bg-[#0D1726] border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-20 shadow-sm">
          <div className="space-y-1.5 pr-6">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold tracking-wider uppercase mb-0.5">
              <span>✨</span>
              <span>{isEdit ? "EDIT LEAD" : "NEW LEAD"}</span>
            </div>
            <h2 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.15]">
              {isEdit ? "Edit lead opportunity" : "Add a new lead opportunity"}
            </h2>
            <p className="text-xs sm:text-[13.5px] font-normal text-slate-500 dark:text-slate-400 leading-relaxed pt-0.5">
              {isEdit 
                ? "Update contact details, lead stage, owner, and deal amounts." 
                : "Create a new opportunity and keep all lead information organized."}
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            aria-label="Close drawer"
            className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all flex items-center justify-center flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 mt-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-[#070D18] font-sans">
          
          {/* Inner Canvas Wrapper (32px-40px horizontal padding) */}
          <div className="px-8 sm:px-9 md:px-10 py-7 space-y-6 sm:space-y-7 pb-36">
            
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-start space-x-3 text-xs sm:text-sm font-medium shadow-sm animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* SECTION 1: GENERAL INFORMATION */}
            <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-base sm:text-[17.5px] font-bold text-slate-900 dark:text-white tracking-tight">GENERAL INFORMATION</h3>
                <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400">
                  Core lead and contact information.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-5 sm:gap-y-6">
                
                {/* 1. Lead Name * */}
                <div className="md:col-span-2 space-y-2">
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

                {/* 2. Mobile * */}
                <div className="space-y-2">
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

                    <div className="flex items-center flex-1 h-full px-3.5 min-w-0">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2 flex-shrink-0">{countryCode}</span>
                      <input 
                        type="tel" 
                        required
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        placeholder="Mobile Number"
                        className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none h-full min-w-0"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Email */}
                <div className="space-y-2">
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

                {/* 4. Company Name */}
                <div className="md:col-span-1 space-y-2">
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

                {/* 5. Source (Dynamic from Master Config) */}
                <div className="md:col-span-1 space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    Source
                  </label>
                  <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                    <select 
                      value={formData.source}
                      onChange={e => setFormData({ ...formData, source: e.target.value })}
                      className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                    >
                      {fetchingConfig ? (
                        <option value="">Loading sources...</option>
                      ) : sources.length === 0 ? (
                        <option value="">No lead sources configured</option>
                      ) : (
                        sources.map(s => (
                          <option key={s.id} value={s.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {s.name}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* 6. Address */}
                <div className="md:col-span-2 space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    Address
                  </label>
                  <textarea 
                    rows={3}
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street, city, state, PIN"
                    className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm min-h-[92px] max-h-[120px] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: SALES INFORMATION */}
            <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-base sm:text-[17.5px] font-bold text-slate-900 dark:text-white tracking-tight">SALES INFORMATION</h3>
                <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400">
                  Select product package and revenue breakdown.
                </p>
              </div>

              {/* 7. Product Select (Dynamic from Master Config) */}
              <div className="space-y-2">
                <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                  Product
                </label>
                <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                  <select 
                    value={formData.productId}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9 min-w-0"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Select Product...</option>
                    {fetchingConfig ? (
                      <option value="">Loading products...</option>
                    ) : products.length === 0 ? (
                      <option value="">No products configured</option>
                    ) : (
                      products.map(p => (
                        <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          {p.name} (₹{p.price.toLocaleString("en-IN")})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                </div>
              </div>

              {/* 8, 9, 10. Payment Calculation Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                
                {/* 8. Total Amount (READ ONLY) */}
                <div className="space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    Total Amount (₹)
                  </label>
                  <input 
                    type="text"
                    readOnly
                    value={`₹ ${totalAmount.toLocaleString("en-IN")}`}
                    className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-100/70 dark:bg-[#040810] text-xs font-extrabold text-slate-900 dark:text-slate-100 cursor-not-allowed shadow-sm"
                  />
                </div>

                {/* 9. Advance (Editable) */}
                <div className="space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    Advance (₹)
                  </label>
                  <input 
                    type="number"
                    min={0}
                    value={formData.advanceAmount}
                    onChange={e => setFormData({ ...formData, advanceAmount: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                    className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                  />
                </div>

                {/* 10. Balance (READ ONLY) */}
                <div className="space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    Balance (₹)
                  </label>
                  <div className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs sm:text-sm flex items-center justify-between shadow-sm">
                    <span>Remaining:</span>
                    <span>₹ {balanceAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: LEAD MANAGEMENT */}
            <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-6">
              <div className="space-y-1">
                <h3 className="text-base sm:text-[17.5px] font-bold text-slate-900 dark:text-white tracking-tight">LEAD MANAGEMENT</h3>
                <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400">
                  Assign owner and update pipeline stage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-5 sm:gap-y-6">
                
                {/* 12. Assigned To */}
                <div className="md:col-span-1 space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    Assigned To
                  </label>
                  <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                    <select 
                      value={formData.assignedUserId}
                      onChange={e => setFormData({ ...formData, assignedUserId: e.target.value })}
                      className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                    >
                      <option value={identity.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                        {identity.name || identity.email} (You)
                      </option>
                      {managedUsers.map(u => (
                        <option key={u.id} value={u.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* 13. Lead Stage (Dynamic from Master Config) */}
                <div className="md:col-span-1 space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    Lead Stage
                  </label>
                  <div className="relative flex items-center h-11 sm:h-12 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] shadow-sm">
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-full px-3.5 sm:px-4 appearance-none bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer pr-9"
                    >
                      {fetchingConfig ? (
                        <option value="">Loading stages...</option>
                      ) : stages.length === 0 ? (
                        <option value="">No lead stages configured</option>
                      ) : (
                        stages.map(stg => (
                          <option key={stg.id} value={stg.key} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {stg.name}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: FOLLOW-UP */}
            <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-[17.5px] font-bold text-slate-900 dark:text-white tracking-tight">FOLLOW-UP</h3>
                  <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400">
                    Next follow-up date and time cadence.
                  </p>
                </div>
                {(formData.followUpDate || formData.followUpTime) && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, followUpDate: "", followUpTime: "" }))}
                    className="text-xs font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Select Date</span>
                  </label>
                  <input 
                    type="date"
                    value={formData.followUpDate}
                    onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                    className="w-full h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Select Time</span>
                  </label>
                  <input 
                    type="time"
                    value={formData.followUpTime}
                    onChange={e => setFormData({ ...formData, followUpTime: e.target.value })}
                    className="w-full h-11 sm:h-12 px-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: REMARKS */}
            <div className="bg-white dark:bg-[#0D1726] rounded-2xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800/90 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-[17.5px] font-bold text-slate-900 dark:text-white tracking-tight">REMARKS</h3>
                  <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400">
                    Initial context, notes from call, or specific client requirements.
                  </p>
                </div>
                <span className="font-mono text-xs font-normal text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80">
                  {formData.remark.length}/1000
                </span>
              </div>

              <div className="space-y-2">
                <textarea 
                  rows={4}
                  maxLength={1000}
                  value={formData.remark}
                  onChange={e => setFormData({ ...formData, remark: e.target.value })}
                  placeholder="Add initial remarks or client notes..."
                  className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-[#070E1A] text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[110px] sm:min-h-[125px] resize-none shadow-sm"
                />
              </div>
            </div>

          </div>
        </form>

        {/* FIXED STICKY ACTION FOOTER */}
        <div className="flex-shrink-0 px-8 sm:px-9 md:px-10 py-4 sm:py-5 bg-white/95 dark:bg-[#0D1726]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-xl z-20 sticky bottom-0">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-400 dark:text-slate-500">
            Press Esc to dismiss
          </span>
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
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
                  <span>{isEdit ? "Saving..." : "Creating Lead..."}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 stroke-[2.5]" />
                  <span>{isEdit ? "Save Changes" : "Create Lead"}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
