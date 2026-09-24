"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  AlertCircle, 
  Save,
  ChevronDown,
  Calendar,
  Clock,
  TrendingUp,
  PlusCircle,
  CreditCard,
  History,
  Trash2,
  Plus,
  Minus,
  UploadCloud,
  FileText,
  Check
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
  label: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+91", country: "IN", label: "IN" },
  { code: "+1", country: "US", label: "US" },
  { code: "+44", country: "GB", label: "UK" },
  { code: "+971", country: "AE", label: "UAE" },
  { code: "+65", country: "SG", label: "SG" },
];

interface SelectedProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface AdvancePaymentRecord {
  id: string;
  amount: number;
  note: string;
  createdAt: string;
}

interface CustomField {
  key: string;
  label: string;
  type: "text" | "number";
  placeholder: string;
}

function getAccountConfigKey(baseKey: string): string {
  try {
    if (typeof window !== "undefined") {
      const rawUser = localStorage.getItem("myluxcards_current_user");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && (u.id || u.email)) {
          const accountId = u.id || u.email;
          return `${baseKey}_${accountId}`;
        }
      }
    }
  } catch {}
  return baseKey;
}

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
  const formRef = React.useRef<HTMLFormElement>(null);

  const setFormError = (msg: string | null) => {
    setError(msg);
    if (msg && formRef.current) {
      formRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Dynamic Master Config Data
  const [sources, setSources] = useState<{ id: string; name: string; code: string }[]>([]);
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; key: string }[]>([]);
  const [managedUsers, setManagedUsers] = useState<any[]>([]);

  // Selected Products in Form
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [chosenProductId, setChosenProductId] = useState("");

  // Advance Payments in Form
  const [advanceRecords, setAdvanceRecords] = useState<AdvancePaymentRecord[]>([]);
  const [isRequestingAdvance, setIsRequestingAdvance] = useState(false);
  const [newAdvanceAmount, setNewAdvanceAmount] = useState("");
  const [newAdvanceNote, setNewAdvanceNote] = useState("");

  interface DynamicFieldDef {
    id: string;
    name: string;
    inputType: "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "RADIO" | "CHECKBOX" | "DATE" | "FILE" | "DATETIME";
    isRequired: boolean;
    status: string;
    sortOrder: number;
    options?: { id: string; label: string; value: string }[];
  }

  // Dynamic Advanced Custom Fields
  const [dynamicFields, setDynamicFields] = useState<DynamicFieldDef[]>([]);
  const [dynamicFieldsLoading, setDynamicFieldsLoading] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);

  // Form State
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    address: "",
    source: "",
    assignedUserId: identity?.id || "",
    lifeCycle: "",
    status: "",
    remark: "",
    followUpDate: "",
    followUpTime: "10:00",
    followUpType: "Call",
    followUpNote: "",
    customTotalAmount: "",
  });

  // Calculate Total & Balance Amount
  const calculatedProductTotal = selectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const totalAmount = selectedProducts.length > 0 
    ? calculatedProductTotal 
    : (formData.customTotalAmount ? Number(formData.customTotalAmount) : 0);

  const totalAdvanceFromRecords = advanceRecords.reduce((sum, r) => sum + r.amount, 0);
  const balanceAmount = Math.max(0, totalAmount - totalAdvanceFromRecords);

  // Handle ESC key to dismiss dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Load Master Configuration Data dynamically
  useEffect(() => {
    if (!isOpen) return;

    // Lock background scroll
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const loadMasterConfig = async () => {
      setFetchingConfig(true);
      try {
        // 1. Sources (account-scoped)
        try {
          const storageKey = getAccountConfigKey("myluxcards_lead_sources_data_v1");
          const storedSources = localStorage.getItem(storageKey);
          if (storedSources) {
            const parsed = JSON.parse(storedSources);
            const activeSources = parsed.filter((s: any) => s.status === "ACTIVE" || s.active !== false);
            setSources(activeSources.map((s: any) => ({ id: s.id, name: s.name, code: s.code || s.name })));
          } else {
            setSources([]);
          }
        } catch {
          setSources([]);
        }

        // 2. Products (API or account-scoped localStorage)
        try {
          const res = await fetch("/api/admin/products");
          const data = await res.json();
          if (res.ok && data.data && data.data.length > 0) {
            const activeProds = data.data.filter((p: any) => p.active !== false);
            setAvailableProducts(activeProds.map((p: any) => ({
              id: p.id,
              name: p.name || p.title,
              price: p.priceMinor ? Math.round(p.priceMinor / 100) : (p.price_minor ? Math.round(p.price_minor / 100) : 0),
            })));
          } else {
            const storageKey = getAccountConfigKey("myluxcards_products_catalog_v1");
            const storedProds = localStorage.getItem(storageKey);
            if (storedProds) {
              const parsed = JSON.parse(storedProds);
              const activeProds = parsed.filter((p: any) => p.status === "ACTIVE" || p.active !== false);
              setAvailableProducts(activeProds.map((p: any) => ({ id: p.id, name: p.name || p.title, price: p.price || 0 })));
            } else {
              setAvailableProducts([]);
            }
          }
        } catch {
          const storageKey = getAccountConfigKey("myluxcards_products_catalog_v1");
          const storedProds = localStorage.getItem(storageKey);
          if (storedProds) {
            const parsed = JSON.parse(storedProds);
            const activeProds = parsed.filter((p: any) => p.status === "ACTIVE" || p.active !== false);
            setAvailableProducts(activeProds.map((p: any) => ({ id: p.id, name: p.name || p.title, price: p.price || 0 })));
          } else {
            setAvailableProducts([]);
          }
        }

        // 3. Lead Stages (account-scoped)
        try {
          const storageKey = getAccountConfigKey("myluxcards_lead_stages_catalog_v1");
          const storedStages = localStorage.getItem(storageKey);
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
            { id: "stg-7", name: "Won", key: "WON" },
            { id: "stg-8", name: "Lost", key: "LOST" },
          ]);
        }

        // 4. Managed Users
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

        // 5. Dynamic Custom Fields from API database
        try {
          setDynamicFieldsLoading(true);
          const res = await fetch("/api/leads/custom-fields");
          const data = await res.json();
          if (res.ok && Array.isArray(data.fields)) {
            setDynamicFields(data.fields);
          }
        } catch (err) {
          console.error("Failed to read dynamic custom fields", err);
        } finally {
          setDynamicFieldsLoading(false);
        }
      } finally {
        setFetchingConfig(false);
      }
    };

    loadMasterConfig();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, identity.role]);

  // Populate data when editing or creating
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsAddingProduct(false);
    setIsRequestingAdvance(false);

    if (mode === "edit" && leadData) {
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

      let fDate = "";
      let fTime = "10:00";
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
        assignedUserId: leadData.assignedUserId || identity.id,
        lifeCycle: leadData.lifeCycle || "",
        status: leadData.status || leadData.stage || "NEW",
        remark: leadData.remark || leadData.notes || "",
        followUpDate: fDate,
        followUpTime: fTime,
        followUpType: leadData.followUpType || "Call",
        followUpNote: leadData.followUpNote || "",
        customTotalAmount: leadData.totalAmount ? String(leadData.totalAmount) : "",
      });

      if (leadData.advanceAmount && Number(leadData.advanceAmount) > 0) {
        setAdvanceRecords([
          {
            id: "adv-init",
            amount: Number(leadData.advanceAmount),
            note: "Recorded advance",
            createdAt: new Date().toLocaleDateString("en-IN"),
          }
        ]);
      } else {
        setAdvanceRecords([]);
      }
      if (leadData?.id) {
        fetch(`/api/leads/${leadData.id}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.lead && d.lead.customFieldValues) {
              setCustomFieldValues((prev) => ({
                ...prev,
                ...d.lead.customFieldValues,
              }));
            }
          })
          .catch(() => {});
      }
    } else {
      // Reset form for Create Mode
      setCountryCode("+91");
      setPhoneNumber("");
      setSelectedProducts([]);
      setAdvanceRecords([]);
      setFormData({
        name: "",
        email: "",
        companyName: "",
        address: "",
        source: sources.length > 0 ? sources[0].code : "MANUAL",
        assignedUserId: identity.id,
        lifeCycle: "",
        status: stages.length > 0 ? stages[0].key : "NEW",
        remark: "",
        followUpDate: "",
        followUpTime: "10:00",
        followUpType: "Call",
        followUpNote: "",
        customTotalAmount: "",
      });
      setCustomFieldValues({});
    }
  }, [isOpen, mode, leadData, identity.id, sources, stages]);

  // Product Selection Handlers
  const handleAddProduct = () => {
    if (!chosenProductId) return;
    const prod = availableProducts.find(p => p.id === chosenProductId);
    if (!prod) return;

    setSelectedProducts(prev => {
      const existing = prev.find(p => p.id === chosenProductId);
      if (existing) {
        return prev.map(p => p.id === chosenProductId ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { id: prod.id, name: prod.name, price: prod.price, quantity: 1 }];
    });

    setChosenProductId("");
    setIsAddingProduct(false);
  };

  const handleUpdateProductQty = (id: string, delta: number) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.id === id) {
        const newQty = Math.max(1, p.quantity + delta);
        return { ...p, quantity: newQty };
      }
      return p;
    }));
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== id));
  };

  // Advance Payments Handlers
  const handleSaveAdvanceRequest = () => {
    const amt = Number(newAdvanceAmount);
    if (isNaN(amt) || amt <= 0) return;

    const newRecord: AdvancePaymentRecord = {
      id: `adv-${Date.now()}`,
      amount: amt,
      note: newAdvanceNote.trim() || "Advance payment requested",
      createdAt: new Date().toLocaleDateString("en-IN"),
    };

    setAdvanceRecords(prev => [...prev, newRecord]);
    setNewAdvanceAmount("");
    setNewAdvanceNote("");
    setIsRequestingAdvance(false);
  };

  // Custom Field File Upload Handler
  const handleCustomFileUpload = async (fieldId: string, file: File) => {
    setUploadingFieldId(fieldId);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "document");

      const res = await fetch("/api/media", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "File upload failed.");

      const fileObj = {
        url: data.url || data.publicUrl,
        name: file.name,
        size: file.size,
        key: data.key,
      };
      setCustomFieldValues((prev) => ({ ...prev, [fieldId]: fileObj }));
    } catch (err: any) {
      alert(err.message || "File upload failed.");
    } finally {
      setUploadingFieldId(null);
    }
  };

  const handleRemoveAdvanceRecord = (id: string) => {
    setAdvanceRecords(prev => prev.filter(r => r.id !== id));
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    // Validation
    if (!formData.name.trim()) {
      setFormError("Lead Name is required.");
      setLoading(false);
      return;
    }

    if (!phoneNumber.trim()) {
      setFormError("Mobile Number is required.");
      setLoading(false);
      return;
    }

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setFormError("Please enter a valid email address.");
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

    // Build payload
    const payload: any = {
      name: formData.name.trim(),
      contactNumber: fullContactNumber,
      email: formData.email.trim() || undefined,
      companyName: formData.companyName.trim() || undefined,
      address: formData.address.trim() || undefined,
      source: formData.source || "MANUAL",
      assignedUserId: formData.assignedUserId,
      status: formData.status || "NEW",
      lifeCycle: formData.lifeCycle || undefined,
      totalAmount,
      advanceAmount: totalAdvanceFromRecords,
      remark: formData.remark.trim() || undefined,
      followUpDate: combinedFollowUpIso,
      followUpType: formData.followUpType || "Call",
      followUpNote: formData.followUpNote.trim() || undefined,
      customFields: customFieldValues,
    };

    try {
      if (mode === "edit" && leadData?.id) {
        const res = await fetch(`/api/leads/${leadData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to update lead.");
      } else {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to create lead.");
      }

      onSuccess();
    } catch (err: any) {
      setFormError(err.message || "Operation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = mode === "edit";

  return (
    <div className="add-lead-overlay">
      {/* Centered Dialog Window (780px max width, 3-part layout) */}
      <div role="dialog" aria-modal="true" className="add-lead-window">
        
        {/* 1. FIXED HEADER */}
        <div className="add-lead-header">
          <div className="space-y-1 pr-4">
            <div className="add-lead-badge">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isEdit ? "EDIT LEAD" : "NEW LEAD"}</span>
            </div>
            <h2 className="add-lead-title">
              {isEdit ? "Edit pipeline opportunity" : "Add a new pipeline opportunity"}
            </h2>
            <p className="add-lead-subtitle">
              Capture general lead details, follow-up cadence, and any active advanced fields defined by the workspace.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            aria-label="Close dialog"
            className="add-lead-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. SCROLLABLE FORM BODY */}
        <form ref={formRef} onSubmit={handleSubmit} className="add-lead-body">
          
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-start space-x-3 text-xs sm:text-sm font-medium shadow-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: GENERAL */}
          <div className="add-lead-card">
            <div>
              <h3 className="add-lead-card-title">General</h3>
              <p className="add-lead-card-desc">
                Core contact details, company, address, source, and owner.
              </p>
            </div>

            <div className="space-y-4">
              {/* 1. Lead Name (Full width) */}
              <div>
                <label className="add-lead-label">
                  Lead Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter lead or account name"
                  className="add-lead-input"
                />
              </div>

              {/* 2. Mobile and Email (Two equal columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Aligned Mobile Group */}
                <div>
                  <label className="add-lead-label">
                    Mobile <span className="text-rose-500">*</span>
                  </label>
                  <div className="add-lead-mobile-group">
                    {/* Country Selector */}
                    <div className="add-lead-country-selector">
                      <select 
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value)}
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2" />
                    </div>

                    {/* Single Prefix */}
                    <div className="add-lead-dial-code">
                      {countryCode}
                    </div>

                    {/* Phone Number Input */}
                    <input 
                      type="tel" 
                      required
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="Mobile Number"
                      className="add-lead-phone-input"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="add-lead-label">
                    Email
                  </label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="lead@company.com"
                    className="add-lead-input"
                  />
                </div>
              </div>

              {/* 3. Company Name (Left half-width, right side blank) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="add-lead-label">
                    Company Name
                  </label>
                  <input 
                    type="text" 
                    value={formData.companyName}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Acme Pvt Ltd"
                    className="add-lead-input"
                  />
                </div>
                <div className="hidden sm:block" />
              </div>

              {/* 4. Address (Full-width textarea) */}
              <div>
                <label className="add-lead-label">
                  Address
                </label>
                <textarea 
                  rows={2}
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, city, state, PIN"
                  className="add-lead-textarea min-h-[72px]"
                />
              </div>

              {/* 5. Assigned To and Source (Two equal columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="add-lead-label">
                    Assigned To
                  </label>
                  <div className="relative flex items-center">
                    <select 
                      value={formData.assignedUserId}
                      onChange={e => setFormData({ ...formData, assignedUserId: e.target.value })}
                      className="add-lead-select pr-9"
                    >
                      <option value={identity.id}>
                        {identity.name || identity.email}
                      </option>
                      {managedUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="add-lead-label">
                    Source
                  </label>
                  <div className="relative flex items-center">
                    <select 
                      value={formData.source}
                      onChange={e => setFormData({ ...formData, source: e.target.value })}
                      className="add-lead-select pr-9"
                    >
                      <option value="">Select source</option>
                      {sources.map(s => (
                        <option key={s.id} value={s.code}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 6. Lead Life Cycle (Left half-width, right side blank) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="add-lead-label">
                    Lead Life Cycle
                  </label>
                  <div className="relative flex items-center">
                    <select 
                      value={formData.lifeCycle}
                      onChange={e => setFormData({ ...formData, lifeCycle: e.target.value })}
                      className="add-lead-select pr-9"
                    >
                      <option value="">Select lifecycle</option>
                      <option value="LEAD">Lead</option>
                      <option value="MQL">Marketing Qualified Lead (MQL)</option>
                      <option value="SQL">Sales Qualified Lead (SQL)</option>
                      <option value="OPPORTUNITY">Opportunity</option>
                      <option value="CUSTOMER">Customer</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  </div>
                </div>
                <div className="hidden sm:block" />
              </div>

              {/* 7. Stage (Full width) */}
              <div>
                <label className="add-lead-label">
                  Stage
                </label>
                <div className="relative flex items-center">
                  <select 
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="add-lead-select pr-9"
                  >
                    {stages.map(stg => (
                      <option key={stg.id} value={stg.key}>
                        {stg.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: REMARKS HISTORY */}
          <div className="add-lead-card">
            <div>
              <h3 className="add-lead-card-title">Remarks History</h3>
              <p className="add-lead-card-desc">
                Initial notes about this lead.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="add-lead-label !mb-0">
                  Remarks
                </label>
                <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {formData.remark.length}/1000
                </span>
              </div>
              <textarea 
                rows={4}
                maxLength={1000}
                value={formData.remark}
                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                placeholder="Enter any additional information or important notes about this lead..."
                className="add-lead-textarea min-h-[100px]"
              />
            </div>
          </div>

          {/* SECTION 3: FOLLOW-UP */}
          <div className="add-lead-card">
            <div className="add-lead-card-header">
              <div className="add-lead-icon-wrap add-lead-icon-amber">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="add-lead-card-title">Follow-up</h3>
                <p className="add-lead-card-desc">
                  Keep the next touchpoint visible directly in the leads table.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: Next Follow-up & Follow-up Type */}
              <div className="space-y-4">
                <div>
                  <label className="add-lead-label">
                    Next Follow-up
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input 
                      type="date"
                      value={formData.followUpDate}
                      onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                      className="add-lead-input sm:col-span-3 !px-3"
                    />
                    <input 
                      type="time"
                      value={formData.followUpTime}
                      onChange={e => setFormData({ ...formData, followUpTime: e.target.value })}
                      className="add-lead-input sm:col-span-2 !px-2 text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="add-lead-label">
                    Follow-up Type
                  </label>
                  <div className="relative flex items-center">
                    <select 
                      value={formData.followUpType}
                      onChange={e => setFormData({ ...formData, followUpType: e.target.value })}
                      className="add-lead-select pr-9"
                    >
                      <option value="Call">Call</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Demo">Demo</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Right: Follow-up Note */}
              <div className="flex flex-col">
                <label className="add-lead-label">
                  Follow-up Note
                </label>
                <textarea 
                  value={formData.followUpNote}
                  onChange={e => setFormData({ ...formData, followUpNote: e.target.value })}
                  placeholder="Describe the next customer action, context, or talking point"
                  className="add-lead-textarea flex-1 min-h-[110px]"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: PRODUCT SELECTION */}
          <div className="add-lead-card">
            <div className="flex items-center justify-between">
              <div className="add-lead-card-header">
                <div className="add-lead-icon-wrap add-lead-icon-purple">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="add-lead-card-title">Product Selection</h3>
                  <p className="add-lead-card-desc">
                    Selected products calculate the total amount automatically.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingProduct(!isAddingProduct)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Product Selector Bar */}
            {isAddingProduct && (
              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <select
                    value={chosenProductId}
                    onChange={e => setChosenProductId(e.target.value)}
                    className="add-lead-select !h-10 !text-xs pr-9"
                  >
                    <option value="">Choose a product from catalogue...</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.price.toLocaleString("en-IN")})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsAddingProduct(false)}
                    className="h-9 px-3 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!chosenProductId}
                    onClick={handleAddProduct}
                    className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Selected Products or Empty State */}
            {selectedProducts.length === 0 ? (
              <div className="add-lead-empty-box">
                No products selected for this lead.
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedProducts.map(p => (
                  <div 
                    key={p.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40"
                  >
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">₹{p.price.toLocaleString("en-IN")} each</div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => handleUpdateProductQty(p.id, -1)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">{p.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateProductQty(p.id, 1)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-w-[70px] text-right">
                        ₹{(p.price * p.quantity).toLocaleString("en-IN")}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(p.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 5: PAYMENT INFORMATION */}
          <div className="add-lead-card">
            <div className="add-lead-card-header">
              <div className="add-lead-icon-wrap add-lead-icon-green">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="add-lead-card-title">Payment Information</h3>
                <p className="add-lead-card-desc">
                  Agreed revenue terms, advance payments, and outstanding balances.
                </p>
              </div>
            </div>

            {/* Total Amount & Balance Amount Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="add-lead-label">
                  Total Amount
                </label>
                <input 
                  type="number"
                  min={0}
                  value={totalAmount || ""}
                  onChange={e => setFormData({ ...formData, customTotalAmount: e.target.value })}
                  disabled={selectedProducts.length > 0}
                  placeholder="0.00"
                  className="add-lead-input font-bold"
                />
              </div>

              <div>
                <label className="add-lead-label">
                  Balance Amount (Read-only)
                </label>
                <input 
                  type="text" 
                  readOnly
                  value={balanceAmount ? balanceAmount.toFixed(2) : "0.00"}
                  className="add-lead-input font-bold opacity-80 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-1" />

            {/* Advance Payments Subheading & Action */}
            <div className="flex items-center justify-between pt-1">
              <div className="add-lead-subhead">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>Advance Payments</span>
              </div>

              <button
                type="button"
                onClick={() => setIsRequestingAdvance(!isRequestingAdvance)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Request Advance</span>
              </button>
            </div>

            {/* Inline Request Advance Form */}
            {isRequestingAdvance && (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="number"
                  min={0}
                  placeholder="Advance Amount (₹)"
                  value={newAdvanceAmount}
                  onChange={e => setNewAdvanceAmount(e.target.value)}
                  className="add-lead-input sm:w-44 !h-10 !text-xs font-bold"
                />
                <input
                  type="text"
                  placeholder="Advance note (e.g. Booking token)"
                  value={newAdvanceNote}
                  onChange={e => setNewAdvanceNote(e.target.value)}
                  className="add-lead-input flex-1 !h-10 !text-xs"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsRequestingAdvance(false)}
                    className="h-9 px-3 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAdvanceRequest}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    Record
                  </button>
                </div>
              </div>
            )}

            {/* Advance Records List or Empty State */}
            {advanceRecords.length === 0 ? (
              <div className="add-lead-empty-box">
                No advance payments recorded for this lead.
              </div>
            ) : (
              <div className="space-y-2">
                {advanceRecords.map(r => (
                  <div 
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        ₹{r.amount.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {r.note} • {r.createdAt}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdvanceRecord(r.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 6: ADVANCED FIELDS */}
          <div className="add-lead-card">
            <div>
              <h3 className="add-lead-card-title">Advanced Fields</h3>
              <p className="add-lead-card-desc">
                These inputs are generated from the active Lead Dynamics configuration for this workspace.
              </p>
            </div>

            {dynamicFieldsLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Loading custom fields...</div>
            ) : dynamicFields.length === 0 ? (
              <div className="add-lead-empty-box">No custom fields configured for this workspace.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dynamicFields.map(f => {
                  const val = customFieldValues[f.id] !== undefined ? customFieldValues[f.id] : (customFieldValues[f.name] !== undefined ? customFieldValues[f.name] : "");
                  const isFullWidth = f.inputType === "TEXTAREA" || f.inputType === "FILE";

                  return (
                    <div key={f.id} className={isFullWidth ? "col-span-1 sm:col-span-2" : ""}>
                      <label className="add-lead-label">
                        {f.name}
                        {f.isRequired && <span className="text-rose-500 ml-1">*</span>}
                      </label>

                      {f.inputType === "TEXT" && (
                        <input
                          type="text"
                          value={typeof val === "string" ? val : ""}
                          onChange={e => setCustomFieldValues({ ...customFieldValues, [f.id]: e.target.value })}
                          placeholder={`Enter ${f.name}`}
                          className="add-lead-input"
                        />
                      )}

                      {f.inputType === "TEXTAREA" && (
                        <textarea
                          rows={3}
                          value={typeof val === "string" ? val : ""}
                          onChange={e => setCustomFieldValues({ ...customFieldValues, [f.id]: e.target.value })}
                          placeholder={`Enter ${f.name}`}
                          className="add-lead-input !h-auto py-2"
                        />
                      )}

                      {f.inputType === "NUMBER" && (
                        <input
                          type="number"
                          value={val !== undefined && val !== null ? val : ""}
                          onChange={e => {
                            const v = e.target.value;
                            setCustomFieldValues({ ...customFieldValues, [f.id]: v === "" ? "" : Number(v) });
                          }}
                          placeholder={`Enter ${f.name}`}
                          className="add-lead-input font-bold"
                        />
                      )}

                      {f.inputType === "SELECT" && (
                        <div className="relative">
                          <select
                            value={typeof val === "string" ? val : ""}
                            onChange={e => setCustomFieldValues({ ...customFieldValues, [f.id]: e.target.value })}
                            className="add-lead-select"
                          >
                            <option value="">Select option...</option>
                            {(f.options || []).map(opt => (
                              <option key={opt.id || opt.value} value={opt.value}>
                                {opt.label || opt.value}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                        </div>
                      )}

                      {f.inputType === "RADIO" && (
                        <div className="flex flex-wrap gap-3 pt-1">
                          {(f.options || []).map(opt => (
                            <label key={opt.id || opt.value} className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                              <input
                                type="radio"
                                name={`radio_${f.id}`}
                                value={opt.value}
                                checked={val === opt.value}
                                onChange={e => setCustomFieldValues({ ...customFieldValues, [f.id]: e.target.value })}
                                className="w-4 h-4 accent-emerald-500"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {f.inputType === "CHECKBOX" && (
                        <div className="flex flex-wrap gap-3 pt-1">
                          {(f.options || []).map(opt => {
                            const arr = Array.isArray(val) ? val : [];
                            const isChecked = arr.includes(opt.value);
                            return (
                              <label key={opt.id || opt.value} className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    const nextArr = e.target.checked
                                      ? [...arr, opt.value]
                                      : arr.filter(v => v !== opt.value);
                                    setCustomFieldValues({ ...customFieldValues, [f.id]: nextArr });
                                  }}
                                  className="w-4 h-4 rounded accent-emerald-500"
                                />
                                <span>{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {f.inputType === "DATE" && (
                        <input
                          type="date"
                          value={typeof val === "string" ? val : ""}
                          onChange={e => setCustomFieldValues({ ...customFieldValues, [f.id]: e.target.value })}
                          className="add-lead-input"
                        />
                      )}

                      {f.inputType === "DATETIME" && (
                        <input
                          type="datetime-local"
                          value={typeof val === "string" ? val : ""}
                          onChange={e => setCustomFieldValues({ ...customFieldValues, [f.id]: e.target.value })}
                          className="add-lead-input"
                        />
                      )}

                      {f.inputType === "FILE" && (
                        <div>
                          {val && typeof val === "object" && val.url ? (
                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-800/60 bg-emerald-950/20 text-xs text-emerald-300">
                              <span className="truncate font-semibold max-w-[200px] sm:max-w-[300px]">
                                📁 {val.name || "Attachment"}
                              </span>
                              <div className="flex items-center gap-2">
                                <a href={val.url} target="_blank" rel="noreferrer" className="text-emerald-400 underline hover:text-emerald-300 font-bold">
                                  View
                                </a>
                                <button
                                  type="button"
                                  onClick={() => setCustomFieldValues({ ...customFieldValues, [f.id]: null })}
                                  className="p-1 text-rose-400 hover:text-rose-300"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-800/60 cursor-pointer text-xs text-slate-300 transition-colors">
                              <UploadCloud className="w-4 h-4 text-emerald-400" />
                              <span>{uploadingFieldId === f.id ? "Uploading file..." : "Click to select & upload file (PDF, PNG, JPG max 5MB)"}</span>
                              <input
                                type="file"
                                className="hidden"
                                disabled={uploadingFieldId === f.id}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleCustomFileUpload(f.id, file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </form>

        {/* 3. FIXED STICKY ACTION FOOTER */}
        <div className="add-lead-footer">
          <button 
            type="button" 
            onClick={onClose}
            className="add-lead-cancel-btn"
          >
            Cancel
          </button>
          
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={loading}
            className="add-lead-submit-btn"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{isEdit ? "Saving..." : "Creating..."}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEdit ? "Save Changes" : "Create Lead"}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
