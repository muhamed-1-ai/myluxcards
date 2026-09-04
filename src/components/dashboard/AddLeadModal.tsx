"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded: () => void;
}

export function AddLeadModal({ isOpen, onClose, onLeadAdded }: AddLeadModalProps) {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; contactNumber?: string; email?: string; general?: string }>({});

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; contactNumber?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Please enter lead's name.";
    }
    if (!contactNumber.trim()) {
      newErrors.contactNumber = "Please enter contact number.";
    }
    if (email.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email.trim().toLowerCase())) {
        newErrors.email = "Please enter a valid email address.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim(),
          contactNumber: contactNumber.trim(),
          email: email.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setName("");
        setCompanyName("");
        setContactNumber("");
        setEmail("");
        onLeadAdded();
        onClose();
      } else {
        setErrors({ general: data.message || "Failed to add lead. Please try again." });
      }
    } catch {
      setErrors({ general: "Failed to add lead. Please check network and try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Add Lead">
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="crm-modal-header">
          <div>
            <span className="crm-eyebrow">LEAD CAPTURE</span>
            <h2 className="crm-modal-title">Add New Lead</h2>
          </div>
          <button type="button" className="crm-modal-close" onClick={onClose} aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.general && <div className="crm-error-banner">{errors.general}</div>}

        <form onSubmit={handleSubmit} className="crm-modal-form" noValidate>
          <div className="crm-field-group">
            <label htmlFor="manual-lead-name" className="crm-label">
              Name <span className="crm-req">*</span>
            </label>
            <input
              id="manual-lead-name"
              type="text"
              className={`crm-input ${errors.name ? "has-error" : ""}`}
              placeholder="Enter contact name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            {errors.name && <span className="crm-field-error">{errors.name}</span>}
          </div>

          <div className="crm-field-group">
            <label htmlFor="manual-lead-company" className="crm-label">Company Name</label>
            <input
              id="manual-lead-company"
              type="text"
              className="crm-input"
              placeholder="Enter company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="crm-field-group">
            <label htmlFor="manual-lead-contact" className="crm-label">
              Contact Number <span className="crm-req">*</span>
            </label>
            <input
              id="manual-lead-contact"
              type="tel"
              className={`crm-input ${errors.contactNumber ? "has-error" : ""}`}
              placeholder="+91 98765 43210"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              disabled={submitting}
            />
            {errors.contactNumber && <span className="crm-field-error">{errors.contactNumber}</span>}
          </div>

          <div className="crm-field-group">
            <label htmlFor="manual-lead-email" className="crm-label">Email Address</label>
            <input
              id="manual-lead-email"
              type="email"
              className={`crm-input ${errors.email ? "has-error" : ""}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
            {errors.email && <span className="crm-field-error">{errors.email}</span>}
          </div>

          <div className="crm-modal-actions">
            <button type="button" onClick={onClose} className="crm-btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="crm-btn-primary" disabled={submitting}>
              {submitting ? "ADDING LEAD..." : "SAVE LEAD"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
